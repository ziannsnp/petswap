#!/bin/sh
# Health and smoke check for the docker-compose.yml stack. Read-only: safe to
# run at any time, any number of times.
#
#   sh scripts/stack-health.sh              # check once
#   sh scripts/stack-health.sh --wait 180   # retry for up to 180s while it starts
#
# Exits 0 only when every check passes; otherwise prints each failure and exits 1.
#
#   1. Settings: .env defines every key in .env.example, the secrets are
#      well-formed, and the keys are really signed with JWT_SECRET.
#   2. Containers: every service is running (and healthy where it reports
#      health) and the one-shot migrate job exited 0.
#   3. Behaviour, through the published ports a browser uses: auth, the REST API
#      over the migrated schema, storage and its buckets, the sign-in Edge
#      Function, and the web app, including that the bundle it serves was built
#      for this .env.
#
# Reads settings from .env only; variables exported in the calling shell are
# ignored. Needs docker, curl, and openssl.
set -u

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
env_file="$root/.env"
example_file="$root/.env.example"

# Keys .env must define but may leave empty.
optional_values=' ADDITIONAL_REDIRECT_URLS SIGN_IN_PREVIEW_HOSTNAME_SUFFIX '
# service:needs-healthy for every long-running service in docker-compose.yml.
services='db:yes auth:yes rest:no storage:yes functions:no kong:yes web:yes'
buckets='listing-photos avatars pet-photos'

wait_seconds=0
case ${1-} in
  '') ;;
  --wait)
    wait_seconds=${2-}
    case $wait_seconds in
      '' | *[!0-9]*) echo "stack-health: --wait needs a number of seconds." >&2; exit 2 ;;
    esac
    ;;
  *) echo "usage: sh scripts/stack-health.sh [--wait SECONDS]" >&2; exit 2 ;;
esac

for tool in docker curl openssl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "stack-health: $tool is required but was not found on PATH." >&2
    exit 2
  fi
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
report=''

pass() { report="$report  ok    $1
"; }
fail() {
  report="$report  FAIL  $1
"
  failures=$((failures + 1))
}

# --- Settings ---------------------------------------------------------------

# env_keys FILE: the KEY of every KEY=VALUE line.
env_keys() {
  tr -d '\r' < "$1" | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p'
}

# setting KEY: its value in .env, empty when absent.
setting() {
  tr -d '\r' < "$env_file" | sed -n "s/^$1=//p" | tail -n 1
}

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# check_key NAME ROLE: NAME is a JWT signed with JWT_SECRET whose role is ROLE.
check_key() {
  token=$(setting "$1")
  signed=${token%.*}
  signature=${token##*.}
  payload=${signed#*.}
  expected=$(printf '%s' "$signed" | openssl dgst -sha256 -hmac "$(setting JWT_SECRET)" -binary | base64url)

  if [ "$signed" = "$token" ] || [ "$signature" != "$expected" ]; then
    fail "$1 is not a JWT signed with JWT_SECRET (regenerate both with scripts/stack-env.sh)"
    return
  fi

  padded=$(printf '%s' "$payload" | tr '_-' '/+')
  case $((${#padded} % 4)) in
    2) padded="$padded==" ;;
    3) padded="$padded=" ;;
  esac
  if printf '%s' "$padded" | openssl base64 -d -A 2>/dev/null | grep -q "\"role\":\"$2\""; then
    pass "$1 is signed with JWT_SECRET and carries role=$2"
  else
    fail "$1 is signed correctly but its role claim is not \"$2\""
  fi
}

check_settings() {
  if [ ! -f "$env_file" ]; then
    fail ".env is missing (run: sh scripts/stack-env.sh)"
    return
  fi

  defined=" $(env_keys "$env_file" | tr '\n' ' ')"
  missing=0
  for key in $(env_keys "$example_file"); do
    case $defined in
      *" $key "*) ;;
      *) fail "$key is not defined in .env (documented in .env.example)"; missing=$((missing + 1)); continue ;;
    esac
    case $optional_values in
      *" $key "*) continue ;;
    esac
    if [ -z "$(setting "$key")" ]; then
      fail "$key is empty in .env (documented in .env.example)"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -eq 0 ] || return
  pass ".env defines every setting in .env.example"

  if [ "$(setting JWT_SECRET | wc -c)" -le 32 ]; then
    fail "JWT_SECRET is shorter than 32 characters"
  fi
  case $(setting POSTGRES_PASSWORD) in
    *[!A-Za-z0-9_-]*) fail "POSTGRES_PASSWORD has characters that are not URL-safe (use letters, digits, - and _)" ;;
  esac
  check_key ANON_KEY anon
  check_key SERVICE_ROLE_KEY service_role

  site_origin=$(setting SITE_URL | sed 's|^\([a-z]*://[^/]*\).*|\1|')
  case ",$(setting SIGN_IN_ALLOWED_ORIGINS | tr -d ' ')," in
    *",$site_origin,"*) pass "SIGN_IN_ALLOWED_ORIGINS includes the SITE_URL origin" ;;
    *) fail "SIGN_IN_ALLOWED_ORIGINS does not include $site_origin, so username sign-in from the web app gets a 403" ;;
  esac
}

# --- Containers -------------------------------------------------------------

check_containers() {
  states=$(cd "$root" && docker compose ps -a --format '{{.Service}}|{{.State}}|{{.Health}}|{{.ExitCode}}' 2>"$work/ps-error")
  if [ -z "$states" ]; then
    fail "no containers found for this stack: $(head -c 300 "$work/ps-error") (run: docker compose up -d --build)"
    return 1
  fi

  for entry in $services; do
    service=${entry%%:*}
    line=$(printf '%s\n' "$states" | grep "^$service|" | head -n 1)
    state=$(printf '%s' "$line" | cut -d'|' -f2)
    health=$(printf '%s' "$line" | cut -d'|' -f3)
    if [ "$state" != "running" ]; then
      fail "service $service is ${state:-not created} (see: docker compose logs $service)"
    elif [ "${entry##*:}" = "yes" ] && [ "$health" != "healthy" ]; then
      fail "service $service is running but ${health:-not reporting health} (see: docker compose logs $service)"
    else
      pass "service $service is running${health:+ and $health}"
    fi
  done

  line=$(printf '%s\n' "$states" | grep '^migrate|' | head -n 1)
  state=$(printf '%s' "$line" | cut -d'|' -f2)
  code=$(printf '%s' "$line" | cut -d'|' -f4)
  if [ "$state" = "exited" ] && [ "$code" = "0" ]; then
    pass "migrate job finished successfully"
  else
    fail "migrate job is ${state:-not created} with exit code ${code:-none} (see: docker compose logs migrate)"
  fi
}

# --- Behaviour --------------------------------------------------------------

# http LABEL EXPECTED_STATUS BODY_PATTERN URL [curl args...]
# Passes when the status matches and the body contains BODY_PATTERN (a fixed
# string; '' skips the body check). The body is left in $work/body.
http() {
  label=$1
  expected=$2
  pattern=$3
  shift 3
  : > "$work/body"
  status=$(curl -s -o "$work/body" -w '%{http_code}' --max-time 20 "$@" 2>/dev/null)
  if [ "$status" = "000" ]; then
    fail "$label: no response (expected HTTP $expected)"
    return 1
  fi
  if [ "$status" != "$expected" ]; then
    fail "$label: expected HTTP $expected, got $status: $(head -c 200 "$work/body" | tr '\n' ' ')"
    return 1
  fi
  if [ -n "$pattern" ] && ! grep -qF -- "$pattern" "$work/body"; then
    fail "$label: HTTP $status but the response does not contain $pattern"
    return 1
  fi
  pass "$label"
}

check_behaviour() {
  host=$(setting BIND_ADDRESS)
  [ "$host" = "0.0.0.0" ] && host=127.0.0.1
  api="http://$host:$(setting API_PORT)"
  web="http://$host:$(setting WEB_PORT)"
  anon=$(setting ANON_KEY)
  service_role=$(setting SERVICE_ROLE_KEY)

  http "auth answers through the gateway" 200 'GoTrue' \
    "$api/auth/v1/health" -H "apikey: $anon"
  http "gateway rejects a request without an API key" 401 '' \
    "$api/auth/v1/health"
  http "REST API serves the migrated schema (public.listings)" 200 '[' \
    "$api/rest/v1/listings?select=id&limit=1" -H "apikey: $anon"

  if http "storage answers and lists buckets" 200 '' \
    "$api/storage/v1/bucket" -H "apikey: $service_role" -H "Authorization: Bearer $service_role"; then
    for bucket in $buckets; do
      if grep -qF "\"id\":\"$bucket\"" "$work/body"; then
        pass "storage bucket $bucket exists"
      else
        fail "storage bucket $bucket is missing (migrations did not create it)"
      fi
    done
  fi

  # An unknown username walks the whole path, function -> gateway -> REST and
  # auth, and must come back as a clean 401 rather than a 403 or 500.
  http "sign-in function reaches the database and auth" 401 'INVALID_CREDENTIALS' \
    "$api/functions/v1/sign-in" -X POST \
    -H "Origin: $(setting SITE_URL | sed 's|^\([a-z]*://[^/]*\).*|\1|')" \
    -H "apikey: $anon" -H 'Content-Type: application/json' \
    -d '{"username":"stack_health_probe","password":"not-a-real-account"}'

  http "web app serves a client-side route" 200 '<div id="root"' "$web/listings/stack-health-probe" || return

  # Vite bakes the API URL and anon key into the bundle at build time; a bundle
  # built before .env changed looks healthy but talks to the wrong place.
  : > "$work/bundle"
  for asset in $(grep -o '/assets/[A-Za-z0-9._-]*\.js' "$work/body" | sort -u); do
    curl -s --max-time 20 "$web$asset" >> "$work/bundle" 2>/dev/null
  done
  if grep -qF -- "$(setting API_EXTERNAL_URL)" "$work/bundle" && grep -qF -- "$anon" "$work/bundle"; then
    pass "web bundle was built with this .env's API_EXTERNAL_URL and ANON_KEY"
  else
    fail "web bundle was not built with this .env's API_EXTERNAL_URL and ANON_KEY (run: docker compose up -d --build)"
  fi
}

# --- Run --------------------------------------------------------------------

run_checks() {
  failures=0
  report=''
  settings_ok=no
  check_settings
  # A broken .env makes every later failure a symptom, so stop at the cause.
  [ "$failures" -eq 0 ] || return
  settings_ok=yes
  check_containers || return
  check_behaviour
}

deadline=$(($(date +%s) + wait_seconds))
while :; do
  run_checks
  [ "$failures" -eq 0 ] && break
  # Waiting helps a stack that is still starting, never a wrong .env.
  [ "$settings_ok" = "yes" ] || break
  [ "$(date +%s)" -ge "$deadline" ] && break
  sleep 5
done

printf '%s' "$report"
if [ "$failures" -eq 0 ]; then
  echo "stack-health: all checks passed."
  exit 0
fi
echo "stack-health: $failures check(s) failed." >&2
exit 1

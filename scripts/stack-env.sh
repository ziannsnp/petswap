#!/bin/sh
# Writes .env for docker-compose.yml: a copy of .env.example with a generated
# Postgres password, JWT secret, and the anon and service-role keys signed with
# that secret.
#
#   sh scripts/stack-env.sh
#
# Idempotent: an existing .env is left untouched, so re-running never rotates
# secrets under a running stack. To start over, remove the stack's volumes and
# the file together, because the old database only accepts the old password:
#
#   docker compose down -v && rm .env && sh scripts/stack-env.sh
#
# Needs openssl (ships with Git for Windows, macOS, and Linux).
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
example="$root/.env.example"
target="$root/.env"

if [ -f "$target" ]; then
  echo "stack-env: $target already exists; left untouched."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "stack-env: openssl is required to generate secrets but was not found on PATH." >&2
  exit 1
fi

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# sign_jwt ROLE: an HS256 JWT for ROLE, valid for ten years.
sign_jwt() {
  header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | base64url)
  payload=$(printf '{"role":"%s","iss":"petswap-compose","iat":%s,"exp":%s}' "$1" "$issued_at" "$expires_at" | base64url)
  signature=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$jwt_secret" -binary | base64url)
  printf '%s.%s.%s' "$header" "$payload" "$signature"
}

postgres_password=$(openssl rand -hex 24)
jwt_secret=$(openssl rand -hex 32)
issued_at=$(date +%s)
expires_at=$((issued_at + 315360000))
anon_key=$(sign_jwt anon)
service_role_key=$(sign_jwt service_role)

# Generated values are hex or base64url, so "|" is a safe sed delimiter.
umask 077
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$postgres_password|" \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$jwt_secret|" \
  -e "s|^ANON_KEY=.*|ANON_KEY=$anon_key|" \
  -e "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$service_role_key|" \
  "$example" > "$target"

echo "stack-env: wrote $target with new secrets."
echo "stack-env: next: docker compose up -d --build && sh scripts/stack-health.sh --wait 180"

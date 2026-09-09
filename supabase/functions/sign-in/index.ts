import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const productionOrigin = 'https://petswap-web.zianporrutai.workers.dev';
const previewOriginPattern = /^https:\/\/[a-z0-9-]+-petswap-web\.zianporrutai\.workers\.dev$/;
const localOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const usernamePattern = /^[a-z0-9_]{3,30}$/;
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const adminClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
const authClient =
  supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type ErrorCode = 'INVALID_CREDENTIALS' | 'EMAIL_NOT_CONFIRMED' | 'RATE_LIMITED' | 'UNKNOWN';

function isAllowedOrigin(origin: string | null): boolean {
  return (
    origin === null ||
    origin === productionOrigin ||
    localOrigins.has(origin) ||
    (origin !== null && previewOriginPattern.test(origin))
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? productionOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: ErrorCode, status: number, origin: string | null): Response {
  return jsonResponse({ error: { code } }, status, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');

  if (!isAllowedOrigin(origin)) {
    return Response.json({ error: { code: 'UNKNOWN' } }, { status: 403 });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return errorResponse('UNKNOWN', 405, origin);
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_CREDENTIALS', 400, origin);
  }

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!usernamePattern.test(username) || password.length === 0 || password.length > 1024) {
    return errorResponse('INVALID_CREDENTIALS', 400, origin);
  }

  if (!adminClient || !authClient) {
    return errorResponse('UNKNOWN', 500, origin);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (profileError) {
    return errorResponse('UNKNOWN', 500, origin);
  }

  let email = 'invalid-username@invalid.local';
  if (profile?.id) {
    const { data, error } = await adminClient.auth.admin.getUserById(profile.id);
    if (error) {
      return errorResponse('UNKNOWN', 500, origin);
    }
    if (!data.user) {
      return errorResponse('INVALID_CREDENTIALS', 401, origin);
    }
    email = data.user.email ?? email;
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return errorResponse('EMAIL_NOT_CONFIRMED', 403, origin);
    }
    if (error.code === 'over_request_rate_limit') {
      return errorResponse('RATE_LIMITED', 429, origin);
    }
    return errorResponse('INVALID_CREDENTIALS', 401, origin);
  }

  if (!data.session) {
    return errorResponse('UNKNOWN', 500, origin);
  }

  return jsonResponse(
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
    200,
    origin,
  );
});

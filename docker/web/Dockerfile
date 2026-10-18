# syntax=docker/dockerfile:1
# Production build of the Vite SPA, served by nginx. Build context is web/.
#
# Vite inlines VITE_* values into the bundle, so the Supabase URL and anon key
# are build arguments, not runtime environment: changing either in .env needs
# `docker compose up -d --build`.

# Keep in step with web/.nvmrc.
FROM node:22.23.2-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then \
      echo 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY build args are required.' >&2; \
      exit 1; \
    fi
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

FROM nginx:1.29-alpine

# Same routing as web/wrangler.toml's single-page-application fallback: unknown
# paths serve index.html so client-side routes survive a refresh. Hashed assets
# never fall back, so a stale reference is a 404 rather than HTML.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri /index.html;
        add_header Cache-Control "no-cache";
    }
}
EOF

COPY --from=build /app/dist /usr/share/nginx/html

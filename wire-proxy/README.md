# Wealth Wire Proxy (Cloudflare Worker)

This Worker forwards the Wire briefing request to Anthropic server-side so the app can use real web-search generation without Supabase access.

## 1) Install and login

```bash
npm i -g wrangler
wrangler login
```

## 2) Set Anthropic key

From this folder (`wire-proxy`):

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste your Anthropic key when prompted.

## 3) Deploy

```bash
wrangler deploy
```

After deploy, copy the Worker URL.

## 4) Connect app

Set this in your root `.env`:

```bash
VITE_WIRE_PROXY_URL="https://<your-worker>.workers.dev"
```

Restart your dev server after changing `.env`.

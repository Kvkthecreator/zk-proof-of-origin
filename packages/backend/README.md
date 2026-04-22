# Backend

The smallest possible Reclaim init proxy. Everything else in this project is client-side; this exists *only* because `APP_SECRET` cannot live in a browser bundle.

## What it does

One route: `GET /reclaim/init?providerId=...` → returns `{ configJson, providerId }` where `configJson` is what `ReclaimProofRequest.fromJsonString(...)` consumes in the browser.

Plus `GET /health` for sanity-checking deployment.

That's it. ~110 LOC, zero state, zero database.

## Run locally

```bash
# from repo root
npm install

# in this directory
cp .env.example .env
# edit .env with your Reclaim APP_ID, APP_SECRET, PROVIDER_ID
# (sign up at https://dev.reclaimprotocol.org/ to get them)

npm run dev --workspace=@zk-proof-of-origin/backend
# → http://localhost:4001/health
# → http://localhost:4001/reclaim/init
```

## Deploy

### Vercel (recommended)

```bash
# from this directory
npx vercel
# follow prompts — link or create the project
# in the Vercel dashboard, set env vars:
#   RECLAIM_APP_ID
#   RECLAIM_APP_SECRET
#   RECLAIM_DEFAULT_PROVIDER_ID
#   ALLOWED_ORIGINS=https://kvkthecreator.github.io
```

The web app reads `VITE_RECLAIM_BACKEND_URL` at build time. To point production at the deployed backend:

```bash
# in packages/web/.env.production (gitignored)
VITE_RECLAIM_BACKEND_URL=https://zk-proof-of-origin-backend.vercel.app
```

Then any `npm run build` of the web package emits a bundle that points at your live backend.

### Anywhere else

It's a vanilla Express server. Fly, Railway, Render, your own VPS — all work. Set the same env vars, expose port 4001 (or whatever PORT you set).

## What it does not do

- No proof storage. We don't see proofs.
- No claim data. The browser SDK runs the user-facing Reclaim flow itself.
- No auth on the backend route. The Reclaim attestor network is the trust root, not us. If we wanted rate limiting we'd add it here, but for the demo scope it's not necessary.

## Trust model disclosure

This backend exists because Reclaim's SDK requires it. Our circuit, our zkApp, our verifier — all client-side. The backend has knowledge of `APP_ID + APP_SECRET` but not of any individual user's claim, and is not part of the cryptographic trust chain.

The `Trust attestors + math` line in our grant proposal still holds. The backend is operational infrastructure, not a trust assumption.

# Deploying the web app

The web app is a pure static bundle — `npm run build` produces `packages/web/dist/` which can be hosted anywhere. The tricky bit is that **o1js requires `SharedArrayBuffer`, which requires cross-origin isolation** (COOP/COEP headers). Different hosts handle this differently.

## Option 1: GitHub Pages (recommended; fully configured)

A GitHub Actions workflow at [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) auto-builds and deploys on every push to `main`. To enable:

1. In the GitHub repo, go to **Settings → Pages**.
2. Under "Build and deployment," set **Source** to **GitHub Actions**.
3. Push (or re-run the workflow from the Actions tab).
4. After the first run, the live URL is `https://<user>.github.io/zk-proof-of-origin/`.

GitHub Pages can't set custom HTTP headers, so we use [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) to simulate COOP/COEP via a service worker (already installed + wired into `index.html`). The page reloads once on first visit to register the worker, then o1js works normally.

## Option 2: Cloudflare Pages / Netlify / Vercel

All three support real COOP/COEP headers via config files. If you prefer one of these, add the relevant file — they all read `packages/web/dist/` after running `npm run build`:

- **Cloudflare Pages:** drop a `_headers` file into `public/` with:
  ```
  /*
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
  ```
- **Netlify:** same `_headers` file, same contents.
- **Vercel:** `vercel.json` at web-package root:
  ```json
  {
    "headers": [
      { "source": "/(.*)", "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ] }
    ]
  }
  ```

With real headers, the `coi-serviceworker` script is still fine to leave in — it no-ops when native headers are already set.

## Option 3: Manual

```bash
cd packages/web
npm run build
# dist/ is now a static bundle. Upload it anywhere, or:
npx serve dist
```

For local preview without o1js errors: `npm run dev` or `npm run preview` — both set COOP/COEP server-side.

## Environment variables

If you redeploy the zkApp to a different address or GraphQL endpoint, build with:

```bash
VITE_ZKAPP_ADDRESS=B62... VITE_MINA_GRAPHQL_URL=https://... npm run build
```

Defaults point to the current devnet deployment at `B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`.

## Verifying the deploy

After deploy, load the site and open the browser devtools console. You should see:

1. A one-time reload (the service worker registering — only on GitHub Pages / no-header hosts).
2. `crossOriginIsolated === true` returns true: run `console.log(self.crossOriginIsolated)`.
3. Clicking "Generate proof" on the Create tab completes in ~5s (wallet-only mode).

If `crossOriginIsolated` is false after reload, the service worker didn't register — check that `coi-serviceworker.js` is served at the same origin with content-type `application/javascript` and that you're on HTTPS or localhost.

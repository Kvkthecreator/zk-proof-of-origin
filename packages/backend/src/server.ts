/**
 * Minimal Reclaim init proxy.
 *
 * Why this exists: @reclaimprotocol/js-sdk requires APP_SECRET on init,
 * and APP_SECRET cannot ship in a browser bundle. The canonical pattern
 * is: backend calls `ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDER_ID)`
 * and serializes the result via `toJsonString()`; frontend imports via
 * `fromJsonString()` and runs the rest of the flow client-side.
 *
 * Everything else stays in the browser — proof generation, verification,
 * on-chain anchoring. This file is the smallest thing that can possibly
 * unlock the live attestor flow.
 *
 * Run locally:    npm run dev --workspace=@zk-proof-of-origin/backend
 * Deploy to Vercel: see ./vercel.json (one-click after you wire env vars)
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';

const PORT = Number(process.env.PORT ?? 4001);

const APP_ID = process.env.RECLAIM_APP_ID;
const APP_SECRET = process.env.RECLAIM_APP_SECRET;
const DEFAULT_PROVIDER_ID = process.env.RECLAIM_DEFAULT_PROVIDER_ID;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!APP_ID || !APP_SECRET) {
  console.warn(
    '[backend] RECLAIM_APP_ID and/or RECLAIM_APP_SECRET not set. ' +
      'The /reclaim/init route will return 503 until they are. ' +
      'Get them from https://dev.reclaimprotocol.org/'
  );
}

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    reclaimConfigured: Boolean(APP_ID && APP_SECRET),
    defaultProviderId: DEFAULT_PROVIDER_ID ?? null,
  });
});

/**
 * Returns the Reclaim init JSON the browser SDK can consume via
 * `ReclaimProofRequest.fromJsonString(...)`. Optional ?providerId=
 * query param overrides the default — handy if we ever want to demo
 * multiple providers from one frontend.
 *
 * Body shape: { configJson: string, providerId: string }.
 */
app.get('/reclaim/init', async (req: Request, res: Response) => {
  if (!APP_ID || !APP_SECRET) {
    res.status(503).json({
      error: 'Backend missing RECLAIM_APP_ID / RECLAIM_APP_SECRET',
      hint: 'Set them in packages/backend/.env (see .env.example)',
    });
    return;
  }
  const providerId =
    typeof req.query.providerId === 'string' && req.query.providerId.length > 0
      ? req.query.providerId
      : DEFAULT_PROVIDER_ID;
  if (!providerId) {
    res.status(400).json({
      error: 'No provider ID — pass ?providerId=... or set RECLAIM_DEFAULT_PROVIDER_ID',
    });
    return;
  }

  try {
    const proofRequest = await ReclaimProofRequest.init(
      APP_ID,
      APP_SECRET,
      providerId
    );
    const configJson = proofRequest.toJsonString();
    res.json({ configJson, providerId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'Reclaim init failed', detail: message });
  }
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(
    `[backend] reclaim configured: ${Boolean(APP_ID && APP_SECRET)}, default provider: ${
      DEFAULT_PROVIDER_ID ?? '(none — set RECLAIM_DEFAULT_PROVIDER_ID)'
    }`
  );
});

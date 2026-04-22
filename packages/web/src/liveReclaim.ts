import { ReclaimProofRequest, type Proof } from '@reclaimprotocol/js-sdk';

/**
 * Backend URL gate: if this isn't set at build time, live mode is disabled
 * and the UI hides the "Verify with Reclaim (live)" affordance entirely.
 * Set in `.env.local` or `.env.production` as VITE_RECLAIM_BACKEND_URL.
 */
export const LIVE_RECLAIM_BACKEND_URL =
  (import.meta.env.VITE_RECLAIM_BACKEND_URL as string | undefined) ?? '';

export const LIVE_RECLAIM_ENABLED = LIVE_RECLAIM_BACKEND_URL.length > 0;

export type LiveReclaimStage =
  | { stage: 'fetching-config' }
  | { stage: 'awaiting-user'; qrUrl: string }
  | { stage: 'received-proof' }
  | { stage: 'error'; message: string };

export type LiveReclaimResult = {
  rawProof: Proof;
  /**
   * The Reclaim SDK returns proofs as a heterogeneous shape across versions.
   * Normalize to the JSON-string form we feed into `parseReclaimJson` in our
   * existing prover — same path the paste-a-claim mode already uses, so
   * everything downstream stays unchanged.
   */
  jsonForExistingProver: string;
};

/**
 * Run the full live Reclaim flow: ask the backend for an init config,
 * import it into the browser SDK, render a QR for the user to scan,
 * await the attestor's signed callback. Resolves with a normalized proof
 * shape that the existing `proveReclaimFlow` consumes.
 */
export async function runLiveReclaimFlow(
  onStage: (s: LiveReclaimStage) => void,
  providerId?: string
): Promise<LiveReclaimResult> {
  if (!LIVE_RECLAIM_ENABLED) {
    throw new Error(
      'Live Reclaim mode is disabled — VITE_RECLAIM_BACKEND_URL is not set.'
    );
  }

  onStage({ stage: 'fetching-config' });

  const initUrl = new URL('/reclaim/init', LIVE_RECLAIM_BACKEND_URL);
  if (providerId) initUrl.searchParams.set('providerId', providerId);
  const resp = await fetch(initUrl.toString());
  if (!resp.ok) {
    let detail = '';
    try {
      const body = (await resp.json()) as { error?: string; hint?: string };
      detail = [body.error, body.hint].filter(Boolean).join(' — ');
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    const error = new Error(`Backend /reclaim/init failed: ${detail}`);
    onStage({ stage: 'error', message: error.message });
    throw error;
  }

  const { configJson } = (await resp.json()) as {
    configJson: string;
    providerId: string;
  };

  const reclaimRequest = await ReclaimProofRequest.fromJsonString(configJson);
  const qrUrl = await reclaimRequest.getRequestUrl();
  onStage({ stage: 'awaiting-user', qrUrl });

  return new Promise<LiveReclaimResult>((resolve, reject) => {
    void reclaimRequest.startSession({
      onSuccess: (proofs: Proof | Proof[] | string | undefined) => {
        if (!proofs) {
          const e = new Error('Reclaim returned an empty proof payload');
          onStage({ stage: 'error', message: e.message });
          reject(e);
          return;
        }
        const proof: Proof = Array.isArray(proofs) ? proofs[0] : (proofs as Proof);
        const jsonForExistingProver = JSON.stringify(proof);
        onStage({ stage: 'received-proof' });
        resolve({ rawProof: proof, jsonForExistingProver });
      },
      onError: (error: Error) => {
        onStage({ stage: 'error', message: error.message });
        reject(error);
      },
    });
  });
}

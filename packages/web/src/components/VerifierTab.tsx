import { useEffect, useState } from 'react';
import {
  PROOF_URL_PARAM,
  decodeProofFromString,
  readProofFromLocation,
} from '../proofEncoding';
import { verifyOriginProof } from '../prover';

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | {
      kind: 'ok';
      valid: boolean;
      contentHash: string;
      credentialCommitment: string;
      originType: string;
      verifyTimeMs: number;
    }
  | { kind: 'error'; message: string };

function originTypeLabel(originType: string): string {
  if (originType === '0') return 'Human (wallet-bound)';
  if (originType === '2') return 'Human (attestor-verified, Poseidon)';
  if (originType === '3') return 'Human (Reclaim attestor, Ethereum-bound)';
  if (originType === '1') return 'AI-generated';
  return `Unknown (${originType})`;
}

export function VerifierTab({
  initialEncoded,
}: {
  initialEncoded: string | null;
}) {
  const [encoded, setEncoded] = useState(initialEncoded ?? '');
  const [state, setState] = useState<VerifyState>({ kind: 'idle' });

  useEffect(() => {
    if (initialEncoded) {
      void runVerify(initialEncoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runVerify(value: string) {
    setState({ kind: 'loading', message: 'Decoding proof' });
    try {
      const serialized = decodeProofFromString(value);
      setState({
        kind: 'loading',
        message: 'Compiling verifier (one-time) and verifying',
      });
      const r = await verifyOriginProof(serialized.proof);
      setState({ kind: 'ok', ...r });
      if (!initialEncoded) {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = `${PROOF_URL_PARAM}=${value}`;
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="label">Proof payload (paste full link or encoded string)</div>
        <input
          type="text"
          value={encoded}
          onChange={(e) => {
            const v = e.target.value;
            const maybeUrl = v.trim();
            if (maybeUrl.startsWith('http')) {
              const parsed = new URL(maybeUrl);
              const fromUrl = readProofFromLocation(
                parsed.search,
                parsed.hash
              );
              setEncoded(fromUrl ?? v);
            } else {
              setEncoded(v);
            }
          }}
          placeholder="Paste link from a creator..."
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="primary"
            disabled={encoded.length === 0 || state.kind === 'loading'}
            onClick={() => runVerify(encoded)}
          >
            {state.kind === 'loading' ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </div>

      {state.kind === 'loading' && (
        <div className="panel">
          <div className="status">
            <span className="dot" />
            <span>{state.message}</span>
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="panel">
          <div className="status err">
            <span className="dot" />
            <span>{state.message}</span>
          </div>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="panel">
          <div
            className={`status ${state.valid ? 'ok' : 'err'}`}
            style={{ marginBottom: 12, fontSize: 15 }}
          >
            <span className="dot" />
            <span>
              {state.valid ? 'Proof is valid' : 'Proof is INVALID'}
            </span>
          </div>
          <div className="result-grid">
            <span className="k">Origin</span>
            <span>{originTypeLabel(state.originType)}</span>
            <span className="k">Content hash</span>
            <span className="mono">{state.contentHash}</span>
            <span className="k">Credential</span>
            <span className="mono">{state.credentialCommitment}</span>
            <span className="k">Verify time</span>
            <span>{state.verifyTimeMs.toFixed(0)}ms</span>
          </div>
          <div className="hint">
            This verification ran entirely in your browser. Content itself is
            not revealed — only the hash bound to the proof.
          </div>
        </div>
      )}
    </div>
  );
}

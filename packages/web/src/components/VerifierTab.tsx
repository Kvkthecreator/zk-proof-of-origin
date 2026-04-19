import { useEffect, useState } from 'react';
import {
  PROOF_URL_PARAM,
  decodeProofFromString,
  readProofFromLocation,
} from '../proofEncoding';
import { verifyOriginProof } from '../prover';
import {
  DEPLOYED_ZKAPP_ADDRESS,
  checkIsLatestAnchor,
  explorerAccountUrl,
  type AnchorLookupResult,
} from '../onchainAnchor';

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

type AnchorState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'resolved'; result: AnchorLookupResult };

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
  const [anchor, setAnchor] = useState<AnchorState>({ kind: 'idle' });

  useEffect(() => {
    if (initialEncoded) {
      void runVerify(initialEncoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runVerify(value: string) {
    setState({ kind: 'loading', message: 'Decoding proof' });
    setAnchor({ kind: 'idle' });
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
      if (r.valid) {
        setAnchor({ kind: 'loading' });
        try {
          const result = await checkIsLatestAnchor({
            contentHash: r.contentHash,
            credentialCommitment: r.credentialCommitment,
            originType: r.originType,
          });
          setAnchor({ kind: 'resolved', result });
        } catch (e) {
          setAnchor({
            kind: 'resolved',
            result: {
              kind: 'registry-offline',
              message:
                e instanceof Error ? e.message : String(e),
            },
          });
        }
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

      {state.kind === 'ok' && state.valid && (
        <OnchainAnchorPanel anchor={anchor} />
      )}
    </div>
  );
}

function OnchainAnchorPanel({ anchor }: { anchor: AnchorState }) {
  return (
    <div className="panel">
      <div className="label">On-chain anchor (Mina devnet)</div>
      {anchor.kind === 'idle' && (
        <div className="muted">Not yet checked.</div>
      )}
      {anchor.kind === 'loading' && (
        <div className="status">
          <span className="dot" />
          <span>Querying {DEPLOYED_ZKAPP_ADDRESS.slice(0, 12)}… on Mina devnet</span>
        </div>
      )}
      {anchor.kind === 'resolved' &&
        anchor.result.kind === 'anchored-latest' && (
          <>
            <div className="status ok">
              <span className="dot" />
              <span>
                Anchored on-chain as the latest commitment (sequence{' '}
                {anchor.result.sequence.toString()})
              </span>
            </div>
            <div className="hint">
              The ProofCommitmentRegistry zkApp on Mina devnet holds a
              Poseidon digest that matches this proof's public inputs.{' '}
              <a
                href={explorerAccountUrl()}
                target="_blank"
                rel="noreferrer"
              >
                View on MinaScan →
              </a>
            </div>
          </>
        )}
      {anchor.kind === 'resolved' &&
        anchor.result.kind === 'not-latest' && (
          <>
            <div className="status">
              <span className="dot" />
              <span>
                Not the latest on-chain anchor (registry has{' '}
                {anchor.result.proofCount.toString()} total anchors; this
                proof may have been superseded or never submitted)
              </span>
            </div>
            <div className="hint">
              The registry currently holds digest{' '}
              <code className="mono">
                {anchor.result.onchainDigest.toString().slice(0, 18)}…
              </code>{' '}
              which does not match this proof's computed digest. Historical
              anchor scanning is a Milestone 6+ feature. For now, anyone can
              call <code>anchor(proof)</code> on the zkApp to make this proof
              the latest.{' '}
              <a
                href={explorerAccountUrl()}
                target="_blank"
                rel="noreferrer"
              >
                View on MinaScan →
              </a>
            </div>
          </>
        )}
      {anchor.kind === 'resolved' &&
        anchor.result.kind === 'registry-offline' && (
          <>
            <div className="status err">
              <span className="dot" />
              <span>
                Could not reach the devnet registry: {anchor.result.message}
              </span>
            </div>
            <div className="hint">
              The local proof is still valid — on-chain anchoring is an
              optional layer, not required for verification.
            </div>
          </>
        )}
    </div>
  );
}

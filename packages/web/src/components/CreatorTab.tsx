import { useState } from 'react';
import {
  proveHumanFlow,
  type ProveProgress,
  type ProveResult,
} from '../prover';
import { encodeProofToUrl } from '../proofEncoding';

const STAGE_COPY: Record<ProveProgress['stage'], string> = {
  compiling: 'Compiling circuit (one-time, ~30–60s in browser)',
  hashing: 'Hashing content with Poseidon',
  signing: 'Generating ephemeral wallet and signing',
  proving: 'Generating zero-knowledge proof',
  verifying: 'Verifying',
  done: 'Proof ready',
};

const STAGE_PROGRESS: Record<ProveProgress['stage'], number> = {
  compiling: 20,
  hashing: 35,
  signing: 45,
  proving: 85,
  verifying: 95,
  done: 100,
};

export function CreatorTab() {
  const [text, setText] = useState(
    'I am a human, and I made this content.'
  );
  const [progress, setProgress] = useState<ProveProgress | null>(null);
  const [result, setResult] = useState<ProveResult | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const running =
    progress !== null && progress.stage !== 'done' && result === null;

  async function onGenerate() {
    setError(null);
    setResult(null);
    setShareUrl(null);
    setCopied(false);
    try {
      const r = await proveHumanFlow(text, (p) => setProgress(p));
      setResult(r);
      const verifyBase = new URL(window.location.href);
      verifyBase.search = '';
      verifyBase.hash = '';
      const url = encodeProofToUrl(verifyBase.toString(), r.proof);
      setShareUrl(url);
      setProgress({ stage: 'done' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const barPct = progress ? STAGE_PROGRESS[progress.stage] : 0;

  return (
    <div>
      <div className="panel">
        <label className="label" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          placeholder="Paste the text you want to prove you authored..."
        />
        <div className="hint">
          The content is hashed locally with Poseidon. Only the hash is bound to
          the proof — the content itself never leaves your browser.
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <button
            className="primary"
            onClick={onGenerate}
            disabled={running || text.length === 0}
          >
            {running ? 'Generating…' : 'Generate proof'}
          </button>
          <span className="muted">
            Mode: wallet signature (ephemeral). Attestor-backed mode coming next.
          </span>
        </div>

        {progress && (
          <>
            <div
              className={`status ${progress.stage === 'done' ? 'ok' : ''}`}
              style={{ marginTop: 16 }}
            >
              <span className="dot" />
              <span>{STAGE_COPY[progress.stage]}</span>
            </div>
            <div className="progress">
              <div className="bar" style={{ width: `${barPct}%` }} />
            </div>
          </>
        )}

        {error && (
          <div className="status err" style={{ marginTop: 16 }}>
            <span className="dot" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && shareUrl && (
        <div className="panel">
          <div className="label">Proof generated</div>
          <div className="result-grid" style={{ marginBottom: 16 }}>
            <span className="k">Content hash</span>
            <span className="mono">{result.contentHash}</span>
            <span className="k">Wallet</span>
            <span className="mono">{result.walletAddress}</span>
            <span className="k">Prove time</span>
            <span>{(result.proofTimeMs / 1000).toFixed(2)}s</span>
          </div>

          <div className="label">Shareable verification link</div>
          <input
            type="text"
            value={shareUrl}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="secondary" onClick={copyShareUrl}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              className="secondary"
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              Open in verifier
            </a>
          </div>
          <div className="hint">
            The link contains the full proof (base64url-encoded). Anyone who
            opens it can verify locally — no server involved.
          </div>
        </div>
      )}
    </div>
  );
}

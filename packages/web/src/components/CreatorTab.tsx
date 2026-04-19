import { useState } from 'react';
import {
  proveHumanFlow,
  type ProveProgress,
  type ProveResult,
} from '../prover';
import {
  proveReclaimFlow,
  type ReclaimProveProgress,
  type ReclaimProveResult,
} from '../reclaimProver';
import { encodeProofToUrl } from '../proofEncoding';
import { DEMO_RECLAIM_CLAIM_JSON } from '../demoFixture';
import { ModeSelector, type CreatorMode } from './ModeSelector';

const WALLET_STAGE_COPY: Record<ProveProgress['stage'], string> = {
  compiling: 'Compiling circuit (one-time, ~30–60s in browser)',
  hashing: 'Hashing content with Poseidon',
  signing: 'Generating ephemeral wallet and signing',
  proving: 'Generating zero-knowledge proof',
  verifying: 'Verifying',
  done: 'Proof ready',
};
const WALLET_STAGE_PROGRESS: Record<ProveProgress['stage'], number> = {
  compiling: 20,
  hashing: 35,
  signing: 45,
  proving: 85,
  verifying: 95,
  done: 100,
};

const RECLAIM_STAGE_COPY: Record<ReclaimProveProgress['stage'], string> = {
  parsing: 'Parsing Reclaim claim JSON',
  recovering: 'Recovering attestor public key (secp256k1 ecrecover)',
  compiling: 'Compiling circuit (one-time, ~60–90s in browser)',
  hashing: 'Hashing content with Poseidon',
  signing: 'Generating ephemeral wallet and signing',
  proving: 'Verifying attestor ECDSA in-circuit and generating proof',
  done: 'Proof ready',
};
const RECLAIM_STAGE_PROGRESS: Record<ReclaimProveProgress['stage'], number> = {
  parsing: 8,
  recovering: 15,
  compiling: 30,
  hashing: 35,
  signing: 42,
  proving: 88,
  done: 100,
};

const RECLAIM_SAMPLE_HINT = `Paste the JSON your Reclaim SDK returns (the "Proof" object). Expected keys:
{
  "claimData": { "provider": "...", "parameters": "...", "context": "..." },
  "signatures": ["0x...65-byte-hex..."],
  "witnesses": [{ "id": "0x244897..." }],
  "extractedParameters": { "username": "..." }
}
The canonical Reclaim attestor address is 0x244897572368eadf65bfbc5aec98d8e5443a9072; the proof binds to whichever address the witness reports.`;

export function CreatorTab() {
  const [text, setText] = useState(
    'I am a human, and I made this content.'
  );
  const [mode, setMode] = useState<CreatorMode>('wallet');
  const [reclaimJson, setReclaimJson] = useState('');

  const [walletProgress, setWalletProgress] = useState<ProveProgress | null>(
    null
  );
  const [walletResult, setWalletResult] = useState<ProveResult | null>(null);

  const [reclaimProgress, setReclaimProgress] =
    useState<ReclaimProveProgress | null>(null);
  const [reclaimResult, setReclaimResult] = useState<ReclaimProveResult | null>(
    null
  );

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const running =
    (walletProgress !== null && walletResult === null) ||
    (reclaimProgress !== null && reclaimResult === null);

  function resetForRun() {
    setError(null);
    setShareUrl(null);
    setCopied(false);
    setWalletResult(null);
    setReclaimResult(null);
    setWalletProgress(null);
    setReclaimProgress(null);
  }

  function computeShareUrl(proof: ProveResult['proof']) {
    const base = new URL(window.location.href);
    base.search = '';
    base.hash = '';
    return encodeProofToUrl(base.toString(), proof);
  }

  async function onGenerate() {
    resetForRun();
    try {
      if (mode === 'wallet') {
        const r = await proveHumanFlow(text, setWalletProgress);
        setWalletResult(r);
        setShareUrl(computeShareUrl(r.proof));
        setWalletProgress({ stage: 'done' });
      } else {
        if (!reclaimJson.trim()) {
          throw new Error('Paste a Reclaim claim JSON before generating.');
        }
        const r = await proveReclaimFlow(text, reclaimJson, setReclaimProgress);
        setReclaimResult(r);
        setShareUrl(computeShareUrl(r.proof));
        setReclaimProgress({ stage: 'done' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWalletProgress(null);
      setReclaimProgress(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const stageLabel =
    walletProgress !== null
      ? WALLET_STAGE_COPY[walletProgress.stage]
      : reclaimProgress !== null
      ? RECLAIM_STAGE_COPY[reclaimProgress.stage]
      : '';
  const stagePct =
    walletProgress !== null
      ? WALLET_STAGE_PROGRESS[walletProgress.stage]
      : reclaimProgress !== null
      ? RECLAIM_STAGE_PROGRESS[reclaimProgress.stage]
      : 0;
  const stageDone =
    (walletProgress?.stage === 'done' && walletResult !== null) ||
    (reclaimProgress?.stage === 'done' && reclaimResult !== null);

  return (
    <div>
      <div className="panel">
        <label className="label">Proof mode</label>
        <ModeSelector mode={mode} onChange={setMode} disabled={running} />
      </div>

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
          The content is hashed locally with Poseidon. Only the hash is bound
          to the proof — the content itself never leaves your browser.
        </div>
      </div>

      {mode === 'reclaim-pasted' && (
        <div className="panel">
          <label className="label" htmlFor="reclaim-json">
            Reclaim claim JSON
          </label>
          <textarea
            id="reclaim-json"
            value={reclaimJson}
            onChange={(e) => setReclaimJson(e.target.value)}
            disabled={running}
            placeholder='Paste the Proof object from @reclaimprotocol/js-sdk ...'
            style={{ minHeight: 140, fontSize: 12 }}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="secondary"
              disabled={running}
              onClick={() => setReclaimJson(DEMO_RECLAIM_CLAIM_JSON)}
            >
              Load demo claim (GitHub provider, demo attestor)
            </button>
          </div>
          <div className="hint" style={{ whiteSpace: 'pre-wrap' }}>
            {RECLAIM_SAMPLE_HINT}
          </div>
        </div>
      )}

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
            {mode === 'wallet'
              ? 'Mode: wallet signature (ephemeral).'
              : 'Mode: Reclaim attestor (ECDSA-secp256k1 verified in-circuit).'}
          </span>
        </div>

        {(walletProgress || reclaimProgress) && (
          <>
            <div
              className={`status ${stageDone ? 'ok' : ''}`}
              style={{ marginTop: 16 }}
            >
              <span className="dot" />
              <span>{stageLabel}</span>
            </div>
            <div className="progress">
              <div className="bar" style={{ width: `${stagePct}%` }} />
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

      {walletResult && shareUrl && (
        <ResultPanel
          title="Proof generated (wallet only)"
          rows={[
            ['Content hash', walletResult.contentHash],
            ['Wallet', walletResult.walletAddress],
            [
              'Prove time',
              `${(walletResult.proofTimeMs / 1000).toFixed(2)}s`,
            ],
          ]}
          shareUrl={shareUrl}
          copied={copied}
          onCopy={copyShareUrl}
        />
      )}

      {reclaimResult && shareUrl && (
        <ResultPanel
          title="Proof generated (Reclaim attestor)"
          rows={[
            ['Content hash', reclaimResult.contentHash],
            ['Provider', reclaimResult.provider],
            ...(reclaimResult.extractedUsername
              ? ([
                  ['Verified identity', reclaimResult.extractedUsername],
                ] as [string, string][])
              : []),
            ['Attestor', reclaimResult.attestorAddress],
            ['Wallet', reclaimResult.walletAddress],
            [
              'Prove time',
              `${(reclaimResult.proofTimeMs / 1000).toFixed(2)}s`,
            ],
          ]}
          shareUrl={shareUrl}
          copied={copied}
          onCopy={copyShareUrl}
        />
      )}
    </div>
  );
}

function ResultPanel({
  title,
  rows,
  shareUrl,
  copied,
  onCopy,
}: {
  title: string;
  rows: Array<[string, string]>;
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="panel">
      <div className="label">{title}</div>
      <div className="result-grid" style={{ marginBottom: 16 }}>
        {rows.map(([k, v]) => (
          <RowKV key={k} k={k} v={v} />
        ))}
      </div>

      <div className="label">Shareable verification link</div>
      <input
        type="text"
        value={shareUrl}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="secondary" onClick={onCopy}>
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
        The link contains the full proof (base64url-encoded in the URL hash).
        Anyone who opens it can verify locally — no server involved.
      </div>
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  const isLong = v.length > 40;
  return (
    <>
      <span className="k">{k}</span>
      <span className={isLong ? 'mono' : undefined}>{v}</span>
    </>
  );
}

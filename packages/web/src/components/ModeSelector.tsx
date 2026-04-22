import { LIVE_RECLAIM_ENABLED } from '../liveReclaim';

export type CreatorMode = 'wallet' | 'reclaim-pasted' | 'reclaim-live';

export function ModeSelector({
  mode,
  onChange,
  disabled,
}: {
  mode: CreatorMode;
  onChange: (mode: CreatorMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="mode-selector" role="radiogroup" aria-label="Proof mode">
      <button
        role="radio"
        aria-checked={mode === 'wallet'}
        disabled={disabled}
        onClick={() => onChange('wallet')}
        className={`mode-card ${mode === 'wallet' ? 'active' : ''}`}
      >
        <div className="mode-title">Wallet only</div>
        <div className="mode-desc">
          Ephemeral Mina wallet signs your content. Fast (~5s). No identity
          claim.
        </div>
      </button>
      {LIVE_RECLAIM_ENABLED && (
        <button
          role="radio"
          aria-checked={mode === 'reclaim-live'}
          disabled={disabled}
          onClick={() => onChange('reclaim-live')}
          className={`mode-card ${mode === 'reclaim-live' ? 'active' : ''}`}
        >
          <div className="mode-title">Reclaim — live ⚡</div>
          <div className="mode-desc">
            Verify your real GitHub identity via the Reclaim attestor
            network. Scan a QR with your phone, sign in, get a real
            attested proof. End-to-end ECDSA verified in-circuit.
          </div>
        </button>
      )}
      <button
        role="radio"
        aria-checked={mode === 'reclaim-pasted'}
        disabled={disabled}
        onClick={() => onChange('reclaim-pasted')}
        className={`mode-card ${mode === 'reclaim-pasted' ? 'active' : ''}`}
      >
        <div className="mode-title">Reclaim claim (paste)</div>
        <div className="mode-desc">
          Paste a pre-signed Reclaim claim JSON. Useful for testing and
          for the committed demo fixture (no Reclaim account needed).
        </div>
      </button>
    </div>
  );
}

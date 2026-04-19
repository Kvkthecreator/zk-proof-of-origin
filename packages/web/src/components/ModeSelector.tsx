export type CreatorMode = 'wallet' | 'reclaim-pasted';

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
      <button
        role="radio"
        aria-checked={mode === 'reclaim-pasted'}
        disabled={disabled}
        onClick={() => onChange('reclaim-pasted')}
        className={`mode-card ${mode === 'reclaim-pasted' ? 'active' : ''}`}
      >
        <div className="mode-title">Reclaim claim</div>
        <div className="mode-desc">
          Paste a Reclaim-signed HTTPS claim (e.g. GitHub username). ECDSA
          verified in-circuit against the Reclaim attestor network.
        </div>
      </button>
    </div>
  );
}

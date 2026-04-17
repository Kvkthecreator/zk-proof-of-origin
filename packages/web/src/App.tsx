import { useMemo, useState } from 'react';
import { CreatorTab } from './components/CreatorTab';
import { VerifierTab } from './components/VerifierTab';
import { readProofFromLocation } from './proofEncoding';
import './styles.css';

type TabKey = 'create' | 'verify';

export function App() {
  const initialEncoded = useMemo(
    () => readProofFromLocation(window.location.search, window.location.hash),
    []
  );
  const [tab, setTab] = useState<TabKey>(
    initialEncoded ? 'verify' : 'create'
  );

  return (
    <div className="app">
      <header className="header">
        <h1>zk-proof-of-origin</h1>
        <p>
          Cryptographic proof of content origin on Mina Protocol — generate and
          verify provenance proofs, all in-browser.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          className={`tab ${tab === 'create' ? 'active' : ''}`}
          role="tab"
          aria-selected={tab === 'create'}
          onClick={() => setTab('create')}
        >
          Create
        </button>
        <button
          className={`tab ${tab === 'verify' ? 'active' : ''}`}
          role="tab"
          aria-selected={tab === 'verify'}
          onClick={() => setTab('verify')}
        >
          Verify
        </button>
      </nav>

      {tab === 'create' ? (
        <CreatorTab />
      ) : (
        <VerifierTab initialEncoded={initialEncoded} />
      )}
    </div>
  );
}

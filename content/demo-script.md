# Demo Video Script — zk-proof-of-origin

**Target length:** 60–90 seconds.
**Purpose:** Single artifact submitted with the grant application that answers: *"does the thing actually work?"*
**Format:** Screen capture with voiceover. No talking head needed. 1080p minimum.
**Recording tool:** ScreenStudio / QuickTime / OBS — whatever is fastest.

## What the video must prove

1. This is running on real Mina/o1js, not a mock.
2. The full "paste → prove → share → verify" loop works in a browser.
3. Prove time is not vaporware — viewer sees the stopwatch.
4. Verification is <1 second.

## Shot list

### Shot 1 — 0:00–0:08 · The claim (voiceover over a still frame of the app)
**Visual:** app header "zk-proof-of-origin" on a clean localhost:5173 view.
**VO:** "Proving you made something used to require trusting a platform. We replaced the trust with a proof. This is running on Mina."

### Shot 2 — 0:08–0:20 · Paste content
**Visual:** cursor in the Content textarea. Type or paste a short sentence — something believable, like *"I'm Kevin, and I wrote this on April 17th 2026."*
**VO:** "The content is hashed locally with Poseidon. It never leaves the browser. The hash is what binds to the proof."

### Shot 3 — 0:20–0:40 · Generate proof
**Visual:** click Generate proof. Progress bar animates through: Compiling (first time only — if pre-warmed, this is fast) → Hashing → Signing → Generating ZK proof.
**VO:** "Compile once, then generate a Mina-native zero-knowledge proof in about five seconds. This is the wallet-only mode. Attestor-backed mode — which verifies a real GitHub or Twitter credential in-circuit — is the same flow."

### Shot 4 — 0:40–0:52 · Share link
**Visual:** proof generated. Show content hash, wallet address, prove time (call out the number: "4.57s"). Highlight the shareable link. Click Copy link.
**VO:** "The whole proof is in the URL hash. No server. No database. Send it however you send links."

### Shot 5 — 0:52–1:12 · Verify in a fresh tab
**Visual:** open a new browser tab, paste URL. Page auto-switches to the Verify tab, runs, shows "Proof is valid" with origin type and verify time. A second panel appears showing the on-chain anchor status — either "Anchored on-chain as latest commitment" with a MinaScan link, or "Not the latest anchor" depending on whether this proof is the most recent on the registry.
**VO:** "A verifier runs the same cryptography in their browser. Verification is under a second. The app also queries our deployed registry on Mina devnet — that's the second panel — so viewers can see whether this proof is anchored on-chain, with a live MinaScan link."

### Shot 6 — 1:12–1:30 · The primitive (optional if time-capped)
**Visual:** cut to a terminal running `npm test` in packages/circuits, showing the 11/11 passing tests including `proveHumanWithAttestor > produces a valid proof binding wallet, attestor, and content hash`.
**VO:** "The core primitive is an in-circuit ECDSA-secp256k1 attestor verifier written in o1js. Built from scratch, because the Mina Foundation-funded Reclaim integration doesn't include it. Tests, code, and a full audit are in the repo."

### Shot 7 — 1:30–1:35 · Outro
**Visual:** repo URL on screen. Grant targets named.
**VO:** "Open source, MIT. Grant application in progress with the Mina Builders and zkIgnite programs."

## Pre-recording checklist

- [ ] Pre-warm the browser so the "Compiling" stage completes in the 20–30s range (second run uses cached artifact). If it's faster than expected, adjust Shot 3 VO length.
- [ ] Clean localhost URL bar (no leftover proof fragments from earlier sessions).
- [ ] Dev tools closed.
- [ ] OS notifications silenced.
- [ ] Browser zoom at 110–125% so text reads at 1080p.
- [ ] Pick a content string that's public/safe to display on camera.
- [ ] Have the "verify" tab URL ready in clipboard in case pasting fails on camera — reshoot shot 5 without hesitation if it does.

## Why so short

zkIgnite and Builders Grants reviewers skim. A 60–90s video that demonstrably runs end-to-end beats a 10-minute explainer. The repo, the proposal, and the analysis docs carry the depth — the video's only job is to prove the thing runs.

## After recording

- Upload unlisted to YouTube (not public — Loom links rot faster).
- Drop the URL into [docs/grant-proposal.md](../docs/grant-proposal.md) §Links.
- Keep the raw file in `content/demo-raw/` (gitignored) in case you need to re-cut.

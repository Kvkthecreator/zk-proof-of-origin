# Session State — 2026-04-20

Snapshot at session close for future front-loading. Capture what's live, what's next, and the one-sentence mental model anyone (including future-Claude) should load before doing more work.

## One-sentence state

The Mina Builder Grants application for $25K covering M3–M6 was submitted on 2026-04-20; decision expected by 2026-05-20; all artifacts referenced in the submission are live and operational.

## What's live right now

| Artifact | URL / address |
|---|---|
| Repo | https://github.com/Kvkthecreator/zk-proof-of-origin |
| Live demo site (GitHub Pages) | https://kvkthecreator.github.io/zk-proof-of-origin/ |
| zkApp on Mina devnet | `B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU` ([explorer](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs)) |
| Deploy tx | `5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc` |
| Deployer pubkey | `B62qntwPTcYk99wtEXyAJMyP3R2BCtU67daiKx51XVxcC82Y81Nudrk` (299 MINA devnet) |

Test suite: 18/18 passing across 5 files. Production build clean. Live site verified rendering in Chrome on 2026-04-20.

## What shipped in this session

Chronological highlights across the work that went from "Phase 0 scaffold" to "live submitted application":

1. **Research + pivot.** Audited Reclaim's Mina integration, found ECDSA verification absent; chose to build our own in-circuit ECDSA-secp256k1 attestor verifier (D-005 → D-007). Seven analysis docs under [docs/analysis/](analysis/).
2. **Core circuit primitive.** `OriginProof` ZkProgram with three methods (wallet-only, attestor-with-Poseidon-commitment, Reclaim-compatible with in-circuit keccak → Ethereum address). Supporting modules: [ecdsa.ts](../packages/circuits/src/ecdsa.ts), [reclaimClaim.ts](../packages/circuits/src/reclaimClaim.ts) (pure-JS ecrecover, claim digest, prepare-witness helper).
3. **On-chain zkApp.** [ProofCommitmentRegistry.ts](../packages/circuits/src/ProofCommitmentRegistry.ts) — Mina SmartContract that verifies an OriginProof on-chain and anchors a Poseidon digest + monotonic counter. Deployed to devnet.
4. **Browser app.** Creator + Verifier tabs, two proof modes (wallet-only and paste-a-Reclaim-claim with committed demo fixture), shareable proof-in-URL-hash, on-chain anchor status indicator.
5. **Deploy pipeline.** GitHub Actions workflow auto-deploys on every push; uses `coi-serviceworker` to simulate COOP/COEP headers that GitHub Pages can't set natively; SWC plugin configured to preserve decorator metadata + use automatic JSX runtime (two separate bugs fixed mid-session).
6. **Grant submission.** Proposal restructured twice — first from split $11K+$34K ask to single $38K, then to final $25K (inside the Builder Grants $5K–$30K band). Q&A for all Typeform questions preserved in [builder-grants-application.md](builder-grants-application.md).

## Key decisions — load these before making architectural choices

See [DECISIONS.md](../DECISIONS.md) for full rationale. Short version:

- **D-001**: Branch A (human provenance) ships first, Branch B (AI/zkML) is Phase 2.
- **D-003**: Client-side proving only; optional proving service as a Phase 3 opt-in.
- **D-004**: o1js exclusively.
- **D-005 → D-007**: Build the in-circuit ECDSA attestor verifier ourselves rather than vendor Reclaim's broken upstream. This is "the primitive we contributed."

## What the grant funds (next 6.5 weeks if approved)

- **M3** Live Reclaim SDK integration ($10K, 2 wks)
- **M4** On-chain anchor submission via Auro wallet ($6K, 1.5 wks)
- **M5** Demo video + docs + community outreach ($3K, 1 wk)
- **M6** Upstream PR to `reclaimprotocol/mina-sdk-onchain-integration` ($6K, 2 wks)

Total: **$25,000 / ~6.5 weeks solo FTE**.

Out of scope (future separate applications): zkEmail integration, AI/zkML branch, mainnet + distribution.

## Open items blocked on user (not on Claude)

1. **Demo video recording.** Transcript + shot list ready in [content/](../content/). Not required by the Typeform but high-leverage as post-submission public-progress signal. Recommended during the 30-day review window.
2. **Public outreach.** Join Mina Discord, follow/post on X, reach out to any Mina Foundation warm intros.
3. **Milestone 6 headstart.** The upstream PR to Reclaim's Mina repo doesn't need the grant to start — opening a draft PR during the review window is the strongest "shipping regardless" signal.

## How to front-load context in a future session

Tell Claude to read, in order:
1. This file ([docs/session-state.md](session-state.md)) — two minutes, the whole picture.
2. [DECISIONS.md](../DECISIONS.md) — the "why" behind load-bearing choices.
3. [docs/grant-proposal.md](grant-proposal.md) — the current committed scope.
4. [docs/submission-checklist.md](submission-checklist.md) — what's done, what's pending.

The memory store at `.claude/projects/*/memory/` also has `MEMORY.md` pointing to user profile, feedback preferences, and working-style notes; load that alongside.

## What to do first in the next session

Ask the user three questions:

1. "Has Mina responded on the grant?" (If yes: update docs, start executing on the funded milestones.)
2. "Did you record the demo video?" (If yes: slot URL into proposal + outreach. If no and they still want to: use [content/demo-transcript.md](../content/demo-transcript.md).)
3. "Have you started any of the public-outreach items or M6?" (Drives whether we keep momentum on the review-window work or pivot to something else.)

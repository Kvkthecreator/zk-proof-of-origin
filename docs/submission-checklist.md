# Submission Checklist

Final-step checklist for sending the grant applications. Ordered so nothing blocks nothing.

## Pre-submission gates (do in order)

- [x] **Devnet faucet confirms payout** to deployer `B62qntwPTcYk99wtEXyAJMyP3R2BCtU67daiKx51XVxcC82Y81Nudrk` — 299 MINA received 2026-04-20.
- [x] **`ProofCommitmentRegistry` deployed to Mina devnet.**
  - zkApp: [`B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs)
  - Deploy tx: [`5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc`](https://minascan.io/devnet/tx/5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc)
- [x] **`grant-proposal.md` Links section** populated with live zkApp address.
- [ ] **Record demo video** per [`content/demo-script.md`](../content/demo-script.md). Target 60–90s. Upload unlisted to YouTube. Paste URL into proposal.
- [ ] **Final repo polish pass:**
  - [ ] Ensure `main` is green (`npm test` in `packages/circuits/`).
  - [ ] Ensure `packages/web && npm run build` succeeds.
  - [ ] Skim README, grant-proposal, DECISIONS for any remaining `TBD`.
  - [ ] Verify all `[label](path)` links resolve on GitHub.

## Application mechanics

### Mina Builders Grants Program

Entry point: https://minaprotocol.com/grants (subject to change — confirm URL at submission time).

- [ ] Read the current application form.
- [ ] Attach: repo URL, demo video URL, live devnet address, this grant-proposal.md (export to PDF if asked).
- [ ] Budget field: **$11,000** for Milestones 3–5.
- [ ] Continuation / follow-on field (if offered): note **$34,000** for Milestones 6–9.

### zkIgnite Cohort 3

Entry point: https://zkignite.minaprotocol.com (subject to change — confirm URL).

- [ ] Cohort 3 application window — verify still open at submission time.
- [ ] Cohort-specific template: use the same material, restructured to the cohort's requested sections.
- [ ] Budget tier: match to zkIgnite's funding brackets.

## After submission

- [ ] Post the submission publicly (X, LinkedIn, relevant Discord). Brief note + video.
- [ ] Reach out to Mina Foundation contacts directly if you have any warm intros.
- [ ] Keep working on Milestone 6 (upstream PR to Reclaim Mina repo) in parallel — lands as a concrete demonstrator of post-grant intent.

## If blocked

- Faucet won't pay out: generate a fresh deployer keypair, retry. The faucet has per-address limits, not per-IP.
- Deploy script fails: read [`packages/circuits/deploy/README.md`](../packages/circuits/deploy/README.md) troubleshooting section first.
- Demo video can't capture cleanly: use a committed GIF from `npm run dev` as a fallback; label it in the proposal as "animated demo" and plan a polished version post-submission.

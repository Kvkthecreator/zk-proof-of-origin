# Submission Checklist

Final-step checklist for sending the grant applications. Ordered so nothing blocks nothing.

## Pre-submission gates (do in order)

- [x] **Devnet faucet confirms payout** to deployer `B62qntwPTcYk99wtEXyAJMyP3R2BCtU67daiKx51XVxcC82Y81Nudrk` — 299 MINA received 2026-04-20.
- [x] **`ProofCommitmentRegistry` deployed to Mina devnet.**
  - zkApp: [`B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs)
  - Deploy tx: [`5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc`](https://minascan.io/devnet/tx/5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc)
- [x] **`grant-proposal.md` Links section** populated with live zkApp address.
- [x] **GitHub Pages live** at https://kvkthecreator.github.io/zk-proof-of-origin/ — auto-deploys on every push to `main` via [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml).
- [x] **Application submitted** via Typeform on 2026-04-20. Confirmation page: "Thanks for filling in the application! Our team will get back to you within 30 days." Decision window: by **2026-05-20**.
- [ ] **Record demo video** per [`content/demo-script.md`](../content/demo-script.md) + [`content/demo-transcript.md`](../content/demo-transcript.md). The Typeform did not require a video — this is now a *post-submission credibility signal* for Discord / X outreach rather than a submission requirement. Still high-leverage; recommended to record within the 30-day review window.

## Application mechanics

### Mina Builder Grants Program (primary target)

- Program page: https://minaprotocol.com/builder-grants-program
- Application form (Typeform): **https://5bi2nn1mxxj.typeform.com/to/rXo2gX1B**
- Funding band: $5K–$30K (Builder Grants tier). Exploration Grants ($1K–$5K) are for prototypes; we are past that. $100K+ Partnerships & Investments are bespoke, not applicable here.
- Basis: rolling applications, ~30-day decisions. No cohort window to race.
- Post-award expectations (per program page): share progress publicly via blog posts, demos, and community calls; funding is tied to development milestones and user adoption.

Pre-submission fill-in:

- [ ] Read the current Typeform end-to-end before typing any answer. Fields can change.
- [ ] Core links ready: repo URL (`https://github.com/Kvkthecreator/zk-proof-of-origin`), live demo (`https://kvkthecreator.github.io/zk-proof-of-origin/`), zkApp devnet address (`B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`), demo video URL (YouTube unlisted).
- [ ] Budget field: **$25,000** for Milestones 3–6 (Live Reclaim SDK, on-chain anchor UX via Auro, demo + community outreach, upstream PR to Reclaim).
- [ ] Milestone breakdown if asked: pull directly from [grant-proposal.md](grant-proposal.md) §Milestones.
- [ ] Follow-on disclosure if asked: zkEmail integration, zkML AI branch, mainnet + distribution are separate future Builder Grant applications to be submitted after M3–M6 delivers.

### zkIgnite Cohort 4

- **Status as of 2026-04-20:** not open. Cohort 3 closed; Cohort 4 referenced in community/news sources as "Q2 2026" but no active application URL exists.
- If Cohort 4 opens during our submission window, re-run the ask through their form with the same content, restructured into their sections. Until it opens, **Builder Grants is the sole target**.
- Notification signup (for awareness): [https://minaprotocol.com/join-zkignite-cohort-3](https://minaprotocol.com/join-zkignite-cohort-3) (old cohort page; useful as a weak signal for updates).

## After submission

**Current status:** submitted 2026-04-20. Decision expected by 2026-05-20.

During the 30-day review window, keep these moving:

- [ ] **Join Mina Discord** (confirmation page explicitly requested). Match handle to GitHub so reviewers can connect the dots.
- [ ] **Follow @MinaProtocol on X.** Post a short "just applied to Builders Grants — here's what we built" note with the live demo URL and zkApp address. Tag @MinaProtocol.
- [ ] **Record + share the demo video** (transcript + shot list already in [`content/`](../content/)). Unlisted YouTube → paste URL into both proposal Links and the public-outreach post.
- [ ] **Start Milestone 6 in parallel** — the upstream PR to `reclaimprotocol/mina-sdk-onchain-integration`. This is the single most visible "shipping regardless of funding" signal we can send during the review window. Recommended: open a draft PR early so reviewers can see it in motion.
- [ ] **Reach out to Mina Foundation contacts** directly if any warm intros exist.
- [ ] **Day-35 nudge:** if no reply, polite email to the Grants contact listed on the program page.

## If blocked

- Faucet won't pay out: generate a fresh deployer keypair, retry. The faucet has per-address limits, not per-IP.
- Deploy script fails: read [`packages/circuits/deploy/README.md`](../packages/circuits/deploy/README.md) troubleshooting section first.
- Demo video can't capture cleanly: use a committed GIF from `npm run dev` as a fallback; label it in the proposal as "animated demo" and plan a polished version post-submission.

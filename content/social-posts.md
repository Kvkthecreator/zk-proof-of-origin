# Social posts (X / LinkedIn / Discord)

Three formats sized for each surface. All link to the blog post (publish that first, slot the URL into `BLOG_URL` placeholders before posting).

## X — short thread (4 tweets)

**Tweet 1**
> Spent the last few weeks building zk-proof-of-origin: a creator-provenance zkApp on @MinaProtocol.
>
> Goal: cryptographically label content as human-made (or AI-generated) with no platform trust, no content leak, browser-only verification.
>
> Then we audited the funded Reclaim integration. 🧵

**Tweet 2**
> The Reclaim Mina SDK is real code by competent people. But the actual ECDSA verification — the part that proves an attestor signed a claim — wasn't implemented.
>
> The test suite runs with proofsEnabled=false. The circuit never compiles. The struct uses non-provable types.

**Tweet 3**
> So we built the missing primitive: an in-circuit ECDSA-secp256k1 verifier on Mina, with in-circuit keccak256(pubkey)[12:] derivation binding the attestor's Ethereum address to a public input.
>
> 18/18 tests passing. Live demo: https://kvkthecreator.github.io/zk-proof-of-origin/

**Tweet 4**
> Just opened a draft PR contributing it back to Reclaim's repo so the next builder doesn't have to do what we did:
>
> 🔧 PR: github.com/reclaimprotocol/mina-sdk-onchain-integration/pull/1
> 📝 Full write-up: BLOG_URL
> 💻 Repo: github.com/Kvkthecreator/zk-proof-of-origin

## X — single post (if you don't want to thread)

> Built an in-circuit ECDSA-secp256k1 attestor verifier for @MinaProtocol because Mina Foundation's funded Reclaim integration shipped without one.
>
> Live demo, 18/18 tests, draft PR back to Reclaim's repo. Full write-up:
>
> BLOG_URL
>
> Mina Builder Grants application in the pipeline. Decision expected by mid-May.

## LinkedIn — slightly more formal

> When I started building **zk-proof-of-origin** a few weeks ago — a creator-provenance zkApp on Mina Protocol — the plan was to consume one of three Mina-Foundation-funded zkOracle integrations and ship.
>
> Then we audited the leading one (Reclaim Protocol's Mina SDK) and discovered the in-circuit ECDSA signature verification — the actual cryptographic primitive every "verified human credential" application needs — wasn't implemented. The struct used non-provable string types, so the circuit never compiled in their own test suite.
>
> So we built it. ~30s circuit compile, ~13s prove time, sub-second verification, all in a standard browser. Built entirely on o1js standard library — no external crypto, no bridges.
>
> Then we contributed it back upstream so the next builder doesn't have to repeat the work:
>
> 📝 Full write-up: BLOG_URL
> 💻 Repo: https://github.com/Kvkthecreator/zk-proof-of-origin
> 🔧 Upstream PR: https://github.com/reclaimprotocol/mina-sdk-onchain-integration/pull/1
> 🌐 Live demo: https://kvkthecreator.github.io/zk-proof-of-origin/
>
> A Mina Builder Grant application is in the pipeline to fund the next round of work. The healthier ecosystems are the ones where downstream consumers find gaps and contribute fixes back — not where everyone waits for someone else to fix it.
>
> #ZeroKnowledge #MinaProtocol #zkApp #BuildInPublic

## Mina Discord — message in #builders or similar

> Hey all 👋 just opened a draft PR on Reclaim's Mina SDK repo contributing an in-circuit ECDSA-secp256k1 attestor verifier — the missing primitive that makes the integration actually verify signatures rather than just structurally pass them around.
>
> Built it for [zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin), a creator-provenance zkApp now [live on devnet](https://kvkthecreator.github.io/zk-proof-of-origin/). 20/21 tests passing on the upstream PR (the only skipped one is theirs, gated on proofsEnabled — exactly the gap we close).
>
> PR: https://github.com/reclaimprotocol/mina-sdk-onchain-integration/pull/1
> Write-up with the full story (audit → primitive → upstream): BLOG_URL
>
> Submitted a Builder Grant application earlier this week — in the meantime, happy to chat with anyone building on Reclaim/zkPass/ZKON or thinking about HTTPS-attested credentials on Mina.

## Posting order

1. Publish blog post (recommend Mirror or dev.to — both render markdown and have built-in distribution). Get the URL.
2. Replace `BLOG_URL` in this file. Commit.
3. Post X thread (highest leverage for Mina ecosystem reach — @MinaProtocol's audience is on X).
4. Discord (Mina's #builders or #showcase channel — adjust to whatever the actual channel structure is).
5. LinkedIn (lower priority but adds professional surface, useful if you're building investor/recruiter signal).

## What to expect

- Mina ecosystem is small and tight. A genuine technical write-up + draft PR will get noticed.
- Reclaim maintainers may engage directly on the PR. Engagement is good even if it's "we'd structure this differently" — that's iteration, which signals shipping velocity to grant reviewers.
- Don't expect viral. Expect ≥1 useful conversation per platform. That's the win.

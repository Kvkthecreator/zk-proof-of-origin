# Demo Video Transcript

**Target length:** 75 seconds (comfortable pace; re-time if your delivery runs long or short).
**Tone:** calm, declarative, no filler. Nothing about "today I'll show you" — start inside the product.
**Pairs with:** [demo-script.md](demo-script.md) shot list.

## Transcript

> *(0:00–0:08, over a still frame of the app header)*
>
> Proving you made something used to require trusting a platform. We replaced the trust with a proof. This runs on Mina Protocol.

> *(0:08–0:20, while pasting content into the textarea)*
>
> The content is hashed locally with Poseidon. It never leaves the browser. The hash is what binds to the proof.

> *(0:20–0:40, while the progress bar runs and the proof generates)*
>
> This compiles the circuit once, then generates a Mina-native zero-knowledge proof in about five seconds. That's the wallet-only mode. The attestor-backed mode — which verifies a real GitHub or Twitter credential in-circuit — uses the same flow with an extra witness.

> *(0:40–0:52, while showing the proof result + copying the share link)*
>
> The entire proof is in the URL hash. No server. No database. Send the link however you send links.

> *(0:52–1:12, opening the link in a fresh tab; verifier tab loads, runs, and shows both the local-verify result and the on-chain anchor panel)*
>
> The verifier runs the same cryptography in their browser. Verification is under a second. The app also queries our deployed zkApp on Mina devnet — that's the second panel — so viewers see the on-chain anchor status with a live MinaScan link.

> *(1:12–1:25, cut to the terminal running `npm test`, showing 18/18 tests passing)*
>
> The core primitive is an in-circuit ECDSA-secp256k1 attestor verifier, written in o1js. We built it because Mina Foundation's own funded Reclaim integration didn't have one. Full audit, tests, and source are in the repo.

> *(1:25–1:30, outro card with repo URL and live zkApp address)*
>
> Open source, MIT. Grant applications in progress with Mina Builders and zkIgnite.

## Delivery notes

- **The "five seconds" line** should land exactly when the progress bar is about to fill. Re-time your paste if the circuit compile is cold (first run in a browser session is slower — record after a warm-up run).
- **Never apologize** for prove time. "About five seconds" is fast for a browser-side zk-SNARK. Most viewers don't know that.
- **Stress "in-circuit"** in the closing shot. That one word distinguishes this work from the scaffold it replaces.
- **Don't mention the dollar amount** or the grant programs by name in a way that dates the video. "Grant applications in progress with Mina Builders and zkIgnite" is fine indefinitely; "$38,000 ask for Cohort 3" isn't.

## If a shot fails

- **Circuit takes too long to compile** on camera: record a separate take where the circuit is pre-warmed in the background tab, then paste the tab over. The viewer doesn't need to know.
- **Anchor panel shows "Not the latest anchor"**: don't edit it out — that's the honest state of the registry. The voiceover just says "shows the on-chain anchor status," which works either way.
- **Share-link verify fails**: start over. A broken demo in the video is worse than a late video.

## Hard-code the final card

End the video on a static 5-second card with:

```
zk-proof-of-origin
github.com/Kvkthecreator/zk-proof-of-origin
zkApp: B62qpPxW…nbHgNoVU (Mina devnet)
```

No music overlay. Grant reviewers skim at 1.5× speed; a readable end card beats a fade-out.

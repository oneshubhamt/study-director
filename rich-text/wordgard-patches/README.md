# Study Director Wordgard compatibility patches

`vendor/wordgard/src` is kept as the exact reviewed upstream Wordgard 0.5.2 source snapshot.
Study Director-specific compatibility behavior lives here or in the build patch layer:

- `inert-html.ts` — one cached `sd-inert-html` Trusted Types policy, preserving upstream detached-document behavior.
- `history-core.ts` — the upstream history algorithm without Wordgard's generic menu UI.
- `build/wordgard-source-patches.mjs` — fingerprinted build-only rewrites for clipboard/state Trusted Types routing and the esbuild-compatible `Node.slice()` spelling.

Future Wordgard upgrades should replace the upstream source first, then explicitly rebase only these seams.

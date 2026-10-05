# Study Director Wordgard compatibility layer

`vendor/wordgard/src` is the exact upstream Wordgard source. Study Director never edits it.
Everything Study Director changes lives in two places:

- Runtime behaviour, here, reached only through `rich-text/wordgard-adapter.ts`:
  - `inert-html.ts`: one cached `sd-inert-html` Trusted Types policy for parsing HTML in a detached document.
  - `cut.ts`: copy and cut first bring the editor up to date with the DOM, and a cut the browser performs itself (`beforeinput` `deleteByCut`) deletes the selection as one transaction. These are ordinary Wordgard event-handler extensions.
- Build-only rewrites, in `build/wordgard-source-patches.mjs`, where Wordgard offers no extension point:
  - `state/state.ts` and `editor/clipboard.ts`: HTML parsing goes through `inert-html.ts` instead of creating a Trusted Types policy on every paste.
  - `doc/node.ts`: an esbuild-compatible spelling of `Node.slice()`.
  - `history/history.ts`: upstream history without its undo/redo menu buttons, which would pull in Wordgard's menu and phrase tables.

Each rewrite names the upstream text it replaces. To use a new Wordgard version, replace `vendor/wordgard` and build: a rewrite whose text moved fails with its name, and nothing else needs attention. Then record the new snapshot in `build/wordgard-metadata.mjs`, which `tests/architecture/rich-text/wordgard-upstream-integrity.mjs` checks.

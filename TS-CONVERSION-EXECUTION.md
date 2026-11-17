# TypeScript conversion — execution record

## Current handoff — P5.10B CLOSED — TARGETED VERIFIED, 2026-11-17

- **Baseline and checkpoint:** P5.10B started from `bc3b3d577f90c202322c06965aabc996e2fa3f51`; targeted-verified source/test checkpoint is `27449a517a47aa88270ded7318d875465aef68ee`. P5.10A remains intact.
- **Renderer ownership:** the actual M8.9 dashboard implementation moved from `source/external/insights.js` into checked `source/external/insights-rendering.ts`—DOM construction, SVG/charts, cards, disclosures, tables/tooltips and interaction callbacks. `insights.js` now has one thin renderer construction call; no M8.9 renderer definition remains duplicated there.
- **Type topology:** the renderer uses native DOM/SVG/event types plus exact P5.9 model-derived rows/evidence unions, including explicit unavailable/insufficient states. It has no explicit `any`, TS suppression or declaration facade. Browser and worker projects remain separate.
- **Runtime ordering:** the one generated Insights asset is ordered model → protocol → worker → compute bridge → renderer → retained view. Renderer construction occurs only after the worker-only exit, so the same generated URL still terminates before DOM construction in worker context.
- **Behavior preserved:** existing copy/order, zero-versus-unavailable semantics, bounded chart sampling, responsive geometry, reduced-motion behavior, native labels/disclosures and retained-view callers remain unchanged. M8.10 Analytics Lab and M8.12 retained-view/lifecycle are still owned by P5.10C.
- **Focused browser coverage strengthened:** the populated Insights journey now proves empty Saved Days, one-day insufficient evidence and 590-day populated evidence in sequence; native execution tabs are exercised with real keyboard ArrowLeft/ArrowRight input; the unrelated first-start onboarding dialog is deterministically dismissed in the fixture so it cannot steal focus. Existing 390 px narrow-layout, no-overflow, chart-width and retained reopen checks remain.
- **Targeted QA:** workflow run `44093742266` / job `134075328070` at `27449a5` passed strict TypeScript + typed lint (227 checked TS files, zero unchecked TS), P5.9 model/transport guards, `insights-render-lifecycle`, fresh build, generated build verification, generated syntax, Chromium and the strengthened browser journey. Browser evidence reported `empty=true`, `insufficientDays=1`, `populatedDays=590`, zero desktop/390 px overflow, actual `worker` mode and all 590 records transferred.
- **Closure audit:** manifest/build order matches the required six-source Insights runtime; worker exit precedes renderer construction; each audited M8.9 renderer owner exists once in `insights-rendering.ts` and zero times in `insights.js`; no renderer `any` or suppression remains.
- **Open by canonical ownership:** P5.10C retained-view/Lab conversion, P5.11a Guide producer conversion and P5.13 shared plugin-loader mechanics remain open. Full QA was **not** run and remains Phase 7.
- **Disposition:** no known P5.10B source or targeted-evidence gap remains.

## Last verified application checkpoint

`28c8c1d` is published on both `ts-exp` and `TS-Conversion`; P5.5–P5.7 are **CLOSED — AUDITED — TARGETED**. Production corrections at `6005b1c` and `e4b7aa6` protect lifecycle/Diary successors and attachment rollback/cleanup. Strict types/lint/build and targeted module/browser checks passed; full QA and hosted/device certification were not claimed. The [complete audit record](https://github.com/oneshubhamt/study-director/blob/28c8c1d/TS-CONVERSION-EXECUTION.md) owns exact selections, endpoints, five-run notes evidence, limitations and earlier history. Preparation/Phases 1–4 and P5.0–P5.4 retain their recorded completion, including prior audit corrections.

## Programme obligations

- F-001: each feature owns its host callbacks/callers; P5.13 receives thin composition only.
- F-002: adapt affected source/VM readers during conversion; Phase 6 owns remaining test/tooling conversion and transitional-reader retirement.
- F-003: distinguish targeted/local evidence from whole-app, hosted and device certification. Full QA remains Phase 7.
- REVIEW-P5: independent final audit after P5.13 against `de4872a`, including semantic changes and unresolved limits. Owner-requested interim audits do not replace it.
- Keep one current canonical topology with validation/recovery intact; no historical compatibility layers. Vendored Wordgard remains unchanged.

## Recovery and provenance

Earlier uncommitted work was lost in the 2026-11-12 workspace reset and reconstructed with fresh evidence. The 2026-11-16 resume preserved source edits but lost temporary logs; only previously observed results were retained, and interrupted checks were rerun. Continue committing/pushing coherent checkpoints rather than depending on an ephemeral workspace.

[Preparation/Phase 4](docs/typescript/HISTORY-PREPARATION-PHASE-4.md), [main-intake preservation](docs/typescript/snapshots/main-intake-2026-11-08/README.md) and the pinned audit history retain prior observations without duplicating them in active context.

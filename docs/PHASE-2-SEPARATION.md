# Phase 2 — Separation

Base: merged Phase 1, `0c849518e5b5bd9f24ddefba3ab875593ff184d9`.
Branch: `codex/phase-2-separation`. Release: `phase2-2026-09-15-4`.

## Scope

Separate the effective legacy runtime without changing pedagogy, curriculum, scoring, content, or visible design. Phase 1 remains the compatibility contract. This phase does not implement Master Client/Visit Cards, M01 V2, score evidence, new facts/topics/readiness, client memory, terminology mapping, replay variability, or Training/Evaluation semantics.

## Architecture before and after

Phase 1 placed schema validation, storage, conversation execution, scoring, navigation, rendering, catalog access, sharing, and update integration in `app.js`. Renderers saved state and changed navigation; inline DOM handlers invoked global functions. Scenario-specific outcomes already lived in a temporary legacy adapter.

Phase 2 uses explicit dependency-injected factories. `app.js` only composes dependencies and starts the controller. Runtime factories register on `globalThis.Academy`; this namespace contains constructors, not a live mutable session. Classic script tags retain deterministic loading without frameworks, bundlers, or added dependencies.

The command flow is:

```text
DOM event -> controller -> session command -> state/conversation/persistence
                                        -> detached query snapshot -> renderer
```

There is one live session. The engine owns pedagogical state, navigation, completion, revisions, and saving. The renderer receives a query-only capability object. Its nested session snapshots are detached and frozen. Presentation timers can enable controls but cannot authorize early or stale actions; the engine validates those independently.

## File ownership

| File | Responsibility |
| --- | --- |
| `app.js` | Release identity, legacy reset guard, composition and startup; read-only application snapshot/summary facade |
| `content/legacy-m01.js` | Project existing mixed legacy records into identity, case/visit, and visual inputs |
| `content/clients.js` | Existing identity lookup: ID, name, age |
| `content/visits.js` | Ordered legacy case content and existing scenario configuration |
| `content/modules.js` | Existing curriculum/module configuration |
| `content/catalog.js` | Existing brands, products and sources; detached lookups |
| `visuals/client-visuals.js` | Existing pilot client images, fallback paths, and Boss images |
| `engine/state.js` | Schema-1 defaults, validation/migration and owning state holder |
| `engine/persistence.js` | Injected key/value storage, backup-before-repair, saves and conflict detection |
| `engine/legacy-conversation.js` | Characterized fixed-tree transitions, action guards and consequence creation/commit |
| `engine/legacy-scoring.js` | Unchanged score calculation, aggregation, ranks and Boss bonus |
| `engine/session.js` | Command/query boundary, initialization, navigation, progress, completion, recovery and reset coordination |
| `ui/controller.js` | Single delegated event binding, confirmations, command dispatch and rendering coordination |
| `ui/render.js` | Existing DOM content and screen presentation; no session mutation or saving |
| `ui/browser-effects.js` | Splash lifecycle, vibration, scrolling and presentation timers |
| `platform/result-sharing.js` | Read-only result text, native share, clipboard and selectable-text fallback |
| `platform/updates.js` | Worker registration, waiting status, explicit activation and save-before-update |
| `index.html` | Existing visible shell; action metadata replaces executable inline handlers |
| `service-worker.js` | Existing snapshot policy with the complete extracted script set and new release identity |
| `tests/helpers/runtime.cjs` | Browser-like VM harness; test-only compatibility access for original Phase 1 assertions |
| `tests/helpers/headless.cjs` | Engine execution in a separate VM realm without browser globals |
| `tests/separation.test.cjs` | Ownership, purity, isolation, content projection and schema-1 contracts |
| Existing regression/browser tests | Retained Phase 1 assertions plus complete-script installation, actual Phase 1 upgrade and rollback coverage |
| `package.json`, `.github/workflows/test.yml` | Dependency-free suite includes separation tests |

## Compatibility boundaries

### Extraction history

- `861c94a` — introduce content boundaries and isolate legacy scoring.
- `93c60c5` — extract schema-one state and persistence.
- `fa59523` — separate the headless session from browser presentation.
- `52c47d9` — finalize the release, preserve stale-click focus and read-only result formatting, and verify upgrades/Phase 1 rollback.
- The final documentation commit completes this report and updates the README ownership map.

Sixteen runtime files were created by extracting responsibilities from `app.js`; the original data files were neither moved nor rewritten. Two new test files cover the headless harness and separation contracts. The shell, worker, existing test harness/suites, package command and CI workflow were updated for the new boundaries. No package dependencies were added.

### Content

All existing `data/` files remain unchanged, including `data/scenarios/m01.js` and `data/scenarios/m01-legacy-adapter.js`. The bridge derives separate read interfaces from this single authored legacy source. It does not create independently authored copies or pretend that the legacy cases are Master Visit Cards.

The engine receives no client image or Boss image metadata. Identity and case order are preserved. Case indices remain the persisted identifiers; no V2 IDs or new visit schema are introduced. The existing adapter is passed explicitly to conversation execution. Its zero-question/outcome rules remain scenario-specific.

The content projection test reconstructs the original effective scenario and compares every field, including reaction overrides, answers, visual mappings and Boss Check. The original content hashes and all 396 characterized outcome combinations remain unchanged.

### State and storage

Key: `pitbull-academy-quality-pass-01`. Schema version: **1**. Phase 2 adds no storage migration.

- `MP`-equivalent reads never initialize or normalize progress. Initialization occurs only at load or explicit module selection.
- Normalization retains the exact Phase 1 validation and repair behavior.
- Existing `-before-phase1`, `-recovery`, and timestamped explicit recovery backups retain their meaning.
- Malformed/future records are never silently overwritten; backup/write failures and observed tab conflicts retain their prior recovery behavior.
- Unknown module records, alias, catalog selection and backups survive module reset.
- Pending consequence timestamps, revisions, first Boss response, review selection and saved navigation remain compatible.
- Rendering and query calls produce no storage writes or progress/revision changes.
- Local storage remains non-transactional: compare-before-write detects observed conflicts but cannot guarantee atomic compare-and-swap between simultaneous processes.

`reset-progress.js` remains unchanged, absent from current shell execution and non-destructive for older cached pages. The compatibility guard remains present.

### Test compatibility

The original 40 regression tests are retained. Characterization hashes, score expectations, state assertions, and recovery assertions were not weakened. The required release label changed. Browser selectors now use action metadata and the read-only facade instead of removed inline handlers/global functions.

The VM harness instruments factory source only in tests to preserve the original fixtures' direct `S`/`MP` expressions. These writable references and compatibility functions are not present in production code. Additional tests exercise the actual public command/query interface in a realm with no `window`, `document`, `navigator`, `localStorage`, timers or service-worker API.

## PWA release behavior

`app.js`, `index.html` and `service-worker.js` agree on `phase2-2026-09-15-4`. Every loaded script belongs to the required worker snapshot. Tests exercise each extracted script being absent and require installation to fail without publishing a partial snapshot.

The Phase 1 policy is unchanged: drain and validate required responses, publish a complete snapshot, wait for activation, save before requesting activation, reload only through the existing update flow, serve HTML only for navigation fallback, and remove only Academy-prefixed caches. No progress reset accompanies an update.

## Verification commands

```sh
node --test tests/stabilization.test.cjs tests/service-worker.test.cjs tests/separation.test.cjs
node --test tests/browser.test.cjs
git diff --check
```

`npm test` and `npm run test:browser` are equivalent. Node 20+ is required; CI uses Node 22. Browser checks use an existing Playwright installation and Chromium-family executable, configured with `ACADEMY_PLAYWRIGHT_PATH` and `ACADEMY_BROWSER_EXECUTABLE`. No browser package is added. Historical upgrade/rollback tests require Git objects for `0835cb4` and `0c84951`; obtain those commits if using a shallow checkout.

Missing browser runtimes are reported as skipped checks, never as passed browser coverage. The dependency-free suite needs no historical Git objects.

## Verification record

Final local rerun: **2026-09-16**.

- Baseline: all 40 Phase 1 regression tests and all five original browser scenarios passed before extraction.
- Content/scoring boundary: all 40 regression tests and five browser scenarios passed.
- State/persistence boundary: all 40 regression tests passed; subsequent combined browser verification also passed.
- Headless engine/presentation boundary: all 40 original regression tests and five browser scenarios passed; the new ownership tests also passed.
- Final dependency-free suite: **49 passed, 0 failed, 0 skipped**. This includes all 40 Phase 1 contracts, eight separation tests and the complete executable-snapshot test.
- Final browser suite: **8 passed, 0 failed, 0 skipped**, headless Chrome on Windows with the existing Playwright runtime. Desktop viewport 1280 × 900; mobile viewport 390 × 844.
- Desktop and mobile both completed the six cases, Boss Check, final result, reload, review and reset. The characterized route remained 81 / 100 / 89 / 100, total 93, ASESOR.
- The audited pre-stabilization worker upgraded successfully; the separated release also updated to a simulated subsequent release through explicit activation.
- Actual merged Phase 1 upgraded to the separated release with both a live conversation and a pending consequence. Each retained the exact saved record, survived offline reload and continued correctly. Unrelated caches survived.
- A corrective release using actual Phase 1 code read the separated runtime's saved record unchanged and accepted the next intervention.
- The intentionally missing-script request returned the expected plain-text 503, not HTML. Browser scenarios recorded no uncaught application errors.
- Mobile result screenshots from Phase 1 and the separated runtime were visually inspected. CSS, assets, copy and layout markup remain unchanged apart from event wiring.
- `data/`, `assets/`, both stylesheets, `reset-progress.js`, the manifest and every normative specification have no diff from `0c84951`.
- The final rerun requested on 2026-09-16 passed all 49 dependency-free tests and all eight browser tests again, without fixes. `git diff --check` passed. These are local results; remote CI is reported separately after pushing.

## Rollback

Revert the smallest faulty extraction where practical. A deployed rollback must use a new corrective release identity in all three release locations and a complete matching snapshot. Do not reuse an installed cache identity.

Phase 1 can read schema-1 progress written by this runtime. The rollback browser scenario serves the actual merged Phase 1 code with a distinct corrective release identity; it checks exact progress continuity and the next intervention.

Never restore an older backup over newer progress automatically. Retain backups and preserve the newer raw record during any explicit recovery. Never redeploy the pre-stabilization reset behavior.

## Limits and deferred work

- The authored legacy dataset still mixes identities and cases. The bridge isolates this debt; changing the authored model belongs to a separately approved phase.
- Fixed trees, exhausted ASK_MORE, text-based repeat prevention, old score labels, and the pilot identity mapping are deliberately preserved.
- Classic scripts and the factory registration namespace remain; there is no build pipeline or module bundler.
- Browser verification uses desktop Chrome at desktop/mobile viewports, not physical phones, Safari/iOS or a production deployment.
- This branch is for review and is not merged to main. No Phase 3 or pedagogical work was started.

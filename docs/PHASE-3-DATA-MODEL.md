# Phase 3 — Pedagogical Data Model

Base: merged Phase 2, `8420cf3d24ffbb5413b95ff396c597bd8a76389a`.
Branch: `codex/phase-3-data-model`.
Production release remains **`phase2-2026-09-15-4`**.

## Scope and approval boundaries

This phase adds a dependency-free, headless authoring/domain library for permanent clients and temporary visits. It validates cards, typed facts, topics, participants, action prerequisites and inactive memory records. Pure helpers initialize/validate seller knowledge, project disclosed information, and check explicitly authored decision prerequisites.

The library is **not loaded by the application or service worker**. No legacy content is converted. No production session, persistence, UI, scoring, conversation handler or release identity changes. Fixtures use `TEST-*` identities and are synthetic validation material, not approved curriculum or canonical client biographies.

The approved scope is narrower than the future capabilities described in migration specification section “Fase 3.” M01 V2, new scoring/ledger, active memory, terminology expansion, replay variability, Training/Evaluation behavior and Phase 4 work remain deferred.

Two explicit approval corrections are contracts:

1. Memory confidence is descriptive text or `null`. Numbers, including `0`, `0.5` and `1`, are rejected. There is no scale, threshold or behavior.
2. `CRITICAL`, descriptive importance, and action evidence level are independent. Only an authored requirement with `evidence: CONFIRMED` requires explicit confirmation. No fact type automatically selects that level.

## Architecture before and after

The Phase 2 path remains unchanged:

```text
legacy data -> content repositories -> legacy session/state/scoring/persistence
                                   -> read-only snapshots -> existing UI
```

The additive path is separate:

```text
synthetic/authored JSON -> strict card/bundle validators -> immutable authoring repository
                                     validated visit + explicit knowledge record
                                         |                         |
                                  seller projection       prerequisite diagnostics
```

There is no arrow from this library into the production path. CommonJS exports provide an explicit loading boundary for Node and the isolated test loader; they do not register globals or patch `Academy`. No package, framework, bundler or build step is added. Future browser integration requires separate approval and an explicit loading/release design.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `domain/contracts.js` | Contract version, enumerations, descriptive field inventory and shared type documentation |
| `domain/validation.js` | Strict JSON/shape/value checks, structured errors, immutable detached snapshots; no coercion or repair |
| `domain/client-card.js` | Permanent Master Client Card structure |
| `domain/visit-card.js` | Temporary Master Visit Card, typed facts, topics, participants, intervention metadata and authored prerequisites |
| `domain/memory-record.js` | Inactive typed memory record and provenance structure |
| `domain/repository.js` | Bundle references and immutable authoring queries; derived client-to-visit and memory links |
| `engine/visit-knowledge.js` | Pure initialization, explicit knowledge-record validation and seller disclosure projection |
| `engine/decision-sufficiency.js` | Pure action-specific information prerequisite check |
| `tests/helpers/domain.cjs` | Restricted CommonJS loader in a realm without browser or platform APIs |
| `tests/fixtures/domain/valid-bundle.json` | One synthetic client, two independent visits and one inactive third-party memory record |
| `tests/domain-model.test.cjs` | Shape, reference, value, immutability and correction contracts |
| `tests/decision-sufficiency.test.cjs` | Knowledge, disclosure, evidence and prerequisite contracts |
| `tests/domain-compatibility.test.cjs` | Protected Phase 2 fingerprint, production exclusion and coexistence tests |
| `package.json`, `.github/workflows/test.yml` | Dependency-free test commands and CI coverage |
| `README.md`, this report | Scope, usage, ownership, verification and rollback |

Eight library files and five fixture/test files are new. No existing file is moved. The existing engine files, content repositories and browser test harness are untouched. Renderers never receive mutable domain state or an authoring repository.

## Shared contract rules

- All authored names use `snake_case`; IDs are non-empty stable identifiers, independent of legacy case indices.
- `contract_version: 1` versions these contracts, independently of saved progress `schemaVersion: 1`.
- Cards, memory records and transient knowledge have an explicit positive `content_revision`. Knowledge binds to the exact visit ID and revision.
- Every documented property is required. Unknown values use `null` only where the contract permits it; missing fields, unsupported versions, unknown properties and invalid enum values fail validation.
- Descriptive fields have no invented scales, weights, thresholds or implied rules. Numeric types are reserved for structural numbers or explicitly typed fact values.
- Inputs must be ordinary, finite, acyclic JSON data. Functions, accessors, class instances, sparse/extended arrays and non-finite numbers are rejected. No expression strings are evaluated.
- Validators return `{valid, errors, value}`. Errors contain `path`, `code` and `message`; invalid results have `value: null`. Valid values are detached and recursively frozen. Nothing is silently repaired, normalized or persisted.
- Repository construction and engine queries throw `DomainValidationError` with `.issues` for invalid input. Successful query results are detached/frozen.

Structural validity does not approve editorial quality, medical/product claims, pedagogy, biographies or visual assets.

## Master Client Card mapping

The contract maps the sections of `02_MASTER_CLIENT_CARD.md` as follows:

| Normative section | Contract location |
| --- | --- |
| Identification | Root `client_id`; `identification` contains name, base age, occupation, active status, recurrence and visual version |
| Human Identity | `human_identity`; occupation is stored once in `identification` |
| Sports Context | `sports_context`; habitual/stable descriptions only |
| Commercial & Linguistic Profile | `commercial_profile`; descriptive knowledge, vocabulary, sensitivities and conversation fields |
| Internal Visual Identity | `internal_visual_identity`; all specified morphology/appearance fields are nullable descriptions |
| Recognition Matrix | `recognition_matrix` with the three stable anchors |
| Relationship with Store | `relationship_with_store`, including nullable initial level, buying patterns and third-party types |
| Commercial Memory | Separate `memory_records`; repository derives `memory_record_ids` for the client |
| Purchase Recipient Capability | `purchase_recipient_capability.possible_recipients`; possible patterns never determine a visit's recipient |
| Visual Representations | `visual_representations` with face/body/canon references and visit-specific references |
| Visits | Repository derives `visit_ids` from visit ownership; there is no second authored list to drift |

All descriptive fields from sections 01–06 are explicitly listed in `contracts.js`. The card contains no current goal, request, conversation tree, decision answer or temporary visit logic. Visual metadata cannot act as a fact reference or automatically supply evidence. References to visuals are metadata only; this phase neither loads nor creates assets.

Relationship levels are `N0` unknown, `N1` familiar face, `N2` known client and `N3` habitual client. Missing information is `null`, distinct from `N0`. No level creates knowledge, imports memory, increases rapport or changes readiness.

## Master Visit Card and typed facts

A visit contains identity (`visit_id`, `client_id`, `module_id`, visit number, chronology index), descriptive difficulty, nullable relationship level, and the normative entry fields. `mode` is reserved as **`null` only** in this contract; it executes no mode behavior.

`participants` declares visit-local people. An `ActorRef` is `{kind: CLIENT | PARTICIPANT, id}`. Client references resolve in the bundle; participant references resolve within the visit. `purchase_context` contains:

```text
buyer_ref: the permanent client who owns this visit
end_user_refs: zero or more separately identified users
recipient: SELF | THIRD_PARTY | UNKNOWN | MIXED
```

`SELF` means only the buyer is an end user; `THIRD_PARTY` excludes the buyer; `MIXED` includes the buyer and others; `UNKNOWN` has no resolved end users. Patterns on the client card do not resolve these fields. The engine may know authored purchase truth while the seller projection does not.

Every fact includes the normative ID, type, importance, initial visibility, discovery routes, decision requirements and inactive memory metadata, plus:

- `subject_ref`: the person the fact describes, distinct from the buyer;
- `value_type`: `TEXT`, `NUMBER`, `BOOLEAN`, `ENUM`, `TEXT_LIST`, `ACTOR_REF`, `ACTOR_REFS` or `PURCHASE_CONTEXT`;
- `value`: the typed value, or `null` for unknown;
- `enum_values`: explicit allowed values for `ENUM`, otherwise `null`;
- `value_ref`: `PURCHASE_CONTEXT` for the single visit purchase record, otherwise `null`.

Purchase-context facts use `value: null` plus that restricted reference; they cannot duplicate the purchase record. There are no arbitrary object/visual property references.

The pedagogical `type` is independently `STABLE`, `TEMPORARY`, `CRITICAL` or `CONTEXTUAL`. `importance` is nullable descriptive text. Neither selects confirmation, calculates scores or infers recommendations.

`topics` contains visit-local IDs and labels. Each intervention declares its ID/text, topics, relevance, timing notes, discovery value, relationship effect, assumption risk, revealed facts, opened/closed topics and response. These are validated metadata; no interpreter executes timing, response, rapport or consequence behavior. Reciprocal `discoverable_by`/`reveals` references must agree, and multiple routes to the same fact are supported. Required facts must be initially known or discoverable. No fixed start/deep/last tree or answer field is introduced.

`consequence_notes`, `memory_notes` and `memory_after_visit` hold inactive authoring metadata. No consequence or memory is generated.

## Knowledge and seller disclosure

`initializeKnowledge(visit)` returns only initially known fact IDs, empty evidence/used-intervention/topic lists, the authored relationship level, and nullable descriptive rapport. It accepts no memory source, client biography, catalog or visual input.

`validateKnowledge(visit, record)` checks:

- exact visit ID and content revision;
- unique known fact IDs equal to initial facts plus explicit discovery records;
- discovery/confirmation evidence `{fact_id, intervention_id}` references a declared route and an explicitly used intervention;
- confirmed facts are already known;
- used interventions and open topics resolve locally.

Evidence records are explicit inputs supplied by a future trusted engine or test. This phase validates their structure and references; it does not authenticate a conversation history or execute interventions. Merely listing a used question, opening a topic, or being at level N3 does not disclose a fact. Discovery never automatically adds confirmation. A future executor must explicitly record confirmation when warranted.

`projectSellerKnowledge(visit, knowledge)` returns a whitelist: visit identity/revision, seller-facing entry text, relationship level, open-topic labels and known fact values with subjects and confirmation flags. It excludes undiscovered facts, the full participant roster, future responses, action requirements, scores, memory and client visual/biographical fields. Authored entry text and initial facts still require editorial review to avoid prose leaks.

The authoring repository deliberately exposes full truth. It is not a seller-view API. Its methods are `client`, `visit`, `visitsForClient`, `memoryRecord` and `snapshot`; absent singular records return `null`. `client` returns `{card, visit_ids, memory_record_ids}` with derived links.

## Actions and decision sufficiency

The six action IDs are `ASK_MORE`, `CLARIFY_REQUEST`, `RECOMMEND_CATEGORY`, `RECOMMEND_PRODUCT`, `DEFER_SUPPLEMENT` and `REFER_PROFESSIONAL`. The first two are conversational. No action or query completes a visit. Legacy `LOST` stays a legacy outcome, not a new generic action.

Recommendation targets are nullable category/product references. The bundle declares external module/category/product IDs solely to validate references; it creates no new catalog or terminology mapping.

Each fact is the single authority for action requirements:

```json
"required_for_decision": [
  {"action_id": "RECOMMEND_CATEGORY", "evidence": "DISCOVERED"},
  {"action_id": "RECOMMEND_PRODUCT", "evidence": "CONFIRMED"}
]
```

Each action declares `FACT_REQUIREMENTS`, `NO_FACT_REQUIREMENTS` or `UNSPECIFIED`. The validator rejects contradictory policy/requirement combinations. Empty requirements cannot silently imply sufficiency: that meaning must be explicit in `NO_FACT_REQUIREMENTS`. Conversational actions use `UNSPECIFIED` and return `NOT_APPLICABLE`.

`evaluateDecisionSufficiency(visit, knowledge, actionId)` returns `action_id`, `status`, `required_facts` and `missing_facts`:

- Status: `SUFFICIENT`, `INSUFFICIENT`, `UNSPECIFIED`, or conversational `NOT_APPLICABLE`.
- Missing reasons: `UNDISCOVERED`, `UNKNOWN_VALUE`, `UNCONFIRMED`.
- An initially known or explicitly discovered fact meets `DISCOVERED` when its value is known.
- `CONFIRMED` additionally needs an explicit confirmation record, regardless of fact type or importance.
- A required unknown value, including required purchase recipient `UNKNOWN`, remains insufficient even if a confirmation entry exists. `0` and `false` are valid known values.
- Unknown recipient is not an invented universal block on every action: only authored requirements are examined.

Diagnostics expose authored prerequisite IDs and belong to the engine/authoring boundary, not directly to an evaluation UI. `SUFFICIENT` means only that declared information prerequisites are met. It does not mean a decision is correct, safe, scored or pedagogically approved. No universal prerequisite list or new score model is supplied.

## Memory structure only

A record includes contract/content versions, record/client IDs, actual `subject_ref`, `memory_type`, typed `memory_value`, `confidence`, `status` and `source`.

- Types: `identity`, `name`, `stable`, `sports`, `historical`, `relational`.
- Status: `STABLE`, `TEMPORARY`, `TO_CONFIRM`.
- Confidence: descriptive text or `null`; behavior-free.
- Provenance: visit ID, fact ID, exact source content revision, nullable source intervention ID and nullable descriptive recording timestamp. No timestamp parsing or expiry policy exists.

Bundle validation keeps the client association with the source visit and the actual subject with the source fact. A child's fact cannot become the buyer's attribute by changing the subject reference. Participant IDs are scoped by the source visit. Optional source interventions must be discovery routes for that fact. Values themselves remain authored content requiring review; reference validation is not semantic verification of a memory summary.

No generation, saving, retrieval into sessions, merging, expiry, confidence weighting, relationship progression or initial-knowledge import is implemented. `memoryRecord` is only an immutable authoring query.

## Storage, coexistence and PWA

Storage key stays **`pitbull-academy-quality-pass-01`** and progress schema stays **1**. No new keys, fields, backups, migrations or resets are added. Contract versions are not storage schema versions. Model loading and queries produce zero progress changes/writes, including alongside a live legacy conversation.

Legacy M01 retains its fixed script, adapter, case indices, score labels, outcomes, catalog, visuals and persistence behavior. No canonical ID mapping is inferred. Existing results are not relabeled as evidence for future competencies.

The complete installed Phase 2 executable snapshot is unchanged: `app.js`, `index.html` and `service-worker.js` keep their matching release identity. The new library is absent from composition, shell script tags and the required cache. Therefore this authoring-only addition needs no release/cache change. Future production integration must advance all three release identities and publish/test a complete new snapshot.

## Migration sequence and commits

1. Created the approved branch at `8420cf3`; verified the untouched baseline: 49 regression and 8 browser tests passed.
2. `2c3af16` — isolated contracts, validators, bundle repository, synthetic fixtures and contract tests. Combined suite: 64 passed.
3. `8877a88` — pure knowledge, seller projection and authored sufficiency helpers with tests. Combined suite: 78 passed.
4. `d4328d9` — production-isolation contracts, strict malformed-array regression coverage and CI wiring.
5. Completed this ownership/compatibility report and final verification. Final commit IDs are listed in the delivery report and branch history.

There is no production migration or feature switch. Future approved work must separately author/review canonical cards, define active engine semantics, choose browser loading, version any persistence changes and perform release verification. It must preserve the legacy route until that migration is explicitly approved.

## Verification

Commands (Node 20+, CI uses Node 22):

```sh
node --test tests/stabilization.test.cjs tests/service-worker.test.cjs tests/separation.test.cjs tests/domain-model.test.cjs tests/decision-sufficiency.test.cjs tests/domain-compatibility.test.cjs
npm test
npm run test:domain
node --test tests/browser.test.cjs
git diff --check
```

The first command is the dependency-free equivalent of `npm test`; the local run used Node directly because npm is not on this workspace's PATH. CI runs the package script on Node 22. No packages need installation. The browser command uses the existing Playwright runtime through `ACADEMY_PLAYWRIGHT_PATH`, with optional `ACADEMY_BROWSER_EXECUTABLE`. Historical browser upgrade/rollback checks require Git objects `0835cb4` and `0c84951`. Missing browser support is reported as a skip, never as passed coverage.

### Final local verification — 2026-09-16

- Baseline at merged `8420cf3`: **49 regression tests and 8 browser tests passed**, no failures or skips, before file changes.
- Final full dependency-free suite: **84 passed, 0 failed, 0 skipped** on Node 24.19.0. All 49 original contracts remain unchanged; 35 new tests cover domain structure, evidence, purity and compatibility.
- Final domain-only run: **35 passed, 0 failed, 0 skipped**.
- Final browser suite: **8 passed, 0 failed, 0 skipped** using the existing Playwright runtime and headless Chrome on Windows. Viewports: desktop 1280 × 900 and mobile 390 × 844.
- No original regression expectation, characterization hash or browser test was changed. All 396 characterized legacy route/action combinations remain unchanged.
- Desktop and mobile both completed six cases, Boss Check, final result, reload, review and reset. The route remained Escucha 81 / Criterio 100 / Conversación 89 / Recomendación 100, total **93, ASESOR**. Final screenshots were visually inspected.
- Rapid input produced one intervention, reload retained the conversation, and clipboard/share failure exposed selectable result text.
- Audited pre-stabilization worker upgrade and current-to-simulated-next release activation passed. The old worker path retained its exact original progress backup; unrelated caches survived.
- Actual merged Phase 1 upgraded to the unchanged Phase 2 runtime with both a live conversation and a pending consequence. Exact saved records survived activation/offline reload and continued correctly.
- Corrective Phase 1 rollback read schema-1 progress unchanged and accepted the next intervention.
- Missing executable requests returned the intentional plain-text 503, not HTML. No uncaught application errors were recorded.
- The 81-file protected fingerprint passed. Changed-file review confirms no production source, legacy data, catalog, asset, CSS, normative specification or original test changed.
- `git diff --check` passed. These are local verification results; remote CI status is reported separately after pushing.

The compatibility fingerprint protects 81 existing files against the merged Phase 2 baseline, normalizing CRLF only for text and hashing binary assets exactly. It covers the legacy runtime/data, assets/source assets, CSS, release shell/worker/manifest, normative specifications, earlier reports and original regression/browser tests. It needs no Git objects in CI. Separate tests execute the library in a realm without browser/platform APIs and beside a live legacy runtime, checking globals, content, exact storage and legacy outcomes.

## Acceptance criteria

| Criterion | Verification |
| --- | --- |
| Master Client/Visit fields map to normative sections without invented canonical biographies | Explicit validators, mapping above, `TEST-*` fixtures only |
| Versioned strict contracts, structured errors, detached immutable results | Domain contract tests |
| Duplicate/dangling identifiers and conflicting participant/recipient structures rejected | Bundle and actor-reference tests |
| Fact type, value representation, importance and evidence remain separate | Typed-value and both approval-correction tests |
| Multiple discovery routes work without exact phrase matching | Two routes disclose the same fact |
| Buyer/end-user truth stays hidden until its fact is known | Seller projection tests |
| Relationship, appearance, topic opening and memory cannot infer knowledge | Initialization, disclosure and isolation tests |
| Memory remains typed, descriptive, provenance-bound and inactive | Memory confidence/subject tests; no persistence or initialization integration |
| Sufficiency uses only authored requirements; no score/decision outcome | Pure query and explicit-policy tests |
| New helpers run without presentation, browser, storage or external dependencies | Isolated VM allowlist tests |
| All 49 original regression contracts and all 8 browser scenarios preserved | Unmodified suites plus final rerun |
| Legacy data/catalog/assets/CSS/UX/normative files, storage key and schema unchanged | Protected fingerprint, exact storage comparison and browser verification |
| No excluded pedagogy, production wiring, release change or Phase 4 | Dependency/entry-point assertions and changed-file review |

## Risks and limitations

- This is an authoring/domain foundation, not an executable new curriculum. No canonical Master Cards are approved or shipped to users.
- Strict structural validation cannot approve editorial quality, reveal text, product claims, real-world correctness or the meaning of descriptive metadata.
- Explicit evidence records are structurally checked; authenticating and recording a real conversation belongs to a later engine phase.
- Full authoring repositories and sufficiency diagnostics must not be passed directly to a seller presentation. The projection is the disclosure boundary.
- Content revisions bind knowledge and memory provenance, but there is no cross-revision migration or active memory lifecycle.
- No normative numeric scale is assumed for rapport, importance or confidence in this library. Existing numeric legacy behavior remains solely in the unchanged legacy engine.
- External ID declarations validate linkage, not catalog source quality. There is no taxonomy/terminology expansion.
- Browser checks use headless desktop Chrome with desktop/mobile viewports, not physical phones, Safari/iOS or a production deployment.
- Existing local-storage compare-before-write conflict detection remains non-transactional; Phase 3 makes no persistence changes.

## Rollback

Revert the additive Phase 3 commits (including their test/CI/documentation wiring) to the merged Phase 2 tree. No progress transformation, backup restoration, cache migration or user action is needed because the library never enters the installed runtime. Never restore older progress over a newer record.

The browser suite retains corrective Phase 1 rollback coverage for schema-1 runtime progress. If a future phase integrates this library into production, that future rollback must use a new corrective release identity and complete snapshot; reusing an installed cache identity is not acceptable.

This branch is for review. It does not merge to main and introduces no M01 V2, new scoring, active memory, replay, terminology expansion, Training/Evaluation behavior or Phase 4 work.

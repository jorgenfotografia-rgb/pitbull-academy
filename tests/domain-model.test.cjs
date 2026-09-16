'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {fixture, clone, isolatedDomain} = require('./helpers/domain.cjs');
const {validateClientCard} = require('../domain/client-card.js');
const {validateVisitCard} = require('../domain/visit-card.js');
const {validateMemoryRecord} = require('../domain/memory-record.js');
const {validateBundle, createRepository} = require('../domain/repository.js');

function invalid(change, code) {
  const bundle = fixture(); change(bundle);
  const before = JSON.stringify(bundle), result = validateBundle(bundle);
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
  assert.equal(JSON.stringify(bundle), before, 'Validation must not repair input');
  for (const error of result.errors) {
    assert.ok(error.path.startsWith('$.')); assert.equal(typeof error.message, 'string');
  }
}

test('synthetic cards and bundle validate with detached immutable output', () => {
  const bundle = fixture(), result = validateBundle(bundle);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.value, bundle);
  assert.ok(Object.isFrozen(result.value.visits[0].facts[0]));
  assert.throws(() => { result.value.visits[0].facts[0].importance = 'changed'; }, TypeError);
  bundle.clients[0].identification.name = 'Caller edit';
  assert.equal(result.value.clients[0].identification.name, 'Synthetic test client A');
});

test('strict contracts reject absent fields, unknown fields and future versions without repair', () => {
  invalid(b => { delete b.clients[0].human_identity.occupation; delete b.clients[0].human_identity.work_type; }, 'required');
  invalid(b => { b.clients[0].human_identity.occupation = 'Duplicate authority'; }, 'unknown_field');
  invalid(b => { b.visits[0].answer = 'RECOMMEND_PRODUCT'; }, 'unknown_field');
  invalid(b => { b.contract_version = 2; }, 'enum');
  invalid(b => { b.clients[0].content_revision = 0; }, 'integer');
  invalid(b => { b.visits[0].visit_number = '1'; }, 'integer');
  invalid(b => { b.clients[0].relationship_with_store.initial_relationship_level = 'N4'; }, 'enum');
  invalid(b => { b.visits[0].mode = 'TRAINING'; }, 'enum');
});

test('non-JSON input, executable values, cycles and accessors fail without execution', () => {
  for (const value of [undefined, () => {}, NaN, Infinity, new Date(), new Map(), {bad: Symbol('x')}]) {
    assert.equal(validateClientCard(value).valid, false);
  }
  const cycle = {}; cycle.self = cycle;
  assert.equal(validateVisitCard(cycle).errors[0].code, 'json');
  const value = {}; Object.defineProperty(value, 'bad', {enumerable: true, get() { throw new Error('Do not execute'); }});
  assert.equal(validateMemoryRecord(value).errors[0].code, 'json');
});

test('descriptive fields do not invent numeric scales or required biographies', () => {
  const b = fixture();
  b.clients[0].commercial_profile.confidence_level = null;
  b.clients[0].relationship_with_store.recurrence_probability = 'Occasional';
  b.visits[0].difficulty = 'Synthetic author description';
  b.visits[0].facts[0].importance = 'Authored priority; no weight';
  assert.equal(validateBundle(b).valid, true);
  invalid(x => { x.visits[0].facts[0].importance = 10; }, 'type');
});

test('non-JSON arrays cannot become different data during snapshot creation', () => {
  const sparse = new Array(1); sparse.extra = 'Not index zero';
  const extra = []; extra.extra = 'Not an array item';
  class ExecutableArray extends Array { toJSON() { throw new Error('Do not execute'); } }
  for (const array of [sparse, extra, new ExecutableArray()]) {
    const bundle = fixture(); bundle.visits[0].topics = array;
    const result = validateBundle(bundle);
    assert.equal(result.valid, false); assert.equal(result.value, null);
    assert.ok(result.errors.some(error => error.code === 'json'));
  }
});

test('typed fact values validate representation independently of pedagogical type', () => {
  const cases = [['TEXT', 'x', null], ['NUMBER', 0, null], ['BOOLEAN', false, null], ['ENUM', 'yes', ['yes', 'no']],
    ['TEXT_LIST', [], null], ['ACTOR_REF', {kind: 'CLIENT', id: 'TEST-CLIENT-A'}, null],
    ['ACTOR_REFS', [{kind: 'PARTICIPANT', id: 'TEST-PERSON-A'}], null]];
  for (const [value_type, value, enum_values] of cases) {
    const b = fixture(); Object.assign(b.visits[0].facts[3], {value_type, value, enum_values});
    assert.equal(validateBundle(b).valid, true, value_type);
  }
  invalid(b => { b.visits[0].facts[3].value = 'not a number'; }, 'type');
  invalid(b => { Object.assign(b.visits[0].facts[3], {value_type: 'ENUM', value: 'unlisted', enum_values: ['listed']}); }, 'enum');
  invalid(b => { b.visits[0].facts[3].enum_values = ['unused']; }, 'enum_values');
  invalid(b => { b.visits[0].facts[3].type = 'HEALTH'; }, 'enum');
});

test('buyer/end-user classifications are explicit and internally consistent', () => {
  const b = fixture(), visit = b.visits[0];
  for (const [recipient, refs] of [
    ['SELF', [visit.purchase_context.buyer_ref]], ['THIRD_PARTY', [{kind: 'PARTICIPANT', id: 'TEST-PERSON-A'}]],
    ['MIXED', [visit.purchase_context.buyer_ref, {kind: 'PARTICIPANT', id: 'TEST-PERSON-A'}]], ['UNKNOWN', []]
  ]) {
    visit.purchase_context.recipient = recipient; visit.purchase_context.end_user_refs = refs;
    assert.equal(validateBundle(b).valid, true, recipient);
  }
  invalid(x => { x.visits[0].purchase_context.recipient = 'SELF'; }, 'recipient');
  invalid(x => { x.visits[0].purchase_context.recipient = 'UNKNOWN'; }, 'recipient');
  invalid(x => { x.visits[0].purchase_context.buyer_ref.id = 'unresolved'; }, 'reference');
});

test('purchase truth has one source and visual/arbitrary property paths cannot supply facts', () => {
  invalid(b => { b.visits[0].facts[0].value = clone(b.visits[0].purchase_context); }, 'single_source');
  invalid(b => { b.visits[0].facts[0].value_ref = 'client.internal_visual_identity.contexture'; }, 'enum');
  invalid(b => { b.visits[0].facts[1].value_ref = 'PURCHASE_CONTEXT'; }, 'value_ref');
});

test('IDs and cross-references reject duplicate cards, facts, topics, actors and targets', () => {
  invalid(b => { b.clients.push(clone(b.clients[0])); }, 'duplicate');
  invalid(b => { b.visits[1].visit_id = b.visits[0].visit_id; }, 'duplicate');
  invalid(b => { b.memory_records.push(clone(b.memory_records[0])); }, 'duplicate');
  invalid(b => { b.visits[0].facts.push(clone(b.visits[0].facts[0])); }, 'duplicate');
  invalid(b => { b.visits[0].topics.push(clone(b.visits[0].topics[0])); }, 'duplicate');
  invalid(b => { b.visits[0].facts[1].subject_ref.id = 'missing-person'; }, 'reference');
  invalid(b => { b.visits[0].client_id = 'missing-client'; }, 'reference');
  invalid(b => { b.visits[0].module_id = 'missing-module'; }, 'reference');
  invalid(b => { b.visits[0].actions[2].target_ref.id = 'missing-category'; }, 'reference');
  invalid(b => { b.clients[0].visual_representations.visit_visuals = [{visit_id: 'missing-visit', visual_ref: 'example.svg'}]; }, 'reference');
});

test('multiple discovery routes are supported and both directions must resolve', () => {
  assert.equal(validateVisitCard(fixture().visits[0]).valid, true);
  invalid(b => { b.visits[0].facts[0].discoverable_by.push('missing'); }, 'reference');
  invalid(b => { b.visits[0].interventions[0].reveals = []; }, 'reference');
  invalid(b => { b.visits[0].interventions[0].reveals.push('missing-fact'); }, 'reference');
  invalid(b => { b.visits[0].interventions[0].opens_topics.push('undeclared'); }, 'reference');
  invalid(b => { b.visits[0].interventions[0].closes_topics = ['recipient']; }, 'topics');
  invalid(b => { b.visits[0].facts[0].discoverable_by = []; }, 'unreachable');
});

test('authored decision requirements have one authority and conversational actions have no decision policy', () => {
  invalid(b => { b.visits[0].facts[0].required_for_decision[0].action_id = 'ASK_MORE'; }, 'enum');
  invalid(b => { b.visits[0].facts[0].required_for_decision[0].evidence = 'ASSUMED'; }, 'enum');
  invalid(b => { b.visits[0].facts[0].required_for_decision.push(clone(b.visits[0].facts[0].required_for_decision[0])); }, 'duplicate');
  invalid(b => { b.visits[0].actions[2].sufficiency_policy = 'NO_FACT_REQUIREMENTS'; }, 'requirements');
  invalid(b => { b.visits[0].actions[0].sufficiency_policy = 'NO_FACT_REQUIREMENTS'; }, 'conversational');
  invalid(b => { b.visits[0].actions[2].target_ref.kind = 'PRODUCT'; }, 'target');
});

test('CRITICAL type and importance never force CONFIRMED in validation', () => {
  const b = fixture();
  b.visits[0].facts[0].required_for_decision = [{action_id: 'RECOMMEND_CATEGORY', evidence: 'DISCOVERED'}, {action_id: 'RECOMMEND_PRODUCT', evidence: 'DISCOVERED'}];
  b.visits[0].facts[1].type = 'CONTEXTUAL';
  b.visits[0].facts[1].required_for_decision[0].evidence = 'CONFIRMED';
  assert.equal(validateBundle(b).valid, true);
});

test('memory confidence is nullable/descriptive, with no numeric scale', () => {
  for (const confidence of [null, 'Authored confidence description', 'Needs another conversation']) {
    const b = fixture(); b.memory_records[0].confidence = confidence;
    b.visits[0].facts[1].memory_after_visit.confidence = confidence;
    assert.equal(validateBundle(b).valid, true);
  }
  for (const confidence of [0, 0.5, 1, true]) {
    invalid(b => { b.memory_records[0].confidence = confidence; }, 'type');
    invalid(b => { b.visits[0].facts[1].memory_after_visit.confidence = confidence; }, 'type');
  }
});

test('memory provenance retains the actual third-party subject and source revision', () => {
  invalid(b => { b.memory_records[0].subject_ref = clone(b.visits[0].purchase_context.buyer_ref); }, 'reference');
  invalid(b => { b.memory_records[0].source.visit_id = 'missing'; }, 'reference');
  invalid(b => { b.memory_records[0].source.fact_id = 'missing'; }, 'reference');
  invalid(b => { b.memory_records[0].source.content_revision = 2; }, 'reference');
  invalid(b => { b.memory_records[0].source.intervention_id = 'ask-recipient'; }, 'reference');
  invalid(b => { b.memory_records[0].status = 'CONFIRMED'; }, 'enum');
});

test('repository derives visit/memory links without coupling two temporary situations', () => {
  const input = fixture(), repository = createRepository(input);
  assert.deepEqual(repository.client('TEST-CLIENT-A').visit_ids, ['TEST-VISIT-A', 'TEST-VISIT-B']);
  assert.deepEqual(repository.client('TEST-CLIENT-A').memory_record_ids, ['TEST-MEMORY-A']);
  assert.equal(repository.visitsForClient('TEST-CLIENT-A').length, 2);
  assert.equal(repository.visit('TEST-VISIT-A').purchase_context.recipient, 'THIRD_PARTY');
  assert.equal(repository.visit('TEST-VISIT-B').purchase_context.recipient, 'SELF');
  assert.equal(repository.memoryRecord('TEST-MEMORY-A').subject_ref.kind, 'PARTICIPANT');
  input.visits[0].facts[1].value = 'Changed outside';
  assert.equal(repository.visit('TEST-VISIT-A').facts[1].value, 'Synthetic purpose');
  assert.notEqual(repository.visit('TEST-VISIT-A'), repository.visit('TEST-VISIT-A'));
  assert.throws(() => { repository.visit('TEST-VISIT-A').facts.push({}); }, TypeError);
  assert.equal(repository.client('unknown'), null); assert.equal(repository.visit('unknown'), null);
  assert.equal(repository.memoryRecord('unknown'), null);
  assert.throws(() => createRepository({}), {name: 'DomainValidationError'});
});

test('domain authoring modules execute in an isolated realm with no browser or platform APIs', () => {
  const h = isolatedDomain();
  const repo = h.load('domain/repository.js').createRepository(fixture());
  assert.equal(repo.visit('TEST-VISIT-A').visit_id, 'TEST-VISIT-A');
  for (const name of ['window', 'document', 'navigator', 'localStorage', 'serviceWorker', 'fetch', 'setTimeout', 'process', 'Academy']) {
    assert.equal(name in h.context, false, name);
  }
});

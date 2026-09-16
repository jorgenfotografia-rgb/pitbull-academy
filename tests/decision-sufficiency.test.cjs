'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {fixture, clone, isolatedDomain} = require('./helpers/domain.cjs');
const {initializeKnowledge, validateKnowledge, projectSellerKnowledge} = require('../engine/visit-knowledge.js');
const {evaluateDecisionSufficiency: evaluate} = require('../engine/decision-sufficiency.js');

// Explicit evidence fixtures; this is not a conversation executor.
function discovered(visit, factIds, {route = 'ask-recipient', confirm = []} = {}) {
  const state = clone(initializeKnowledge(visit));
  for (const fact_id of factIds) {
    const intervention_id = fact_id === 'recipient' ? route : 'ask-goal';
    if (!state.known_fact_ids.includes(fact_id)) state.known_fact_ids.push(fact_id);
    state.used_intervention_ids.push(intervention_id);
    state.discovery_evidence.push({fact_id, intervention_id});
    if (confirm.includes(fact_id)) state.confirmation_evidence.push({fact_id, intervention_id});
  }
  return state;
}

test('knowledge initialization uses only explicitly initial facts, never relationship or memory', () => {
  const bundle = fixture(), visit = bundle.visits[0], before = clone(bundle);
  const state = initializeKnowledge(visit);
  assert.deepEqual(state.known_fact_ids, ['stated-request']);
  assert.deepEqual(state.discovery_evidence, []); assert.deepEqual(state.confirmation_evidence, []);
  assert.deepEqual(state.open_topic_ids, []); assert.deepEqual(state.used_intervention_ids, []);
  assert.equal(state.relationship_state.level, 'N3'); assert.equal(state.rapport, null);
  assert.equal(validateKnowledge(visit, state).valid, true);
  assert.deepEqual(bundle, before); assert.ok(Object.isFrozen(state.known_fact_ids));
  assert.equal('memory_records' in state, false);
});

test('seller projection hides internal recipient, third party, future responses and action requirements', () => {
  const visit = fixture().visits[0];
  const projection = projectSellerKnowledge(visit, initializeKnowledge(visit));
  assert.deepEqual(projection.known_facts.map(f => f.id), ['stated-request']);
  const serialized = JSON.stringify(projection);
  for (const hidden of ['THIRD_PARTY', 'TEST-PERSON-A', 'Synthetic purpose', 'required_for_decision', 'RECOMMEND_PRODUCT', 'Synthetic response']) assert.equal(serialized.includes(hidden), false, hidden);
  assert.deepEqual(Object.keys(projection).sort(), ['content_revision', 'entry', 'known_facts', 'open_topics', 'relationship_level', 'visit_id']);
});

test('discovery through either natural route discloses the same fact without auto-confirmation', () => {
  const visit = fixture().visits[0];
  const first = discovered(visit, ['recipient']);
  const second = discovered(visit, ['recipient'], {route: 'ask-recipient-alternative'});
  const projection = projectSellerKnowledge(visit, first);
  assert.deepEqual(projection, projectSellerKnowledge(visit, second));
  assert.equal(projection.known_facts[0].value.recipient, 'THIRD_PARTY');
  assert.equal(projection.known_facts[0].confirmed, false);
  assert.deepEqual(projection.known_facts[0].value.end_user_refs, [{kind: 'PARTICIPANT', id: 'TEST-PERSON-A'}]);
  const both = clone(first);
  both.used_intervention_ids.push('ask-recipient-alternative');
  both.discovery_evidence.push({fact_id: 'recipient', intervention_id: 'ask-recipient-alternative'});
  assert.equal(validateKnowledge(visit, both).valid, true);
  assert.deepEqual(projectSellerKnowledge(visit, both), projection);
});

test('open topics, used questions and familiarity alone cannot create factual knowledge', () => {
  const visit = fixture().visits[0], state = clone(initializeKnowledge(visit));
  state.open_topic_ids = ['recipient', 'goal']; state.used_intervention_ids = ['ask-recipient', 'ask-goal'];
  assert.equal(validateKnowledge(visit, state).valid, true);
  assert.equal(evaluate(visit, state, 'RECOMMEND_CATEGORY').status, 'INSUFFICIENT');
  assert.deepEqual(projectSellerKnowledge(visit, state).known_facts.map(f => f.id), ['stated-request']);
  state.known_fact_ids.push('recipient');
  assert.equal(validateKnowledge(visit, state).valid, false);
});

test('knowledge rejects foreign visits, stale revisions, duplicate or inconsistent evidence', () => {
  const visit = fixture().visits[0];
  const changes = [
    k => { k.visit_id = 'TEST-VISIT-B'; }, k => { k.content_revision = 2; },
    k => { k.known_fact_ids = []; }, k => { k.known_fact_ids.push('nonexistent'); },
    k => { k.used_intervention_ids.push('missing'); }, k => { k.open_topic_ids = ['missing']; },
    k => { k.known_fact_ids.push('stated-request'); },
    k => { k.discovery_evidence.push({fact_id: 'recipient', intervention_id: 'ask-recipient'}); },
    k => { k.confirmation_evidence.push({fact_id: 'recipient', intervention_id: 'ask-recipient'}); }
  ];
  for (const change of changes) {
    const state = clone(initializeKnowledge(visit)); change(state);
    assert.equal(validateKnowledge(visit, state).valid, false, JSON.stringify(state));
    assert.throws(() => projectSellerKnowledge(visit, state), {name: 'DomainValidationError'});
  }
  const duplicate = discovered(visit, ['recipient']); duplicate.discovery_evidence.push(clone(duplicate.discovery_evidence[0]));
  assert.equal(validateKnowledge(visit, duplicate).valid, false);
  const mismatched = discovered(visit, ['recipient']); mismatched.discovery_evidence[0].intervention_id = 'ask-goal';
  assert.equal(validateKnowledge(visit, mismatched).valid, false);
});

test('CRITICAL fact satisfies DISCOVERED; only explicit CONFIRMED requires confirmation', () => {
  const visit = fixture().visits[0], state = discovered(visit, ['recipient', 'goal']);
  assert.equal(visit.facts[0].type, 'CRITICAL');
  assert.deepEqual(evaluate(visit, state, 'RECOMMEND_CATEGORY'), {
    action_id: 'RECOMMEND_CATEGORY', status: 'SUFFICIENT', required_facts: [{fact_id: 'recipient', evidence: 'DISCOVERED'}], missing_facts: []
  });
  assert.deepEqual(evaluate(visit, state, 'RECOMMEND_PRODUCT').missing_facts, [{fact_id: 'recipient', evidence: 'CONFIRMED', reason: 'UNCONFIRMED'}]);
  state.confirmation_evidence = [{fact_id: 'recipient', intervention_id: 'ask-recipient'}];
  assert.equal(evaluate(visit, state, 'RECOMMEND_PRODUCT').status, 'SUFFICIENT');
  assert.equal(projectSellerKnowledge(visit, state).known_facts[0].confirmed, true);
});

test('CONFIRMED on a contextual fact is enforced independently of type and descriptive importance', () => {
  const visit = fixture().visits[0];
  visit.facts[0].type = 'CONTEXTUAL'; visit.facts[0].importance = 'Optional-looking description';
  const state = discovered(visit, ['recipient', 'goal']);
  assert.equal(evaluate(visit, state, 'RECOMMEND_PRODUCT').missing_facts[0].reason, 'UNCONFIRMED');
  visit.facts[0].required_for_decision.find(r => r.action_id === 'RECOMMEND_PRODUCT').evidence = 'DISCOVERED';
  assert.equal(evaluate(visit, state, 'RECOMMEND_PRODUCT').status, 'SUFFICIENT');
});

test('initially known fact meets DISCOVERED but does not imply CONFIRMED', () => {
  const visit = fixture().visits[0]; visit.facts[0].known_at_start = true; visit.facts[1].known_at_start = true;
  const state = initializeKnowledge(visit);
  assert.equal(evaluate(visit, state, 'RECOMMEND_CATEGORY').status, 'SUFFICIENT');
  assert.equal(evaluate(visit, state, 'RECOMMEND_PRODUCT').missing_facts[0].reason, 'UNCONFIRMED');
});

test('missing evidence reports undiscovered before unconfirmed and never treats hidden truth as knowledge', () => {
  const visit = fixture().visits[0];
  const result = evaluate(visit, initializeKnowledge(visit), 'RECOMMEND_PRODUCT');
  assert.deepEqual(result.missing_facts, [
    {fact_id: 'recipient', evidence: 'CONFIRMED', reason: 'UNDISCOVERED'},
    {fact_id: 'goal', evidence: 'DISCOVERED', reason: 'UNDISCOVERED'}
  ]);
  assert.equal(result.status, 'INSUFFICIENT');
});

test('unknown required recipient/value is insufficient even with explicit confirmation', () => {
  const visit = fixture().visits[0];
  visit.purchase_context.recipient = 'UNKNOWN'; visit.purchase_context.end_user_refs = [];
  const state = discovered(visit, ['recipient', 'goal'], {confirm: ['recipient']});
  assert.equal(evaluate(visit, state, 'RECOMMEND_PRODUCT').missing_facts[0].reason, 'UNKNOWN_VALUE');
  visit.facts[1].value = null;
  assert.deepEqual(evaluate(visit, state, 'RECOMMEND_PRODUCT').missing_facts.map(f => f.reason), ['UNKNOWN_VALUE', 'UNKNOWN_VALUE']);
  // UNKNOWN is not a universal decision block: only authored prerequisites matter.
  assert.equal(evaluate(visit, state, 'DEFER_SUPPLEMENT').status, 'SUFFICIENT');
});

test('zero and false are known values, not mistaken for missing evidence', () => {
  for (const [value_type, value] of [['NUMBER', 0], ['BOOLEAN', false]]) {
    const visit = fixture().visits[0]; Object.assign(visit.facts[1], {value_type, value});
    assert.equal(evaluate(visit, discovered(visit, ['recipient', 'goal'], {confirm: ['recipient']}), 'RECOMMEND_PRODUCT').status, 'SUFFICIENT');
  }
});

test('unspecified differs from explicitly empty requirements; conversational actions remain nonterminal metadata', () => {
  const visit = fixture().visits[0], state = initializeKnowledge(visit), before = clone(state);
  assert.equal(evaluate(visit, state, 'REFER_PROFESSIONAL').status, 'UNSPECIFIED');
  assert.equal(evaluate(visit, state, 'DEFER_SUPPLEMENT').status, 'SUFFICIENT');
  for (const action of ['ASK_MORE', 'CLARIFY_REQUEST']) assert.equal(evaluate(visit, state, action).status, 'NOT_APPLICABLE');
  assert.deepEqual(state, before);
  assert.throws(() => evaluate(visit, state, 'LOST'), {name: 'DomainValidationError'});
  assert.throws(() => evaluate(visit, state, 'UNKNOWN_ACTION'), {name: 'DomainValidationError'});
});

test('queries are pure, immutable and independent across visits with no score/outcome side effects', () => {
  const bundle = fixture(), visit = bundle.visits[0], state = discovered(visit, ['recipient', 'goal'], {confirm: ['recipient']});
  const beforeVisit = clone(visit), beforeState = clone(state);
  const result = evaluate(visit, state, 'RECOMMEND_PRODUCT');
  assert.ok(Object.isFrozen(result.required_facts));
  assert.deepEqual(Object.keys(result).sort(), ['action_id', 'missing_facts', 'required_facts', 'status']);
  projectSellerKnowledge(visit, state); evaluate(visit, state, 'RECOMMEND_PRODUCT');
  assert.deepEqual(visit, beforeVisit); assert.deepEqual(state, beforeState);
  assert.deepEqual(initializeKnowledge(bundle.visits[1]).known_fact_ids, ['stated-request']);
  assert.equal(validateKnowledge(bundle.visits[1], state).valid, false);
});

test('knowledge and sufficiency run headlessly without presentation, time, storage or I/O', () => {
  const h = isolatedDomain(), visit = fixture().visits[0];
  const K = h.load('engine/visit-knowledge.js'), D = h.load('engine/decision-sufficiency.js');
  const state = K.initializeKnowledge(visit);
  assert.equal(K.projectSellerKnowledge(visit, state).known_facts.length, 1);
  assert.equal(D.evaluateDecisionSufficiency(visit, state, 'RECOMMEND_CATEGORY').status, 'INSUFFICIENT');
  for (const name of ['window', 'document', 'navigator', 'localStorage', 'serviceWorker', 'fetch', 'setTimeout', 'process', 'Academy']) assert.equal(name in h.context, false, name);
});

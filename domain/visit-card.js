'use strict';

const C = require('./contracts.js');
const V = require('./validation.js');
const requirement = V.shape({action_id: V.enumeration(C.DECISION_ACTIONS), evidence: V.enumeration(C.EVIDENCE_LEVELS)});
const fact = V.shape({id: V.id, type: V.enumeration(C.FACT_TYPES), subject_ref: V.actorRef,
  value_type: V.enumeration(C.VALUE_TYPES), value: () => {}, enum_values: V.nullable(V.list(V.text)),
  value_ref: V.nullable(V.enumeration(['PURCHASE_CONTEXT'])), importance: V.descriptive,
  known_at_start: V.boolean, discoverable_by: V.ids, required_for_decision: V.list(requirement), memory_after_visit: V.memoryDirective});
const intervention = V.shape({id: V.id, text: V.text, topics: V.ids, relevance: V.descriptive,
  timing_rules: V.list(V.text), discovery_value: V.descriptive, relationship_effect: V.descriptive, assumption_risk: V.descriptive,
  reveals: V.ids, opens_topics: V.ids, closes_topics: V.ids, client_response: V.descriptive});
const action = V.shape({id: V.enumeration(C.ACTIONS), sufficiency_policy: V.enumeration(C.SUFFICIENCY_POLICIES),
  target_ref: V.nullable(V.shape({kind: V.enumeration(['CATEGORY', 'PRODUCT']), id: V.id}))});
const check = V.shape({...V.header, visit_id: V.id, client_id: V.id, module_id: V.id,
  visit_number: V.integer(1), difficulty: V.descriptive, mode: V.enumeration([null]),
  relationship_level: V.nullable(V.enumeration(C.RELATIONSHIP_LEVELS)), chronology_index: V.integer(0),
  entry: V.shape({opening_line: V.text, visible_context: V.descriptive, initial_mood: V.descriptive,
    stated_request: V.descriptive, requested_term: V.descriptive, initial_confidence: V.descriptive, initial_information_level: V.descriptive}),
  participants: V.list(V.shape({id: V.id, label: V.descriptive})), purchase_context: V.purchaseContext,
  facts: V.list(fact), topics: V.list(V.shape({id: V.id, label: V.text})), interventions: V.list(intervention),
  actions: V.list(action), consequence_notes: V.descriptive, memory_notes: V.descriptive});

function factValue(visit, item) {
  return item.value_ref === 'PURCHASE_CONTEXT' ? visit.purchase_context : item.value;
}
function factActors(visit, item) {
  const value = factValue(visit, item);
  if (value === null) return [];
  if (item.value_type === 'ACTOR_REF') return [value];
  if (item.value_type === 'ACTOR_REFS') return value;
  if (item.value_type === 'PURCHASE_CONTEXT') return [value.buyer_ref, ...value.end_user_refs];
  return [];
}
function crossCheck(visit, path, errors) {
  for (const name of ['participants', 'facts', 'topics', 'interventions', 'actions']) V.unique(visit[name], `${path}.${name}`, errors, item => item.id);
  const facts = new Map(visit.facts.map(item => [item.id, item]));
  const interventions = new Map(visit.interventions.map(item => [item.id, item]));
  const topics = new Set(visit.topics.map(item => item.id));
  const actions = new Map(visit.actions.map(item => [item.id, item]));
  const participants = new Set(visit.participants.map(item => item.id));
  const checkActor = (ref, at) => {
    if (ref.kind === 'PARTICIPANT') V.reference(participants.has(ref.id), at, errors);
  };
  V.reference(visit.purchase_context.buyer_ref.kind === 'CLIENT' && visit.purchase_context.buyer_ref.id === visit.client_id,
    `${path}.purchase_context.buyer_ref`, errors);
  visit.purchase_context.end_user_refs.forEach((ref, i) => checkActor(ref, `${path}.purchase_context.end_user_refs[${i}]`));
  visit.facts.forEach((item, i) => {
    const at = `${path}.facts[${i}]`;
    checkActor(item.subject_ref, `${at}.subject_ref`);
    const before = errors.length;
    V.typedValue({value_type: item.value_type, value: item.value, enum_values: item.enum_values}, at, errors);
    if (item.value_type === 'PURCHASE_CONTEXT') {
      if (item.value_ref !== 'PURCHASE_CONTEXT' || item.value !== null) V.issue(errors, at, 'single_source', 'Purchase context must reference the visit value');
    } else if (item.value_ref !== null) V.issue(errors, `${at}.value_ref`, 'value_ref', 'Only PURCHASE_CONTEXT may reference visit context');
    if (errors.length === before) factActors(visit, item).forEach((ref, j) => checkActor(ref, `${at}.value[${j}]`));
    V.unique(item.required_for_decision, `${at}.required_for_decision`, errors, entry => entry.action_id);
    item.required_for_decision.forEach((entry, j) => {
      V.reference(actions.has(entry.action_id), `${at}.required_for_decision[${j}].action_id`, errors);
    });
    if (item.required_for_decision.length && !item.known_at_start && !item.discoverable_by.length) {
      V.issue(errors, at, 'unreachable', 'A required fact must be initially known or discoverable');
    }
    item.discoverable_by.forEach((id, j) => V.reference(interventions.get(id)?.reveals.includes(item.id), `${at}.discoverable_by[${j}]`, errors));
  });
  visit.interventions.forEach((item, i) => {
    const at = `${path}.interventions[${i}]`;
    for (const field of ['topics', 'opens_topics', 'closes_topics']) item[field].forEach((id, j) => V.reference(topics.has(id), `${at}.${field}[${j}]`, errors));
    item.reveals.forEach((id, j) => V.reference(facts.get(id)?.discoverable_by.includes(item.id), `${at}.reveals[${j}]`, errors));
    if (item.opens_topics.some(id => item.closes_topics.includes(id))) V.issue(errors, at, 'topics', 'An intervention cannot open and close the same topic');
  });
  visit.actions.forEach((item, i) => {
    const at = `${path}.actions[${i}]`;
    const count = visit.facts.filter(f => f.required_for_decision.some(entry => entry.action_id === item.id)).length;
    if ((item.sufficiency_policy === 'FACT_REQUIREMENTS') !== (count > 0)) V.issue(errors, at, 'requirements', 'Policy and authored fact requirements must agree');
    if (C.CONVERSATIONAL_ACTIONS.includes(item.id) && item.sufficiency_policy !== 'UNSPECIFIED') V.issue(errors, at, 'conversational', 'Conversational actions do not have decision sufficiency');
    if (item.target_ref && !((item.id === 'RECOMMEND_CATEGORY' && item.target_ref.kind === 'CATEGORY') || (item.id === 'RECOMMEND_PRODUCT' && item.target_ref.kind === 'PRODUCT'))) {
      V.issue(errors, `${at}.target_ref`, 'target', 'Target kind must match recommendation intent');
    }
  });
}
const validateVisitCard = input => V.validate(input, check, crossCheck);
module.exports = {validateVisitCard, factValue, factActors};

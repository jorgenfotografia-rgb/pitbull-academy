'use strict';

const C = require('../domain/contracts.js');
const V = require('../domain/validation.js');
const {validateVisitCard, factValue} = require('../domain/visit-card.js');
const evidence = V.shape({fact_id: V.id, intervention_id: V.id});
const check = V.shape({...V.header, visit_id: V.id, known_fact_ids: V.ids,
  discovery_evidence: V.list(evidence), confirmation_evidence: V.list(evidence),
  used_intervention_ids: V.ids, open_topic_ids: V.ids,
  relationship_state: V.shape({level: V.nullable(V.enumeration(C.RELATIONSHIP_LEVELS))}), rapport: V.descriptive});

function initializeKnowledge(input) {
  const visit = V.requireValid(validateVisitCard(input));
  return V.snapshot({contract_version: C.CONTRACT_VERSION, content_revision: visit.content_revision, visit_id: visit.visit_id,
    known_fact_ids: visit.facts.filter(fact => fact.known_at_start).map(fact => fact.id),
    discovery_evidence: [], confirmation_evidence: [], used_intervention_ids: [], open_topic_ids: [],
    relationship_state: {level: visit.relationship_level}, rapport: null});
}

// Validates an explicit caller-supplied record. It never executes an intervention
// or infers confirmation from discovery, fact type, importance or relationship.
function validateKnowledge(visitInput, input) {
  const visit = V.requireValid(validateVisitCard(visitInput));
  return V.validate(input, check, (knowledge, path, errors) => {
    V.reference(knowledge.visit_id === visit.visit_id, `${path}.visit_id`, errors);
    V.reference(knowledge.content_revision === visit.content_revision, `${path}.content_revision`, errors);
    const facts = new Map(visit.facts.map(item => [item.id, item]));
    const interventions = new Set(visit.interventions.map(item => item.id));
    const topics = new Set(visit.topics.map(item => item.id));
    knowledge.used_intervention_ids.forEach((id, i) => V.reference(interventions.has(id), `${path}.used_intervention_ids[${i}]`, errors));
    knowledge.open_topic_ids.forEach((id, i) => V.reference(topics.has(id), `${path}.open_topic_ids[${i}]`, errors));
    const expected = new Set(visit.facts.filter(item => item.known_at_start).map(item => item.id));
    for (const name of ['discovery_evidence', 'confirmation_evidence']) {
      V.unique(knowledge[name], `${path}.${name}`, errors, item => `${item.fact_id}|${item.intervention_id}`);
      knowledge[name].forEach((item, i) => {
        const at = `${path}.${name}[${i}]`, fact = facts.get(item.fact_id);
        V.reference(fact?.discoverable_by.includes(item.intervention_id), `${at}.intervention_id`, errors);
        V.reference(knowledge.used_intervention_ids.includes(item.intervention_id), `${at}.intervention_id`, errors);
        if (name === 'discovery_evidence') expected.add(item.fact_id);
        else V.reference(knowledge.known_fact_ids.includes(item.fact_id), `${at}.fact_id`, errors);
      });
    }
    knowledge.known_fact_ids.forEach((id, i) => V.reference(facts.has(id) && expected.has(id), `${path}.known_fact_ids[${i}]`, errors));
    if ([...expected].some(id => !knowledge.known_fact_ids.includes(id))) V.issue(errors, `${path}.known_fact_ids`, 'knowledge', 'Known facts must equal initial facts plus explicit discovery evidence');
  });
}

function projectSellerKnowledge(visitInput, knowledgeInput) {
  const visit = V.requireValid(validateVisitCard(visitInput));
  const knowledge = V.requireValid(validateKnowledge(visit, knowledgeInput));
  const confirmed = new Set(knowledge.confirmation_evidence.map(item => item.fact_id));
  // Whitelist seller-visible information. No hidden facts, participant roster,
  // client biographies, responses, rules, memory, targets or answer cues escape.
  return V.snapshot({visit_id: visit.visit_id, content_revision: visit.content_revision,
    entry: {opening_line: visit.entry.opening_line, visible_context: visit.entry.visible_context,
      initial_mood: visit.entry.initial_mood, stated_request: visit.entry.stated_request, requested_term: visit.entry.requested_term},
    relationship_level: knowledge.relationship_state.level,
    known_facts: visit.facts.filter(fact => knowledge.known_fact_ids.includes(fact.id)).map(fact => ({
      id: fact.id, subject_ref: fact.subject_ref, value_type: fact.value_type, value: factValue(visit, fact), confirmed: confirmed.has(fact.id)})),
    open_topics: visit.topics.filter(topic => knowledge.open_topic_ids.includes(topic.id))});
}
module.exports = {initializeKnowledge, validateKnowledge, projectSellerKnowledge};

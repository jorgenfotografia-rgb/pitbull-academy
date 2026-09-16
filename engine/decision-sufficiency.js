'use strict';

const C = require('../domain/contracts.js');
const V = require('../domain/validation.js');
const {validateVisitCard, factValue} = require('../domain/visit-card.js');
const {validateKnowledge} = require('./visit-knowledge.js');

// An information prerequisite check, not a recommendation, score or outcome.
function evaluateDecisionSufficiency(visitInput, knowledgeInput, actionId) {
  const visit = V.requireValid(validateVisitCard(visitInput));
  const knowledge = V.requireValid(validateKnowledge(visit, knowledgeInput));
  const action = visit.actions.find(item => item.id === actionId);
  if (!action) return V.requireValid({valid: false, errors: [{path: '$.action_id', code: 'reference', message: 'Action is not authored for this visit'}]});
  const result = {action_id: actionId, status: 'UNSPECIFIED', required_facts: [], missing_facts: []};
  if (C.CONVERSATIONAL_ACTIONS.includes(actionId)) return V.snapshot({...result, status: 'NOT_APPLICABLE'});
  if (action.sufficiency_policy === 'UNSPECIFIED') return V.snapshot(result);
  if (action.sufficiency_policy === 'NO_FACT_REQUIREMENTS') return V.snapshot({...result, status: 'SUFFICIENT'});
  for (const fact of visit.facts) {
    const entry = fact.required_for_decision.find(item => item.action_id === actionId);
    if (!entry) continue;
    result.required_facts.push({fact_id: fact.id, evidence: entry.evidence});
    let reason = null;
    if (!knowledge.known_fact_ids.includes(fact.id)) reason = 'UNDISCOVERED';
    else {
      const value = factValue(visit, fact);
      if (value === null || (fact.value_type === 'PURCHASE_CONTEXT' && value.recipient === 'UNKNOWN')) reason = 'UNKNOWN_VALUE';
      else if (entry.evidence === 'CONFIRMED' && !knowledge.confirmation_evidence.some(item => item.fact_id === fact.id)) reason = 'UNCONFIRMED';
    }
    if (reason) result.missing_facts.push({fact_id: fact.id, evidence: entry.evidence, reason});
  }
  result.status = result.missing_facts.length ? 'INSUFFICIENT' : 'SUFFICIENT';
  return V.snapshot(result);
}
module.exports = {evaluateDecisionSufficiency};

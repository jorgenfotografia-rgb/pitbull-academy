'use strict';

// Authoring contracts only. This version is independent of saved progress.
const CONTRACT_VERSION = 1;
const FACT_TYPES = ['STABLE', 'TEMPORARY', 'CRITICAL', 'CONTEXTUAL'];
const VALUE_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM', 'TEXT_LIST', 'ACTOR_REF', 'ACTOR_REFS', 'PURCHASE_CONTEXT'];
const RELATIONSHIP_LEVELS = ['N0', 'N1', 'N2', 'N3'];
const RECIPIENTS = ['SELF', 'THIRD_PARTY', 'UNKNOWN', 'MIXED'];
const MEMORY_TYPES = ['identity', 'name', 'stable', 'sports', 'historical', 'relational'];
const MEMORY_STATUSES = ['STABLE', 'TEMPORARY', 'TO_CONFIRM'];
const CONVERSATIONAL_ACTIONS = ['ASK_MORE', 'CLARIFY_REQUEST'];
const DECISION_ACTIONS = ['RECOMMEND_CATEGORY', 'RECOMMEND_PRODUCT', 'DEFER_SUPPLEMENT', 'REFER_PROFESSIONAL'];
const ACTIONS = [...CONVERSATIONAL_ACTIONS, ...DECISION_ACTIONS];
const EVIDENCE_LEVELS = ['DISCOVERED', 'CONFIRMED'];
const SUFFICIENCY_POLICIES = ['FACT_REQUIREMENTS', 'NO_FACT_REQUIREMENTS', 'UNSPECIFIED'];

// Fields without a normative scale/enumeration stay nullable and descriptive.
const CLIENT_DESCRIPTIVE_FIELDS = {
  identification: ['occupation', 'active_status', 'recurrence', 'visual_version'],
  human_identity: ['work_type', 'everyday_environment', 'responsibilities', 'time_availability', 'organization_style', 'central_human_trait'],
  sports_context: ['primary_discipline', 'secondary_discipline', 'experience_level', 'habitual_frequency', 'habitual_schedule', 'habitual_duration', 'sports_history', 'relationship_to_training', 'regularity', 'planning_level'],
  commercial_profile: ['supplementation_knowledge', 'knowledge_precision', 'dominant_vocabulary', 'information_source', 'request_style', 'confidence_level', 'question_tendency', 'price_sensitivity', 'brand_sensitivity', 'promo_sensitivity', 'technical_explanation_tolerance', 'conversational_style'],
  internal_visual_identity: ['approximate_height', 'weight_range', 'contexture', 'visual_muscle', 'visual_adiposity', 'body_distribution', 'posture', 'face_shape', 'hair', 'facial_hair', 'glasses', 'distinguishing_traits', 'usual_style', 'visual_age'],
  recognition_matrix: ['facial_anchor', 'distinctive_anchor', 'body_presence_anchor'],
  relationship_with_store: ['visit_frequency', 'recurrence_probability', 'expected_familiarity', 'loyalty_type']
};

/** @typedef {{kind: 'CLIENT'|'PARTICIPANT', id: string}} ActorRef */
/** @typedef {{action_id: string, evidence: 'DISCOVERED'|'CONFIRMED'}} DecisionRequirement */
/** @typedef {{path: string, code: string, message: string}} ValidationIssue */
/** @typedef {{value_type: string, value: *, enum_values: string[]|null}} TypedValue */
/** @typedef {{fact_id: string, intervention_id: string}} FactEvidence */

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
module.exports = freeze({CONTRACT_VERSION, FACT_TYPES, VALUE_TYPES, RELATIONSHIP_LEVELS, RECIPIENTS,
  MEMORY_TYPES, MEMORY_STATUSES, CONVERSATIONAL_ACTIONS, DECISION_ACTIONS, ACTIONS, EVIDENCE_LEVELS,
  SUFFICIENCY_POLICIES, CLIENT_DESCRIPTIVE_FIELDS});

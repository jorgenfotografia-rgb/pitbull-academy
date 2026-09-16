'use strict';

const C = require('./contracts.js');
const V = require('./validation.js');
const check = V.shape({...V.header, record_id: V.id, client_id: V.id, subject_ref: V.actorRef,
  memory_type: V.enumeration(C.MEMORY_TYPES), memory_value: V.typedValue,
  confidence: V.descriptive, status: V.enumeration(C.MEMORY_STATUSES),
  source: V.shape({visit_id: V.id, fact_id: V.id, intervention_id: V.nullable(V.id),
    content_revision: V.integer(1), recorded_at: V.descriptive})});

// No confidence scale, threshold, generation, retrieval or lifecycle policy.
const validateMemoryRecord = input => V.validate(input, check);
module.exports = {validateMemoryRecord};

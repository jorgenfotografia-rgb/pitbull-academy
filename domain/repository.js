'use strict';

const V = require('./validation.js');
const {validateClientCard} = require('./client-card.js');
const {validateVisitCard, factActors} = require('./visit-card.js');
const {validateMemoryRecord} = require('./memory-record.js');
const check = V.shape({contract_version: V.version, clients: V.list(() => {}), visits: V.list(() => {}),
  memory_records: V.list(() => {}), references: V.shape({module_ids: V.ids, category_ids: V.ids, product_ids: V.ids})});

function validateBundle(input) {
  return V.validate(input, check, (bundle, path, errors) => {
    const groups = [['clients', validateClientCard, 'client_id'], ['visits', validateVisitCard, 'visit_id'], ['memory_records', validateMemoryRecord, 'record_id']];
    for (const [name, validate, key] of groups) {
      bundle[name].forEach((item, i) => {
        validate(item).errors.forEach(error => errors.push({...error, path: `${path}.${name}[${i}]${error.path.slice(1)}`}));
      });
      if (!errors.length) V.unique(bundle[name], `${path}.${name}`, errors, item => item[key]);
    }
    if (errors.length) return;
    const clients = new Map(bundle.clients.map(item => [item.client_id, item]));
    const visits = new Map(bundle.visits.map(item => [item.visit_id, item]));
    const checkClientRef = (ref, at) => {
      if (ref.kind === 'CLIENT') V.reference(clients.has(ref.id), at, errors);
    };
    bundle.visits.forEach((visit, i) => {
      const at = `${path}.visits[${i}]`;
      V.reference(clients.has(visit.client_id), `${at}.client_id`, errors);
      V.reference(bundle.references.module_ids.includes(visit.module_id), `${at}.module_id`, errors);
      visit.purchase_context.end_user_refs.forEach((ref, j) => checkClientRef(ref, `${at}.purchase_context.end_user_refs[${j}]`));
      visit.facts.forEach((fact, j) => {
        checkClientRef(fact.subject_ref, `${at}.facts[${j}].subject_ref`);
        factActors(visit, fact).forEach((ref, k) => checkClientRef(ref, `${at}.facts[${j}].value[${k}]`));
      });
      visit.actions.forEach((action, j) => {
        if (!action.target_ref) return;
        const ids = action.target_ref.kind === 'CATEGORY' ? bundle.references.category_ids : bundle.references.product_ids;
        V.reference(ids.includes(action.target_ref.id), `${at}.actions[${j}].target_ref`, errors);
      });
    });
    bundle.clients.forEach((client, i) => client.visual_representations.visit_visuals.forEach((visual, j) => {
      V.reference(visits.get(visual.visit_id)?.client_id === client.client_id, `${path}.clients[${i}].visual_representations.visit_visuals[${j}].visit_id`, errors);
    }));
    bundle.memory_records.forEach((memory, i) => {
      const at = `${path}.memory_records[${i}]`;
      const visit = visits.get(memory.source.visit_id);
      const fact = visit?.facts.find(item => item.id === memory.source.fact_id);
      V.reference(visit && visit.client_id === memory.client_id && clients.has(memory.client_id), `${at}.client_id`, errors);
      V.reference(visit, `${at}.source.visit_id`, errors);
      V.reference(fact, `${at}.source.fact_id`, errors);
      V.reference(visit?.content_revision === memory.source.content_revision, `${at}.source.content_revision`, errors);
      V.reference(fact && V.actorKey(fact.subject_ref) === V.actorKey(memory.subject_ref), `${at}.subject_ref`, errors);
      if (memory.source.intervention_id !== null) {
        V.reference(fact?.discoverable_by.includes(memory.source.intervention_id), `${at}.source.intervention_id`, errors);
      }
      const value = memory.memory_value;
      const refs = value.value === null ? [] : value.value_type === 'ACTOR_REF' ? [value.value]
        : value.value_type === 'ACTOR_REFS' ? value.value : value.value_type === 'PURCHASE_CONTEXT' ? [value.value.buyer_ref, ...value.value.end_user_refs] : [];
      refs.forEach((ref, j) => {
        if (ref.kind === 'CLIENT') checkClientRef(ref, `${at}.memory_value.value[${j}]`);
        else V.reference(visit?.participants.some(item => item.id === ref.id), `${at}.memory_value.value[${j}]`, errors);
      });
    });
  });
}

function createRepository(input) {
  const bundle = V.requireValid(validateBundle(input));
  const clients = new Map(bundle.clients.map(item => [item.client_id, item]));
  const visits = new Map(bundle.visits.map(item => [item.visit_id, item]));
  // Authoring queries expose full authored truth. Never pass this repository to a seller view.
  return Object.freeze({
    client: id => clients.has(id) ? V.snapshot({card: clients.get(id),
      visit_ids: bundle.visits.filter(item => item.client_id === id).map(item => item.visit_id),
      memory_record_ids: bundle.memory_records.filter(item => item.client_id === id).map(item => item.record_id)}) : null,
    visit: id => visits.has(id) ? V.snapshot(visits.get(id)) : null,
    visitsForClient: id => V.snapshot(bundle.visits.filter(item => item.client_id === id)),
    memoryRecord: id => V.snapshot(bundle.memory_records.find(item => item.record_id === id) || null),
    snapshot: () => V.snapshot(bundle)
  });
}
module.exports = {validateBundle, createRepository};

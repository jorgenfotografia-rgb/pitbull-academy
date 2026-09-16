'use strict';

const C = require('./contracts.js');
const V = require('./validation.js');
const fields = group => Object.fromEntries(C.CLIENT_DESCRIPTIVE_FIELDS[group].map(name => [name, V.descriptive]));
const check = V.shape({
  ...V.header,
  client_id: V.id,
  identification: V.shape({...fields('identification'), name: V.text, base_age: V.nullable(V.integer(0))}),
  human_identity: V.shape(fields('human_identity')),
  sports_context: V.shape(fields('sports_context')),
  commercial_profile: V.shape(fields('commercial_profile')),
  internal_visual_identity: V.shape(fields('internal_visual_identity')),
  recognition_matrix: V.shape(fields('recognition_matrix')),
  relationship_with_store: V.shape({...fields('relationship_with_store'),
    initial_relationship_level: V.nullable(V.enumeration(C.RELATIONSHIP_LEVELS)),
    buys_for_self: V.nullable(V.boolean), buys_for_third_parties: V.nullable(V.boolean), third_party_types: V.list(V.text)}),
  purchase_recipient_capability: V.shape({possible_recipients: V.list(V.enumeration(C.RECIPIENTS))}),
  visual_representations: V.shape({face_id: V.descriptive, body_id: V.descriptive, academy_canon: V.descriptive,
    visit_visuals: V.list(V.shape({visit_id: V.id, visual_ref: V.text}))})
});

function validateClientCard(input) {
  return V.validate(input, check, (card, path, errors) => {
    V.unique(card.purchase_recipient_capability.possible_recipients, `${path}.purchase_recipient_capability.possible_recipients`, errors);
    V.unique(card.visual_representations.visit_visuals, `${path}.visual_representations.visit_visuals`, errors, item => item.visit_id);
  });
}
module.exports = {validateClientCard};

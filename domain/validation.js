'use strict';

const C = require('./contracts.js');
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const issue = (errors, path, code, message) => errors.push({path, code, message});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const snapshot = value => freeze(JSON.parse(JSON.stringify(value)));

// Accept JSON data, never callbacks, accessors, class instances or circular data.
function json(value, path, errors, parents = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || parents.has(value)) {
    issue(errors, path, 'json', 'Expected finite, acyclic JSON data'); return;
  }
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== null && Object.getPrototypeOf(proto) !== null) {
    issue(errors, path, 'json', 'Expected a plain JSON object'); return;
  }
  parents.add(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (!Array.isArray(proto) || Object.getPrototypeOf(Object.getPrototypeOf(proto)) !== null) {
      issue(errors, path, 'json', 'Expected an ordinary JSON array');
    }
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      issue(errors, path, 'json', 'Sparse arrays or extra array properties are not supported');
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !own(descriptor, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      issue(errors, path, 'json', 'Expected ordinary JSON properties'); continue;
    }
    json(descriptor.value, `${path}.${key}`, errors, parents);
  }
  parents.delete(value);
}

function shape(fields) {
  return (value, path, errors) => {
    if (!record(value)) { issue(errors, path, 'type', 'Expected an object'); return; }
    for (const key of Object.keys(value)) if (!own(fields, key)) issue(errors, `${path}.${key}`, 'unknown_field', 'Unknown field');
    for (const [key, check] of Object.entries(fields)) {
      if (!own(value, key)) issue(errors, `${path}.${key}`, 'required', 'Field is required; use null only where allowed');
      else check(value[key], `${path}.${key}`, errors);
    }
  };
}
const nullable = check => (value, path, errors) => { if (value !== null) check(value, path, errors); };
const text = (value, path, errors) => {
  if (typeof value !== 'string' || !value.trim()) issue(errors, path, 'type', 'Expected non-empty text');
};
const descriptive = nullable(text);
const number = (value, path, errors) => {
  if (!Number.isFinite(value)) issue(errors, path, 'type', 'Expected a finite number');
};
const boolean = (value, path, errors) => { if (typeof value !== 'boolean') issue(errors, path, 'type', 'Expected a boolean'); };
const id = (value, path, errors) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) issue(errors, path, 'id', 'Expected a stable identifier');
};
const enumeration = values => (value, path, errors) => {
  if (!values.includes(value)) issue(errors, path, 'enum', `Expected one of: ${values.join(', ')}`);
};
const integer = minimum => (value, path, errors) => {
  if (!Number.isSafeInteger(value) || value < minimum) issue(errors, path, 'integer', `Expected an integer >= ${minimum}`);
};
const list = check => (value, path, errors) => {
  if (!Array.isArray(value)) { issue(errors, path, 'type', 'Expected an array'); return; }
  value.forEach((item, index) => check(item, `${path}[${index}]`, errors));
};
function unique(values, path, errors, key = value => value) {
  const seen = new Set();
  values.forEach((value, index) => {
    const identity = key(value);
    if (seen.has(identity)) issue(errors, `${path}[${index}]`, 'duplicate', 'Duplicate identifier or value');
    seen.add(identity);
  });
}
const ids = (value, path, errors) => {
  list(id)(value, path, errors);
  if (Array.isArray(value)) unique(value, path, errors);
};
const actorRef = shape({kind: enumeration(['CLIENT', 'PARTICIPANT']), id});
const actorKey = ref => `${ref.kind}:${ref.id}`;
const purchaseContext = (value, path, errors) => {
  const start = errors.length;
  shape({buyer_ref: actorRef, end_user_refs: list(actorRef), recipient: enumeration(C.RECIPIENTS)})(value, path, errors);
  if (errors.length !== start) return;
  unique(value.end_user_refs, `${path}.end_user_refs`, errors, actorKey);
  const self = value.end_user_refs.some(ref => actorKey(ref) === actorKey(value.buyer_ref));
  const count = value.end_user_refs.length;
  const coherent = {SELF: self && count === 1, THIRD_PARTY: !self && count > 0, UNKNOWN: count === 0, MIXED: self && count > 1};
  if (!coherent[value.recipient]) issue(errors, path, 'recipient', 'Recipient classification contradicts buyer/end users');
};

function typedValue(value, path, errors) {
  const start = errors.length;
  shape({value_type: enumeration(C.VALUE_TYPES), value: () => {}, enum_values: nullable(list(text))})(value, path, errors);
  if (errors.length !== start) return;
  if (value.value_type === 'ENUM') {
    if (!value.enum_values?.length) issue(errors, `${path}.enum_values`, 'enum_values', 'ENUM requires declared values');
    else unique(value.enum_values, `${path}.enum_values`, errors);
  } else if (value.enum_values !== null) issue(errors, `${path}.enum_values`, 'enum_values', 'Only ENUM declares values');
  if (value.value === null) return; // Explicit unknown, never evidence of a known answer.
  const checks = {TEXT: text, NUMBER: number, BOOLEAN: boolean, ENUM: enumeration(value.enum_values || []),
    TEXT_LIST: list(text), ACTOR_REF: actorRef, ACTOR_REFS: list(actorRef), PURCHASE_CONTEXT: purchaseContext};
  checks[value.value_type](value.value, `${path}.value`, errors);
  if (value.value_type === 'ACTOR_REFS' && errors.length === start) unique(value.value, `${path}.value`, errors, actorKey);
}

function validate(input, check, crossCheck) {
  const errors = [];
  json(input, '$', errors);
  if (!errors.length) check(input, '$', errors);
  if (!errors.length && crossCheck) crossCheck(input, '$', errors);
  return Object.freeze({valid: errors.length === 0, errors: snapshot(errors), value: errors.length ? null : snapshot(input)});
}
function requireValid(result) {
  if (result.valid) return result.value;
  const error = new Error(result.errors.map(item => `${item.path}: ${item.message}`).join('\n'));
  error.name = 'DomainValidationError'; error.issues = result.errors;
  throw error;
}
const version = enumeration([C.CONTRACT_VERSION]);
const header = {contract_version: version, content_revision: integer(1)};
const memoryDirective = nullable(shape({memory_type: enumeration(C.MEMORY_TYPES), status: enumeration(C.MEMORY_STATUSES), confidence: descriptive}));
const reference = (exists, path, errors) => { if (!exists) issue(errors, path, 'reference', 'Unresolved or inconsistent reference'); };

module.exports = {own, issue, record, snapshot, shape, nullable, text, descriptive, number, boolean, id, enumeration,
  integer, list, unique, ids, actorRef, actorKey, purchaseContext, typedValue, validate, requireValid, version, header, memoryDirective, reference};

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT, MODULES, fixture, isolatedDomain} = require('./helpers/domain.cjs');
const {runtime, KEY} = require('./helpers/runtime.cjs');
const {headless} = require('./helpers/headless.cjs');

// Snapshot of merged Phase 2 (8420cf3); only checkout CRLF is normalized.
const PROTECTED_ROOTS = [
  "AGENTS.md",
  "app.js",
  "index.html",
  "service-worker.js",
  "manifest.webmanifest",
  "reset-progress.js",
  "styles.css",
  "core-v1.css",
  "data",
  "assets",
  "asset-source",
  "content",
  "visuals",
  "ui",
  "platform",
  "docs/academy-system",
  "docs/PHASE-1-STABILIZATION.md",
  "docs/PHASE-2-SEPARATION.md",
  "engine/state.js",
  "engine/persistence.js",
  "engine/legacy-conversation.js",
  "engine/legacy-scoring.js",
  "engine/session.js",
  "tests/stabilization.test.cjs",
  "tests/service-worker.test.cjs",
  "tests/separation.test.cjs",
  "tests/browser.test.cjs",
  "tests/helpers/runtime.cjs",
  "tests/helpers/headless.cjs"
];
function protectedFingerprint() {
  const files = [];
  function walk(file) {
    if (fs.statSync(path.join(ROOT, file)).isDirectory()) {
      fs.readdirSync(path.join(ROOT, file)).forEach(name => walk(file + '/' + name));
    } else files.push(file);
  }
  PROTECTED_ROOTS.forEach(walk);
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    let bytes = fs.readFileSync(path.join(ROOT, file));
    if (/\.(js|cjs|html|css|md|json|webmanifest|txt|svg|b64)$/.test(file)) {
      bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    }
    hash.update(file + '\0'); hash.update(bytes); hash.update('\0');
  }
  return {count: files.length, hash: hash.digest('hex')};
}

test('Phase 2 runtime, legacy data, assets, CSS, normative files and compatibility tests stay unchanged', () => {
  assert.deepEqual(protectedFingerprint(), {count: 81, hash: 'd5fb00647488db8e09ad0a2c05daf1d06c44afb95e8c53fb2ce071a0a086558f'});
});

test('the domain library is absent from production composition, shell and worker snapshot', () => {
  for (const file of ['app.js', 'index.html', 'service-worker.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const module of MODULES) assert.equal(source.includes(module), false, file + ': ' + module);
    assert.match(source, /phase2-2026-09-15-4/);
  }
  for (const file of MODULES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /\b(window|document|navigator|localStorage|serviceWorker|fetch|setTimeout|Academy)\b/, file);
    assert.doesNotMatch(source, /require\(['"](?:node:|[^.])/, file);
  }
});

test('loading and querying the model beside a live legacy runtime changes no globals, content or progress', () => {
  const r = runtime(), control = runtime();
  for (const h of [r, control]) h.run('startClient(0);beginChat();chooseLine("start:0",actionToken("chat"))');
  const before = r.json('S'), saved = Object.fromEntries(r.storage);
  const globals = Object.keys(r.context).sort(), academy = Object.keys(r.context.Academy).sort();
  const content = r.json('window.SCENARIOS'), clients = r.json('window.CLIENTS');
  const h = isolatedDomain(r.context);
  MODULES.forEach(file => h.load(file));
  const repo = h.load('domain/repository.js').createRepository(fixture());
  const visit = repo.visit('TEST-VISIT-A'), K = h.load('engine/visit-knowledge.js'), D = h.load('engine/decision-sufficiency.js');
  repo.memoryRecord('TEST-MEMORY-A'); repo.snapshot();
  const knowledge = K.initializeKnowledge(visit);
  K.projectSellerKnowledge(visit, knowledge); D.evaluateDecisionSufficiency(visit, knowledge, 'RECOMMEND_PRODUCT');
  assert.deepEqual(Object.keys(r.context).sort(), globals);
  assert.deepEqual(Object.keys(r.context.Academy).sort(), academy);
  assert.deepEqual(r.json('S'), before); assert.deepEqual(Object.fromEntries(r.storage), saved);
  assert.deepEqual(r.json('window.SCENARIOS'), content); assert.deepEqual(r.json('window.CLIENTS'), clients);
  for (const h of [r, control]) { h.advance(); h.run('chooseLine("deep:0",actionToken("chat"))'); }
  assert.deepEqual(r.json('S'), control.json('S'));
  assert.deepEqual(Object.fromEntries(r.storage), Object.fromEntries(control.storage));
});

test('schema-one progress and the existing key round trip without domain fields or extra writes', () => {
  const h = headless(); h.command('startClient', 0); h.command('beginChat');
  h.command('chooseLine', 'start:0', h.session.token('chat'));
  const raw = h.records.get(KEY), writes = h.writes;
  const domain = isolatedDomain(h.context), repo = domain.load('domain/repository.js').createRepository(fixture());
  const K = domain.load('engine/visit-knowledge.js'), visit = repo.visit('TEST-VISIT-A');
  const knowledge = K.initializeKnowledge(visit);
  domain.load('engine/decision-sufficiency.js').evaluateDecisionSufficiency(visit, knowledge, 'RECOMMEND_CATEGORY');
  repo.memoryRecord('TEST-MEMORY-A');
  assert.equal(h.key, 'pitbull-academy-quality-pass-01'); assert.equal(h.snapshot().schemaVersion, 1);
  assert.equal(h.records.size, 1); assert.equal(h.records.get(KEY), raw); assert.equal(h.writes, writes);
  const restored = headless({seed: {[KEY]: raw}});
  assert.equal(restored.records.get(KEY), raw); assert.equal(restored.writes, 0);
  assert.deepEqual(restored.snapshot(), h.snapshot());
  assert.doesNotMatch(raw, /TEST-VISIT|contract_version|known_fact_ids|memory_records/);
});

test('legacy six-case outcome remains identical even when the additive library is loaded', () => {
  const h = headless(), domain = isolatedDomain(h.context);
  MODULES.forEach(file => domain.load(file));
  const actions = ['RECOMMEND_PRODUCT', 'RECOMMEND_CATEGORY', 'RECOMMEND_CATEGORY', 'RECOMMEND_PRODUCT', 'DEFER_SUPPLEMENT', 'RECOMMEND_PRODUCT'];
  h.command('startModule');
  for (let i = 0; i < 6; i++) {
    h.command('startClient', i); h.command('beginChat');
    for (const node of ['start', 'deep', 'last']) { h.command('chooseLine', node + ':0', h.session.token('chat')); h.advance(); }
    h.command('openDecision'); h.command('decide', actions[i], h.session.token('decision'));
    h.advance(700); h.command('commit', h.session.token('reaction'));
    if (i === 2) h.command('bossAnswer', 0, h.session.token('bossCheck'));
  }
  assert.equal(h.snapshot().view, 'final');
  assert.deepEqual(h.json(h.session.summary()), {listen: 81, criterion: 100, conversation: 89, recommendation: 100, total: 93, rank: 'ASESOR'});
});

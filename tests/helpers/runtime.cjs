const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const KEY = 'pitbull-academy-quality-pass-01';
const MARKER = 'pitbull-academy-training-reset-2026-09-13-02';

function runtime({ seed = {}, sources = {}, boot = true, storageFailure = false } = {}) {
  const storage = new Map(Object.entries(seed));
  const nodes = new Map();
  const events = {};
  const timers = [];
  let now = 1_800_000_000_000;
  let failWrites = storageFailure;
  function element(id = '') {
    return {
      id, hidden: false, disabled: false, innerHTML: '', textContent: '', value: '', dataset: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {}, contains() { return false; } },
      parentNode: { insertBefore(n) { nodes.set(n.id, n); } },
      querySelectorAll() { return []; }, querySelector() { return null; },
      addEventListener(type, fn) { this['on' + type] = fn; },
      setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; },
      focus() {}, select() {}, scrollIntoView() {}, remove() { nodes.delete(id); }
    };
  }
  const html = sources['index.html'] || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], element(match[1]));
  const context = {
    console, URL, structuredClone,
    Date: class extends Date { static now() { return now; } },
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem(k, v) { if (failWrites) throw new Error('Storage unavailable'); storage.set(k, String(v)); },
      removeItem(k) { if (failWrites) throw new Error('Storage unavailable'); storage.delete(k); }
    },
    navigator: {},
    document: {
      getElementById: id => nodes.get(id) || null,
      createElement: () => element(),
      querySelectorAll: () => [],
      addEventListener(type, f) { (events[type] ||= []).push(f); }
    },
    setTimeout(f, ms = 0) { timers.push({ f, at: now + ms }); return timers.length; },
    clearTimeout() {}, requestAnimationFrame(f) { f(); },
    addEventListener(type, f) { (events[type] ||= []).push(f); },
    scrollTo() {}, location: { reload() {}, href: 'https://academy.test/' },
    prompt() {}, confirm() { return true; }
  };
  context.window = context;
  vm.createContext(context);
  const files = [...html.matchAll(/<script src="([^"?]+)(?:\?[^" ]*)?"><\/script>/g)].map(m => m[1]);
  for (const file of files) vm.runInContext(sources[file] ?? fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  if (boot) for (const f of events.DOMContentLoaded || []) f();
  return {
    context, nodes, storage, events,
    run(code) { return vm.runInContext(code, context); },
    json(code) { return JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', context)); },
    advance(ms = 1000) {
      now += ms;
      for (let i = 0; i < timers.length;) {
        if (timers[i].at <= now) { const { f } = timers.splice(i, 1)[0]; f(); } else i++;
      }
    },
    failWrites(value) { failWrites = value; }
  };
}

module.exports = { runtime, ROOT, KEY, MARKER };

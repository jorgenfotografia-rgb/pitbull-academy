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
  for (const file of files) {
    let code=sources[file] ?? fs.readFileSync(path.join(ROOT, file), 'utf8');
    // Test-only instrumentation preserves Phase 1's fixture expressions/assertions.
    // None of these writable references or compatibility globals ship to browsers.
    if(file==='engine/session.js')code=code.replace('return Object.freeze({command,snapshot,',
      'globalThis.__fixture={get S(){return S},MP,C,current,persistence,actionToken,scoreSummary,actions};\nreturn Object.freeze({command,snapshot,');
    if(file==='ui/render.js')code=code.replace('return Object.freeze({render,status:persistenceStatus});',
      'globalThis.__renderFixture={render,renderHome,renderMap,renderChat,renderDecision,setPhoto};\nreturn Object.freeze({render,status:persistenceStatus});');
    if(file==='platform/updates.js')code=code.replace('return {applyUpdate};',
      'globalThis.__updateFixture={get registration(){return updateRegistration},set registration(value){updateRegistration=value},get applying(){return applyingUpdate}};\nreturn {applyUpdate};');
    if(file==='app.js')code=code.replace('return Object.freeze({snapshot:',
      'globalThis.__controllerFixture=controller;\nreturn Object.freeze({snapshot:');
    vm.runInContext(code,context,{filename:file});
  }
  if(context.__fixture){
    const fixture=context.__fixture;
    Object.defineProperty(context,'S',{get:()=>fixture.S});
    for(const name of ['MP','C','current','actionToken','scoreSummary'])context[name]=fixture[name];
    context.persistence=fixture.persistence;
    for(const name of Object.keys(fixture.actions))context[name]=(...args)=>context.__controllerFixture.run(name,...args);
    for(const [name,fn] of Object.entries(context.__renderFixture))context[name]=fn;
    for(const name of ['copyPilotResult','sharePilotResult','applyUpdate'])context[name]=(...args)=>context.__controllerFixture.run(name,...args);
    Object.defineProperty(context,'updateRegistration',{get:()=>context.__updateFixture.registration,set:value=>{context.__updateFixture.registration=value}});
    Object.defineProperty(context,'applyingUpdate',{get:()=>context.__updateFixture.applying});
  }
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

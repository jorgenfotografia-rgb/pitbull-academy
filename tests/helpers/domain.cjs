'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const MODULES = ['domain/contracts.js', 'domain/validation.js', 'domain/client-card.js', 'domain/visit-card.js',
  'domain/memory-record.js', 'domain/repository.js', 'engine/visit-knowledge.js', 'engine/decision-sufficiency.js'];
const fixture = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/domain/valid-bundle.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function isolatedDomain(context = vm.createContext({})) {
  const cache = new Map();
  function load(file) {
    if (!MODULES.includes(file)) throw new Error(`Dependency outside domain allowlist: ${file}`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports: {}};
    cache.set(file, module);
    const factory = vm.runInContext(`(function(require,module,exports){\n${fs.readFileSync(path.join(ROOT, file), 'utf8')}\n})`, context, {filename: file});
    factory(request => {
      if (!request.startsWith('.')) throw new Error(`External dependency: ${request}`);
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request)));
    }, module, module.exports);
    return module.exports;
  }
  return {load, context};
}
module.exports = {ROOT, MODULES, fixture, clone, isolatedDomain};

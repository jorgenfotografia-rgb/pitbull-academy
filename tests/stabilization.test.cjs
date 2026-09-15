const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runtime, ROOT, KEY, MARKER } = require('./helpers/runtime.cjs');

function startCase(index = 0) {
  const r = runtime({ seed: { [MARKER]: '1' } });
  // Fixture: earlier cases completed, as required by the sequential map.
  r.run(`MP().completed=Array.from({length:${index}},(_,i)=>i);MP().results=MP().completed.map(i=>({i,name:C()[i].name,action:C()[i].answer,correct:true,scores:{listen:100,criterion:100,conversation:90,recommendation:100}}));S.view='map';startClient(${index});beginChat()`);
  return r;
}
function choice(r, index) {
  r.run(r.context.ACADEMY_PHASE1
    ? `chooseLine(MP().node+':${index}',actionToken('chat'))`
    : `chooseLine(${index})`);
  r.advance();
}
function decision(r, action) {
  if(r.context.ACADEMY_PHASE1)r.run('openDecision()');
  r.run(r.context.ACADEMY_PHASE1
    ? `decide(${JSON.stringify(action)},actionToken('decision'))`
    : `decide(${JSON.stringify(action)})`);
}

test('legacy M01 content remains unchanged (ignoring checkout line endings)', () => {
  const hashes = {
    'data/clients.js': '3e34ce97c90cff0c1cef652a09d8ddc6b06f5e34e273a2fb48afb69e76ddf594',
    'data/modules.js': 'cabdfabb5d00e150ea3ea81588923f823f608f9bf8ba54ec1d0215cc2b5058be',
    'data/products.js': '7a05fcbc58cd7b7b53f2b5dc7c8dadbd155046f8168cf4a9d807e17d78a21c4d'
  };
  for (const [file, expected] of Object.entries(hashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(actual, expected, file);
  }
});

test('effective legacy outcomes for every complete conversation route and terminal action', () => {
  const rows = [];
  for (let c = 0; c < 6; c++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let d = 0; d < 2; d++) {
    for (const action of ['RECOMMEND_PRODUCT', 'RECOMMEND_CATEGORY', 'DEFER_SUPPLEMENT']) {
      const r = startCase(c);
      for (const i of [a, b, d]) choice(r, i);
      if (r.run('!!MP().lostPending')) {
        rows.push([c, a, b, d, action, r.json('MP().lostPending')]);
      } else {
        decision(r, action);
        const pending = r.json('MP().pending');
        delete pending.unlockAt;
        rows.push([c, a, b, d, action, pending]);
      }
    }
  }
  assert.equal(rows.length, 324);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'), 'ab9f435946e2bfe4f12c1777d9aee0db8c570a7cce207001a7af501d41307977');
});

test('effective legacy early outcomes include zero-question override and partial context', () => {
  const rows = [];
  for (let c = 0; c < 6; c++) for (const first of [null, 0, 1, 2]) {
    for (const action of ['RECOMMEND_PRODUCT', 'RECOMMEND_CATEGORY', 'DEFER_SUPPLEMENT']) {
      const r = startCase(c);
      if (first !== null) choice(r, first);
      decision(r, action);
      const pending = r.json('MP().pending');
      delete pending.unlockAt;
      rows.push([c, first, action, pending]);
    }
  }
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'), '05f71570fb7764cfdf4096afb302d21550927744933d3d3c0362254cbf35822c');
});

test('legacy ASK_MORE is non-terminal, including at the end of the fixed tree', () => {
  const r = startCase();
  decision(r, 'ASK_MORE');
  assert.equal(r.run('S.view'), 'chat');
  assert.equal(r.run('MP().pending'), null);
  for (const i of [0, 0, 0]) choice(r, i);
  decision(r, 'ASK_MORE');
  assert.equal(r.run('S.view'), 'chat');
  assert.equal(r.run('MP().node'), 'end');
  assert.equal(r.run('MP().completed.length'), 0);
});

test('legacy aggregate weights, rank boundaries, and Boss Check bonus remain unchanged', () => {
  const r = startCase();
  r.run('MP().results=[{i:0,scores:{listen:40,criterion:60,conversation:80,recommendation:100}}];MP().bossCheck=0');
  assert.deepEqual(r.json('scoreSummary()'), { listen: 40, criterion: 65, conversation: 80, recommendation: 100, total: 70, rank: 'OBSERVADOR' });
  for (const [n, rank] of [[67,'NOVATO'],[68,'OBSERVADOR'],[79,'OBSERVADOR'],[80,'DETECTOR'],[89,'DETECTOR'],[90,'ASESOR']]) {
    r.run(`MP().bossCheck=null;MP().results=[{i:0,scores:{listen:${n},criterion:${n},conversation:${n},recommendation:${n}}}]`);
    assert.equal(r.run('scoreSummary().rank'), rank);
  }
});

test('first intervention keeps opening, facts, rapport, and node in one stable state object', () => {
  const r = startCase();
  assert.equal(r.run('MP()===MP()'), true);
  choice(r, 0);
  assert.deepEqual(r.json('({node:MP().node,facts:MP().discovered,rapport:MP().rapport,who:MP().chat.map(m=>m.who)})'),
    { node: 'deep', facts: ['carga'], rapport: 72, who: ['client', 'you', 'client'] });
});

test('stale option event cannot select an option from the next node', () => {
  const r = startCase();
  const token = r.run("actionToken('chat')");
  r.run(`chooseLine('start:0',${JSON.stringify(token)})`);
  r.advance();
  r.run(`chooseLine('start:0',${JSON.stringify(token)})`);
  r.run(`chooseLine('deep:0',${JSON.stringify(token)})`);
  assert.equal(r.run('MP().node'), 'deep');
  assert.equal(r.run('MP().chat.length'), 3);
});

test('rapid second activation is ignored even if it targets the newly rendered option', () => {
  const r = startCase();
  r.run("chooseLine('start:0',actionToken('chat'));chooseLine('deep:0',actionToken('chat'))");
  assert.equal(r.run('MP().node'), 'deep');
  r.advance(300);
  r.run("chooseLine('deep:0',actionToken('chat'))");
  assert.equal(r.run('MP().node'), 'last');
});

test('no reset marker is required and reload preserves the unfinished conversation', () => {
  const r = startCase();
  choice(r, 0);
  const seed = Object.fromEntries(r.storage);
  delete seed[MARKER];
  const restored = runtime({ seed });
  assert.equal(restored.run('S.view'), 'chat');
  assert.deepEqual(restored.json('MP()'), r.json('MP()'));
  assert.equal(restored.storage.has(MARKER), false);
});

test('returning through the map resumes an unfinished case instead of resetting it', () => {
  const r = startCase();
  choice(r, 0);
  const before = r.json('MP()');
  r.run("show('map');startClient(0)");
  assert.equal(r.run('S.view'), 'chat');
  assert.deepEqual(r.json('MP()'), before);
});

test('reviewing completed cases does not change the active conversation owner', () => {
  const r = startCase(1);
  choice(r, 0);
  const before = r.json('MP()');
  r.run('reviewCompletedCase(0)');
  assert.deepEqual(r.json('MP()'), before);
  const restored = runtime({ seed: Object.fromEntries(r.storage) });
  assert.equal(restored.nodes.get('caseReviewName').textContent, 'Tomás');
  assert.equal(restored.run('MP().current'), 1);
  restored.run('resumeModuleFromHome()');
  assert.equal(restored.run('S.view'), 'chat');
});

test('locked and invalid cases cannot start; incomplete modules cannot finalize', () => {
  const r = startCase();
  const before = r.json('MP()');
  for (const index of [-1, 1, 5, 99]) r.run(`startClient(${index})`);
  assert.deepEqual(r.json('MP()'), before);
  r.run('final()');
  assert.equal(r.run('S.view'), 'map');
  assert.equal(r.run('MP().finishedAt'), null);
});

test('consequence delay and duplicate commits produce exactly one result', () => {
  const r = startCase();
  choice(r, 0);
  decision(r, 'RECOMMEND_PRODUCT');
  const token = r.run("actionToken('reaction')");
  r.run(`commit(${JSON.stringify(token)})`);
  assert.equal(r.run('MP().results.length'), 0);
  r.advance(700);
  assert.equal(r.nodes.get('reactionNext').disabled, false);
  r.run(`commit(${JSON.stringify(token)});commit(${JSON.stringify(token)})`);
  assert.deepEqual(r.json('MP().completed'), [0]);
  assert.equal(r.run('MP().results.length'), 1);
  assert.equal(r.run('MP().pending'), null);
});

test('lost-client completion is idempotent and cannot finalize an incomplete module', () => {
  const r = startCase(3);
  for(const i of [2,2,1])choice(r,i);
  assert.equal(r.run('S.view'), 'reaction');
  const token = r.run("actionToken('reaction')");
  r.run(`commitLost(${JSON.stringify(token)});commitLost(${JSON.stringify(token)})`);
  assert.equal(r.run('MP().results.length'), 4);
  assert.equal(r.run('MP().results[3].action'), 'LOST');
  assert.equal(r.run('S.view'), 'map');
});

test('visual rendering cannot mutate pedagogical state', () => {
  const r = startCase();
  choice(r, 0);
  const before = r.json('MP()');
  r.run("current().visual={face:'missing.svg'};renderHome();renderMap();renderChat();renderDecision();setPhoto('chatAvatar',current())");
  assert.deepEqual(r.json('MP()'), before);
});

test('current runtime does not load or depend on the compatibility reset file', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+reset-progress/);
  const r = startCase();
  choice(r, 0);
  const before = r.json('MP()');
  r.run(fs.readFileSync(path.join(ROOT, 'reset-progress.js'), 'utf8'));
  assert.deepEqual(r.json('MP()'), before);
});

test('migration backs up the exact legacy record and retains the active scoped session', () => {
  const old = startCase();choice(old,0);
  const source=old.json('S');delete source.schemaVersion;
  source.completed=[0,1,2];source.chat=[{who:'client',text:'older legacy conversation'}];
  const raw=JSON.stringify(source);
  const r=runtime({seed:{[KEY]:raw}});
  assert.equal(r.storage.get(KEY+'-before-phase1'),raw);
  assert.equal(r.run('S.schemaVersion'),1);
  assert.equal(r.run('MP().node'),'deep');
  assert.equal(r.run('MP().chat.length'),3);
  assert.equal(r.run('Object.hasOwn(S,"completed")'),false);
});

test('top-level legacy progress is migrated when no active scoped record exists', () => {
  const old=startCase();choice(old,1);
  const r=runtime({seed:{[KEY]:JSON.stringify({view:'chat',...old.json('MP()')})}});
  assert.equal(r.run('MP().node'),'deep');
  assert.deepEqual(r.json('MP().discovered'),['bases']);
});

test('malformed arrays are repaired without discarding valid conversation and results', () => {
  const old=startCase(1);choice(old,0);
  const source=old.json('S');source.moduleProgress.m01.completed='bad';
  const raw=JSON.stringify(source),r=runtime({seed:{[KEY]:raw}});
  assert.deepEqual(r.json('MP().completed'),[0]);
  assert.equal(r.run('MP().chat.length'),3);
  assert.equal(r.storage.get(KEY+'-recovery'),raw);
});

test('invalid JSON and unsupported future schemas are never overwritten by rendering or actions', () => {
  for(const raw of ['{broken',JSON.stringify({schemaVersion:99,moduleProgress:{precious:true}})]){
    const r=runtime({seed:{[KEY]:raw}});
    r.run('render();reset();resetModule();save()');
    assert.equal(r.storage.get(KEY),raw);
    assert.equal(r.nodes.get('storageStatus').hidden,false);
  }
});

test('explicit recovery preserves malformed data before creating a fresh record', () => {
  const r=runtime({seed:{[KEY]:'{broken'}});
  r.run('recoverStorage()');
  assert.equal(r.storage.get(KEY+'-recovery'),'{broken');
  assert.equal(JSON.parse(r.storage.get(KEY)).schemaVersion,1);
  assert.equal(r.run('persistence.issue'),null);
});

test('failed backup prevents migration from overwriting the original', () => {
  const raw=JSON.stringify({view:'home',current:0});
  const r=runtime({seed:{[KEY]:raw},storageFailure:true});
  assert.equal(r.storage.get(KEY),raw);
  assert.equal(r.run('persistence.issue'),'backup');
  r.failWrites(false);r.run('retryPersistence()');
  assert.equal(r.storage.get(KEY+'-before-phase1'),raw);
  assert.equal(JSON.parse(r.storage.get(KEY)).schemaVersion,1);
});

test('failed save leaves active state usable and retry saves the same intervention once', () => {
  const r=startCase(),old=r.storage.get(KEY);
  r.failWrites(true);choice(r,0);
  assert.equal(r.run('MP().node'),'deep');
  assert.equal(r.storage.get(KEY),old);
  assert.equal(r.run('persistence.issue'),'write');
  r.failWrites(false);r.run('retryPersistence()');
  assert.equal(r.run('persistence.issue'),null);
  assert.equal(JSON.parse(r.storage.get(KEY)).moduleProgress.m01.chat.length,3);
});

test('another tab cannot be silently overwritten', () => {
  const r=startCase();
  const other=r.json('S');other.pilotAlias='Other tab';
  const raw=JSON.stringify(other);r.storage.set(KEY,raw);
  choice(r,0);
  assert.equal(r.storage.get(KEY),raw);
  assert.equal(r.run('persistence.issue'),'conflict');
});

test('reset is limited to the selected module and preserves backups and profile', () => {
  const r=startCase();choice(r,0);
  r.run("S.pilotAlias='Seller';S.moduleProgress.future={preserved:true};save()");
  r.storage.set(KEY+'-before-phase1','original');
  r.run('resetModule()');
  assert.equal(r.run('MP().chat.length'),0);
  assert.equal(r.run('S.pilotAlias'),'Seller');
  assert.deepEqual(r.json('S.moduleProgress.future'),{preserved:true});
  assert.equal(r.storage.get(KEY+'-before-phase1'),'original');
});

test('pending normal and lost consequences survive reload and commit once', () => {
  for(const lost of [false,true]){
    const r=startCase(lost?3:0);
    if(lost)for(const i of [2,2,1])choice(r,i);else decision(r,'RECOMMEND_PRODUCT');
    const restored=runtime({seed:Object.fromEntries(r.storage)});restored.advance();
    const token=restored.run("actionToken('reaction')");
    restored.run(`${lost?'commitLost':'commit'}(${JSON.stringify(token)})`);
    assert.equal(restored.run('MP().results.length'),lost?4:1);
    assert.equal(restored.run('MP().pending'),null);
    assert.equal(restored.run('MP().lostPending'),null);
  }
});

test('native sharing failure falls back to clipboard; denied clipboard exposes selectable text', async () => {
  const r=startCase();
  let copied='';r.context.navigator.share=async()=>{throw new Error('share failed')};
  r.context.navigator.clipboard={writeText:async text=>{copied=text}};
  await r.run('sharePilotResult()');
  assert.match(copied,/PITBULL ACADEMY/);
  assert.match(copied,/phase1-2026-09-15-1/);
  r.context.navigator.clipboard.writeText=async()=>{throw new Error('denied')};
  await r.run('copyPilotResult()');
  assert.equal(r.nodes.get('copyFallback').hidden,false);
  assert.equal(r.nodes.get('resultText').value,copied);
});

test('cancelled native share keeps independent copying available', async () => {
  const r=startCase();let copied=false;
  r.context.navigator.share=async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'})};
  r.context.navigator.clipboard={writeText:async()=>{copied=true}};
  await r.run('sharePilotResult()');assert.equal(copied,false);
  await r.run('copyPilotResult()');assert.equal(copied,true);
  assert.equal(r.nodes.get('shareResult').disabled,false);
});

test('an invalid saved case index never attaches an old conversation to another client', () => {
  const old=startCase(1);choice(old,0);
  const source=old.json('S');source.moduleProgress.m01.current=99;
  const raw=JSON.stringify(source),r=runtime({seed:{[KEY]:raw}});
  assert.equal(r.run('MP().chat.length'),0);
  assert.equal(r.run('MP().node'),'start');
  assert.deepEqual(r.json('MP().completed'),[0]);
  assert.equal(r.storage.get(KEY+'-recovery'),raw);
});

test('persisted navigation stages restore without advancing pedagogical progress', () => {
  for(const view of ['home','module','map','case','chat','decision','catalog','product']){
    const r=startCase();choice(r,0);r.run(`show('${view}')`);
    const before=r.json('MP()'),restored=runtime({seed:Object.fromEntries(r.storage)});
    assert.equal(restored.run('S.view'),view,view);
    assert.deepEqual(restored.json('MP()'),before,view);
  }
});

test('Boss Check reload preserves first answer and rejects a queued second answer', () => {
  const r=startCase(2);decision(r,'RECOMMEND_CATEGORY');r.advance();
  r.run("commit(actionToken('reaction'))");
  assert.equal(r.run('S.view'),'bossCheck');
  const restored=runtime({seed:Object.fromEntries(r.storage)});
  const token=restored.run("actionToken('bossCheck')");
  restored.run(`bossAnswer(0,${JSON.stringify(token)});bossAnswer(1,${JSON.stringify(token)})`);
  assert.equal(restored.run('MP().bossCheck'),0);
  const again=runtime({seed:Object.fromEntries(restored.storage)});
  assert.equal(again.run('MP().bossCheck'),0);
  assert.equal(again.run('MP().results.length'),3);
});

test('update activation is blocked when the live state cannot be saved', () => {
  const r=startCase();r.run('let updateMessages=0;updateRegistration={waiting:{postMessage(){updateMessages++}}}');
  r.failWrites(true);choice(r,0);r.run('applyUpdate()');
  assert.equal(r.run('updateMessages'),0);
  assert.equal(r.run('applyingUpdate'),false);
  r.failWrites(false);r.run('retryPersistence();applyUpdate()');
  assert.equal(r.run('updateMessages'),1);
});

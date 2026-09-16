const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {headless}=require('./helpers/headless.cjs');
const {runtime,ROOT,KEY}=require('./helpers/runtime.cjs');

test('engine completes all six legacy cases without any browser globals',()=>{
  const h=headless();
  for(const name of ['window','document','navigator','localStorage','setTimeout','requestAnimationFrame','serviceWorker'])assert.equal(name in h.context,false,name);
  const actions=['RECOMMEND_PRODUCT','RECOMMEND_CATEGORY','RECOMMEND_CATEGORY','RECOMMEND_PRODUCT','DEFER_SUPPLEMENT','RECOMMEND_PRODUCT'];
  h.command('startModule');
  for(let i=0;i<6;i++){
    h.command('startClient',i);h.command('beginChat');
    for(const node of ['start','deep','last']){h.command('chooseLine',node+':0',h.session.token('chat'));h.advance()}
    h.command('openDecision');h.command('decide',actions[i],h.session.token('decision'));
    h.advance(700);h.command('commit',h.session.token('reaction'));
    if(i===2)h.command('bossAnswer',0,h.session.token('bossCheck'));
  }
  assert.equal(h.snapshot().view,'final');
  assert.deepEqual(h.json(h.session.summary()),{listen:81,criterion:100,conversation:89,recommendation:100,total:93,rank:'ASESOR'});
});

test('session snapshots and content queries cannot mutate owning state or another instance',()=>{
  const a=headless(),b=headless();a.command('startClient',0);a.command('beginChat');
  const snapshot=a.session.snapshot();assert.ok(Object.isFrozen(snapshot.moduleProgress.m01.chat));
  assert.throws(()=>snapshot.moduleProgress.m01.chat.push({who:'you',text:'injected'}));
  const c=a.visits.scenario('m01');c.clients[0].nodes.start[0].q=-100;
  a.command('chooseLine','start:0',a.session.token('chat'));
  assert.equal(a.snapshot().moduleProgress.m01.rapport,72);
  assert.equal(b.snapshot().moduleProgress.m01.chat.length,0);
  assert.equal(a.visits.scenario('m01').clients[0].nodes.start[0].q,10);
});

test('content projection preserves every effective legacy field and separates visual metadata',()=>{
  const h=headless(),scenario=h.visits.scenario('m01'),expected=h.json(h.data.SCENARIOS.m01);
  for(const c of scenario.clients)assert.equal('visual' in c,false);
  assert.equal('image' in scenario.bossCheck,false);
  const reconstructed=h.json(scenario);
  reconstructed.clients=reconstructed.clients.map(c=>({...c,visual:h.json(h.legacy.visuals[c.id])}));
  reconstructed.bossCheck.image=h.legacy.bossImages.m01;
  assert.deepEqual(reconstructed,expected);
  assert.deepEqual(Object.keys(h.clients.get('tomas')).sort(),['age','id','name']);
});

test('all renderers and queries leave state, references, revisions, and storage untouched',()=>{
  const r=runtime();r.run('startClient(0);beginChat();chooseLine("start:0",actionToken("chat"))');
  const before=r.json('S'),stored=Object.fromEntries(r.storage),progress=r.run('MP()');
  for(let i=0;i<3;i++)r.run('render();renderHome();renderMap();renderChat();renderDecision();scoreSummary();actionToken()');
  assert.deepEqual(r.json('S'),before);assert.deepEqual(Object.fromEntries(r.storage),stored);assert.equal(r.run('MP()'),progress);
});

test('controller binds once and a delegated click executes one intervention',()=>{
  const r=runtime();r.run('startClient(0);beginChat();__controllerFixture.bind();__controllerFixture.bind()');
  assert.equal(r.events.click.length,1);
  const button={disabled:false,dataset:{action:'chooseLine',args:JSON.stringify(['start:0',r.run('actionToken("chat")')])}};
  r.events.click[0]({target:{closest:()=>button}});
  assert.equal(r.run('MP().chat.length'),3);
});

test('a consequence timer from a reset session cannot enable a new consequence',()=>{
  const r=runtime();r.run('startClient(0);beginChat();openDecision();decide("RECOMMEND_PRODUCT",actionToken("decision"))');
  r.advance(300);r.run('resetModule();startClient(0);beginChat();openDecision();decide("RECOMMEND_PRODUCT",actionToken("decision"))');
  r.advance(400);assert.equal(r.nodes.get('reactionNext').disabled,true);
  r.advance(300);assert.equal(r.nodes.get('reactionNext').disabled,false);
});

test('schema-one records round trip through the separated engine without conversion or backup',()=>{
  const a=headless();a.command('startClient',0);a.command('beginChat');a.command('chooseLine','start:0',a.session.token('chat'));
  const raw=a.records.get(KEY),b=headless({seed:{[KEY]:raw}});
  assert.deepEqual(b.snapshot(),a.snapshot());assert.equal(b.writes,0);
  assert.equal(b.records.size,1);assert.equal(b.snapshot().schemaVersion,1);
});

test('engine and presentation boundaries contain no browser or mutation dependencies',()=>{
  for(const file of fs.readdirSync(path.join(ROOT,'engine'))){
    const text=fs.readFileSync(path.join(ROOT,'engine',file),'utf8');
    assert.doesNotMatch(text,/\b(window|document|navigator|localStorage|serviceWorker)\b/,file);
  }
  const renderer=fs.readFileSync(path.join(ROOT,'ui/render.js'),'utf8');
  assert.doesNotMatch(renderer,/session\.command|\bsave\(|\bmigrate\(|\blocalStorage\b/);
  for(const file of ['app.js','ui/render.js','ui/controller.js'])assert.doesNotMatch(fs.readFileSync(path.join(ROOT,file),'utf8'),/__fixture|__renderFixture|__controllerFixture/);
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.doesNotMatch(html,/\bonclick=|\bonerror=|<script>/);
});

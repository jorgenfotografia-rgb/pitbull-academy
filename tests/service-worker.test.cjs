const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {ROOT}=require('./helpers/runtime.cjs');

function worker({failure,wrongRelease=false}={}){
  const events={},buckets=new Map();let activated=0,claimed=0;
  const scope='https://academy.test/pitbull-academy/';
  const key=request=>typeof request==='string'?request:request.url;
  const caches={
    async open(name){
      if(!buckets.has(name))buckets.set(name,new Map());
      const bucket=buckets.get(name);
      return {
        async match(request){return bucket.get(key(request))?.clone()},
        async put(request,response){bucket.set(key(request),response.clone())}
      };
    },
    async keys(){return [...buckets.keys()]},
    async delete(name){return buckets.delete(name)}
  };
  const context={URL,Request,Response,Headers,TextDecoder,caches,console,
    self:{registration:{scope},location:{origin:'https://academy.test'},
      addEventListener(type,fn){events[type]=fn},
      async skipWaiting(){activated++},clients:{async claim(){claimed++}}},
    async fetch(request){
      const url=key(request),file=url.slice(scope.length);
      if(file===failure)return new Response('missing',{status:404});
      if(!fs.existsSync(path.join(ROOT,file)))throw new Error('Offline');
      let body=fs.readFileSync(path.join(ROOT,file));
      if(wrongRelease&&file==='index.html')body=Buffer.from(body.toString().replace('phase1-2026-09-15-1','wrong-release'));
      return new Response(body,{status:200});
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'service-worker.js'),'utf8'),context);
  return {context,caches,buckets,events,scope,
    async event(type,data={}){let pending;events[type]({...data,waitUntil(p){pending=p}});await pending},
    async fetch(file,mode='cors',destination='script'){
      let response,background;
      events.fetch({request:{method:'GET',url:scope+file,mode,destination},respondWith(p){response=p},waitUntil(p){background=p}});
      const result=await response;await background;return result;
    },
    get activated(){return activated},get claimed(){return claimed}
  };
}

test('a complete validated release installs without immediate activation',async()=>{
  const w=worker();await w.event('install');
  assert.equal(w.activated,0);
  const response=await w.fetch('app.js');
  assert.match(await response.text(),/window.ACADEMY_PHASE1=true/);
  assert.equal(response.status,200);
});

test('failed required asset or mismatched release never publishes a partial snapshot',async()=>{
  for(const options of [{failure:'data/scenarios/m01-legacy-adapter.js'},{wrongRelease:true}]){
    const w=worker(options);
    await assert.rejects(w.event('install'));
    assert.deepEqual(await w.caches.keys(),[]);
  }
});

test('activation deletes only Academy caches and explicit message activates the worker',async()=>{
  const w=worker();await w.event('install');
  await w.caches.open('pitbull-academy-old');await w.caches.open('other-application');
  await w.event('message',{data:{type:'UNRELATED'}});assert.equal(w.activated,0);
  await w.event('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.activated,1);
  await w.event('activate');
  const keys=await w.caches.keys();
  assert.ok(keys.includes('other-application'));
  assert.ok(!keys.includes('pitbull-academy-old'));
  assert.equal(w.claimed,1);
});

test('offline navigation uses the shell; missing scripts and styles never receive HTML',async()=>{
  const w=worker();await w.event('install');w.context.fetch=async()=>{throw new Error('offline')};
  const shell=await w.fetch('deep/link','navigate','document');
  assert.match(await shell.text(),/<!doctype html>/);
  for(const file of ['missing.js','missing.css']){
    const response=await w.fetch(file);
    assert.equal(response.status,503);
    assert.match(response.headers.get('Content-Type'),/text\/plain/);
    assert.doesNotMatch(await response.text(),/<html|<!doctype/);
  }
});

test('runtime network responses cannot replace code within the installed snapshot',async()=>{
  const w=worker();await w.event('install');
  w.context.fetch=async()=>new Response('unexpected next release');
  assert.match(await (await w.fetch('app.js')).text(),/window.ACADEMY_PHASE1=true/);
});

test('error image responses are not persisted',async()=>{
  const w=worker();await w.event('install');let requests=0;
  w.context.fetch=async()=>{requests++;return new Response('bad image',{status:404})};
  await w.fetch('missing.png','cors','image');await w.fetch('missing.png','cors','image');
  assert.equal(requests,2);
});

test('release identity agrees across shell, application and worker',()=>{
  const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  const sw=fs.readFileSync(path.join(ROOT,'service-worker.js'),'utf8');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const release=app.match(/const RELEASE='([^']+)'/)[1];
  assert.equal(sw.match(/const RELEASE='([^']+)'/)[1],release);
  assert.ok(html.includes(`name="academy-release" content="${release}"`));
});

test('asset rebuild workflow references existing inputs and never rewrites application code',()=>{
  const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/rebuild-image-assets.yml'),'utf8');
  assert.doesNotMatch(workflow,/data\/module\.js|sed -i/);
  for(const name of ['glutamina','tiby-boss-check','tiby-boss-review']){
    const chunks=fs.readdirSync(path.join(ROOT,'asset-source')).filter(f=>f.startsWith(name+'.')).sort();
    const decoded=Buffer.from(chunks.map(f=>fs.readFileSync(path.join(ROOT,'asset-source',f),'utf8')).join('').replace(/\s/g,''),'base64');
    assert.deepEqual(decoded,fs.readFileSync(path.join(ROOT,'assets',name+'.webp')));
  }
});

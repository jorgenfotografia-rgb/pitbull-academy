// Optional integration checks: use an existing Playwright installation and browser.
// No browser package is installed or added to this project's dependencies.
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {ROOT,KEY,MARKER}=require('./helpers/runtime.cjs');
let playwright;
try{playwright=require(process.env.ACADEMY_PLAYWRIGHT_PATH||'playwright')}catch{}
const executable=process.env.ACADEMY_BROWSER_EXECUTABLE;
const skip=!playwright?'An existing Playwright runtime is required (ACADEMY_PLAYWRIGHT_PATH).':false;
const BASE='0835cb475ea09958137a3b490749a4daf0a3e3b5';
const release='phase1-2026-09-15-1';

async function setup(t,{legacy=false,viewport={width:390,height:844}}={}){
  let mode=legacy?'legacy':'current';
  const oldFiles=new Map();
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(file.includes('..')||file.startsWith('.')){res.writeHead(404);res.end();return}
    try{
      let body;
      if(mode==='legacy'){
        if(!oldFiles.has(file))oldFiles.set(file,execFileSync('git',['show',`${BASE}:${file}`],{cwd:ROOT,maxBuffer:2_000_000,stdio:['ignore','pipe','ignore']}));
        body=oldFiles.get(file);
      }else{
        body=fs.readFileSync(path.join(ROOT,file));
        if(mode==='next'&&['app.js','service-worker.js','index.html'].includes(file))body=Buffer.from(body.toString().replaceAll(release,release+'-upgrade-test'));
      }
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
    }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('missing')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{browser=await playwright.chromium.launch({headless:true,...(executable?{executablePath:executable}:{})})}
  catch(error){server.close();t.skip('Browser unavailable: '+error.message.split('\n')[0]);return null}
  const context=await browser.newContext({viewport});
  // Do not intercept local worker installation requests: exercise the real network/cache lifecycle.
  await context.route('https://nutribull.com.ar/**',route=>route.abort());
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')t.diagnostic('Browser console: '+message.text())});
  t.after(async()=>{
    if(!page.isClosed())t.diagnostic('Worker state: '+JSON.stringify(await page.evaluate(async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      return {installing:r?.installing?.state,waiting:r?.waiting?.state,active:r?.active?.state,controlled:!!navigator.serviceWorker.controller,caches:await caches.keys()};
    }).catch(()=>({closed:true}))));
    await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  });
  const url=`http://127.0.0.1:${server.address().port}/`;
  return {page,context,url,errors,setMode(value){mode=value}};
}
async function enter(page){if(await page.locator('#splash').isVisible())await page.locator('.splash-enter').click();await page.locator('#splash').waitFor({state:'hidden'})}
async function begin(page,url){
  await page.goto(url);await enter(page);
  await page.locator('#moduleCta').click();await page.locator('#module .primary').click();
  await page.locator('#clientList button').first().click();await page.locator('#case .primary').click();
}
async function choice(page,index=0){
  await page.waitForTimeout(320);
  await page.locator('#choices button').nth(index).click();
}
async function screenshot(page,t,label){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'academy-phase1-'));
  const file=path.join(folder,label+'.png');await page.screenshot({path:file,fullPage:true});t.diagnostic(file);
}

test('mobile: first question, rapid input, reload, and selectable copy fallback',{skip,timeout:60000},async t=>{
  const env=await setup(t);if(!env)return;
  const {page,url,errors}=env;
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new Error('Share failed')}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied')}}});
  });
  await begin(page,url);
  const first=page.locator('#choices button').first();await first.dblclick();
  assert.equal(await page.locator('#thread .bubble.you').count(),1);
  assert.equal(await page.locator('#thread .bubble.client').count(),2);
  await page.reload();await enter(page);
  assert.equal(await page.locator('#thread .bubble.you').count(),1);
  assert.equal(await page.evaluate(()=>MP().node),'deep');
  assert.equal(await page.locator('#storageStatus').isVisible(),false);
  assert.equal(await page.locator('meta[name="viewport"]').getAttribute('content'),'width=device-width,initial-scale=1');
  await screenshot(page,t,'mobile-conversation');
  await page.evaluate(()=>sharePilotResult());
  assert.equal(await page.locator('#copyFallback').getAttribute('hidden'),null);
  assert.match(await page.locator('#resultText').inputValue(),/PITBULL ACADEMY/);
  assert.deepEqual(errors,[]);
});

for(const [label,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  test(`${label}: complete all six legacy cases, Boss Check, final result, review, reset`,{skip,timeout:120000},async t=>{
    const env=await setup(t,{viewport});if(!env)return;
    const {page,url,errors}=env;await begin(page,url);
    const actions=['RECOMMEND_PRODUCT','RECOMMEND_CATEGORY','RECOMMEND_CATEGORY','RECOMMEND_PRODUCT','DEFER_SUPPLEMENT','RECOMMEND_PRODUCT'];
    for(let c=0;c<6;c++){
      if(c){await page.locator('#clientList button').nth(c).click();await page.locator('#case .primary').click()}
      for(let n=0;n<3;n++)await choice(page);
      await page.locator('#resolve').click();
      await page.locator(`#decisionList button[onclick*="${actions[c]}"]`).click();
      assert.equal(await page.locator('#reaction').isVisible(),true);
      await page.locator('#reactionNext').click();
      assert.equal(await page.evaluate(()=>MP().results.length),c+1);
      if(c===2){await page.locator('#bossCheck .choice').first().click();await page.locator('#bossCheck .primary').click()}
    }
    assert.equal(await page.locator('#final').isVisible(),true);
    assert.equal(await page.evaluate(()=>MP().completed.length),6);
    const summary=await page.evaluate(()=>scoreSummary());
    assert.deepEqual(summary,{listen:81,criterion:100,conversation:89,recommendation:100,total:93,rank:'ASESOR'});
    assert.equal(await page.locator('#overall').textContent(),String(summary.total));
    await screenshot(page,t,label+'-result');
    await page.reload();await enter(page);
    assert.deepEqual(await page.evaluate(()=>scoreSummary()),summary);
    await page.locator('#final .actions .secondary').click();
    assert.equal(await page.locator('#reviewList .review-item').count(),6);
    await page.locator('#review .secondary').click();await page.locator('#final .actions .tertiary').click();
    assert.equal(await page.locator('#home').isVisible(),true);
    assert.equal(await page.evaluate(()=>MP().results.length),0);
    assert.deepEqual(errors,[]);
  });
}

test('release upgrade from audited worker preserves progress and unrelated caches; offline works',{skip,timeout:120000},async t=>{
  const env=await setup(t,{legacy:true});if(!env)return;
  const {page,context,url,errors}=env;
  await page.goto(url);
  await page.evaluate(({marker})=>localStorage.setItem(marker,'1'),{marker:MARKER});
  await enter(page);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await enter(page);
  await page.locator('#moduleCta').click();await page.locator('#module .primary').click();
  await page.locator('#clientList button').first().click();await page.locator('#case .primary').click();await choice(page);
  const before=await page.evaluate(()=>({chat:MP().chat,node:MP().node,discovered:MP().discovered,rapport:MP().rapport}));
  const original=await page.evaluate(key=>localStorage.getItem(key),KEY);
  await page.evaluate(()=>caches.open('unrelated-app-cache'));
  env.setMode('current');await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update()});
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  // The audited network-first worker allows the new shell to offer its update control.
  await page.reload();await enter(page);
  // With no remaining old client, navigation itself may allow normal activation.
  const waiting=await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  if(waiting){
    await page.locator('#updateStatus').waitFor({state:'visible'});
    await Promise.all([page.waitForEvent('load'),page.locator('#applyUpdate').click()]);await enter(page);
  }
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.deepEqual(await page.evaluate(()=>({chat:MP().chat,node:MP().node,discovered:MP().discovered,rapport:MP().rapport})),before);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key+'-before-phase1'),KEY),original);
  assert.ok((await page.evaluate(()=>caches.keys())).includes('unrelated-app-cache'));
  await context.setOffline(true);await page.reload();await enter(page);
  assert.equal(await page.locator('#thread .bubble.you').count(),1);
  const missing=await page.evaluate(async()=>{const r=await fetch('not-in-release.js');return {status:r.status,text:await r.text()}});
  assert.equal(missing.status,503);assert.doesNotMatch(missing.text,/<html/);
  assert.deepEqual(errors,[]);
});

test('Phase 1 update waits for explicit activation and preserves a live conversation',{skip,timeout:120000},async t=>{
  const env=await setup(t);if(!env)return;
  const {page,url}=env;await begin(page,url);await choice(page);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  env.setMode('next');await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
  await page.locator('#updateStatus').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>RELEASE),release);
  await Promise.all([page.waitForEvent('load'),page.locator('#applyUpdate').click()]);await enter(page);
  assert.equal(await page.evaluate(()=>RELEASE),release+'-upgrade-test');
  assert.equal(await page.locator('#thread .bubble.you').count(),1);
});

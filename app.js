window.ACADEMY_PHASE1=true;
const RELEASE='phase1-2026-09-15-1';
const BRANDS=window.BRANDS||[];
const PRODUCTS=window.PRODUCTS||[];
const MODULES=window.MODULES||[];
const SCENARIOS=window.SCENARIOS||{};
const SOURCES=window.SOURCES||{};
const A=id=>`assets/${id}`;
const KEY='pitbull-academy-quality-pass-01';
const DEFAULT_MODULE_ID=(MODULES.find(m=>m.status==='active')||MODULES[0]||{}).id||null;
const LEGACY_PROGRESS_KEYS=['current','completed','chat','node','discovered','rapport','results','bossCheck','pending','lostPending','startedAt','finishedAt'];

const blankModuleProgress=()=>({current:0,completed:[],chat:[],node:'start',discovered:[],rapport:62,results:[],bossCheck:null,pending:null,lostPending:null,startedAt:null,finishedAt:null,revision:0});
const SCHEMA_VERSION=1;
const BACKUP_KEY=KEY+'-before-phase1';
const RECOVERY_KEY=KEY+'-recovery';
const persistence={lastStored:null,issue:null};
const fresh=()=>({schemaVersion:SCHEMA_VERSION,storageRevision:0,view:'home',selectedModule:DEFAULT_MODULE_ID,selectedProduct:'glutamina-300g',catalogBrand:'all',pilotAlias:'',moduleProgress:{}});
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const list=x=>Array.isArray(x)?x:[];
const validScores=x=>record(x)&&['listen','criterion','conversation','recommendation'].every(k=>Number.isFinite(x[k])&&x[k]>=0&&x[k]<=100);
function uniqueResults(results=[]){
  const byCase=new Map();
  list(results).forEach(r=>{if(r&&Number.isInteger(r.i))byCase.set(r.i,r)});
  return [...byCase.values()].sort((a,b)=>a.i-b.i);
}
function normalizeProgress(input={},moduleId=DEFAULT_MODULE_ID){
  const source=record(input)?input:{},p={...blankModuleProgress(),...source};
  const m=MODULES.find(m=>m.id===moduleId),scenario=SCENARIOS[m?.scenarioId],clients=scenario?.clients||[];
  const validIndex=i=>Number.isInteger(i)&&i>=0&&i<clients.length;
  const validAction=a=>a==='LOST'||m?.decisionActions?.some(x=>x.id===a);
  p.results=uniqueResults(list(p.results).filter(r=>record(r)&&validIndex(r.i)&&validAction(r.action)&&validScores(r.scores)))
    .map(r=>({...r,name:clients[r.i].name,correct:!!r.correct}));
  // A completion without its result cannot be reconstructed without inventing a score.
  p.completed=p.results.map(r=>r.i);
  const validCurrent=validIndex(p.current);
  p.current=validCurrent?p.current:Math.max(0,clients.findIndex((c,i)=>!p.completed.includes(i)));
  p.chat=list(p.chat).filter(x=>record(x)&&['you','client'].includes(x.who)&&typeof x.text==='string'&&(x.q===undefined||Number.isFinite(x.q)));
  const c=clients[p.current];
  p.discovered=[...new Set(list(p.discovered).filter(f=>typeof f==='string'&&c?.facts.includes(f)))];
  p.rapport=Number.isFinite(p.rapport)?Math.max(0,Math.min(100,p.rapport)):62;
  p.revision=Number.isSafeInteger(p.revision)&&p.revision>=0?p.revision:0;
  p.bossCheck=Number.isInteger(p.bossCheck)&&scenario?.bossCheck?.options[p.bossCheck]?p.bossCheck:null;
  p.startedAt=Number.isFinite(p.startedAt)&&p.startedAt>0?p.startedAt:null;
  p.finishedAt=Number.isFinite(p.finishedAt)&&p.finishedAt>0&&p.completed.length===clients.length?p.finishedAt:null;
  const pending=p.pending;
  p.pending=record(pending)&&validAction(pending.action)&&pending.action!=='ASK_MORE'&&pending.action!=='LOST'&&validScores(pending.sc)
    &&['good','mid','bad'].includes(pending.strength)&&['title','note','copy'].every(k=>typeof pending[k]==='string')
    ?{...pending,unlockAt:Number.isFinite(pending.unlockAt)?pending.unlockAt:0}:null;
  p.lostPending=record(p.lostPending)&&validScores(p.lostPending.scores)?p.lostPending:null;
  if(p.pending)p.lostPending=null;
  if(p.completed.includes(p.current)){p.pending=null;p.lostPending=null}
  if(!validCurrent||!c||!(p.node==='end'||Object.hasOwn(c.nodes,p.node))){
    p.node='start';p.chat=[];p.discovered=[];p.rapport=62;p.pending=null;p.lostPending=null;
  }
  // Never silently reconstruct a broken conversation's scoring from prose.
  if(p.chat.some(x=>x.who==='you')===false&&p.node!=='start'&&!p.pending&&!p.lostPending){
    p.node='start';p.discovered=[];p.rapport=62;
  }
  return p;
}
function hasActivity(p){return record(p)&&(list(p.completed).length||list(p.results).length||list(p.chat).length||p.pending||p.lostPending||p.startedAt)}
function migrate(raw={}){
  if(!record(raw))throw new Error('invalid storage record');
  if(raw.schemaVersion!==undefined&&raw.schemaVersion!==SCHEMA_VERSION)throw new Error('unsupported schema');
  const next={...fresh(),...raw,schemaVersion:SCHEMA_VERSION};
  next.moduleProgress=record(raw.moduleProgress)?{...raw.moduleProgress}:{};
  if(raw.schemaVersion===undefined&&DEFAULT_MODULE_ID){
    const legacy=Object.fromEntries(LEGACY_PROGRESS_KEYS.filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
    const scoped=next.moduleProgress[DEFAULT_MODULE_ID];
    // An existing active module record is authoritative; never rank two divergent sessions by length.
    next.moduleProgress[DEFAULT_MODULE_ID]=hasActivity(scoped)?scoped:hasActivity(legacy)?legacy:scoped||{};
  }
  LEGACY_PROGRESS_KEYS.forEach(k=>{delete next[k]});
  for(const m of MODULES)next.moduleProgress[m.id]=normalizeProgress(next.moduleProgress[m.id],m.id);
  if(!MODULES.some(m=>m.id===next.selectedModule))next.selectedModule=DEFAULT_MODULE_ID;
  if(!PRODUCTS.some(p=>p.id===next.selectedProduct))next.selectedProduct=PRODUCTS[0]?.id||null;
  if(typeof next.pilotAlias!=='string')next.pilotAlias='';
  if(typeof next.catalogBrand!=='string')next.catalogBrand='all';
  if(!['home','module','map','catalog','product','case','caseReview','chat','decision','reaction','bossCheck','final','review'].includes(next.view))next.view='home';
  next.storageRevision=Number.isSafeInteger(next.storageRevision)&&next.storageRevision>=0?next.storageRevision:0;
  return next;
}
function keepOriginal(raw,key){
  if(raw!==null&&localStorage.getItem(key)===null)localStorage.setItem(key,raw);
}
function load(){
  let raw=null;
  try{raw=localStorage.getItem(KEY);persistence.lastStored=raw}catch(e){persistence.issue='read';return fresh()}
  if(raw===null)return migrate({});
  let parsed;
  try{parsed=JSON.parse(raw);if(!record(parsed))throw new Error('invalid record')}
  catch(e){persistence.issue='corrupt';return migrate({})}
  if(parsed.schemaVersion!==undefined&&parsed.schemaVersion!==SCHEMA_VERSION){persistence.issue='future';return migrate({})}
  const next=migrate(parsed);
  // Preserve the exact original before any version conversion or structural repair.
  if(JSON.stringify(next)!==JSON.stringify(parsed)){
    try{keepOriginal(raw,parsed.schemaVersion===undefined?BACKUP_KEY:RECOVERY_KEY)}
    catch(e){persistence.issue='backup'}
  }
  return next;
}
let S=load();
let actionEpoch=0;
let choiceLockedUntil=0;
let reviewedCase=null;
function actionToken(view=S.view){return `${actionEpoch}:${S.selectedModule}:${MP().current}:${MP().revision||0}:${MP().node}:${view}`}
function acceptsAction(token,view){return !['corrupt','future','conflict','read','backup'].includes(persistence.issue)&&S.view===view&&token===actionToken(view)}
function changed(p=MP()){p.revision=(p.revision||0)+1}
function moduleComplete(p=MP()){return C().length>0&&C().every((c,i)=>p.completed.includes(i)&&p.results.some(r=>r.i===i))}
function nextCaseIndex(p=MP()){return C().findIndex((c,i)=>!p.completed.includes(i))}
function canStartCase(i,p=MP()){return Number.isInteger(i)&&i===nextCaseIndex(p)}
function persistenceStatus(){
  const box=el('storageStatus');if(!box)return;
  const issue=persistence.issue;box.hidden=!issue;
  const messages={
    read:'No pudimos leer tu progreso. La sesión sigue abierta; reintentá antes de cerrar.',
    write:'No pudimos guardar el último cambio. La sesión sigue abierta; reintentá antes de cerrar.',
    backup:'No pudimos respaldar tu progreso anterior. No se sobrescribió el guardado.',
    corrupt:'El progreso guardado necesita recuperación. Conservamos el original sin sobrescribirlo.',
    future:'Este progreso pertenece a otra versión. No se sobrescribió el guardado.',
    conflict:'El progreso cambió en otra pestaña. Cargá ese guardado para continuar sin sobrescribirlo.'
  };
  el('storageMessage').textContent=messages[issue]||'';
  el('retryStorage').hidden=!['read','write','backup'].includes(issue);
  el('reloadStorage').hidden=issue!=='conflict';
  el('recoverStorage').hidden=issue!=='corrupt';
}
function save(){
  if(persistence.issue&&persistence.issue!=='write'){persistenceStatus();return false}
  try{
    if(localStorage.getItem(KEY)!==persistence.lastStored){persistence.issue='conflict';persistenceStatus();return false}
    if(JSON.stringify(S)===persistence.lastStored){persistence.issue=null;persistenceStatus();return true}
    const previous=S.storageRevision||0;S.storageRevision=previous+1;
    try{const serialized=JSON.stringify(S);localStorage.setItem(KEY,serialized);persistence.lastStored=serialized}
    catch(e){S.storageRevision=previous;throw e}
    persistence.issue=null;persistenceStatus();return true;
  }catch(e){persistence.issue='write';persistenceStatus();return false}
}
function retryPersistence(){
  const issue=persistence.issue;
  if(issue==='read'){
    if(!window.confirm('Se volverá a cargar el progreso guardado. Los cambios de esta sesión que no se pudieron guardar se descartarán. ¿Continuar?'))return;
    persistence.issue=null;S=load();actionEpoch++;render();return;
  }
  if(issue==='backup'){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw!==persistence.lastStored){persistence.issue='conflict';persistenceStatus();return}
      keepOriginal(raw,JSON.parse(raw).schemaVersion===undefined?BACKUP_KEY:RECOVERY_KEY);
    }catch(e){persistenceStatus();return}
  }
  if(['write','backup'].includes(issue)){persistence.issue=null;save()}
}
function reloadSavedProgress(){
  if(window.confirm('Se cargará el progreso de la otra pestaña. Los cambios locales que no se guardaron se descartarán. ¿Continuar?'))window.location.reload();
}
function recoverStorage(){
  if(persistence.issue!=='corrupt'||!window.confirm('¿Crear un progreso nuevo? Primero conservaremos una copia del guardado que no se pudo leer.'))return;
  try{
    const raw=localStorage.getItem(KEY);
    if(raw!==persistence.lastStored){persistence.issue='conflict';persistenceStatus();return}
    // Keep each explicitly replaced malformed record, even if an older recovery exists.
    const key=localStorage.getItem(RECOVERY_KEY)===null?RECOVERY_KEY:RECOVERY_KEY+'-'+Date.now();
    localStorage.setItem(key,raw);
    persistence.issue=null;S=migrate({});actionEpoch++;save();render();
  }catch(e){persistence.issue='corrupt';persistenceStatus()}
}
function reset(){
  if(persistence.issue){persistenceStatus();return}
  S=migrate({});actionEpoch++;choiceLockedUntil=0;save();render();
}
function resetModule(){
  const m=activeModule();if(!m)return;
  if(persistence.issue){persistenceStatus();return}
  S.moduleProgress[m.id]=blankModuleProgress();actionEpoch++;choiceLockedUntil=0;S.view='home';save();render();
}
function tap(){try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}}
function el(id){return document.getElementById(id)}
function brandById(id){return BRANDS.find(b=>b.id===id)}
function productById(id){return PRODUCTS.find(p=>p.id===id)}
function moduleById(id){return MODULES.find(m=>m.id===id)}
function activeModule(){return moduleById(S.selectedModule)||moduleById(DEFAULT_MODULE_ID)||MODULES[0]}
function activeScenario(){const m=activeModule();return m?SCENARIOS[m.scenarioId]:null}
function ensureProgress(){const m=activeModule();if(!m)return blankModuleProgress();if(!S.moduleProgress[m.id])S.moduleProgress[m.id]=blankModuleProgress();return S.moduleProgress[m.id]}
function MP(){return ensureProgress()}
function C(){return activeScenario()?.clients||[]}
function current(){return C()[MP().current]}
function selectedProduct(){return productById(S.selectedProduct)||PRODUCTS[0]}
function discoveredSet(){return new Set(MP().discovered||[])}
function clientVisual(c,kind='face'){return c?.visual?.[kind]||c?.visual?.face||A(`${c.id}.svg`)}
function setPhoto(id,c,kind='face'){const node=el(id);if(!node||!c)return;node.src=clientVisual(c,kind);node.alt=c.visual?`${c.name} · referencia visual piloto`:c.name}
function productModules(p){return (p.moduleIds||[]).map(moduleById).filter(Boolean)}
function modulePrimaryProduct(m=activeModule()){return productById((m?.productIds||[])[0])}
function brandCount(){return new Set(PRODUCTS.map(p=>p.brandId).filter(Boolean)).size}

function enterAcademy(){tap();const splash=el('splash');if(!splash)return;splash.classList.add('splash-out');window.setTimeout(()=>{splash.hidden=true;splash.classList.remove('splash-out')},220)}
function syncTopline(view){
  const m=activeModule();
  const libraryMode=view==='catalog'||view==='product';
  const moduleMode=['module','map','case','caseReview','chat','decision','reaction','bossCheck','final','review'].includes(view);
  el('appcode').textContent=libraryMode?'PITBULL ACADEMY · BIBLIOTECA':moduleMode&&m?`PITBULL ACADEMY · ${m.code}`:'PITBULL ACADEMY';
  el('moduleMeter').style.visibility=moduleMode?'visible':'hidden';
}
function show(id,{scroll=true}={}){document.querySelectorAll('.screen').forEach(x=>x.hidden=true);el(id).hidden=false;S.view=id;syncTopline(id);save();if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
function updateMeter(){const m=activeModule(),p=MP();if(!m)return;const total=activeScenario()?.clients?.length||m.clientCount||0,done=p.completed.length,pct=total?Math.max(0,Math.min(1,done/total)):0;el('moduleMeter').style.setProperty('--p',`${pct*360}deg`);el('moduleMeterText').textContent=`${done}/${total}`}

function render(){
  ensureProgress();
  renderHome();
  updateMeter();
  renderMap();
  renderCatalog();
  resumeView();
}
function renderHome(){
  const m=activeModule(),p=MP(),total=activeScenario()?.clients?.length||m?.clientCount||0;
  if(!m)return;
  el('moduleTitle').textContent=m.title;
  el('moduleSubtitle').textContent=m.subtitle;
  el('moduleMeta').textContent=`${m.code} · ${total} CASOS`;
  el('moduleScope').textContent=`COMPETENCIA · ${m.competence}`;
  el('moduleProgress').style.width=`${total?Math.round((p.completed.length/total)*100):0}%`;
  el('resumeText').textContent=p.completed.length?`${p.completed.length}/${total} casos completados`:'Listo para comenzar';
  el('moduleCta').textContent=p.completed.length?'CONTINUAR ENTRENAMIENTO':'ENTRAR AL MÓDULO';
  el('productCount').textContent=PRODUCTS.length;
  el('brandCount').textContent=brandCount();
}
function resumeView(){
  const v=S.view||'home';
  if(v==='home'||v==='module'||v==='map'||v==='catalog'){if(v==='catalog')renderCatalog();if(v==='module')renderModule();show(v,{scroll:false});return}
  if(v==='product'){renderProduct(false);return}
  if(v==='case'){renderCase(false);return}
  if(v==='caseReview'){reviewCompletedCase(Number.isInteger(S.reviewedCase)?S.reviewedCase:MP().current,{scroll:false});return}
  if(v==='chat'&&MP().chat?.length){renderChat({scroll:false});return}
  if(v==='decision'){renderDecision();show('decision',{scroll:false});return}
  if(v==='reaction'){if(MP().pending){renderReaction({scroll:false});return}if(MP().lostPending){renderLostReaction({scroll:false});return}}
  if(v==='bossCheck'){renderBossCheck({scroll:false});return}
  if(v==='final'&&MP().results?.length){final({scroll:false});return}
  if(v==='review'&&MP().results?.length){review({scroll:false});return}
  show('home',{scroll:false});
}
function chooseModule(id){if(!moduleById(id))return;S.selectedModule=id;ensureProgress();save();renderHome();updateMeter()}
function openModule(){tap();renderModule();show('module')}
function resumeModuleFromHome(){
  tap();
  const p=MP(),total=C().length;
  if(moduleComplete(p)){final();return}
  if(p.pending){renderReaction();return}
  if(p.lostPending){renderLostReaction();return}
  if(p.chat.length&&!p.completed.includes(p.current)){renderChat();return}
  if(p.completed.length>0){renderMap();show('map');return}
  openModule();
}
function startModule(){tap();const p=MP();if(!p.startedAt)p.startedAt=Date.now();save();renderMap();show('map')}
function renderModule(){
  const m=activeModule(),p=modulePrimaryProduct(m);if(!m)return;
  el('moduleEyebrow').textContent=`${m.code} · ${m.competence}`;
  el('moduleHeading').textContent=m.title;
  if(p){
    const brand=brandById(p.brandId)?.name||p.brandId;
    el('moduleProductImage').src=p.image;el('moduleProductImage').alt=p.name;
    el('moduleProductBrand').textContent='PRODUCTO DE REFERENCIA';
    el('moduleProductName').textContent=p.name;
    el('moduleProductNote').textContent=`${brand} · Categoría: ${p.shortName||p.category}`;
  }
  el('moduleTrainingPoints').innerHTML=(m.trainingPoints||[]).map(x=>`<div class="point">${x}</div>`).join('');
  el('moduleStatusNote').textContent=m.contentStatus==='audited'
    ?'Contenido auditado para entrenamiento.'
    :m.contentStatus==='prepilot-reviewed'
      ?'Versión PRE-PILOT. El contenido fue revisado con un enfoque prudente: el producto puede entrar en una conversación, pero no se presenta como una respuesta automática ni como indicación clínica.'
      :'Contenido de entrenamiento en revisión. La auditoría documental se completa antes de marcar el módulo como definitivo.';
}

function catalogProducts(){return S.catalogBrand==='all'?PRODUCTS:PRODUCTS.filter(p=>p.brandId===S.catalogBrand)}
function renderCatalogFilters(){
  const root=el('catalogFilters');if(!root)return;
  const ids=[...new Set(PRODUCTS.map(p=>p.brandId))];
  root.innerHTML=[{id:'all',name:'TODOS'},...ids.map(id=>({id,name:brandById(id)?.name||id}))].map(b=>`<button class="filter-chip ${S.catalogBrand===b.id?'is-active':''}" onclick="setCatalogBrand('${b.id}')">${b.name}</button>`).join('');
}
function setCatalogBrand(id){tap();S.catalogBrand=id;save();renderCatalog()}
function renderCatalog(){
  if(!el('productList'))return;
  renderCatalogFilters();
  const list=catalogProducts();
  el('catalogSummary').textContent=`${PRODUCTS.length} productos · ${brandCount()} ${brandCount()===1?'marca':'marcas'} · ${MODULES.filter(m=>m.status==='active').length} módulo activo`;
  el('productList').innerHTML=list.map(p=>{
    const brand=brandById(p.brandId)?.name||p.brandId,mods=productModules(p),active=mods.some(m=>m.status==='active');
    return `<button class="product-row" onclick="openProduct('${p.id}')">
      <span class="product-thumb"><img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.visibility='hidden'"></span>
      <span class="product-row-copy">
        <span class="product-row-meta">${brand} · ${p.category}</span>
        <strong>${p.name}</strong>
        <span class="small">${active?`${mods.find(m=>m.status==='active').code} · MÓDULO ACTIVO`:'CATÁLOGO'}</span>
      </span>
      <span class="product-row-arrow">→</span>
    </button>`;
  }).join('');
}
function openCatalog(){tap();renderCatalog();show('catalog')}
function openProduct(id){tap();S.selectedProduct=id;save();renderProduct(true)}
function renderProduct(scroll=true){
  const p=selectedProduct();if(!p){openCatalog();return}
  const img=el('productImage');img.src=p.image;img.alt=p.name;img.style.visibility='visible';img.onerror=()=>{img.style.visibility='hidden'};
  const brand=brandById(p.brandId),mods=productModules(p),active=mods.find(m=>m.status==='active');
  el('productBrand').textContent=brand?.name||p.brandId;
  el('productName').textContent=p.name;
  el('productSummary').textContent=p.catalogNote||'Producto incorporado a la biblioteca de Academy.';
  el('productCategory').textContent=p.category;
  el('productPresentation').textContent=p.presentation;
  el('productFormat').textContent=`${p.package} · ${p.type}`;
  el('productFlavors').textContent=(p.flavors||[]).join(' · ');
  el('productStatus').textContent=active?`${active.code} · MÓDULO ACTIVO`:'PRODUCTO INCORPORADO';
  el('productStatus').className=`product-status ${active?'is-active':''}`;
  const source=SOURCES[p.sourceId];
  el('productSource').textContent=source?`${source.name} · ${source.roleLabel}`:'Fuente de catálogo registrada';
  el('productAudit').textContent=p.auditStatus==='audited'?'Información técnica auditada':'Información técnica pendiente de auditoría';
  const btn=el('productModuleButton');btn.disabled=!active;btn.className=(active?'primary':'secondary')+' product-module-button';btn.innerHTML=active?`<span>ENTRAR AL MÓDULO ${active.code}</span><span>→</span>`:'<span>SIN MÓDULO ACTIVO</span><span>·</span>';
  show('product',{scroll});
}
function openProductModule(){const p=selectedProduct(),m=productModules(p).find(x=>x.status==='active');if(!m)return;chooseModule(m.id);openModule()}

function renderMap(){
  const m=activeModule(),clients=C(),p=MP();if(!m||!el('clientList'))return;updateMeter();
  el('mapMeta').textContent=`SIMULADOR · ${clients.length} CASOS`;
  el('clientList').innerHTML=clients.map((c,i)=>{
    const done=p.completed.includes(i),unlocked=done||canStartCase(i,p);
    const action=done?`reviewCompletedCase(${i})`:`startClient(${i})`;
    return `<button class="cast-item ${done?'is-complete':''}" ${unlocked?'':'disabled'} onclick="${action}">
      <img class="client-photo" src="${clientVisual(c,'face')}" alt="${c.name} · referencia visual piloto">
      <div><span class="num">${String(i+1).padStart(2,'0')} · ${done?'COMPLETADO':'CLIENTE'}</span><strong>${c.name}</strong><span class="small">${c.label}${!done&&c.bossChallenge?' · Boss Challenge':''}</span>${done?'<span class="review-tag">REVISAR CASO</span>':''}</div>
      <span class="arrow">${done?'✓':unlocked?'→':'·'}</span>
    </button>`;
  }).join('');
}
function startClient(i){
  const p=MP();
  if(p.completed.includes(i)){reviewCompletedCase(i);return}
  if(!canStartCase(i,p))return;
  tap();
  if(p.current===i&&(p.chat.length||p.pending||p.lostPending)){
    if(p.pending)renderReaction();else if(p.lostPending)renderLostReaction();else renderChat();
    return;
  }
  if(!p.startedAt)p.startedAt=Date.now();
  p.current=i;p.chat=[];p.node='start';p.discovered=[];p.rapport=62;p.pending=null;p.lostPending=null;
  actionEpoch++;changed(p);save();renderCase(true);
}
function caseResult(i){return uniqueResults(MP().results).find(r=>r.i===i)}
function reviewCompletedCase(i,{scroll=true}={}){
  const p=MP(),c=C()[i],result=caseResult(i);if(!c||!p.completed.includes(i)){renderMap();show('map',{scroll});return}
  reviewedCase=i;S.reviewedCase=i;save();setPhoto('caseReviewAvatar',c);
  el('caseReviewNum').textContent=`CASO ${String(i+1).padStart(2,'0')} · COMPLETADO`;
  el('caseReviewName').textContent=c.name;
  el('caseReviewLabel').textContent=c.label;
  el('caseReviewQuote').textContent=`“${c.intro}”`;
  const actions=Object.fromEntries((activeModule().decisionActions||[]).map(a=>[a.id,actionLabel(a)]));actions.LOST='CLIENTE PERDIDO';
  el('caseReviewDecision').textContent=result?actions[result.action]||result.action:'Caso completado';
  const score=result?Math.round((result.scores.listen+result.scores.criterion+result.scores.conversation+result.scores.recommendation)/4):null;
  el('caseReviewScore').textContent=score!==null?`${score} pts`:'—';
  el('caseReviewLearning').textContent=c.explain;
  show('caseReview',{scroll});
}
function renderCase(scroll=true){const p=MP(),c=current(),total=C().length,n=p.current+1;if(!c){renderMap();show('map',{scroll});return}setPhoto('caseAvatar',c);el('caseNum').textContent=`CASO ${String(n).padStart(2,'0')} DE ${String(total).padStart(2,'0')}`;el('caseName').textContent=c.name;el('caseAge').textContent=c.age;el('caseLabel').textContent=c.label;el('caseQuote').textContent=`“${c.intro}”`;show('case',{scroll})}
function beginChat(){if(S.view!=='case')return;const p=MP(),c=current();if(!c||p.completed.includes(p.current))return;tap();if(!p.chat.length){p.chat=[{who:'client',text:c.intro}];changed(p)}save();renderChat()}
function rtxt(q){if(q>=8)return['La conversación gana confianza.','good'];if(q<=-15)return['La conversación se enfría.','bad'];if(q<0)return['La pregunta llega algo pronto.','bad'];return['La conversación continúa.','']}
function followConversation(){requestAnimationFrame(()=>{const bubbles=[...el('thread').querySelectorAll('.bubble')],last=bubbles[bubbles.length-1];if(last)last.scrollIntoView({behavior:'smooth',block:'center'})})}
function renderChat({scroll=true,follow=false}={}){
  const p=MP(),c=current();setPhoto('chatAvatar',c);el('chatName').textContent=c.name;el('chatLabel').textContent=c.label;
  el('thread').innerHTML=p.chat.map(m=>{const rx=m.q!==undefined?rtxt(m.q):null;return `<div class="bubble ${m.who==='client'?'client':'you'}">${m.text}</div>${rx?`<div class="reaction ${rx[1]}">${rx[0]}</div>`:''}`}).join('');
  const opts=c.nodes[p.node]||[];el('choices').innerHTML=opts.map((o,i)=>`<button class="choice" data-intervention="${p.node}:${i}" onclick="chooseLine('${p.node}:${i}','${actionToken('chat')}')">${o.t}</button>`).join('');
  const turns=p.chat.filter(x=>x.who==='you').length,ready=turns>=2;el('resolve').className=(ready?'primary':'secondary')+' resolve';el('resolve').innerHTML=`<span>${ready?'TOMAR DECISIÓN':'RESOLVER AHORA'}</span><span>→</span>`;save();show('chat',{scroll});if(follow)followConversation();
}
function chooseLine(interventionId,token){
  if(!acceptsAction(token,'chat')||Date.now()<choiceLockedUntil)return;
  const p=MP(),c=current();if(!c||p.completed.includes(p.current)||p.pending||p.lostPending)return;
  const [node,index]=String(interventionId).split(':');
  if(node!==p.node||!/^\d+$/.test(index))return;
  const o=c.nodes?.[node]?.[Number(index)];if(!o)return;
  const key=(o.t||'').trim();
  if(p.chat.some(m=>m.who==='you'&&(m.text||'').trim()===key))return;
  tap();choiceLockedUntil=Date.now()+300;
  const d=new Set(p.discovered);
  p.chat.push({who:'you',text:o.t},{who:'client',text:o.r,q:o.q});
  (o.facts||[]).forEach(f=>d.add(f));p.discovered=[...d];
  p.rapport=Math.max(0,Math.min(100,p.rapport+o.q));p.node=o.next||node;
  changed(p);save();
  if(p.rapport<22){lost();return}
  renderChat({scroll:false,follow:true});
}
function actionLabel(a){const prod=modulePrimaryProduct();if(a.labelFromProduct&&prod){const base=prod.shortName?.toUpperCase()||prod.name.toUpperCase();return `${a.prefix||''}${base}`.trim()}return a.label}
function renderDecision(){
  const m=activeModule(),c=current();
  if(c){setPhoto('decisionAvatar',c);el('decisionName').textContent=c.name;el('decisionLabel').textContent=c.label}
  el('decisionList').innerHTML=(m.decisionActions||[]).map(a=>`<button type="button" class="decision" onclick="decide('${a.id}','${actionToken('decision')}')"><b>${actionLabel(a)}</b><span>${a.hint}</span></button>`).join('');
}
function openDecision(){if(S.view!=='chat'||MP().pending||MP().lostPending||MP().completed.includes(MP().current))return;tap();renderDecision();show('decision')}
function calc(action){const p=MP(),c=current(),d=discoveredSet(),listen=Math.min(100,Math.round([...d].filter(x=>c.facts.includes(x)).length/Math.max(1,c.facts.length)*100));return{listen,criterion:action===c.answer?100:(action==='ASK_MORE'&&listen<67?78:35),conversation:p.rapport,recommendation:action===c.answer?100:(action==='ASK_MORE'&&listen<67?75:30)}}
function decide(action,token){
  if(!acceptsAction(token,'decision'))return;
  const p=MP(),c=current();if(!c||p.pending||p.lostPending||p.completed.includes(p.current))return;
  if(!activeModule().decisionActions.some(a=>a.id===action))return;
  tap();
  if(action==='ASK_MORE'){changed(p);renderChat();return}
  const adapter=window.LEGACY_SCENARIO_ADAPTERS?.[activeScenario().compatibilityAdapter];
  if(!adapter)throw new Error('Missing legacy scenario compatibility adapter');
  const outcome=adapter.decision({action,client:c,scores:calc(action),turns:p.chat.filter(x=>x.who==='you').length});
  p.pending={...outcome,unlockAt:Date.now()+(activeScenario().consequenceDelayMs||0)};
  p.lostPending=null;changed(p);save();renderReaction();
}
function renderReaction({scroll=true}={}){
  const p=MP(),c=current(),o=p.pending;if(!o){renderMap();show('map',{scroll});return}
  setPhoto('reactAvatar',c,'reaction');el('reactName').textContent=c.name;
  el('clientLine').textContent=`“${o.copy}”`;el('learning').className=`learning ${o.strength}`;
  el('resultTitle').textContent=o.title;el('resultNote').textContent=o.note;el('learnText').textContent=c.explain;
  const next=el('reactionNext'),token=actionToken('reaction');next.disabled=true;
  next.onclick=()=>commit(token);
  show('reaction',{scroll});
  const wait=Math.max(0,(o.unlockAt||0)-Date.now());
  window.setTimeout(()=>{if(S.view==='reaction'&&MP().pending===o&&actionToken('reaction')===token)next.disabled=false},wait);
}
function upsertResult(result){const p=MP();p.results=uniqueResults([...(p.results||[]).filter(r=>r.i!==result.i),result])}
function completeCase(result,p){
  upsertResult(result);p.completed=[...new Set([...p.completed,p.current])].sort((a,b)=>a-b);
  p.pending=null;p.lostPending=null;changed(p);
  if(moduleComplete(p)&&!p.finishedAt)p.finishedAt=Date.now();
  save();updateMeter();
  if(p.current===activeScenario().bossCheck?.afterCaseIndex&&p.bossCheck===null){renderBossCheck();return}
  if(moduleComplete(p)){final();return}
  renderMap();show('map');
}
function commit(token){
  if(!acceptsAction(token,'reaction'))return;
  const p=MP(),c=current(),o=p.pending;
  if(!o||p.completed.includes(p.current)||Date.now()<(o.unlockAt||0))return;
  tap();completeCase({i:p.current,name:c.name,action:o.action,correct:o.correct,scores:o.sc},p);
}
function lost(){const p=MP();p.lostPending={scores:calc('LOST')};p.pending=null;changed(p);save();renderLostReaction()}
function renderLostReaction({scroll=true}={}){
  const c=current();setPhoto('reactAvatar',c);el('reactName').textContent=c.name;
  el('clientLine').textContent='“Lo voy a pensar. Gracias.”';el('learning').className='learning bad';
  el('resultTitle').textContent='Cliente perdido';
  el('resultNote').textContent='La conversación se volvió comercial antes de que el cliente sintiera que estabas intentando entenderlo.';
  el('learnText').textContent='La calidad de una recomendación también depende de cómo construís confianza.';
  const next=el('reactionNext'),token=actionToken('reaction');next.disabled=false;next.onclick=()=>commitLost(token);show('reaction',{scroll});
}
function commitLost(token){
  if(!acceptsAction(token,'reaction'))return;
  const p=MP(),c=current(),lp=p.lostPending;if(!lp||p.completed.includes(p.current))return;
  tap();completeCase({i:p.current,name:c.name,action:'LOST',correct:false,scores:lp.scores},p);
}
function renderBossCheck({scroll=true}={}){
  const p=MP(),bc=activeScenario()?.bossCheck;if(!bc){renderMap();show('map',{scroll});return}
  if(p.bossCheck===null){el('bossCheckBody').innerHTML=`<div class="boss-hero"><img src="${A(bc.image)}" alt="Tiby The Boss"><div class="boss-copy"><p class="eyebrow">THE BOSS CHECK</p><h2>${bc.title}</h2><p class="lead">“${bc.prompt}”</p><div class="choice-list">${bc.options.map((o,i)=>`<button class="choice" onclick="bossAnswer(${i},'${actionToken('bossCheck')}')">${o.text}</button>`).join('')}</div><div class="signature">TIBY · THE BOSS</div></div></div>`}else{renderBossCheckResult(p.bossCheck)}show('bossCheck',{scroll});
}
function renderBossCheckResult(index){const bc=activeScenario().bossCheck,ok=bc.options[index]?.correct;el('bossCheckBody').innerHTML=`<div class="boss-hero"><img src="${A(bc.image)}" alt="Tiby The Boss"><div class="boss-copy"><p class="eyebrow">THE BOSS CHECK</p><h2>${ok?bc.result.goodTitle:bc.result.badTitle}</h2><p class="muted">${ok?bc.result.goodText:bc.result.badText}</p><div class="signature">TIBY · THE BOSS</div></div></div><div class="actions"><button class="primary" onclick="renderMap();show('map')"><span>SEGUIR</span><span>→</span></button></div>`}
function bossAnswer(index,token){const p=MP();if(!acceptsAction(token,'bossCheck')||p.bossCheck!==null||!activeScenario().bossCheck?.options[index])return;tap();p.bossCheck=index;changed(p);save();renderBossCheckResult(index)}
function scoreSummary(){
  const p=MP(),rs=uniqueResults(p.results),avg=k=>Math.round(rs.reduce((a,r)=>a+r.scores[k],0)/Math.max(1,rs.length));
  let listen=avg('listen'),criterion=avg('criterion'),conversation=avg('conversation'),recommendation=avg('recommendation');
  const bc=activeScenario()?.bossCheck;if(bc&&p.bossCheck!==null&&bc.options[p.bossCheck]?.correct)criterion=Math.min(100,criterion+5);
  const total=Math.round(listen*.27+criterion*.28+conversation*.20+recommendation*.25);
  const rank=total>=90?'ASESOR':total>=80?'DETECTOR':total>=68?'OBSERVADOR':'NOVATO';
  return{listen,criterion,conversation,recommendation,total,rank};
}
function final({scroll=true}={}){
  const p=MP();if(!moduleComplete(p)){renderMap();show('map',{scroll});return}
  const s=scoreSummary();
  el('overall').textContent=s.total;el('sListen').textContent=s.listen;el('sCriterion').textContent=s.criterion;el('sConversation').textContent=s.conversation;el('sRecommendation').textContent=s.recommendation;el('rank').textContent=s.rank;
  const w=[['ESCUCHA',s.listen],['CRITERIO',s.criterion],['CONVERSACIÓN',s.conversation],['RECOMENDACIÓN',s.recommendation]].sort((a,b)=>a[1]-b[1])[0][0];
  const verdict={ESCUCHA:'Sabés decidir mejor de lo que todavía sabés descubrir. Hacé aparecer la información antes de cerrar.',CRITERIO:'Escuchás señales, pero falta convertirlas en una decisión más precisa.',CONVERSACIÓN:'La lectura está, pero algunas preguntas llegan antes de tiempo.',RECOMENDACIÓN:'Entendés al cliente; ahora afiná la acción final.'}[w];
  el('reviewImage').src=A('tiby-boss-review.webp');el('verdict').textContent=`“${verdict}”`;
  const input=el('pilotAlias');if(input)input.value=S.pilotAlias||'';
  show('final',{scroll});
}
function pilotDuration(){const p=MP();if(!p.startedAt||!p.finishedAt)return null;return Math.max(1,Math.round((p.finishedAt-p.startedAt)/60000))}
function pilotResultText(){
  const m=activeModule(),s=scoreSummary(),mins=pilotDuration(),alias=(el('pilotAlias')?.value||S.pilotAlias||'Piloto').trim()||'Piloto';
  S.pilotAlias=alias;save();
  return `PITBULL ACADEMY · PRE-PILOT\n${alias}\n${m.code} · ${m.title}\nGeneral: ${s.total}\nEscucha: ${s.listen}\nCriterio: ${s.criterion}\nConversación: ${s.conversation}\nRecomendación: ${s.recommendation}${mins?`\nDuración: ${mins} min`:''}\nCasos: ${MP().completed.length}/${C().length}\nBuild: CORE V1.1 · ${RELEASE}`;
}
let sharingResult=false;
function copyFeedback(message){const status=el('copyStatus');if(status)status.textContent=message}
async function copyPilotResult(text=pilotResultText()){
  tap();
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);copyFeedback('Resultado copiado.');
    el('copyFallback').hidden=true;return true;
  }catch(e){
    const box=el('copyFallback'),field=el('resultText');
    field.value=text;box.hidden=false;field.focus();field.select();
    copyFeedback('Seleccioná y copiá el texto del resultado.');return false;
  }
}
async function sharePilotResult(){
  if(sharingResult)return;
  sharingResult=true;tap();const text=pilotResultText(),btn=el('shareResult');if(btn)btn.disabled=true;
  try{
    if(navigator.share){
      try{await navigator.share({title:'Pitbull Academy · Resultado PRE-PILOT',text});return}
      catch(e){if(e.name==='AbortError'){copyFeedback('Podés usar COPIAR RESULTADO cuando quieras.');return}}
    }
    await copyPilotResult(text);
  }finally{sharingResult=false;if(btn)btn.disabled=false}
}
function review({scroll=true}={}){
  const p=MP(),actions=Object.fromEntries((activeModule().decisionActions||[]).map(a=>[a.id,actionLabel(a)]));actions.LOST='Cliente perdido';
  el('reviewList').innerHTML=uniqueResults(p.results).map(x=>{const n=Math.round((x.scores.listen+x.scores.criterion+x.scores.conversation+x.scores.recommendation)/4);return `<div class="review-item"><div class="review-top"><strong>${String(x.i+1).padStart(2,'0')} · ${x.name}</strong><span class="review-score">${n}</span></div><p class="small">${actions[x.action]||x.action} · ${x.correct?'lectura alineada':'a revisar'}</p></div>`}).join('');
  show('review',{scroll});
}

window.addEventListener('DOMContentLoaded',render);
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){if(event.newValue!==persistence.lastStored){persistence.issue='conflict';persistenceStatus()}}});
window.addEventListener('beforeunload',event=>{if(persistence.issue){event.preventDefault();event.returnValue=''}});

let updateRegistration=null;
let applyingUpdate=false;
function showUpdate(registration){updateRegistration=registration;const box=el('updateStatus');if(box)box.hidden=false}
function applyUpdate(){
  if(applyingUpdate||!save())return;
  applyingUpdate=true;
  if(updateRegistration?.waiting)updateRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  else window.location.reload();
}
if('serviceWorker' in navigator){
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(applyingUpdate){window.location.reload();return}
    if(hadController)showUpdate(updateRegistration);
    hadController=true;
  });
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
      updateRegistration=registration;
      if(registration.waiting)showUpdate(registration);
      registration.addEventListener('updatefound',()=>{
        const installing=registration.installing;
        installing?.addEventListener('statechange',()=>{
          if(installing.state==='installed'&&navigator.serviceWorker.controller)showUpdate(registration);
        });
      });
      await registration.update();
    }catch(e){/* Existing/offline training remains available. */}
  });
}

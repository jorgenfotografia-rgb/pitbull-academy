'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.createRenderer=function({session,modules,visits,catalog,visuals,effects,document}){

const MODULES=modules.all(),PRODUCTS=catalog.products(),BRANDS=catalog.brands(),SOURCES=catalog.sources();
const SCENARIOS=Object.fromEntries(MODULES.map(m=>[m.scenarioId,visits.scenario(m.scenarioId)]));
const DEFAULT_MODULE_ID=(MODULES.find(m=>m.status==='active')||MODULES[0]||{}).id;
const A=id=>'assets/'+id;
let S=session.snapshot();
const uniqueResults=rs=>[...new Map(rs.map(r=>[r.i,r])).values()].sort((a,b)=>a.i-b.i);
const MP=()=>S.moduleProgress[S.selectedModule];
const scoreSummary=()=>session.summary();
const actionToken=view=>session.token(view);
const moduleComplete=()=>session.complete();
const canStartCase=i=>session.canStartCase(i);
function clientVisual(c,kind='face'){return visuals.client(c?.id,kind)}
function setPhoto(id,c,kind='face'){const node=el(id);if(!node||!c)return;node.src=clientVisual(c,kind);node.alt=visuals.isPilot(c.id)?c.name+' · referencia visual piloto':c.name}
function show(id,{scroll=true}={}){document.querySelectorAll('.screen').forEach(x=>x.hidden=true);el(id).hidden=false;syncTopline(id);if(scroll)effects.scrollTop()}
function openCatalog(){renderCatalog();show('catalog')}
function el(id){return document.getElementById(id)}
function brandById(id){return BRANDS.find(b=>b.id===id)}
function productById(id){return PRODUCTS.find(p=>p.id===id)}
function moduleById(id){return MODULES.find(m=>m.id===id)}
function activeModule(){return moduleById(S.selectedModule)||moduleById(DEFAULT_MODULE_ID)||MODULES[0]}
function activeScenario(){const m=activeModule();return m?SCENARIOS[m.scenarioId]:null}
function C(){return activeScenario()?.clients||[]}
function current(){return C()[MP().current]}
function selectedProduct(){return productById(S.selectedProduct)||PRODUCTS[0]}
function productModules(p){return (p.moduleIds||[]).map(moduleById).filter(Boolean)}
function modulePrimaryProduct(m=activeModule()){return productById((m?.productIds||[])[0])}
function brandCount(){return new Set(PRODUCTS.map(p=>p.brandId).filter(Boolean)).size}
function syncTopline(view){
  const m=activeModule();
  const libraryMode=view==='catalog'||view==='product';
  const moduleMode=['module','map','case','caseReview','chat','decision','reaction','bossCheck','final','review'].includes(view);
  el('appcode').textContent=libraryMode?'PITBULL ACADEMY · BIBLIOTECA':moduleMode&&m?`PITBULL ACADEMY · ${m.code}`:'PITBULL ACADEMY';
  el('moduleMeter').style.visibility=moduleMode?'visible':'hidden';
}
function updateMeter(){const m=activeModule(),p=MP();if(!m||!p)return;const total=activeScenario()?.clients?.length||m.clientCount||0,done=p.completed.length,pct=total?Math.max(0,Math.min(1,done/total)):0;el('moduleMeter').style.setProperty('--p',`${pct*360}deg`);el('moduleMeterText').textContent=`${done}/${total}`}
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
  root.innerHTML=[{id:'all',name:'TODOS'},...ids.map(id=>({id,name:brandById(id)?.name||id}))].map(b=>`<button class="filter-chip ${S.catalogBrand===b.id?'is-active':''}" data-action="setCatalogBrand" data-args='["${b.id}"]'>${b.name}</button>`).join('');
}
function renderCatalog(){
  if(!el('productList'))return;
  renderCatalogFilters();
  const list=catalogProducts();
  el('catalogSummary').textContent=`${PRODUCTS.length} productos · ${brandCount()} ${brandCount()===1?'marca':'marcas'} · ${MODULES.filter(m=>m.status==='active').length} módulo activo`;
  el('productList').innerHTML=list.map(p=>{
    const brand=brandById(p.brandId)?.name||p.brandId,mods=productModules(p),active=mods.some(m=>m.status==='active');
    return `<button class="product-row" data-action="openProduct" data-args='["${p.id}"]'>
      <span class="product-thumb"><img src="${p.image}" alt="${p.name}" loading="lazy" data-hide-on-error></span>
      <span class="product-row-copy">
        <span class="product-row-meta">${brand} · ${p.category}</span>
        <strong>${p.name}</strong>
        <span class="small">${active?`${mods.find(m=>m.status==='active').code} · MÓDULO ACTIVO`:'CATÁLOGO'}</span>
      </span>
      <span class="product-row-arrow">→</span>
    </button>`;
  }).join('');
}
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
function renderMap(){
  const m=activeModule(),clients=C(),p=MP();if(!m||!el('clientList'))return;updateMeter();
  el('mapMeta').textContent=`SIMULADOR · ${clients.length} CASOS`;
  el('clientList').innerHTML=clients.map((c,i)=>{
    const done=p.completed.includes(i),unlocked=done||canStartCase(i,p);
    const action=done?'reviewCompletedCase':'startClient';
    return `<button class="cast-item ${done?'is-complete':''}" ${unlocked?'':'disabled'} data-action="${action}" data-args='[${i}]'>
      <img class="client-photo" src="${clientVisual(c,'face')}" alt="${c.name} · referencia visual piloto">
      <div><span class="num">${String(i+1).padStart(2,'0')} · ${done?'COMPLETADO':'CLIENTE'}</span><strong>${c.name}</strong><span class="small">${c.label}${!done&&c.bossChallenge?' · Boss Challenge':''}</span>${done?'<span class="review-tag">REVISAR CASO</span>':''}</div>
      <span class="arrow">${done?'✓':unlocked?'→':'·'}</span>
    </button>`;
  }).join('');
}
function caseResult(i){return uniqueResults(MP().results).find(r=>r.i===i)}
function reviewCompletedCase(i,{scroll=true}={}){
  const p=MP(),c=C()[i],result=caseResult(i);if(!c||!p.completed.includes(i)){renderMap();show('map',{scroll});return}
  setPhoto('caseReviewAvatar',c);
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
function rtxt(q){if(q>=8)return['La conversación gana confianza.','good'];if(q<=-15)return['La conversación se enfría.','bad'];if(q<0)return['La pregunta llega algo pronto.','bad'];return['La conversación continúa.','']}
function renderChat({scroll=true,follow=false}={}){
  const p=MP(),c=current();setPhoto('chatAvatar',c);el('chatName').textContent=c.name;el('chatLabel').textContent=c.label;
  el('thread').innerHTML=p.chat.map(m=>{const rx=m.q!==undefined?rtxt(m.q):null;return `<div class="bubble ${m.who==='client'?'client':'you'}">${m.text}</div>${rx?`<div class="reaction ${rx[1]}">${rx[0]}</div>`:''}`}).join('');
  const opts=c.nodes[p.node]||[];el('choices').innerHTML=opts.map((o,i)=>`<button class="choice" data-intervention="${p.node}:${i}" data-action="chooseLine" data-args='["${p.node}:${i}","${actionToken('chat')}"]'>${o.t}</button>`).join('');
  const turns=p.chat.filter(x=>x.who==='you').length,ready=turns>=2;el('resolve').className=(ready?'primary':'secondary')+' resolve';el('resolve').innerHTML=`<span>${ready?'TOMAR DECISIÓN':'RESOLVER AHORA'}</span><span>→</span>`;show('chat',{scroll});if(follow)effects.followConversation();
}
function actionLabel(a){const prod=modulePrimaryProduct();if(a.labelFromProduct&&prod){const base=prod.shortName?.toUpperCase()||prod.name.toUpperCase();return `${a.prefix||''}${base}`.trim()}return a.label}
function renderDecision(){
  const m=activeModule(),c=current();
  if(c){setPhoto('decisionAvatar',c);el('decisionName').textContent=c.name;el('decisionLabel').textContent=c.label}
  el('decisionList').innerHTML=(m.decisionActions||[]).map(a=>`<button type="button" class="decision" data-action="decide" data-args='["${a.id}","${actionToken('decision')}"]'><b>${actionLabel(a)}</b><span>${a.hint}</span></button>`).join('');
}
function renderReaction({scroll=true}={}){
  const p=MP(),c=current(),o=p.pending;if(!o){renderMap();show('map',{scroll});return}
  setPhoto('reactAvatar',c,'reaction');el('reactName').textContent=c.name;
  el('clientLine').textContent=`“${o.copy}”`;el('learning').className=`learning ${o.strength}`;
  el('resultTitle').textContent=o.title;el('resultNote').textContent=o.note;el('learnText').textContent=c.explain;
  const next=el('reactionNext'),token=actionToken('reaction');next.disabled=true;
  next.dataset.action='commit';next.dataset.args=JSON.stringify([token]);
  show('reaction',{scroll});
  const wait=Math.max(0,(o.unlockAt||0)-Date.now());
  effects.later(()=>{if(session.snapshot().view==='reaction'&&session.snapshot().moduleProgress[S.selectedModule]?.pending?.unlockAt===o.unlockAt&&actionToken('reaction')===token)next.disabled=false},wait);
}
function renderLostReaction({scroll=true}={}){
  const c=current();setPhoto('reactAvatar',c);el('reactName').textContent=c.name;
  el('clientLine').textContent='“Lo voy a pensar. Gracias.”';el('learning').className='learning bad';
  el('resultTitle').textContent='Cliente perdido';
  el('resultNote').textContent='La conversación se volvió comercial antes de que el cliente sintiera que estabas intentando entenderlo.';
  el('learnText').textContent='La calidad de una recomendación también depende de cómo construís confianza.';
  const next=el('reactionNext'),token=actionToken('reaction');next.disabled=false;next.dataset.action='commitLost';next.dataset.args=JSON.stringify([token]);show('reaction',{scroll});
}
function renderBossCheck({scroll=true}={}){
  const p=MP(),bc=activeScenario()?.bossCheck;if(!bc){renderMap();show('map',{scroll});return}
  if(p.bossCheck===null){el('bossCheckBody').innerHTML=`<div class="boss-hero"><img src="${visuals.boss(activeModule().scenarioId)}" alt="Tiby The Boss"><div class="boss-copy"><p class="eyebrow">THE BOSS CHECK</p><h2>${bc.title}</h2><p class="lead">“${bc.prompt}”</p><div class="choice-list">${bc.options.map((o,i)=>`<button class="choice" data-action="bossAnswer" data-args='[${i},"${actionToken('bossCheck')}"]'>${o.text}</button>`).join('')}</div><div class="signature">TIBY · THE BOSS</div></div></div>`}else{renderBossCheckResult(p.bossCheck)}show('bossCheck',{scroll});
}
function renderBossCheckResult(index){const bc=activeScenario().bossCheck,ok=bc.options[index]?.correct;el('bossCheckBody').innerHTML=`<div class="boss-hero"><img src="${visuals.boss(activeModule().scenarioId)}" alt="Tiby The Boss"><div class="boss-copy"><p class="eyebrow">THE BOSS CHECK</p><h2>${ok?bc.result.goodTitle:bc.result.badTitle}</h2><p class="muted">${ok?bc.result.goodText:bc.result.badText}</p><div class="signature">TIBY · THE BOSS</div></div></div><div class="actions"><button class="primary" data-action="show" data-args='["map"]'><span>SEGUIR</span><span>→</span></button></div>`}
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
function review({scroll=true}={}){
  const p=MP(),actions=Object.fromEntries((activeModule().decisionActions||[]).map(a=>[a.id,actionLabel(a)]));actions.LOST='Cliente perdido';
  el('reviewList').innerHTML=uniqueResults(p.results).map(x=>{const n=Math.round((x.scores.listen+x.scores.criterion+x.scores.conversation+x.scores.recommendation)/4);return `<div class="review-item"><div class="review-top"><strong>${String(x.i+1).padStart(2,'0')} · ${x.name}</strong><span class="review-score">${n}</span></div><p class="small">${actions[x.action]||x.action} · ${x.correct?'lectura alineada':'a revisar'}</p></div>`}).join('');
  show('review',{scroll});
}
function persistenceStatus(){
  const box=el('storageStatus');if(!box)return;
  const issue=session.status().issue;box.hidden=!issue;
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
function render(options={scroll:false}){
  S=session.snapshot();
  renderHome();updateMeter();renderMap();renderCatalog();persistenceStatus();
  const view=S.view;
  if(view==='module')renderModule();
  else if(view==='product')renderProduct(false);
  else if(view==='case')renderCase(false);
  else if(view==='caseReview')reviewCompletedCase(S.reviewedCase,{scroll:false});
  else if(view==='chat')renderChat({scroll:false});
  else if(view==='decision')renderDecision();
  else if(view==='reaction'){if(MP().pending)renderReaction({scroll:false});else renderLostReaction({scroll:false})}
  else if(view==='bossCheck')renderBossCheck({scroll:false});
  else if(view==='final')final({scroll:false});
  else if(view==='review')review({scroll:false});
  show(view,{scroll:options.scroll===true});
  if(options.follow)effects.followConversation();
}
return Object.freeze({render,status:persistenceStatus});

};

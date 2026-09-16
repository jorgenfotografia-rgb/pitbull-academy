'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.createSession=function({state,storage,modules,visits,adapters,now=()=>Date.now()}){

const MODULES=modules.all(),SCENARIOS=Object.fromEntries(MODULES.map(m=>[m.scenarioId,visits.scenario(m.scenarioId)]));
const {KEY,BACKUP_KEY,RECOVERY_KEY,DEFAULT_MODULE_ID,blankModuleProgress,uniqueResults,migrate}=state;
const store=Academy.createPersistence({state,storage});
const persistence=store.status,{load,keepOriginal}=store;
let S=state.current=load(),actionEpoch=0;
const timing={choiceLockedUntil:0};
let effects={};
function save(){return store.save()}
function tap(){effects.tapped=true}
function show(view,{scroll=true}={}){S.view=view;effects.scroll=scroll;save()}
function presentCase(scroll=true){show('case',{scroll})}
function presentProduct(scroll=true){show('product',{scroll})}
function returnToChat({scroll=true,follow=false}={}){show('chat',{scroll});effects.follow=follow}
function showConsequence(options){if(MP().pending)show('reaction',options);else show('map',options)}
function showLostConsequence(options){show('reaction',options)}
function showBossCheck(options){show(activeScenario()?.bossCheck?'bossCheck':'map',options)}
function final(options){show(moduleComplete()?'final':'map',options)}
function review(options){show('review',options)}
function resume(){resumeView()}
function ensureProgress(){const m=activeModule();if(m&&!S.moduleProgress[m.id])S.moduleProgress[m.id]=blankModuleProgress()}
function MP(){return S.moduleProgress[activeModule()?.id]}
function actionToken(view=S.view){return `${actionEpoch}:${S.selectedModule}:${MP().current}:${MP().revision||0}:${MP().node}:${view}`}
function acceptsAction(token,view){return !['corrupt','future','conflict','read','backup'].includes(persistence.issue)&&S.view===view&&token===actionToken(view)}
function changed(p=MP()){p.revision=(p.revision||0)+1}
function moduleComplete(p=MP()){return C().length>0&&C().every((c,i)=>p.completed.includes(i)&&p.results.some(r=>r.i===i))}
function nextCaseIndex(p=MP()){return C().findIndex((c,i)=>!p.completed.includes(i))}
function canStartCase(i,p=MP()){return Number.isInteger(i)&&i===nextCaseIndex(p)}
function reset(){
  if(persistence.issue){return}
  state.current=S=migrate({});actionEpoch++;timing.choiceLockedUntil=0;save();resume();
}
function resetModule(){
  const m=activeModule();if(!m)return;
  if(persistence.issue){return}
  S.moduleProgress[m.id]=blankModuleProgress();actionEpoch++;timing.choiceLockedUntil=0;S.view='home';save();resume();
}
function moduleById(id){return MODULES.find(m=>m.id===id)}
function activeModule(){return moduleById(S.selectedModule)||moduleById(DEFAULT_MODULE_ID)||MODULES[0]}
function activeScenario(){const m=activeModule();return m?SCENARIOS[m.scenarioId]:null}
function C(){return activeScenario()?.clients||[]}
function current(){return C()[MP().current]}
function caseResult(i){return uniqueResults(MP().results).find(r=>r.i===i)}
function upsertResult(result){const p=MP();p.results=uniqueResults([...(p.results||[]).filter(r=>r.i!==result.i),result])}
function completeCase(result,p){
  upsertResult(result);p.completed=[...new Set([...p.completed,p.current])].sort((a,b)=>a-b);
  p.pending=null;p.lostPending=null;changed(p);
  if(moduleComplete(p)&&!p.finishedAt)p.finishedAt=now();
  save();
  if(p.current===activeScenario().bossCheck?.afterCaseIndex&&p.bossCheck===null){showBossCheck();return}
  if(moduleComplete(p)){final();return}
  show('map');
}
function chooseModule(id){if(!moduleById(id))return;S.selectedModule=id;ensureProgress();save()}
function openModule(){tap();show('module')}
function resumeModuleFromHome(){
  tap();
  const p=MP(),total=C().length;
  if(moduleComplete(p)){final();return}
  if(p.pending){showConsequence();return}
  if(p.lostPending){showLostConsequence();return}
  if(p.chat.length&&!p.completed.includes(p.current)){returnToChat();return}
  if(p.completed.length>0){show('map');return}
  openModule();
}
function startModule(){tap();const p=MP();if(!p.startedAt)p.startedAt=now();save();show('map')}
function startClient(i){
  const p=MP();
  if(p.completed.includes(i)){reviewCompletedCase(i);return}
  if(!canStartCase(i,p))return;
  tap();
  if(p.current===i&&(p.chat.length||p.pending||p.lostPending)){
    if(p.pending)showConsequence();else if(p.lostPending)showLostConsequence();else returnToChat();
    return;
  }
  if(!p.startedAt)p.startedAt=now();
  p.current=i;p.chat=[];p.node='start';p.discovered=[];p.rapport=62;p.pending=null;p.lostPending=null;
  actionEpoch++;changed(p);save();presentCase(true);
}
function openDecision(){if(S.view!=='chat'||MP().pending||MP().lostPending||MP().completed.includes(MP().current))return;tap();show('decision')}
function bossAnswer(index,token){const p=MP();if(!acceptsAction(token,'bossCheck')||p.bossCheck!==null||!activeScenario().bossCheck?.options[index])return;tap();p.bossCheck=index;changed(p);save();showBossCheck()}
function pilotDuration(){const p=MP();if(!p.startedAt||!p.finishedAt)return null;return Math.max(1,Math.round((p.finishedAt-p.startedAt)/60000))}
const legacyScoring=Academy.legacyScoring();
function calc(action){return legacyScoring.calc(action,MP(),current())}
function scoreSummary(){return legacyScoring.scoreSummary(MP(),activeScenario())}
function resumeView(){
  const v=S.view||'home';
  if(v==='home'||v==='module'||v==='map'||v==='catalog'){show(v,{scroll:false});return}
  if(v==='product'){presentProduct(false);return}
  if(v==='case'){presentCase(false);return}
  if(v==='caseReview'){reviewCompletedCase(Number.isInteger(S.reviewedCase)?S.reviewedCase:MP().current,{scroll:false});return}
  if(v==='chat'&&MP().chat?.length){returnToChat({scroll:false});return}
  if(v==='decision'){show('decision',{scroll:false});return}
  if(v==='reaction'){if(MP().pending){showConsequence({scroll:false});return}if(MP().lostPending){showLostConsequence({scroll:false});return}}
  if(v==='bossCheck'){showBossCheck({scroll:false});return}
  if(v==='final'&&MP().results?.length){final({scroll:false});return}
  if(v==='review'&&MP().results?.length){review({scroll:false});return}
  show('home',{scroll:false});
}
function recoverStorage(){
  if(persistence.issue!=='corrupt')return;
  try{
    const raw=storage.getItem(KEY);
    if(raw!==persistence.lastStored){persistence.issue='conflict';return}
    // Keep each explicitly replaced malformed record, even if an older recovery exists.
    const key=storage.getItem(RECOVERY_KEY)===null?RECOVERY_KEY:RECOVERY_KEY+'-'+now();
    storage.setItem(key,raw);
    persistence.issue=null;state.current=S=migrate({});actionEpoch++;save();resume();
  }catch(e){persistence.issue='corrupt';}
}
function retryPersistence(){
  const issue=persistence.issue;
  if(issue==='read'){
    persistence.issue=null;state.current=S=load();actionEpoch++;resume();return;
  }
  if(issue==='backup'){
    try{
      const raw=storage.getItem(KEY);
      if(raw!==persistence.lastStored){persistence.issue='conflict';return}
      keepOriginal(raw,JSON.parse(raw).schemaVersion===undefined?BACKUP_KEY:RECOVERY_KEY);
    }catch(e){return}
  }
  if(['write','backup'].includes(issue)){persistence.issue=null;save()}
}
function reviewCompletedCase(i,options){if(!C()[i]||!MP().completed.includes(i)){show('map',options);return}S.reviewedCase=i;show('caseReview',options)}
function openCatalog(){tap();show('catalog')}
function openProduct(id){tap();S.selectedProduct=id;show('product')}
function setCatalogBrand(id){tap();S.catalogBrand=id;save()}
function setAlias(alias){S.pilotAlias=alias;save()}
function storageChanged(event){if(event.key===KEY||event.key===null){if(event.newValue!==persistence.lastStored)persistence.issue='conflict'}}
const conversation=Academy.legacyConversation({getState:()=>S,MP,current,activeModule,activeScenario,acceptsAction,changed,save,tap,returnToChat,showConsequence,showLostConsequence,completeCase,calc,adapters,now,timing});
const actions={...conversation,render:resume,renderChat:returnToChat,renderReaction:showConsequence,renderLostReaction:showLostConsequence,renderBossCheck:showBossCheck,show,resume,returnToChat,showConsequence,showLostConsequence,showBossCheck,final,review,reviewCompletedCase,reset,resetModule,chooseModule,openModule,resumeModuleFromHome,startModule,startClient,openDecision,bossAnswer,openCatalog,openProduct,setCatalogBrand,setAlias,save,retryPersistence,recoverStorage,storageChanged};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function snapshot(){return freeze(JSON.parse(JSON.stringify(S)))}
function command(name,...args){
  if(!Object.hasOwn(actions,name))throw new Error('Unknown session command: '+name);
  effects={};const result=actions[name](...args);return {result,...effects};
}
ensureProgress();
return Object.freeze({command,snapshot,summary:scoreSummary,token:actionToken,status:()=>Object.freeze({...persistence}),duration:pilotDuration,canStartCase:i=>canStartCase(i),complete:()=>moduleComplete()});

};

'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.createState=function({MODULES,SCENARIOS,PRODUCTS}){
const KEY='pitbull-academy-quality-pass-01';
const DEFAULT_MODULE_ID=(MODULES.find(m=>m.status==='active')||MODULES[0]||{}).id||null;
const LEGACY_PROGRESS_KEYS=['current','completed','chat','node','discovered','rapport','results','bossCheck','pending','lostPending','startedAt','finishedAt'];

const blankModuleProgress=()=>({current:0,completed:[],chat:[],node:'start',discovered:[],rapport:62,results:[],bossCheck:null,pending:null,lostPending:null,startedAt:null,finishedAt:null,revision:0});
const SCHEMA_VERSION=1;
const BACKUP_KEY=KEY+'-before-phase1';
const RECOVERY_KEY=KEY+'-recovery';
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

let current;
return {KEY,SCHEMA_VERSION,BACKUP_KEY,RECOVERY_KEY,DEFAULT_MODULE_ID,blankModuleProgress,fresh,record,uniqueResults,normalizeProgress,migrate,get current(){return current},set current(value){current=value}};
};

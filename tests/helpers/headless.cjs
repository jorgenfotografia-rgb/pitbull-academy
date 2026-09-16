const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {ROOT,KEY}=require('./runtime.cjs');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function headless({seed={},contentSources={}}={}){
  // Only the unchanged legacy data loader uses its historical registration global.
  // Engine execution occurs in a different realm with no browser APIs at all.
  const data={};data.window=data;vm.createContext(data);
  for(const file of ['data/clients.js','data/modules.js','data/products.js','data/brands.js','data/sources.js','data/scenarios/m01.js','data/scenarios/m01-legacy-adapter.js']){
    vm.runInContext(contentSources[file]||read(file),data,{filename:file});
  }
  const context={};vm.createContext(context);
  for(const file of ['content/legacy-m01.js','content/clients.js','content/visits.js','content/modules.js','content/catalog.js','engine/state.js','engine/persistence.js','engine/legacy-scoring.js','engine/legacy-conversation.js','engine/session.js']){
    vm.runInContext(read(file),context,{filename:file});
  }
  const A=context.Academy;
  const legacy=A.legacyContent({clients:data.CLIENTS,scenarios:data.SCENARIOS});
  const clients=A.clientRepository(legacy.identities),visits=A.visitRepository(legacy.visits,clients),modules=A.moduleRepository(data.MODULES);
  const state=A.createState({MODULES:modules.all(),SCENARIOS:{m01:visits.scenario('m01')},PRODUCTS:data.PRODUCTS});
  const records=new Map(Object.entries(seed));let writes=0,now=1_800_000_000_000;
  const storage={getItem:k=>records.get(k)??null,setItem(k,v){writes++;records.set(k,String(v))}};
  const session=A.createSession({state,storage,modules,visits,adapters:data.LEGACY_SCENARIO_ADAPTERS,now:()=>now});
  const json=x=>JSON.parse(JSON.stringify(x));
  return {context,data,legacy,clients,visits,modules,session,records,state,json,
    command:(name,...args)=>session.command(name,...args),snapshot:()=>json(session.snapshot()),
    advance(ms=1000){now+=ms},get writes(){return writes},key:KEY};
}
module.exports={headless};

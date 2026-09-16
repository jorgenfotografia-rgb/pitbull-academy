window.ACADEMY_PHASE1=true;
const RELEASE='phase2-2026-09-15-3';
const AcademyApp=(()=>{
  const legacy=Academy.legacyContent({clients:window.CLIENTS||[],scenarios:window.SCENARIOS||{}});
  const clients=Academy.clientRepository(legacy.identities),visits=Academy.visitRepository(legacy.visits,clients);
  const modules=Academy.moduleRepository(window.MODULES||[]),catalog=Academy.catalogRepository({products:window.PRODUCTS||[],brands:window.BRANDS||[],sources:window.SOURCES||{}});
  const visuals=Academy.clientVisuals(legacy);
  const state=Academy.createState({MODULES:modules.all(),SCENARIOS:Object.fromEntries(modules.all().map(m=>[m.scenarioId,visits.scenario(m.scenarioId)])),PRODUCTS:catalog.products()});
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
  const session=Academy.createSession({state,storage,modules,visits,adapters:window.LEGACY_SCENARIO_ADAPTERS,now:()=>Date.now()});
  const effects=Academy.browserEffects({window,document,navigator});
  const queries=Object.freeze({snapshot:session.snapshot,summary:session.summary,token:session.token,status:session.status,duration:session.duration,canStartCase:session.canStartCase,complete:session.complete});
  const renderer=Academy.createRenderer({session:queries,modules,visits,catalog,visuals,effects,document});
  const sharing=Academy.resultSharing({session:queries,modules,visits,document,navigator,tap:effects.tap,RELEASE});
  const updates=Academy.updates({session,window,document,navigator});
  const controller=Academy.createController({session,renderer,effects,sharing,updates,modules,catalog,window,document});
  window.addEventListener('DOMContentLoaded',controller.bind);
  return Object.freeze({snapshot:session.snapshot,summary:session.summary});
})();

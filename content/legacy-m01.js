'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.legacyContent=function({clients,scenarios}){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const identities=clients.map(({id,name,age})=>({id,name,age}));
  const visits={},visuals={};
  for(const [id,scenario] of Object.entries(scenarios)){
    visits[id]={...clone(scenario),clients:scenario.clients.map(client=>{
      const {name,age,visual,...visit}=clone(client);
      visuals[client.id]=visual;
      return visit;
    })};
    delete visits[id].bossCheck?.image;
  }
  return {identities,visits,visuals,bossImages:Object.fromEntries(Object.entries(scenarios).map(([id,s])=>[id,s.bossCheck?.image]))};
};

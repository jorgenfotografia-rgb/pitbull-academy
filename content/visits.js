'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.visitRepository=function(visits,clients){
  const data=JSON.parse(JSON.stringify(visits));
  return Object.freeze({all:()=>JSON.parse(JSON.stringify(data)),scenario:id=>{
    const s=data[id];
    return s?{...JSON.parse(JSON.stringify(s)),clients:s.clients.map(c=>({...JSON.parse(JSON.stringify(c)),...clients.get(c.id)}))}:null;
  }});
};

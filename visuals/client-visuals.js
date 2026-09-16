'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.clientVisuals=function({visuals,bossImages}){
  const images=JSON.parse(JSON.stringify(visuals)),boss={...bossImages};
  return Object.freeze({client:(id,kind='face')=>images[id]?.[kind]||images[id]?.face||'assets/'+id+'.svg',
    isPilot:id=>!!images[id],boss:id=>'assets/'+boss[id]});
};

'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.moduleRepository=function(modules){
  const data=JSON.parse(JSON.stringify(modules));
  return Object.freeze({all:()=>JSON.parse(JSON.stringify(data)),get:id=>{const m=data.find(m=>m.id===id);return m?JSON.parse(JSON.stringify(m)):undefined}});
};

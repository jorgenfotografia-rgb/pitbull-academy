'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.catalogRepository=function({products,brands,sources}){
  const copy=x=>JSON.parse(JSON.stringify(x));
  const data=copy({products,brands,sources});
  return Object.freeze({products:()=>copy(data.products),brands:()=>copy(data.brands),sources:()=>copy(data.sources),
    product:id=>{const p=data.products.find(p=>p.id===id);return p?copy(p):undefined},
    brand:id=>{const b=data.brands.find(b=>b.id===id);return b?copy(b):undefined}});
};

'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.clientRepository=function(identities){
  const data=JSON.parse(JSON.stringify(identities));
  return Object.freeze({get:id=>{const c=data.find(c=>c.id===id);return c?{...c}:undefined}});
};

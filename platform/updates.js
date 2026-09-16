'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.updates=function({session,window,document,navigator}){
const el=id=>document.getElementById(id);
let updateRegistration=null;
let applyingUpdate=false;
function showUpdate(registration){updateRegistration=registration;const box=el('updateStatus');if(box)box.hidden=false}
function applyUpdate(){
  if(applyingUpdate||!session.command('save').result)return;
  applyingUpdate=true;
  if(updateRegistration?.waiting)updateRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  else window.location.reload();
}
if('serviceWorker' in navigator){
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(applyingUpdate){window.location.reload();return}
    if(hadController)showUpdate(updateRegistration);
    hadController=true;
  });
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
      updateRegistration=registration;
      if(registration.waiting)showUpdate(registration);
      registration.addEventListener('updatefound',()=>{
        const installing=registration.installing;
        installing?.addEventListener('statechange',()=>{
          if(installing.state==='installed'&&navigator.serviceWorker.controller)showUpdate(registration);
        });
      });
      await registration.update();
    }catch(e){/* Existing/offline training remains available. */}
  });
}

return {applyUpdate};
};

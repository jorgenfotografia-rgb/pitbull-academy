'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.createController=function({session,renderer,effects,sharing,updates,modules,catalog,window,document}){

let bound=false;
function run(name,...args){
  if(name==='enterAcademy')return effects.enterAcademy();
  if(name==='copyPilotResult'||name==='sharePilotResult'){
    const alias=(document.getElementById('pilotAlias')?.value||session.snapshot().pilotAlias||'Piloto').trim()||'Piloto';
    session.command('setAlias',alias);renderer.status();return sharing[name]();
  }
  if(name==='applyUpdate'){updates.applyUpdate();renderer.render();return}
  if(name==='reloadSavedProgress'){
    if(window.confirm('Se cargará el progreso de la otra pestaña. Los cambios locales que no se guardaron se descartarán. ¿Continuar?'))window.location.reload();return;
  }
  if(name==='retryPersistence'&&session.status().issue==='read'&&!window.confirm('Se volverá a cargar el progreso guardado. Los cambios de esta sesión que no se pudieron guardar se descartarán. ¿Continuar?'))return;
  if(name==='recoverStorage'&&!window.confirm('¿Crear un progreso nuevo? Primero conservaremos una copia del guardado que no se pudo leer.'))return;
  if(name==='openProductModule'){
    const product=catalog.product(session.snapshot().selectedProduct),m=(product?.moduleIds||[]).map(modules.get).find(m=>m?.status==='active');
    if(!m)return;session.command('chooseModule',m.id);name='openModule';
  }
  const result=session.command(name,...args);if(result.tapped)effects.tap();renderer.render(result);return result.result;
}
function bind(){
  if(bound)return;bound=true;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    run(button.dataset.action,...JSON.parse(button.dataset.args||'[]'));
  });
  document.addEventListener('error',event=>{if(event.target?.tagName==='IMG'&&event.target.dataset.hideOnError!==undefined)event.target.style.visibility='hidden'},true);
  window.addEventListener('storage',event=>run('storageChanged',{key:event.key,newValue:event.newValue}));
  window.addEventListener('beforeunload',event=>{if(session.status().issue){event.preventDefault();event.returnValue=''}});
  effects.bind();run('render');
}
return Object.freeze({run,bind});

};

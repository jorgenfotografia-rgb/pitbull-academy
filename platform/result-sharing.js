'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.resultSharing=function({session,modules,visits,document,navigator,tap,RELEASE}){
const el=id=>document.getElementById(id);
function pilotResultText(){
  const S=session.snapshot(),m=modules.get(S.selectedModule),s=session.summary(),mins=session.duration(),alias=(S.pilotAlias||'Piloto').trim()||'Piloto';
  return `PITBULL ACADEMY · PRE-PILOT\n${alias}\n${m.code} · ${m.title}\nGeneral: ${s.total}\nEscucha: ${s.listen}\nCriterio: ${s.criterion}\nConversación: ${s.conversation}\nRecomendación: ${s.recommendation}${mins?`\nDuración: ${mins} min`:''}\nCasos: ${S.moduleProgress[S.selectedModule].completed.length}/${visits.scenario(m.scenarioId).clients.length}\nBuild: CORE V1.1 · ${RELEASE}`;
}
let sharingResult=false;
function copyFeedback(message){const status=el('copyStatus');if(status)status.textContent=message}
async function copyPilotResult(text=pilotResultText()){
  tap();
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);copyFeedback('Resultado copiado.');
    el('copyFallback').hidden=true;return true;
  }catch(e){
    const box=el('copyFallback'),field=el('resultText');
    field.value=text;box.hidden=false;field.focus();field.select();
    copyFeedback('Seleccioná y copiá el texto del resultado.');return false;
  }
}
async function sharePilotResult(){
  if(sharingResult)return;
  sharingResult=true;tap();const text=pilotResultText(),btn=el('shareResult');if(btn)btn.disabled=true;
  try{
    if(navigator.share){
      try{await navigator.share({title:'Pitbull Academy · Resultado PRE-PILOT',text});return}
      catch(e){if(e.name==='AbortError'){copyFeedback('Podés usar COPIAR RESULTADO cuando quieras.');return}}
    }
    await copyPilotResult(text);
  }finally{sharingResult=false;if(btn)btn.disabled=false}
}
return {copyPilotResult,sharePilotResult};
};

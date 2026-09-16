'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.legacyConversation=function({getState,MP,current,activeModule,activeScenario,acceptsAction,changed,save,tap,returnToChat,showConsequence,showLostConsequence,completeCase,calc,adapters,now,timing}){
function beginChat(){if(getState().view!=='case')return;const p=MP(),c=current();if(!c||p.completed.includes(p.current))return;tap();if(!p.chat.length){p.chat=[{who:'client',text:c.intro}];changed(p)}save();returnToChat()}
function chooseLine(interventionId,token){
  if(!acceptsAction(token,'chat')||now()<timing.choiceLockedUntil)return;
  const p=MP(),c=current();if(!c||p.completed.includes(p.current)||p.pending||p.lostPending)return;
  const [node,index]=String(interventionId).split(':');
  if(node!==p.node||!/^\d+$/.test(index))return;
  const o=c.nodes?.[node]?.[Number(index)];if(!o)return;
  const key=(o.t||'').trim();
  if(p.chat.some(m=>m.who==='you'&&(m.text||'').trim()===key))return;
  tap();timing.choiceLockedUntil=now()+300;
  const d=new Set(p.discovered);
  p.chat.push({who:'you',text:o.t},{who:'client',text:o.r,q:o.q});
  (o.facts||[]).forEach(f=>d.add(f));p.discovered=[...d];
  p.rapport=Math.max(0,Math.min(100,p.rapport+o.q));p.node=o.next||node;
  changed(p);save();
  if(p.rapport<22){lost();return}
  returnToChat({scroll:false,follow:true});
}
function decide(action,token){
  if(!acceptsAction(token,'decision'))return;
  const p=MP(),c=current();if(!c||p.pending||p.lostPending||p.completed.includes(p.current))return;
  if(!activeModule().decisionActions.some(a=>a.id===action))return;
  tap();
  if(action==='ASK_MORE'){changed(p);returnToChat();return}
  const adapter=adapters?.[activeScenario().compatibilityAdapter];
  if(!adapter)throw new Error('Missing legacy scenario compatibility adapter');
  const outcome=adapter.decision({action,client:c,scores:calc(action),turns:p.chat.filter(x=>x.who==='you').length});
  p.pending={...outcome,unlockAt:now()+(activeScenario().consequenceDelayMs||0)};
  p.lostPending=null;changed(p);save();showConsequence();
}
function lost(){const p=MP();p.lostPending={scores:calc('LOST')};p.pending=null;changed(p);save();showLostConsequence()}
function commit(token){
  if(!acceptsAction(token,'reaction'))return;
  const p=MP(),c=current(),o=p.pending;
  if(!o||p.completed.includes(p.current)||now()<(o.unlockAt||0))return;
  tap();completeCase({i:p.current,name:c.name,action:o.action,correct:o.correct,scores:o.sc},p);
}
function commitLost(token){
  if(!acceptsAction(token,'reaction'))return;
  const p=MP(),c=current(),lp=p.lostPending;if(!lp||p.completed.includes(p.current))return;
  tap();completeCase({i:p.current,name:c.name,action:'LOST',correct:false,scores:lp.scores},p);
}
return {beginChat,chooseLine,decide,lost,commit,commitLost};
};

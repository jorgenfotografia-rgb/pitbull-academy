'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.legacyScoring=function(){
function uniqueResults(results=[]){
  const byCase=new Map();
  (Array.isArray(results)?results:[]).forEach(r=>{if(r&&Number.isInteger(r.i))byCase.set(r.i,r)});
  return [...byCase.values()].sort((a,b)=>a.i-b.i);
}
function calc(action,p,c){const d=new Set(p.discovered||[]),listen=Math.min(100,Math.round([...d].filter(x=>c.facts.includes(x)).length/Math.max(1,c.facts.length)*100));return{listen,criterion:action===c.answer?100:(action==='ASK_MORE'&&listen<67?78:35),conversation:p.rapport,recommendation:action===c.answer?100:(action==='ASK_MORE'&&listen<67?75:30)}}
function scoreSummary(p,scenario){
  const rs=uniqueResults(p.results),avg=k=>Math.round(rs.reduce((a,r)=>a+r.scores[k],0)/Math.max(1,rs.length));
  let listen=avg('listen'),criterion=avg('criterion'),conversation=avg('conversation'),recommendation=avg('recommendation');
  const bc=scenario?.bossCheck;if(bc&&p.bossCheck!==null&&bc.options[p.bossCheck]?.correct)criterion=Math.min(100,criterion+5);
  const total=Math.round(listen*.27+criterion*.28+conversation*.20+recommendation*.25);
  const rank=total>=90?'ASESOR':total>=80?'DETECTOR':total>=68?'OBSERVADOR':'NOVATO';
  return{listen,criterion,conversation,recommendation,total,rank};
}
return Object.freeze({calc,scoreSummary});
};

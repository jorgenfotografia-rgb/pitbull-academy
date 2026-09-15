(()=>{
  // Compatibility only for pre-Phase-1 HTML still served by an older worker.
  // Current index.html does not load this file. Never reset user progress here.
  if(window.ACADEMY_PHASE1)return;
  window.ensureProgress=function(){
    const m=activeModule();
    if(!m)return blankModuleProgress();
    if(!S.moduleProgress)S.moduleProgress={};
    if(!S.moduleProgress[m.id])S.moduleProgress[m.id]=blankModuleProgress();
    return S.moduleProgress[m.id];
  };
  window.MP=function(){return ensureProgress()};
  window.discoveredSet=function(){const p=ensureProgress();return new Set(p.discovered||[])};

  let choiceBusy=false;
  window.chooseLine=function(i){
    if(choiceBusy)return;
    choiceBusy=true;
    try{
      tap();
      const p=ensureProgress();
      const c=C()[p.current];
      if(!c)return;
      const node=p.node||'start';
      const options=(c.nodes&&c.nodes[node])||[];
      const o=options[Number(i)];
      if(!o)return;
      const key=(o.t||'').trim();
      if((p.chat||[]).some(m=>m&&m.who==='you'&&(m.text||'').trim()===key)){renderChat({scroll:false});return}
      const d=new Set(p.discovered||[]);
      p.chat.push({who:'you',text:o.t});
      p.chat.push({who:'client',text:o.r,q:o.q});
      (o.facts||[]).forEach(f=>d.add(f));
      p.discovered=[...d];
      p.rapport=Math.max(0,Math.min(100,p.rapport+o.q));
      p.node=o.next||node;
      save();
      if(p.rapport<22){lost();return}
      renderChat({scroll:false,follow:true});
    }finally{choiceBusy=false}
  };

})();

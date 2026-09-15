(()=>{
  window.SCENARIOS=window.SCENARIOS||{};
  const mapAction={glutamine:'RECOMMEND_PRODUCT',other:'RECOMMEND_CATEGORY',none:'DEFER_SUPPLEMENT',ask:'ASK_MORE'};
  const pilotVisual='assets/client-ref-camila.svg';
  const overrides={
    tomas:{reaction:{good:'Sí, ahora entiendo por qué puede entrar en la conversación. Quiero saber qué lugar tendría dentro de lo que ya hago.',early:'Puede ser una opción, pero todavía no me queda claro por qué la evaluarías en mi caso.',bad:'No sé… siento que todavía no entendimos bien lo que estoy buscando.'},explain:'El contexto permite evaluar glutamina como complemento, pero no convertirla en una recomendación automática. La evidencia sobre recuperación y rendimiento en personas activas es heterogénea; primero importa entender carga, objetivo y bases.'},
    matias:{reaction:{good:'Ahí sí me cierra: no por estar en definición, sino porque primero entendiste mi carga y lo que quiero resolver.',early:'Puede ser una opción, pero todavía siento que faltó entender mejor mi situación.',bad:'No me queda claro por qué eso responde a lo que te conté.'},explain:'La definición por sí sola no justifica el producto. Con carga elevada, recuperación como preocupación y bases planificadas, la glutamina puede evaluarse como complemento, sin asumir un beneficio garantizado.'},
    federico:{reaction:{good:'Bien. Entiendo que la estás evaluando por mi contexto y no sólo porque quiero sumar algo.',early:'Puede ser, pero esperaba que conectaras mejor la opción con mi preparación.',bad:'No me convence. Siento que estás generalizando.'},explain:'Hay una necesidad explícita de recuperación, alta carga y bases cubiertas. Eso habilita a evaluar un complemento; no convierte a la glutamina en una recomendación rutinaria ni garantiza mejorar rendimiento o recuperación.'}
  };

  window.SCENARIOS.m01={
    id:'m01',
    compatibilityAdapter:'m01-prepilot',
    consequenceDelayMs:700,
    clients:(window.CLIENTS||[]).map((c,i)=>{const extra=overrides[c.id]||{};return {...c,...extra,visual:{face:pilotVisual,encounter:pilotVisual,chat:pilotVisual,reaction:pilotVisual},reaction:{...c.reaction,...(extra.reaction||{})},answer:mapAction[c.answer]||c.answer,bossChallenge:i===5};}),
    bossCheck:{afterCaseIndex:2,image:'tiby-boss-check.webp',title:'Lectura rápida.',prompt:'Duermo cuatro horas, entreno seis días y ya tomo whey + creatina. ¿Me sumás glutamina para recuperar?',options:[{text:'Primero necesito entender el descanso y la recuperación.',correct:true},{text:'Sí. Sumemos glutamina.',correct:false},{text:'Mejor agregaría otro suplemento.',correct:false}],result:{goodTitle:'Bien leído.',badTitle:'Demasiado rápido.',goodText:'Dormir cuatro horas obliga a mirar primero la base antes de evaluar otro producto.',badText:'La carga de entrenamiento no convierte automáticamente a un suplemento en la respuesta cuando aparece una base claramente comprometida.'}}
  };

})();

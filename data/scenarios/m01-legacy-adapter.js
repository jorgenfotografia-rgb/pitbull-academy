// Temporary compatibility adapter for effective PRE-PILOT M01 outcomes.
// Preserve this policy until a separately approved pedagogical migration.
window.LEGACY_SCENARIO_ADAPTERS={
  'm01-prepilot':{
    decision({action,client:c,scores:sc,turns}){
      const correct=action===c.answer,enough=sc.listen>=67;
      let strength,title,note,copy;
      if(turns===0){
        sc.listen=0;sc.criterion=correct?55:20;sc.recommendation=correct?45:15;
        strength=correct?'mid':'bad';
        title=correct?'Dirección posible, sin contexto':'Decidiste demasiado pronto';
        note=correct?'La acción podría alinearse con el objetivo, pero llegaste a ella sin hacer una sola pregunta.':'Elegiste una acción antes de entender qué estaba intentando resolver el cliente.';
        copy=correct?c.reaction.early:c.reaction.bad;
      }else if(correct&&enough&&sc.conversation>=55){strength='good';title='Buena lectura';note='La acción coincide con el contexto que construiste.';copy=c.reaction.good}
      else if(correct&&!enough){strength='mid';title='Buena dirección, demasiado pronto';note='La acción puede tener sentido, pero todavía faltaba contexto.';copy=c.reaction.early}
      else{strength='bad';title='Revisá la lectura';note='La acción no responde bien al objetivo que venía mostrando.';copy=c.reaction.bad}

      return {action,sc,correct,strength,title,note,copy};
    }
  }
};

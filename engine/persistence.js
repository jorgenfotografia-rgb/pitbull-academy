'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.createPersistence=function({state,storage:localStorage,notify=()=>{}}){
const {KEY,SCHEMA_VERSION,BACKUP_KEY,RECOVERY_KEY,fresh,record,migrate}=state;
const persistence={lastStored:null,issue:null};
function keepOriginal(raw,key){
  if(raw!==null&&localStorage.getItem(key)===null)localStorage.setItem(key,raw);
}
function load(){
  let raw=null;
  try{raw=localStorage.getItem(KEY);persistence.lastStored=raw}catch(e){persistence.issue='read';return fresh()}
  if(raw===null)return migrate({});
  let parsed;
  try{parsed=JSON.parse(raw);if(!record(parsed))throw new Error('invalid record')}
  catch(e){persistence.issue='corrupt';return migrate({})}
  if(parsed.schemaVersion!==undefined&&parsed.schemaVersion!==SCHEMA_VERSION){persistence.issue='future';return migrate({})}
  const next=migrate(parsed);
  // Preserve the exact original before any version conversion or structural repair.
  if(JSON.stringify(next)!==JSON.stringify(parsed)){
    try{keepOriginal(raw,parsed.schemaVersion===undefined?BACKUP_KEY:RECOVERY_KEY)}
    catch(e){persistence.issue='backup'}
  }
  return next;
}
function save(){
  if(persistence.issue&&persistence.issue!=='write'){notify();return false}
  try{
    if(localStorage.getItem(KEY)!==persistence.lastStored){persistence.issue='conflict';notify();return false}
    if(JSON.stringify(state.current)===persistence.lastStored){persistence.issue=null;notify();return true}
    const previous=state.current.storageRevision||0;state.current.storageRevision=previous+1;
    try{const serialized=JSON.stringify(state.current);localStorage.setItem(KEY,serialized);persistence.lastStored=serialized}
    catch(e){state.current.storageRevision=previous;throw e}
    persistence.issue=null;notify();return true;
  }catch(e){persistence.issue='write';notify();return false}
}
return {status:persistence,keepOriginal,load,save};
};

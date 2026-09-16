'use strict';
globalThis.Academy=globalThis.Academy||{};
Academy.browserEffects=function({window,document,navigator}){

const el=id=>document.getElementById(id);
function tap(){try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}}
function enterAcademy(){tap();const splash=el('splash');if(!splash)return;splash.classList.add('splash-out');window.setTimeout(()=>{splash.hidden=true;splash.classList.remove('splash-out')},220)}
function followConversation(){window.requestAnimationFrame(()=>{const bubbles=[...el('thread').querySelectorAll('.bubble')],last=bubbles[bubbles.length-1];if(last)last.scrollIntoView({behavior:'smooth',block:'center'})})}
let hiddenAt=0;
function presentSplash(){const splash=el('splash');if(splash){splash.hidden=false;splash.classList.remove('splash-out')}}
function bind(){presentSplash();window.addEventListener('pageshow',presentSplash);window.addEventListener('load',presentSplash);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}if(hiddenAt&&Date.now()-hiddenAt>3000)presentSplash()})}
return {tap,enterAcademy,followConversation,bind,later:(f,ms)=>window.setTimeout(f,ms),scrollTop:()=>window.scrollTo({top:0,behavior:'smooth'})};

};

/* Small, repeatable room inspections. Dialogue remains in the shared home CSV. */
(function(W){
'use strict';
function choiceView(m){
 if(m.story.speech?.line?.type!=='home-choice'||m.story.speech.line.stage!=='wardrobe')return null;
 return {label:'옷장',options:[{id:'press',label:'누른다'},{id:'cancel',label:'취소'}]};
}
const fps=12, frames=9;
function flags(m){return m.qa ? (m.wardrobeFlags??={}) : W.barGame.progress.flags;}
function repeat(m,target){
 if(flags(m).wardrobeOpen===undefined)return false;
 return m.story.beginRows('home/wardrobe',target,[{type:'home-choice',stage:'wardrobe',actor:'luna'}]);
}
function sprite(m,base){
 const action=m.wardrobeMotion,open=flags(m).wardrobeOpen;
 if(!action && open===undefined)return base;
 const frame=action ? Math.min(frames-1,Math.floor(action.elapsed*fps)) : frames-1;
 return {...base,asset:open?'wardrobe-change1':'wardrobe-change2',x:129*frame+52,y:46,w:24,h:69};
}
function tick(m,dt){
 const action=m.wardrobeMotion;
 if(!action)return false;
 action.elapsed+=dt;
 if(action.elapsed>=frames/fps){
  m.wardrobeMotion=null;
  if(action.first)m.story.begin('home/wardrobePressed',action.target);
  m.updateNear();
 }
 return true;
}
function choose(m,id){
 const s=m.story.speech,view=choiceView(m);
 if(m.paused||m.scene!=='home'||!s?.choice||!view?.options.some(o=>o.id===id))return false;
 W.outsidePlaytest?.clearInput();
 if(id==='cancel'){m.story.cancel();return true;}
 const state=flags(m),first=state.wardrobeOpen===undefined;
 state.wardrobeOpen=!state.wardrobeOpen;
 const carry=!m.qa && W.lunaCampaign?.session?.carry;
 if(carry)(carry.flags??={}).wardrobeOpen=state.wardrobeOpen;
 m.wardrobeMotion={elapsed:0,first,target:s.target};
 m.anim='idle';m.story.cancel();
 return true;
}
W.LunaHomeInteractions={choiceView,choose,repeat,sprite,tick};
})(window);

/* Small, repeatable room inspections. Dialogue remains in the shared home CSV. */
(function(W){
'use strict';
function choiceView(m){
 if(m.story.speech?.line?.type!=='home-choice'||m.story.speech.line.stage!=='wardrobe')return null;
 return {label:'옷장',options:[{id:'press',label:'누른다'},{id:'cancel',label:'취소'}]};
}
function choose(m,id){
 const s=m.story.speech,view=choiceView(m);
 if(m.paused||m.scene!=='home'||!s?.choice||!view?.options.some(o=>o.id===id))return false;
 W.outsidePlaytest?.clearInput();
 if(id==='cancel'){m.story.cancel();return true;}
 return m.story.begin('home/wardrobePressed',s.target);
}
W.LunaHomeInteractions={choiceView,choose};
})(window);

// Source-authored home broadcast. Optional audio-text, never an interaction lock.
(function(W){
'use strict';
const id='outside_day0_tv_news1',anchor={x:1.22,y:-.26};
function active(m){return !m.qa&&m.scene==='home'&&m.config.day===0&&m.config.flow==='out';}
function tick(m,dt){const story=m.backgroundStory;
 if(!active(m)||m.transition){m.tvNewsInRange=false;if(story.speech?.id===id)story.cancel();return;}
 const distance=Math.abs(m.x-anchor.x);
 if(distance>1.2)m.tvNewsInRange=false;
 if(story.speech?.id===id){if(distance<.9)m.tvNewsInRange=true;story.tick(dt);return;}
 if(distance>=.9||m.tvNewsInRange||m.paused||m.dialog||m.encounter||m.story.blocking||story.speech)return;
 if(story.begin(id,{id,x:anchor.x,y:anchor.y-.42},true))m.tvNewsInRange=true;
}
W.LunaOutsideTV={id,anchor,active,tick};
})(window);

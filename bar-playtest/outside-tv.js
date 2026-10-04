// Current Notion home broadcasts, selected by day and commute state.
(function(W){
'use strict';
const id='outside_day0_tv_news1',ids=[id,'outside_day1_tv_news2'],anchor={x:1.22,y:-.26};
const event=m=>!m.qa&&W.LunaOutsideContent.events.find(e=>ids.includes(e.id)&&W.LunaOutsideContent.active(m,e));
function active(m){return !!event(m);}
function tick(m,dt){const story=m.backgroundStory,e=event(m);
 if(!e||m.transition){m.tvNewsInRange=false;for(const key of ids)story.channels.delete(key);return;}
 const distance=Math.abs(m.x-anchor.x);if(distance>1.2)m.tvNewsInRange=false;
 if(story.channels.has(e.id)){if(distance<.9)m.tvNewsInRange=true;story.tick(dt);return;}
 if(distance>=.9||m.tvNewsInRange||m.paused||m.dialog||m.encounter||m.story.blocking)return;
 if(story.begin(e.id,{id:e.id,x:anchor.x,y:anchor.y-.42},true))m.tvNewsInRange=true;
}
W.LunaOutsideTV={id,ids,anchor,active,tick};
})(window);

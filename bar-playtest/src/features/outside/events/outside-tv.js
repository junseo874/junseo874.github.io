// Current Notion home broadcasts, selected by day and commute state.
(function(W){
'use strict';
const id='outside_day0_tv_news1',documentaryId='outside_day0_documentary_ambient',ids=[id,'outside_day1_tv_news2',documentaryId],anchor={x:1.22,y:-.26};
// Existing watchable programme: day 0 documentary, both commute periods.
// News remains an ambient broadcast, not an invented replacement cutscene.
const programmes=[{day:0,flows:['in','out'],play:m=>W.lunaCampaign.playDayZeroTV(m)}];
const programme=m=>!m.qa&&m.scene==='home'&&W.lunaCampaign?.outside.model===m&&programmes.find(p=>p.day===m.config.day&&p.flows.includes(m.config.flow));
const documentary=m=>!m.qa&&!m.tvOff&&m.scene==='home'&&m.config.day===0&&m.config.flow==='in';
const event=m=>!m.qa&&!m.tvOff&&m.scene==='home'&&W.LunaOutsideContent.events.find(e=>ids.includes(e.id)&&W.LunaOutsideContent.active(m,e));
let documentaryLoading;
function ensureDocumentary(m){
 // Day-jump tests can enter home without having loaded the opening timeline.
 // Reuse its source instead of duplicating documentary dialogue here.
 if(!documentary(m)||W.StudioOpening?.source.tv||!W.lunaCampaign)return;
 if(!documentaryLoading)documentaryLoading=W.lunaCampaign.prepareStudio('documentary').catch(()=>{
  documentaryLoading=null;
  if(W.outsidePlaytest?.model===m){m.notice='TV 방송을 불러오지 못했습니다. 다시 상호작용해 주세요.';m.noticeLeft=3;}
 });
}
function clearBroadcast(m){m.tvNewsInRange=false;for(const key of ids){m.backgroundStory.channels.delete(key);m.backgroundStory.nextStart.delete(key);}}
function open(m){
 if(m.paused||m.scene!=='home')return false;
 const wasOff=m.tvOff;m.tvOff=false;m.story.cancel();
 if(wasOff)clearBroadcast(m);
 ensureDocumentary(m);
 m.dialog={kind:'tv',key:'tv:'+ ++m.revision};m.anim='idle';m.animTime=0;
 W.outsidePlaytest?.clearInput();m.updateNear();return true;
}
function choiceView(m){return {key:m.dialog.key,label:'TV',options:[
 {id:'confirm',label:'본다',disabled:!programme(m),disabledReason:'볼만한 방송이 없습니다.'},
 {id:'off',label:'끈다'},{id:'cancel',label:'취소'}
]};}
function choose(m,id){
 if(m.paused||m.dialog?.kind!=='tv'||!['confirm','off','cancel'].includes(id))return false;
 const p=programme(m);if(id==='confirm'&&!p)return false;
 m.dialog=null;m.revision++;W.outsidePlaytest?.clearInput();
 if(id==='off'){m.tvOff=true;clearBroadcast(m);}
 m.updateNear();if(id==='confirm')p.play(m);return true;
}
function active(m){return documentary(m)||!!event(m);}
function tick(m,dt){const story=m.backgroundStory,e=event(m);
 if(m.tvOff||m.scene!=='home'){clearBroadcast(m);return;}
 if(documentary(m)&&!m.transition){
  if(m.paused||m.dialog||m.encounter||m.story.blocking)return;
  if(!story.channels.has(documentaryId)){
   const rows=W.StudioOpening?.source.tv?.map(text=>({type:'say',actor:'tv',who:'TV',text}));
   story.beginRows(documentaryId,{id:documentaryId,x:anchor.x,y:anchor.y-.42},rows,true);
  }
  story.tick(dt);return;
 }
 story.channels.delete(documentaryId);
 if(!e||m.transition){m.tvNewsInRange=false;for(const key of ids)story.channels.delete(key);return;}
 const distance=Math.abs(m.x-anchor.x);if(distance>1.2)m.tvNewsInRange=false;
 if(story.channels.has(e.id)){if(distance<.9)m.tvNewsInRange=true;story.tick(dt);return;}
 if(distance>=.9||m.tvNewsInRange||m.paused||m.dialog||m.encounter||m.story.blocking)return;
 if(story.begin(e.id,{id:e.id,x:anchor.x,y:anchor.y-.42},true))m.tvNewsInRange=true;
}
W.LunaOutsideTV={id,ids,documentaryId,anchor,programme,open,choiceView,choose,active,tick};
})(window);

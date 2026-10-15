/* Shared gameplay signals: profile discovery, actual affinity deltas and forced street events.
   No polling of seeded/save-loaded values; notifications never change affinity or input focus. */
(function(W){
'use strict';
const roster=Object.freeze(['chris','port','aili','bubi','shiba','samho','tom']);
const aliases={'trade-samho':'samho','contract-samho':'samho','story-samho':'samho'};
const actor=id=>aliases[id]||String(id||'').toLowerCase();
const lanes={people:{queue:[],current:null,age:0},event:{queue:[],current:null,age:0}};
const entered=new WeakSet();let layer=null,serial=0;
function emit(owner,kind,id='',delta=0){
 if(!owner)return;
 // Chris is already known: keep profile flags and affinity, but never announce discovery.
 if(kind==='meet'&&id==='chris')return;
 const event={owner,kind,actor:id,delta,serial:++serial};
 lanes[kind==='event'||kind.startsWith('goal-')?'event':'people'].queue.push(event);
 return event;
}
function meet(p,id){
 id=actor(id);if(!p||!roster.includes(id))return false;
 p.flags??={};if(p.flags[id+'_met'])return false;
 p.flags[id+'_met']=true;emit(p,'meet',id);return true;
}
function affinity(p,id,delta){id=actor(id);if(roster.includes(id)&&Number.isFinite(delta)&&delta!==0)emit(p,delta>0?'up':'down',id,delta);}
function effects(p,before){
 for(const id of roster){
  if(!before.flags?.[id+'_met']&&p.flags?.[id+'_met'])emit(p,'meet',id);
  affinity(p,id,Number(p.affinity?.[id]||0)-Number(before.affinity?.[id]||0));
 }
}
function outsideProgress(m){return m.qa?(m.qa.shopProgress??={money:0,flags:{},affinity:{},inventory:{}}):W.barGame?.progress;}
function startGoal(p,id,title){
 if(!p||typeof id!=='string'||!/^[a-z][a-z0-9_-]*$/i.test(id)||typeof title!=='string'||!title.trim())return false;
 p.objectives??={};if(Object.hasOwn(p.objectives,id))return false;
 p.objectives[id]={title:title.trim(),status:'active'};
 emit(p,'goal-new').title=title.trim();return true;
}
function completeGoal(p,id){
 const goal=p?.objectives&&Object.hasOwn(p.objectives,id)?p.objectives[id]:null;
 if(goal?.status!=='active')return false;
 goal.status='completed';emit(p,'goal-complete').title=goal.title;return true;
}
function meetOutside(m,id){
 const p=outsideProgress(m);if(!meet(p,id))return false;
 // Preserve encounters made outside before the next bar/day restores the campaign carry.
 const carry=W.lunaCampaign?.session?.carry;if(!m.qa&&carry){carry.flags??={};carry.flags[actor(id)+'_met']=true;}
 return true;
}
function forced(m){
 const e=m.encounter;if(!e||entered.has(e))return false;
 entered.add(e);emit(outsideProgress(m),'event');return true;
}
function label(e,g){
 if(e.kind.startsWith('goal-'))return e.title;
 if(e.kind==='meet')return '신규 인물 정보 등록!';
 if(e.kind==='event')return '새로운 이벤트 발생!';
 return (g.speakerName?.(e.actor)||g.name(e.actor))+' 호감도 '+(e.kind==='up'?'상승!':'하락!');
}
function mount(){
 if(layer?.isConnected)return;
 layer=document.createElement('div');layer.id='story-notices';layer.setAttribute('aria-label','진행 알림');
 for(const key of Object.keys(lanes)){
  const el=document.createElement('div');el.className='story-notice story-notice-'+key;el.hidden=true;
  el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');
  el.innerHTML='<span class="story-notice-icon" aria-hidden="true"></span><div><small></small><strong></strong></div>';
  layer.append(el);lanes[key].el=el;
 }
 document.body.append(layer);
}
function tick(g,outside,campaign,dt){
 if(typeof document==='undefined')return;
 const liveOutside=outside?.active,m=liveOutside?outside.model:null;
 const owner=m?.qa?outsideProgress(m):g.progress;
 const blocked=(W.LunaFocusSettings?.hiddenPaused??document.hidden)||campaign?.blocking||campaign?.memoryTransition||(liveOutside?outside.loading||outside.loadError||outside.devConsoleOpen||m?.paused||m?.transition:g.phase==='ready'||g.isPaused());
 for(const lane of Object.values(lanes)){
  lane.queue=lane.queue.filter(e=>e.owner===owner);
  if(lane.current?.owner!==owner){lane.current=null;lane.age=0;}
 }
 if(!layer&&!Object.values(lanes).some(l=>l.current||l.queue.length))return;
 mount();layer.hidden=!!blocked;if(blocked){W.LunaStoryNoticeAudio?.stop();return;}
 const elapsed=Math.min(.1,Math.max(0,Number(dt)||0));
 for(const lane of Object.values(lanes)){
  if(lane.current){lane.age+=elapsed;if(lane.age>=3.3){lane.current=null;lane.age=0;}}
  if(!lane.current&&lane.queue.length){
   lane.current=lane.queue.shift();lane.age=0;const e=lane.current;
   lane.el.dataset.kind=e.kind;lane.el.dataset.actor=e.actor;lane.el.dataset.serial=String(e.serial);
   lane.el.querySelector('.story-notice-icon').textContent={meet:'＋',up:'↑',down:'↓',event:'!','goal-new':'◇','goal-complete':'✓'}[e.kind];
   lane.el.querySelector('small').textContent={'goal-new':'새로운 목표','goal-complete':'목표 달성',meet:'인물 정보',event:'외부 이벤트'}[e.kind]||'관계 변화';
   lane.el.querySelector('strong').textContent=label(e,g);
   W.LunaStoryNoticeAudio?.play(()=>lane.current===e&&!layer.hidden,e.kind);
  }
  lane.el.hidden=!lane.current;if(!lane.current)continue;
  const enter=Math.min(1,lane.age/.25),exit=Math.max(0,(lane.age-2.95)/.35),visible=enter*(1-exit);
  lane.el.style.opacity=String(visible);
  const reduced=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const travel=lane.el.offsetWidth+32;
  lane.el.style.transform=reduced?'none':'translateX('+((1-Math.pow(enter,1/3))*travel+exit*travel)+'px)';
 }
}
function clear(){W.LunaStoryNoticeAudio?.stop();for(const lane of Object.values(lanes)){lane.queue=[];lane.current=null;lane.age=0;if(lane.el)lane.el.hidden=true;}}
W.LunaStoryNotices={roster,meet,meetOutside,affinity,effects,forced,startGoal,completeGoal,tick,clear,get pending(){return Object.values(lanes).flatMap(l=>[...(l.current?[l.current]:[]),...l.queue]);}};
})(typeof window==='undefined'?globalThis:window);

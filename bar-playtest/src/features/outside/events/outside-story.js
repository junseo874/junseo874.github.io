(function(global){
'use strict';
const cps=55;
let nextSpeechId=0;
const advanceTime=(elapsed,dt)=>elapsed+dt*(Number(global.barGame?.dialogSpeed)||1);
// Reveal deadlines, in dialogue-clock seconds (the settings multiplier still applies).
// Spaces use the normal cadence; lone periods pause, adjacent periods keep their own cadence.
const typingCache=new Map();
function typing(text,rate=cps){
 const key=rate+'\0'+text;if(typingCache.has(key))return typingCache.get(key);
 const chars=Array.from(text||''),times=[];let duration=0;
 for(let i=0;i<chars.length;i++){
  const previous=chars[i-1];
  duration+=previous==='.'&&chars[i]==='.'?.3:previous==='.'&&chars[i-2]!=='.'?.35:1/rate;
  times.push(duration);
 }
 // Automatic dialogue also observes a lone period at the end of a line.
 if(chars.at(-1)==='.'&&chars.at(-2)!=='.')duration+=.35;
 const result={chars,times,duration};typingCache.set(key,result);
 if(typingCache.size>128)typingCache.delete(typingCache.keys().next().value);
 return result;
}
function visible(timing,elapsed){
 let lo=0,hi=timing.times.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(timing.times[mid]<=elapsed+1e-9)lo=mid+1;else hi=mid;}
 return lo;
}
function sceneTyping(dialog,dt,rate=60){
 const row=dialog.rows[dialog.index],text=row.text||'';
 if(dialog.typingClock?.index!==dialog.index||dialog.typingClock?.text!==text)
  dialog.typingClock={index:dialog.index,text,elapsed:0,timing:typing(text,rate)};
 if(dialog.chars>=text.length)return; // An explicit full-line reveal must stay revealed.
 const clock=dialog.typingClock;clock.elapsed=advanceTime(clock.elapsed,dt);
 dialog.chars=clock.timing.chars.slice(0,visible(clock.timing,clock.elapsed)).join('').length;
}
class Story{
 constructor(model){Object.defineProperty(this,'model',{value:model});this.flags={};this.done=new Set();this.speech=null;}
 witnessed(s=this.speech){if(this===this.model.story&&s)global.LunaOutsideDiscovery?.witnessed(this.model,s.id,s.rows);}
 get blocking(){return !!this.speech&&!this.speech.auto;}
 begin(id,target,auto=false){const rows=global.LUNA_OUTSIDE_DIALOGUES[id]||global.LUNA_DATA?.sharedStory?.[id];return this.beginRows(id,target,rows,auto);}
 beginRows(id,target,rows,auto=false,onComplete=null){if(!rows?.length)return false;this.speech={id,serial:++nextSpeechId,target,auto,rows,index:0,elapsed:0,choice:false,onComplete};this.seek();this.model.updateNear();return true;}
 choiceLine(row){const s=this.speech;const previous=s.displayLine||s.line;
  // A blank choice row is UI metadata, not a new empty utterance.
  s.displayLine=String(row.text||'').trim()?row:String(previous?.text||'').trim()?previous:null;
  s.line=row;s.typing=typing(s.displayLine?.text||'');s.chars=s.typing.chars;s.elapsed=s.typing.duration;s.choice=true;this.witnessed(s);
 }
 seek(){const s=this.speech;if(!s)return;
  const next=s.rows[s.index];
  if(next?.type==='home-choice'){this.choiceLine(next);return;}
  if(next?.type==='neighborhood-action'){s.line=null;s.chars=[];s.choice=false;global.LunaOutsideNeighborhood.action(this.model,next);return;}
  if(next?.type==='neighborhood-choice'){global.LunaOutsideNeighborhood.faceConversation(this.model,next);this.choiceLine(next);return;}
  while(s.index<s.rows.length){const row=s.rows[s.index];if(row.type==='notion-action'){s.line=null;s.chars=[];global.LunaOutsideNotion.action(this.model,row);return;}if(row.type==='samho-action'){s.line=null;s.chars=[];global.LunaOutsideSamhoCommute.action(this.model);return;}if(row.type==='shop-open'){this.witnessed(s);global.LunaOutsideShop.openStock(this.model,s.target);return;}if(row.type==='shop-allowance-grant'){global.LunaOutsideShop.grantAllowance(this.model);s.index++;continue;}if(row.type==='shop-intro-done'){global.LunaOutsideShop.completeIntro(this.model);s.index++;continue;}if(row.type==='thug-action'){s.line=null;s.chars=[];global.LunaOutsideThug.action(this.model,row);return;}if(row.type==='qa-choice'||row.type==='beggar-choice'||row.type==='notion-choice'||row.type==='thug-choice'||row.type==='shop-choice'){this.choiceLine(row);return;}if(row.type==='say'||row.type==='timeline'){global.LunaOutsideNeighborhood?.faceConversation(this.model,row);if(!s.auto)global.LunaStoryNotices?.meetOutside(this.model,row.actor);s.line=row;s.displayLine=row;s.typing=typing(row.text||'');s.chars=s.typing.chars;s.elapsed=0;return;}s.index++;}
  this.witnessed(s);this.done.add(s.id);this.speech=null;this.model.updateNear();s.onComplete?.();
 }
 advance(){const s=this.speech;if(!s||!s.line||s.auto||s.choice)return false;if(visible(s.typing,s.elapsed)<s.chars.length){s.elapsed=s.typing.duration;return true;}s.index++;this.seek();return true;}
 choose(id){return global.LunaHomeInteractions?.choose(this.model,id)||global.LunaOutsideNeighborhood?.choose(this.model,id)||global.LunaOutsideQA?.choose(this.model,id)||global.LunaOutsideBeggar?.choose(this.model,id)||global.LunaOutsideNotion?.choose(this.model,id)||global.LunaOutsideShop?.choose(this.model,id)||global.LunaOutsideThug?.choose(this.model,id)||false;}
 cancel(){if(this===this.model.story)global.LunaOutsideNeighborhood?.cancel(this.model);this.speech=null;this.model.updateNear();}
 tick(dt){const s=this.speech;if(!s?.line||s.choice)return;const before=visible(s.typing,s.elapsed);s.elapsed=advanceTime(s.elapsed,dt);const after=visible(s.typing,s.elapsed),foreground=this.model.story===this,anchor=this.view()?.anchor;const nearby=anchor&&Math.abs(anchor.x-this.model.x)<4&&Math.abs(anchor.y-this.model.y)<1.6;if(after>before&&(foreground||(!this.model.story.speech&&nearby)))global.LunaDialogueAudio?.reveal(s.chars.join(''),s.chars.slice(0,before).join('').length,s.chars.slice(0,after).join('').length,!foreground);if(s.auto&&s.elapsed>=s.typing.duration+Math.max(2,s.chars.length*.055)){s.index++;this.seek();}}
 interact(target){if(global.LunaOutsideNeighborhood?.interact(this.model,target))return true;if(global.LunaOutsideBeggar?.interact(this.model,target))return true;if(global.LunaOutsideNotion?.interact(this.model,target))return true;if(global.LunaOutsideShop?.interact(this.model,target))return true;if(target.source)return this.begin(target.source,target);return false;}
 view(){const s=this.speech;if(!s||!s.line)return null;const display=s.choice?s.displayLine:s.line,actor=display?.actor||s.line.actor,m=this.model,extra=global.LunaOutsideEncounters?.actor(actor),event=global.LunaOutsideContent.events.find(e=>e.id===s.id);
  const anchor=global.LunaOutsideNeighborhood?.anchor(m,actor)||global.LunaOutsideAmbient?.actorHead?.(m,actor)||global.LunaOutsideBeggar?.anchor(m,actor)||global.LunaOutsideThug?.anchor(m,actor)||global.LunaOutsideNotion?.anchor(m,actor)||(m.qa?global.LunaOutsideQA.anchor(m,actor,s.target):extra?{x:extra.x,y:extra.top+.04}:actor==='luna'?{x:m.x,y:m.y+.36}:{x:s.target.x,y:s.target.y+.42});
  const title=display?.who||(actor==='luna'?'루나':extra?.name||m.qa?.people.find(p=>p.id===actor)?.name||event?.title||'안내');
  const purchase=s.choice?(s.line.type==='home-choice'?global.LunaHomeInteractions.choiceView(m):s.line.type==='neighborhood-choice'?global.LunaOutsideNeighborhood.choiceView(m):s.line.type==='qa-choice'?global.LunaOutsideQA.choiceView(m):s.line.type==='beggar-choice'?global.LunaOutsideBeggar.choiceView(m):s.line.type==='notion-choice'?global.LunaOutsideNotion.choiceView(m):s.line.type==='shop-choice'?global.LunaOutsideShop.choiceView(m):s.line.type==='thug-choice'?global.LunaOutsideThug.choiceView():null):null;return{key:s.id+':'+s.serial+':'+s.index+':'+s.line.text,purchase,emphasis:display?.emphasis||[],color:extra?.color,title,text:s.chars.slice(0,s.choice?s.chars.length:visible(s.typing,s.elapsed)).join(''),full:s.chars.join(''),auto:s.auto,choice:!!s.choice,canTreat:false,anchor};
 }
}
// Ambient conversations own independent clocks and speaker anchors.
// The foreground Story remains exclusive for interactions and forced scenes.
class BackgroundStories{
 constructor(model){Object.defineProperty(this,'model',{value:model});this.channels=new Map();this.done=new Set();this.clock=0;this.nextStart=new Map();}
 get speech(){return this.channels.values().next().value?.speech||null;}
 get blocking(){return false;}
 // Keep every ambient channel at the same line/typing position during a
 // street interaction, including choices and encounter camera transitions.
 get suspended(){const m=this.model;return !!(m.dialog||m.story.blocking||m.encounter||global.outsidePlaytest?.model===m&&global.lunaCampaign?.blocking);}
 begin(id,target,auto=true){return this.beginRows(id,target,global.LUNA_OUTSIDE_DIALOGUES[id],auto);}
 beginRows(id,target,rows,auto=true){if(this.channels.has(id)||!rows?.length||this.clock<(this.nextStart.get(id)||0))return false;const story=new Story(this.model);if(!story.beginRows(id,target,rows,auto))return false;this.channels.set(id,story);return true;}
 nearby(story){
  const anchor=story.view()?.anchor;
  // A small exit band prevents repeated hide/remount at the exact distance
  // boundary. Entry range is unchanged; a new playback starts fresh.
  const s=story.speech,margin=s?.ambientInRange ? .2 : 0;
  const visible=!!anchor&&Math.abs(anchor.x-this.model.x)<4+margin&&Math.abs(anchor.y-this.model.y)<1.6+margin;
  if(s)s.ambientInRange=visible;
  return visible;
 }
 tick(dt){if(this.suspended)return;this.clock+=dt;for(const [id,story]of this.channels){if(this.nearby(story))story.tick(dt);if(!story.speech){if(story.done.has(id))this.done.add(id);this.channels.delete(id);this.nextStart.set(id,this.clock+4);}}}
 cancel(){this.channels.clear();this.model.updateNear();}
 advance(){return false;}
 view(){return this.views()[0]||null;}
 views(){return this.suspended?[]:[...this.channels.values()].filter(story=>this.nearby(story)).map(story=>story.view()).filter(Boolean);}
}
function tickBackground(model,dt){const story=model.backgroundStory;
 if(model.qa){story.tick(dt);return;}
 if(model.scene==='home'||[...story.channels.keys()].some(id=>global.LunaOutsideTV?.ids.includes(id))){global.LunaOutsideTV.tick(model,dt);if(model.scene==='home')return;}
 if(model.transition||model.scene!=='street'){if(story.speech)story.cancel();return;}
 story.tick(dt);global.LunaOutsideEncounters?.tickProximity(model,dt);
}
// One main-event queue; proximity is edge-triggered, never a per-frame restart.
// Providers retain ownership of their durable completion flags.
const eventStates=new WeakMap();
function eventState(m){const scope=[m.config.day,m.config.flow,m.scene,m.level].join('/');let s=eventStates.get(m);if(!s||s.scope!==scope||s.story!==m.story){s={scope,story:m.story,inside:new Map(),pending:new Map()};eventStates.set(m,s);}return s;}
const events={
 offer(m,id,eligible,start,priority){const s=eventState(m),inside=!m.qa&&eligible();if(inside&&!s.inside.get(id))s.pending.set(id,{id,eligible,start,priority});if(!inside)s.pending.delete(id);s.inside.set(id,inside);},
 pump(m){if(m.qa||m.paused||m.transition||m.ride||m.barArrival||m.dialog||m.story.blocking||m.encounter||m.neighborhood?.action)return false;const s=eventState(m);for(const item of [...s.pending.values()].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))){s.pending.delete(item.id);if(item.eligible()&&item.start()!==false)return true;}return false;}
};
global.LunaOutsideStory={Story,BackgroundStories,tickBackground,cps,advanceTime,typing,visible,sceneTyping,events};
})(typeof window==='undefined'?globalThis:window);

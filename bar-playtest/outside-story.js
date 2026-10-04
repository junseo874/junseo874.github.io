(function(global){
'use strict';
class Story{
 constructor(model){Object.defineProperty(this,'model',{value:model});this.flags={};this.done=new Set();this.speech=null;}
 get blocking(){return !!this.speech&&!this.speech.auto;}
 begin(id,target,auto=false){const rows=global.LUNA_OUTSIDE_DIALOGUES[id];return this.beginRows(id,target,rows,auto);}
 beginRows(id,target,rows,auto=false){if(!rows?.length)return false;this.speech={id,target,auto,rows,index:0,elapsed:0,choice:false};this.seek();this.model.updateNear();return true;}
 seek(){const s=this.speech;if(!s)return;
  while(s.index<s.rows.length){const row=s.rows[s.index];if(row.type==='notion-action'){s.line=null;s.chars=[];global.LunaOutsideNotion.action(this.model,row);return;}if(row.type==='samho-action'){s.line=null;s.chars=[];global.LunaOutsideSamhoCommute.action(this.model);return;}if(row.type==='shop-open'){global.LunaOutsideShop.openStock(this.model,s.target);return;}if(row.type==='shop-allowance-grant'){global.LunaOutsideShop.grantAllowance(this.model);s.index++;continue;}if(row.type==='shop-intro-done'){global.LunaOutsideShop.completeIntro(this.model);s.index++;continue;}if(row.type==='thug-action'){s.line=null;s.chars=[];global.LunaOutsideThug.action(this.model,row);return;}if(row.type==='bd-cinema'){global.LunaBDVendor.watch(this.model);return;}if(row.type==='notion-choice'||row.type==='bd-choice'||row.type==='thug-choice'||row.type==='shop-choice'){s.line=row;s.chars=Array.from(row.text);s.elapsed=99;s.choice=true;return;}if(row.type==='say'||row.type==='timeline'){s.line=row;s.chars=Array.from(row.text);s.elapsed=0;return;}s.index++;}
  this.done.add(s.id);this.speech=null;this.model.updateNear();
 }
 advance(){const s=this.speech;if(!s||!s.line||s.auto||s.choice)return false;if(s.elapsed*55<s.chars.length){s.elapsed=(s.chars.length+1)/55;return true;}s.index++;this.seek();return true;}
 choose(id){return global.LunaOutsideNotion?.choose(this.model,id)||global.LunaOutsideShop?.choose(this.model,id)||global.LunaOutsideThug?.choose(this.model,id)||global.LunaBDVendor?.choose(this.model,id)||false;}
 cancel(){this.speech=null;this.model.updateNear();}
 tick(dt){const s=this.speech;if(!s)return;s.elapsed+=dt;if(s.auto&&s.elapsed>=s.chars.length/55+Math.max(2,s.chars.length*.055)){s.index++;this.seek();}}
 interact(target){if(global.LunaOutsideNotion?.interact(this.model,target))return true;if(global.LunaOutsideShop?.interact(this.model,target))return true;if(global.LunaBDVendor?.interact(this.model,target))return true;if(target.source)return this.begin(target.source,target);return false;}
 view(){const s=this.speech;if(!s||!s.line)return null;const actor=s.line.actor,m=this.model,extra=global.LunaOutsideEncounters?.actor(actor),event=global.LunaOutsideContent.events.find(e=>e.id===s.id);
  const anchor=global.LunaOutsideNotion?.anchor(m,actor)||(m.qa?global.LunaOutsideQA.anchor(m,actor,s.target):extra?{x:extra.x,y:extra.top+.04}:actor==='luna'?{x:m.x,y:m.y+.36}:{x:s.target.x,y:s.target.y+.42});
  const title=s.line.who||(actor==='luna'?'루나':extra?.name||m.qa?.people.find(p=>p.id===actor)?.name||event?.title||'안내');
  const purchase=s.choice?(s.line.type==='notion-choice'?global.LunaOutsideNotion.choiceView(m):s.line.type==='shop-choice'?global.LunaOutsideShop.choiceView(m):s.line.type==='thug-choice'?global.LunaOutsideThug.choiceView():global.LunaBDVendor.choiceView()):null;return{key:s.id+':'+s.index+':'+s.line.text+(purchase?':'+purchase.money:''),purchase,emphasis:s.line.emphasis||[],color:extra?.color,title,text:s.chars.slice(0,Math.floor(s.elapsed*55)).join(''),full:s.chars.join(''),auto:s.auto,choice:!!s.choice,canTreat:false,anchor};
 }
}
// Ambient conversations own independent clocks and speaker anchors.
// The foreground Story remains exclusive for interactions and forced scenes.
class BackgroundStories{
 constructor(model){Object.defineProperty(this,'model',{value:model});this.channels=new Map();this.done=new Set();}
 get speech(){return this.channels.values().next().value?.speech||null;}
 get blocking(){return false;}
 begin(id,target,auto=true){return this.beginRows(id,target,global.LUNA_OUTSIDE_DIALOGUES[id],auto);}
 beginRows(id,target,rows,auto=true){if(this.channels.has(id)||!rows?.length)return false;const story=new Story(this.model);if(!story.beginRows(id,target,rows,auto))return false;this.channels.set(id,story);return true;}
 tick(dt){for(const [id,story]of this.channels){story.tick(dt);if(!story.speech){if(story.done.has(id))this.done.add(id);this.channels.delete(id);}}}
 cancel(){this.channels.clear();this.model.updateNear();}
 advance(){return false;}
 view(){return this.channels.values().next().value?.view()||null;}
 views(){return [...this.channels.values()].map(story=>story.view()).filter(Boolean);}
}
function tickBackground(model,dt){const story=model.backgroundStory;
 if(model.qa){story.tick(dt);return;}
 if(model.scene==='home'||[...story.channels.keys()].some(id=>global.LunaOutsideTV?.ids.includes(id))){global.LunaOutsideTV.tick(model,dt);if(model.scene==='home')return;}
 if(model.transition||model.scene!=='street'){if(story.speech)story.cancel();return;}
 story.tick(dt);global.LunaOutsideEncounters?.tickProximity(model,dt);
}
global.LunaOutsideStory={Story,BackgroundStories,tickBackground};
})(typeof window==='undefined'?globalThis:window);

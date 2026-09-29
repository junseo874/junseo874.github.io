(function(global){
'use strict';
const names={luna:'루나',shiba:'시바',radio:'라디오',sign:'전단'};
class Story{
 constructor(model){Object.defineProperty(this,'model',{value:model});this.flags={};this.done=new Set();this.speech=null;}
 get blocking(){return !!this.speech&&!this.speech.auto;}
 begin(id,target,auto=false){
  const rows=global.LUNA_OUTSIDE_DIALOGUES[id];if(!rows?.length)return false;
  this.speech={id,target,auto,rows,index:0,elapsed:0,choice:false};this.seek();this.model.updateNear();return true;
 }
 seek(){const s=this.speech;if(!s)return;
  while(s.index<s.rows.length){const row=s.rows[s.index];
   if(row.type==='say'||row.type==='timeline'){s.line=row;s.chars=Array.from(row.text);s.elapsed=0;s.choice=false;return;}
   if(row.type==='choice'){s.choice=true;s.line={actor:'shiba',text:'…뭐, 볼일 있으면 빨리 말해, 시바.'};s.chars=Array.from(s.line.text);return;}
   // State is committed only on a completed conversation, never on opening or cancelling.
   s.index++;
  }
  this.done.add(s.id);if(s.id==='np_shiba_1')this.flags.shiba_met=true;if(s.id==='np_tv_1')this.flags.tv_seen1=true;if(s.id==='ob_experiment_1')this.flags.seen_coratech_ad=true;
  this.speech=null;this.model.updateNear();
 }
 advance(){const s=this.speech;if(!s||s.auto||s.choice)return false;if(s.elapsed*55<s.chars.length){s.elapsed=(s.chars.length+1)/55;return true;}s.index++;this.seek();return true;}
 choose(id){const s=this.speech;if(!s?.choice)return false;
  if(id==='treat'){if(!this.flags.has_snack)return false;this.flags.has_snack=false;this.flags.shiba_fed=true;this.done.add('np_shiba_3');return this.begin('np_shiba_treat',s.target);}
  if(id!=='leave')return false;s.index++;this.seek();return true;
 }
 cancel(){this.speech=null;this.model.updateNear();}
 tick(dt){const s=this.speech;if(!s)return;s.elapsed+=dt;if(s.auto&&s.elapsed>=s.chars.length/55+Math.max(2,s.chars.length*.055)){s.index++;this.seek();}}
 interact(target){const m=this.model;
  if(target.id==='poster')return this.begin('ob_parttime_1',target);
  if(target.id==='experiment')return this.begin('ob_experiment_1',target);
  if(target.id==='shiba')return this.begin(!this.flags.shiba_met?'np_shiba_1':m.config.day>=2&&!this.done.has('np_shiba_3')?'np_shiba_3':'np_shiba_2',target);
  if(target.id==='tv')return this.begin(this.flags.tv_seen1?'np_tv_2':'np_tv_1',target);
  return false;
 }
 // Isolated exterior preview: reuse the available engine broadcast on every ride.
 // Story/day gating in the engine is unchanged; calling an empty lift is silent.
 radio(){const m=this.model;this.begin('d1_elevator',{id:'radio',x:m.x,y:m.y},true);}
 view(){const s=this.speech;if(!s)return null;const actor=s.line.actor;const m=this.model;const anchor=actor==='luna'?{x:m.x,y:m.y+.36}:s.target.id==='radio'?{x:global.LunaResidence.layout.elevatorX,y:m.elevatorY+1.032}:s.target.id==='tv'?{x:1.22,y:-.26}:s.target.id==='shiba'?{x:s.target.x+.19,y:s.target.y+.32}:{x:s.target.x,y:s.target.y+.42};
  return {key:s.id+':'+s.index+':'+s.choice,title:s.target.id==='tv'&&actor==='radio'?'TV':names[actor]||(s.target.id==='poster'?'구인 전단':'임상시험 전단'),text:s.chars.slice(0,s.choice?s.chars.length:Math.floor(s.elapsed*55)).join(''),full:s.chars.join(''),auto:s.auto,choice:s.choice,canTreat:!!this.flags.has_snack,anchor};
 }
}
global.LunaOutsideStory={Story};
})(typeof window==='undefined'?globalThis:window);

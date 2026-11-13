/* Isolated iframe adapter. Only this disposable game instance is staged.
 * Does not advance the campaign, write dialogue CSV, or save game progress. */
(function(W){'use strict';
W.LunaTrailerGame=class {
 constructor(frame){this.frame=frame;this.last=0;}
 async init(){
  const deadline=performance.now()+60000;
  while(!this.frame.contentWindow?.lunaCampaign){if(performance.now()>deadline)throw Error('웹 게임 로딩 시간을 초과했습니다.');await new Promise(r=>setTimeout(r,100));}
  const w=this.w=this.frame.contentWindow,c=this.c=w.lunaCampaign,g=this.g=w.barGame;
  // Prevent simulator/settings persistence in the embedded preview only.
  w.Storage.prototype.setItem=function(){};w.Storage.prototype.removeItem=function(){};
  w.document.querySelector('.updates-confirm')?.click();
  c.tick=()=>true; c.bgm.setSuppressed('trailer',true);w.Sfx?.setEnabled(false);
  // Notice audio has its own player, separate from the generic Sfx switch.
  // Replace it only in this disposable iframe; campaign notifications keep sound.
  if(w.LunaStoryNoticeAudio){w.LunaStoryNoticeAudio.stop();w.LunaStoryNoticeAudio.play=()=>{};}
  c.session.uninstall();c.session.install({developer:false});
  this.openView=w.LunaOpenView({g,D:w.LUNA_DATA,L:ko=>ko,esc:String,button:()=>'',ui:{gimmickAudio:false}});
  const style=w.document.createElement('style');style.textContent=`
   .updates-overlay,.updates-modal,#cutscene-preview-toolbar,.campaign-return,.minigame-toolbar,.mini-toolbar{display:none!important}
   body{pointer-events:none!important}body.trailer-silent .terrace-speech{display:none!important}
   .bar-scene-layer{transition:none!important}
   body.trailer-drinks .dialogue-wrap{translate:0 88px}
   .opening-screen .gimmick-finish,.opening-lesson{display:none!important}
  `;w.document.head.append(style);
  await w.LunaTerrace.prepare();g.paused=false;
 }
 reset(day=1){const {w,c,g}=this;c.outside.exit(true);c.dialog=null;c.ui.minigames=false;c.ui.inspector=false;c.ui.auto=false;g.reset(day,'regular',42,true,{variant:'original'});Object.assign(g,{lang:'ko',overlay:null,tutorial:null,pendingDailyUnlocks:false,transition:0,cameraLeft:0,cameraMoving:false,story:null,choice:null,screen:'bar',phase:'regular',paused:false,hidden:false});w.Sfx?.setEnabled(false);}
 async enter(s){
  this.scene=s;this.last=0;const {w,c,g}=this;
  this.reset(s.npc==='believer'?0:s.kind==='outside'?2:1);
  w.document.body.classList.toggle('trailer-silent',!!s.silent);
  w.document.body.classList.toggle('trailer-drinks',!!s.drink);
  if(s.kind==='terrace'){
   c.dialog={rows:[{actor:s.actor||'chris',text:s.text||'',who:s.actor==='luna'?'루나':'크리스'}],index:0,chars:0,background:'terrace',terraceDay:1,terraceWeather:{scene:'street',config:{day:1,flow:'out'}},terraceTime:0,terraceEntryDuration:0};
   w.LunaTerrace.beginEntrance(c.dialog);c.dialog.terraceEntryDuration=0;c.screen('scene');
  }else if(s.kind==='bar'){
   const lines=g.t.steps.filter(r=>r.actor===s.actor&&r.type==='say'&&r['text.ko']&&!r.context.startsWith('t99'));
   const row=(s.expression&&lines.find(r=>r.arg===s.expression))||lines.find(r=>r['text.ko'].length>=24&&r['text.ko'].length<=65)||lines[0];
   const text=s.text||row?.['text.ko']||g.t.steps.find(r=>r.actor===s.actor&&r['text.ko'])?.['text.ko']||(s.actor==='bubi'?'냐옹.':'');
   g.seats={L:null,M:{id:s.actor,actor:s.actor,seated:true,state:'STORY',coaster:true,glass:s.drink||null,expression:s.expression||'idle'},R:null};
   g.dialogue=text?g.makeLine(s.actor,text,null,s.expression||'default'):null;c.screen(c.playView);g.changed();c.render(true);
  }else if(s.kind==='open'){
   g.startMinigame('open');g.paused=false;c.ui.minigames=true;c.screen(c.playView);c.render(true);
  }else if(s.kind==='outside'){
   const day=s.npc==='believer'?0:s.npc==='newspaper'?1:2;
   g.day=day;g.progress.money=1000;Object.assign(g.progress.flags,{gang_pass_granted:true,shiba_shop_met:true});c.session.day=day;c.session.carry=structuredClone(g.progress);
   const outside=w.outsidePlaytest;Object.assign(outside.config,{day,flow:s.npc==='newspaper'?'in':'out',place:'bar'});await outside.start();c.screen(c.playView);
   const m=outside.model;m.y=-.7;m.level=0;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
   const positions={boss:w.LunaOutsideNeighborhood.places.boss.x+.3,believer:w.LunaOutsideBeliever.place.x-.35,newspaper:w.LunaOutsideNewspaper.place.x+.3,shiba:-2.87};
   m.x=positions[s.npc];m.updateNear();outside.snapCamera();outside.tick(0);
   if(s.npc==='shiba')w.LunaOutsideShop.interact(m,w.LunaOutsideShop.targets(m)[0]);else m.interact();
   if(s.npc!=='believer')for(let i=0;i<35&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=999;m.story.advance();}
   const speech=m.story.speech;
   if(speech){
    const end=speech.index;
    this.outsideClip={speech,start:s.npc==='believer'?0:Math.max(0,end-2),end:s.npc==='believer'?2:end};
    speech.index=this.outsideClip.start;speech.choice=false;speech.displayLine=null;m.story.seek();
   }
   outside.refreshHUD();
  }
  this.paint(0);
 }
 paint(t){
  const {w,c,g,scene:s}=this;if(!s)return;
  const dt=Math.max(0,Math.min(.05,t-this.last));this.last=t;
  if(s.kind==='bar'){g.cameraMoving=false;g.realTime=t+10;if(g.dialogue)g.dialogue.chars=Math.min(g.dialogue.text.length,Math.floor(t*36));c.render(true);}
  if(s.kind==='terrace'){
   c.dialog.terraceTime=t;c.dialog.chars=Math.floor(t*13);w.LunaTerrace.paint(c.dialog,c.host);
   // Trailer-only right-to-left panoramic drift; the campaign camera is untouched.
   if(s.silent){const art=c.host.querySelector('.terrace-scene');if(art)art.style.transform=`scale(1.12) translateX(${40-80*Math.min(1,t/s.duration)}px)`;}
  }
  if(s.kind==='outside'){
   const story=w.outsidePlaytest.model.story,clip=this.outsideClip;
   if(clip){const row=Math.min(clip.end,clip.start+Math.floor(t/1.7));
    if(story.speech!==clip.speech||clip.speech.index!==row){story.speech=clip.speech;clip.speech.index=row;clip.speech.choice=false;story.seek();}
    if(story.speech&&!story.speech.choice)story.speech.elapsed=(t%1.7)*1.5;
   }
   w.outsidePlaytest.tick(dt);
   w.outsidePlaytest.refreshHUD();
  }
  if(s.kind==='open'){
   const state=g.gimmick;g.realTime=t;state.started=true;
   // Start on the approaching ring; the power stage is not part of this cut.
   if(t<.5){state.openPhase='rhythm';state.beatTime=.72+t/.5*.38;state.completed=false;state.openFx=null;}
   else{state.openPhase='pop';state.completed=true;state.openFx={kind:'success',perfect:true,offset:0,age:t-.5,serial:1};}
   if(g.craft)g.craft.elapsed=t;c.render(true);this.openView.sync(w.document);
  }
 }
};
})(window);

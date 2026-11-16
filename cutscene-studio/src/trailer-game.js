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
  // The introduction owns one continuous rain layer across black/terrace/team.
  // Suppress only this iframe terrace's duplicate optical pass, not its falling rain.
  const drawRain=w.LunaRainGlass.draw;
  w.LunaRainGlass.draw=(ctx,model,options={})=>this.introRainShared&&options.owner===c.dialog?false:drawRain(ctx,model,options);
  w.LunaDialogueAudio.reveal=()=>{}; // Trailer sound follows visible characters once, in the parent.
  c.session.uninstall();c.session.install({developer:false});
  this.openView=w.LunaOpenView({g,D:w.LUNA_DATA,L:ko=>ko,esc:String,button:()=>'',ui:{gimmickAudio:false}});
  const style=w.document.createElement('style');style.textContent=`
   .updates-overlay,.updates-modal,#cutscene-preview-toolbar,.campaign-return,.minigame-toolbar,.mini-toolbar{display:none!important}
   body{pointer-events:none!important}body.trailer-silent .terrace-speech{display:none!important}
   .bar-scene-layer{transition:none!important}
   .outside-hud,.outside-background-speech{display:none!important}
   body.trailer-drinks .dialogue-wrap{translate:0 88px}
   .opening-screen .gimmick-finish,.opening-lesson{display:none!important}
  `;w.document.head.append(style);
  await w.LunaTerrace.prepare();g.paused=false;
 }
 reset(day=1){const {w,c,g}=this;c.outside.exit(true);c.dialog=null;c.ui.minigames=false;c.ui.inspector=false;c.ui.auto=false;g.reset(day,'regular',42,true,{variant:'original'});Object.assign(g,{lang:'ko',overlay:null,tutorial:null,pendingDailyUnlocks:false,transition:0,cameraLeft:0,cameraMoving:false,story:null,choice:null,screen:'bar',phase:'regular',paused:false,hidden:false});w.Sfx?.setEnabled(false);}
 async enter(s){
  const previous=this.scene;this.scene=s;this.last=0;const {w,c,g}=this;
  // A speaker change in the ending is one conversation, not a new scene.
  // Preserve the DOM, rain owner and animation clock; replace only the line.
  if(s.kind==='terrace'&&s.montage&&s.montage===previous?.montage&&c.dialog?.background==='terrace'){
   c.dialog.rows=[{actor:s.actor,text:s.text,who:s.actor==='luna'?'루나':'크리스'}];c.dialog.index=0;c.dialog.chars=0;
   const paragraph=c.host.querySelector('.terrace-speech p');if(paragraph)delete paragraph.dataset.line;
   this.paint(0);return;
  }
  const reuseStreet=s.kind==='outside'&&previous?.kind==='outside'&&w.outsidePlaytest.active;
  if(!reuseStreet)this.reset(s.kind==='outside'?2:1);
  w.document.body.classList.toggle('trailer-silent',!!s.silent);
  w.document.body.classList.toggle('trailer-drinks',!!s.drink);
  if(s.kind==='terrace'){
   c.dialog={rows:[{actor:s.actor||'chris',text:s.text||'',who:s.actor==='luna'?'루나':'크리스'}],index:0,chars:0,background:'terrace',terraceDay:1,terraceWeather:{scene:'street',config:{day:1,flow:'out'}},terraceTime:0,terraceEntryDuration:0};
   w.LunaTerrace.beginEntrance(c.dialog);c.dialog.terraceEntryDuration=0;c.screen('scene');
  }else if(s.kind==='bar'){
   const text=s.text;
   g.seats={L:null,M:{id:s.actor,actor:s.actor,seated:true,state:'STORY',coaster:true,glass:s.drink||null,glassEmpty:!!s.glassEmpty,expression:s.expression||'idle'},R:null};
   g.dialogue=text?g.makeLine(s.actor,text,null,s.expression||'default'):null;c.screen(c.playView);g.changed();c.render(true);
  }else if(s.kind==='open'){
   g.startMinigame('open');g.paused=false;c.ui.minigames=true;c.screen(c.playView);c.render(true);
  }else if(s.kind==='outside'){
   const day=s.npc==='believer'?0:s.npc==='newspaper'?1:2;
   g.day=day;g.progress.money=1000;Object.assign(g.progress.flags,{gang_pass_granted:true,shiba_shop_met:true});c.session.day=day;c.session.carry=structuredClone(g.progress);
   const outside=w.outsidePlaytest;Object.assign(outside.config,{day,flow:s.npc==='newspaper'?'in':'out',place:'bar'});
   if(reuseStreet)outside.model.start(outside.config);else await outside.start();
   c.screen(c.playView);
   const m=outside.model;m.y=-.7;m.level=0;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
   const positions={boss:w.LunaOutsideNeighborhood.places.boss.x+.3,believer:w.LunaOutsideBeliever.place.x-.35,newspaper:w.LunaOutsideNewspaper.place.x+.3,shiba:-2.87};
   m.x=positions[s.npc];m.updateNear();outside.snapCamera();outside.tick(0);
   if(s.npc==='shiba')w.LunaOutsideShop.interact(m,w.LunaOutsideShop.targets(m)[0]);else m.interact();
   // Hold one NPC line for this short excerpt, before any choice UI.
   const speech=m.story.speech;
   const speaker={boss:'boss',believer:'street-believer',newspaper:'street-newspaper',shiba:'shiba'}[s.npc];
   const lines=speech?.rows.filter(row=>row.type==='say'&&row.actor===speaker);
   const line=lines?.find(row=>row.text==='그건 왜 찾고 있지?')||lines?.[0];
   if(!line)throw Error('거리 대사를 찾을 수 없습니다 · '+s.title);
   speech.index=speech.rows.indexOf(line);speech.choice=false;speech.displayLine=null;m.story.seek();
   outside.refreshHUD();
  }
  this.paint(0);
 }
 paint(t){
  const {w,c,g,scene:s}=this;if(!s)return;
  const dt=Math.max(0,Math.min(.05,t-this.last));this.last=t;
  this.speech=null;
  if(s.kind==='bar'){g.cameraMoving=false;g.realTime=t+10;if(g.dialogue){g.dialogue.chars=Math.min(g.dialogue.text.length,Math.floor(t*30));this.speech={key:s.title,text:g.dialogue.text,chars:g.dialogue.chars};}c.render(true);}
  if(s.kind==='terrace'){
   const timing=w.LunaOutsideStory.typing(s.text||'',60);
   const conversation=s.montage==='terrace-ending'?W.LunaTrailerSequence.scenes.find(row=>row.montage===s.montage):s;
   c.dialog.terraceTime=t+s.start-conversation.start;c.dialog.chars=w.LunaOutsideStory.visible(timing,Math.max(0,t-(s.speechDelay||0)));w.LunaTerrace.paint(c.dialog,c.host);
   if(!s.silent)this.speech={key:s.title,text:s.text||'',chars:c.dialog.chars};
   // Trailer-only right-to-left panoramic drift; the campaign camera is untouched.
   if(s.silent){const art=c.host.querySelector('.terrace-scene');if(art)art.style.transform=`scale(1.12) translateX(${-40+80*Math.min(1,t/s.duration)}px)`;}
  }
  if(s.kind==='outside'){
   const story=w.outsidePlaytest.model.story;
   if(story.speech)story.speech.elapsed=t;
   // Keep normal exterior typewriter deadlines, without a speed multiplier.
   const elapsed=story.speech?.elapsed;w.outsidePlaytest.tick(dt);if(story.speech)story.speech.elapsed=elapsed;
   if(story.speech&&!story.speech.choice)this.speech={key:s.title+':'+story.speech.index,text:story.speech.chars.join(''),chars:w.LunaOutsideStory.visible(story.speech.typing,story.speech.elapsed)};
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

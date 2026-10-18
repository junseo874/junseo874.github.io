(function(global){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const PLACES={bar:'바 문 앞',homeDoor:'집 앞',home:'집 안'},FLOWS={in:'출근길',out:'퇴근길'};
const R=global.LunaResidence.layout;
const SOFA={id:'sofa',label:'소파 살펴보기',x:2.557,y:-.7};
const BOTTOM=R.elevatorBottom,TOP=R.elevatorTop,EX=R.elevatorX;
// The fence-side sign is a local lookout, not a full-map camera toggle.
const VIEWPOINT={x:-8.78,y:-.7,radius:.55,width:12};
// Stop beside the scrap pile, leaving the final approach to the bar to the player.
// Shift the start by the same amount to preserve the visible walk-in duration.
const FIRST_COMMUTE_ARRIVAL={from:-1.55,to:0};
// Speeds relative to the gameplay plane (1). Only independent art is listed:
// doors, lift, railings, shop props, actors, speech and rain stay in world space.
const STREET_DEPTH=Object.freeze({
 Sky:[.55,.78],C_Back_Building_2:[.72,.86],C_Back_Building_1:[.84,.91],
 C_Middle_Building_1:[.94,.96],C_Middle_Building_2:[.94,.96],C_Middle_Building_3:[.94,.96],
 C_Middle_Object_1:[.94,.96],C_Middle_Object_2:[.94,.96],
 CityLight:[.94,.96],"'CityLight '":[.94,.96],CityUpLight:[.94,.96],
 B_ForeFore_Object_1:[1.035,1]
});
function streetParallax(n,camera,model){
 const speed=model.scene==='street'&&!model.qa&&!n.ambient&&n.ancestry?.[0]==='BG'?STREET_DEPTH[n.name]:null;
 if(!speed)return{x:n.x,y:n.y};
 // Fixed map-center origin: no accumulated drift, day/spawn resets or zoom
 // multipliers. All billboard pieces share their building's exact offset.
 return{x:n.x+(camera.x+7.85)*(1-speed[0]),y:n.y+camera.y*(1-speed[1])};
}
// Version A day zero has no lookout interaction (keyboard and click share this guard).
// Version B keeps its separately managed progression unchanged.
function atViewpoint(m){return !!m&&m.config.day!==0&&!m.qa&&m.scene==='street'&&m.level===0&&Math.abs(m.x-VIEWPOINT.x)<=VIEWPOINT.radius&&!m.ride&&!m.transition&&!m.encounter&&!m.dialog&&!m.story.blocking;}
function firstCommuteEntranceCue(m){
 return !!m&&!m.qa&&m.scene==='street'&&m.level===0&&m.config.day===0&&m.config.flow==='in';
}
function firstHomeward(m){return !!m&&!m.qa&&m.config.day===0&&m.config.flow==='out';}
function syncHomewardGoal(m){
 const campaign=global.lunaCampaign;
 if(!firstHomeward(m)||!campaign?.active||campaign.blocking||m.transition||global.outsidePlaytest?.model!==m)return;
 const p=global.barGame.progress,notices=global.LunaStoryNotices;
 const changed=m.scene==='street'?notices.startGoal(p,'first_homeward','집으로 가기!'):m.scene==='home'&&notices.completeGoal(p,'first_homeward');
 if(changed&&campaign.session.carry)campaign.session.carry.objectives=structuredClone(p.objectives);
}
function homewardCues(m){
 if(!firstHomeward(m)||m.scene!=='street'||m.ride&&!m.ride.call||m.transition)return [];
 if(global.lunaCampaign?.active&&global.barGame?.progress.objectives?.first_homeward?.status==='completed')return [];
 // Destination state for a fixed HUD; never anchored to the player or scenery.
 const upper=m.level===1,targetX=upper?R.homeX:EX,delta=targetX-m.x,arrival=Math.abs(delta)<1.35;
 return [{id:upper?'home':'lift',kind:arrival?'arrival':'route',direction:delta<0?'left':'right',
  label:upper?'집으로':'엘리베이터로',destination:upper?'집 입구':'엘리베이터',
  detail:upper?'귀가 경로':'위층으로 이동'}];
}
// Equal Unity sorting keys must not inherit serialized component/file-ID order.
// Wall/fence dressing goes on the background, NPCs follow their sorting order,
// and only genuine foreground art (railings/lift front) covers the player.
function streetDrawOrder(nodes){
 const rank=n=>n.ancestry?.[0]==='BG'||n.ancestry?.[0]==='Residence'?0:1;
 return nodes.slice().sort((a,b)=>a.layer-b.layer||a.order-b.order||b.z-a.z||rank(a)-rank(b)||String(a.id).localeCompare(String(b.id)));
}
function interactionAnchor(model,target,data){
 if(model.qa)return {x:target.x,y:target.y+.75};
 // Idle sheets include transparent padding above the visible head.
 if(target.top!=null)return{x:target.x,y:target.top};
 if(target.id==='bd-vendor')return{x:target.x,y:-.34};
 if(target.encounter){const a=global.LunaOutsideEncounters.actor(target.actor);return{x:a.x,y:a.top};}
 const names={bar:'Bar Spawn Point',exit:'Room_Entrance'};
 const n=data.scenes[model.scene].nodes.find(n=>n.name===(target.nodeName||names[target.id]));
 if(n){const sp=n.sprite,sx=n.sx*(n.flip?-1:1),sy=n.sy;
  return{x:n.x+(.5-sp.pivot.x)*sp.w/sp.ppu*sx,y:n.y+Math.max(-sp.pivot.y*sy,(1-sp.pivot.y)*sy)*sp.h/sp.ppu};}
 // These targets are embedded in shared art, or mark a lift boarding floor.
 if(target.id==='elevator')return{x:target.x,y:target.y+.518};
 if(target.id==='home')return{x:target.x,y:target.y+.87};
 // Keep A's prompt beside the hologram, clear of both its picture and subtitles.
 if(target.id==='tv')return {x:1.58,y:-.48};
 if(target.id==='story-samho')return{x:target.x,y:target.y+.95};
 if(target.id==='sofa')return{x:2.557,y:-.27};
 return{x:target.x,y:target.y+.5};
}
class OutsideModel{
 constructor(options={}){this.start(options);}
 start({place='bar',flow='out',day=0,...qaOptions}={}){
  this.config={place:Object.hasOwn(PLACES,place)?place:'bar',flow:Object.hasOwn(FLOWS,flow)?flow:'out',day:Number(day)===99?99:clamp(Math.floor(Number(day)||0),0,3)};
  this.barArrival=null;this.commuteBoundarySide=0;this.beggarDeparture=null;this.liftLogoSeen=false;
  this.thugFlags={};this.samhoCommuteFlags={};this.notionFlags={};this.scene=this.config.place==='home'?'home':'street';this.level=this.config.place==='bar'?0:1;this.x=this.config.place==='bar'?1:this.config.place==='home'?-1.28:R.homeX;this.y=this.scene==='home'||!this.level?-.7:R.upperY;
  this.controlsTutorial=false;this.controlsInteractUntil=0;this.elevatorY=this.level?TOP:BOTTOM;this.facing=this.config.place==='bar'?-1:1;this.anim='idle';this.animTime=0;this.time=0;this.paused=false;this.ride=null;this.transition=null;this.encounter=null;this.dialog=null;this.near=null;this.notice='';this.noticeLeft=0;this.arrivals=0;this.revision=0;this.story=new global.LunaOutsideStory.Story(this);this.backgroundStory=new global.LunaOutsideStory.BackgroundStories(this);this.playedAmbient=new Set();this.tvNewsInRange=false;this.notionCommuteSeen=false;global.LunaOutsideQA?.init(this,qaOptions);this.updateNear();
 }
 wakeAtSofa(){
  if(this.scene!=='home'||this.qa)return false;
  const sofa=SOFA;
  this.x=sofa.x;this.y=sofa.y;this.facing=-1;this.anim='idle';this.animTime=0;this.updateNear();return true;
 }
 firstCommuteDirections(){
  if(this.isFirstCommute())return false;
  if(this.qa||this.config.day!==0||this.config.flow!=='in'||this.scene!=='street'||this.story.blocking)return false;
  const campaign=global.lunaCampaign,key='day0_first_home_exit',flags=campaign?.active?(global.barGame.progress.flags??={}):this.story.flags;
  if(flags[key])return false;
  const rows=[
   {type:'say',actor:'luna',text:'바의 위치는 엘리베이터를 타고 내려가서 우측으로 쭉 가면 된다고 했어.'},
   {type:'say',actor:'luna',text:'가게 이름은 언노운...'}
  ];
  if(!this.story.beginRows(key,{x:this.x,y:this.y},rows,false,()=>{
   // Register the goal only after the player dismisses the final doorway line.
   if(!campaign?.active||global.outsidePlaytest?.model!==this||this.config.day!==0||this.config.flow!=='in'||this.scene!=='street')return;
   if(global.LunaStoryNotices.startGoal(global.barGame.progress,'first_commute','첫 출근하기!')&&campaign.session.carry)campaign.session.carry.objectives=structuredClone(global.barGame.progress.objectives);
  }))return false;
  flags[key]=true;
  if(campaign?.active&&campaign.session.carry)(campaign.session.carry.flags??={})[key]=true;
  global.outsidePlaytest?.clearInput();this.anim='idle';this.animTime=0;return true;
 }
 isFirstCommute(){return !this.qa&&this.config.day===0&&this.config.flow==='in';}
 tickBarArrival(dt){
  const arrival=this.barArrival;if(!arrival)return false;
  this.x=Math.min(arrival.to,this.x+.48*dt);this.facing=1;this.anim='walk';this.animTime+=dt;
  if(this.x>=arrival.to){
   this.barArrival=null;this.anim='idle';this.animTime=0;global.outsidePlaytest?.clearInput();
   this.story.beginRows('day0_bar_arrival',{x:this.x,y:this.y},[{type:'say',actor:'luna',text:"바 '언노운' 여기인가보네."}],false,()=>global.outsidePlaytest?.clearInput());
  }
  this.updateNear();return true;
 }
 targets(){
  if(this.qa)return global.LunaOutsideQA.targets(this);
  if(this.scene==='home')return[...(this.config.day===0?[{id:'tv',label:'TV 다큐 보기',x:1.22,y:-.7}]:[]),{id:'exit',label:'밖으로 나가기',x:-1.581,y:-.7},...(this.config.flow==='out'?[SOFA]:[])];
  if(this.level)return[...(global.LunaOutsideNotion?.targets(this)||[]),{id:'home',label:'집에 들어가기',x:R.homeX,y:R.upperY},{id:'elevator',label:this.elevatorY>4?'엘리베이터 · 내려가기':'엘리베이터 호출',x:EX,y:R.upperY}];
  return[...(global.LunaOutsideEncounters?.targets(this)||[]),{id:'bar',label:'바 입구',x:1.0086,y:-.7},{id:'elevator',label:this.elevatorY<4?'엘리베이터 · 올라가기':'엘리베이터 호출',x:EX,y:-.7},...(global.LunaOutsideContent?.targets(this)||[]),...(global.LunaBDVendor?.targets(this)||[]),...(global.LunaOutsideShop?.targets(this)||[]),...(global.LunaOutsideBeggar?.targets(this)||[])];
 }
 updateNear(){global.LunaStoryNotices?.forced(this);this.near=this.qa?.runtime||this.barArrival||this.ride||this.transition||this.encounter||this.dialog||this.story?.blocking?null:this.targets().filter(t=>Math.abs(t.x-this.x)<(t.id==='elevator'?.62:.4)).sort((a,b)=>Math.abs(a.x-this.x)-Math.abs(b.x-this.x)||a.id.localeCompare(b.id))[0]||null;}
 beginEncounter(target){const e=global.LunaOutsideEncounters.prepare(this,target);if(!e)return false;this.story.cancel();this.encounter=e;this.facing=e.facing;this.updateNear();return true;}
 interact(){
  if(this.paused||this.controlsTutorial||this.barArrival||this.transition||this.encounter&&this.encounter.stage!=='active')return false;
  if(this.story.blocking)return this.story.advance();
  if(this.ride)return false;
  if(this.dialog){this.dialog=null;this.updateNear();this.revision++;return true;}
  this.updateNear();const t=this.near;if(!t)return false;
  if(this.qa&&global.LunaOutsideQA.interact(this,t))return true;
  if(!this.qa&&global.lunaCampaign?.interactOutside(this,t))return true;
  if(this.story.interact(t)){this.anim='idle';this.animTime=0;return true;}
  if(this.story.speech)this.story.cancel();
  if(t.id==='elevator'){
   const local=this.level?TOP:BOTTOM,remote=this.level?BOTTOM:TOP,call=Math.abs(this.elevatorY-local)>.01;
   this.ride={time:0,from:this.elevatorY,to:call?local:remote,call,duration:call?6:12};this.anim='idle';if(!call){this.x=EX;if(!this.qa)global.lunaCampaign?.quietLift(this);}
  }else if(t.id==='home'||t.id==='exit'){
   this.transition={time:0,to:t.id==='home'?'home':'street',swapped:false,barArrival:t.id==='exit'&&this.isFirstCommute()};
   global.LunaHomeDoorAudio?.play(()=>global.outsidePlaytest?.active&&global.outsidePlaytest.model===this&&!this.paused);
  }
  else if(t.id==='bar')this.dialog={title:'바 입구',text:this.config.flow==='in'?'출근길의 도착 지점입니다. 이 탭에서는 바 영업으로 넘어가지 않고 외부 공간만 탐색합니다.':'퇴근길의 출발 지점입니다. 왼쪽 엘리베이터를 타면 집으로 갈 수 있습니다.'};
  else if(t.id==='sofa')this.dialog={title:'소파',text:'저장과 취침을 연결할 자리입니다. 지금은 공간 탐색 모드라 일차와 바 영업의 저장 데이터는 바뀌지 않습니다.'};

  this.updateNear();this.revision++;return true;
 }
 tick(dt,input={}){
  dt=clamp(Number(dt)||0,0,.05);if(this.paused)return;
  syncHomewardGoal(this);
  if(this.qa&&global.LunaOutsideQA.tick(this,dt))return;
  this.story.tick(dt);
  global.LunaOutsideStory.tickBackground(this,dt);
  this.time+=dt;global.LunaOutsideBeggar?.tick(this,dt);this.noticeLeft=Math.max(0,this.noticeLeft-dt);
  if(global.LunaOutsideEncounters?.tick(this,dt))return;
  if(global.LunaOutsideNotion?.tick(this,dt))return;
  if(global.LunaOutsideThug?.tick(this,dt))return;
  if(global.LunaOutsideSamhoCommute?.tick(this,dt))return;
  if(this.encounter){const e=this.encounter;
   if(e.stage==='active'&&!this.story.speech){e.stage='leaving';e.cameraReady=false;e.elapsed=0;}
   if(e.stage==='entering'){e.elapsed+=dt;const p=smooth(clamp(e.elapsed/e.duration,0,1)),old=this.x;this.x=mix(e.from,e.to,p);this.anim=Math.abs(this.x-old)>.00001?'walk':'idle';this.animTime+=dt;
    if(e.elapsed>=e.duration&&e.cameraReady){this.x=e.to;this.anim='idle';e.stage='active';this.story.begin(e.id,e.target);}return;}
   if(e.stage==='leaving'){this.anim='idle';this.animTime+=dt;if(e.cameraReady){this.encounter=null;this.updateNear();}return;}
  }
  if(this.transition){
   const t=this.transition;t.time+=dt;
   if(t.time>=.38&&!t.swapped){
    t.swapped=true;this.scene=t.to;this.level=t.barArrival?0:1;
    this.x=t.barArrival?FIRST_COMMUTE_ARRIVAL.from:this.scene==='home'?-1.28:R.homeX;
    this.y=t.barArrival||this.scene==='home'?-.7:R.upperY;this.elevatorY=t.barArrival?BOTTOM:TOP;
    if(t.barArrival){this.facing=1;this.backgroundStory.cancel();global.outsidePlaytest?.clearInput();}
    this.revision++;
   }
   if(t.time>=.85){
    this.transition=null;
    if(t.barArrival)this.barArrival={to:FIRST_COMMUTE_ARRIVAL.to};else if(t.to==='street')this.firstCommuteDirections();
    this.updateNear();this.revision++;
   }
   this.anim='idle';this.animTime+=dt;return;
  }
  if(this.tickBarArrival(dt))return;
  if(this.ride){const r=this.ride;r.time+=dt;const p=smooth(clamp((r.time-.45)/r.duration,0,1));this.elevatorY=mix(r.from,r.to,p);if(!r.call){this.x=EX;this.y=this.elevatorY+R.passengerOffset;}if(r.time>=r.duration+1.1){if(!r.call){this.level=r.to===TOP?1:0;this.y=this.level?R.upperY:-.7;this.arrivals++;}this.elevatorY=r.to;this.ride=null;this.updateNear();this.revision++;}this.anim='idle';this.animTime+=dt;return;}
  let direction=this.dialog||this.story.blocking?0:clamp(input.move||0,-1,1),speed=input.run?1.2:.7;
  const restricted=this.isFirstCommute()&&this.scene==='street'&&this.level===0;
  const bounds=restricted?[-.9,2.15]:this.qa?[-12.81,6.1]:this.scene==='home'?[-1.5,3.4]:this.level?[R.upperMin,R.upperMax]:[R.lowerMin,6.1],old=this.x,desired=this.x+direction*speed*dt;
  this.x=clamp(desired,...bounds);
  if(restricted){
   if(this.x>bounds[0]+.12&&this.x<bounds[1]-.12)this.commuteBoundarySide=0;
   const side=desired<bounds[0]?-1:desired>bounds[1]?1:0;
   if(side&&side!==this.commuteBoundarySide){
    this.commuteBoundarySide=side;direction=0;global.outsidePlaytest?.clearInput();
    this.story.beginRows('day0_commute_boundary',{x:this.x,y:this.y},[{type:'say',actor:'luna',text:'지금은 언노운 가게로 출근해야해.'}],false,()=>global.outsidePlaytest?.clearInput());
   }
  }
  if(direction)this.facing=direction>0?1:-1;const next=!this.story.blocking&&Math.abs(this.x-old)>.00001?(input.run?'run':'walk'):'idle';if(next!==this.anim)this.animTime=0;this.anim=next;this.animTime+=dt;this.updateNear();
 }
}
function create({onExit=()=>{},currencyView=global.LunaCurrencyView()}={}){
 const glowRenderer=global.LunaInteractionGlow.create();let renderingNode=null;
 const data=global.LUNA_OUTSIDE_DATA,config={place:'bar',flow:'out',day:0},images=new Map(),keys=new Set();
 let active=false,loading=false,loadError='',model=null,host=null,canvas=null,ctx=null,cam={x:1,y:0,w:4.8},generation=0,hudSignature='',lastScene='',panorama=false,wakeSpawn=false,devOpen=false,notices=null,hintOpen=false,streetLocation=null;
 let surface=global.LunaPixelCamera.surface(1280,720),renderCam={...cam},pixelWidth=global.LunaPixelCamera.settledWidth(cam.w,surface);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(text,action,cls='')=>`<button class="${cls}" data-outside-action="${action}">${text}</button>`;
 function lobbyHTML(tabs){return `<div class="start-screen outside-start">${tabs}<section class="start-card outside-setup outside-entry"><small>OUTSIDE EXPLORATION</small><h2>외부 공간</h2><p>거리와 집을 자유롭게 둘러보세요.<br>설정은 탐색 중 <kbd>P</kbd>를 눌러 변경할 수 있습니다.</p>${button('탐색 시작 →','start','primary')}<span>0일차 · 퇴근길 · 바 문 앞에서 시작</span></section></div>`;}
 async function loadImages(){await Promise.all(Object.entries(data.assets).map(([id,a])=>{if(images.has(id))return;return new Promise((resolve,reject)=>{const im=new Image(),timeout=setTimeout(()=>reject(Error(a.src)),15000);im.onload=()=>{clearTimeout(timeout);images.set(id,im);resolve();};im.onerror=()=>{clearTimeout(timeout);reject(Error(a.src));};im.src=a.src;});}));}
 function fit(){if(!host)return;const previous=surface;surface=global.LunaPixelCamera.surface(innerWidth,innerHeight,devicePixelRatio);if(previous.w!==surface.w||previous.dpr!==surface.dpr)pixelWidth=global.LunaPixelCamera.settledWidth(cam.w,surface);host.style.setProperty('--outside-scale',surface.cssScale);host.style.setProperty('--outside-left',surface.left+'px');host.style.setProperty('--outside-top',surface.top+'px');if(canvas&&(canvas.width!==surface.w||canvas.height!==surface.h)){canvas.width=surface.w;canvas.height=surface.h;}}
 function clearInput(){keys.clear();}
 function devMoney(){return Math.max(0,Number(global.barGame?.progress.money)||0);}
 function devHTML(){return '<aside class="outside-dev-console" role="dialog" aria-label="외부 개발자 콘솔" hidden><header><div><small>DEVELOPER</small><h2>외부 개발자 콘솔</h2></div>'+button('P · 닫기','dev-close')+'</header><section class="outside-dev-days-section"><h3>일차</h3><div class="outside-dev-days">'+[0,1,2,3,99].map(day=>button(day===99?'99일차 · QA 가상 공간':day+'일차','dev-day-'+day,day===99?'outside-dev-qa':'')).join('')+'</div></section><section><h3>이동 상태 <small class="outside-dev-day"></small></h3><div class="outside-dev-flow">'+button('출근길','dev-flow-in')+button('퇴근길','dev-flow-out')+'</div></section><section><h3>위치 이동</h3>'+button('집 안','dev-home')+button('엘리베이터 앞 · 아래층','dev-elevator')+button('바 문 앞','dev-bar')+'</section><section><h3>현재 소지금</h3><output class="outside-dev-money" aria-live="polite"></output><div class="outside-dev-money-actions">'+button('−1,000원','dev-minus')+button('+1,000원','dev-plus')+'</div></section><p class="outside-dev-note"></p><p class="outside-dev-feedback" role="status"></p></aside>';}
 function paintDev(){const panel=host?.querySelector('.outside-dev-console');if(!panel)return;panel.hidden=!devOpen;panel.querySelector('[data-outside-action="dev-day-99"]').hidden=!!global.lunaCampaign?.active;panel.querySelector('.outside-dev-day').textContent=model.config.day+'일차';for(const day of [0,1,2,3,99])panel.querySelector('[data-outside-action="dev-day-'+day+'"]').setAttribute('aria-pressed',String(model.config.day===day));for(const flow of ['in','out'])panel.querySelector('[data-outside-action="dev-flow-'+flow+'"]').setAttribute('aria-pressed',String(model.config.flow===flow));for(const place of ['home','elevator','bar'])panel.querySelector('[data-outside-action="dev-'+place+'"]').disabled=!!model.qa;panel.querySelector('.outside-dev-note').textContent=model.qa?'99일차는 QA 전용 공간입니다. P 패널을 닫고 Tab으로 테스트할 상황을 고르세요. 0–3일차를 선택하면 거리로 돌아갑니다.':global.lunaCampaign?.active?'일차 변경은 본편 진행에도 적용됩니다. 위치·소지금·보유 물품은 유지하고 진행 중인 대화·이벤트는 초기화합니다.':'일차 변경 시 진행 중인 대화·이벤트는 초기화됩니다. 현재 위치·소지금·보유 물품은 유지됩니다. 99일차는 별도 QA 공간으로 이동합니다.';panel.querySelector('output').textContent=devMoney().toLocaleString('ko-KR')+'원';panel.querySelector('[data-outside-action="dev-minus"]').disabled=devMoney()===0;}
 function toggleDev(open=!devOpen){if(!active||loading||loadError)return;devOpen=open;hintOpen=false;clearInput();paintDev();hudSignature='';updateHUD();if(open)host.querySelector(model.qa?'[data-outside-action="dev-day-0"]':'[data-outside-action="dev-home"]')?.focus({preventScroll:true});else host.focus({preventScroll:true});}
 function normalPosition(m){return {scene:m.scene,level:m.level,x:m.ride?EX:m.x,y:m.ride?(m.level?R.upperY:-.7):m.y,elevatorY:m.ride?(m.level?TOP:BOTTOM):m.elevatorY,facing:m.facing,place:m.config.place};}
 function changeDay(day){
  if((global.lunaCampaign?.active&&day===99)||![0,1,2,3,99].includes(day)||model.config.day===day)return;
  const m=model,c=global.lunaCampaign;clearInput();m.story.cancel();m.backgroundStory.cancel();
  if(!m.qa)streetLocation=normalPosition(m);
  const qaCase=m.qa?.caseId||config.qaCase;Object.assign(config,{day,qaCase,place:streetLocation?.place||'bar'});
  c?.debugOutsideDay(day,config.flow);
  model=new OutsideModel(config);
  if(day!==99&&streetLocation){const {place,...position}=streetLocation;Object.assign(model,position);model.updateNear();}
  if(c){c.outsideSleep=null;c.liftLogoPending=false;document.querySelector('#campaign-lift-reveal')?.remove();}
  wakeSpawn=false;panorama=false;snapCamera();draw();
  global.barGame?.log('debug_outside_day',{from:m.config.day,to:day,flow:config.flow});
  host.querySelector('.outside-dev-feedback').textContent=day===99?'99일차 QA 공간으로 이동했습니다. 패널을 닫고 Tab으로 상황을 선택하세요.':day+'일차 · '+FLOWS[config.flow]+'로 변경했습니다.';
 }
 function dismissHint(){hintOpen=false;clearInput();hudSignature='';updateHUD();host.focus({preventScroll:true});}
 function devAction(action){if(!devOpen||loading||loadError)return;
  if(action==='dev-close'){toggleDev(false);return;}
  const m=model,c=global.lunaCampaign,g=global.barGame;
  if(action.startsWith('dev-day-'))changeDay(Number(action.slice(8)));
  else if(action==='dev-plus'||action==='dev-minus'){const before=devMoney(),after=Math.max(0,before+(action==='dev-plus'?1000:-1000));g.progress.money=after;if(c?.session.active&&c.session.carry)c.session.carry.money=after;g.log('debug_money',{before,after,source:'outside-console'});g.changed();}
  else if(action==='dev-flow-in'||action==='dev-flow-out'){
   const flow=action==='dev-flow-in'?'in':'out';if(m.config.flow===flow)return;
   clearInput();m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.dialog=null;m.notice='';m.noticeLeft=0;m.playedAmbient.clear();m.notionCommuteSeen=false;
   // Preserve the exact location (and any lift trip); only the route and its event state change.
   m.config.flow=flow;config.flow=flow;
   if(c?.active){c.session.day=m.config.day;c.session.route=flow;c.session.carry=JSON.parse(JSON.stringify(g.progress));c.session.pendingStep=null;c.morningSeen.delete(m.config.day);c.nightStarted=false;}
   if(c){c.outsideSleep=null;c.liftLogoPending=false;document.querySelector('#campaign-lift-reveal')?.remove();}
   g.log('debug_commute',{day:m.config.day,flow,source:'outside-console'});m.updateNear();m.revision++;
   host.querySelector('.outside-dev-feedback').textContent=m.config.day+'일차 · '+FLOWS[flow]+'로 변경했습니다.';
  }
  else if(['dev-home','dev-elevator','dev-bar'].includes(action)){
   if(m.qa)return;

   clearInput();m.story.cancel();m.backgroundStory.cancel();m.ride=null;m.transition=null;m.encounter=null;m.dialog=null;m.paused=false;m.notice='';m.noticeLeft=0;
   // Keep QA isolated; select a normal day before teleporting into the city.
   const home=action==='dev-home';m.scene=home?'home':'street';m.level=home?1:0;m.x=home?-1.28:action==='dev-elevator'?EX:1.0086;m.y=-.7;m.elevatorY=home?TOP:BOTTOM;m.facing=home?1:action==='dev-elevator'?1:-1;m.anim='idle';m.animTime=0;m.config.place=home?'home':'bar';config.place=m.config.place;wakeSpawn=false;panorama=false;
   if(c){c.liftLogoPending=false;document.querySelector('#campaign-lift-reveal')?.remove();}
   m.updateNear();m.revision++;snapCamera();draw();host.querySelector('.outside-dev-feedback').textContent=home?'집 안으로 이동했습니다.':action==='dev-elevator'?'아래층 엘리베이터 앞으로 이동했습니다.':'바 문 앞으로 이동했습니다.';
  }
  hudSignature='';updateHUD();paintDev();
 }
 function devKey(e){if(e.metaKey||e.ctrlKey||e.altKey)return false;
  if(e.code==='KeyP'&&!loading&&!loadError&&(!model.paused||devOpen)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleDev();return true;}
  if(!devOpen)return false;e.stopImmediatePropagation();
  if(e.code==='Escape'){e.preventDefault();if(!e.repeat)toggleDev(false);}
  else if(e.code==='Tab'){e.preventDefault();const buttons=[...host.querySelectorAll('.outside-dev-console button:not(:disabled)')].filter(b=>b.getClientRects().length),i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}
  else if(!['Enter','Space'].includes(e.code)||!e.target.closest('.outside-dev-console button')||e.repeat)e.preventDefault();
  return true;
 }
 function snapCamera(){
  const arriving=model.scene==='street'&&(model.barArrival||model.transition?.barArrival);
  cam={x:model.scene==='home'?clamp(model.x,.34,1.14):arriving?.65:model.x,y:model.scene==='home'?.023:model.y+.7,w:4.8};lastScene=model.scene;
  pixelWidth=global.LunaPixelCamera.settledWidth(cam.w,surface);
 }
 async function start({wakeAtSofa=false,showDevHint=false}={}){if(active)return;wakeSpawn=wakeAtSofa;generation++;const token=generation;active=true;loading=true;loadError='';panorama=false;devOpen=false;hintOpen=false;streetLocation=null;clearInput();model=new OutsideModel(config);if(wakeSpawn)model.wakeAtSofa();snapCamera();host=document.createElement('section');host.id='outside-root';host.setAttribute('aria-label','외부 공간 탐색');host.tabIndex=-1;host.innerHTML='<div class="outside-stage"><canvas width="1280" height="720" aria-label="루나가 이동하는 거리와 집 내부" role="img"></canvas><div class="outside-hud"><div class="outside-dynamic"></div></div><div class="outside-speech" hidden></div><div class="outside-background-speech" hidden></div><div class="outside-overlay"></div>'+devHTML()+'</div>';document.body.append(host);notices=global.LunaOutsideNotices.create(host,currencyView);notices.update(model);document.querySelector('#app').hidden=true;canvas=host.querySelector('canvas');ctx=canvas.getContext('2d');fit();hudSignature='';draw();updateHUD();try{await loadImages();if(token!==generation)return;loading=false;hintOpen=showDevHint&&!global.lunaCampaign?.active;host.focus({preventScroll:true});}catch(e){if(token!==generation)return;loading=false;loadError='거리 리소스를 불러오지 못했습니다. 다시 시도해 주세요.';console.error('Outside asset load:',e.message);}updateHUD();}
 function exit(silent=false){global.LunaControlsTutorial.stop();global.LunaHomeDoorAudio?.stop();notices?.dispose();notices=null;generation++;active=false;loading=false;devOpen=false;hintOpen=false;clearInput();host?.remove();host=null;document.querySelector('#app').hidden=false;if(!silent)onExit();}
 function advanceDay(){
  if(!active||loading||loadError||model.qa||model.config.flow!=='out'||model.config.day>=3)return false;
  Object.assign(config,{day:model.config.day+1,flow:'in',place:'home'});
  clearInput();model=new OutsideModel(config);wakeSpawn=true;model.wakeAtSofa();panorama=false;snapCamera();hudSignature='';draw();updateHUD();host.focus({preventScroll:true});return true;
 }
 function menu(){if(loading||loadError)return;clearInput();model.paused=!model.paused;hudSignature='';updateHUD();}
 function togglePanorama(){
  if(loading||loadError||devOpen||model.paused||!atViewpoint(model))return false;
  panorama=!panorama;clearInput();updateHUD();return true;
 }
 function targetCamera(dt){
  if(!atViewpoint(model))panorama=false;
  if(lastScene!==model.scene)snapCamera();let w=4.8,x=model.x,y=model.scene==='home'?.023:model.y+.7,liftWidth=null,liftDisplayWidth=null;
  if(model.scene==='street'&&model.ride&&!model.ride.call){
   const r=model.ride,p=clamp((r.time-.45)/r.duration,0,1),zoom=smooth(clamp(r.time/3,0,1))*(1-smooth(clamp((p-.73)/.27,0,1)));
   w=mix(4.8,12.8,zoom);liftWidth=w;
   liftDisplayWidth=mix(global.LunaPixelCamera.settledWidth(4.8,surface),global.LunaPixelCamera.settledWidth(12.8,surface),zoom);
   // Both directions share the ascent panorama: Luna/lift at 6% of the frame, not
   // a fixed world offset. PPU-calibrated width varies with viewport/DPR.
   // Use the same easing as the zoom so boarding and arrival stay continuous.
   x=model.x+liftDisplayWidth*.44*zoom;
   y=model.y+.7+1.0*zoom;
  }
  if(model.qa?.camera){({w,x,y}=model.qa.camera);}
  if(model.encounter){panorama=false;if(model.encounter.stage!=='leaving')({w,x,y}=model.encounter.camera);}
  if(model.scene==='street'&&(model.barArrival||model.transition?.barArrival))x=.65;
  if(!panorama)({w,x,y}=global.LunaOutsideResidents.frame(model,{w,x,y}));
  if(panorama){w=VIEWPOINT.width;x=VIEWPOINT.x;y=-1.48+w*720/1280/2;}
  // Keep endpoint PPU alignment while the zoom follows the original smooth
  // cinematic curve. Quantizing this moving target caused 3x -> 2x -> 1x cuts.
  const pixelGoal=w===liftWidth?liftDisplayWidth:global.LunaPixelCamera.settledWidth(w,surface);
  pixelWidth=global.LunaPixelCamera.approachWidth(pixelWidth,pixelGoal,dt);
  if(!model.qa){if(model.scene==='home')x=clamp(x,.34,1.14);else x=clamp(x,-22.25+w/2,6.55-w/2);}
  // Constrain the visible bottom, not just the camera center, during zoom.
  const floor=data.scenes.street.nodes.find(n=>n.name==='1F Floor').y+.02;
  if(model.scene==='street')y=Math.max(y,floor+w*720/1280/2);
  const t=1-Math.exp(-dt*5);cam.x=mix(cam.x,x,t);cam.y=mix(cam.y,y,t);cam.w=mix(cam.w,w,t);
  if(model.scene==='street')cam.y=Math.max(cam.y,floor+cam.w*720/1280/2);
  if(model.encounter)model.encounter.cameraReady=Math.abs(cam.x-x)<.015&&Math.abs(cam.y-y)<.015&&Math.abs(cam.w-w)<.015;
 }
 function position(x,y){return global.LunaPixelCamera.position(x,y,renderCam);}
 function drawSprite(sp,x,y,sx=1,sy=1,flip=false,alpha=1,glow=false){const img=images.get(sp.asset);if(!img)return;const p=global.LunaPixelCamera.sprite(sp,x,y,sx,sy,flip,renderCam,surface),w=p.w,h=p.h;if(p.x+w<0||p.x-w>1280||p.y+h<0||p.y-h>720)return;ctx.save();ctx.globalAlpha=alpha;if(glow)ctx.globalCompositeOperation='screen';ctx.translate(p.x,p.y);ctx.scale((sx<0?-1:1)*(flip?-1:1),sy<0?-1:1);if(renderingNode?.neon)global.LunaStreetSigns.paint(ctx,img,sp,w,h);else ctx.drawImage(img,sp.x,sp.y,sp.w,sp.h,-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);if(renderingNode?.name==='B_Obects')global.LunaWireSpark?.paint(ctx,img,images.get('street-wire-spark'),sp,w,h,model.time,global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);glowRenderer.paint(ctx,img,sp,renderingNode,x,y,w,h);ctx.restore();}
 function renderNode(n){const previous=renderingNode;renderingNode=n;try{renderSceneNode(n);}finally{renderingNode=previous;}}
 function renderSceneNode(n){if(global.LunaOutsideBeggar?.drawNode(model,n,drawSprite))return;if(global.LunaOutsideResidents.drawNode(model,n,drawSprite,ctx,position))return;if(global.LunaOutsideEncounters.drawNode(model,n,drawSprite))return;if(!global.LunaOutsideContent.visibleNode(model,n))return;if(n.name==='shiba'){if(global.LunaOutsideShop.visible(model)){const a=data.animations.shiba;drawSprite(a.frames[Math.floor(model.time*a.fps)%a.frames.length],n.x,n.y,n.sx,n.sy,n.flip);}return;}if(n.name==='Samho'&&[2,3].includes(model.config.day)){global.LunaOutsideSamhoCommute.draw(model,drawSprite);return;}if(n.name==='Samho'&&global.lunaCampaign?.session.active&&model.config.flow==='in'&&model.config.day>=2){const phase=model.time%4,frame=phase<.3?Math.floor(phase*10)%3:0;drawSprite({...n.sprite,x:frame*84},n.x,n.y,n.sx,n.sy,global.LunaOutsideAmbient.faceTarget(n.x,model.x));return;}if(!n.active||n.name==='Luna'||n.name==='Square'||/SAMHO|samho|Samho|Bubi/.test(n.name))return;if(n.ambient&&!(n.bdVendor?global.LunaBDVendor.visible(model):global.LunaOutsideAmbient.visible(model,n)))return;
  let y=n.y;if(model.scene==='street'&&n.ancestry.includes('Elevator')&&['Elevator','Elevator Fore','Elevator Door'].includes(n.name))y+=model.elevatorY-BOTTOM;
  // Keep the imported sprite cutouts and world coordinates; only the debug swatches at the right of the house atlas are masked by room bounds.
  const light=n.light||/City.*Light/.test(n.name);let sp=n.ambient?global.LunaOutsideAmbient.frame(n,model.time):n.sprite;const facing=global.LunaOutsideAmbient.facing(n,model),art=streetParallax(n,renderCam,model);drawSprite(sp,art.x,art.y+(y-n.y),n.sx,n.sy,facing,n.alpha??(light?.26:1),light);
 }
 function drawEntranceCue(){
  if(!firstCommuteEntranceCue(model))return;
  const door=data.scenes.street.nodes.find(n=>n.name==='Bar Spawn Point');if(!door)return;
  const k=1280/renderCam.w,p=position(door.x,-.98);if(p.x+.3*k<0||p.x-.3*k>1280)return;
  const still=global.matchMedia?.('(prefers-reduced-motion: reduce)').matches,t=still?0:model.time;
  const drift=still?0:Math.sin(t*Math.PI*2/.9)*.012*k;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // Trace the doorway below the sign, in the entrance sprite's pixel space.
  // Keep the frame fixed to the art (only the arrow nudges), behind Luna.
  const sp=door.sprite,outline=[[2,15],[36,15],[36,66],[2,66],[2,15]];
  ctx.strokeStyle='#c9ffff';ctx.lineWidth=k*.008;ctx.globalAlpha=.96;
  ctx.shadowColor='#4ae5f4';ctx.shadowBlur=7*k/266.667;
  ctx.beginPath();outline.forEach(([x,y],i)=>{
   const q=position(door.x+(x-sp.w*sp.pivot.x)*door.sx/sp.ppu,door.y+(sp.h*(1-sp.pivot.y)-y)*door.sy/sp.ppu);
   if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);
  });ctx.stroke();
  // Match the bar tutorial's single, round-capped cyan arrow and gentle nudge.
  ctx.translate(p.x,p.y-drift);ctx.scale(k/266.667,k/266.667);
  ctx.strokeStyle='#c9ffff';ctx.lineWidth=3.5;ctx.globalAlpha=.98;
  ctx.shadowColor='#4ae5f4';ctx.shadowBlur=6;
  ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(0,0);ctx.moveTo(-10,10);ctx.lineTo(0,0);ctx.lineTo(10,10);ctx.stroke();
  ctx.restore();
 }
 function interactionTarget(){const m=model;return m&&!m.paused&&!loading&&!loadError&&!devOpen&&!hintOpen&&!m.controlsTutorial&&!m.dialog&&!m.story.blocking&&!global.lunaCampaign?.blocking?m.near:null;}
 function draw(){if(!ctx||!model)return;if(surface.dpr!==devicePixelRatio)fit();renderCam=global.LunaPixelCamera.view(cam,surface,{scene:model.scene,qa:!!model.qa,displayWidth:pixelWidth,floor:data.scenes.street.nodes.find(n=>n.name==='1F Floor').y+.02});ctx.setTransform(surface.factor,0,0,surface.factor,0,0);glowRenderer.begin(model.qa?null:interactionTarget(),model);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#090d19';ctx.fillRect(0,0,1280,720);if(loading||loadError)return;
  if(model.qa){global.LunaOutsideQA.draw({m:model,ctx,position,sprite:drawSprite,data,player:()=>{const a=data.animations[model.anim];drawSprite(a.frames[Math.floor(model.animTime*a.fps)%a.frames.length],model.x,model.y,1,1,model.facing>0);}});if(model.transition){ctx.fillStyle='rgba(6,10,18,'+Math.max(0,1-Math.abs(model.transition.time-.38)/.47)+')';ctx.fillRect(0,0,1280,720);}return;}
  const nodes=data.scenes[model.scene].nodes.slice().sort((a,b)=>a.layer-b.layer||a.order-b.order||b.z-a.z);
  if(model.scene==='home'){const bg=nodes.find(n=>n.name==='main_bg');if(bg)renderNode(bg);nodes.filter(n=>n.name!=='main_bg'&&n.name!=='ForeFore_Object').forEach(renderNode);}
  const drawPlayer=()=>{const anim=data.animations[model.anim],frame=anim.frames[Math.floor(model.animTime*anim.fps)%anim.frames.length];drawSprite(frame,model.x,model.y,1,1,model.facing>0);};
  if(model.scene==='home'){drawPlayer();nodes.filter(n=>n.name==='ForeFore_Object').forEach(renderNode);}
  else {
   let farTraffic=false,midTraffic=false;
   for(const n of streetDrawOrder(nodes)){
    // Traffic is part of the scene, not an overlay: skyline silhouettes,
    // foreground shops and the residence/lift naturally cover it afterwards.
    if(!farTraffic&&n.layer>=3){global.LunaOutsideTraffic?.draw(ctx,model,renderCam,position,'far');farTraffic=true;}
    if(!midTraffic&&n.layer>=5){global.LunaOutsideTraffic?.draw(ctx,model,renderCam,position,'mid');midTraffic=true;}
    if(n.name==='Luna'){drawEntranceCue();global.LunaOutsideThug?.draw(model,drawSprite,ctx,position);global.LunaOutsideNotion?.draw(model,drawSprite,ctx,position);drawPlayer();}else renderNode(n);
   }
  }
  if(model.scene==='home'){const edge=position(3.537,0).x;ctx.fillStyle='#090d19';ctx.fillRect(edge,0,Math.max(0,1280-edge),720);}
  global.LunaOutsideRain?.draw(ctx,model,renderCam,position);
  const shade=ctx.createLinearGradient(0,0,0,720);shade.addColorStop(0,'rgba(4,8,16,.25)');shade.addColorStop(.25,'rgba(4,8,16,0)');shade.addColorStop(.85,'rgba(4,8,16,0)');shade.addColorStop(1,'rgba(4,8,16,.3)');ctx.fillStyle=shade;ctx.fillRect(0,0,1280,720);
  if(model.transition){const t=model.transition.time,alpha=t<.38?t/.38:1-(t-.38)/.47;ctx.fillStyle=`rgba(6,10,18,${clamp(alpha,0,1)})`;ctx.fillRect(0,0,1280,720);}
 }
 const controlsDismissKeys=new Set();
 let controlsUnlockAt=0,controlsStep=0;
 function showControlsTutorial(){if(!active||model.scene!=='home'||model.config.day!==0||model.config.flow!=='in'||model.controlsTutorial)return;clearInput();controlsStep=0;controlsUnlockAt=performance.now()+2000;model.controlsTutorial=true;updateHUD();host.querySelector('.outside-controls-tutorial')?.focus({preventScroll:true});}
 function dismissControlsTutorial(){
  if(!model.controlsTutorial||model.paused||loading||loadError||devOpen||performance.now()<controlsUnlockAt)return;
  if(controlsStep===0){controlsStep=1;controlsUnlockAt=performance.now()+300;clearInput();updateHUD();host.querySelector('.outside-controls-tutorial')?.focus({preventScroll:true});return;}
  global.LunaControlsTutorial.stop();
  model.controlsTutorial=false;clearInput();
  const campaign=global.lunaCampaign;
  if(model.isFirstCommute()&&campaign?.active&&global.LunaStoryNotices.startGoal(global.barGame.progress,'first_commute','첫 출근하기!')&&campaign.session.carry)campaign.session.carry.objectives=structuredClone(global.barGame.progress.objectives);
  updateHUD();host.focus({preventScroll:true});
 }
 function controlsTutorialKey(e){
  if(!active)return false;
  // Consume the dismissing key until release, including movement key repeats.
  if(controlsDismissKeys.has(e.code))return true;
  if(!model.controlsTutorial||model.paused||loading||loadError||devOpen)return false;
  if(!e.repeat){controlsDismissKeys.add(e.code);if(e.code==='KeyE'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&performance.now()>=controlsUnlockAt)dismissControlsTutorial();}
  return true;
 }
 function paintControlsTutorial(){
  let panel=host.querySelector('.outside-controls-tutorial');
  if(model.scene!=='home'||model.config.flow!=='in'||model.config.day!==0)model.controlsTutorial=false;
  if(model.controlsTutorial&&!panel){
   panel=document.createElement('section');panel.className='outside-controls-tutorial';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.tabIndex=-1;
   const shade=document.createElement('div');shade.className='outside-controls-shade';shade.append(panel);host.querySelector('.outside-stage').append(shade);
  }
  if(!panel)return;
  const wasVisible=panel.dataset.visible==='true';
  panel.hidden=!model.controlsTutorial||model.paused||loading||!!loadError||devOpen||!!model.dialog||model.story.blocking;
  panel.parentElement.hidden=panel.hidden;panel.dataset.visible=String(!panel.hidden);
  if(panel.hidden){
   if(wasVisible)global.LunaControlsTutorial.stop();
   if(!model.controlsTutorial)delete panel.dataset.step;
  }else{
   if(panel.dataset.step!==String(controlsStep)){
    global.LunaControlsTutorial.render(panel,controlsStep,images,data);
    const step=controlsStep,owner=model;
    void global.LunaControlsTutorial.play(()=>active&&model===owner&&model.controlsTutorial&&controlsStep===step&&!panel.hidden);
   }
   const locked=performance.now()<controlsUnlockAt;
   panel.dataset.locked=String(locked);
  }
  host.querySelector('.outside-hud').inert=!panel.hidden||model.paused||devOpen||!!model.dialog;
 }
 function paintHomewardGuide(){
  let el=host.querySelector('.outside-homeward-guide');
  if(!el){
   el=document.createElement('aside');el.className='outside-homeward-guide';el.setAttribute('aria-label','귀가 안내');el.dataset.visible='false';el.setAttribute('aria-hidden','true');
   el.innerHTML='<div class="homeward-copy"><strong>집으로 가기</strong><small></small></div><span class="homeward-direction" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 12H6M11 7L6 12L11 17"/></svg></span>';
   host.querySelector('.outside-stage').append(el);
   // Establish the off-screen position before the first entrance transition.
   el.getBoundingClientRect();
  }
  const m=model,cue=homewardCues(m)[0];
  // Keep directions visible during conversations; boarding the lift hides them.
  // Do not use hidden/display:none: the exit must finish sliding off-screen.
  const visible=!!cue&&!m.paused&&!loading&&!loadError&&!devOpen&&!hintOpen&&!panorama&&!m.controlsTutorial&&!global.lunaCampaign?.blocking;
  if(el.dataset.visible!==String(visible)){el.dataset.visible=String(visible);el.setAttribute('aria-hidden',String(!visible));}
  if(!cue)return;
  const atTarget=m.near?.id===(cue.id==='lift'?'elevator':'home');
  const direction=atTarget?'up':cue.direction;
  const detail=atTarget?(cue.id==='lift'?'E · 엘리베이터로 위층 이동':'E · 집에 들어가기'):(cue.direction==='left'?'왼쪽 ':'오른쪽 ')+(cue.id==='lift'?'엘리베이터로 이동':'집 입구로 이동');
  if(el.dataset.direction!==direction)el.dataset.direction=direction;
  el.dataset.destination=cue.id;
  const copy=el.querySelector('small');if(copy.textContent!==detail)copy.textContent=detail;
 }
 function updateHUD(){if(!host)return;notices?.update(model);const m=model,near=m.near,overlay=host.querySelector('.outside-overlay'),hud=host.querySelector('.outside-hud'),viewpoint=atViewpoint(m)&&!panorama&&!loading&&!loadError&&!m.paused&&!devOpen;
  // Scripted pauses belong to the campaign/cutscene, not the outside ESC menu.
  const showPauseMenu=m.paused&&!global.lunaCampaign?.blocking;
  const signature=JSON.stringify([loading,loadError,m.paused,showPauseMenu,m.dialog,m.scene,m.level,near?.id,near?.label,!!m.ride,m.ride?.call,panorama,viewpoint,m.story.blocking,m.encounter?.stage,devOpen,hintOpen]);
  if(signature!==hudSignature){hudSignature=signature;
   host.querySelector('.outside-dynamic').innerHTML=`<button class="outside-interact" aria-label="${esc(near?.label||'상호작용')}" data-outside-action="interact" ${near&&!m.paused?'':'hidden'}><kbd aria-hidden="true">E</kbd><span>상호작용</span></button><button class="outside-viewpoint" aria-label="${panorama?'전경 보기에서 돌아오기':'거리 전경 보기'}" aria-pressed="${panorama}" data-outside-action="panorama" ${viewpoint?'':'hidden'}><kbd aria-hidden="true">Y</kbd></button>`;
   let body='';if(loading)body='<div class="resource-loading" role="status" aria-label="로딩 중"><span class="resource-loading-copy" aria-hidden="true">로딩 중<span class="resource-loading-dots"></span></span></div>';
   else if(loadError)body='<section class="outside-dialog"><h2>불러오기 실패</h2><p>'+loadError+'</p>'+button('다시 시도','retry')+button('로비로','exit')+'</section>';
   else if(hintOpen)body='<section class="outside-dialog outside-entry-hint" role="dialog" aria-modal="true" aria-labelledby="outside-hint-title"><kbd>P</kbd><h2 id="outside-hint-title">탐색 중에 설정을 바꿔 보세요</h2><p>P를 누르면 위치·출근길/퇴근길·일차를 변경할 수 있습니다.<br>99일차를 선택하면 QA 전용 공간으로 이동합니다.</p>'+button('확인','hint-close','primary')+'</section>';
   else if(showPauseMenu)body='<section class="outside-dialog" role="dialog" aria-modal="true" aria-label="외부 공간 설정"><h2>설정 · 조작 안내</h2>'+global.LunaFocusSettings.settingsHTML()+global.LunaStreetAudio.settingsHTML()+global.LunaDialogueAudio.settingsHTML()+'<p>A / D · ← / → : 이동<br>Shift : 누르는 동안 달리기<br>E : 상호작용 · 대사 진행<br>Space : 대사 진행<br>Y : 철망 앞 Y 표시에서 전경 보기 / 돌아오기<br>P : 개발자 콘솔 · 위치 / 이동 상태 / 일차 / 소지금<br>Esc : 설정 열기 / 닫기 · 일시정지<br>말풍선 클릭 : 대사 진행</p><div class="outside-menu-actions">'+button('계속하기','menu','primary')+button('같은 위치에서 다시 시작','restart')+button('탐색 시작 화면으로','exit')+'</div></section>';
   else if(m.dialog)body='<section class="outside-dialog outside-object-dialog" role="dialog" aria-modal="true" aria-label="'+esc(m.dialog.title)+'"><h2>'+esc(m.dialog.title)+'</h2><p>'+esc(m.dialog.text)+'</p>'+button('닫기 · E','interact','primary')+'</section>';
   overlay.innerHTML=body;overlay.hidden=!body;hud.inert=!!body||devOpen;
   if(body)overlay.querySelector('button')?.focus({preventScroll:true});
  }
  const prompt=host.querySelector('.outside-interact');if(prompt)prompt.hidden=!interactionTarget();
  const lookout=host.querySelector('.outside-viewpoint');if(lookout&&viewpoint){const p=position(VIEWPOINT.x,model.y+.26);lookout.style.left=clamp(p.x,24,1256)+'px';lookout.style.top=clamp(p.y-12,42,696)+'px';}
  paintControlsTutorial();updateSpeech();paintDev();paintHomewardGuide();host.querySelector('.outside-speech').inert=devOpen;host.querySelectorAll('.outside-background-speech').forEach(el=>el.inert=devOpen);

 }
 function updateSpeech(){
  renderSpeech(host.querySelector('.outside-speech'),model.story.view());
  const views=model.backgroundStory.views(),bubbles=[...host.querySelectorAll('.outside-background-speech')];
  while(bubbles.length<views.length){const el=document.createElement('div');el.className='outside-background-speech';host.querySelector('.outside-stage').insertBefore(el,host.querySelector('.outside-overlay'));bubbles.push(el);}
  bubbles.forEach((el,i)=>{if(i>=Math.max(1,views.length)){el.remove();return;}el.dataset.storyId=views[i]?.key.split(':')[0]||'';renderSpeech(el,views[i]||null,true);});
 }
 function renderSpeech(el,v,background=false){el.hidden=!v||model.paused||loading||!!loadError;if(!v){el.dataset.key='';return;}
  const key=v.key+':'+v.canTreat;
  if(el.dataset.key!==key){el.dataset.key=key;el.classList.toggle('is-auto',v.auto);el.setAttribute('role',v.auto?'status':v.choice?'group':'button');el.tabIndex=!v.auto&&!v.choice?0:-1;el.setAttribute('aria-label','대화');el.innerHTML=global.LunaExteriorTextbox.html()+'<p><span class="outside-speech-measure" aria-hidden="true">'+esc(v.full)+'</span><span class="'+(background?'outside-background-text':'outside-speech-text')+'" aria-label="'+esc(v.full)+'"></span></p>'+(v.purchase?'<div class="outside-choices bd-choices" role="group" aria-label="'+esc(v.purchase.label||'BD 칩 구매 선택')+'">'+v.purchase.options.map(o=>'<button data-outside-action="bd-choice" data-choice="'+o.id+'" '+(o.disabled?'disabled aria-disabled="true"':'')+'>'+esc(o.label)+(o.disabled?'<small>소지금이 부족합니다</small>':'')+'</button>').join('')+'<small class="bd-balance">소지금 '+v.purchase.money.toLocaleString('ko-KR')+'원</small></div>':'');if(!v.auto&&!devOpen)(el.querySelector('button:not(:disabled)')||el).focus({preventScroll:true});}

  el.querySelector('p').hidden=!v.full;
  global.LunaDialogueCue.sync(el,!v.auto&&!v.choice&&!!v.full&&v.text===v.full);
  const text=el.querySelector('.outside-speech-text,.outside-background-text');if(text.textContent!==v.text){text.replaceChildren();const marks=v.emphasis||[];let rest=v.text;while(rest){let index=rest.length,word='';for(const mark of marks){const at=rest.indexOf(mark);if(at>=0&&at<index){index=at;word=mark;}}if(!word){text.append(document.createTextNode(rest));break;}if(index)text.append(document.createTextNode(rest.slice(0,index)));const span=document.createElement('span');span.className='outside-story-emphasis';span.textContent=word;text.append(span);rest=rest.slice(index+word.length);}}
  const p=position(v.anchor.x,v.anchor.y);global.LunaWorldSpeech.place(el,{...p,scale:4.8/renderCam.w,gap:22});
 }
 function tick(dt){if(!active)return;notices?.update(model,loading?0:dt);if(!loading&&!loadError&&!global.LunaFocusSettings.hiddenPaused&&!devOpen&&!hintOpen&&!model.controlsTutorial){const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');model.tick(dt,{move:Number(right)-Number(left),run:keys.has('ShiftLeft')||keys.has('ShiftRight')});if(!model.paused){targetCamera(Math.min(dt,.05));global.LunaOutsideResidents.tickView(model,cam);}}draw();updateHUD();}
 document.addEventListener('change',e=>{const key=e.target.dataset?.outsideSetting;if(!key)return;const value=e.target.value;if(key==='place'&&Object.hasOwn(PLACES,value))config.place=value;if(key==='flow'&&Object.hasOwn(FLOWS,value))config.flow=value;if(key==='day')config.day=Number(value)===99?99:clamp(Number(value)||0,0,3);},true);
 document.addEventListener('click',e=>{if(active&&devOpen){const control=e.target.closest('.outside-dev-console [data-outside-action]');if(control&&!control.disabled){e.preventDefault();devAction(control.dataset.outsideAction);}return;}if(active&&!model.paused&&!loading&&!loadError&&e.target.closest('.outside-speech')&&!e.target.closest('button')&&model.story.blocking&&!model.story.speech.choice){e.preventDefault();clearInput();model.story.advance();updateHUD();return;}const b=e.target.closest('[data-outside-action]');if(!b)return;const a=b.dataset.outsideAction;e.preventDefault();if(a==='start'){Object.assign(config,{day:0,flow:'out',place:'bar'});start({showDevHint:true});return;}if(!active)return;if(a==='hint-close')dismissHint();else if(a==='exit')exit();else if(a==='retry'){exit();start();}else if(a==='menu')menu();else if(a==='restart'){clearInput();model.start(config);if(wakeSpawn)model.wakeAtSofa();panorama=false;snapCamera();hudSignature='';}else if(a==='bd-choice'){if(b.disabled)return;clearInput();model.story.choose(b.dataset.choice);}else if(a==='panorama')togglePanorama();else if(a==='interact'){clearInput();model.interact();}updateHUD();});
 window.addEventListener('keydown',e=>{if(!active)return;if(controlsTutorialKey(e)){e.preventDefault();e.stopImmediatePropagation();return;}if(devKey(e))return;
  if(hintOpen&&e.code!=='Tab'){if(e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&['Escape','Space','Enter','KeyE'].includes(e.code))dismissHint();return;}
  if(e.code==='Tab'){const scope=host.querySelector('.outside-overlay:not([hidden])')||(model.story.blocking?host.querySelector('.outside-speech'):host),buttons=[...(scope.matches('[tabindex="0"]')?[scope]:[]),...scope.querySelectorAll('button:not([hidden]):not(:disabled),[tabindex="0"]')].filter(b=>!b.closest('[inert]')&&b.getClientRects().length),i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;}
  if(global.lunaQA?.opened)return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(['KeyA','KeyD','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyY','Escape','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}
  if(e.code==='Escape'&&!e.repeat){menu();return;}
  if(loading||loadError||model.paused)return;
  if(model.story.speech?.choice){
   if(e.code==='Tab'||e.code==='ArrowUp'||e.code==='ArrowDown'){e.preventDefault();const buttons=[...host.querySelectorAll('.bd-choices button:not(:disabled)')],i=buttons.indexOf(document.activeElement),delta=e.shiftKey||e.code==='ArrowUp'?-1:1;buttons[(i+delta+buttons.length)%buttons.length]?.focus();return;}
   if(['KeyE','Space','Enter'].includes(e.code)){e.preventDefault();const choice=e.target.closest('.bd-choices button');if(e.code!=='KeyE'&&!e.repeat&&choice&&!choice.disabled)choice.click();return;}
  }
  if(e.code==='KeyY'){if(!e.repeat)togglePanorama();return;}
  if((e.code==='KeyE'||e.code==='Space'&&model.story.blocking||e.code==='Enter'&&e.target.matches('.outside-speech[role="button"]'))&&!e.repeat){e.preventDefault();clearInput();if(e.code==='KeyE')model.controlsInteractUntil=performance.now()+180;model.interact();updateHUD();return;}
  if(['KeyA','KeyD','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code))keys.add(e.code);
 },true);
 window.addEventListener('keyup',e=>{keys.delete(e.code);controlsDismissKeys.delete(e.code);});
 function loseFocus(){controlsDismissKeys.clear();if(!active)return;if(devOpen)toggleDev(false);clearInput();if(global.LunaFocusSettings.enabled&&!loading&&!loadError){model.paused=true;updateHUD();}}
 window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});window.addEventListener('resize',fit);
 function snapshot(view=null){if(!ctx||loading||loadError)return null;const oldCam=cam,oldScene=model.scene,oldPixelWidth=pixelWidth;try{if(view){cam={...view};pixelWidth=global.LunaPixelCamera.settledWidth(cam.w,surface);model.scene='street';}draw();return canvas.toDataURL('image/png');}finally{cam=oldCam;model.scene=oldScene;pixelWidth=oldPixelWidth;draw();}}
 return{get interactionGlow(){return glowRenderer.snapshot();},get active(){return active;},get devConsoleOpen(){return devOpen;},get model(){return model;},get loading(){return loading;},get loadError(){return loadError;},get camera(){return{...cam};},get renderCamera(){return{...renderCam};},get pixelSurface(){return{...surface};},config,lobbyHTML,start,exit,advanceDay,showControlsTutorial,controlsTutorialKey,notifyItem:(m,id)=>active&&m===model&&notices?.add(m,id),tick,clearInput,snapshot,snapCamera,openDev:()=>toggleDev(true),devAction,refreshHUD:updateHUD};
}
global.LunaOutside={Model:OutsideModel,create,streetDrawOrder,streetParallax,interactionAnchor,viewpoint:VIEWPOINT,atViewpoint,firstCommuteEntranceCue,homewardCues};
})(typeof window==='undefined'?globalThis:window);

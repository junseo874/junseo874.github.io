/* Optional neighborhood stories: Boobi, the lift repair, and the barrel gang. */
(function(W){
'use strict';
const R=W.LunaResidence.layout;
// These coordinates are visible soles, not Luna's pivot or an atlas corner.
const road=-.974,corridor=R.upperY-.274;
const places=Object.freeze({box:{x:R.homeX+.77,y:10.07},cat:{x:R.homeX+1.02,y:9.82},neighbor:{x:R.homeX+2.10,y:corridor},sofa:{x:2.65,y:-.46},chris:{x:1.75,y:road},repair:{x:R.elevatorX+.97,y:road},guard:{x:R.elevatorX-1.48,y:road},boss:{x:-15.5,y:road},gangmate:{x:-14.72,y:road}});
const motion=Object.freeze({neighborStop:places.cat.x+.60,neighborSpeed:.24,departureSpeed:.24,departureDuration:1.6});
const names={luna:'루나',boobi:'부비',neighbor:'옆집 아저씨',repair:'수리공',guard:'갱단원',chris:'크리스',boss:'덩치 큰 남자',gangmate:'갱단원'};
const action=name=>({type:'neighborhood-action',action:name});
// Dialogue content is projected from the web-owned shared CSV catalog.
const scripts=Object.fromEntries(Object.entries(W.LUNA_DATA?.sharedStory||{}).filter(([key])=>key.startsWith('neighborhood/')).map(([key,rows])=>[key.slice('neighborhood/'.length),rows]));
const progress=()=>W.barGame.progress;
const flags=()=>progress().flags;
const state=m=>m.neighborhood||(m.neighborhood={action:null,shake:0,neighbor:null,chris:null});
function sync(){const p=progress(),carry=W.lunaCampaign?.session?.carry;if(carry)Object.assign(carry,{money:p.money,flags:{...p.flags},inventory:{...p.inventory}});W.barGame.changed();}
function flag(key){flags()[key]=true;sync();}
function cancel(m){const n=m.neighborhood;if(!n)return;n.action=null;n.neighbor=null;n.chris=null;n.restCamera=null;}
function after(m,day,flow='in'){return !m.qa&&(m.config.day>day||m.config.day===day&&(flow==='in'||m.config.flow==='out'));}
const catAvailable=m=>after(m,2)&&!flags().boobi_adopted;
const repaired=()=>!!flags().elevator_repaired;
// Old saves may already own the bottle purchased from Shiba. Never charge
// those players again, even after the ingredient has been consumed.
const wildDogDone=()=>!!(flags().gang_wild_dog_received||flags().shiba_bought_wild_dog||Number(progress().inventory?.wild_dog)>0);
const bossPending=()=>!!(flags().gang_wild_dog_paid||flags().gang_wild_dog_repair_promised);
const bossDealKey=()=> (flags().gang_wild_dog_paid?'bossPay':'bossRepair')+(flags().gang_wild_dog_repeat_deal?'Repeat':'First');
function target(id,p,label,actor){return{id:'neighborhood-'+id,...p,label,actor};}
function targets(m){if(m.qa)return [];if(m.scene==='home')return flags().boobi_adopted?[target('home-cat',places.sofa,'부비')]:[];if(m.level)return catAvailable(m)?[target(flags().boobi_revealed?'cat':'box',flags().boobi_revealed?places.cat:places.box,flags().boobi_revealed?'부비':'흔들리는 박스')]:[];
 const list=[];if(after(m,1)&&!repaired())list.push(target('repair',places.repair,'수리공','repair'));if(after(m,0,'out')&&!flags().gang_pass_granted)list.push(target('guard',places.guard,'갱단원','guard'));if(after(m,2)&&flags().gang_pass_granted)list.push(target('boss',places.boss,names.boss,'boss'));return list;
}
function begin(m,key,t,done){m.anim='idle';if(Math.abs(t.x-m.x)>.02)m.facing=t.x>m.x?1:-1;W.outsidePlaytest?.clearInput();return m.story.beginRows('neighborhood/'+key,t,scripts[key],false,done);}
function repairScene(m,t){return begin(m,'repairPaid',t,()=>{
 state(m).repairDeparture={time:0,direction:m.x>=places.repair.x?-1:1};
 if(!repaired())return;
 const p=progress(),notices=W.LunaStoryNotices;
 notices.startGoal(p,'elevator_repair','엘레베이터 수리!',{silent:true});
 if(notices.completeGoal(p,'elevator_repair')){
  const carry=W.lunaCampaign?.session?.carry;if(carry)carry.objectives=structuredClone(p.objectives);
  sync();
 }
});}
function entryKey(t){
 if(t.id.endsWith('box'))return 'reveal';
 if(t.id.endsWith('home-cat'))return 'homeCat';
 if(t.id.endsWith('cat'))return flags().boobi_feeding_pending?'feed':'cat';
 if(t.id.endsWith('repair'))return flags().elevator_repair_paid?'repairPaid':flags().repairman_met?'repairMenu':'repairGreeting';
 if(t.id.endsWith('guard'))return null;
 if(t.id.endsWith('boss'))return wildDogDone()?'bossDone':bossPending()?bossDealKey():flags().gang_boss_met?'bossRepeat':'bossIntro';
 return null;
}
function preview(m,t){
 if(!t.id.startsWith('neighborhood-'))return null;
 const key=t.id.endsWith('guard')?(after(m,2)?'guardMenu':'guardBlocked'):entryKey(t);
 if(!key)return null;
 const p=progress(),next=[];
 if(key==='repairGreeting')next.push('repairIntro');
 if(key==='repairMenu'&&(p.money>=400||p.inventory?.gear_part>0))next.push('repairPaid');
 if(key==='guardMenu')next.push('guardPass');
 if(key==='cat'){next.push('pet');if(p.inventory?.tuna_can>0)next.push('feed');}
 if(key==='homeCat')next.push('pet');
 if(key==='bossIntro'||key==='bossRepeat'){
  const suffix=key==='bossIntro'?'First':'Repeat';
  if(key==='bossIntro')next.push('bossWait');
  if(repaired())next.push('bossRepair'+suffix);
  if(p.money>=500)next.push('bossPay'+suffix);
 }
 const flow=k=>({id:'neighborhood/'+k,rows:k==='pet'?[action('pet')]:scripts[k]});
 return {...flow(key),alternatives:next.map(flow)};
}
function interact(m,t){if(m.qa||!t.id.startsWith('neighborhood-')||!targets(m).some(v=>v.id===t.id))return false;
 if(t.id.endsWith('box'))return begin(m,'reveal',t);
 if(t.id.endsWith('home-cat'))return begin(m,'homeCat',t);
 if(t.id.endsWith('cat'))return begin(m,entryKey(t),t);
 if(t.id.endsWith('repair'))return flags().elevator_repair_paid?repairScene(m,t):begin(m,entryKey(t),t);
 if(t.id.endsWith('guard'))return begin(m,after(m,2)?'guardMenu':'guardBlocked',t);
 if(t.id.endsWith('boss'))return begin(m,entryKey(t),t);
 return false;
}
function choiceView(m){const stage=m.story.speech.line.stage,p=progress(),options=[];
 if(stage==='cat')options.push({id:'pet',label:'쓰다듬기'},{id:'feed',label:'참치캔 주기',disabled:!(p.inventory?.tuna_can>0),disabledReason:'참치캔이 없습니다.'});
 if(stage==='home-cat')options.push({id:'pet',label:'쓰다듬기'});
 if(stage==='repair-intro')options.push({id:'talk',label:'대화한다.'});
 if(stage==='repair')options.push({id:'gear',label:'기어 부품 건네주기',disabled:!(p.inventory?.gear_part>0),disabledReason:'기어 부품이 없습니다.'},{id:'pay',label:'비용 건네주기 · 400원',disabled:p.money<400,disabledReason:'돈이 부족합니다.'});
 if(stage==='guard')options.push({id:'ask',label:'술을 찾고 있어요.'});
 if(stage==='boss-first'||stage==='boss-repeat')return{money:p.money,label:names.boss,options:[
  {id:'boss-wait',label:'조금만 기다려주세요'},
  {id:'boss-repair',label:stage==='boss-first'?'이미 고쳤습니다.':'엘레베이터를 고쳤습니다.',disabled:!repaired()||wildDogDone()||bossPending(),disabledReason:wildDogDone()?'이미 받았습니다.':bossPending()?'거래 중입니다.':'엘리베이터 수리가 필요합니다.'},
  {id:'boss-pay',label:'돈을 드릴께요 · 500원',disabled:p.money<500||wildDogDone()||bossPending(),disabledReason:wildDogDone()?'이미 받았습니다.':bossPending()?'거래 중입니다.':'돈이 부족합니다.'}
 ]};
 options.push({id:'cancel',label:stage==='guard'?'자리를 뜬다.':stage==='repair-intro'?'무시한다.':'취소'});
 return{money:stage==='home-cat'?undefined:p.money,label:names[m.story.speech.line.actor]||'선택',options};
}
function choose(m,id){const s=m.story.speech;if(s?.line?.type!=='neighborhood-choice'||!s.choice)return false;
 const option=choiceView(m).options.find(o=>o.id===id);if(!option||option.disabled)return false;
 if(id==='cancel'){m.story.cancel();W.outsidePlaytest?.clearInput();return true;}
 const stage=s.line.stage,p=progress(),t=s.target;
 if((stage==='cat'||stage==='home-cat')&&id==='pet')return m.story.beginRows('neighborhood/pet',t,[action('pet')]);
 if(stage==='cat'&&id==='feed'){if(flags().boobi_adopted||flags().boobi_feeding_pending)return false;flags().boobi_feeding_pending=true;sync();return begin(m,'feed',t);}
 if(stage==='repair-intro'&&id==='talk')return begin(m,'repairIntro',t,()=>flag('repairman_met'));
 if(stage==='repair'&&!repaired()&&!flags().elevator_repair_paid){
  if(id==='pay')p.money-=400;else if(id!=='gear')return false;
  // Persist the paid order immediately so re-entry cannot charge twice.
  flags().elevator_repair_paid=true;sync();return repairScene(m,t);
 }
 if(stage==='guard'&&id==='ask')return begin(m,'guardPass',t,()=>flag('gang_pass_granted'));
 if(stage==='boss-first'||stage==='boss-repeat'){
  if(id==='boss-wait'){if(stage==='boss-first')return begin(m,'bossWait',t);m.story.cancel();W.outsidePlaytest?.clearInput();return true;}
  if(wildDogDone()||bossPending())return false;
  if(id==='boss-pay'){if(p.money<500)return false;p.money-=500;flags().gang_wild_dog_paid=true;}
  else if(id==='boss-repair'){if(!repaired())return false;flags().gang_wild_dog_repair_promised=true;}
  else return false;
  flags().gang_wild_dog_repeat_deal=stage==='boss-repeat';sync();return begin(m,bossDealKey(),t);
 }
 return false;
}
// Sound names are deliberately unbound until the supplied audio arrives.
function sound(cue){W.LunaNeighborhoodAudio?.play?.(cue);}
function startAction(m,row){
 if(row.action==='boss-met'||row.action==='wild-dog-grant'){
  if(row.action==='boss-met')flag('gang_boss_met');
  else if(!wildDogDone()&&bossPending()){
   const p=progress();p.inventory||={};p.inventory.wild_dog=(Number(p.inventory.wild_dog)||0)+1;p.flags.gang_wild_dog_received=true;
   delete p.flags.gang_wild_dog_paid;delete p.flags.gang_wild_dog_repair_promised;delete p.flags.gang_wild_dog_repeat_deal;
   sync();W.outsidePlaytest?.notifyItem?.(m,'wild_dog');W.LunaRestorationNotices?.check(W.barGame,W.lunaCampaign,m);
  }
  m.story.speech.index++;m.story.seek();return;
 }
 const n=state(m);n.action={name:row.action,time:0,speech:m.story.speech};m.anim='idle';W.outsidePlaytest?.clearInput();if(row.action==='feed')sound('tuna-open');if(['pet','meow'].includes(row.action))sound('boobi-meow');if(row.action==='neighbor-in'){
  n.neighbor={x:places.neighbor.x};
  m.facing=1;
 }m.updateNear();}
function endAction(m){const n=state(m),a=n.action;n.action=null;const s=m.story.speech;if(s===a.speech){s.index++;m.story.seek();}m.updateNear();}
function fastTravel(m){if(m.qa||m.scene!=='street'||!repaired()||m.ride||m.transition||state(m).action)return false;m.story.cancel();m.backgroundStory.cancel();W.outsidePlaytest?.clearInput();state(m).action={name:'fast',time:0};m.anim='idle';m.updateNear();return true;}
function beforeRest(m,done){if(!m||m.qa||m.scene!=='home'||!flags().boobi_adopted||flags().boobi_rest_seen)return false;m.paused=false;return begin(m,'rest',target('home-cat',places.sofa,'부비'),()=>{state(m).restCamera=null;state(m).chris=null;flag('boobi_rest_seen');done();});}
function fadeAlpha(m){const a=state(m).action;if(!a)return 0;if(a.name==='chris-in')return Math.max(0,Math.min(1,a.time/.45,(1.3-a.time)/.6));if(!['adopt','repair','fast'].includes(a.name))return 0;const hold=a.name==='repair'?1.7:.7;return Math.max(0,Math.min(1,a.time/.35,(hold+.45-a.time)/.45));}
function camera(m){const c=state(m).restCamera;if(!c||m.scene!=='home')return null;const t=Math.max(0,Math.min(1,c.time/2)),s=t*t*(3-2*t);return{x:c.from+(c.to-c.from)*s,y:.023,w:4.8};}
function tick(m,dt){if(m.qa)return false;const n=state(m),a=n.action;
 n.shake=Math.max(0,n.shake-dt);
 if(n.repairDeparture)n.repairDeparture.time=Math.min(motion.departureDuration,n.repairDeparture.time+dt);
 if(n.restCamera)n.restCamera.time+=dt;
 if(a){a.time+=dt;const t=a.time;let duration=1;
  if(a.name==='reveal'){duration=1.8;if(t>=duration)flag('boobi_revealed');}
  if(a.name==='feed')duration=1.5;
  if(a.name==='pet')duration=1.6;
  if(a.name==='neighbor-in'){duration=(places.neighbor.x-motion.neighborStop)/motion.neighborSpeed;n.neighbor.x=Math.max(motion.neighborStop,places.neighbor.x-t*motion.neighborSpeed);}
  if(a.name==='neighbor-out'){duration=(places.neighbor.x-motion.neighborStop)/motion.neighborSpeed;n.neighbor.x=Math.min(places.neighbor.x,motion.neighborStop+t*motion.neighborSpeed);if(t>=duration)n.neighbor=null;}
  if(a.name==='chris-in'){
   duration=2.7;
   if(t>=.45&&!a.swapped){a.swapped=true;n.chris={x:places.chris.x};m.x=2.20;m.y=-.7;m.facing=-1;
    const to=W.LunaHomeArt.cameraX(m.x,4.8);n.restCamera={from:to-.32,to,time:-.25};
    m.backgroundStory.cancel();W.outsidePlaytest?.snapCamera?.();m.revision++;
   }
  }
  if(['adopt','repair','fast'].includes(a.name)){
   duration=a.name==='repair'?2.15:1.15;
   if(t>=.4&&!a.swapped){a.swapped=true;
    if(a.name==='adopt'){delete flags().boobi_feeding_pending;flag('boobi_adopted');m.scene='home';m.level=1;m.x=2.02;m.y=-.7;m.facing=1;m.elevatorY=R.elevatorTop;}
    if(a.name==='repair'){sound('elevator-repair');flag('elevator_repaired');}
    if(a.name==='fast'){m.level=m.level?0:1;m.x=R.elevatorX;m.elevatorY=m.level?R.elevatorTop:R.elevatorBottom;m.y=m.level?R.upperY:-.7;m.arrivals++;}
    m.backgroundStory.cancel();W.outsidePlaytest?.snapCamera?.();m.revision++;
   }
  }
  m.animTime+=dt;if(t>=duration)endAction(m);return true;
 }
 if(m.scene==='street'&&m.level&&catAvailable(m)&&!flags().boobi_box_shaken&&!m.transition&&!m.ride&&Math.abs(m.x-places.box.x)<.85){flag('boobi_box_shaken');n.shake=.9;}
 return false;
}
function clampBoundary(m,x){if(m.qa||m.scene!=='street'||m.level||!after(m,0,'out')||flags().gang_pass_granted)return x;
 // Collision only. The guard remains in E-interaction range at this edge;
 // approaching must not start dialogue or consume the first-interaction badge.
 return Math.max(x,places.guard.x+.34);
}
// Rendering and UI anchors consume the exact same pose (sole, scale and facing).
function campFacing(m,id,x){
 const s=m.story.speech;
 // Only the people involved in a direct camp conversation turn toward Luna.
 // Keep their attention through replies/choices, not just their own spoken line.
 const engaged=!m.level&&s&&!s.auto&&s.id.startsWith('neighborhood/')&&campActors.has(s.target?.actor)&&
  (s.target.actor===id||s.rows.some(row=>row.actor===id));
 const targetX=engaged?m.x:id==='boss'?places.gangmate.x:places.boss.x;
 return W.LunaOutsideAmbient.faceTarget(x,targetX);
}
function poses(m){
 const n=state(m),a=n.action,list=[];
 const add=(id,kind,x,y,scale=1,flip=W.LunaOutsideAmbient.faceTarget(x,m.x),alpha=1)=>list.push({id,kind,x,y,scale,flip,alpha,sp:{asset:'ambient-'+kind,x:W.LunaOutsideAmbient.frameIndex(m.time)*129,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});
 if(m.scene==='street'){
  if(after(m,1)&&!repaired()||m.story.speech?.id==='neighborhood/repairPaid')add('repair','M2',places.repair.x,places.repair.y);
  else if(n.repairDeparture?.time<motion.departureDuration){const d=n.repairDeparture;add('repair','M2',places.repair.x+d.direction*d.time*motion.departureSpeed,places.repair.y,1,d.direction>0,Math.min(1,(motion.departureDuration-d.time)/.5));}
  if(after(m,0,'out')){
   const camp=(id,kind,x,y,scale=1)=>add(id,kind,x,y,scale,campFacing(m,id,x));
   camp('guard','M1',places.guard.x,places.guard.y);
   camp('boss','M2',places.boss.x,places.boss.y,1.12);
   camp('gang-left','M1',-16.08,road);
   camp('gang-far','W1',-16.38,road);
   camp('gangmate','M2',places.gangmate.x,places.gangmate.y);
  }
  if(n.neighbor){const moving=a?.name?.startsWith('neighbor-'),out=a?.name==='neighbor-out',duration=(places.neighbor.x-motion.neighborStop)/motion.neighborSpeed;
   add('neighbor','M1',n.neighbor.x,places.neighbor.y,1,moving?out:W.LunaOutsideAmbient.faceTarget(n.neighbor.x,m.x),out?Math.max(0,Math.min(1,(duration-a.time)/.4)):1);}
 }else if(m.scene==='home'&&n.chris)add('chris','M1',n.chris.x,places.chris.y,1,true);
 return list;
}
function anchor(m,actor,stable=false){
 if(actor==='boobi'){const p=m.scene==='home'?places.sofa:places.cat;return{x:p.x,y:p.y+.2275};}
 const p=poses(m).find(p=>p.id===actor);if(!p)return null;
 const head=W.LunaOutsideAmbient.head(p.sp,p.x,p.y,p.scale,p.scale,p.flip)||{x:p.x,y:p.y+(p.kind==='M2'?.61:.56)*p.scale};
 // Badges belong to the actor's fixed origin, not its mirrored head offset.
 // Dialogue can still follow the facing-aware head as before.
 return stable?{x:p.x,y:head.y}:head;
}
function targetAnchor(m,t,stable=false){
 if(t.id==='neighborhood-box')return{x:places.box.x,y:places.box.y+.01};
 return anchor(m,t.actor||(t.id.endsWith('cat')?'boobi':null),stable);
}
function faceConversation(m,line){
 if(!m.story.speech?.id.startsWith('neighborhood/'))return;
 const other=line.actor==='luna'?(state(m).chris?'chris':state(m).neighbor?'neighbor':m.story.speech.target.actor||(m.story.speech.target.id?.endsWith('cat')?'boobi':null)):line.actor;
 const p=anchor(m,other);if(p&&Math.abs(p.x-m.x)>.02)m.facing=p.x>m.x?1:-1;
}
function human(sprite,p){sprite(p.sp,p.x,p.y,p.scale,p.scale,p.flip,p.alpha);}
const campActors=new Set(['guard','boss','gang-left','gang-far','gangmate']);
const inCamp=m=>m.scene==='street'&&!m.level&&after(m,0,'out')&&m.x<places.guard.x+.4;
// The camp uses the walking strip in FRONT of the black scrap silhouette.
// Keep actors and Luna on one plane; corridor rails/lift still keep their depth.
function drawCamp(m,sprite){if(m.qa||m.scene!=='street')return;poses(m).filter(p=>campActors.has(p.id)).forEach(p=>human(sprite,p));}
const catFrames=new Map();
function catFrame(time,pose){
 const frame=Math.floor((time*2%(Math.PI*2))/(Math.PI*2)*16),key=pose+'-'+frame;
 if(catFrames.has(key))return catFrames.get(key);
 const image=document.createElement('canvas');image.width=40;image.height=44;
 const ctx=image.getContext('2d');ctx.translate(20,38);
 paintCat(ctx,frame/16*Math.PI*2,pose);
 const value={image,sp:{asset:'neighborhood-cat-'+key,x:0,y:0,w:40,h:44,pivot:{x:.5,y:6/44}}};catFrames.set(key,value);return value;
}
function drawCat(ctx,position,x,y,time,pose='sit',glow){
 const p=position(x,y),scale=Math.abs(position(x+1,y).x-p.x)/100;
 ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(scale*.65,scale*.65);
 if(pose==='pet')ctx.rotate(Math.sin(time*7)*.035*Math.sin(Math.PI*Math.min(1,time/1.6)));
 // Replaceable Canvas dummy: a small grey cat, not a new human asset.
 ctx.fillStyle='#121a20';ctx.beginPath();ctx.ellipse(0,0,13,3,0,0,Math.PI*2);ctx.fill();
 const {image,sp}=catFrame(time,pose);ctx.drawImage(image,-20,-38);
 // Share the sprite-alpha outline, excluding the floor shadow and food tin.
 glow?.paint(ctx,image,sp,null,x,y,40,44);ctx.restore();
 if(pose==='pet'){
  // Small rising hearts and a relaxed face; no extra hand/sprite or audio asset.
  for(let i=0;i<2;i++){
   const t=(time-.12-i*.32)/1.05;if(t<=0||t>=1)continue;
   const h=position(x+.09+i*.065,y+.26+t*.10),s=scale*.65;
   ctx.save();ctx.globalAlpha=Math.sin(t*Math.PI);ctx.translate(h.x,h.y);ctx.scale(s,s);
   ctx.fillStyle='#e6a3ab';ctx.beginPath();ctx.moveTo(0,3);ctx.bezierCurveTo(-8,-2,-4,-7,0,-3);ctx.bezierCurveTo(4,-7,8,-2,0,3);ctx.fill();ctx.restore();
  }
 }
 if(pose==='eat'){const p=position(x+.12,y),s=scale*.65;ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);ctx.fillStyle='#85949c';ctx.fillRect(-4,-4,8,5);ctx.fillStyle='#b99772';ctx.beginPath();ctx.ellipse(0,-4,4,2,0,0,Math.PI*2);ctx.fill();ctx.restore();}
}
function paintCat(ctx,phase,pose){
 ctx.strokeStyle='#737f89';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(6,-3);ctx.quadraticCurveTo(18,-7,12+Math.sin(phase)*(pose==='pet'?3:1),pose==='pet'?-18:-14);ctx.stroke();
 ctx.fillStyle='#8d969e';ctx.beginPath();ctx.ellipse(0,-10,7,pose==='eat'?7:11,0,0,Math.PI*2);ctx.fill();
 const head=pose==='eat'?-7:-25;ctx.beginPath();ctx.moveTo(-8,head+3);ctx.lineTo(-8,head-10);ctx.lineTo(-2,head-5);ctx.lineTo(3,head-5);ctx.lineTo(8,head-10);ctx.lineTo(8,head+3);ctx.closePath();ctx.fill();
 ctx.fillStyle='#b9c3c8';ctx.fillRect(-5,head+2,10,5);
 if(pose==='pet'){
  ctx.strokeStyle='#343f46';ctx.lineWidth=1.3;
  for(const x of [-4,4]){ctx.beginPath();ctx.moveTo(x-2,head);ctx.quadraticCurveTo(x,head+2,x+2,head);ctx.stroke();}
 }else{ctx.fillStyle='#d4d383';ctx.fillRect(-5,head-2,3,2);ctx.fillRect(3,head-2,3,2);}
 ctx.fillStyle='#3c4147';ctx.fillRect(-1,head+2,2,2);
 ctx.fillStyle='#aeb8bf';ctx.fillRect(-7,-2,5,3);ctx.fillRect(2,-2,5,3);
}
function draw(m,sprite,ctx,position,images,glow){if(m.qa)return;const n=state(m),a=n.action;
 if(m.scene==='street'){
  poses(m).filter(p=>!campActors.has(p.id)).forEach(p=>human(sprite,p));
  if(catAvailable(m)){
   if(n.shake>0){const img=images.get('residence-building'),left=R.homeX-5.83,top=14.32,p=position(left+6.47,top-4.24),q=position(left+6.74,top-4.52),w=q.x-p.x,h=q.y-p.y;if(img){ctx.drawImage(img,619,424,27,28,p.x,p.y,w,h);ctx.save();ctx.translate(p.x+Math.sin(n.shake*40)*w/27,p.y);ctx.drawImage(img,647,424,27,28,0,0,w,h);glow?.paint(ctx,img,{asset:'residence-building',x:647,y:424,w:27,h:28,pivot:{x:0,y:1}},{name:'neighborhood-shaking-box'},places.box.x,places.box.y,w,h);ctx.restore();}}
   if(a?.name==='reveal'&&a.time<.55){const p=position(places.box.x,places.box.y-.14),s=Math.abs(position(places.box.x+.01,places.box.y).x-p.x);ctx.fillStyle='#d4d383';ctx.fillRect(p.x-4*s,p.y,2*s,s);ctx.fillRect(p.x+2*s,p.y,2*s,s);}
   if(flags().boobi_revealed||a?.name==='reveal'&&a.time>=.55){let p=places.cat;if(a?.name==='reveal'){const t=Math.min(1,(a.time-.55)/.9);p={x:places.box.x+(places.cat.x-places.box.x)*t,y:places.box.y+(places.cat.y-places.box.y)*t+Math.sin(t*Math.PI)*.55};}drawCat(ctx,position,p.x,p.y,a?.name==='pet'?a.time:m.time,a?.name==='feed'?'eat':a?.name==='pet'?'pet':'sit',glow);}
  }
 }else if(m.scene==='home'){
  if(flags().boobi_adopted)drawCat(ctx,position,places.sofa.x,places.sofa.y,a?.name==='pet'?a.time:m.time,a?.name==='pet'?'pet':'sit',glow);
  poses(m).forEach(p=>human(sprite,p));
 }
}
W.LunaOutsideNeighborhood={places,motion,scripts,after,targets,interact,preview,choose,choiceView,action:startAction,cancel,tick,draw,drawCamp,inCamp,poses,anchor,targetAnchor,faceConversation,camera,clampBoundary,fastTravel,repaired,beforeRest,fadeAlpha};
})(window);

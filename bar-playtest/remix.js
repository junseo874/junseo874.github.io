(function(root){
'use strict';
const C=typeof module==='undefined'?root.LunaCore:require('./core.js');
const PROFILES={cozy:{patience:1.6,delay:18,shake:C.MIX.shakeTargetStacks,stir:8,upkeep:.24},standard:{patience:1.2,delay:14,shake:C.MIX.shakeTargetStacks,stir:8,upkeep:.4},challenge:{patience:1,delay:11,shake:C.MIX.shakeTargetStacks,stir:8,upkeep:.55}};
const complexity=(g,c)=>g.t.recipes.filter(r=>r.context===c.id&&!r.auto_apply).length+(c.mix==='build'?0:2);
function challengeUpkeep(g,day,difficulty='standard'){
 const rows=g.t.cocktails.filter(c=>c.status==='confirmed'&&(Number(day)===99||Number(c.unlock_day)<=Number(day)));
 const prices=rows.map(c=>Number(c.price)).sort((a,b)=>a-b),median=prices[Math.floor(prices.length/2)]||50;
 return Math.round((Number(g.cfg.gold_start)||300)+median*8*PROFILES[difficulty].upkeep);
}
function attach(g){
 const base={};for(const key of ['reset','startGeneral','startStoryPhase','spawn','beginOrder','nextGimmick','gimmickInput','tickGimmick','tick','endGimmick','offer','discard','settle','resolveServe','leave','applyAffinity','debugCraft','debugFill','serve','setBarks','tickGeneral','bark'])base[key]=g[key].bind(g);
 g.variant='original';g.remix=null;
 const active=()=>g.variant==='gpt'&&!!g.remix;
 const notice=(ko,en,kind='good')=>{if(active())g.remix.notice={ko,en,kind,until:g.realTime+4};};
 const cue=(kind)=>{if(active())g.remix.cue={id:++g.remix.cueSerial,kind};};
 g.reset=function(day=0,mode='full',seed=1,run=true,settings={}){
  this.variant=settings.variant||this.variant||'original';
  const difficulty=settings.difficulty||this.remix?.difficulty||'standard';
  const assist=settings.assist??this.remix?.assist??true;
  this.remix=this.variant==='gpt'?{difficulty,assist,profile:PROFILES[difficulty]||PROFILES.standard,challenge:mode==='challenge',episode:mode==='episode',episodeReaction:null,combo:0,maxCombo:0,good:0,excellent:0,served:0,variety:new Set(),bonus:0,goalBonus:0,crafts:0,scores:[],previousOrder:null,hold:null,resultLock:0,notice:null,cue:null,cueSerial:0,debug:false,goalsPaid:false}:null;
  let upkeep=active()&&mode==='episode'?0:settings.upkeepOverride;
  if(active()&&mode==='challenge'&&upkeep==null)upkeep=challengeUpkeep(this,day,difficulty);
  base.reset(day,['challenge','episode'].includes(mode)?'general':mode,seed,run,{...settings,upkeepOverride:upkeep});
  this.mode=mode;if(active()&&this.remix.episode&&root.LunaRemixExperience)root.LunaRemixExperience.lastEpisode=null;
  if(active())this.log('gpt_session',{difficulty,assist,challenge:mode==='challenge',upkeep:this.upkeepOverride});
 };
 g.startGeneral=function(){
  if(!active()||!this.remix.challenge&&!this.remix.episode)return base.startGeneral();
  this.phase='general';this.progress.phase='bar_open';this.screen='bar';this.seats={L:null,M:null,R:null};this.story=null;this.dialogue=null;this.choice=null;this.currentOrder=null;
  const personalities=this.remix.episode?['quiet']:['gentle','gentle','quiet','chatty','gentle','rough','quiet','touchy'];
  this.queue=personalities.map((p,i)=>({seq:i+1,day:this.day,personality:this.t.personalities.some(x=>x.id===p)?p:this.t.personalities[i%this.t.personalities.length].id,delay_sec:this.remix.profile.delay,max_rounds:1,order:this.remix.episode?'gin_tonic':null,remixEpisode:this.remix.episode}));
  this.queueIndex=0;this.spawnBlocked=false;this.spawnLeft=2;this.focus='L';
  this.log('phase_start',{phase:'general',slots:8,experimental:true});
 };
 g.startStoryPhase=function(phase){if(active()&&(this.remix.challenge||this.remix.episode)&&phase==='bar')return this.finishDay();return base.startStoryPhase(phase);};
 g.spawn=function(){const before=this.queueIndex;base.spawn();if(active()&&this.queueIndex>before){const guest=Object.values(this.seats).find(x=>x?.slot===this.queue[before]);if(guest){guest.limit*=this.remix.profile.patience;guest.coasterLimit=guest.limit;guest.left=guest.limit;cue('arrival');}}};
 g.bark=function(guest,situation,actor=null){
  if(!active()||!guest.slot.remixEpisode)return base.bark(guest,situation,actor);
  const lines={
   call:['아직 한 잔 주문해도 될까요? 오늘 일이 좀 늦게 끝났어요.','Could I still order a drink? Work ran late today.'],
   ask_order:['네. 어떤 걸로 드릴까요?','Of course. What would you like?'],
   order_think:['오늘은 복잡한 건 생각하고 싶지 않네요.','I don’t want to think about anything complicated tonight.'],
   order:['진토닉 한 잔 주세요. 조용히 마시다 가고 싶어요.','A gin and tonic, please. I’d like to sit quietly for a while.'],
   idle:['……여기는 잠깐 아무 말 안 해도 돼서 좋네요.','…It’s nice not having to say anything for a while.'],
   serve_thanks:['고마워요. 잠깐만요, 한 모금 마셔 볼게요.','Thanks. Let me take a sip.'],
   react_excellent:['……딱 원하던 맛이네요. 이제야 오늘 일이 끝난 것 같아요.','…Exactly what I wanted. It finally feels like the workday is over.'],
   react_good:['시원하네요. 한 잔 마시니까 조금 숨이 트여요.','Refreshing. One drink gives me a little room to breathe.'],
   react_decent:['생각했던 맛과 조금 다르지만, 여기 앉아 있으니 좀 낫네요.','A little different from what I expected, but sitting here helps.'],
   react_poor:['음… 오늘은 맛이 좀 다르네요. 다음에는 레시피대로 부탁해요.','Hmm… Not quite right tonight. Please follow the recipe next time.'],
   react_sewage:['이건 마시기 어렵겠어요. 다음엔 재료부터 확인해 주세요.','I can’t really drink this. Please check the ingredients next time.'],
   wrong_receive:['어, 제가 부탁한 건 진토닉이었는데요.','Oh, I asked for a gin and tonic.'],
   wrong_drink:['잘 만든 술이어도, 오늘 제가 원한 건 다른 한 잔이었어요.','Even a well-made drink isn’t the one I wanted tonight.'],
   bye_good:['잘 쉬었다 가요. 다음에 또 들를게요.','That was a good break. I’ll come by again.'],
   bye_bad:['오늘은 이만 가 볼게요. 다음엔 제 주문을 기억해 주세요.','I’ll head home now. Please remember my order next time.']
  };
  const pair=lines[situation];if(!pair)return base.bark(guest,situation,actor);
  const text=pair[this.lang==='en'?1:0];if(situation.startsWith('react_')||situation==='wrong_drink')this.remix.episodeReaction=text;
  return {...this.makeLine(actor||guest.actor,text,'rx_episode_'+situation),situation};
 };
 g.beginOrder=function(guest,reorder){
  if(active()&&this.remix.challenge){
   const all=this.cocktailsAvailable().slice().sort((a,b)=>complexity(this,a)-complexity(this,b)||a.id.localeCompare(b.id));
   const served=this.remix.served,limit=Math.min(all.length,served<2?4:served<5?10:all.length);
   let pool=all.slice(0,limit).filter(c=>c.id!==this.remix.previousOrder);if(!pool.length)pool=all;
   const chosen=pool[Math.floor(this.rng()*pool.length)];
   if(chosen){guest.slot={...guest.slot,order:chosen.id};this.remix.previousOrder=chosen.id;}
  }
  base.beginOrder(guest,reorder);
  if(active()){const done=guest.lineDone;guest.lineDone=()=>{done?.();guest.limit*=this.remix.profile.patience;guest.left=guest.limit;guest.memory=guest.order?.cocktail;cue('order');};}
 };
 g.nextGimmick=function(){
  base.nextGimmick();if(!active())return;
  const s=this.gimmick;if(s){if(s.type==='shake')s.targetStacks=this.remix.profile.shake;if(s.type==='stir')s.targetStacks=this.remix.profile.stir;}
  else if(this.result){
   if(this.remix.debug)this.result.debug=true;
   if(!this.result.representatives.length){this.result.penalties.gimmick=100;this.result.score=0;this.result.grade='sewage';this.resultContext.craft_grade='sewage';}
   this.remix.resultLock=1.1;this.remix.crafts++;this.remix.scores.push(this.result.score);
   this.onRemixRecord?.(this.result);cue(this.result.score>=80?'complete':'low');
  }
 };
 g.gimmickInput=function(key){
  if(!active())return base.gimmickInput(key);
  const s=this.gimmick;if(!s||this.screen!=='gimmick'||this.isPaused()||s.completed||this.remix.hold)return false;
  // All versions share the actual engine mix input rules. Difficulty changes counts only.
  const before=s.attempts,fail=s.failures,step=s.stirStep,result=base.gimmickInput(key);
  if(result){if(s.failures>fail||s.attempts>before&&s.message==='MISS')cue('miss');else if(s.completed||s.stirStep!==step||s.attempts>before)cue('hit');}
  return result;
 };
 g.tickGimmick=function(dt){
  if(!active()||this.gimmick?.fluid)return base.tickGimmick(dt);
  const s=this.gimmick;if(!s||!s.started||this.remix.hold)return;
  base.tickGimmick(dt);
  if(s.completed&&!this.remix.hold)this.endGimmick();
 };
 g.endGimmick=function(){
  if(!active()||this.gimmick?.fluid)return base.endGimmick();
  const s=this.gimmick;if(!s||this.isPaused()||!s.started||this.remix.hold)return false;
  if(s.type==='open'&&!s.completed)return false;
  s.held=false;const remaining=this.minigame&&s.type==='open'?Math.max(.85,C.OPEN.minigameHoldSec-(s.openFx?.age||0)):.85;this.remix.hold={remaining,step:s};cue('step');return true;
 };
 g.tick=function(dt){
  if(active()&&!this.isPaused()&&!this.finished){
   const d=Math.max(0,Math.min(dt,.2));this.remix.resultLock=Math.max(0,this.remix.resultLock-d);
   if(this.remix.hold){this.realTime+=d;C.MIX.visual(this.remix.hold.step,d);C.OPEN.visual(this.remix.hold.step,d);this.remix.hold.remaining-=d;if(this.remix.hold.remaining<=0){this.remix.hold=null;base.endGimmick();}return;}
  }
  base.tick(dt);
 };
 for(const key of ['offer','discard'])g[key]=function(){if(active()&&this.remix.resultLock>0)return false;return base[key]();};
 g.resolveServe=function(order,drink){const result=base.resolveServe(order,drink);return active()?{...result,experimentalDebug:!!drink.debug}:result;};
 g.setBarks=function(guest,situations,onDone=null){
  if(!active()||this.phase!=='general'||situations.length!==2||!['serve_thanks','wrong_receive'].includes(situations[0]))return base.setBarks(guest,situations,onDone);
  return base.setBarks(guest,[situations[0]],()=>{guest.state='DRINKING';guest.drinkLeft=this.remix.episode?2:1.2;guest.lines=[];guest.afterDrink=()=>{guest.glassEmpty=true;guest.state='REACTION';base.setBarks(guest,[situations[1]],onDone);};});
 };
 g.serve=function(seat,input){const glass=this.drink?.actual?.glass,ok=base.serve(seat,input);if(active()&&ok&&this.seats[seat]){this.seats[seat].glassKind=glass;this.seats[seat].glassEmpty=false;}return ok;};
 g.tickGeneral=function(dt){if(active()&&this.remix.episode)for(const guest of Object.values(this.seats).filter(Boolean)){if(['WAIT_COASTER','WAIT_SERVE'].includes(guest.state)){guest.left=guest.limit;guest.idleLeft=3600;}}base.tickGeneral(dt);if(active())for(const guest of Object.values(this.seats).filter(x=>x?.state==='DRINKING')){guest.drinkLeft-=dt*this.speed;if(guest.drinkLeft<=0){const fn=guest.afterDrink;guest.afterDrink=null;fn?.();}};};
 g.settle=function(result,guest){
  const previous=this.transactionIds.has(result.orderId),trx=base.settle(result,guest);
  if(!active()||previous||!trx||this.phase==='practice')return trx;
  const r=this.remix;r.served++;r.variety.add(result.served);r.debug=r.debug||!!result.experimentalDebug;
  if(result.match&&['good','excellent'].includes(result.grade)){r.good++;r.combo++;r.maxCombo=Math.max(r.maxCombo,r.combo);if(result.grade==='excellent')r.excellent++;}else r.combo=0;
  const bonus=!r.challenge||r.debug||result.experimentalDebug?0:Math.min(12,Math.max(0,r.combo-1)*3);r.bonus+=bonus;this.progress.money+=bonus;trx.experimentalBonus=bonus;
  if(bonus)notice(`${r.combo}연속 좋은 한 잔 · +${bonus}G`,`${r.combo} great drinks in a row · +${bonus}G`);
  else if(r.challenge)notice(result.match&&result.grade!=='sewage'?'한 잔 잘 전달했어요.':'다음 잔에서 만회할 수 있어요.',result.match&&result.grade!=='sewage'?'Another drink served.':'A fresh chance with the next drink.',result.grade==='sewage'?'warn':'good');
  this.log('gpt_service',{combo:r.combo,bonus,debug:!!result.experimentalDebug});cue(result.grade==='sewage'?'miss':'complete');return trx;
 };
 g.leave=function(guest,situation){if(active()){this.remix.combo=0;notice('손님이 떠났어요. 다음 주문부터 다시 시작해요.','A guest left. Start a fresh streak.','warn');cue('miss');}return base.leave(guest,situation);};
 g.applyAffinity=function(actor,result){const before=Number(this.progress.affinity[actor]||0);base.applyAffinity(actor,result);const delta=Number(this.progress.affinity[actor]||0)-before;if(active()&&this.remix.challenge&&delta)notice(`${this.name(actor)} 호감도 ${delta>0?'+':''}${delta}`,`${this.name(actor)} affinity ${delta>0?'+':''}${delta}`,delta>0?'good':'warn');};
 const finish=g.finishDay.bind(g);
 g.finishDay=function(){
  if(active()&&this.remix.challenge&&!this.finished&&!this.remix.goalsPaid){const r=this.remix;r.goalsPaid=true;r.goals=[{id:'quality',ok:r.good>=4,reward:30},{id:'variety',ok:r.variety.size>=3,reward:20},{id:'streak',ok:r.maxCombo>=3,reward:20}];r.goalBonus=r.debug?0:r.goals.reduce((sum,x)=>sum+(x.ok?x.reward:0),0);this.progress.money+=r.goalBonus;this.log('gpt_goals',{goals:r.goals,bonus:r.goalBonus,debug:r.debug});}
  if(active()&&this.remix.episode&&root.LunaRemixExperience){const trx=this.transactions.at(-1);root.LunaRemixExperience.lastEpisode={title:trx?this.name(trx.served):'아직 건네지 못한 한 잔',text:this.remix.episodeReaction||'이번에는 손님의 반응까지 듣지 못했다.',debug:this.remix.debug};}
  return finish();
 };
 g.remixRetry=function(){if(!active())return false;return this.discard();};
 g.debugFill=function(){if(active()&&this.screen==='prep')this.remix.debug=true;return base.debugFill();};
 g.debugCraft=function(grade){if(active()){this.remix.hold=null;this.remix.debug=true;}return base.debugCraft(grade);};
 g.remixNotice=notice;
 return{active,challengeUpkeep:(day,difficulty)=>challengeUpkeep(g,day,difficulty),complexity:c=>complexity(g,c)};
}
const api={attach,challengeUpkeep,complexity,PROFILES};if(typeof module!=='undefined')module.exports=api;root.LunaRemix=api;
})(typeof window==='undefined'?globalThis:window);

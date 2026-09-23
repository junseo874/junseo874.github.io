(function(root){
'use strict';
const GRADES=['sewage','poor','decent','good','excellent'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const n=(v,d=0)=>v==null||v===''?d:Number(v);
const sortSeq=a=>[...a].sort((a,b)=>n(a.seq)-n(b.seq));
const clean=s=>String(s??'').replace(/<[^>]*>/g,'');
function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
function weighted(rows,rng){let sum=rows.reduce((a,r)=>a+n(r.weight,1),0),x=rng()*sum;for(const r of rows){x-=n(r.weight,1);if(x<=0)return r;}return rows.at(-1);}
function contextValue(key,c){
 if(key==='true')return true;if(key==='false')return false;if(/^[-+]?\d+(\.\d+)?$/.test(key))return Number(key);
 if(/^(['"]).*\1$/.test(key))return key.slice(1,-1);
 if(GRADES.includes(key))return GRADES.indexOf(key);
 if(key.startsWith('flag.'))return c.flags[key.slice(5)]??false;
 if(key.startsWith('affinity.'))return c.affinity[key.slice(9)]??0;
 if(['day','money','phase','reputation'].includes(key))return c[key]??0;
 if(['grade','final_grade','craft_grade','order_match'].includes(key)){
   if(c[key]==null)throw Error('결과 문맥 없음: '+key);
   return key==='order_match'?c[key]:GRADES.indexOf(c[key]);
 }
 if(key==='cocktail.id')return c.cocktail?.id;
 if(key==='cocktail.abv')return n(c.cocktail?.abv);
 if(key==='ordered_cocktail.id')return c.ordered;
 if(key==='served_cocktail.id')return c.served;
 const tag=key.match(/^cocktail\.tag\((.+)\)$/);if(tag)return(c.tags||[]).includes(tag[1]);
 if(/^[A-Za-z가-힣_][\w가-힣-]*$/.test(key))return key;
 throw Error('지원하지 않는 조건 값: '+key);
}
function condition(expr,c){
 if(!expr)return true;
 if(expr.includes('||'))throw Error('지원하지 않는 OR 조건: '+expr);
 return expr.split('&&').every(raw=>{const s=raw.trim();const m=s.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if(m){const a=contextValue(m[1].trim(),c),b=contextValue(m[3].trim(),c);return({'==':()=>a===b,'!=':()=>a!==b,'>=':()=>a>=b,'<=':()=>a<=b,'>':()=>a>b,'<':()=>a<b})[m[2]]();}
  return s.startsWith('!')?!contextValue(s.slice(1),c):!!contextValue(s,c);
 });
}
function applyEffects(expr,state){
 if(!expr)return;
 const next={...state,flags:{...state.flags},affinity:{...state.affinity}};
 for(const raw of expr.split(';').filter(s=>s.trim())){
  const m=raw.trim().match(/^(flag\.[\w]+|affinity\.[\w]+|money|reputation)\s*(\+=|-=|=)\s*(true|false|[-+]?\d+(?:\.\d+)?)$/);
  if(!m)throw Error('상태 변경 해석 실패: '+raw);
  const [_,key,op,value]=m;const v=value==='true'?true:value==='false'?false:Number(value);let obj=next,k=key;
  if(key.startsWith('flag.')){obj=next.flags;k=key.slice(5);}if(key.startsWith('affinity.')){obj=next.affinity;k=key.slice(9);}
  if(key.startsWith('flag.')&&(typeof v!=='boolean'||op!=='='))throw Error('플래그에는 true/false 대입만 허용');
  obj[k]=op==='='?v:n(obj[k])+(op==='+='?1:-1)*v;
 }
 Object.assign(state,next);
}
function band(rows,type,x){
 const row=rows.find(r=>r.band_type===type&&(r.min_ratio==null|| (r.min_inclusive?x>=n(r.min_ratio):x>n(r.min_ratio)))&&(r.max_ratio==null||(r.max_inclusive?x<=n(r.max_ratio):x<n(r.max_ratio))));
 if(!row)throw Error('판정 구간 누락: '+type+' '+x);return n(row.score_or_penalty);
}
function buildQueue(data,selected,actual){
 const recipe=data.tables.recipes.filter(r=>r.context===selected.id),items=data.tables.shelf_items;
 let queue=[];
 for(const id of actual.ingredients){
  const item=items.find(r=>r.id===id);if(!item)throw Error('없는 재료: '+id);
  const line=recipe.find(r=>r.ingredient===id&&!r.auto_apply);
  const type=line?.action||item.default_action;
  if(item.prep_action==='open')queue.push({type:'open',ingredient:id,target:null});
  if(!type)throw Error('동작 없음: '+id);
  queue.push({type,ingredient:id,target:n(line?.qty??item.default_target_qty),unit:line?.unit??item.default_target_unit,inRecipe:!!line});
 }
 if(actual.tool==='shaker')queue.push({type:'shake',ingredient:null});
 if(actual.tool==='mixing_glass')queue.push({type:'stir',ingredient:null});
 const rank={open:0,pour:1,squeeze:2,powder:3,shake:4,stir:4,fill_up:5};
 return queue.sort((a,b)=>rank[a.type]-rank[b.type]);
}
function scoreCraft(data,selected,actual,results,elapsed){
 const cfg=Object.fromEntries(data.tables.balance_config.map(r=>[r.setting,r.value]));
 const recipe=data.tables.recipes.filter(r=>r.context===selected.id&&!r.auto_apply);
 const expected=[],missing=recipe.filter(r=>!actual.ingredients.includes(r.ingredient)),extra=actual.ingredients.filter(id=>!recipe.some(r=>r.ingredient===id));
 for(const r of recipe){if(!r.scored||missing.includes(r))continue;
  if(data.tables.shelf_items.find(i=>i.id===r.ingredient)?.prep_action==='open')expected.push({type:'open',ingredient:r.ingredient});
  expected.push({type:r.action,ingredient:r.ingredient,target:n(r.qty),unit:r.unit});
 }
 const mix=selected.target_mix_method||selected.mix;if(['shake','stir'].includes(mix))expected.push({type:mix,ingredient:null});
 const buckets={};
 for(const r of expected){const a=results.find(x=>x.type===r.type&&x.ingredient===r.ingredient);let score=0;
  if(a){if(r.type==='open')score=a.completed?Math.max(0,100-n(a.failures)*n(cfg.open_penalty_per_failure,15)):0;
   else if(['shake','stir'].includes(r.type))score=clamp(n(a.completion)*100,0,100);
   else {if(r.target<=0||!Number.isFinite(a.value))throw Error('목표/결과 수량 누락: '+r.ingredient);score=band(data.tables.score_bands,'quantity',Math.abs(a.value-r.target)/r.target);}}
  const family=r.type==='fill_up'?'pour':r.type;(buckets[family]??=[]).push(score);
 }
 let weightedSum=0,totalWeight=0;const representatives=[];
 for(const [family,values]of Object.entries(buckets)){const mean=values.reduce((a,b)=>a+b,0)/values.length,weight=n(cfg['weight_'+family]);weightedSum+=mean*weight;totalWeight+=weight;representatives.push({family,mean,weight,count:values.length});}
 const representativeScore=totalWeight?weightedSum/totalWeight:100;
 const targetTool=mix==='shake'?'shaker':mix==='stir'?'mixing_glass':null;
 const penalties={gimmick:100-representativeScore,glass:actual.glass!==selected.glass?n(cfg.glass_mismatch_penalty):0,tool:targetTool&&actual.tool!==targetTool?n(cfg.tool_mismatch_penalty):0,missing:missing.length*n(cfg.missing_ingredient_penalty),extra:extra.length*n(cfg.extra_ingredient_penalty),overtime:band(data.tables.score_bands,'overtime',Math.max(0,elapsed-n(selected.time_limit_sec))/Math.max(1,n(selected.time_limit_sec)))};
 const score=clamp(100-Object.values(penalties).reduce((a,b)=>a+b,0),0,100);
 const grade=[...data.tables.grade_cuts].sort((a,b)=>n(b.min_pct)-n(a.min_pct)).find(g=>score>=n(g.min_pct))?.grade||'sewage';
 return{score,grade,penalties,representatives,missingCore:missing.filter(r=>r.is_core).map(r=>r.ingredient),missing:missing.map(r=>r.ingredient),extra,elapsed,selected:selected.id,actual:structuredClone(actual),results:structuredClone(results)};
}
class Game{
 constructor(data,options={}){this.data=data;this.t=data.tables;this.cfg=Object.fromEntries(this.t.balance_config.map(r=>[r.setting,r.value]));this.onChange=()=>{};this.lang='ko';this.speed=1;this.dialogSpeed=1;this.read=new Set();this.reset(options.day??0,options.mode??'full',options.seed??1,false);}
 c(key,fallback=0){return n(this.cfg[key],fallback);}
 text(row,key='text'){return row?.[key+'.'+this.lang]||row?.[key+'.ko']||'';}
 cocktail(id){const c=this.t.cocktails.find(c=>c.id===id);if(!c)throw Error('칵테일 없음: '+id);return c;}
 name(id){const r=this.t.characters.find(x=>x.id===id)||this.t.cocktails.find(x=>x.id===id)||this.t.shelf_items.find(x=>x.id===id)||this.t.personalities.find(x=>x.id===id);return this.text(r,'name')||id||'';}
 reset(day=0,mode='full',seed=1,run=true,settings={}){
  const upkeepOverride=this.parseUpkeepOverride(settings.upkeepOverride);
  this.day=Number(day);this.mode=mode;this.seed=Number(seed);this.rng=seeded(this.seed);this.progress={day:this.day,money:this.c('gold_start',300),reputation:0,phase:'bar_open',flags:{},affinity:{}};
  this.openingBalance=this.progress.money;this.upkeepOverride=upkeepOverride;this.dailySettlement=null;
  this.phase='ready';this.screen='bar';this.overlay=null;this.paused=false;this.hidden=false;this.cameraLeft=0;this.focus='L';this.overview=false;this.seats={L:null,M:null,R:null};this.logs=[];this.history=[];this.transactions=[];this.transactionIds=new Set();this.serial=0;this.barTime=0;this.realTime=0;this.served=0;this.lost=0;this.prep=null;this.drink=null;this.gimmick=null;this.result=null;this.error=null;this.dialogue=null;this.choice=null;this.transition=0;this.pendingTransition=null;this.story=null;this.currentOrder=null;this.resultContext={};this.effectVisual=null;this.barkLast={};this.finished=false;
  if(run){if(mode==='general')this.startGeneral();else if(mode==='regular')this.startStoryPhase('bar');else if(mode==='practice'){this.phase='practice';this.openRecipes();}else this.startStoryPhase('bar_open');}
  this.changed();
 }
 log(event,details={}){this.logs.push({time:Math.round(this.realTime*100)/100,barTime:Math.round(this.barTime*100)/100,event,...details});if(this.logs.length>5000)this.logs.shift();}
 changed(){this.onChange(this);}
 ctx(extra={}){return{...this.progress,...this.resultContext,...extra};}
 safe(fn){try{return fn();}catch(e){this.error=e.message;this.log('DATA_ERROR',{message:e.message});this.changed();return false;}}
 isPaused(){return this.paused||this.hidden||!!this.error||!!this.overlay;}
 available(c){return this.day===99||(n(c.unlock_day)<=this.day&&condition(c.unlock_when,this.ctx()));}
 cocktailsAvailable(){return this.t.cocktails.filter(c=>c.status==='confirmed'&&(this.available(c)||this.currentOrder?.cocktail===c.id));}
 itemsAvailable(){const needed=this.currentOrder?this.t.recipes.filter(r=>r.context===this.currentOrder.cocktail).map(r=>r.ingredient):[];return this.t.shelf_items.filter(r=>this.available(r)||needed.includes(r.id));}
 startStoryPhase(phase){
  this.phase=phase==='bar_open'?'opening':'regular';this.progress.phase=phase;this.screen='bar';this.seats={L:null,M:null,R:null};this.dialogue=null;this.choice=null;this.resultContext={};this.currentOrder=null;this.story={phase,autos:sortSeq(this.t.scenes.filter(s=>n(s.day)===this.day&&s.phase===phase&&s.trigger==='auto')),cursor:0,scene:null,index:0,steps:[]};
  this.log('phase_start',{phase:this.phase});this.nextScene();
 }
 nextScene(){
  this.resultContext={};this.dialogue=null;this.choice=null;
  while(this.story.cursor<this.story.autos.length){const s=this.story.autos[this.story.cursor++];if(!condition(s.when,this.ctx()))continue;this.loadScene(s);return;}
  if(this.phase==='opening'){this.story=null;this.startGeneral();}
  else {if(this.currentOrder)throw Error('미처리 주문 상태에서 대본 종료');this.finishDay();}
 }
 loadScene(scene){this.story.scene=scene;this.story.steps=sortSeq(this.t.steps.filter(s=>s.context===scene.id));this.story.index=0;this.resultContext={};this.log('scene',{id:scene.id});this.pump();}
 stepDone(step){applyEffects(step.effects,this.progress);this.story.index++;this.pump();}
 pump(){
  for(let guard=0;guard<1000;guard++){
   if(!this.story||this.error)return;
   const s=this.story.steps[this.story.index];if(!s){this.nextScene();return;}
   if(!condition(s.when,this.ctx())){this.log('step_skipped',{scene:this.story.scene.id,seq:s.seq,when:s.when});this.story.index++;continue;}
   this.log('step',{scene:this.story.scene.id,seq:s.seq,type:s.type});
   if(s.type==='say'||s.type==='order'&&this.text(s)){
    this.dialogue=this.makeLine(s.actor,this.text(s),s.dialogue_id,s.arg);this.dialogue.step=s;return;
   }
   if(s.type==='order'){this.createStoryOrder(s);applyEffects(s.effects,this.progress);this.story.index++;continue;}
   if(s.type==='enter'){
    const first=this.story.index,group=[s];if(s.sync==='no_wait'){const next=this.story.steps[first+1];if(!next||next.type!=='enter'||next.sync!=='wait')throw Error('동시 입장 쌍 오류');group.push(next);}
    const reserved=new Set(Object.keys(this.seats).filter(k=>this.seats[k]));
    for(const e of group){if(!['L','R'].includes(e.arg)||reserved.has(e.arg))throw Error('단골 좌석 충돌: '+e.actor+' / '+e.arg);reserved.add(e.arg);}
    for(const e of group){this.seats[e.arg]={id:e.actor,actor:e.actor,state:'STORY',coaster:false,glass:null,expression:'default'};this.progress.flags[e.actor+'_met']=true;applyEffects(e.effects,this.progress);}
    this.focus=s.arg;this.story.index+=group.length;this.setTransition(0.8,()=>this.pump());return;
   }
   if(s.type==='exit'){const seat=Object.keys(this.seats).find(k=>this.seats[k]?.actor===s.actor);if(!seat)throw Error('퇴장 대상 없음: '+s.actor);this.seats[seat].state='EXITING';this.setTransition(0.5,()=>{this.seats[seat]=null;this.stepDone(s);});return;}
   if(s.type==='choice'){const rows=sortSeq(this.t.bar_choices.filter(c=>c.context===s.arg));if(!rows.length)throw Error('선택지 세트 없음: '+s.arg);this.choice={step:s,rows};return;}
   if(s.type==='craft'){if(!this.currentOrder)throw Error('제조 전 주문 없음');this.screen='recipe';this.craftStep=s;return;}
   if(s.type==='serve'){throw Error('제조 결과/서빙 입력 없이 serve에 도착');}
   if(s.type==='effect'||s.type==='set_state'){applyEffects(s.effects,this.progress);this.story.index++;continue;}
   if(s.type==='fx'||s.type==='sfx'){const duration=s.arg==='hard_cut'?0.2:0.7;this.effectVisual={kind:s.type,id:s.arg,until:this.realTime+duration};this.log('effect_preview',{type:s.type,id:s.arg,dummy:true});if(s.sync==='wait'){this.setTransition(duration,()=>this.stepDone(s));return;}applyEffects(s.effects,this.progress);this.story.index++;continue;}
   if(s.type==='end_part'){if(this.currentOrder)throw Error('end_part 앞 미처리 주문');this.finishDay();return;}
   throw Error('미지원 바 스텝: '+s.type);
  }
  throw Error('대본 무한 진행 차단');
 }
 setTransition(sec,fn){this.dialogue=null;this.transition=sec;this.pendingTransition=fn;}
 makeLine(actor,text,id=null,expression='default'){
  const timings=[],speedStack=[this.c('typing_interval_ms',50)];for(const part of String(text).split(/(<\/?[a-z]+>)/g)){const tag=part.match(/^<(\/?)([a-z]+)>$/);if(tag){const rule=this.t.text_tags.find(t=>t.tag===tag[2]&&t.kind==='speed_ms');if(rule){if(tag[1]&&speedStack.length>1)speedStack.pop();else if(!tag[1])speedStack.push(n(rule.value));}}else for(let i=0;i<part.length;i++)timings.push(speedStack.at(-1));}
  return{actor,text:clean(text),raw:text,id,expression:expression||'default',chars:0,hold:0,seen:false,timings,typeMs:0};
 }
 typeLine(line,dt){line.typeMs+=dt*this.dialogSpeed*1000;while(line.chars<line.text.length){const delay=line.timings?.[Math.floor(line.chars)]||this.c('typing_interval_ms',50);if(line.typeMs<delay)break;line.typeMs-=delay;line.chars++;}}
 finishLine(){const d=this.dialogue;if(!d)return;if(d.id)this.read.add(d.id);this.history.push({actor:d.actor,text:d.text,scene:this.story?.scene?.id,id:d.id});const s=d.step;this.dialogue=null;if(s.type==='order')this.createStoryOrder(s);this.stepDone(s);}
 advance(){if(this.isPaused()||this.transition>0||this.cameraLeft>0||this.screen!=='bar'||!this.dialogue||this.phase==='general')return false;const d=this.dialogue;if(d.chars<d.text.length)d.chars=d.text.length;else this.safe(()=>this.finishLine());this.changed();return true;}
 choose(seq){if(!this.choice||this.isPaused())return false;return this.safe(()=>{const c=this.choice.rows.find(c=>n(c.seq)===Number(seq));if(!c||!condition(c.when,this.ctx()))return false;const target=c.goto?this.t.scenes.find(s=>s.id===c.goto&&n(s.day)===this.day):null;if(c.goto&&!target)throw Error('분기 씬 없음: '+c.goto);const step=this.choice.step;applyEffects(c.effects,this.progress);applyEffects(step.effects,this.progress);this.log('choice',{id:step.arg,seq:c.seq,goto:c.goto});this.choice=null;if(target)this.loadScene(target);else {this.story.index++;this.pump();}this.changed();return true;});}
 createStoryOrder(s){
  const id=s.arg?.match(/^exact:(.+)$/)?.[1];if(!id)throw Error('미지원 주문 형식: '+s.arg);this.cocktail(id);const seat=Object.keys(this.seats).find(k=>this.seats[k]?.actor===s.actor);if(!seat)throw Error('주문자 착석 정보 없음: '+s.actor);
  if(this.currentOrder)throw Error('앞 주문이 미완료');this.resultContext={};this.currentOrder={id:'order_'+(++this.serial),actor:s.actor,seat,cocktail:id};this.resultContext.ordered=id;this.seats[seat].coaster=true;this.seats[seat].order=this.currentOrder;this.log('order',{...this.currentOrder});
 }
 startGeneral(){
  this.phase='general';this.progress.phase='bar_open';this.screen='bar';this.seats={L:null,M:null,R:null};this.story=null;this.dialogue=null;this.queue=sortSeq([...this.t.random_waves,...this.t.regular_slots].filter(s=>n(s.day)===this.day));this.queueIndex=0;this.spawnBlocked=false;this.spawnLeft=this.c('first_spawn_delay_sec',5)+n(this.queue[0]?.delay_sec);this.focus='L';
  this.log('phase_start',{phase:'general',slots:this.queue.length});if(!this.queue.length)this.startStoryPhase('bar');
 }
 appearance(){
  const gender=this.rng()<0.5?'m':'f';const slots=['body','outfit','eyes','eyebrows','mouth','hair'];let ids=[],layers=[];
  // CSV IDs are retained; art filenames are a view mapping, not a schema change.
  for(const slot of slots){const list=this.t.guest_parts.filter(p=>p.gender===gender&&p.id.startsWith(slot+'_'+gender));const p=weighted(list,this.rng);const id=p?.id||slot+'_'+gender+(slot==='body'?'':'_1');ids.push(id);}
  const optional=this.t.guest_parts.filter(p=>p.gender===gender&&/^(arm_accessory|necklace|outerwear)_/.test(p.id));if(optional.length&&this.rng()>0.5){const p=weighted(optional,this.rng);if(!this.t.guest_exclusions.some(e=>(e.a===p.id&&ids.includes(e.b))||(e.b===p.id&&ids.includes(e.a))))ids.push(p.id);}
  const map={outfit:'top',eyebrows:'eyebrow',arm_accessory:'Acc',necklace:'Acc',outerwear:'cyberware'};
  const artKey=id=>{const m=id.match(/^(.*)_[mf](?:_(\d+))?$/);return m?'guest_'+gender+'_'+(map[m[1]]||m[1])+(m[2]?'_'+m[2]:''):'';};
  const requested=[...ids],missing=ids.filter(id=>!this.data.assets[artKey(id)]);
  // A missing outfit must not silently turn into an incompatible sleeved top
  // while keeping an arm accessory. Use the CSV's whole safe default set.
  if(missing.length){const defaults=this.t.guest_settings[0];ids=slots.map(slot=>defaults['defaults.'+gender+'.'+slot]);this.log('appearance_fallback',{requested,missing,used:ids});}
  for(const id of ids){const k=artKey(id);if(this.data.assets[k])layers.push(k);}
  return {gender,ids,layers,requested,missing};
 }
 spawn(){const slot=this.queue[this.queueIndex];if(!slot)return;const seat=Object.keys(this.seats).find(k=>!this.seats[k]);if(!seat){this.spawnBlocked=true;return;}
  const p=this.t.personalities.find(p=>p.id===(slot.personality||'gentle'));const limit=clamp(this.c('coaster_base_sec')*n(p.patience_mult,1),this.c('coaster_min_sec'),this.c('coaster_max_sec'));
  const g={id:'guest_'+(++this.serial),actor:slot.character||slot.personality,slot,personality:p,appearance:slot.character?null:this.appearance(),seat,state:'WAIT_COASTER',coaster:false,glass:null,round:0,maxRounds:n(slot.max_rounds,1),coasterLimit:limit,left:limit,limit,warn:0,pendingWarn:0,reasking:false,lines:[],lineIndex:0,order:null,idleLeft:10,lastGrade:null};
  this.seats[seat]=g;this.setBarks(g,['call']);this.queueIndex++;this.spawnLeft=n(this.queue[this.queueIndex]?.delay_sec,this.c('spawn_delay_default_sec'));this.spawnBlocked=false;this.log('guest_enter',{guest:g.id,seat,personality:p.id,appearance:g.appearance?.ids});
 }
 bark(g,situation,actor=null){
  const voice=actor||g.slot.character||g.personality.id;let rows=this.t.barks.filter(r=>r.situation===situation&&r.voice_id===voice);
  if(!rows.length)rows=this.t.barks.filter(r=>r.situation===situation&&r.voice_id==null);
  const key=voice+':'+situation,old=this.barkLast[key];if(rows.length>1)rows=rows.filter(r=>r.row_id!==old);
  const row=weighted(rows,this.rng);if(row)this.barkLast[key]=row.row_id;
  let txt=row?this.text(row):'';if(!txt&&situation==='ask_order')txt=this.lang==='ko'?'주문하시겠어요?':'What would you like?';
  if(!txt){this.log('bark_missing',{voice,situation});txt=this.lang==='ko'?'…':'…';}
  txt=txt.replace(/\{cocktail\}/g,this.name(g.order?.cocktail||g.nextCocktail));
  return {...this.makeLine(actor||g.actor,txt,row?.row_id,row?.expression),situation};
 }
 setBarks(g,situations,onDone=null){g.lines=situations.map(s=>this.bark(g,s,s==='ask_order'?'luna':null));g.lineIndex=0;g.lineDone=onDone;}
 coaster(seat=this.focus){
  if(this.phase!=='general'||this.screen!=='bar'||this.isPaused()||this.cameraLeft>0||seat!==this.focus)return false;
  const g=this.seats[seat];if(!g||g.state!=='WAIT_COASTER'||g.left<=0)return false;
  g.coaster=true;g.state='ORDER_DIALOGUE';this.beginOrder(g,false);this.log('coaster',{guest:g.id,seat});this.changed();return true;
 }
 beginOrder(g,reorder){
  const candidates=this.cocktailsAvailable();if(!candidates.length)throw Error('무작위 주문 후보 없음');g.nextCocktail=g.slot.order||candidates[Math.floor(this.rng()*candidates.length)].id;
  const situations=reorder?['reorder']:['ask_order',...(this.rng()<n(g.personality.think_chance)?['order_think']:[]),'order'];
  this.setBarks(g,situations,()=>{g.round++;const c=this.cocktail(g.nextCocktail);g.order={id:'order_'+(++this.serial),cocktail:c.id,actor:g.id,seat:g.seat};g.limit=n(c.time_limit_sec)+Math.max(this.c('serve_min_bonus_sec'),this.c('serve_bonus_sec')-n(c.unlock_day)*this.c('serve_grace_per_day_sec'));g.left=g.limit;g.state='WAIT_SERVE';g.warn=0;g.pendingWarn=0;g.idleLeft=this.c('idle_min_sec');this.log('order',{guest:g.id,...g.order});});
 }
 reask(){if(this.phase!=='general'||this.screen!=='bar'||this.isPaused()||this.cameraLeft>0)return false;const g=this.seats[this.focus];if(!g||g.state!=='WAIT_SERVE'||!g.order||g.reasking||g.left<=0)return false;
  const cost=g.limit*0.10;g.left=Math.max(0,g.left-cost);this.log('reask',{guest:g.id,cost,remaining:g.left,order:g.order.id});if(g.left<=0){this.leave(g,'leave_serve');this.changed();return true;}
  g.reasking=true;g.lines=[this.makeLine('luna',this.lang==='ko'?'혹시 주문을 다시 알려주실 수 있나요?':'Could you remind me what you ordered?'),this.bark(g,'order')];g.lineIndex=0;g.lineDone=()=>{g.reasking=false;if(g.state==='WAIT_SERVE'&&g.pendingWarn>g.warn)this.warn(g,g.pendingWarn);};this.changed();return true;
 }
 warn(g,level){if(g.reasking){g.pendingWarn=Math.max(g.pendingWarn,level);return;}if(level<=g.warn)return;g.warn=level;this.setBarks(g,[(g.state==='WAIT_COASTER'?'call_':'serve_')+(level===2?'final':'urge')]);}
 leave(g,situation){g.reasking=false;g.state='EXITING';g.left=0;g.order=null;this.setBarks(g,[situation]);g.exitLeft=3;this.lost++;this.log('timeout',{guest:g.id,situation});}
 focusSeat(seat){if(!['L','M','R'].includes(seat)||this.phase!=='general'||this.screen!=='bar'||this.isPaused())return false;if(this.focus===seat)return false;
  this.focus=seat;this.overview=false;this.cameraSame=false;this.cameraLeft=0.55;this.log('focus',{seat});this.changed();return true;
 }
 afterCamera(){const g=this.seats[this.focus],line=g?.lines?.[g.lineIndex];if(line?.seen){line.chars=line.text.length;line.hold=0;}this.cleanOldGlass();}
 toggleOverview(){if(this.phase!=='general'||this.screen!=='bar'||this.isPaused())return;this.overview=!this.overview;this.cameraLeft=0.55;this.cameraSame=true;this.changed();}
 cleanOldGlass(){if(!this.drink||this.screen!=='bar')return;const g=this.seats[this.focus];if(g?.state==='WAIT_SERVE'&&g.order&&g.glass){g.glass=null;this.log('old_glass_cleared',{guest:g.id,seat:this.focus});}}
 openRecipes(){if(this.screen!=='bar'||this.error||this.isPaused()||this.transition>0)return false;if(this.phase==='general'||this.phase==='practice'||this.currentOrder&&this.story?.steps[this.story.index]?.type==='craft'){if(this.drink)return false;this.screen='recipe';this.changed();return true;}return false;}
 closeRecipes(){if(this.screen!=='recipe')return;this.screen='bar';this.changed();}
 selectCocktail(id){if(this.screen!=='recipe'||!this.cocktailsAvailable().some(c=>c.id===id))return false;this.prep={selected:id,glass:null,tool:null,ingredients:[]};this.screen='prep';this.changed();return true;}
 pickItem(id){if(this.screen!=='prep'||this.isPaused())return;const item=this.itemsAvailable().find(i=>i.id===id);if(!item)return;
  if(item.kind==='ingredient'){const i=this.prep.ingredients.indexOf(id);if(i>=0)this.prep.ingredients.splice(i,1);else this.prep.ingredients.push(id);}
  else if(item.kind==='glass')this.prep.glass=this.prep.glass===id?null:id;
  else if(item.kind==='tool')this.prep.tool=this.prep.tool===id?null:id;this.changed();}
 prepBack(){if(this.screen!=='prep')return;this.prep=null;this.screen='recipe';this.log('prep_reset');this.changed();}
 startCraft(){if(this.screen!=='prep'||!this.prep?.glass||!this.prep.ingredients.length||this.isPaused())return false;return this.safe(()=>{this.craft={id:'craft_attempt_'+(++this.serial),actual:structuredClone(this.prep),queue:buildQueue(this.data,this.cocktail(this.prep.selected),this.prep),index:0,results:[],elapsed:0};this.screen='gimmick';this.nextGimmick();this.changed();return true;});}
 nextGimmick(){const step=this.craft.queue[this.craft.index];if(!step){this.result=scoreCraft(this.data,this.cocktail(this.craft.actual.selected),this.craft.actual,this.craft.results,this.craft.elapsed);this.result.id=this.craft.id;this.resultContext.craft_grade=this.result.grade;this.screen='result';this.gimmick=null;this.log('craft_result',{id:this.craft.id,score:this.result.score,grade:this.result.grade});return;}
  this.gimmick={...step,started:false,elapsed:0,value:0,held:false,angle:0,failures:0,completed:false,success:0,attempts:0,beatTime:0,hit:false,beatSuccess:false,outcomes:[],stirPos:0,stirStep:0,circleTime:0,message:'',targetStacks:step.type==='shake'?this.c('shake_target_stacks',20):this.c('stir_target_stacks',10)};
 }
 startGimmick(){if(this.screen!=='gimmick'||this.isPaused())return;this.gimmick.started=true;this.changed();}
 holdPour(held){if(this.screen!=='gimmick'||this.isPaused())return;if(['pour','fill_up'].includes(this.gimmick.type)){this.gimmick.held=held;if(held)this.gimmick.started=true;}}
 gimmickInput(key){const g=this.gimmick;if(!g||this.isPaused()||g.completed)return false;
  if(g.type==='stir'){
   if(!g.started){if(!['KeyW','ArrowUp'].includes(key))return false;g.started=true;g.message='시계 방향으로 D → S → A → W';return true;}
   const keyMap={KeyW:0,ArrowUp:0,KeyD:1,ArrowRight:1,KeyS:2,ArrowDown:2,KeyA:3,ArrowLeft:3},dir=keyMap[key];if(dir==null)return false;
   if(dir===(g.stirPos+1)%4){g.stirPos=dir;g.stirStep++;if(g.stirStep===4)this.finishStirCircle(true);}else this.finishStirCircle(false);this.changed();return true;
  }
  if(!g.started){g.started=true;this.changed();return true;}
  if(g.type==='open'){
   const start=this.c('open_start_radius_px',165),target=this.c('open_target_radius_px',44),radius=start-(start-target)*g.beatTime/this.c('open_approach_sec',1.6);
   if(Math.abs(radius-target)<=this.c('open_judge_window_px',10)){g.completed=true;g.message='OPEN';}else{g.failures++;g.beatTime=0;g.message='빗나감 · 다시 타이밍을 맞춰 주세요';}
  } else if(g.type==='shake'&&!g.hit){const period=60/this.c('shake_bpm',60);if(Math.abs(g.beatTime-period*0.75)<=period*0.16){g.success++;g.beatSuccess=true;g.message='GOOD';}else {g.beatSuccess=false;g.message='MISS';}g.hit=true;}
  this.changed();return true;
 }
 finishStirCircle(ok){const g=this.gimmick;g.outcomes.push(ok);g.attempts++;if(ok)g.success++;g.stirStep=0;g.circleTime=0;g.message=ok?'GOOD':'MISS';if(g.attempts>=g.targetStacks)g.completed=true;}
 endGimmick(){const g=this.gimmick;if(!g||this.isPaused()||!g.started)return;let result={type:g.type,ingredient:g.ingredient,value:g.value,failures:g.failures,completed:g.completed,completion:g.success/g.targetStacks};if(['pour','fill_up'].includes(g.type))result.completed=true;
  this.craft.results.push(result);this.craft.index++;this.safe(()=>this.nextGimmick());this.changed();}
 retryDataError(){if(!this.craft)return;this.error=null;this.craft.id='craft_attempt_'+(++this.serial);this.craft.index=0;this.craft.results=[];this.craft.elapsed=0;this.screen='gimmick';this.safe(()=>{this.craft.queue=buildQueue(this.data,this.cocktail(this.craft.actual.selected),this.craft.actual);this.nextGimmick();});this.changed();}
 cancelCraft(){this.error=null;this.gimmick=null;this.craft=null;this.result=null;this.prep=null;this.screen='recipe';this.changed();}
 discard(){if(this.screen!=='result')return;this.log('discard',{id:this.result.id});this.result=null;this.prep=null;this.screen='recipe';this.changed();}
 offer(){if(this.screen!=='result'||!this.result)return;this.drink=this.result;this.result=null;this.screen='bar';if(this.currentOrder){this.focus=this.currentOrder.seat;this.seats[this.focus].glass=null;}else this.cleanOldGlass();this.log('offer',{id:this.drink.id});this.changed();}
 resolveServe(order,drink){const match=order.cocktail===drink.selected;const sewage=!match?'order_mismatch':drink.missingCore.length?'missing_core':null;const grade=sewage?'sewage':drink.grade;return{orderId:order.id,drinkId:drink.id,ordered:order.cocktail,served:drink.selected,match,grade,craftGrade:drink.grade,score:drink.score,sewage};}
 settle(result,guest=null){
  if(this.transactionIds.has(result.orderId))return;const c=this.cocktail(result.served),rule=this.t.settlement_rules.find(r=>r.setting===result.grade);if(!rule)throw Error('정산 규칙 누락');const price=n(c.price),sale=Math.round(price*n(rule.sale_rate)),tip=Math.round(price*n(rule.tip_rate)*n(guest?.personality?.tip_mult,1)),refund=Math.round(price*n(rule.refund_rate));
  const trx={...result,sale,tip,refund,net:sale+tip-refund,phase:this.phase};this.transactions.push(trx);this.transactionIds.add(result.orderId);this.progress.money+=trx.net;this.served++;this.log('settlement',trx);return trx;
 }
 serve(seat){if(!this.drink||this.screen!=='bar'||this.isPaused()||this.cameraLeft>0||this.transition>0)return false;
  return this.safe(()=>{
   if(this.phase==='practice'){this.settle(this.resolveServe({id:'practice_'+(++this.serial),cocktail:this.drink.selected},this.drink));this.drink=null;this.openRecipes();return true;}
   const g=this.seats[seat];if(!g?.coaster)return false;
   if(this.phase==='general'){
    if(seat!==this.focus||g.state!=='WAIT_SERVE'||!g.order||g.left<=0)return false;
    const result=this.resolveServe(g.order,this.drink);g.glass=this.drink.selected;this.drink=null;g.reasking=false;g.state='REACTION';g.lastGrade=result.grade;this.setBarks(g,result.match?['serve_thanks','react_'+result.grade]:['wrong_receive','wrong_drink'],()=>{const t=this.settle(result,g);applyEffects(g.slot.serve_effects,this.progress);g.order=null;if(g.round<g.maxRounds&&t.refund===0){g.state='REORDER_WAIT';g.reorderLeft=this.c('next_round_delay_sec',3);}else{g.state='EXITING';this.setBarks(g,[GRADES.indexOf(result.grade)>=2?'bye_good':'bye_bad']);g.exitLeft=3;}});
   }else{
    if(!this.currentOrder||seat!==this.currentOrder.seat)return false;
    const craftStep=this.story.steps[this.story.index],serve=this.story.steps[this.story.index+1];if(craftStep?.type!=='craft'||serve?.type!=='serve'||serve.actor!==this.currentOrder.actor)throw Error('order → craft → serve 연결 오류');
    const result=this.resolveServe(this.currentOrder,this.drink);g.glass=this.drink.selected;this.drink=null;this.resultContext={grade:result.grade,final_grade:result.grade,craft_grade:result.craftGrade,order_match:result.match,ordered:result.ordered,served:result.served,cocktail:this.cocktail(result.served),tags:this.t.cocktail_tags.filter(t=>t.context===result.served).map(t=>t.ko)};
    this.settle(result);this.applyAffinity(this.currentOrder.actor,result);applyEffects(craftStep.effects,this.progress);applyEffects(serve.effects,this.progress);this.currentOrder=null;g.order=null;this.story.index+=2;this.setTransition(1,()=>this.pump());
   }
   this.changed();return true;
  });
 }
 applyAffinity(actor,result){const c=this.t.characters.find(c=>c.id===actor);if(!c?.affinity)return;const taste=sortSeq(this.t.tastes.filter(t=>t.character_id===actor)).find(t=>condition(t.when,this.ctx()));const tier=!result.match?'miss':taste?.tier||'ok';const row=this.t.affinity_matrix.find(r=>r.taste_tier===tier);const delta=n(row?.[result.grade]);this.progress.affinity[actor]=n(this.progress.affinity[actor])+delta;this.log('affinity',{actor,tier,delta});}
 parseUpkeepOverride(value){
  if(value==null||String(value).trim()==='')return null;
  const amount=Number(value);if(!Number.isSafeInteger(amount)||amount<0)throw Error('유지비는 0 이상의 정수 G로 입력해 주세요.');return amount;
 }
 upkeepInfo(){
  if(this.upkeepOverride!=null)return{amount:this.upkeepOverride,source:'web_test'};
  const row=this.t.days.find(d=>n(d.day)===this.day);
  if(!row&&this.day===99)return{amount:0,source:'qa_default'};
  if(!row||row.upkeep_gold==null||String(row.upkeep_gold).trim()==='')throw Error('일차 유지비 데이터 누락: Day '+this.day);
  const amount=this.parseUpkeepOverride(row.upkeep_gold);return{amount,source:'days.csv'};
 }
 setUpkeepOverride(value){if(this.finished)return false;const amount=this.parseUpkeepOverride(value);this.upkeepOverride=amount;this.log('debug_upkeep_override',{amount,restoredDataDefault:amount==null});this.changed();return true;}
 finishDay(){
  if(this.finished)return false;
  const upkeep=this.upkeepInfo(),totals=this.totals(),before=this.progress.money;
  // Order revenue is already committed. Never add the displayed totals again.
  this.dailySettlement={id:'day_'+this.day+'_settlement',day:this.day,status:'pending',totals:{...totals},openingBalance:this.openingBalance,otherChanges:before-this.openingBalance-totals.net,balanceBefore:before,upkeep:upkeep.amount,source:upkeep.source,projectedBalance:before-upkeep.amount,shortfall:Math.max(0,upkeep.amount-before),balanceAfter:null};
  this.phase='complete';this.screen='settlement';this.dialogue=null;this.choice=null;this.story=null;this.currentOrder=null;this.drink=null;this.prep=null;this.gimmick=null;this.overlay=null;this.paused=false;this.transition=0;this.pendingTransition=null;this.seats={L:null,M:null,R:null};this.finished=true;this.log('day_complete',{day:this.day,orders:this.transactions.length,upkeep:upkeep.amount,upkeepSource:upkeep.source});this.changed();return true;
 }
 confirmDailySettlement(){
  const s=this.dailySettlement;if(!s||s.status!=='pending'||this.screen!=='settlement'||this.error)return false;
  if(s.balanceBefore<s.upkeep){
   s.status='failed';s.balanceAfter=s.balanceBefore;this.phase='gameover';this.screen='gameover';
   this.log('daily_upkeep_failed',{settlementId:s.id,available:s.balanceBefore,required:s.upkeep,shortfall:s.shortfall});this.log('game_over',{reason:'upkeep_unpaid',day:this.day});
  }else{
   this.progress.money=s.balanceBefore-s.upkeep;s.balanceAfter=this.progress.money;s.status='paid';
   this.log('daily_upkeep_paid',{settlementId:s.id,before:s.balanceBefore,amount:s.upkeep,after:s.balanceAfter});
  }
  this.changed();return true;
 }
 debugFill(){if(this.screen!=='prep')return;const c=this.cocktail(this.prep.selected);this.prep.glass=c.glass;this.prep.tool=(c.mix==='shake'?'shaker':c.mix==='stir'?'mixing_glass':null);this.prep.ingredients=this.t.recipes.filter(r=>r.context===c.id&&!r.auto_apply).map(r=>r.ingredient);this.log('debug_recipe_fill');this.changed();}
 debugCraft(grade='excellent'){if(!['prep','gimmick'].includes(this.screen))return;this.debugFill();if(this.screen==='prep')this.startCraft();const actual=this.craft.actual,selected=this.cocktail(actual.selected),queue=this.craft.queue;const results=queue.map(q=>({...q,value:q.target,completion:1,completed:true,failures:0}));this.result=scoreCraft(this.data,selected,actual,results,2);this.result.id=this.craft.id;this.result.grade=grade;this.result.score={excellent:100,good:85,decent:70,poor:45,sewage:0}[grade];this.result.debug=true;this.gimmick=null;this.screen='result';this.log('debug_craft',{grade});this.changed();}
 tick(dt){
  if(this.isPaused()||this.finished)return;dt=Math.max(0,Math.min(dt,0.2));this.realTime+=dt;
  if(this.transition>0){this.transition=Math.max(0,this.transition-dt);if(!this.transition){const fn=this.pendingTransition;this.pendingTransition=null;this.safe(fn);}return;}
  if(this.cameraLeft>0){this.cameraLeft=Math.max(0,this.cameraLeft-dt);if(!this.cameraLeft){if(!this.cameraSame)this.afterCamera();this.cameraSame=false;}}
  if(this.screen==='gimmick'){this.tickGimmick(dt);return;}
  if(this.screen!=='bar')return;
  if(this.phase==='general')this.safe(()=>this.tickGeneral(dt));
  else if(this.dialogue){this.typeLine(this.dialogue,dt);}
 }
 tickGeneral(realDt){
  const dt=realDt*this.speed;this.barTime+=dt;
  if(this.queueIndex<this.queue.length){if(this.spawnBlocked){if(Object.values(this.seats).some(x=>!x)){this.spawnBlocked=false;this.spawnLeft=this.c('reseat_delay_sec',10);}}else {this.spawnLeft-=dt;if(this.spawnLeft<=0)this.spawn();}}
  for(const g of Object.values(this.seats).filter(Boolean)){
   if(g.state==='WAIT_COASTER'||g.state==='WAIT_SERVE'){
    g.left-=dt;if(g.left<=0){this.leave(g,g.state==='WAIT_COASTER'?'leave_coaster':'leave_serve');continue;}
    const used=1-g.left/g.limit,level=used>=this.c('warn_red_ratio',0.8)?2:used>=this.c('warn_yellow_ratio',0.5)?1:0;if(level>g.warn)this.warn(g,level);
   }
   if(g.state==='EXITING'){g.exitLeft-=dt;if(g.exitLeft<=0){this.log('guest_exit',{guest:g.id,seat:g.seat});this.seats[g.seat]=null;continue;}}
   if(g.state==='REORDER_WAIT'){g.reorderLeft-=dt;if(g.reorderLeft<=0){g.state='ORDER_DIALOGUE';this.beginOrder(g,true);}}
   if(g.seat!==this.focus||this.cameraLeft>0)continue;
   const line=g.lines[g.lineIndex];if(line){line.seen=true;if(line.chars<line.text.length)this.typeLine(line,realDt);else{line.hold+=realDt*this.dialogSpeed;if(line.hold>=this.c('order_bark_gap_sec',1.5)){this.history.push({actor:line.actor,text:line.text,id:line.id});g.lineIndex++;if(g.lineIndex>=g.lines.length){const fn=g.lineDone;g.lineDone=null;if(fn)fn();}}}}
   else if(g.state==='WAIT_SERVE'&&!g.reasking){g.idleLeft-=dt;if(g.idleLeft<=0){this.setBarks(g,['idle']);g.idleLeft=this.c('idle_min_sec',8)+this.rng()*(this.c('idle_max_sec',13)-this.c('idle_min_sec',8));}}
  }
  if(this.queueIndex>=this.queue.length&&Object.values(this.seats).every(g=>!g)){this.drink=null;this.startStoryPhase('bar');}
 }
 tickGimmick(dt){const g=this.gimmick;if(!g||!g.started||g.completed)return;g.elapsed+=dt;this.craft.elapsed+=dt;
  if(g.type==='pour'||g.type==='fill_up'){g.angle=clamp(g.angle+(g.held?1:-1)*this.c('pour_tilt_speed_deg_per_sec',95)*dt,0,this.c('pour_max_tilt_angle_deg',150));if(g.angle>=this.c('pour_start_angle_deg',95)){const ml=this.c('pour_emit_rate_ml_per_sec',70)*dt;g.value+=ml/(g.unit==='oz'?this.c('unit_oz_to_ml',30):g.unit==='tsp'?this.c('unit_tsp_to_ml',5):1);}}
  else if(g.type==='open'){g.beatTime+=dt;if(g.beatTime>this.c('open_approach_sec',1.6)*1.17){g.failures++;g.beatTime=0;g.message='MISS';}}
  else if(g.type==='shake'){g.beatTime+=dt;const period=60/this.c('shake_bpm',60);if(g.beatTime>=period){g.beatTime-=period;g.outcomes.push(g.beatSuccess);if(!g.hit)g.message='MISS';g.attempts++;g.hit=false;g.beatSuccess=false;if(g.attempts>=g.targetStacks){g.completed=true;g.message='완료';}}}
  else if(g.type==='stir'){g.circleTime+=dt;if(g.circleTime>=this.c('stir_circle_limit_sec',2))this.finishStirCircle(false);}
 }
 currentDialogue(){if(this.phase==='general'){const g=this.seats[this.focus];return !this.cameraLeft?g?.lines?.[g.lineIndex]:null;}return this.dialogue;}
 totals(){return this.transactions.reduce((a,t)=>({sale:a.sale+t.sale,tip:a.tip+t.tip,refund:a.refund+t.refund,net:a.net+t.net}),{sale:0,tip:0,refund:0,net:0});}
}
const api={Game,GRADES,condition,applyEffects,scoreCraft,buildQueue,band,seeded,clean,n,clamp};
if(typeof module!=='undefined')module.exports=api;root.LunaCore=api;
})(typeof window==='undefined'?globalThis:window);

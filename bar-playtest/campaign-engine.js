/* Shared Notion story adapter for main and developer modes. Restore table references on exit. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const RESTORATION={id:'johnny_old_fashioned',prototype:false,glass:'old_fashioned',tool:'mixing_glass',ingredients:[['wild_dog',45],['bitters',5],['sugar_cube',1]],mix:'stir'};
class Session{
 constructor(g,data,story){this.g=g;this.data=data;this.story=story;this.active=false;this.day=0;this.completed=[];this.checkpoint=null;this.route='title';this.events=[];this.original=null;}
 install(options={}){if(this.active)return;this.developer=!!options.developer;this.serviceVersion='A';const t=this.data.tables;this.original=Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v]));this.assetKeys=[];this.active=true;
  const addAsset=(key,source)=>{if(!this.data.assets[key]&&this.data.assets[source]){this.assetKeys.push(key);this.data.assets[key]=this.data.assets[source];}};
  t.scenes=t.scenes.filter(s=>!([1,2,3].includes(Number(s.day))));
  const oldContexts=new Set(this.original.scenes.filter(s=>[1,2,3].includes(Number(s.day))).map(s=>s.id));
  t.steps=t.steps.filter(s=>!oldContexts.has(s.context));
  t.cocktails=copy(t.cocktails);t.shelf_items=copy(t.shelf_items);t.recipes=copy(t.recipes);t.characters=copy(t.characters);
  // Explicit story availability: Cosmo and its ingredients remain day 2.
  t.cocktails.find(c=>c.id==='dry_martini').unlock_day='1';t.shelf_items.find(c=>c.id==='dry_vermouth').unlock_day='1';
  const base=t.shelf_items.find(i=>i.id==='whiskey');
  const ids=RESTORATION.ingredients.map(r=>r[0]);t.shelf_items=t.shelf_items.filter(i=>!ids.includes(i.id));t.cocktails=t.cocktails.filter(c=>c.id!==RESTORATION.id);t.recipes=t.recipes.filter(r=>r.context!==RESTORATION.id);
  for(const [id,name,color,asset,category] of [['wild_dog','와일드 독','190,120,40','whiskey','base'],['bitters','비터스','145,67,33','kahlua','liqueur'],['sugar_cube','각설탕','240,237,209','sugar_cube','sugar']]){
   t.shelf_items.push({...base,id,'name.ko':name,'name.en':{wild_dog:'Wild Dog',bitters:'Bitters',sugar_cube:'Sugar Cube'}[id],color,category,unlock_day:'3',unlock_when:'flag.johnny_recipe_unlocked','desc.en':id==='sugar_cube'?'One sugar cube for Johnny’s Old Fashioned. Added automatically during preparation.':({wild_dog:'Wild Dog',bitters:'Bitters'}[id]+' · An ingredient for Johnny’s Old Fashioned.'),'desc.ko':id==='sugar_cube'?'올드 패션드에 넣는 각설탕. 선택하면 1개가 투입됩니다.':name+' · 조니의 올드 패션드 재료.',default_action:id==='sugar_cube'?'add':'pour',default_target_qty:String(RESTORATION.ingredients.find(r=>r[0]===id)[1]),default_target_unit:id==='sugar_cube'?'개':'ml',row_id:'campaign_item_'+id});
   for(const prefix of ['item_','recipe_item_','inventory_item_']){if(id==='sugar_cube'&&!this.data.assets[prefix+id]){this.assetKeys.push(prefix+id);this.data.assets[prefix+id]={src:'assets/campaign/sugar-cube.svg',w:96,h:96,frames:1};}else addAsset(prefix+id,prefix+asset);}
  }
  const baseDrink=t.cocktails.find(c=>c.id==='godfather');
  t.cocktails.push({...baseDrink,id:RESTORATION.id,'name.ko':'올드 패션드','name.en':'Old Fashioned',mix:'stir',target_mix_method:'stir',glass:'old_fashioned',unlock_day:'3',unlock_when:'flag.johnny_recipe_unlocked',price:'300',sprite:null,serve_sprite:null,'flavor.ko':'조니의 기억에서 관찰한 한 잔.','flavor.en':'A drink remembered from Johnny’s past.','recipe_desc.en':'Wild Dog 45ml → bitters 5ml → 1 sugar cube. Stir with ice in a mixing glass, then serve in an old fashioned glass.','recipe_desc.ko':'와일드 독 45ml → 비터스 5ml → 각설탕 1개. 얼음이 든 믹싱 글라스에서 스터한 뒤 올드패션드 잔에 제공한다.',row_id:'campaign_cocktail_old_fashioned'});
  t.recipes.push(...RESTORATION.ingredients.map(([ingredient,qty],i)=>({context:RESTORATION.id,action:ingredient==='sugar_cube'?'add':'pour',ingredient,qty:String(qty),unit:ingredient==='sugar_cube'?'개':'ml',is_core:true,scored:true,auto_apply:false,row_id:'campaign_recipe_'+i})));
  for(const prefix of ['cocktail_','recipe_cocktail_','table_cocktail_'])addAsset(prefix+RESTORATION.id,prefix+'godfather');
  for(const [id,name]of [['tom','톰'],['message','의뢰 연락 메시지'],['johnny','조니']])if(!t.characters.some(c=>c.id===id))t.characters.push({id,'name.ko':name,'name.en':name,affinity:false});
  for(const day of [1,2,3])for(const phase of ['bar_open','bar']){const id='campaign_d'+day+'_'+phase;const rows=phase==='bar_open'?[{type:'enter',actor:'chris',arg:'R'},...this.story.opening[day]]:this.story.bar[day];
   t.scenes.push({id,day:String(day),seq:'1',phase,trigger:'auto',title:day+'일차 본편',row_id:id});
   t.steps.push(...rows.map((r,i)=>({context:id,seq:String(i+1),type:r.type,actor:r.actor||'luna',arg:r.arg||null,effects:r.effects||null,payment:r.payment||null,'text.ko':r.text||null,'text.en':r.text||null,dialogue_id:r.type==='say'?id+'_'+i:null,row_id:id+'_'+i})));
  }
  this.g.campaignStep=s=>{if(!s.type.startsWith('campaign_'))return false;this.pendingStep=s;this.onStep?.(s);return true;};
  const createOrder=this.g.createStoryOrder;this.savedCreateOrder=createOrder;this.g.createStoryOrder=function(s){if(s.arg==='exact:@selected')s={...s,arg:'exact:'+this.progress.flags.campaign_selected_drink};return createOrder.call(this,s);};
 }
 uninstall(){if(!this.active)return;for(const[k,v]of Object.entries(this.original))this.data.tables[k]=v;for(const k of this.assetKeys)delete this.data.assets[k];this.g.campaignStep=null;this.g.createStoryOrder=this.savedCreateOrder;this.active=false;this.pendingStep=null;this.original=null;}
 // A fresh later-day start carries only established story prerequisites, never a previous run's money or choices.
 beginCommute(day){if(!Number.isInteger(day)||day<1||day>3)throw Error('시작 일차는 1~3일차여야 합니다.');if(!this.active)this.install();this.day=day;this.startDay=day;this.completed=[];this.events=[];this.pendingStep=null;
  const g=this.g;g.reset(day,'full',1100+day,false,{variant:'original',serviceVersion:this.serviceVersion});const flags=g.progress.flags;
  const prior=new Set(this.data.tables.scenes.filter(s=>Number(s.day)<day&&Number(s.day)>=0).map(s=>s.id));
  for(const step of this.data.tables.steps)if(prior.has(step.context)&&step.type==='enter')flags[step.actor+'_met']=true;
  if(day>=2)flags.tom_name_known=true;if(day>=3){flags.samho_met=true;g.seedJohnnyPrerequisites();}
  g.progress.phase='commute';this.carry=copy(g.progress);this.checkpoint=null;this.route='in';this.events.push({event:'commute-in',day});g.changed();
 }
 beginDay(day,carry=null){if(!this.active)this.install();this.day=day;const g=this.g;g.reset(day,'full',1100+day,false,{variant:'original',serviceVersion:this.serviceVersion});if(carry){g.progress={...copy(carry),day,phase:'bar_open'};g.openingBalance=g.progress.money;}
  this.checkpoint=copy(g.progress);this.route='bar';this.events.push({event:'bar',day,money:g.progress.money});
  const fresh=g.dailyUnlocks();if(day>0&&(fresh.ingredients.length||fresh.cocktails.length)){g.phase='arrival';g.pendingDailyUnlocks=true;g.overlay='dailyUnlocks';}else g.startStoryPhase('bar_open');g.changed();
 }
 finishStep(){const s=this.pendingStep;if(!s)return;this.pendingStep=null;this.g.stepDone(s);}
 settle(){if(this.route!=='bar')return false;const g=this.g;if(!g.dailySettlement)return false;if(g.dailySettlement.status!=='paid')g.confirmDailySettlement();if(g.dailySettlement.status!=='paid')return false;this.route='out';this.carry=copy(g.progress);this.events.push({event:'commute-out',day:this.day,money:this.carry.money});return true;}
 endDay(){if(this.route!=='out'||this.day===2&&this.g.johnnyMissing().length)return false;this.completed.push(this.day);this.events.push({event:'sleep',day:this.day});if(this.day===3){this.route='ending';return true;}this.day++;this.route='in';this.events.push({event:'commute-in',day:this.day});return true;}
 retry(){this.beginDay(this.day,this.checkpoint);}
 problems(result){if(!result||!this.g.currentOrder||this.g.day===0||this.g.phase!=='regular')return[];const id=this.g.currentOrder.cocktail,issues=[];
  if(result.selected!==id)issues.push('주문한 칵테일과 다른 레시피입니다.');
  if(result.missingCore?.length)issues.push('필수 재료가 빠졌습니다.');
  if(id===RESTORATION.id){const a=result.actual||{};if(a.glass!==RESTORATION.glass)issues.push('올드패션드 잔을 사용해 주세요.');if(a.tool!==RESTORATION.tool)issues.push('믹싱 글라스와 바 스푼으로 스터해 주세요.');
   if(JSON.stringify(a.ingredients)!==JSON.stringify(RESTORATION.ingredients.map(r=>r[0])))issues.push('메모에 적힌 재료 순서가 다릅니다.');
   for(const[ingredient,qty]of RESTORATION.ingredients){const r=result.results?.find(r=>r.ingredient===ingredient&&r.type===(ingredient==='sugar_cube'?'add':'pour'));if(!r||Math.abs(Number(r.value)-qty)>(ingredient==='sugar_cube'?0:5))issues.push(this.g.name(ingredient)+' '+qty+(ingredient==='sugar_cube'?'개':'ml (허용 오차 ±5ml)')+'를 확인해 주세요.');}
   if(!result.results?.some(r=>r.type==='stir'&&r.completed))issues.push('스터를 끝까지 완료해 주세요.');
  }return[...new Set(issues)];
 }
}
root.LunaCampaignEngine={Session,RESTORATION};
})(typeof window==='undefined'?globalThis:window);

/* Pure eligibility checks: used by the live NPC and the editor; never spend a resource here. */
(function(W){'use strict';
function reason(stage,id,p){
 const f=p.flags||{},inventory=p.inventory||{};
 if(stage==='repair'&&['gear','pay'].includes(id)){
  if(f.elevator_repaired)return '이미 수리했습니다.';
  if(f.elevator_repair_paid)return '수리 중입니다.';
  if(id==='gear'&&!(inventory.gear_part>0))return '기어 부품이 없습니다.';
  if(id==='pay'&&p.money<400)return '돈이 부족합니다.';
 }
 if(stage==='cat'&&id==='feed'){
  if(f.boobi_adopted||f.boobi_feeding_pending)return '이미 건네주었습니다.';
  if(!(inventory.tuna_can>0))return '참치캔이 없습니다.';
 }
 if(['boss-first','boss-repeat'].includes(stage)&&['boss-pay','boss-repair'].includes(id)){
  if(f.gang_wild_dog_received||f.shiba_bought_wild_dog||inventory.wild_dog>0)return '이미 받았습니다.';
  if(f.gang_wild_dog_paid||f.gang_wild_dog_repair_promised)return '거래 중입니다.';
  if(id==='boss-repair'&&!f.elevator_repaired)return '엘리베이터 수리가 필요합니다.';
  if(id==='boss-pay'&&p.money<500)return '돈이 부족합니다.';
 }
 return '';
}
function apply(stage,options,p){return options.map(o=>{const why=reason(stage,o.id,p);return {...o,disabled:!!why,disabledReason:why};});}
W.LunaNeighborhoodChoiceRules={reason,apply};
})(typeof window==='undefined'?globalThis:window);

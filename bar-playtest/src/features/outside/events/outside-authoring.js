/* Native CSV choice copy/extra gates. Handlers retain their non-negotiable transaction guards. */
(function(W){
'use strict';
const rules=(W.LunaRuleParts?.conditions||require('../../../core/story-conditions.js'))({GRADES:[],n:(v,d=0)=>Number(v)||d,root:{}});
function binding(line){
 if(line?.type==='thug-choice')return{parent:'steps_day1_corridor_thug_11',ids:{}};
 if(line?.type==='shop-choice')return {
  allowance:{parent:'steps_shiba_allowance_7',ids:{'shop-allowance-yes':'allow-yes','shop-allowance-no':'allow-no'}},
  greeting:{parent:'steps_shiba_shop_revisit_2',ids:{'shop-no':'shop-no-revisit'}},
  items:{parent:'steps_shiba_stock_2',ids:{'shop-buy-bitters':'buy-bitters'}}
 }[line.stage];
 if(line?.type==='notion-choice')return line.stage==='topic'?{parent:'steps_day2_thug_information_2',ids:{}}:{parent:'steps_info_'+line.topic+'_2',ids:{'info-pay':'pay-'+line.topic,'info-cancel':'cancel-'+line.topic}};
 return null;
}
const menus={
 'newspaper-choice':[['newspaper-wrong','노예가 더 높을 것 같아요.'],['newspaper-right','요즘 사람들이 더 높을 것 같아요.']],
 'beggar-choice':[['beggar-pay','네, 믿을게요 · 200원'],['beggar-refuse','아니요.'],['beggar-question','혹시 사기꾼인가요?']],
 cat:[['pet','쓰다듬기'],['feed','참치캔 주기'],['cancel','취소']],
 'home-cat':[['pet','쓰다듬기'],['cancel','취소']],
 'repair-intro':[['talk','대화한다.'],['cancel','무시한다.']],
 repair:[['gear','기어 부품 건네주기'],['pay','비용 건네주기 · 400원'],['cancel','취소']],
 guard:[['ask','술을 찾고 있어요.'],['cancel','자리를 뜬다.']],
 'boss-first':[['boss-wait','( 대화 그만두기 )'],['boss-repair','승강기는 이미 고쳤습니다.'],['boss-pay','돈으로 살게요 · 500원']],
 'boss-repeat':[['boss-wait','( 대화 그만두기 )'],['boss-repair','승강기 고쳤습니다.'],['boss-pay','돈으로 살게요 · 500원']],
 wardrobe:[['press','누른다'],['cancel','취소']],
};
const key=line=>binding(line)?.parent||line?.editorRowId;
function prompt(line){if(line.type==='shop-choice'&&line.stage==='items')return '전부 다 보여 주긴 싫고, 몇 개만 보여 줄게.';if(line.type==='notion-choice')return line.stage==='topic'?'뭐야? 물어볼 거라도 있어?':'...맨입으로는 안 돼. 50원만 주면 알려 주지.';return '';}
function defaults(line,native=[],newspaper=[]){
 const b=binding(line),list=native.map(c=>({id:c.id,dispatch:Object.keys(b?.ids||{}).find(id=>b.ids[id]===c.id)||c.id,label:c['text.ko'],when:c.when,reason:c['lock_reason.ko'],row:c}));
 if(line.type==='shop-choice'&&line.stage==='items'){list.sort((a,b)=>Number(b.id==='shop-no')-Number(a.id==='shop-no'));list.push({id:'shop-buy-tuna_can',dispatch:'shop-buy-tuna_can',label:'참치캔 구매 · 50원',when:'money >= 50',reason:'돈이 부족합니다.'});}
 if(list.length)return list;
 return(menus[line.stage]||menus[line.type]||[]).map(([id,label],i)=>({id,dispatch:id,label:line.type==='newspaper-choice'?newspaper[i]?.['text.ko']||label:label,when:'',reason:''}));
}
function edited(line,data=W.LUNA_DATA){return data?.outsideChoiceEdits?.[key(line)]||null;}
function displayLine(line,source){const cfg=edited(line,source);return cfg?.prompt?{...line,...cfg.prompt}:line;}
function choices(line,view,model){const source=model?.story?.speech?.authoring||W.LUNA_DATA,config=edited(line,source),data=source?.outsideChoices||[],p=model?.qa?.shopProgress||W.barGame?.progress||{};
 if(config){const original=view?.options||[];const options=config.active.map(id=>{const row=data.find(r=>r.row_id===id);if(!row)return null;const route=config.routes[id],base=route?.startsWith('native:')?original.find(o=>o.id===route.slice(7)):null;
   // Sold stock and conditionally absent actions must stay absent, even for aliases.
   if(route?.startsWith('native:')&&!base)return null;
   let allowed=false;try{allowed=rules.condition(row.when,{...p,day:model?.config?.day||0,flags:p.flags||{},affinity:p.affinity||{}});}catch{}
   return {...base,id:row.id,label:row['text.ko'],disabled:!!base?.disabled||!allowed,disabledReason:!allowed?row['lock_reason.ko']||'조건이 맞지 않습니다.':base?.disabledReason};
 }).filter(Boolean);return{...view,options};}
 const b=binding(line);if(!b||!view)return view;
 return {...view,options:view.options.map(o=>{const row=data.find(r=>r.parent_id===b.parent&&r.id===(b.ids[o.id]||o.id));if(!row)return o;let allowed=false;try{allowed=rules.condition(row.when,{...p,day:model?.config?.day||0,flags:p.flags||{},affinity:p.affinity||{}});}catch{}
  return {...o,label:row['text.ko']||o.label,disabled:!!o.disabled||!allowed,disabledReason:!allowed?(row['lock_reason.ko']||'조건이 맞지 않습니다.'):o.disabledReason};
 })};
}
function resolve(line,id,view,source=W.LUNA_DATA){const config=edited(line,source);if(!config)return null;const selected=view?.options?.find(o=>o.id===id);if(!selected||selected.disabled)return{blocked:true};const row=(source?.outsideChoices||[]).find(r=>config.active.includes(r.row_id)&&r.id===id);return row?{route:config.routes[row.row_id]}:{blocked:true};}
const api={choices,binding,key,defaults,prompt,displayLine,edited,resolve};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else W.LunaOutsideAuthoring=api;
})(typeof window==='undefined'?globalThis:window);

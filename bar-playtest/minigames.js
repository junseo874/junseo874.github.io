(function(root){
'use strict';
const C=typeof module==='undefined'?root.LunaCore:require('./core.js');
const KINDS=['open','pour','fill_up','shake','stir'];
const EXAMPLES={open:'bottle_beer',pour:'gin_tonic',fill_up:'gin_tonic',shake:'gin_fizz',stir:'dry_martini'};
function example(g,kind){
 if(!KINDS.includes(kind))throw Error('Unknown minigame: '+kind);
 const selected=g.cocktail(EXAMPLES[kind]),actual={selected:selected.id,glass:selected.glass,tool:selected.mix==='shake'?'shaker':selected.mix==='stir'?'mixing_glass':null,ingredients:g.t.recipes.filter(r=>r.context===selected.id&&!r.auto_apply).map(r=>r.ingredient)};
 const step=C.buildQueue(g.data,selected,actual).find(s=>s.type===kind);
 if(!step)throw Error('Missing minigame example: '+kind);
 return {selected,actual,step};
}
function attach(g){
 const reset=g.reset.bind(g),next=g.nextGimmick.bind(g),end=g.endGimmick.bind(g);let attempt=0;
 g.minigame=null;
 g.reset=function(...args){if(this.minigame)this.craft=null;this.minigame=null;return reset(...args);};
 g.startMinigame=function(kind,variant='gpt',difficulty='standard'){
  const sample=example(this,kind);variant=variant==='original'?'original':'gpt';difficulty=['cozy','standard','challenge'].includes(difficulty)?difficulty:'standard';
  this.reset(99,'practice',1,false,{variant,difficulty});
  this.phase='minigame';this.mode='minigame';this.screen='gimmick';
  this.minigame={kind,variant,difficulty,source:sample.selected.id,result:null};
  this.craft={id:'minigame_attempt_'+(++attempt),actual:structuredClone(sample.actual),queue:[structuredClone(sample.step)],index:0,results:[],elapsed:0};
  this.nextGimmick();this.log('minigame_start',{kind,variant,difficulty,id:this.craft.id});this.changed();return true;
 };
 g.nextGimmick=function(){
  if(!this.minigame||this.craft.queue[this.craft.index])return next();
  if(this.minigame.result)return;
  const state=this.gimmick,step=this.craft.queue[0],result=this.craft.results[0];
  if(!result||!state)throw Error('Missing minigame result');
  let score=0;
  if(step.type==='open')score=result.completed?Math.max(0,100-result.failures*this.c('open_penalty_per_failure',15)):0;
  else if(['shake','stir'].includes(step.type))score=C.clamp(result.completion*100,0,100);
  else score=C.band(this.t.score_bands,'quantity',Math.abs(result.value-step.target)/step.target);
  const grade=this.t.grade_cuts.slice().sort((a,b)=>Number(b.min_pct)-Number(a.min_pct)).find(row=>score>=Number(row.min_pct))?.grade||'sewage';
  this.minigame.result={...result,score,grade,elapsed:this.craft.elapsed,target:step.target,unit:step.unit,success:state.success,targetStacks:state.targetStacks,id:this.craft.id};
  this.screen='minigame_result';this.gimmick=null;this.result=null;this.log('minigame_result',this.minigame.result);this.changed();
 };
 g.endGimmick=function(){if(this.minigame&&(!this.gimmick||this.gimmick.type==='open'&&!this.gimmick.completed))return false;return end();};
 g.retryMinigame=function(){if(!this.minigame)return false;const {kind,variant,difficulty}=this.minigame;return this.startMinigame(kind,variant,difficulty);};
 return {example:kind=>example(g,kind),active:()=>!!g.minigame};
}
function createUI({g,ui,L,esc,button,itemArt,tabsHTML,mini}){
 const name=kind=>({open:L('병따기','Bottle opening'),pour:L('따르기','Pouring'),fill_up:L('필업','Fill-up'),shake:L('쉐이킹','Shaking'),stir:L('스터','Stirring')})[kind];
 const art=kind=>({open:'beer',pour:'gin',fill_up:'soda_water',shake:'shaker',stir:'mixing_glass'})[kind];
 const variant=()=>ui.miniVariant||'gpt';
 const difficulty=()=>ui.miniDifficulty||'standard';
 const profile=()=>root.LunaRemix.PROFILES[difficulty()];
 function goal(kind){const sample=mini.example(kind);if(kind==='open')return L('타이밍을 맞춰 병 1개 열기','Open one bottle with precise timing');if(['pour','fill_up'].includes(kind))return L('목표량 ','Target: ')+sample.step.target+' '+sample.step.unit;const count=variant()==='gpt'?profile()[kind]:g.c(kind==='shake'?'shake_target_stacks':'stir_target_stacks',kind==='shake'?20:10);return kind==='shake'?L(count+'회 타이밍 판정',count+' timing attempts'):L(count+'바퀴 순서대로 젓기',count+' clockwise rounds');}
 function control(kind){return kind==='stir'?L('W 시작 · D → S → A → W','Start W · D → S → A → W'):['pour','fill_up'].includes(kind)?L('Space 누르고 놓기','Hold & release Space'):kind==='shake'?L('클릭으로 시작 · 표시가 노드와 겹칠 때 클릭','Click to start · click on node overlap'):L('Space로 시작하고 타이밍에 다시 누르기','Space to start, then press on target');}
 function description(kind){return ({open:L('줄어드는 원이 목표 원에 겹치는 순간을 맞춰요.','Match the shrinking ring to its target.'),pour:L('병을 기울여 정해진 양만큼 정확히 따라요.','Tilt the bottle and pour the target amount.'),fill_up:L('마지막으로 채우는 재료의 양을 맞춰요.','Practice adding the final fill-up ingredient.'),shake:L('움직이는 표시와 목표가 만나는 순간을 눌러요.','Press when the moving marker meets the target.'),stir:L('제한시간 안에 시계 방향으로 한 바퀴씩 저어요.','Complete clockwise rounds before time runs out.')})[kind];}
 function lobbyHTML(){return `<div class="start-screen minigame-lobby">${tabsHTML()}<header class="minigame-heading"><div class="eyebrow">GIMMICK ARCADE / PRACTICE</div><h1>${L('원하는 기믹만, 바로 한 판.','Pick a skill. Jump straight in.')}</h1><p>${L('주문·재료 준비 없이 하나만 연습하세요. 영업 점수·돈·칵테일 최고점에는 반영하지 않습니다.','Skip orders and preparation. Practice does not affect service, money or cocktail records.')}</p></header><section class="minigame-options"><div><span>${L('플레이 규칙','Rules')}</span><div class="row">${[['gpt','GPT 개선 규칙','GPT Remix'],['original','기존 규칙','Original']].map(([id,ko,en])=>button(L(ko,en),'miniRules',`data-id="${id}" aria-pressed="${variant()===id}"`,variant()===id?'selected':'')).join('')}</div></div><div><span>${L('개선 규칙 난이도','Remix difficulty')}</span><div class="row">${[['cozy','편안하게','Cozy'],['standard','보통','Standard'],['challenge','도전','Challenge']].map(([id,ko,en])=>button(L(ko,en),'miniDifficulty',`data-id="${id}" aria-pressed="${difficulty()===id}" ${variant()==='original'?'disabled':''}`,difficulty()===id?'selected':'')).join('')}</div></div><p>${variant()==='gpt'?L('단계가 끝나면 자동으로 결과를 보여줘요.<br>쉐이킹은 누른 횟수만 판정해요.','Results follow automatically.<br>Shaking counts only your inputs.'):L('원래 영업과 같은 판정 규칙이에요.<br>완료 후 결과 보기 버튼을 눌러주세요.','Uses original service rules.<br>Press View result after completion.')}</p></section><div class="minigame-cards">${KINDS.map((kind,i)=>`<button class="minigame-card" data-act="miniStart" data-id="${kind}"><span class="minigame-number">0${i+1}</span><div class="minigame-art">${itemArt(art(kind))}</div><h2>${name(kind)}</h2><p>${description(kind)}</p><strong>${goal(kind)}</strong><small>${control(kind)}</small><span class="minigame-enter">${L('바로 시작 →','Play now →')}</span></button>`).join('')}</div><footer>${L('목표량·판정은 현재 데이터에서 읽습니다. 시간은 기록만 하며 전체 칵테일의 시간 감점은 적용하지 않습니다.','Targets and judgement bands use current data. Time is reported, not penalized against a full cocktail recipe.')}${button(L('조작 안내','Controls'),'help','','subtle')}</footer></div>`;}
 function resultHTML(){const m=g.minigame,r=m?.result;if(!r)return'';const quantitative=['pour','fill_up'].includes(m.kind),error=quantitative?(r.value/r.target-1)*100:0;let detail=quantitative?L('목표 ','Target ')+r.target+' '+r.unit+' → '+L('실제 ','actual ')+r.value.toFixed(2)+' '+r.unit:m.kind==='open'?L('빗나간 횟수 ','Misses: ')+r.failures:L('성공 ','Successful ')+r.success+' / '+r.targetStacks;let hint=quantitative?(Math.abs(error)<5?L('목표량에 잘 맞췄어요.','Close to the target!'):error>0?L('조금 많이 따랐어요. 다음에는 더 일찍 놓아 보세요.','A little too much. Release earlier next time.'):L('양이 부족해요. 다음에는 조금 더 채워 보세요.','A little short. Pour a little longer next time.')):m.kind==='open'?(r.failures?L('다음엔 원이 겹치는 순간을 조금 더 기다려 보세요.','Wait for the rings to overlap on your next try.'):L('한 번에 깔끔하게 열었어요!','A clean first try!')):r.score===100?L('모든 입력을 정확하게 맞췄어요!','Every attempt was on target!'):L('서두르지 말고 표시된 타이밍과 순서를 따라가 보세요.','Follow the timing and sequence without rushing.');return `<section class="minigame-result"><div class="eyebrow">SINGLE GIMMICK / RESULT</div><div class="minigame-result-art">${itemArt(art(m.kind))}</div><h1>${name(m.kind)} ${L('연습 완료','complete')}</h1><div class="minigame-score">${Math.round(r.score)}<small> / 100</small></div><p>${esc(detail)}</p><p class="minigame-feedback">${hint}</p><div class="minigame-result-meta"><span>${L('조작 시간','Active time')} ${r.elapsed.toFixed(1)}s</span><span>${m.variant==='gpt'?L('GPT 개선 규칙','GPT Remix'):L('기존 규칙','Original')}</span></div><div class="row">${button(L('같은 기믹 다시 하기','Play again'),'miniRetry','','primary')}${button(L('다른 기믹 고르기','Choose another'),'miniLobby')}${button(L('영업 시작 화면','Bar setup'),'miniBar','','subtle')}</div><small>${L('미니게임 연습 결과입니다. 주문·재료·잔·제조시간에 대한 종합 감점은 없습니다.','Single-skill score only. No order, material, glass or full-recipe time penalties.')}</small></section>`;}
 function helpHTML(){return `<div class="help-grid">${KINDS.map(kind=>`<section><h3>${name(kind)}</h3><p>${control(kind)}</p><p>${description(kind)}</p></section>`).join('')}<section><h3>${L('공통 조작','Common controls')}</h3><p>${L('ESC · 옵션 / 일시정지','ESC · options / pause')}</p><p>${L('상단 기믹 선택 · 목록으로 돌아가기','Choose a minigame · return to selection')}</p><p>${L('한 기믹만 채점합니다. 영업 기록에 합산하지 않습니다.','One skill is scored; service records stay unchanged.')}</p></section></div>`;}
 return {lobbyHTML,resultHTML,helpHTML};
}
const api={KINDS,example,attach,createUI};if(typeof module!=='undefined')module.exports=api;root.LunaMinigames=api;
})(typeof window==='undefined'?globalThis:window);

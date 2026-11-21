/* Line-oriented companion to the map. Pure row summaries/rendering; editor.js
   remains the owner of source mutations, selection, undo and preview messages. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),F=W.LunaBarFlow,R=W.LunaBarWiring,esc=W.LunaBarCanvas.esc,raw=F.clean;
const plain=v=>raw(v).replace(/<[^>]*>/g,''),group=t=>t==='say'?'speech':t==='choice'?'choice':['coaster','order','craft','serve','empty_glass'].includes(t)?'service':'event';
const tone=t=>({say:'talk',choice:'choice',coaster:'prop',empty_glass:'prop',order:'order',craft:'serve',serve:'serve',enter:'cast',exit:'cast',end_part:'end'}[t]||'event');
const opt=(v,name,selected)=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(name)+'</option>';
const field=(title,k,val,multiline=false)=>'<label>'+esc(title)+(multiline?'<textarea data-field="'+k+'" rows="3">\n'+esc(W.LunaDialogueEditorModel.decode(val))+'</textarea>':'<input data-field="'+k+'" value="'+esc(W.LunaDialogueEditorModel.decode(val))+'">')+'</label>';
const backing=(title,key,value)=>'<strong class="rc-field-title">'+esc(title)+'</strong><input type="hidden" data-field="'+key+'" value="'+esc(value)+'">';
const tags=W.LunaLineMarkup.toolbar();
function create(a){
 const nextNode=$('line-edit-next');
 let found=[],modified=false,fold=false;
 const filtersOn=()=>!!($('search').value.trim()||$('line-kind').value!=='all'||modified);
 const kind=r=>a.types[r.type]||F.kind(r.type),cocktail=(m,id)=>m.projected.data.tables.cocktails.find(c=>c.id===id)?.['name.ko']||id;
 function describe(r,m){
  if(r.type==='choice')return m.choices(r.arg).map(o=>plain(o['text.ko'])).join(' / ');
  const text=plain(r['text.ko']);if(text)return text;
  return {enter:(r.arg==='R'?'오른쪽':'왼쪽')+' 좌석에 등장',exit:'자리에서 퇴장',order:r.arg==='free'?'자유 주문':cocktail(m,raw(r.arg).replace(/^exact:/,'')),craft:'칵테일 제조 대기',serve:'완성된 잔 제공',coaster:'손님에게 코스터 제공',empty_glass:'테이블의 잔을 빈잔으로 교체',effect:R.authorEffects(r.effects)||'상태 변경',end_part:'영업 종료'}[r.type]||raw(r.arg)||kind(r);
 }
 function draw(){
  const m=a.model(),list=a.rows(),sel=a.selected(),q=$('search').value.trim().toLowerCase(),f=$('line-kind').value;
  const changed=new Set(m.changes().map(x=>x.id));
  const dirty=r=>changed.has(r.row_id)||r.type==='choice'&&m.choices(r.arg).some(o=>changed.has(o.row_id)||!m.base.tables.bar_choices.some(b=>b.row_id===o.row_id))||r.type==='choice'&&m.base.tables.bar_choices.filter(o=>o.parent_id===m.tables.bar_choice_groups.find(g=>g.choice_group===r.arg)?.row_id).length!==m.choices(r.arg).length;
  const isFilter=!!q||f!=='all'||modified;
  found=list.filter(r=>(f==='all'||group(r.type)===f)&&(!modified||dirty(r))&&(!q||[describe(r,m),r.actor,a.actorName(r.actor),r.row_id,r.type,kind(r),R.readable(r.when)].join(' ').toLowerCase().includes(q)));
  $('line-list').innerHTML=found.map(r=>{const text=describe(r,m),current=sel===r.row_id;
   return '<button class="line tone-'+tone(r.type)+(dirty(r)?' changed':'')+'" data-line="'+esc(r.row_id)+'" role="option" aria-selected="'+current+'" aria-current="'+current+'" tabindex="'+(current?0:-1)+'" title="'+esc(text)+'"><small>'+esc(r.seq)+'</small><small class="line-chip">'+esc(kind(r))+'</small><span class="line-actor">'+esc(a.actorName(r.actor)||'—')+'</span><span class="line-excerpt">'+esc(text)+'</span></button>';
  }).join('')||'<div class="line-empty"><strong>조건에 맞는 줄이 없습니다.</strong><button id="reset-line-search">필터 지우기</button></div>';
  $('line-count').textContent=isFilter?found.length+' / '+list.length+'줄':list.length+'줄';$('line-scope').textContent=a.scope()?'선택한 범위':'전체 대본';
  const at=list.findIndex(r=>r.row_id===sel),ix=found.findIndex(r=>r.row_id===sel);$('cursor').textContent=at<0?'—':(at+1)+' / '+list.length+'줄';
  $('previous').disabled=ix<=0;$('next').disabled=!found.length||ix===found.length-1;
  const r=a.current();if(r){const guards=a.rowTools(r,list,isFilter);for(const [id,key,title] of [['up','up','한 줄 위로'],['down','down','한 줄 아래로'],['add','after','다음에 줄 추가'],['duplicate','duplicate','이 줄 복제'],['delete','delete','이 줄 삭제']]){const b=$(id);b.disabled=!!guards[key];b.title=guards[key]||title;}}
 }
 function refreshCast(){
  const el=$('inspector'),actor=el.querySelector('select[data-field="actor"]'),r=a.current();
  if(!actor||!r)return;
  function sync(select,ids,label,value){
   const values=[...new Set(ids)];
   if(values.length===select.length&&values.every((id,i)=>select.options[i].value===id&&select.options[i].text===label(id)))return;
   select.replaceChildren(...values.map(id=>new Option(label(id),id,false,id===value)));
  }
  sync(actor,['luna',...Object.keys(a.model().presentation.characterLayers),...Object.keys(a.poses()),'shiba',r.actor].filter(Boolean),a.actorName,r.actor);
  const pose=el.querySelector('[data-poses]');
  if(pose){
   const names={default:'기본',joy:'기쁨',anger:'화남',drunk:'취함',serious:'진지함',success:'성공',fail:'실패'};
   sync(pose,['default',...(a.poses()[r.actor]||[]),...(raw(r.arg)?[r.arg]:[])],id=>names[id]||id,r.arg);
  }
 }
 function inspector(){
  const m=a.model(),r=a.current();if(!r)return;const isText=['say','order'].includes(r.type),isMenu=r.type==='choice';
  const UI=W.LunaFlowAuthorUI,g=UI.group,el=$('inspector'),restore=UI.inspectorState(el,r.row_id+'/'+r.type);
  const cast='<label>'+(r.type==='say'?'화자':'대상')+'<select data-field="actor"></select></label>';
  const pose='<label>표정<select data-field="arg" data-poses></select></label>';
  const opts=isMenu?m.choices(r.arg):[],dest=isMenu?m.scenes.filter(s=>s.id!==a.scene()&&s.day===m.scenes.find(x=>x.id===a.scene()).day):[];
  const argNames={tutorial:'튜토리얼',order:'주문에 맞춰 제조',tutorial_beer:'병맥주 튜토리얼',tutorial_recipe:'레시피 튜토리얼',seatExplore:'좌석 둘러보기',seatIndicator:'좌석 표시'};
  const argList=[...new Set(['',...m.tables.steps.filter(s=>W.LunaBarDays.barDataset(s.dataset_id)&&s.type===r.type).map(s=>raw(s.arg)),raw(r.arg)])];
  const argField=label=>'<label>'+label+'<select data-field="arg">'+argList.map(s=>opt(s,s?(argNames[s]||s):'기본',raw(r.arg))).join('')+'</select></label>';
  const rule=R.readable(r.when),effects=R.authorEffects(r.effects);
  let primary='',optionRules='',translation='';
  if(r.type==='order'){
   const day=m.scenes.find(s=>s.id===a.scene()).day,drinks=m.projected.data.tables.cocktails.filter(c=>+c.unlock_day<=+day||'exact:'+c.id===r.arg);
   const drink='<label>주문할 칵테일<select data-field="arg">'+opt('free','자유 주문',r.arg)+drinks.map(c=>opt('exact:'+c.id,c['name.ko'],r.arg)).join('')+(!['free',...drinks.map(c=>'exact:'+c.id)].includes(r.arg)?opt(r.arg,r.arg,r.arg):'')+'</select></label>';
   primary='<div class="field-pair">'+drink+cast+'</div>';
  }
  if(isText)primary+='<section class="line-primary">'+field(r.type==='order'?'주문 대사':'한국어 대사','text.ko',r['text.ko'],true)+tags+'</section>';
  if(r.type==='say'||r.type==='expression')primary+='<div class="field-pair">'+cast+pose+'</div>';
  else if(r.type==='enter')primary+=cast+'<div class="field-pair"><label>좌석<select data-field="arg">'+opt('L','왼쪽',r.arg)+opt('R','오른쪽',r.arg)+'</select></label><label>등장 방식<select data-field="entrance">'+opt('','페이드 등장',raw(r.entrance))+opt('seated','이미 앉아 있음',r.entrance)+'</select></label></div>';
  else if(isMenu){
   primary='<section id="choice-fields" aria-label="선택지 문구"><div class="choice-line-title"><b>선택지 문구 <small>'+opts.length+' / 4</small></b><button id="add-choice" '+(opts.length>=4?'disabled':'')+'>＋ 선택지 추가</button></div>'+
    opts.map((o,i)=>'<div class="choice-editor" data-choice-row="'+esc(o.row_id)+'"><div class="choice-head"><b>선택지 '+(i+1)+'</b><button data-remove-choice="'+esc(o.row_id)+'" '+(opts.length<=1?'disabled':'')+'>삭제</button></div>'+field('문구','text.ko',o['text.ko'],true)+tags+'</div>').join('')+'</section>';
   const localWires=R.scan(m,a.scene()).routes.filter(w=>w.source===r.row_id);
   const destination=o=>{const w=localWires.find(w=>w.choice===o.row_id),to=w&&m.row(w.target),value=to?'@local':raw(o.goto);return (to?opt('@local','이 대본 · '+to.seq+'번 줄',value):'')+opt('',to||value?'연결 해제 · 원래 순서':'현재 대본에서 계속',value)+dest.map(s=>opt(s.id,s.title||s.id,value)).join('');};
   optionRules=opts.map((o,i)=>g('choice:'+o.row_id,'선택지 '+(i+1)+' · 연결과 조건',
    '<label>다음 연결<select data-field="goto">'+destination(o)+'</select></label>'+
    backing('선택 가능 조건','when',R.readable(o.when))+'<div class="choice-condition-tools"></div>'+backing('선택 시 효과','effects',R.authorEffects(o.effects))+field('선택할 수 없는 이유','lock_reason.ko',o['lock_reason.ko']),
    'class="choice-rule" data-choice-row="'+esc(o.row_id)+'"')).join('');
  }else if(r.type==='effect')primary+=backing('상태 변경 효과','effects',effects);
  else if(['exit','coaster','empty_glass','craft','serve'].includes(r.type))primary+=cast;
  else if(!['order','end_part'].includes(r.type))primary+=cast+argField(r.type==='tutorial'?'튜토리얼 종류':'연출 종류');
  const exec=g('execution','실행 조건과 효과',backing('실행 조건','when',rule)+'<div class="line-condition-tools"></div>'+(r.type==='effect'?'':backing('완료 시 효과','effects',effects))+
   '<label>진행 방식<select data-field="sync">'+opt('wait','이 줄이 끝난 뒤 진행','no_wait'===r.sync?'no_wait':'wait')+opt('no_wait','다음 입장과 동시에',r.sync)+'</select></label>','class="line-advanced"');
  if(isText||isMenu)translation=g('translation','영문',isMenu?opts.map((o,i)=>'<div data-choice-row="'+esc(o.row_id)+'">'+field('선택지 '+(i+1),'text.en',o['text.en'])+'</div>').join(''):field('영문 대사','text.en',r['text.en'],true),'class="line-advanced"');
  const preview=g('preview','미리보기 설정 · 저장 안 함','<label>소지금<input id="preview-money" type="number" min="0"></label><strong class="rc-field-title">테스트할 플래그</strong><input type="hidden" id="flags"><div id="preview-flag-picker"></div><button id="apply-preview">미리보기에 적용</button>','class="line-advanced"');
  const meta=g('source','진행 종류와 ID','<label>진행 종류<select data-field="type">'+a.typeOptions(r).map(t=>'<option value="'+esc(t.id)+'" '+(t.id===r.type?'selected ':'')+(t.reason?'disabled title="'+esc(t.reason)+'"':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label>'+
   (isMenu?'<label>선택지 그룹 ID<input readonly value="'+esc(r.arg)+'" title="연결은 위의 선택지별 설정에서 변경합니다"></label>':['exit','coaster','empty_glass','craft','serve'].includes(r.type)&&argList.length>1?argField('진행 옵션'):'')+'<p class="row-id">줄 ID · '+esc(r.row_id)+'</p>','class="line-advanced"');
  el.innerHTML='<header class="line-inspector-head inspector-title tone-'+tone(r.type)+'"><h2>'+esc(kind(r))+'</h2><small>'+esc(r.seq)+'번 줄</small></header>'+primary+optionRules+exec+translation+preview+meta;
  el.querySelector('header').append(nextNode);nextNode.disabled=r.type==='end_part';nextNode.title=nextNode.disabled?'마지막 노드입니다.':'현재 노드의 다음 대사를 편집합니다.';
  for(const t of el.querySelectorAll('textarea[data-field="text.ko"]'))W.LunaLineMarkup.refresh(t,m.tables.text_tags);
  refreshCast();
  const ctx=a.settings();$('preview-money').value=ctx.money;$('flags').value=Object.entries(ctx.flags).map(([id,v])=>'flag.'+id+' = '+(v?'true':'false')).join('; ');W.LunaFlagPicker.attach($('preview-flag-picker'),$('flags'),'effects',a.model);
  const build=UI.conditionTools;build(el.querySelector('.line-condition-tools'),el.querySelector('[data-fold="execution"] [data-field=when]'),a.model);
  for(const box of el.querySelectorAll('.choice-rule'))build(box.querySelector('.choice-condition-tools'),box.querySelector('[data-field=when]'),a.model);
  for(const input of el.querySelectorAll('[data-field=effects]')){const wrap=document.createElement('div');input.after(wrap);W.LunaRuleEditor.effects(wrap,input,a.model);}restore();
 }
 function pane(which){$('line-workspace').dataset.pane=which;for(const b of $('line-pane-switch').children)b.setAttribute('aria-pressed',String(b.dataset.pane===which));}
 function foldPreview(){fold=!fold;document.querySelector('[data-expand-preview="line-viewport"]').disabled=fold;$('preview-large').disabled=fold;$('line-preview').hidden=fold;$('preview-note').hidden=fold||!$('preview-note').textContent;$('preview-fold').textContent=fold?'미리보기 펼치기':'미리보기 접기';$('preview-fold').setAttribute('aria-expanded',String(!fold));}
 function clear(){modified=false;$('line-changed').setAttribute('aria-pressed','false');$('search').value='';$('line-kind').value='all';draw();}
 $('line-kind').onchange=draw;$('line-changed').onclick=()=>{modified=!modified;$('line-changed').setAttribute('aria-pressed',String(modified));draw();};
 $('search').oninput=draw;$('search').onkeydown=e=>{if(e.isComposing)return;if(e.key==='Enter'&&found[0]){e.preventDefault();a.pick(found[0].row_id);$('line-list').focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();clear();}};
 $('line-list').onclick=e=>{if(e.target.id==='reset-line-search'){clear();$('search').focus();return;}const b=e.target.closest('[data-line]');if(b){a.pick(b.dataset.line);if(matchMedia('(max-width:760px)').matches&&$('line-workspace').dataset.pane==='list')pane('detail');}};
 $('line-list').onkeydown=e=>{if(e.isComposing||!found.length)return;let at=found.findIndex(r=>r.row_id===a.selected());
  if(e.key==='Enter'){e.preventDefault();pane('detail');$('inspector').querySelector('textarea[data-field="text.ko"],select[data-field=actor],textarea[data-field=effects]')?.focus();return;}
  if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();at=e.key==='Home'?0:e.key==='End'?found.length-1:Math.max(0,Math.min(found.length-1,at+(e.key==='ArrowDown'?1:-1)));a.pick(found[at].row_id);$('line-list').focus({preventScroll:true});};
 $('line-pane-switch').onclick=e=>{const b=e.target.closest('[data-pane]');if(b)pane(b.dataset.pane);};
 $('preview-fold').onclick=foldPreview;$('preview-large').onclick=()=>{const on=$('line-workspace').classList.toggle('large-preview');$('preview-large').setAttribute('aria-pressed',String(on));$('preview-large').textContent=on?'기본 크기':'크게 보기';};
 document.addEventListener('keydown',e=>{if(document.body.classList.contains('map-open')||document.querySelector('dialog[open]')||e.isComposing||e.key!=='/'||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,select,textarea,[contenteditable=true]'))return;e.preventDefault();pane('list');$('search').focus();});
 return {draw,inspector,refreshCast,clear,pane,get found(){return found;},get filtered(){return filtersOn();}};
}
W.LunaLineWorkspace={create};
})(window);

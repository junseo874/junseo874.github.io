(async function(W){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API=W.LunaOutsideEditorModel,decode=W.LunaDialogueEditorModel.decode,Storage=W.LunaEditorStorage;
const draftKey='luna.outside.editor.draft.v1',favoriteKey='luna.outside.editor.favorites.v1';let model,source,flowId='',selected='',playing=false,busy=false,history=[],profiles={},flags={},inventory={},day=1,money=1000,lastField='',lastAt=0,restoring=false;
let favorites=[];try{favorites=JSON.parse(localStorage.getItem(favoriteKey)||'[]');}catch{}
const Days=W.LunaOutsideFlowDays,visits=new Map(),recent=new Map(),tabs=$('outside-day-tabs'),tripFilters=$('outside-trip-filters');
let filterDay=0,filterTrip='both',dayIndex=null,groupSignature='';
const indexDays=()=>dayIndex||(dayIndex=Days.index(model)),allowed=f=>indexDays().has(f,filterDay,filterTrip),visibleFlows=()=>model.visibleFlows().filter(allowed);
const flow=()=>model.flow(flowId),rows=()=>stage?model.sequence(flowId):indexDays().sequence(flowId,filterDay,filterTrip),row=()=>model.row(selected);
let editTrail=[];
const scopeKey=()=>filterDay+'/'+filterTrip,locationState=()=>({flowId,selected,day:filterDay,trip:filterTrip,editTrail:editTrail.slice()});
const allowWhen=(rule,f)=>indexDays().allows(f,rule,filterDay,filterTrip);
let statusTimer=0;
function status(t,quiet=false){const target=$('status'),bar=target.closest('.studio-status');target.textContent=t;target.removeAttribute('title');clearTimeout(statusTimer);bar.toggleAttribute('data-show',!!t&&!quiet);if(!quiet)statusTimer=setTimeout(()=>bar.removeAttribute('data-show'),6500);}
const label=W.LunaOutsideEditorPreview.label,typeLabel=r=>({say:'대사',timeline:'컷씬 대사',choice:'선택지'})[model.kind(r)]||(/choice/.test(model.kind(r))?'선택지':'연출 / 알림');
let chart=null,placement=null,mode=new URLSearchParams(location.search).get('view')==='script'?'script':'map',renderFrame=0,resumeTrail=[],stage=null,stageTrigger=null;
const MapUI=W.LunaOutsideFlowMap,siteOf=f=>MapUI.site(model,f),stageDialog=$('stage-dialog');
function placeSite(){const site=siteOf(flow());return {...site,pins:site.pins.filter(id=>!model.flow(id)||allowed(model.flow(id)))};}
function setScope(d,trip=filterTrip){
 const dateChanged=filterDay!==d;filterDay=d;filterTrip=Days.route(trip);
 if(d!==Days.all&&(dateChanged||restoring))day=d;resumeTrail=[];chart?.clear();
 for(const b of tabs.querySelectorAll('[role=tab]')){const on=b.dataset.day===String(d);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
 for(const b of tripFilters.querySelectorAll('[data-trip]'))b.setAttribute('aria-pressed',String(Days.enabled(filterTrip,b.dataset.trip)));
 $('outside-day-panel').setAttribute('aria-labelledby','outside-day-'+d);
}
const tripLabel=r=>r==='in'?'출근길':'퇴근길';
function describeScope(){
 const idx=indexDays(),f=flow(),allDates=idx.days(f),dates=idx.days(f,filterTrip),hint=$('outside-day-hint');
 const note=!dates.length?(flowId==='workshop'?'보관 대본':'해당 일차 없음'):allDates.length===1?dates[0]+'일차 전용':'공용 대본 · '+dates.join('·')+'일차';
 const trips=idx.routes(f,filterDay).filter(r=>Days.enabled(filterTrip,r));
 hint.textContent=note+(trips.length&&(filterDay!==Days.all||filterTrip!=='both')?' | '+trips.map(tripLabel).join('·'):'');
 hint.title=allDates.map(d=>d+'일차: '+idx.routes(f,d).map(tripLabel).join('·')).join(' / ')+(allDates.length>1?' — 여러 날이 같은 원본을 사용합니다.':'');
}
function rememberLocation(){
 if(flowId){const current=locationState();visits.set(scopeKey(),current);recent.set(filterDay,current);}
}
function linkLocation(){
 const url=new URL(location.href);url.searchParams.set('day',String(filterDay));
 if(filterTrip==='both')url.searchParams.delete('commute');else url.searchParams.set('commute',filterTrip);
 const id=flowId||recent.get(filterDay)?.flowId;if(id)url.searchParams.set('flow',id);else url.searchParams.delete('flow');
 if(url.href!==location.href)W.history.replaceState(W.history.state,'',url);
}
function updateGroups(pool){
 const groups=new Map(pool.map(f=>{const s=siteOf(f);return [s.id,s];})),signature=[...groups.keys()].join('|'),el=$('flow-group');
 if(signature===groupSignature)return;groupSignature=signature;const old=el.value;
 el.replaceChildren(new Option('전체 장소 / 인물',''),...[...groups.values()].map(s=>new Option(s.place+' · '+s.name,s.id)));
 el.value=groups.has(old)?old:'';
}
function firstInScope(pool){
 return (filterTrip!=='both'&&pool.find(f=>indexDays().routes(f,filterDay).length===1))||pool[0];
}
function emptyScope(){
 stop();preview.end();cancelAnimationFrame(renderFrame);flowId='';selected='';lastField='';
 document.body.setAttribute('data-scope-empty','');$('outside-trip-empty').hidden=false;
 $('outside-trip-message').textContent=filterTrip==='none'?'출근길과 퇴근길이 모두 꺼져 있습니다. 보려는 시간대를 켜세요.':'이 일차와 시간대에 해당하는 대본이 없습니다.';
 for(const id of ['node-detail','line-list','related-flows'])$(id).replaceChildren();
 for(const id of ['popup-preview','place-npc'])$(id).disabled=true;
 $('outside-day-hint').textContent='';$('outside-day-hint').title='';$('flow-title').textContent='';chart?.empty();
 drawFlows();linkLocation();
}
function switchScope(d,trip=filterTrip){
 if(!model||d===null||(d===filterDay&&trip===filterTrip))return;
 const before=locationState();rememberLocation();setScope(d,trip);
 const pool=visibleFlows(),prior=recent.get(d),last=visits.get(scopeKey()),saved=pool.find(f=>f.id===last?.flowId);
 const current=pool.find(f=>f.id===before.flowId),old=pool.find(f=>f.id===prior?.flowId),site=siteOf(model.flow(before.flowId||prior?.flowId)).id;
 const next=saved||current||old||pool.find(f=>siteOf(f).id===site)||firstInScope(pool);
 if(before.flowId)history.push(before);if(!next)return emptyScope();
 openFlow(next.id,false,saved?last.selected:current?before.selected:old?prior.selected:null);
}
function revealFlowScope(f){
 if(allowed(f))return;rememberLocation();const idx=indexDays(),dates=idx.days(f,filterTrip);
 if(dates.length)return setScope(filterDay===Days.all?Days.all:dates[0],filterTrip);
 const allDates=idx.days(f),d=filterDay===Days.all||!allDates.length?Days.all:allDates.includes(filterDay)?filterDay:allDates[0],trips=idx.routes(f,d);
 setScope(d,trips.length===1?trips[0]:'both');
}
tabs.onclick=e=>{const b=e.target.closest('[role=tab]');if(b)switchScope(Days.parse(b.dataset.day));};
tripFilters.onclick=e=>{const b=e.target.closest('[data-trip]');if(b)switchScope(filterDay,Days.toggle(filterTrip,b.dataset.trip));};
$('outside-trip-reset').onclick=()=>{switchScope(filterDay,'both');tripFilters.querySelector('button').focus();};
tabs.onkeydown=e=>{
 const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;
 const buttons=[...tabs.querySelectorAll('[role=tab]')],i=buttons.indexOf(e.target);if(i<0)return;e.preventDefault();
 const b=buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length];
 b.focus();switchScope(Days.parse(b.dataset.day));
};
const nextStage=$('stage-next-node'),branchPicker=W.LunaPreviewBranchPicker.create(nextStage),editNext=$('script-edit-next');
function queueChart(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>{if(!chart||!model||!selected||!row())return;if(mode==='map')chart.render();const s=placeSite();if(mode==='script'){$('site-title').textContent=s.name+' · '+flow().title;$('site-tag').textContent=s.place+' | ';$('chart-count').textContent=rows().length+'줄';}$('popup-preview').disabled=false;$('place-npc').disabled=!s.pins.length;$('place-npc').title=s.pins.length?'이 사건의 NPC를 씬에서 배치':'고정 오브젝트 또는 독립 연출에는 배치할 NPC가 없습니다.';});}
function setMode(v){mode=v;document.body.dataset.view=v;$('view-map').setAttribute('aria-pressed',String(v==='map'));$('view-script').setAttribute('aria-pressed',String(v==='script'));if(model&&selected){inspector();queueChart();}setPane('both');}
function setPane(id){document.body.dataset.pane=id;for(const b of document.querySelectorAll('.pane-switch [data-pane]'))b.setAttribute('aria-pressed',String(b.dataset.pane===id));}
function selectedNode(){return MapUI.graph(model,siteOf(flow()).id,allowed,allowWhen).byRow.get(selected);}
function stageRows(){return stage?stage.node.rows:rows();}
function nodePaths(node,trail){
 const r=node.rows.at(-1),outs=node.extra?.filter(p=>['yes','no'].includes(p.slot))||[],choices=model.isMenu(r)?options(r,true):outs.length?outs.map(p=>({graphSlot:p.slot,label:p.label,id:p.slot})):[null];
 return choices.map(c=>{
  const dest=MapUI.previewNext(model,flowId,node,c,trail),locked=c?.hidden||c?.disabled;
  const why=locked?(c.reason||'현재 상태에서는 표시되지 않는 선택지입니다.'):'';
  const line=dest.row&&decode(model.row(dest.row)?.['text.ko']).replace(/<[^>]+>/g,'');
  const target=dest.row?[model.owner(dest.row)?.title||model.flow(dest.flow)?.title,line].filter(Boolean).join(' · '):dest.label||'대화 종료';
  return {c,dest,title:c?.label||'다음 대사',detail:[c&&W.LunaOutsideGates.describe(c.when),target,locked&&dest.row&&why].filter(Boolean).join(' → '),
   badge:locked&&dest.row?'잠긴 경로 미리보기':dest.native?'본편 사건':dest.end?'종료':'',blocked:locked&&!dest.row?why:''};
 });
}
function stageButton(){
 const many=stage.paths.length>1;
 nextStage.disabled=!stage.paths.length||(!many&&!!stage.paths[0]?.blocked);nextStage.hidden=!many&&!!stage.next?.end;
 nextStage.title=many?'연결된 '+stage.paths.length+'개 분기 중 이어 볼 경로를 고릅니다.':stage.paths[0]?.blocked||'남은 대사를 건너뛰고 연결된 노드를 엽니다.';
 branchPicker.setCount(stage.paths.length);
}
function stageLine(id,animate){
 selected=id;stage.chosen='';stage.next=MapUI.previewNext(model,flowId,stage.node,null,stage.trail);stageButton();
 const list=stageRows(),i=list.findIndex(r=>r.row_id===id);$('cursor').textContent=(i+1)+' / '+list.length;
 $('previous').disabled=i===0;$('next').disabled=model.isMenu(row());
 $('stage-range').textContent=stage.paths.length>1?'다음 노드 미리보기에서 '+stage.paths.length+'개 분기 중 고를 수 있습니다.':'선택한 노드 · '+list.length+'줄'+(stage.next.end?' · 마지막 노드':'');
 $('stage-title').textContent=siteOf(flow()).name+' / '+stage.node.title;stageDialog.dataset.previewNode=stage.node.id;
 send(animate);
}
function startStageNode(f,id,fromFirst,autoplay=false){
 const flow=model.flow(f),n=flow&&MapUI.graph(model,siteOf(flow).id,allowed(flow)?allowed:undefined).byRow.get(id);
 if(!n){stop();stage.next=null;$('stage-next-node').disabled=true;$('stage-range').textContent='연결된 대사 노드를 찾을 수 없습니다.';return false;}
 flowId=f;stage.node=n;stage.paths=nodePaths(n,stage.trail);setPlaying(autoplay);stageLine(fromFirst?n.rows[0].row_id:id,autoplay);return true;
}
function startStageNodeWithTrail(dest){const before=stage.trail;stage.trail=dest.trail;if(startStageNode(dest.flow,dest.row,false))return true;stage.trail=before;return false;}
function finishStage(option){
 if(option&&(option.hidden||option.disabled||option.reason))return;
 const next=MapUI.previewNext(model,flowId,stage.node,option,stage.trail);if(next.needsChoice)return;
 stop();preview.reveal();stage.next=next;stage.chosen=option?.id||'';$('next').disabled=true;stageButton();
 const choice=option?'선택: '+option.label+' · ':'';
 const text=next.row&&decode(model.row(next.row)?.['text.ko']).replace(/<[^>]+>/g,'');
 $('stage-range').textContent=choice+(next.row?'노드 재생 완료 · 다음: '+(model.owner(next.row)?.title||model.flow(next.flow).title)+(text?' · '+text.slice(0,26)+(text.length>26?'…':''):'')
  :'노드 재생 완료 · '+next.label+' (연결된 다음 노드 없음)');
 if(next.native)preview.notice('본편 사건',next.label);
}
function showStage(fromFirst=false){
 if(stageDialog.open||!model||!row())return;stageTrigger=document.activeElement;stop();
 stage={origin:{flow:flowId,row:selected},trail:[],next:null};$('stage-host').append($('outside-viewport'),document.querySelector('.transport'));stageDialog.showModal();
 $('flow-back').hidden=true;startStageNode(flowId,selected,fromFirst===true);(model.isMenu(row())?$('preview-stage'):$('play')).focus({preventScroll:true});
}
function closeStage(){
 if(!stage||stageDialog.open)return;branchPicker.dismiss();const origin=stage.origin;stage=null;stop();flowId=origin.flow;selected=origin.row;delete stageDialog.dataset.previewNode;
 $('inline-preview').append($('outside-viewport'),document.querySelector('.transport'));$('flow-back').hidden=false;$('previous').disabled=$('next').disabled=false;
 drawLines();send();const restore=stageTrigger?.isConnected&&stageTrigger.getClientRects().length?stageTrigger:$('popup-preview');restore.focus({preventScroll:true});stageTrigger=null;
}
function chartSelect(f,id){if(f!==flowId)openFlow(f);stop();select(id);}
function focusOption(i){const panel=$('node-detail');panel.querySelector('.dp-filters [data-category="all"]')?.click();const search=panel.querySelector('.dp-search');if(search?.value){search.value='';search.dispatchEvent(new Event('input'));}const section=panel.querySelector('[data-detail-group=choice]');if(section)section.open=true;if(matchMedia('(max-width:760px)').matches)setPane('edit');const el=$('inspector').querySelector('[data-menu-index="'+i+'"] textarea');el?.focus({preventScroll:true});el?.scrollIntoView({block:'nearest'});}
const preview=W.LunaOutsideEditorPreview.create({onComplete(){if(playing)go(1,true);},onChoice:pick});
function options(r=row(),includeHidden=false){
 const choices=model.menu(r);if(!choices.length)return [];
 const line=model.step(r),owner=filterTrip==='both'?null:model.owner(r.row_id)||flow();
 const inScope=c=>filterTrip==='both'||MapUI.optionInScope(model,owner,c,MapUI.destination(model,r,c),allowed,allowWhen);
 return choices.filter(inScope).map(c=>{const id=c.route?.startsWith('native:')?c.route.slice(7):'',gate=W.LunaOutsideAuthoring.availability(line,id,{money,flags,inventory},day,decode(c.when),decode(c.reason));return {...c,...gate,reason:gate.disabledReason};}).filter(c=>includeHidden||!c.hidden);}
function availableRoutes(r,c){const group=siteOf(flow()).id;return model.visibleFlows().filter(f=>(allowed(f)||c.route==='flow:'+f.id)&&!f.campaign&&(c.route==='flow:'+f.id||model.removableMenu(r)&&siteOf(f).id===group&&(model.routeScene(f)||W.LunaOutsideNodes.shapeOf(f)&&W.LunaOutsideNodes.graphView(model,f).kind!=='repeat'||f.parent===c.row?.row_id))&&f.parent!==r.parent_id);}
function nativeTarget(r,c){return model.newspaperDest(r,c);}
function menuInspector(r){if(!model.menuEditable(r))return '';const choices=model.menu(r),native=model.menuOutcomes(r);
 const op=(value,name,current)=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(name)+'</option>';
 return choices.map((c,i)=>{const dest=nativeTarget(r,c),route=dest?'<select data-native-route="'+i+'">'+['newspaper/wrong','newspaper/right'].map(id=>op(id,model.flow(id).title,dest)).join('')+'</select>':
  '<select data-menu-field="route">'+[op('continue','다음 대사로 계속',c.route),op('end','대화 끝내기',c.route),...native.map(o=>op(o.route,o.label,c.route)),...availableRoutes(r,c).map(f=>op('flow:'+f.id,allowed(f)?f.title:f.title+' · 다른 일차/시간대',c.route))].join('')+'</select>';
  const action=(k,s,label,off)=>'<button type="button" data-menu-'+k+'="'+i+'" aria-label="'+label+'" title="'+label+'" '+(off?'disabled':'')+'>'+s+'</button>';
  return '<div class="choice-editor" data-menu-index="'+i+'" data-choice-row="'+esc(c.row?.row_id||c.id)+'"><div class="choice-actions"><b>선택지 '+(i+1)+'</b>'+action('up','↑','선택지 위로',i===0)+action('down','↓','선택지 아래로',i===choices.length-1)+action('delete','×','선택지 삭제',choices.length===1)+'</div>'+
   '<label><span>문구</span><textarea data-menu-field="text.ko" data-field="text.ko">'+esc(c.label)+'</textarea></label>'+W.LunaOutsideGates.html(model,c)+
   '<label><span>불가 사유</span><input data-menu-field="lock_reason.ko" data-field="lock_reason.ko" value="'+esc(decode(c.reason))+'"></label><label><span>선택 후 연결</span>'+route+'</label>'+
   (dest?'<button data-jump-flow="'+esc(dest)+'">↗　연결된 답변 편집</button>':model.removableMenu(r)?'<button data-menu-branch="'+i+'">⑂　후속 대사 만들기 / 열기</button>':'')+
   '<details class="source-gate"><summary>원본 조건식</summary><input aria-label="원본 조건식" data-menu-field="when" data-field="when" value="'+esc(decode(c.when))+'"></details></div>';
 }).join('')+'<button id="menu-add" '+(choices.length>=4?'disabled':'')+'>＋ 선택지 추가</button>';
}
function contextProfiles(){return profiles[selected]||{};}
function send(animate=false){if(!row())return;let decoded=model.step(row());const opts=options();if(model.isMenu(row())&&!decoded['text.ko'].trim()){const previous=rows().slice(0,rows().indexOf(row())).reverse().find(r=>decode(r['text.ko']).trim()&&!model.isMenu(r));if(previous)decoded={...decoded,actor:previous.actor,who:model.step(previous).who,'text.ko':decode(previous['text.ko'])};}preview.show({key:selected,row:decoded,rows:rows().map(r=>model.step(r)),choices:opts,profiles:contextProfiles(),animate,assets:model.presentation.assets});}
function setPlaying(on,paused=false){
 playing=on;const b=$('play');b.setAttribute('aria-pressed',String(on));
 b.textContent=stage?(on?'Ⅱ 일시정지':paused?'▶ 이어 재생':'▶ 자동 재생'):(on?'■ 재생 중지':'▶ 연속 재생');
}
function stop(){preview.stop();setPlaying(false);}
function persist(){if(restoring)return;try{if(model.dirty())localStorage.setItem(draftKey,JSON.stringify({revision:source.revision,files:model.output(),flowId:flowId||recent.get(filterDay)?.flowId,selected:selected||recent.get(filterDay)?.selected}));else localStorage.removeItem(draftKey);}catch{status('임시 저장 공간이 부족합니다. CSV 저장 또는 ZIP 내보내기를 해 주세요.');}}
function mark(){const changed=model.dirty();$('dirty').textContent=changed?'● 저장하지 않은 변경':'수정 없음';$('review').disabled=!changed;$('undo').disabled=!model.undoStack.length;$('redo').disabled=!model.redoStack.length;persist();}
function drawFlows(){return model.withReadIndex(drawIndexedFlows);}
function drawIndexedFlows(){const pool=visibleFlows();updateGroups(pool);const q=$('flow-search').value.trim().toLowerCase(),group=$('flow-group').value,favoriteOnly=$('favorites-only').checked;
 const matches=pool.filter(f=>(!group||siteOf(f).id===group)&&(!favoriteOnly||favorites.includes(f.id))&&(!q||[f.id,f.title,siteOf(f).name,siteOf(f).place,...indexDays().sequence(f.id,filterDay,filterTrip).map(r=>r['text.ko'])].join(' ').toLowerCase().includes(q)));
 $('flow-count').textContent=(matches.length===pool.length?matches.length:matches.length+'/'+pool.length)+'개';const groups=new Map();for(const f of matches){const s=siteOf(f);if(!groups.has(s.id))groups.set(s.id,{s,entries:[]});groups.get(s.id).entries.push(f);}
 $('flow-list').innerHTML=[...groups.values()].map(({s,entries})=>{const active=flowId&&siteOf(flow()).id===s.id;return '<div class="person-group"><button class="person-switch" data-person="'+esc(entries[0].id)+'" aria-expanded="'+!!(active||q||group)+'"><span class="person-mark" aria-hidden="true">'+esc(s.place==='거리'?'◇':s.place==='복도'?'▤':s.place==='집'?'⌂':'◈')+'</span><span><b>'+esc(s.name)+'</b><small>'+esc(s.place)+'</small></span><em>'+entries.length+'</em></button>'+(!active&&!q&&!group?'':entries.map(f=>`<div class="flow-entry"><button data-flow="${esc(f.id)}" aria-current="${f.id===flowId}">${esc(f.title)}<small>${esc(f.id)} · ${indexDays().sequence(f.id,filterDay,filterTrip).length}줄</small></button><button data-star="${esc(f.id)}" aria-label="${esc(f.title)} 즐겨찾기" aria-pressed="${favorites.includes(f.id)}">${favorites.includes(f.id)?'★':'☆'}</button></div>`).join(''))+'</div>';}).join('')||'<p class="hint">'+(filterTrip==='none'?'시간대를 켜면 목록이 나타납니다.':'검색 결과가 없습니다.')+'</p>';
}
function drawLines(){if(!row())return;const q=$('line-search').value.toLowerCase(),changes=new Set(model.changes().map(c=>c.id));$('line-list').innerHTML=rows().map((r,i)=>({r,i})).filter(({r})=>[r['text.ko'],r.actor,label(r.actor),r.row_id].join(' ').toLowerCase().includes(q)).map(({r,i})=>`<button class="line ${changes.has(r.row_id)?'changed':''}" data-line="${esc(r.row_id)}" aria-current="${r.row_id===selected}"><small>${i+1}</small><small>${typeLabel(r)}</small><span>${esc(label(r.actor))}</span><span>${esc(decode(r['text.ko'])||(model.isMenu(r)?'선택지 '+model.menu(r).length+'개':decode(r['web_fields.action'])||'연출 연결'))}</span></button>`).join('');const cursorRows=stageRows();$('cursor').textContent=(cursorRows.findIndex(r=>r.row_id===selected)+1)+' / '+cursorRows.length;
 $('flow-title').textContent=siteOf(flow()).place+' / '+siteOf(flow()).name;$('script-context').textContent=flow().title+' · '+rows().length+'줄';if(stageDialog.open)$('stage-title').textContent=siteOf(flow()).name+' / '+flow().title;queueChart();$('flow-back').disabled=!history.length;
 $('related-flows').innerHTML=visibleFlows().filter(f=>siteOf(f).id===siteOf(flow()).id&&f.id!==flowId).map(f=>`<button data-flow="${esc(f.id)}">${esc(f.title)} →</button>`).join('');
 const plain=model.plain(row()),own=model.owner(selected),owned=model.rows(own.id);$('add-menu').disabled=!model.canAddMenu(own);$('duplicate').disabled=!plain||flow().onlyChoices;$('delete').disabled=(!plain&&!model.removableMenu(row()))||flow().onlyChoices||rows().length<=1;$('add').disabled=flow().onlyChoices||!rows().some(r=>model.plain(r));$('up').disabled=flow().onlyChoices||flow().parent===model.answerParent||owned[0]===row();$('down').disabled=flow().onlyChoices||flow().parent===model.answerParent||owned.at(-1)===row();
}
function inspector(){const r=row();W.LunaOutsideDetails.install({model,flow:flow(),site:placeSite(),rows:rows(),r,decoded:model.step(r),kind:typeLabel(r),idx:rows().findIndex(x=>x.row_id===selected),mode,node:mode==='map'?selectedNode():null,label,decode,menu:menuInspector(r),context:{money,day,flags,inventory}});if(mode==='script')$('node-detail').querySelector('.inspector-title').append(editNext);actorControls();}
function actorControls(){const actor=$('preview-actor')?.value;if(!actor)return;const cfg=contextProfiles()[actor]||{},kind=cfg.kind||W.LunaOutsideEditorPreview.kinds[actor]||'',art=preview.catalog.find(s=>s.id===kind);$('actor-controls').innerHTML=`<label>캐릭터 시트<select id="preview-kind"><option value="">미등록 / 자리표시자</option>${preview.catalog.map(s=>`<option value="${s.id}" ${kind===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>행동 애니메이션<select id="preview-animation">${(art?.animations||['idle']).map(a=>`<option value="${a}" ${(cfg.animation||'idle')===a?'selected':''}>${({idle:'대기 · Idle',walk:'걷기 · Walk',run:'달리기 · Run'})[a]}</option>`).join('')}</select></label><div class="field-pair"><label>방향<select id="preview-facing"><option value="auto">서로 바라보기</option><option value="left" ${cfg.facing==='left'?'selected':''}>왼쪽</option><option value="right" ${cfg.facing==='right'?'selected':''}>오른쪽</option></select></label><label>재생 속도<input id="preview-speed" type="number" min="0" max="2" step="0.1" value="${cfg.speed??1}"></label></div>`;}
function select(id,animate=false){selected=id;lastField='';drawLines();inspector();send(animate);mark();$('line-list').querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});}
function openFlow(id,remember=true,restoreRow=null){
 if(stage&&!stageDialog.open)closeStage();const alias={'newspaper/options':'newspaper/intro','choices/info':'notion/intro','choices/stock':'shop/intro'},jump=alias[id];id=jump||id;const f=model.flow(id);if(!f)return;
 if(remember&&flowId&&flowId!==id)history.push(locationState());
 editTrail=[];revealFlowScope(f);document.body.removeAttribute('data-scope-empty');$('outside-trip-empty').hidden=true;
 stop();flowId=id;chart?.clear();$('line-search').value='';if($('flow-group').value&&$('flow-group').value!==siteOf(f).id)$('flow-group').value='';
 const seq=rows();drawFlows();select((seq.find(r=>r.row_id===restoreRow)||(jump&&seq.findLast(r=>model.isMenu(r)))||seq[0]).row_id);
 describeScope();linkLocation();
}
function go(delta,auto=false){if(stage){const list=stageRows(),idx=list.findIndex(r=>r.row_id===selected)+delta;if(idx<0||delta>0&&model.isMenu(row()))return;if(idx>=list.length)return finishStage();if(!auto)stop();stageLine(list[idx].row_id,auto);return;}const index=rows().findIndex(r=>r.row_id===selected)+delta;if(index>=rows().length&&resumeTrail.length){const back=resumeTrail.pop();openFlow(back.f,false);select(back.row,auto);setPlaying(auto);return;}if(index<0||index>=rows().length){stop();status('이 흐름의 마지막 줄입니다. 왼쪽에서 다음 장면을 선택하세요.');return;}if(!auto)stop();select(rows()[index].row_id,auto);}
function pick(c){
 if(!c)return;if(stage)return finishStage(c);const auto=playing,line=row(),dest=MapUI.destination(model,line,c);stop();
 if(dest.flow){const tail=rows()[rows().indexOf(line)+1];if(tail&&c.route?.startsWith('flow:')&&model.kind(line)!=='newspaper-choice'&&!W.LunaOutsideNodes.isLink(model.optionJump(c.row)))resumeTrail.push({f:flowId,row:tail.row_id});
  openFlow(dest.flow);if(auto){setPlaying(true);send(true);}return;}
 if(dest.next){setPlaying(auto);return go(1,auto);}
 preview.end();resumeTrail=[];const message=dest.label||'대화 종료';status(message+' · 미리보기');if(dest.native)preview.notice('본편 사건',message);
}
function mutate(fn){stop();const before=locationState(),redo=model.redoStack.slice();model.checkpoint();try{const next=fn();dayIndex=null;if(next?.flowId){if(flowId!==next.flowId)history.push(before);flowId=next.flowId;chart?.clear();}ensureEligible(next?.row_id||selected);return true;}catch(e){model.undo();dayIndex=null;model.redoStack=redo;flowId=before.flowId;selected=before.selected;if(row())ensureEligible(selected);status(e.message);return false;}}
function ensureEligible(id){
 const pool=visibleFlows(),active=flow(),f=active&&allowed(active)?active:pool.find(f=>active&&siteOf(f).id===siteOf(active).id)||firstInScope(pool);
 if(!f){emptyScope();mark();return;}
 if(f.id!==flowId)return openFlow(f.id,false);const seq=rows();select((seq.find(r=>r.row_id===id)||seq[0]).row_id);drawFlows();describeScope();linkLocation();
}
function undo(direction){stop();const el=document.activeElement,key=el?.dataset.field,cid=el?.closest('[data-choice-row]')?.dataset.choiceRow,start=el?.selectionStart,end=el?.selectionEnd;model[direction]();dayIndex=null;if(!visibleFlows().length){emptyScope();mark();return;}if(!model.flow(flowId))flowId=[...history].reverse().find(h=>model.flow(h.flowId)&&allowed(model.flow(h.flowId)))?.flowId||visibleFlows()[0].id;ensureEligible(selected);if(key){const input=[...$('inspector').querySelectorAll('[data-field]')].find(e=>e.dataset.field===key&&e.closest('[data-choice-row]')?.dataset.choiceRow===cid);if(input){input.focus();if(typeof start==='number'&&input.type!=='number')try{input.setSelectionRange(Math.min(start,input.value.length),Math.min(end,input.value.length));}catch{}}}}
function storageUI(){ $('storage-mode').textContent=source.local?'로컬 · 실제 CSV 저장':Storage.local?'로컬 저장 연결 끊김':'GitHub / 정적 웹 · ZIP 내보내기';$('storage-warning').hidden=!Storage.local||source.local;$('storage-warning').textContent=source.error||'로컬 저장 연결을 확인해 주세요.';$('reconnect').hidden=!Storage.local;}
async function initialize(){restoring=true;let draft;try{draft=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{}source=await Storage.load();model=await new API.Model(source.files,source.presentation).init();storageUI();
 if(draft&&draft.revision===source.revision&&confirm('저장하지 않은 외부 대사 편집을 복원할까요?')){model.checkpoint();for(const [k,p]of Object.entries(API.paths))if(draft.files[p])model.tables[k]=W.LunaCsv.parseRows(draft.files[p]);if(draft.files['web-views.json'])model.views=JSON.parse(draft.files['web-views.json']);if(draft.files[W.LunaNpcPlacement.file])model.placement=W.LunaNpcPlacement.validate(JSON.parse(draft.files[W.LunaNpcPlacement.file]));}else draft=null;
 history=[];visits.clear();recent.clear();model.refreshChoiceFlows();dayIndex=null;groupSignature='';
 const params=new URLSearchParams(location.search),query=model.flow(params.get('flow'))||model.flow(draft?.flowId),explicit=Days.parse(params.get('day')),trip=Days.route(params.get('commute'));
 setScope(explicit??(query?(indexDays().days(query,trip)[0]??indexDays().days(query)[0]??Days.all):0),trip);
 const pool=visibleFlows(),initial=query&&allowed(query)?query:pool.find(f=>query&&siteOf(f).id===siteOf(query).id)||firstInScope(pool);
 if(initial)openFlow(initial.id,false,draft?.flowId===initial.id?draft.selected:null);else{if(query)recent.set(filterDay,{flowId:query.id,selected:draft?.flowId===query.id?draft.selected:null});emptyScope();}restoring=false;mark();status(model.visibleFlows().length+'개 대화 흐름을 불러왔습니다.',true);W.outsideDialogueEditor={get model(){return model;},get flow(){return flowId;},get selected(){return selected;},get day(){return filterDay;},get commute(){return filterTrip;},openFlow};}
 $('flow-list').onclick=e=>{const b=e.target.closest('button');if(b?.dataset.person||b?.dataset.flow){resumeTrail=[];openFlow(b.dataset.person||b.dataset.flow);setPane('both');}if(b?.dataset.star){const id=b.dataset.star;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem(favoriteKey,JSON.stringify(favorites));drawFlows();}};
 $('related-flows').onclick=e=>{const b=e.target.closest('[data-flow]');if(b)openFlow(b.dataset.flow);};$('line-list').onclick=e=>{const b=e.target.closest('[data-line]');if(b){stop();setMode('script');select(b.dataset.line);}};
 for(const id of ['flow-search','favorites-only'])$(id).addEventListener('input',drawFlows);$('flow-group').onchange=()=>{const id=$('flow-group').value,f=visibleFlows().find(f=>siteOf(f).id===id);if(f)openFlow(f.id);else drawFlows();};$('line-search').oninput=drawLines;
 $('flow-back').onclick=()=>{const previous=history.pop();if(previous&&model.flow(previous.flowId)){rememberLocation();if(previous.day!==undefined)setScope(previous.day,previous.trip??'both');openFlow(previous.flowId,false,previous.selected);editTrail=previous.editTrail||[];}};
 $('previous').onclick=()=>go(-1);$('next').onclick=()=>go(1);$('line-play').onclick=()=>{stop();if(stage)stageLine(selected,true);else send(true);};
 $('play').onclick=()=>{
  if(playing){if(stage&&preview.pause())setPlaying(false,true);else stop();return;}
  setPlaying(true);if(!stage)send(true);else if(!preview.resume())stageLine(selected,true);
 };
 $('add-menu').onclick=()=>mutate(()=>{const f=model.owner(selected);return model.addMenu(f.id,model.rows(f.id).indexOf(row())+1);});$('add').onclick=()=>mutate(()=>{const f=model.owner(selected);return model.add(f.id,model.rows(f.id).indexOf(row())+1);});$('duplicate').onclick=()=>mutate(()=>{const f=model.owner(selected);return model.add(f.id,model.rows(f.id).indexOf(row())+1,row());});$('delete').onclick=()=>{if(confirm('선택한 대사를 삭제할까요? 실행 취소로 복원할 수 있습니다.'))mutate(()=>model.remove(model.owner(selected).id,selected));};
 for(const [id,delta]of [['up',-1],['down',1]])$(id).onclick=()=>mutate(()=>{const f=model.owner(selected),ids=model.rows(f.id).map(r=>r.row_id),i=ids.indexOf(selected);if(i+delta<0||i+delta>=ids.length)return;[ids[i],ids[i+delta]]=[ids[i+delta],ids[i]];model.reorder(f.id,ids);});
 $('undo').onclick=()=>undo('undo');$('redo').onclick=()=>undo('redo');
 $('inspector').addEventListener('input',e=>{if(e.target.dataset.nativeRoute!==undefined){const i=+e.target.dataset.nativeRoute,value=e.target.value;return mutate(()=>{model.wire(row(),i,'flow:'+value);});}const menuKey=e.target.dataset.menuField;if(menuKey==='route'&&model.removableMenu(row())){const i=+e.target.closest('[data-menu-index]').dataset.menuIndex,value=e.target.value;mutate(()=>{model.wire(row(),i,value);});return;}if(menuKey){stop();const i=+e.target.closest('[data-menu-index]').dataset.menuIndex,field=selected+'/'+i+'/'+menuKey,now=performance.now();if(field!==lastField||now-lastAt>800)model.checkpoint();lastField=field;lastAt=now;model.setMenuField(row(),i,menuKey,e.target.value);if(menuKey==='when'){dayIndex=null;drawFlows();}send();drawLines();mark();return;}const key=e.target.dataset.field;if(!key||e.target.readOnly||e.target.disabled)return;const cid=e.target.closest('[data-choice-row]')?.dataset.choiceRow,r=cid?model.tables.street_choices.find(c=>c.row_id===cid):row();if(!model.canEdit(r,key,flow()))return;stop();const field=r.row_id+'/'+key,now=performance.now();if(field!==lastField||now-lastAt>800||e.inputType==='insertFromPaste')model.checkpoint();lastField=field;lastAt=now;model.set(r,key,e.target.value);drawLines();send();mark();if(key==='actor')inspector();});
 $('inspector').addEventListener('focusout',()=>{lastField='';});
 $('inspector').addEventListener('change',e=>{if(e.target.id==='repair-preset'&&e.target.value){const k=e.target.value;$('preview-money').value=k==='none'?399:k==='gear'?0:400;$('preview-inventory').value=JSON.stringify({...inventory,gear_part:k==='gear'?1:0});$('preview-flags').value=JSON.stringify({...flags,elevator_repaired:k==='done',elevator_repair_paid:false});$('apply-context').click();return;}if(e.target.id==='preview-actor')return actorControls();if(!['preview-kind','preview-animation','preview-facing','preview-speed'].includes(e.target.id))return;const actor=$('preview-actor').value,cfg={kind:$('preview-kind').value,animation:$('preview-animation').value,facing:$('preview-facing').value,speed:Math.min(2,Math.max(0,Number($('preview-speed').value)||0))};if(e.target.id==='preview-kind')cfg.animation='idle';(profiles[selected]||={})[actor]=cfg;actorControls();send();});
 $('inspector').addEventListener('click',e=>{const button=e.target.closest('button'),id=button?.id,action=button?.dataset.detailAction;if(button?.dataset.member){stop();return select(button.dataset.member);}if(action==='graph-config')return chart.editNode();if(action==='graph-remove')return chart.removeNode();if(action==='mode')return setMode(mode==='map'?'script':'map');if(action==='stage')return showStage(mode==='map');if(action==='place')return placement.open(placeSite(),flowId);if(button?.dataset.jumpFlow)return openFlow(button.dataset.jumpFlow);if(id==='menu-add')return mutate(()=>{model.addMenuOption(row());});if(button?.dataset.menuDelete!==undefined&&model.menu(row())[+button.dataset.menuDelete]?.route?.startsWith('flow:')&&!confirm('이 선택과 여기에 작성한 후속 대사를 삭제할까요? 실행 취소할 수 있습니다.'))return;if(button?.dataset.menuDelete!==undefined)return mutate(()=>{const cfg=model.ensureMenu(row());model.removeMenuOption(row(),cfg.active[+button.dataset.menuDelete]);});for(const [key,d]of [['menuUp',-1],['menuDown',1]])if(button?.dataset[key]!==undefined)return mutate(()=>{const cfg=model.ensureMenu(row());model.moveMenuOption(row(),cfg.active[+button.dataset[key]],d);});if(button?.dataset.menuBranch!==undefined){let f;mutate(()=>{f=model.addOptionBranch(row(),+button.dataset.menuBranch);});if(f)openFlow(f.id);return;}if(id==='apply-context'){try{const f=JSON.parse($('preview-flags').value);if(!f||typeof f!=='object'||Array.isArray(f))throw Error('플래그는 JSON 객체로 입력하세요.');const n=Number($('preview-money').value);if(!Number.isFinite(n)||n<0)throw Error('소지금은 0 이상의 숫자입니다.');const items=JSON.parse($('preview-inventory').value),d=Number($('preview-day').value);if(!items||typeof items!=='object'||Array.isArray(items)||Object.values(items).some(v=>!Number.isInteger(v)||v<0))throw Error('인벤토리에는 0 이상의 정수 수량을 입력하세요.');if(!Number.isInteger(d)||d<0||d>99)throw Error('일차는 0~99의 정수입니다.');inventory=items;day=d;flags=f;money=n;send();status('미리보기 조건만 변경했습니다.');}catch(e){status(e.message);}}if(id==='notice-demo'){const type=$('notice-type').value,item=$('notice-item').value,entry=model.projected.data.tables.shelf_items.find(i=>i.id===item);const values={item:['재료 획득','신규 재료 '+(entry?.['name.ko']||item)+' 추가!',item],gear:['아이템 획득','기어 부품 획득!'],emblem:['아이템 획득','기신교의 엠블럼 획득!'],goal:['목표 달성','엘리베이터 수리!'],money:['수입','+500원']};preview.notice(...values[type]);}});
 $('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();$('reload').onclick=async()=>{if(model.dirty()&&!confirm('미저장 편집을 버리고 원본을 다시 불러올까요?'))return;localStorage.removeItem(draftKey);stop();await initialize();};
 $('reconnect').onclick=async()=>{try{const s=await Storage.connect();if(s.revision!==source.revision)throw Error('원본이 바뀌었습니다. ZIP 보관 후 다시 불러오세요.');source={...s,local:true};storageUI();status('저장 연결 완료. 편집 내용은 유지됩니다.');}catch(e){status(e.message);}};
 $('review').onclick=async()=>{stop();$('review-dialog').showModal();$('commit').disabled=true;$('export-backup').disabled=true;$('validation').textContent='CSV 구조와 연결 검사 중...';$('changes').innerHTML='<table><thead><tr><th>항목</th><th>이전</th><th>이후</th></tr></thead><tbody>'+model.changes().map(c=>`<tr><td>${esc(c.kind+' / '+(c.key||c.table))}<br><small>${esc(c.id)}</small></td><td><del>${esc(c.before)}</del></td><td><ins>${esc(c.after)}</ins></td></tr>`).join('')+'</tbody></table>';$('commit').textContent=Storage.local?'로컬 CSV 저장':'CSV ZIP 내보내기';$('export-backup').hidden=!Storage.local;$('save-explanation').textContent='CSV와 실행 데이터를 함께 저장합니다. 기존 파일은 백업하고 다른 작업과 충돌하면 덮어쓰지 않습니다.\nNPC 위치는 웹 씬 배치 파일에 저장합니다. Unity 씬과 CSV 좌표는 바뀌지 않습니다. 이미지·행동·알림 테스트 설정은 저장하지 않습니다. 진행 중인 대화는 유지하며 다음 대화부터 수정본을 사용합니다.';try{const checked=await model.validate();$('validation').textContent=checked.errors.join('\n')||(checked.warnings?.length?'웹 저장 가능 · 엔진 호환 주의 (대사 경로 정적 비교)\n'+checked.warnings.join('\n'):'검사 완료 · 웹 저장 가능합니다.');$('commit').disabled=$('export-backup').disabled=!!checked.errors.length;}catch(e){$('validation').textContent=e.message;}};
 $('close-review').onclick=()=>$('review-dialog').close();
 async function save(exportOnly=false){if(busy)return;busy=true;$('commit').disabled=$('export-backup').disabled=true;try{const checked=await model.validate();if(checked.errors.length)throw Error(checked.errors.join('\n'));if(Storage.local&&!exportOnly){const result=await Storage.save(model,source.revision,'outside');source.revision=result.revision;source.local=true;model.files={...model.files,...model.output()};model.base=model.snapshot();model.undoStack=[];model.redoStack=[];W.LunaDialogueLiveData.notify(result.revision);mark();storageUI();status('저장 완료 · 다음 대화나 장면부터 반영됩니다.');$('status').title='백업: '+result.backup;}else{const files=await W.LunaDialogueExport.packageFiles(model,checked.result),url=URL.createObjectURL(W.LunaDialogueExport.zip(files)),a=document.createElement('a');a.href=url;a.download='luna-outside-dialogue-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('ZIP 내보내기 완료. 서버 원본에는 아직 적용하지 않았습니다.');}$('review-dialog').close();drawLines();}catch(e){$('validation').textContent=e.message;}finally{busy=false;$('commit').disabled=$('export-backup').disabled=false;}}
 $('commit').onclick=()=>save();$('export-backup').onclick=()=>save(true);
 W.addEventListener('keydown',e=>{if(!model||e.isComposing||$('placement-dialog').open||stageDialog.open||$('help-dialog').open)return;if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();if(key==='s'){e.preventDefault();if(model.dirty())$('review').click();}if((key==='z'||key==='y')&&!$('review-dialog').open&&(!e.target.matches('input,textarea')||e.target.dataset.field)){e.preventDefault();undo(key==='y'||e.shiftKey?'redo':'undo');}}else if(e.target===$('preview-stage')&&e.code==='Space'){e.preventDefault();$('play').click();}});
 W.addEventListener('beforeunload',e=>{if(model?.dirty()){e.preventDefault();e.returnValue='';}});
 W.LunaOutsideGates.listen($('inspector'),(i,value)=>mutate(()=>{model.setMenuField(row(),i,'when',value);}));
 chart=W.LunaOutsideChart.create({model:()=>model,flow:()=>flowId,day:()=>filterDay,trip:()=>filterTrip,allow:allowed,allowWhen,daysFor:f=>indexDays().days(f,filterTrip),selected:()=>selected,select:chartSelect,preview:()=>showStage(true),portrait:preview.portrait,script:()=>setMode('script'),focusOption,change:mutate,connectGraph:(f,slot,to)=>mutate(()=>{W.LunaOutsideNodes.wire(model,model.flow(f),slot,to?model.flow(to):null);}),connect:(r,i,value)=>mutate(()=>{model.wire(r,i,value);return r;})});
 placement=W.LunaOutsidePlacement.create({model:()=>model,apply:layout=>mutate(()=>{model.placement=W.LunaNpcPlacement.validate(structuredClone(layout));}),status});
 $('place-npc').onclick=()=>placement.open(placeSite(),flowId);$('popup-preview').onclick=showStage;const dismissStage=()=>{stageDialog.close();closeStage();};$('close-stage').onclick=dismissStage;stageDialog.oncancel=e=>{e.preventDefault();dismissStage();};stageDialog.addEventListener('close',closeStage);$('view-map').onclick=()=>setMode('map');$('view-script').onclick=()=>setMode('script');$('script-map').onclick=()=>setMode('map');$('script-preview').onclick=showStage;$('restart-stage').onclick=()=>{if(stage)startStageNode(flowId,stage.node.id,true,true);};
 function followStagePath(path){
  if(path.blocked){$('stage-range').textContent=path.blocked;return;}
  if(path.dest.row)startStageNodeWithTrail(path.dest);else finishStage(path.c);
  (nextStage.hidden?$('preview-stage'):nextStage).focus({preventScroll:true});
 }
 W.LunaPreviewBranchPicker.edit(editNext,()=>{
  stop();const n=selectedNode();if(!n)return [];
  return nodePaths(n,editTrail).map(p=>({...p,badge:p.dest.row&&(p.c?.hidden||p.c?.disabled)?'게임 조건 미충족 · 편집 가능':p.badge,blocked:p.blocked||(!p.dest.row?(p.dest.label||'이어 편집할 대사가 없습니다.'):
   !indexDays().sequence(p.dest.flow,filterDay,filterTrip).some(r=>r.row_id===p.dest.row)?'현재 일차·시간대에 없는 대사입니다.':'')}));
 },({dest})=>{history.push(locationState());openFlow(dest.flow,false,dest.row);editTrail=dest.trail||[];editNext.focus({preventScroll:true});},status);
 nextStage.onclick=()=>{if(!stage?.paths.length)return;
  if(stage.paths.length===1)followStagePath(stage.paths[0]);
  else branchPicker.open(stage.paths.map(p=>({...p,selected:!!stage.chosen&&stage.chosen===p.c?.id})),followStagePath);
 };setMode(mode);
 try{await initialize();}catch(e){status('불러오기 실패: '+e.message);$('inspector').textContent='CSV 또는 저장 연결을 확인하세요.';console.error(e);}
 document.querySelector('.pane-switch').onclick=e=>{const tab=e.target.closest('[data-pane]');if(tab)setPane(tab.dataset.pane);};
})(window);

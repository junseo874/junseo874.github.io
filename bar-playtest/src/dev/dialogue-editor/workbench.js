/* Presenter only: the model owns edits, undo and file serialization. */
(function(W){
'use strict';
function create({model,current,mutate,jump,stop}){
 const F=W.LunaBarFlags,$=id=>document.getElementById(id),dlg=$('workbench'),body=$('wb-body'),msg=$('wb-msg');
 const el=(tag,txt='',cl='')=>{const n=document.createElement(tag);n.textContent=txt;if(cl)n.className=cl;return n;};
 const btn=(txt,fn,cl)=>{const b=el('button',txt,cl);b.type='button';b.onclick=fn;return b;};
 const field=(label,value='')=>{const e=el('input');e.placeholder=label;e.setAttribute('aria-label',label);e.value=value;e.spellcheck=false;return e;};
 const drop=(label,items)=>{const n=el('select');n.setAttribute('aria-label',label);for(const [v,title]of items){const o=el('option',title);o.value=v;n.append(o);}return n;};
 const drafts=()=>{try{return F.draftIssues(model(),JSON.parse(localStorage.getItem('luna.bar.graph-workspace.v2')||'{}'));}catch{return [];}};
 let idx,chosen='',seq=0,find='',day='',includeSystem=false;
 function open(title){stop();seq++;body.replaceChildren();msg.textContent='';$('wb-title').textContent=title;if(!dlg.open)dlg.showModal();}
 function move(loc){dlg.close();jump(loc);}
 $('wb-close').onclick=()=>dlg.close();dlg.addEventListener('close',()=>{seq++;});
 function change(fn,after){let error='';const ok=mutate(()=>{try{fn();}catch(e){error=e.message;throw e;}});if(!ok){msg.textContent=error||$('status').textContent;return;}after();}
 function flags(){
  if(!model())return;open('플래그 관리');idx=F.palette(model());
  const tools=el('div','','wb-tools'),search=field('플래그 이름 또는 사용 장면 검색',find),days=drop('사용 일차',[['','모든 일차'],...[...new Set(model().scenes.map(s=>s.day))].map(d=>[d,d+'일차'])]),system=el('label'),check=el('input');check.type='checkbox';check.checked=includeSystem;system.append(check,' 연결용 이름');days.value=day;tools.append(search,days,system);
  const add=el('details','','wb-new'),summary=el('summary','＋ 플래그 추가'),addTools=el('div','','wb-actions'),name=field('새 플래그 이름'),initial=drop('이 줄에서 기록할 값',[['true','참 (true)'],['false','거짓 (false)']]);
  const locations=el('div','','wb-actions'),scenePick=drop('첫 기록 장면',model().scenes.map(s=>[s.id,s.title])),rowPick=drop('첫 기록 줄 또는 선택지',[]);locations.append(scenePick,rowPick);
  scenePick.value=current()?.context||model().scenes[0].id;let choices=new Map();
  function targets(){choices=new Map();rowPick.replaceChildren();const rows=W.LunaBarWiring.scan(model(),scenePick.value).logical;
   function put(r,label){const o=el('option',label);o.value=r.row_id;choices.set(r.row_id,r);rowPick.append(o);}
   for(const r of rows){if(!F.recordable(r))continue;put(r,r.seq+'번 · '+(r.actor||'')+' · '+(r['text.ko']&&r['text.ko']!=='\\N'?r['text.ko']:r.type).slice(0,35));if(r.type==='choice')for(const c of model().choices(r.arg))put(c,'　↳ '+r.seq+'번 선택지 '+c.seq+' · '+c['text.ko'].slice(0,35));}
   if(choices.has(current()?.row_id))rowPick.value=current().row_id;
  }scenePick.onchange=targets;targets();
  addTools.append(name,initial,btn('추가',()=>{const n=name.value.trim();change(()=>F.create(model(),choices.get(rowPick.value),n,initial.value==='true'),()=>{chosen=n;find='';day='';flags();msg.textContent='지정한 위치에 기록했습니다. CSV 저장 전에는 되돌릴 수 있습니다.';});}));
  add.append(summary,el('p','처음 값을 기록할 위치를 고르세요. 선택지를 고르면 그 답을 골랐을 때만 기록합니다.','wb-muted'),locations,addTools);
  const grid=el('div','','wb-grid'),list=el('div','','wb-flags'),detail=el('section','','wb-detail');grid.append(list,detail);body.append(tools,add,grid);
  function draw(){
   const entries=[...idx.flags.values()].filter(e=>(includeSystem||!F.generated(e.name))&&(!day||e.uses.some(u=>String(u.day)===day))&&((e.name+' '+W.LunaFlagPicker.title(e.name)).toLowerCase().includes(find.toLowerCase())||e.uses.some(u=>u.label.includes(find)))).sort((a,b)=>a.name.localeCompare(b.name));
   if(!entries.some(e=>e.name===chosen))chosen=entries[0]?.name||'';list.replaceChildren();detail.replaceChildren();
   for(const e of entries){const caption=W.LunaFlagPicker.title(e.name),b=btn(caption,()=>{chosen=e.name;draw();},'wb-flag');b.dataset.flag=e.name;b.prepend(W.LunaFlagPicker.mark(e.name));b.setAttribute('aria-pressed',String(chosen===e.name));b.append(el('small',(caption===e.name?'':e.name+' · ')+'조건 '+e.uses.filter(u=>!u.write).length+' · 값 기록 '+e.uses.filter(u=>u.write).length));list.append(b);}
   const e=idx.flags.get(chosen);if(!e){detail.append(el('p','일치하는 플래그가 없습니다.'));return;}
   const caption=W.LunaFlagPicker.title(e.name),heading=el('h3',caption);heading.prepend(W.LunaFlagPicker.mark(e.name));const display=el('div');detail.append(heading);if(caption!==e.name)detail.append(el('p',e.name,'wb-muted'));detail.append(el('small','편집기 표시 · 이 브라우저에만 저장','wb-muted'),display);W.LunaFlagPicker.appearance(display,e.name,v=>msg.textContent=v);const pending=drafts().some(p=>F.tokens(p.predicate).includes(e.name));
   const reason=e.protected||(pending?'미연결 핀에서도 쓰고 있습니다. 먼저 해당 핀을 연결하거나 삭제하세요.':'');
   if(reason)detail.append(el('p',reason,'wb-protect'));
   const controls=el('div','','wb-actions'),rename=field('변경할 이름',e.name),renameBtn=btn('이름 변경',()=>{const n=rename.value.trim();change(()=>F.rewrite(model(),e.name,n),()=>{let note='';try{W.LunaFlagPicker.rename(e.name,n);}catch{note=' 표시 설정은 옮기지 못했습니다.';}chosen=n;find='';flags();msg.textContent='모든 사용 위치의 이름을 변경했습니다.'+note;});});
   const del=btn('삭제',()=>{if(!confirm(e.name+'의 사용 위치 '+e.uses.length+'곳에서 조건과 값 기록을 제거할까요? 다른 조건은 유지되며 마지막 조건을 없애면 항상 실행됩니다.'))return;
    change(()=>F.rewrite(model(),e.name,null),()=>{chosen='';flags();msg.textContent='조건과 값 기록을 삭제했습니다. 되돌리기로 복구할 수 있습니다.';});});
   rename.disabled=renameBtn.disabled=del.disabled=!!reason;controls.append(rename,renameBtn,del);detail.append(controls);if(!reason)detail.append(el('small','이름 변경은 대본 전체에 적용됩니다. 기존 플레이 세이브의 값은 옮기지 않습니다.','wb-muted'));detail.append(el('h4','사용 위치 · '+e.uses.length));
   for(const u of e.uses){const b=btn((u.write?'값 기록　':'조건 확인　')+u.label,()=>move({scene:u.scene,row:u.step,choice:u.choice,field:u.field,routeId:u.routeId,pin:u.pin,predicate:u.predicate}), 'wb-use');b.disabled=!!u.external;b.append(el('small',(u.external?'편집 범위 밖 · ':'')+u.value));detail.append(b);}
  }
  search.oninput=()=>{find=search.value;draw();};days.onchange=()=>{day=days.value;draw();};check.onchange=()=>{includeSystem=check.checked;draw();};draw();
 }
 const issuesOf=result=>[...(result.issues||result.errors.map(message=>({severity:'error',message}))),...drafts()];
 async function audit(){
  if(!model())return;open('검수 콘솔');const run=seq;body.append(el('p','모든 일차의 대사·선택지·분기를 검사하고 있습니다…'));let issues;
  try{issues=issuesOf(await model().validate());}catch(e){issues=[{severity:'error',message:e.message}];}if(!dlg.open||run!==seq)return;
  const errors=issues.filter(i=>i.severity==='error').length,warnings=issues.length-errors;
  const tools=el('div','','wb-tools'),level=drop('검수 결과 종류',[['','전체 결과'],['error','오류만'],['warning','주의만']]),search=field('장면 또는 메시지 검색'),list=el('div','','wb-console');
  tools.append(level,search,btn('다시 검사',audit));body.replaceChildren(el('p','전체 '+model().scenes.length+'개 바 장면 · 오류 '+errors+'건 · 주의 '+warnings+'건'),tools,list);
  function draw(){list.replaceChildren();const matches=issues.filter(i=>(!level.value||i.severity===level.value)&&((i.label||'')+' '+i.message).includes(search.value));
   if(!matches.length)list.append(el('p',issues.length?'조건에 맞는 결과가 없습니다.':'검사한 대사와 분기에서 문제가 발견되지 않았습니다.'));
   for(const i of matches){const b=btn((i.severity==='error'?'오류　':'주의　')+i.message,()=>move(i),'wb-issue');b.dataset.level=i.severity;b.disabled=!i.row;b.append(el('small',i.label||i.scene||'CSV 구조'));list.append(b);}
  }level.onchange=search.oninput=draw;draw();
 }
 $('flags-open').onclick=flags;$('audit-open').onclick=audit;
 return {ready(){for(const id of ['flags-open','audit-open'])$(id).disabled=false;},issuesOf,audit};
}
W.LunaBarWorkbench={create};
})(window);

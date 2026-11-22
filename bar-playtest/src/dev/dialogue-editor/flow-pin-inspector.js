/* One output pin at a time. Fields are local until Apply; the caller owns CSV/undo. */
(function(W){
'use strict';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
function show(panel,s){
 const root=el('section',null,'pin-editor');root.dataset.pinInspector=s.key;const inputs={},status=el('p','','pin-status');status.setAttribute('role','status');
 const back=button('← 노드 상세',()=>{if(!dirty()||confirm('이 핀에 적용하지 않은 변경을 취소하고 노드로 돌아갈까요?'))s.back();});
 const tab=el('div',null,'pin-tab');tab.append(el('strong','디테일'),back);root.append(tab);
 const iconAction=(parent,title,icon,run)=>{const b=button('',()=>{if(dirty()&&!confirm('아직 적용하지 않은 핀 변경을 버리고 계속할까요?'))return;run();});b.innerHTML=W.LunaBarCanvas.icon(icon);b.title=title;b.setAttribute('aria-label',title);b.className='pin-icon-action';parent.append(b);};
 if(s.remove)iconAction(tab,s.remove.label,'trash',s.remove.run);
 const head=el('header',null,'pin-heading');head.append(el('small','플로우 차트  /  '+(s.fields.some(f=>f.key==='choiceWhen')?'선택지':'출력 핀')),el('h2',s.title));const path=el('small',null,s.from+' → '+s.to);head.append(path);root.append(head);
 function group(key,title){const sec=el('section',null,'pin-group');sec.dataset.pinGroup=key;sec.append(el('h3',title));root.append(sec);return sec;}
 const prop=(section,title,control)=>{const row=el('div',null,'pin-property');row.append(el('span',title),control);section.append(row);};
 const field=(f,sec)=>{
  const text=f.mode==='text',input=el(text?'textarea':'input');if(text){input.rows=f.key==='text.ko'?2:1;input.setAttribute('aria-label',f.title);input.placeholder=f.key==='lock_reason.ko'?'필요할 때만 작성':'선택지 문구';}
  else input.type='hidden';input.dataset.pinField=f.key;input.value=f.value||'';inputs[f.key]=input;
  if(text){prop(sec,f.title,input);return;}
  sec.append(input);const tools=el('div');sec.append(tools);
  if(f.mode==='when')W.LunaRuleEditor.attach(tools,input,s.model,f.key==='choiceWhen'?'항상 선택 가능':s.draft?'연결할 조건을 고르세요':'항상 통과');
  else W.LunaRuleEditor.effects(tools,input,s.model);
 };
 const texts=s.fields.filter(f=>f.mode==='text');if(texts.length){const sec=group('text','선택지 내용');texts.forEach(f=>field(f,sec));}
 if(s.affinity){const sec=group('affinity','분기 호감도');sec.append(el('strong',s.affinity.label),button('호감도 편집',()=>{
  if(!dirty()||confirm('적용하지 않은 핀 변경을 취소하고 호감도를 편집할까요?'))s.affinity.open();}));}
 for(const f of s.fields.filter(f=>f.mode!=='text')){const sec=group(f.key,f.title);field(f,sec);}
 const link=group('link','연결 경로');prop(link,'출발',el('strong',s.from));let dest=null;
 if(s.destinations){dest=el('select');dest.setAttribute('aria-label','이동할 노드');dest.dataset.pinDestination='';const paint=chosen=>{dest.replaceChildren();for(const v of s.destinations(inputs.predicate?.value||''))dest.add(new Option(v.label,v.id));dest.value=[...dest.options].some(o=>o.value===chosen)?chosen:(s.destination||'');};paint(s.destination||'');inputs.predicate?.addEventListener('input',()=>paint(dest.value));prop(link,'도착',dest);}
 else prop(link,'도착',el('strong',s.to));
 if(dest)dest.addEventListener('change',()=>{path.textContent=s.from+' → '+(dest.value?dest.selectedOptions[0]?.textContent:'연결 대기');});
 if(texts.length){const jumps=el('nav',null,'pin-jumps');jumps.setAttribute('aria-label','핀 속성 바로가기');
  const labels={text:'문구',choiceWhen:'선택 조건',choiceEffects:'효과',predicate:'이동 조건',link:'목적지'};
  for(const sec of root.querySelectorAll('[data-pin-group]')){const jump=button(labels[sec.dataset.pinGroup],()=>{sec.scrollIntoView({block:'nearest'});sec.querySelector('textarea,button,select')?.focus({preventScroll:true});});jumps.append(jump);}head.after(jumps);}
 if(s.unlink)iconAction(link,'연결만 해제','unlink',s.unlink);
 if(s.note)link.append(el('p',s.note,'pin-note'));
 if(s.rewire){const b=button(s.draft?'차트에서 연결할 노드 선택':'차트에서 연결 대상 변경',()=>{if(dirty()){status.textContent='변경 적용 후 연결 대상을 선택하세요.';return;}s.rewire();});link.append(b);}
 const footer=el('div',null,'pin-editor-actions'),apply=button('변경 적용',()=>{const values=Object.fromEntries(s.fields.map(f=>[f.key,f.mode==='text'?inputs[f.key].value:inputs[f.key].value.trim()]));
  try{s.apply(values,dest?.value);}catch(err){status.textContent=err.message;}});
 apply.dataset.pinApply='';const dirty=()=>!!dest&&dest.value!==(s.destination||'')||s.fields.some(f=>inputs[f.key].value!==(f.value||''));
 const sync=()=>{root.dataset.pinDirty=String(dirty());apply.disabled=!dirty();status.textContent=dirty()?'미적용 변경 있음':'변경 없음';};
 root.oninput=sync;footer.append(status,apply);root.append(footer);panel.replaceChildren(root);panel.scrollTop=0;sync();back.focus({preventScroll:true});
}
// Never let a navigation or save silently skip a staged pin edit. The picker
// and its keyboard shortcuts remain usable; Back provides the discard path.
const pending=()=>document.querySelector('[data-pin-inspector][data-pin-dirty=true]');
function guard(e){const root=pending();if(!root||!e.target.closest||e.target.closest('dialog[open],[data-pin-inspector]'))return;
 if(!e.target.closest('.flow-card,[data-line-pin],#map-bookmark,#day,#scene,#section-list,#section-all,#review,#line-mode,#map-mode,#map-add,#map-arrange,#map-direction,#undo,#redo,#flags-open,#audit-open,#new-day,#scene-run,#reload'))return;
 if(e.type==='keydown'&&!['Enter',' ','ArrowDown','ArrowUp'].includes(e.key))return;
 e.preventDefault();e.stopImmediatePropagation();root.querySelector('.pin-status').textContent='이 핀의 변경을 먼저 적용하거나, ← 노드 상세에서 취소하세요.';root.querySelector('[data-pin-apply]').focus({preventScroll:true});
}
for(const type of ['pointerdown','click','contextmenu','keydown'])document.addEventListener(type,guard,true);
W.LunaPinInspector={show,pending};
})(window);

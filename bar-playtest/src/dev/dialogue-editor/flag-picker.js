/* Editor-only presentation preferences. The picker writes ordinary condition/effect
   text through the existing inspector, never through a separate gameplay store. */
(function(W){
'use strict';
const F=W.LunaBarFlags,key='luna.bar.editor.flag-appearance.v1';
const glyphs={'⚑':'깃발','◆':'마름모','★':'별','●':'원','♥':'하트','✦':'반짝임','☾':'달','♣':'클로버','✚':'십자','↻':'반복','✓':'체크','☀':'해'},icons=Object.keys(glyphs),colors=['#75d7c6','#edbd76','#85bbff','#e7a0cf','#b7a5fe','#a3d57e','#ff9a88','#84cfe8'];
const known={
 d1_tutorial_retry:['튜토리얼 다시 시도','↻',1],day0_skip_tutorial:['튜토리얼 건너뛰기','✓',0],day0_port_tip_received:['포트 팁 수령','★',1],
 tom_name_known:['톰 이름 확인','◆',2],johnny_chip_received:['조니 칩 수령','✦',4],day2_luna_left:['루나 퇴장','☾',7],day3_sugar_received:['각설탕 수령','◆',5],
 campaign_d1_bar_answer_1:['1일차 첫 번째 대답','●',2],campaign_d1_bar_answer_2:['1일차 두 번째 대답','●',3],
 campaign_d2_bar_answer_1:['2일차 첫 번째 대답','♥',6],campaign_d3_bar_answer_1:['3일차 첫 번째 대답','♣',5]};
const title=n=>known[n]?.[0]||n;
function base(n){let h=0;for(const c of n)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;const k=known[n];return {icon:k?.[1]||icons[h%icons.length],color:colors[k?k[2]:(h>>>5)%colors.length]};}
const validColor=v=>/^#[a-f0-9]{6}$/i.test(v);
function read(){try{return new Map(Object.entries(JSON.parse(localStorage.getItem(key)||'{}')));}catch{return new Map();}}
let prefs=read();
function style(n){const v=prefs.get(n);return v&&icons.includes(v.icon)&&validColor(v.color)?v:base(n);}
function paint(el){const n=el.dataset.flagMark,s=style(n);el.style.setProperty('--flag-color',s.color);el.dataset.icon=s.icon;}
function mark(n){const el=document.createElement('i');el.className='flag-mark';el.dataset.flagMark=n;el.setAttribute('aria-hidden','true');el.title=title(n)===n?n:title(n)+' · '+n;paint(el);return el;}
function refresh(){document.querySelectorAll('[data-flag-mark]').forEach(paint);}
function save(n,s){if(s&&(!icons.includes(s.icon)||!validColor(s.color)))throw Error('색상 또는 아이콘을 확인하세요.');
 // Merge other tabs' preferences; never overwrite a whole stale snapshot.
 const latest=read();if(s)latest.set(n,{icon:s.icon,color:s.color});else latest.delete(n);
 localStorage.setItem(key,JSON.stringify(Object.fromEntries(latest)));prefs=latest;refresh();}
W.addEventListener('storage',e=>{if(e.key===key||e.key===null){prefs=read();refresh();}});
const names=expr=>F.tokens(expr).filter(n=>!F.generated(n));
function markers(container,expr){const list=names(expr),limit=container.classList.contains('port-marks')?3:4;
 container.replaceChildren(...list.slice(0,limit).map(mark));container.title=list.map(n=>title(n)===n?n:title(n)+' ('+n+')').join(' · ');
 if(list.length>limit)container.dataset.more='+'+(list.length-limit);else delete container.dataset.more;
}
function appearance(container,n,notify){
 const s=style(n),color=document.createElement('input');color.type='color';color.value=s.color;color.setAttribute('aria-label','플래그 색상');
 const icon=document.createElement('select');icon.setAttribute('aria-label','플래그 아이콘');for(const glyph of icons)icon.add(new Option(glyph+' '+glyphs[glyph],glyph));icon.value=s.icon;
 const reset=document.createElement('button');reset.type='button';reset.textContent='기본 표시로';container.className='flag-style-controls';
 const action=v=>{try{save(n,v);const current=style(n);color.value=current.color;icon.value=current.icon;notify('이 브라우저의 표시만 변경했습니다.');}catch{notify('표시 설정을 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.');}};
 const label=(text,el)=>{const l=document.createElement('label');l.append(text,el);return l;};
 container.append(label('색상',color),label('아이콘',icon),reset);icon.onchange=color.onchange=()=>action({icon:icon.value,color:color.value});reset.onclick=()=>action(null);
}
function parts(value,mode){return value.split(mode==='when'?'&&':';').map(t=>t.trim()).filter(Boolean);}
function term(t,mode){const m=mode==='when'?t.match(/^(!)?flag\.(\w+)(?:\s*(==|!=)\s*(true|false))?$/):t.match(/^flag\.(\w+)\s*=\s*(true|false)$/);
 if(!m)return null;if(mode!=='when')return {name:m[1],value:m[2]==='true'};if(m[1]&&m[3])return null;
 return {name:m[2],value:m[3]?(m[3]==='==')===(m[4]==='true'):!m[1]};}
function updated(value,mode,name,v){if(!/^\w+$/.test(name)||F.generated(name))throw Error('선택할 수 없는 플래그입니다.');
 const next=mode==='when'?(v?'':'!')+'flag.'+name:'flag.'+name+' = '+v;
 const out=[];let found=false;for(const s of parts(value,mode)){if(term(s,mode)?.name===name){if(!found)out.push(next);found=true;}else out.push(s);}if(!found)out.push(next);return out.join(mode==='when'?' && ':'; ');}
const $=id=>document.getElementById(id),el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt)n.textContent=txt;if(cls)n.className=cls;return n;};
function open(model,input,mode,initial){
 const dlg=$('flag-picker'),search=$('fp-query'),list=$('fp-list'),yes=$('fp-true'),no=$('fp-false'),write=mode==='effects';
 const index=F.palette(model),catalog=new Map(index.flags);
 // Pending values in a pin inspector are not CSV declarations. Make them reusable
 // inside that same editing session, without adding unrelated effects to the script.
 for(const field of [input,...(input.closest('[data-pin-inspector]')?.querySelectorAll('[data-pin-field]')||[])])for(const n of names(field.value))if(!catalog.has(n))catalog.set(n,{name:n,uses:[]});
 const flags=[...catalog.values()].filter(e=>!F.generated(e.name)).sort((a,b)=>a.name.localeCompare(b.name));
 let selected=initial||'',visible=[];const remove=$('fp-remove');search.value='';
 $('fp-title').textContent=write?'플래그 값 기록':'플래그 조건 추가';$('fp-hint').textContent=write?'이 위치에서 기록할 값을 고르세요. 다른 플래그와 효과는 유지됩니다.':'이 위치를 실행하려면 플래그가 어떤 값이어야 하나요? 다른 조건은 유지됩니다.';
 function draw(){
  const q=search.value.trim().toLowerCase().replace(/^flag\./,'');
  visible=flags.filter(e=>(e.name+' '+title(e.name)+' '+e.uses.map(u=>(u.day==null?'':u.day+'일차 ')+u.label).join(' ')).toLowerCase().includes(q));
  if(!visible.some(e=>e.name===selected))selected=visible[0]?.name||'';
  list.replaceChildren();for(const entry of visible){const n=entry.name,days=[...new Set(entry.uses.map(u=>u.day).filter(x=>x!=null))];
   const b=el('button',null,'fp-option');b.type='button';b.dataset.name=n;b.setAttribute('aria-pressed',String(n===selected));
   const text=el('span');text.append(el('strong',title(n)),el('small',(title(n)===n?'':n+' · ')+days.sort((a,b)=>+a-+b).map(d=>d+'일차').join(', ')));
   b.append(mark(n),text);b.onclick=()=>{selected=n;draw();yes.focus();};list.append(b);
  }
  if(!visible.length)list.append(el('p','일치하는 플래그가 없습니다.'));
  function stage(n){flags.unshift({name:n,uses:[]});selected=n;search.value=n;draw();yes.focus();}
  const candidate=search.value.trim().replace(/^flag\./,'');if(candidate&&!flags.some(e=>e.name.toLowerCase()===candidate.toLowerCase()||title(e.name)===candidate)){let reason='';try{F.checkName(candidate,index);}catch(err){reason=err.message;}
   if(!reason){const create=el('button','＋ '+candidate+' 새 플래그 만들기','fp-create');create.type='button';create.onclick=()=>stage(candidate);list.append(create);}
   else if(!visible.length){list.append(el('small',reason));if(/[^A-Za-z0-9_]/.test(candidate)){
     const entry=el('label','여기서 새로 만들 영문 ID'),id=el('input'),create=el('button','＋ 새 플래그 만들기','fp-create');id.placeholder='예: received_ticket';id.setAttribute('aria-label','새 플래그 영문 ID');id.autocomplete='off';create.type='button';create.disabled=true;
     id.oninput=()=>{try{F.checkName(id.value.trim(),index);create.disabled=flags.some(e=>e.name.toLowerCase()===id.value.trim().toLowerCase());}catch{create.disabled=true;}};
     create.onclick=()=>stage(id.value.trim());entry.append(id);list.append(entry,create);
    }}
  }
  const old=parts(input.value,mode).map(s=>term(s,mode)).filter(s=>s?.name===selected).at(-1);
  $('fp-selected').textContent=selected?(title(selected)+' · '+(old?'현재 '+(old.value?'참':'거짓'):'아직 지정하지 않음')):'선택 없음';
  remove.hidden=!initial||!parts(input.value,mode).some(t=>term(t,mode)?.name===initial);
  for(const [b,v] of [[yes,true],[no,false]]){b.disabled=!selected;b.setAttribute('aria-pressed',String(old?.value===v));}
 }
 const withoutInitial=()=>parts(input.value,mode).filter(t=>term(t,mode)?.name!==initial).join(mode==='when'?' && ':'; ');
 function commit(v){if(!input.isConnected||!selected&&v!==null)return;
  const replace=initial&&initial!==selected&&parts(input.value,mode).some(t=>term(t,mode)?.name===initial);
  const next=v===null?withoutInitial():updated(replace?withoutInitial():input.value,mode,selected,v);dlg.close();
  if(next!==input.value){input.value=next;input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));}}
 dlg.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();dlg.close();}};
 remove.onclick=()=>commit(null);if(initial)$('fp-hint').textContent='참·거짓을 바꾸거나 다른 플래그로 교체할 수 있습니다. 제거는 이 위치에만 적용됩니다.';
 $('fp-close').onclick=()=>dlg.close();yes.onclick=()=>commit(true);no.onclick=()=>commit(false);search.oninput=draw;
 search.onkeydown=e=>{if(e.isComposing)return;if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button')?.focus();}if(e.key==='Enter'&&selected){e.preventDefault();yes.focus();}};
 list.onkeydown=e=>{const opts=[...list.querySelectorAll('button')],i=opts.indexOf(e.target);if(i<0||!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();opts[(i+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length].focus();};
 draw();dlg.showModal();search.focus();
}
// Keep status chips in step with manual text editing as well as picker edits.
const bound=new WeakMap();
function attach(container,input,mode,model){if(!container||!input)return;
 const previous=bound.get(input);if(previous)input.removeEventListener('input',previous);
 const box=el('div',null,'flag-control'),add=el('button',mode==='when'?'⚑ 플래그 조건 선택':'⚑ 플래그 값 설정'),chips=el('div',null,'flag-chips');add.type='button';add.onclick=()=>open(model(),input,mode);
 function draw(){chips.replaceChildren();for(const n of names(input.value)){
  const cs=parts(input.value,mode).map(t=>term(t,mode)).filter(t=>t?.name===n),val=cs.at(-1)?.value;
  const chip=el('button',null,'flag-chip');chip.type='button';chip.title=n+' · 값 바꾸기';chip.append(mark(n),document.createTextNode(title(n)+(val===undefined?'':' · '+(val?'참':'거짓'))));chip.onclick=()=>open(model(),input,mode,n);chips.append(chip);
 }}
 box.append(add,chips);container.append(box);bound.set(input,draw);input.addEventListener('input',draw);draw();
}
W.LunaFlagPicker={attach,open,mark,markers,names,title,style,appearance,rename(old,n){save(n,style(old));},updated};
})(window);

/* Bar editor only. The hidden backing field remains the existing CSV expression.
   Parse on display; serialize only the clause an author explicitly changes. */
(function(W){
'use strict';
const fp=W.LunaFlagPicker;
const kinds={order_match:'주문 일치',craft_grade:'제조 등급',final_grade:'최종 등급',grade:'최종 등급',money:'소지금',affinity:'호감도',day:'일차',constant:'고정 조건'};
const compare={'==':'같음','!=':'다름','>=':'이상','<=':'이하','>':'초과','<':'미만'};
const grades=['sewage','poor','decent','good','excellent'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const btn=(name,fn,cls)=>{const b=el('button',cls,name);b.type='button';b.onclick=fn;return b;};
function select(label,opts,current,onchange){const s=el('select');s.setAttribute('aria-label',label);for(const [k,v] of opts)s.add(new Option(v,k));s.value=current;s.onchange=()=>onchange(s.value);return s;}
function parse(raw){
 let m=raw.match(/^(!)?(flag\.(\w+)|order_match|true|false)(?:\s*(==|!=)\s*(true|false))?$/);
 if(m&&!(m[1]&&m[4])){
  const b=m[4]?(m[4]==='==')===(m[5]==='true'):!m[1];return {kind:m[3]?'flag':m[2]==='order_match'?'order_match':'constant',id:m[3],value:m[2]==='false'?!b:b};
 }
 m=raw.match(/^(grade|craft_grade|final_grade|money|day|affinity\.(\w+))\s*(==|!=|>=|<=|>|<)\s*(-?\d+|sewage|poor|decent|good|excellent)$/);
 if(m&&m[1].includes('grade')===grades.some(([id])=>id===m[4]))return {kind:m[2]?'affinity':m[1],id:m[2],op:m[3],value:m[4]};
 return {kind:'other',raw};
}
const expression=v=>v.kind==='constant'?String(v.value):v.kind==='order_match'?(v.value?'':'!')+'order_match':v.kind==='flag'?(v.value?'':'!')+'flag.'+v.id:(v.kind==='affinity'?'affinity.'+v.id:v.kind)+' '+v.op+' '+v.value;
function describe(raw,actorName=id=>id){return raw.split('&&').map(t=>{const x=parse(t.trim());return x.kind==='other'?x.raw:x.kind==='flag'?fp.title(x.id)+' · '+(x.value?'참':'거짓'):x.kind==='order_match'?'주문한 술 '+(x.value?'일치':'불일치'):x.kind==='constant'?(x.value?'항상 참':'항상 거짓'):[kinds[x.kind],x.id&&actorName(x.id),x.value,compare[x.op]].filter(Boolean).join(' ');}).join(' · ');}
const bindings=new WeakMap();
function parseEffect(raw){
 const f=raw.match(/^flag\.(\w+)\s*=\s*(true|false)$/);if(f)return {kind:'flag',id:f[1],value:f[2]==='true'};
 const m=raw.match(/^(money|affinity\.(\w+))\s*(\+=|-=|=)\s*(-?\d+)$/);
 if(m&&(m[2]||m[3]!=='='&&!m[4].startsWith('-')))return {kind:m[2]?'affinity':'money',id:m[2],op:m[3],value:m[4]};
 return {kind:'other',raw};
}
function attach(box,input,model,emptyLabel='항상 실행',mode='when'){
 const fx=mode==='effects',split=fx?';':'&&',read=fx?parseEffect:parse,serialize=x=>fx&&x.kind==='flag'?'flag.'+x.id+' = '+x.value:expression(x);
 if(!box||!input)return;
 if(bindings.has(input))input.removeEventListener('input',bindings.get(input));
 box.replaceChildren();box.classList.add('rule-composer');box.setAttribute('role','group');box.setAttribute('aria-label',fx?'효과 편집':'조건 편집');
 const list=el('div','rc-list'),summary=el('p','rc-summary'),tools=el('div','rc-tools'),msg=el('small','rc-message');msg.setAttribute('role','status');
 const actors=model().projected.data.tables.characters.filter(c=>String(c.affinity)==='true').map(c=>[c.id,c['name.ko']||c.id]);
 const days=model().tables.days.map(r=>String(r.day)).filter(v=>/^\d+$/.test(v)).sort((a,b)=>Number(a)-Number(b));
 const parts=()=>input.value.split(split).map(t=>t.trim()).filter(Boolean);
 const send=next=>{const value=next.join(fx?'; ':' && ');if(value===input.value)return;input.value=value;input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText'}));};
 function push(kind){
  if(kind==='flag'){fp.open(model(),input,mode);return;}
  const v={kind,value:kind==='order_match'?true:kind.includes('grade')?'good':fx?'1':'0',op:fx?'+=':'>=',id:actors[0]?.[0]};
  if(kind==='affinity'&&!v.id)return;
  const a=parts(),existing=a.map(read),match=existing.findIndex(x=>x.kind===kind);
  if(!fx&&kind==='order_match'&&match>=0){list.children[match].querySelector('button')?.focus();msg.textContent='기존 주문 조건에서 일치 여부를 고르세요.';return;}
  if(!fx&&existing.some(x=>serialize(x)===serialize(v))&&v.op==='>=')v.op='<=';
  const t=serialize(v),found=!fx?a.findIndex(s=>serialize(read(s))===t):-1;
  if(found>=0){list.children[found]?.querySelector('select,button,input')?.focus();msg.textContent='같은 조건이 있습니다. 기존 항목에서 값을 바꾸세요.';return;}
  send([...a,t]);list.lastElementChild?.querySelector('select,input,button')?.focus({preventScroll:true});
 }
 for(const k of (fx?['flag','money','affinity']:['flag','order_match','craft_grade','final_grade','money','affinity','day'])){
  const b=btn(k==='flag'?(fx?'⚑ 플래그 값 설정':'⚑ 플래그 조건 선택'):'＋ '+kinds[k],()=>push(k),'rc-add');b.dataset.addRule=k;if(k==='affinity'&&!actors.length)b.disabled=true;tools.append(b);
 }
 let keepControls=false;
 function draw(){if(keepControls)return;
  const a=parts();list.replaceChildren();msg.textContent='';summary.textContent=a.length?(fx?'위에서부터 적용':'모두 충족할 때')+' · '+a.length+'개':fx?'적용할 효과 없음':'조건 없음 · '+emptyLabel;
  for(const [i,t] of a.entries()){
   const x=read(t),row=el('div','rc-row'),name=el('span','rc-name',kinds[x.kind]||'기존 조건'),controls=el('div','rc-values');
   row.dataset.ruleKind=x.kind;
   const update=(v,control)=>{const next=[...a];next[i]=serialize({...x,...v});send(next);if(control)[...list.children[i]?.querySelectorAll('[aria-label]')||[]].find(e=>e.getAttribute('aria-label')===control)?.focus({preventScroll:true});};
   if(x.kind==='flag'){
    const chip=btn('',()=>fp.open(model(),input,mode,x.id),'flag-chip');chip.append(fp.mark(x.id),document.createTextNode(fp.title(x.id)));chip.title='다른 플래그 선택';name.replaceChildren(chip);
   }
   if(['flag','order_match','constant'].includes(x.kind)){
    const pair=el('div','rc-switch');for(const b of [true,false]){const label=x.kind==='order_match'?(b?'일치':'불일치'):(b?'참':'거짓'),key=(x.kind==='flag'?fp.title(x.id):kinds[x.kind])+' · '+label;
     const toggle=btn(label,()=>update({value:b},key));toggle.setAttribute('aria-label',key);toggle.setAttribute('aria-pressed',String(x.value===b));pair.append(toggle);}controls.append(pair);
   }else if(x.kind==='other'){
    name.textContent='기존 규칙';controls.append(el('span','rc-raw',t));controls.title='목록에서 지원하지 않는 기존 조건을 원문 그대로 유지합니다.';
   }else{
    if(x.kind==='affinity'){const opts=actors.some(([k])=>k===x.id)?actors:[[x.id,x.id],...actors];controls.append(select('호감도 인물',opts,x.id,id=>update({id},'호감도 인물')));}
    const operation=fx?'변경 방식':'비교 기준';
    const op=select(operation,fx?[['+=','더하기'],['-=','빼기'],...(x.kind==='affinity'?[['=','지정']]:[])]:Object.entries(compare),x.op,v=>update({op:v},operation));
    if(x.kind.includes('grade'))controls.append(select('판정 등급',grades,x.value,v=>update({value:v},'판정 등급')));
    else if(x.kind==='day'){const opts=days.includes(x.value)?days:[x.value,...days];controls.append(select('기준 일차',opts.map(day=>[day,day+'일차']),x.value,value=>update({value},'기준 일차')));}
    else{const number=el('input');number.type='number';number.step='1';number.value=x.value;number.setAttribute('aria-label',fx?'변경할 수치':'비교할 숫자');
     const valid=v=>/^-?\d+$/.test(v)&&Number(v)>=-2147483648&&Number(v)<=2147483647&&!(fx&&x.kind==='money'&&Number(v)<0);
     if(fx&&x.kind==='money')number.min='0';
     number.oninput=()=>{if(!valid(number.value)){msg.textContent='사용할 수 있는 정수를 입력하세요.';return;}
      x.value=number.value;a[i]=serialize(x);keepControls=true;try{send(a);}finally{keepControls=false;}msg.textContent='';};
     number.onblur=()=>{if(!valid(number.value)){number.value=x.value;msg.textContent='기존 숫자를 유지했습니다.';}};number.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();number.blur();}};controls.append(number);}
    controls.append(op);
   }
   const del=btn('×',()=>{if(x.kind==='other'&&!confirm('이 기존 조건을 제거할까요?'))return;send(a.filter((_,j)=>j!==i));(list.children[i]?.querySelector('button,select,input')||tools.firstChild).focus({preventScroll:true});},'rc-delete');
   del.setAttribute('aria-label',(x.kind==='flag'?fp.title(x.id):name.textContent)+(fx?' 효과 삭제':' 조건 삭제'));row.append(name,controls,del);list.append(row);
  }
 }
 const cap=el('span','rc-caption',fx?'효과 추가':'조건 추가');box.append(summary,list,cap,tools,msg);bindings.set(input,draw);input.addEventListener('input',draw);draw();
}
W.LunaRuleEditor={attach,describe,effects:(box,input,model)=>attach(box,input,model,'','effects')};
})(window);

/* Selection offsets belong to the textarea, not the CSV encoding. Formatting
   is one transaction on that field, including when the field is a choice. */
(function(W){
'use strict';
const effects={shake:'흔들림',wave:'물결',pop:'팝',big:'크게',slow:'천천히',b:'굵게',i:'기울임',u:'밑줄',name:'이름 색',order:'주문 색'};
function stackAt(text,offset){
 const stack=[];
 for(const m of text.matchAll(/<(\/?)([\w]+)[^>]*>/g)){
  if(m.index>=offset)break;
  if(m.index+m[0].length>offset)throw Error('태그 중간이 아닌 표시할 글자를 선택하세요.');
  if(m[1])stack.pop();else if(m[2]!=='br'&&!/^\d+$/.test(m[2]))stack.push({name:m[2],index:m.index});
 }return stack;
}
function wrap(text,start,end,keys){
 const outer=stackAt(text,start),finish=stackAt(text,end);
 if(outer.length!==finish.length||outer.some((t,i)=>t.index!==finish[i].index))throw Error('기존 효과 경계에 걸쳐 있습니다. 구절 안쪽이나 태그 전체를 선택하세요.');
 const add=keys.filter(k=>Object.hasOwn(effects,k)&&!outer.some(t=>t.name===k)),left=add.map(k=>'<'+k+'>').join(''),right=add.reverse().map(k=>'</'+k+'>').join('');
 return {value:text.slice(0,start)+left+text.slice(start,end)+right+text.slice(end),start:start+left.length,end:end+left.length};
}
function toolbar(){
 return '<div class="tags"><button type="button" class="text-color-button" data-color-field="text.ko"><span aria-hidden="true">A</span> 색상</button><button type="button" data-effects-batch>효과 묶음…</button>'+
 ['shake','wave','pop','name','order','big','slow'].map(k=>'<button type="button" data-tag="'+k+'">'+effects[k]+'</button>').join('')+'<button type="button" data-delay title="선택한 구절 뒤에 쉼 추가">0.3초 쉼</button></div><div class="line-colors" aria-label="색을 바꿀 구절"></div>';
}
function refresh(t,tags){
 const host=t.closest('.choice-editor,.line-primary')?.querySelector('.line-colors');if(!host)return;
 const chips=W.LunaDialogueColorPicker.colors(t.value,tags).map(r=>{
  const b=document.createElement('button'),label=r.content.replace(/<br>/g,' ').replace(/<[^>]*>/g,'')||'빈 구절';
  b.type='button';b.dataset.colorStart=r.start;b.dataset.colorEnd=r.end;b.style.setProperty('--sample',r.color);b.textContent=label;b.title=label+' · '+r.color+' · 색상 변경';b.setAttribute('aria-label',b.title);return b;
 });
 host.replaceChildren();if(chips.length){const caption=document.createElement('small');caption.textContent='색상 수정';host.append(caption,...chips);}
}
function install({rowFor,tags,savePreset,preview,commit,stop,status}){
 const $=id=>document.getElementById(id),el=$('inspector'),picker=W.LunaDialogueColorPicker.create(),dialog=$('effect-dialog'),checks=$('effect-options');
 for(const [k,name] of Object.entries(effects)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=k;label.append(input,name);checks.append(label);}
 let batch=null,last=[];
 const chosen=()=>[...checks.querySelectorAll(':checked')].map(i=>i.value);
 function focus(t,s,e){t.focus({preventScroll:true});t.setSelectionRange(s,e);}
 const validate=value=>W.LunaTextEffects.compile(value,tags()).errors[0];
 function apply(t,row,value,s,e){
  if(value!==t.value)commit(row,value);t.value=value;refresh(t,tags());focus(t,s,e);
 }
 function batchState(){
  const {t,s,e}=batch,keys=chosen();let result=null,error='';
  try{if(keys.length){result=wrap(t.value,s,e,keys);error=validate(result.value)||(result.value===t.value?'선택한 효과가 이미 적용돼 있습니다.':'');}}catch(err){error=err.message;}
  $('effect-error').textContent=error;$('effect-apply').disabled=!keys.length||!!error;
  $('effect-apply').textContent=keys.length?keys.length+'개 효과 적용':'효과 적용';return result;
 }
 checks.onchange=e=>{if(e.target.checked&&['name','order'].includes(e.target.value))checks.querySelector('[value="'+(e.target.value==='name'?'order':'name')+'"]').checked=false;batchState();};
 $('effect-last').onclick=()=>{for(const i of checks.querySelectorAll('input'))i.checked=last.includes(i.value);batchState();};
 $('effect-cancel').onclick=()=>dialog.close();dialog.onclose=()=>{if(batch){focus(batch.t,batch.originalStart,batch.originalEnd);batch=null;}};
 $('effect-apply').onclick=()=>{const result=batchState();if(!result||$('effect-apply').disabled)return;const {t,row}=batch;last=chosen();batch=null;dialog.close();apply(t,row,result.value,result.start,result.end);};
 el.addEventListener('input',e=>{if(e.target.matches('textarea[data-field="text.ko"]'))refresh(e.target,tags());});
 el.addEventListener('click',e=>{
  const b=e.target.closest('[data-color-field],[data-color-start],[data-effects-batch],[data-tag],[data-delay]');if(!b)return;
  const t=b.closest('.choice-editor,.line-primary')?.querySelector('textarea[data-field="text.ko"]');if(!t)return;
  stop();const row=rowFor(t),text=t.value,s=t.selectionStart,end=t.selectionEnd;
  if(b.hasAttribute('data-color-field')||b.hasAttribute('data-color-start')){
   const a=b.dataset.colorStart==null?s:+b.dataset.colorStart,z=b.dataset.colorEnd==null?end:+b.dataset.colorEnd;
   try{wrap(text,a,z,[]);}catch(err){status(err.message);return;}
   picker.open({text,start:a,end:z,tags:tags(),savePreset,validate,onPreview:v=>preview(row,v),onCancel:()=>{preview(null);focus(t,s,end);},
    onApply:(v,i,j)=>{preview(null);apply(t,row,v,i,j);}});return;
  }
  if(b.hasAttribute('data-effects-batch')){
   if(!text){status('먼저 대사를 입력하세요.');return;}
   const a=s===end?0:s,z=s===end?text.length:end;batch={t,row,s:a,e:z,originalStart:s,originalEnd:end};
   for(const i of checks.querySelectorAll('input'))i.checked=false;
   $('effect-last').hidden=!last.length;$('effect-last').title=last.map(k=>effects[k]).join(' · ');
   $('effect-scope').textContent=(s===end?'대사 전체: ':'선택한 구절: ')+text.slice(a,z).replace(/<[^>]*>/g,'');batchState();dialog.showModal();return;
  }
  try{
   let result;if(b.hasAttribute('data-delay')){stackAt(text,end);result={value:text.slice(0,end)+'<300>'+text.slice(end),start:s===end?end+5:s,end:s===end?end+5:end};}
   else result=wrap(text,s,end,[b.dataset.tag]);
   const error=validate(result.value);if(error)throw Error(error);apply(t,row,result.value,result.start,result.end);
  }catch(err){status(err.message);}
 });
}
W.LunaLineMarkup={toolbar,refresh,install};
})(window);

/* Color editing is a preview transaction: only Apply changes the CSV model. */
(function(root){
'use strict';
function colors(text,tags=[]){
 const stack=[],result=[];
 for(const m of text.matchAll(/<(\/?)(\w+)([^>]*)>/g)){
  const name=m[2],alias=tags.find(t=>t.tag===name&&t.kind==='color');
  if(name!=='color'&&!alias)continue;
  if(!m[1]){const hex=alias?.value||m[3].match(/^=("?)(#[\da-f]{6}(?:[\da-f]{2})?)\1$/i)?.[2];
   stack.push({name,start:m.index,body:m.index+m[0].length,hex:m.index+m[0].indexOf('#'),color:hex?.slice(0,7).toUpperCase()});
  }else if(stack.at(-1)?.name===name){const c=stack.pop();if(c.color)result.push({...c,end:m.index+m[0].length,content:text.slice(c.body,m.index),existing:true});}
 }return result.sort((a,b)=>a.start-b.start);
}
function range(text,start,end,tags){
 const c=colors(text,tags).reverse().find(c=>start===c.start&&end===c.end||start>=c.body&&end<=c.body+c.content.length);
 if(c)return c;
 if(start===end){start=0;end=text.length;}
 return {start,end,content:text.slice(start,end),color:'#72DAE3',existing:false};
}
function create(){
 const $=id=>document.getElementById(id),dialog=$('color-dialog'),rgb=['color-r','color-g','color-b'];let session=null,color='#72DAE3';
 let alias='';
 function presets(){const list=$('preset-list');list.replaceChildren(new Option('개별 색상',''),...session.tags.filter(t=>t.kind==='color').map(t=>new Option(({name:'이름',order:'주문',world:'세계관'}[t.tag]||t.tag)+' · '+t.value,t.tag)));list.value=alias;}
 $('preset-list').onchange=e=>{alias=e.target.value;$('preset-name').value=alias;if(alias)update(session.tags.find(t=>t.tag===alias).value);else update(color);};
 $('preset-save').onclick=()=>{try{const tag=$('preset-name').value.trim();if($('color-hex').value.toUpperCase()!==color||rgb.some((id,i)=>Number($(id).value)!==parseInt(color.slice(1+i*2,3+i*2),16)||$(id).value===''))throw Error('올바른 색상을 먼저 입력하세요.');session.savePreset(tag,color);alias=tag;presets();update(color);}catch(e){invalid(e.message);}};
 const makeText=()=>{if(alias&&session.tags.find(t=>t.tag===alias)?.value.toUpperCase()===color){const r=session.range;return session.text.slice(0,r.start)+'<'+alias+'>'+r.content+'</'+alias+'>'+session.text.slice(r.end);}const r=session.range,t=session.text;if(r.name==='color'&&color===r.color)return t;return r.name==='color'?t.slice(0,r.hex)+color+t.slice(r.hex+7):t.slice(0,r.start)+'<color='+color+'>'+r.content+'</color>'+t.slice(r.end);};
 function update(value){
  if(!session)return;value=value.toUpperCase();
  if(!/^#[\dA-F]{6}$/.test(value)){invalid('HEX 색상은 #RRGGBB 형식으로 입력하세요.');return;}
  color=value;$('color-native').value=value;$('color-hex').value=value;
  rgb.forEach((id,i)=>{$(id).value=parseInt(value.slice(1+i*2,3+i*2),16);});
  $('color-apply').textContent=alias?'공유 색상 적용':'적용';$('color-sample').style.color=value;$('color-error').textContent='';$('color-apply').disabled=false;
  dialog.querySelectorAll('[data-swatch]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.swatch===value)));
  const error=session.validate?.(makeText());
  if(error){invalid(error);return;}
  session.onPreview(makeText());
 }
 function invalid(message){$('color-error').textContent=message;$('color-apply').disabled=true;}
 function cancel(){if(!session)return;const previous=session;session=null;dialog.close();previous.onCancel();}
 $('color-native').addEventListener('input',e=>update(e.target.value));
 $('color-hex').addEventListener('input',e=>update(e.target.value.startsWith('#')?e.target.value:'#'+e.target.value));
 for(const id of rgb)$(id).addEventListener('input',()=>{
  const values=rgb.map(id=>$(id).value);
  if(values.some(v=>!/^\d{1,3}$/.test(v)||Number(v)>255)){invalid('RGB는 각각 0~255 사이의 정수로 입력하세요.');return;}
  update('#'+values.map(v=>Number(v).toString(16).padStart(2,'0')).join(''));
 });
 dialog.addEventListener('click',e=>{const swatch=e.target.closest('[data-swatch]');if(swatch)update(swatch.dataset.swatch);});
 $('color-cancel').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 $('color-apply').onclick=()=>{if(!session||$('color-apply').disabled)return;if(alias&&session.tags.find(t=>t.tag===alias)?.value.toUpperCase()!==color){try{session.savePreset(alias,color);}catch(e){invalid(e.message);return;}}const previous=session,value=makeText(),r=session.range;
  const bound=alias&&value.slice(r.start).startsWith('<'+alias+'>');const body=bound?r.start+alias.length+2:r.existing&&(r.name==='color'||value===session.text)?r.body:r.start+('<color='+color+'>').length;
  session=null;dialog.close();previous.onApply(value,body,body+r.content.length);};
 return {open(options){
  session={...options,range:range(options.text,options.start,options.end,options.tags)};
  alias=session.range.name&&session.range.name!=='color'?session.range.name:'';$('preset-name').value=alias;presets();
  $('color-scope').textContent=session.range.existing?'기존 색상 구간 수정':options.start===options.end?'선택한 글자가 없어 대사 전체에 적용':'선택한 글자에 적용';
  $('color-sample').textContent=window.LunaTextEffects.compile(session.range.content).text||'색상 미리보기';
  dialog.showModal();update(session.range.color);
 }};
}
const api={range,colors,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaDialogueColorPicker=api;
})(typeof window==='undefined'?globalThis:window);

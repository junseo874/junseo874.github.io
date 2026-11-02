/* Color editing is a preview transaction: only Apply changes the CSV model. */
(function(root){
'use strict';
function range(text,start,end){
 const re=/<color=("?)(#[\da-f]{6})\1>([\s\S]*?)<\/color>/gi;
 for(const m of text.matchAll(re)){
  const contentStart=m.index+m[0].indexOf('>')+1,contentEnd=contentStart+m[3].length;
  if((start>=contentStart&&end<=contentEnd)||(start===m.index&&end===m.index+m[0].length))
   return {start:m.index,end:m.index+m[0].length,content:m[3],color:m[2].toUpperCase(),existing:true};
 }
 if(start===end){start=0;end=text.length;}
 return {start,end,content:text.slice(start,end),color:'#72DAE3',existing:false};
}
function create(){
 const $=id=>document.getElementById(id),dialog=$('color-dialog'),rgb=['color-r','color-g','color-b'];let session=null,color='#72DAE3';
 const makeText=()=>session.text.slice(0,session.range.start)+'<color='+color+'>'+session.range.content.replace(/<\/?color(?:=[^>]*)?>/gi,'')+'</color>'+session.text.slice(session.range.end);
 function update(value){
  if(!session)return;value=value.toUpperCase();
  if(!/^#[\dA-F]{6}$/.test(value)){invalid('HEX 색상은 #RRGGBB 형식으로 입력하세요.');return;}
  color=value;$('color-native').value=value;$('color-hex').value=value;
  rgb.forEach((id,i)=>{$(id).value=parseInt(value.slice(1+i*2,3+i*2),16);});
  $('color-sample').style.color=value;$('color-error').textContent='';$('color-apply').disabled=false;
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
 $('color-apply').onclick=()=>{if(!session||$('color-apply').disabled)return;const previous=session,value=makeText();session=null;dialog.close();previous.onApply(value);};
 return {open(options){
  session={...options,range:range(options.text,options.start,options.end)};
  $('color-scope').textContent=session.range.existing?'기존 색상 구간 수정':options.start===options.end?'선택한 글자가 없어 대사 전체에 적용':'선택한 글자에 적용';
  $('color-sample').textContent=window.LunaTextEffects.compile(session.range.content).text||'색상 미리보기';
  dialog.showModal();update(session.range.color);
 }};
}
const api={range,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaDialogueColorPicker=api;
})(typeof window==='undefined'?globalThis:window);

(function(){
'use strict';
const $=id=>document.getElementById(id),dialog=$('contact-dialog'),host=$('contact-fields'),save=$('contact-save'),download=$('contact-export'),status=$('contact-status');
const url='../cutscene-studio/data/first-contact.json',local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let original='',fields=[],busy=false,version=0;
const dirty=()=>fields.some(({input,obj,key})=>input.value!==obj[key]);
function sync(){save.hidden=!local;save.disabled=busy||!dirty();download.disabled=busy||!fields.length;}
function group(name){const box=document.createElement('fieldset'),title=document.createElement('legend');title.textContent=name;box.append(title);host.append(box);return box;}
function field(box,label,obj,key){
 const tag=document.createElement('label'),input=document.createElement('textarea');input.rows=2;input.required=true;input.maxLength=key==='label'?80:500;input.value=obj[key];tag.append(label,input);box.append(tag);fields.push({input,obj,key});input.oninput=()=>{status.textContent='저장하지 않은 변경';sync();};
}
function validate(){for(const {input} of fields){if(!input.value.trim()){status.textContent='빈 문구를 채워 주세요.';input.focus();return false;}}return true;}
async function open(){
 dialog.showModal();const ticket=++version;fields=[];original='';host.replaceChildren();sync();status.textContent='통화 대본을 불러오는 중…';
 try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('통화 대본을 불러오지 못했습니다.');const text=await r.text();if(ticket!==version)return;
  const [first,...common]=JSON.parse(text).clips;original=text;field(group('① 수신'),'크리스',first,'text');
  first.choiceAfter.options.forEach((o,i)=>{const box=group('선택 '+(i+1)+' · '+o.label);field(box,'선택지 버튼 문구',o,'label');field(box,'선택 후 루나의 대사',o,'response');field(box,'크리스의 답변',o,'followup');for(const c of o.clips||[])field(box,c.actor==='phone'?'크리스':'루나',c,'text');});
  if(common.length){const box=group('공통 대사 · 통화 종료');for(const c of common)field(box,c.actor==='phone'?'크리스':'루나',c,'text');}
  status.textContent=local?'저장하면 다음 새 게임부터 반영됩니다.':'수정 후 first-contact.json으로 내보낼 수 있습니다.';sync();
 }catch(e){if(ticket===version)status.textContent=e.message;}
}
function close(){if(!busy&&(!dirty()||confirm('저장하지 않은 통화 대본을 닫을까요?'))){version++;dialog.close();fields=[];}}
$('edit-contact').onclick=open;$('contact-close').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
save.onclick=async()=>{if(busy||!validate())return;busy=true;host.inert=true;sync();try{
 const connection=await window.LunaEditorStorage.connect(),response=await fetch('/api/dialogue-editor',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':connection.token},body:JSON.stringify({mode:'first-contact',original,values:fields.map(f=>f.input.value)})});
 const d=await response.json();if(!response.ok||!d.saved)throw Error(d.error||'저장하지 못했습니다.');
 original=d.original;for(const f of fields)f.obj[f.key]=f.input.value;status.textContent='저장됨 · 다음 새 게임에 반영됩니다.';
 }catch(e){status.textContent=e.message;}finally{busy=false;host.inert=false;sync();}};
download.onclick=()=>{if(!validate())return;const data=JSON.parse(original),values=fields.map(f=>f.input.value);for(const c of data.clips){c.text=values.shift();for(const o of c.choiceAfter?.options||[]){for(const k of ['label','response','followup'])o[k]=values.shift();for(const line of o.clips||[])line.text=values.shift();}}
 const href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=href;a.download='first-contact.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1500);status.textContent='내보낸 파일 위치: cutscene-studio/data/first-contact.json';};
dialog.onkeydown=e=>{e.stopPropagation();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(local&&!save.disabled)save.click();}};
window.addEventListener('beforeunload',e=>{if(dialog.open&&dirty()){e.preventDefault();e.returnValue='';}});
if(location.hash==='#first-contact')open();
})();

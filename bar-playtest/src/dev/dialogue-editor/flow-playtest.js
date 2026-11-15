/* Mount a fresh real game using the unsaved editor projection. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),esc=W.LunaBarCanvas.esc;
function create(api){
 const dlg=$('scene-test'),stage=$('test-stage');let frame,payload,seq=0;
 function post(type,extra){frame?.contentWindow?.postMessage({channel:'luna-editor-rehearsal',type,...extra},location.origin);}
 function size(){if(!frame)return;const k=Math.min(stage.clientWidth/1280,stage.clientHeight/720);Object.assign(frame.style,{left:(stage.clientWidth-k*1280)/2+'px',top:(stage.clientHeight-k*720)/2+'px',transform:'scale('+k+')'});}
 new ResizeObserver(size).observe(stage);
 async function open(){
  const ticket=++seq;dlg.showModal();$('test-label').textContent='대본을 검사하는 중…';$('test-serve').disabled=true;$('test-flags').textContent='';$('test-restart').disabled=true;let check;
  try{check=await api.model().validate();}catch(e){if(ticket===seq)$('test-label').textContent=e.message;return;}
  if(!dlg.open||ticket!==seq)return;if(check.errors.length){$('test-label').textContent=check.errors.join(' / ');return;}
  const m=api.model(),scene=m.scenes.find(s=>s.id===api.scene()),t=check.result.data.tables;
  payload={day:+scene.day,phase:scene.phase,...api.settings(),tables:Object.fromEntries(['days','scenes','steps','bar_choices','bar_choice_groups'].map(k=>[k,t[k]]))};
  $('test-drink').innerHTML='<option value="">주문한 술</option>'+t.cocktails.filter(c=>+c.unlock_day<=payload.day).map(c=>'<option value="'+esc(c.id)+'">'+esc(c['name.ko'])+'</option>').join('');
  $('test-label').textContent='게임 화면을 여는 중…';frame=document.createElement('iframe');frame.id='test-frame';frame.title='독립된 바 장면 플레이테스트';frame.src='index.html?dev=1&dialogue-preview=1&bar-rehearsal=1';stage.replaceChildren(frame);size();
 }
 function close(){seq++;if(dlg.open)dlg.close();frame=null;payload=null;stage.replaceChildren();}
 W.addEventListener('message',e=>{if(!dlg.open||e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.channel!=='luna-bar-rehearsal')return;const m=e.data;
  if(m.type==='ready'){post('start',{payload});$('test-restart').disabled=false;}
  if(m.type==='close')api.back();
  if(m.type==='state'){$('test-label').textContent=m.label+(m.done?'':m.seq?' · '+m.seq+'번 / '+W.LunaBarFlow.kind(m.kind):'');$('test-serve').disabled=!m.craft;$('test-next').textContent=m.coaster?'코스터 놓기':'대사 넘기기';$('test-flags').textContent=(m.flags||[]).join(' · ')||'활성 플래그 없음';}
  if(m.type==='error')$('test-label').textContent=m.message;
 });
 $('test-close').onclick=api.back;dlg.oncancel=e=>{e.preventDefault();api.back();};$('test-next').onclick=()=>post('advance');
 $('test-restart').onclick=()=>post('start',{payload});$('test-serve').onclick=()=>post('serve',{grade:$('test-grade').value,drink:$('test-drink').value});
 return {open,close,get isOpen(){return dlg.open;}};
}
W.LunaBarPlaytest={create};
})(window);

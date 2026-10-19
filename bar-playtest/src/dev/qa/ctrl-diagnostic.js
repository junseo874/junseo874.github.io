/* Opt-in, local Ctrl diagnosis only. No dialogue text, normal typing or save data is recorded. */
window.LunaCtrlDiagnostic=function(getState){
 if(new URLSearchParams(location.search).get('ctrlcheck')!=='local')return;
 let last=null,count=0,lastSent='',sending=false,lastPress=null;
 const panel=document.createElement('pre');panel.id='ctrl-diagnostic';
 panel.style.cssText='position:fixed;left:12px;top:12px;z-index:1000;max-width:480px;max-height:45vh;overflow:auto;margin:0;padding:12px;background:#080e18f5;border:1px solid #64e7ec;border-radius:6px;color:white;font:13px/1.6 sans-serif;pointer-events:none;white-space:pre-wrap';
 document.body.append(panel);
 function snapshot(){return {build:'ctrl-physical-check-1',...getState(),focused:document.hasFocus(),active:document.activeElement?.tagName,modifierEvents:count,last};}
 function blockers(s){return [!s.focused&&'게임 창 포커스 없음',s.paused&&'게임 일시정지/메뉴',s.hidden&&'탭 숨김',s.inspector&&'F2 검사창 열림',s.drag&&'드래그 중',(s.camera||s.cameraLeft>0||s.transition>0)&&'화면 전환 중',s.choice&&'선택지 대기',!s.dialogue&&'진행할 대사 없음',s.screen!=='bar'&&'대화 화면 아님',!['opening','regular'].includes(s.phase)&&'개점·단골 대화 아님',['INPUT','SELECT','TEXTAREA'].includes(s.active)&&'입력란 선택 중'].filter(Boolean).join(', ')||'없음';}
 function update(){const s=snapshot();panel.textContent='Ctrl 입력 확인 · 진단 2\n'+'현재 Ctrl: '+(s.held?'눌림 감지':'안 눌림')+'\n마지막 누른 키: '+(lastPress?.key||'아직 없음')+'\nCtrl을 눌렀을 때 차단 상태: '+(lastPress?.blocked||'아직 확인 전')+'\n현재 차단 상태: '+blockers(s)+'\n넘어간 대사: '+s.history+'개'+'\n키를 놓아도 마지막 결과는 남습니다.';const json=JSON.stringify({...s,lastPress});if(sending||json===lastSent)return;lastSent=json;sending=true;
  fetch('http://127.0.0.1:8134/ctrl-check',{method:'POST',headers:{'Content-Type':'application/json'},body:json}).catch(()=>{}).finally(()=>{sending=false;});
 }
 for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
  if(!['Control','Meta','Alt','Shift'].includes(e.key)&&!/^Control/.test(e.code))return;
  count++;last={type,key:e.key,code:e.code,ctrl:e.ctrlKey,meta:e.metaKey,trusted:e.isTrusted};setTimeout(()=>{if(type==='keydown'){const s=snapshot();lastPress={key:e.key,held:s.held,blocked:blockers(s),history:s.history};}update();},0);
 },true);
 setInterval(update,500);update();
};

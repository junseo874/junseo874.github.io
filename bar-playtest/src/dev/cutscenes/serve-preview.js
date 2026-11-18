/* Read-only simulator fixture. Uses the shipped serving renderer without a Game
 * reset, debug crafting, money mutations, progress writes or campaign changes. */
(function(W){'use strict';
 let active=null;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function open(c){
  if(active||c.g.phase!=='ready'||W.LunaCutsceneLibrary?.active)return;
  const focus=document.activeElement,dialog=document.createElement('dialog');dialog.className='serve-preview-dialog';dialog.setAttribute('aria-labelledby','serve-preview-title');
  let selection={drink:'cosmopolitan',grade:'excellent'},view=null,game=null,raf=0,previous=0,lastHTML='',paused=false,enteredFullscreen=false;
  const ids=Object.keys(W.LUNA_SERVE_SHEETS),grades=Object.keys(W.LunaServeGrade.assets);
  function close(){view?.dispose();if(enteredFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);dialog.close();dialog.remove();active=null;focus?.isConnected&&focus.focus({preventScroll:true});}
  function visibility(){previous=0;}
  function options(values,value,label){return values.map(id=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(label(id))+'</option>').join('');}
  function picker(){
   cancelAnimationFrame(raf);view?.dispose();view=null;game=null;dialog.classList.remove('is-playing');
   dialog.innerHTML='<header><div><h2 id="serve-preview-title">제공하기 화면 보기</h2><p>칵테일과 등급을 선택해 완성 연출을 확인합니다.</p></div><button type="button" data-preview="close" aria-label="닫기">×</button></header><form method="dialog"><label>칵테일<select name="drink">'+options(ids,selection.drink,id=>c.g.name(id))+'</select></label><label>완성 등급<select name="grade">'+options(grades,selection.grade,id=>id.toUpperCase())+'</select></label><p class="serve-preview-help">잔 내밀기 → 등급이 펼쳐지면 버튼 페이드인<br>미리보기에서는 게임 진행과 소지금이 바뀌지 않습니다.</p><footer><button type="button" data-preview="close">취소</button><button type="submit" class="serve-preview-start">미리보기 재생</button></footer></form>';
   dialog.querySelector('select').focus();
  }
  function resize(){const viewport=dialog.querySelector('.serve-preview-viewport'),stage=dialog.querySelector('.serve-preview-stage');if(!stage)return;const scale=Math.min(viewport.clientWidth/1280,viewport.clientHeight/720);stage.style.zoom=scale;view?.sync(stage);}
  function play(){
   cancelAnimationFrame(raf);view?.dispose();paused=false;previous=0;lastHTML='';dialog.classList.add('is-playing');
   dialog.innerHTML='<header><h2 id="serve-preview-title">'+esc(c.g.name(selection.drink))+' · '+selection.grade.toUpperCase()+'</h2><nav aria-label="미리보기 조작"><button data-preview="pause">일시정지</button><button data-preview="replay">다시 재생</button><button data-preview="select">다시 선택</button><button data-preview="fullscreen">전체 화면</button><button data-preview="close">닫기 · Esc</button></nav></header><div class="serve-preview-viewport"><div class="serve-preview-stage"></div></div><p class="serve-preview-status" role="status">완성 연출 미리보기 · 등급이 온전히 보이면 버튼이 나타납니다.</p>';
   game={screen:'result',result:{selected:selection.drink,grade:selection.grade},realTime:0,isPaused:()=>paused,name:id=>c.g.name(id)};
   view=W.LunaServeView({g:game,D:{},L:ko=>ko,esc,drinkArt:()=>'',button:(text,action,attrs='',cls='')=>'<button type="button" class="'+cls+'" data-act="'+action+'" '+attrs+'>'+text+'</button>'});
   const stage=dialog.querySelector('.serve-preview-stage');
   function tick(now){
    if(previous&&!paused&&!document.hidden)game.realTime+=Math.min(.1,(now-previous)/1000);previous=now;
    const html=view.html();if(html!==lastHTML){stage.innerHTML=html;lastHTML=html;}view.sync(stage);raf=requestAnimationFrame(tick);
   }
   resize();raf=requestAnimationFrame(tick);dialog.querySelector('[data-preview="pause"]').focus();
  }
  const observer=new ResizeObserver(resize);observer.observe(dialog);
  dialog.addEventListener('close',()=>observer.disconnect());
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('submit',e=>{e.preventDefault();selection={drink:dialog.querySelector('[name=drink]').value,grade:dialog.querySelector('[name=grade]').value};play();});
  dialog.addEventListener('click',async e=>{
   e.stopPropagation();const button=e.target.closest('button');if(!button||button.disabled)return;
   const action=button.dataset.preview;
   if(action==='close')close();else if(action==='select')picker();else if(action==='replay')play();
   else if(action==='pause'){paused=!paused;previous=0;button.textContent=paused?'계속 재생':'일시정지';}
   else if(action==='fullscreen'){try{if(document.fullscreenElement){await document.exitFullscreen();enteredFullscreen=false;}else{await document.documentElement.requestFullscreen();enteredFullscreen=true;}}catch{dialog.querySelector('.serve-preview-status').textContent='현재 브라우저에서는 전체 화면을 지원하지 않습니다. 창 크기에 맞춰 16:9로 표시합니다.';}}
   else if(button.dataset.act&&view?.ready())dialog.querySelector('.serve-preview-status').textContent=button.dataset.act==='discard'?'휴지통 버튼 확인 완료 · 미리보기이므로 비용이 차감되지 않습니다.':button.dataset.act==='offer'?'제공하기 버튼 확인 완료 · 게임 진행은 그대로 유지됩니다.':'등급 연출 미리보기입니다. 판정 계산은 실제 제조 후 확인할 수 있습니다.';
  });
  // Keep keyboard events inside the native modal; underlying campaign shortcuts
  // and crafting controls must never receive preview input. Native Tab still works.
  for(const type of ['keydown','keyup'])dialog.addEventListener(type,e=>{e.stopPropagation();if(e.code==='Escape'){e.preventDefault();if(type==='keydown')close();}});
  document.addEventListener('visibilitychange',visibility);document.body.append(dialog);active={close};dialog.showModal();picker();
 }
 W.LunaServePreview={open,get active(){return !!active;},close(){active?.close();}};
})(window);

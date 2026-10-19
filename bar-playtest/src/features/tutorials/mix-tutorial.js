/* Read-only guides using captured game regions. No practice input is required. */
(function(W){
'use strict';
W.LunaMixTutorial={attach(g){
 const base=Object.fromEntries(['nextGimmick','gimmickInput','tickGimmick','endGimmick'].map(k=>[k,g[k].bind(g)])),miniSeen=new Set();
 function state(){
  const s=g.gimmick;if(g.screen!=='gimmick'||!s||!['shake','stir'].includes(s.type))return null;
  if(s.mixTutorial)return s.mixTutorial;
  if(g.progress.flags['mix_tutorial_'+s.type]||g.minigame&&miniSeen.has(s.type)||s.started)return null;
  return s.mixTutorial={kind:s.type,mode:s.type==='stir'?'stir':s.rhythm?.mode||'path',page:0};
 }
 function next(){
  const t=state();if(!t||g.isPaused())return;
  if(t.page===0)t.page=1;
  else{
   if(g.minigame)miniSeen.add(t.kind);else g.progress.flags['mix_tutorial_'+t.kind]=true;
   g.log('tutorial_complete',{kind:t.kind,presentation:'image-guide'});delete g.gimmick.mixTutorial;
  }
  g.changed();
 }
 g.nextGimmick=function(){const out=base.nextGimmick();state();return out;};
 g.gimmickInput=function(key){return state()?false:base.gimmickInput(key);};
 g.tickGimmick=function(dt){if(state())return;return base.tickGimmick(dt);};
 g.endGimmick=function(){return state()?false:base.endGimmick();};
 function example(t,L){
  const e=W.LunaMixExamples[t.mode+'-'+t.page];
  if(t.kind==='shake'){
   const overlap=t.page===1,path=t.mode==='path';
   const marks=overlap?[{...e.marks[1],label:'1'}]:e.marks;
   const target=e.marks[1],cx=target.x+target.w/2,cy=target.y+target.h/2;
   // Enlarge the actual overlap frame, not a reconstructed symbol. Keep the
   // number and leader outside the target so the marker remains unobscured.
   const zoom=overlap&&path,view=zoom?[cx-120,cy-120,240,240]:[-14,-14,e.w+28,e.h+28];
   const annotations=marks.map((m,i)=>{
    const x=m.x+m.w/2,y=m.y+m.h/2,r=path?(overlap||i===1?30:22):Math.max(m.w,m.h)/2+9;
    const side=overlap||i===1?1:-1,bx=x+side*(r+32),by=y-r-30,br=zoom?13:16;
    const dx=bx-x,dy=by-y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    return '<g class="mix-shake-callout" data-guide-mark="'+m.label+'"><circle class="mix-shake-ring-back" cx="'+x+'" cy="'+y+'" r="'+r+'"/><circle class="mix-shake-ring" cx="'+x+'" cy="'+y+'" r="'+r+'"/><path class="mix-shake-leader" d="M'+(x+ux*(r+4))+' '+(y+uy*(r+4))+'L'+(bx-ux*(br+2))+' '+(by-uy*(br+2))+'"/><circle class="mix-shake-badge" cx="'+bx+'" cy="'+by+'" r="'+br+'"/><text x="'+bx+'" y="'+by+'">'+m.label+'</text></g>';
   }).join('');
   return '<figure class="mix-guide-image mix-shake-preview"><svg viewBox="'+view.join(' ')+'" role="img" aria-label="'+L(overlap?'실제 겹침 순간 확대 · 번호는 노드 바깥에 표시':'실제 쉐이킹 화면 · 이동 표시와 판정 노드 강조',overlap?'Actual overlap close-up with external callout':'Actual shaking screen with marker and target callouts')+'"><image href="'+e.src+'" width="'+e.w+'" height="'+e.h+'"/>'+annotations+'</svg><figcaption>'+L(zoom?'겹치는 순간 확대 · 조작하지 않아도 됩니다':'실제 화면 예시 · 조작하지 않아도 됩니다',zoom?'Overlap close-up · no input required':'Game screenshot · no input required')+'</figcaption></figure>';
  }
  // At the hit instant both marks coincide: use one badge, not two overlaid ones.
  const marks=t.mode!=='stir'&&t.page===1?[{...e.marks[1],label:'1'}]:e.marks;
  const boxes=marks.map(m=>'<g><rect x="'+m.x+'" y="'+m.y+'" width="'+m.w+'" height="'+m.h+'" rx="5"/><circle cx="'+(m.x+10)+'" cy="'+(m.y+2)+'" r="11"/><text x="'+(m.x+10)+'" y="'+(m.y+6)+'">'+m.label+'</text></g>').join('');
  return '<figure class="mix-guide-image"><svg viewBox="-14 -14 '+(e.w+28)+' '+(e.h+28)+'" role="img" aria-label="'+L('실제 기믹 화면 캡처와 빨간 대상 표시','Actual game screenshot with red target markers')+'"><image href="'+e.src+'" width="'+e.w+'" height="'+e.h+'"/><g class="mix-guide-marks">'+boxes+'</g></svg><figcaption>'+L('실제 화면 예시 · 조작하지 않아도 됩니다','Game screenshot · no input required')+'</figcaption></figure>';
 }
 function html(L){
  const t=state();if(!t||g.isPaused())return '';
  const stir=t.kind==='stir',first=t.page===0,path=t.mode==='path';
  const title=stir?L('스터','Stirring'):L('쉐이킹','Shaking');
  const heading=stir?(first?L('시계 방향으로 젓기','Stir clockwise'):L('시간 안에 한 바퀴','One circle before time runs out')):(first?L('움직이는 표시와 판정 노드','Moving marker and target'):L('겹치는 순간에 입력','Press at the overlap'));
  let rows,keys;
  if(stir){
   keys='W → D → S → A → W';
   rows=first?[
    L('① 위쪽 W에서 시작합니다. 방향키 ↑도 사용할 수 있어요.','① Start at W at the top. The ↑ arrow key also works.'),
    L('② D → ③ S → ④ A → ① W 순서로 시계 방향으로 한 바퀴 돌아요.','Go clockwise: ② D → ③ S → ④ A → ① W.'),
    L('각 키는 화면의 위·오른쪽·아래·왼쪽 노드와 대응해요.','The keys match the top, right, bottom and left nodes.')
   ]:[
    L('① 바깥 원형 게이지가 한 바퀴의 남은 시간을 나타냅니다.','① The outer ring shows the time left for this circle.'),
    L('② 강조된 다음 방향을 순서대로 눌러 1.5초 안에 한 바퀴를 완성하세요.','② Follow the highlighted next direction and finish within 1.5 seconds.'),
    L('순서가 틀리거나 시간이 끝나면 MISS입니다. 다음 바퀴도 강조된 방향을 따라가세요.','A wrong direction or timeout is a MISS. Follow the highlighted direction for the next circle.')
   ];
  }else{
   keys=path?'SPACE / '+L('마우스 왼쪽 버튼','Left click'):'A / ←    D / →';
   rows=first?[
    L('① 움직이는 표시를 따라가며 타이밍을 확인하세요.','① Watch the moving marker to find the timing.'),
    path?L('② 경로 위의 원이 판정 노드입니다. 표시가 원에 겹칠 때 입력해요.','② Circles on the route are targets. Press when the marker overlaps one.'):L('② 고정된 원이 판정 지점입니다. 노트가 이곳에 닿을 때 입력해요.','② The fixed circle is the target. Press when a note reaches it.'),
    path?L('먼저 Space 또는 클릭으로 시작한 뒤, 각 노드에서 한 번씩 눌러 주세요.','Start with Space or a click, then tap once at each target.'):L('Space로 시작합니다. 왼쪽 노트는 A, 오른쪽 노트는 D로 맞혀요.','Start with Space. Use A for left notes and D for right notes.')
   ]:[
    L('① 이렇게 표시와 판정 지점이 겹친 순간에 입력합니다.','① Press at this moment, when the marker and target overlap.'),
    path?L('Space 또는 마우스 왼쪽 버튼을 한 번 눌러요.','Press Space or the left mouse button once.'):L('노트의 A / D에 맞춰 해당 키를 한 번 눌러요. ← / →도 사용할 수 있어요.','Press the key shown on the note: A or D. ← / → also work.'),
    L('누르고 있거나 연타하지 말고, 다음 노드의 타이밍을 기다려 주세요.','Do not hold or mash. Wait for the next target.')
   ];
  }
  return '<div class="mix-tutorial" role="dialog" aria-modal="true" aria-labelledby="mix-lesson-title"><section class="mix-lesson-card"><header><div><small>TUTORIAL</small><h2 id="mix-lesson-title">'+title+'</h2></div><span class="mix-guide-page">'+(t.page+1)+' <i>/ 2</i></span></header><div class="mix-guide-body">'+example(t,L)+'<div class="mix-guide-copy"><h3>'+heading+'</h3><div class="mix-guide-keystrip">'+keys+'</div>'+rows.map(row=>'<p>'+row+'</p>').join('')+'</div></div><footer><span>'+L('안내를 읽는 동안 제조 시간과 점수는 변하지 않습니다.','Time and score stay frozen while you read.')+'</span><nav>'+(first?'':'<button class="mix-lesson-prev" data-act="mixTutorialPrev">'+L('이전','Back')+'</button>')+'<button class="mix-lesson-next" data-act="mixTutorialNext">'+(first?L('다음 · E','Next · E'):L('확인 · E','Got it · E'))+'</button></nav></footer></section></div>';
 }
 return {state,html,action(name){if(!state()||g.isPaused())return false;if(name==='mixTutorialNext')next();else if(name==='mixTutorialPrev'){state().page=0;g.changed();}else if(['settings','pause','miniExit'].includes(name))return false;return true;},key(e){const t=state();if(!t||g.isPaused()||e.code==='Escape')return false;if(e.code==='Tab'){e.preventDefault();const buttons=[...document.querySelectorAll('.mix-tutorial button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return true;}if(e.code==='Enter'&&e.target.closest('.mix-tutorial button'))return false;e.preventDefault();if(!e.repeat&&['KeyE','Space','Enter'].includes(e.code))next();return true;}};
}};
})(window);

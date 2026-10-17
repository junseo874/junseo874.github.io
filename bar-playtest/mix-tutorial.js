(function(W){
'use strict';
W.LunaMixTutorial={attach(g){
 const base=Object.fromEntries(['nextGimmick','gimmickInput','tickGimmick','endGimmick'].map(k=>[k,g[k].bind(g)])),miniSeen=new Set();
 function state(){
  const s=g.gimmick;if(g.screen!=='gimmick'||!s||!['shake','stir'].includes(s.type))return null;
  if(s.mixTutorial)return s.mixTutorial;
  if(g.progress.flags['mix_tutorial_'+s.type]||g.minigame&&miniSeen.has(s.type)||s.started)return null;
  return s.mixTutorial={step:'intro',kind:s.type,laneMode:s.type==='shake'&&s.rhythm&&s.rhythm.mode!=='path',index:0,hits:0,clock:0,message:''};
 }
 function input(key){
  const t=state();if(!t||g.isPaused()||t.step!=='practice')return false;
  if(t.kind==='stir'){
   const aliases={ArrowUp:'KeyW',ArrowRight:'KeyD',ArrowDown:'KeyS',ArrowLeft:'KeyA'},sequence=['KeyW','KeyD','KeyS','KeyA','KeyW'];
   key=aliases[key]||key;if(!sequence.includes(key))return false;
   if(key===sequence[t.index]){t.index++;t.message='';if(t.index===sequence.length)t.step='done';}
   else t.message='order';
  }else{
   const expected=t.laneMode?(t.hits%2?'KeyD':'KeyA'):'Space';
   if(!['Space','MouseLeft','KeyA','KeyD','ArrowLeft','ArrowRight'].includes(key))return false;
   key=({ArrowLeft:'KeyA',ArrowRight:'KeyD',MouseLeft:'Space'})[key]||key;
   const phase=t.clock%2;
   if(key===expected&&Math.abs(phase-1)<=.18){t.hits++;t.clock=0;t.message='good';if(t.hits===2){t.step='done';t.message='';}}
   else t.message=key!==expected?'key':'timing';
  }
  g.changed();return true;
 }
 function next(){
  const t=state();if(!t||g.isPaused())return;
  if(t.step==='intro'){t.step='practice';t.clock=0;}
  else if(t.step==='done'){
   if(g.minigame)miniSeen.add(t.kind);else g.progress.flags['mix_tutorial_'+t.kind]=true;
   g.log('tutorial_complete',{kind:t.kind});delete g.gimmick.mixTutorial;
  }
  g.changed();
 }
 g.nextGimmick=function(){const out=base.nextGimmick();state();return out;};
 g.gimmickInput=function(key){return state()?input(key):base.gimmickInput(key);};
 g.tickGimmick=function(dt){const t=state();if(t){if(!g.isPaused()&&t.step==='practice')t.clock+=dt;return;}return base.tickGimmick(dt);};
 g.endGimmick=function(){return state()?false:base.endGimmick();};
 function html(L){
  const t=state();if(!t||g.isPaused())return '';
  const stir=t.kind==='stir',title=stir?L('스터 첫 연습','Your first stir'):L('쉐이킹 첫 연습','Your first shake');
  const copy=stir?L('W 또는 ↑로 시작한 뒤, D → S → A → W 순서로 시계 방향으로 돌려 주세요. 본 게임에서는 한 바퀴를 1.5초 안에 완성해요.','Start with W or ↑, then rotate clockwise: D → S → A → W. In the game, finish each circle within 1.5 seconds.'):t.laneMode?L('왼쪽은 A 또는 ←, 오른쪽은 D 또는 →예요. 노트가 판정 지점에 닿는 순간 해당 키를 눌러 주세요.','Use A / ← for left, D / → for right. Press when the note reaches the target.'):L('움직이는 표시가 원형 판정 지점에 닿는 순간 스페이스바나 마우스 왼쪽 버튼을 눌러 주세요. 연타하지 말고 타이밍을 맞춰요.','Press Space or left-click when the moving marker reaches a circular target. Time each tap rather than holding or mashing.');
  const messages={order:L('강조된 다음 키를 눌러 주세요. 틀려도 감점은 없어요.','Press the highlighted next key. There is no penalty.'),key:L('표시된 방향의 키를 눌러 주세요.','Press the key for the highlighted direction.'),timing:L('표시가 중앙 원에 겹칠 때 다시 눌러 보세요.','Try again when the marker overlaps the center circle.'),good:L('좋아요! 같은 방식으로 한 번 더 해 보세요.','Good! Try once more.')};
  const keyButton=(label,key,active)=>'<button class="mix-lesson-key '+(active?'is-next':'')+'" data-act="mixTutorialKey" data-id="'+key+'">'+label+'</button>';
  let demo='';
  if(t.step==='practice'){
   if(stir)demo='<div class="mix-lesson-keys">'+['W','D','S','A','W'].map((label,i)=>keyButton(label,'Key'+label,i===t.index)+(i<4?'<span>→</span>':'')).join('')+'</div><p>'+L('천천히 한 바퀴를 완성해 보세요.','Complete one circle at your own pace.')+' '+Math.min(t.index,5)+'/5</p>';
   else demo='<div class="mix-lesson-track" aria-hidden="true"><i class="mix-lesson-target"></i><i class="mix-lesson-note" style="left:'+(10+80*(t.clock%2)/2).toFixed(2)+'%"></i></div><div class="mix-lesson-keys">'+(t.laneMode?keyButton('A / ←','KeyA',t.hits%2===0)+keyButton('D / →','KeyD',t.hits%2===1):keyButton('SPACE / '+L('클릭','Click'),'Space',true))+'</div><p>'+L('타이밍을 두 번 맞춰 보세요.','Hit the timing twice.')+' '+t.hits+'/2</p>';
  }
  const done=t.step==='done';
  return '<div class="mix-tutorial" role="dialog" aria-modal="true" aria-labelledby="mix-lesson-title"><section class="mix-lesson-card"><small>'+L('처음 한 번 · 조작 연습','FIRST TIME · PRACTICE')+'</small><h2 id="mix-lesson-title">'+(done?L('준비됐어요!','You are ready!'):title)+'</h2><p>'+(done?L('이제 실제 제조를 시작해 보세요. 연습 입력은 점수에 반영되지 않아요.','Start mixing for real. Practice inputs do not affect your score.'):copy)+'</p>'+demo+'<p class="mix-lesson-feedback" aria-live="polite">'+(messages[t.message]||'')+'</p><footer>'+L('연습 중에는 제조 시간과 점수가 변하지 않습니다.','Time and score are frozen during practice.')+'</footer>'+(t.step!=='practice'?'<button class="mix-lesson-next" data-act="mixTutorialNext">'+(done?L('제조 시작 · E','Begin · E'):L('연습하기 · E','Practice · E'))+'</button>':'')+'</section></div>';
 }
 return {state,html,action(name,id){if(!state()||g.isPaused())return false;if(name==='mixTutorialNext')next();else if(name==='mixTutorialKey')input(id);else if(['settings','pause','miniExit'].includes(name))return false;return true;},key(e){const t=state();if(!t||g.isPaused()||e.code==='Escape')return false;if(e.code==='Tab'){e.preventDefault();const buttons=[...document.querySelectorAll('.mix-tutorial button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return true;}if(e.code==='Enter'&&e.target.closest('.mix-tutorial button'))return false;e.preventDefault();if(!e.repeat){if(t.step==='practice')input(e.code);else if(['KeyE','Space','Enter'].includes(e.code))next();}return true;}};
}};
})(window);

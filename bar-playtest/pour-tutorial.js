(function(W){
'use strict';
W.LunaPourTutorial={
 action(g,name,id){const s=g.gimmick,t=s?.pourTutorial;if(!t||g.isPaused())return false;
  if(name==='pourTutorialNext'){t.step='pour';return true;}return false;
 },
 sync(g,host,L){const s=g.gimmick,t=s?.pourTutorial,layer=host.querySelector('.pour-tutorial');if(!layer)return;layer.hidden=!t||g.isPaused()||!!s.fluid.finishRequested;if(layer.hidden){delete host.dataset.pourTutorialStep;return;}
  if(s.started&&t.step==='target')t.step='pour';
  if(t.step==='pour'&&s.started&&!s.held&&s.fluid.caughtMl>0)t.step='finish';
  if(t.step==='finish'&&s.held)t.step='pour';
  const steps={
   target:['.pour-top-readout',L('목표량부터 확인해요','Check the target'),L('이번 재료의 목표량은 '+s.target+' '+s.unit+'예요. 현재량과 비교하며 따르고, 목표에서 ±5 ml 이내로 마치면 PERFECT예요.','This ingredient needs '+s.target+' '+s.unit+'. Compare the current amount as you pour. Finish within ±5 ml for PERFECT.'),1],
   pour:[s.started?'.pour-workspace':'.pour-hold',L('누르면 따르고, 떼면 멈춰요','Hold to pour, release to stop'),L('Space를 누르고 있으면 병이 기울고 액체가 나와요. 떼면 병이 돌아오지만 남은 액체는 계속 떨어져요. 목표량보다 조금 일찍 떼고, 부족하면 짧게 더 따라 보세요.','Hold Space to tilt and pour. Release to return the bottle; liquid still in the air keeps falling. Release a little early and add short pours if needed.'),2],
   finish:['.pour-finish',L('남은 방울까지 확인해요','Check the final drops'),L('현재량을 확인하세요. 부족하면 Space로 더 따를 수 있어요. 준비되면 「마치고 다음 재료」를 누르세요. 마지막 방울까지 담긴 뒤 판정하고 다음 재료로 넘어가요.','Check the current amount. Add more with Space if needed, then choose Finish & continue. The final drops land before scoring and moving on.'),3]
  };
  const step=steps[t.step],target=host.querySelector(step[0]);if(!target){layer.hidden=true;return;}
  layer.dataset.step=t.step;host.dataset.pourTutorialStep=t.step;
  if(layer.dataset.copy!==t.step){layer.dataset.copy=t.step;layer.innerHTML='<div class="pour-tutorial-focus"></div><span class="pour-tutorial-arrow" aria-hidden="true">➜</span><section class="pour-tutorial-card" aria-live="polite"><small>'+L('따르기 안내','POURING')+' · '+step[3]+'/3</small><h3></h3><p></p>'+(t.step==='target'?'<button data-act="pourTutorialNext">'+L('확인 · 따르기 시작','Continue · start pouring')+'</button>':'')+'</section>';layer.querySelector('h3').textContent=step[1];layer.querySelector('p').textContent=step[2];}
  const base=host.getBoundingClientRect(),r=target.getBoundingClientRect(),sx=host.offsetWidth/base.width,sy=host.offsetHeight/base.height,w=host.offsetWidth,h=host.offsetHeight;
  const box={x:(r.left-base.left)*sx-6,y:(r.top-base.top)*sy-6,w:r.width*sx+12,h:r.height*sy+12},ring=layer.querySelector('.pour-tutorial-focus'),card=layer.querySelector('.pour-tutorial-card'),arrow=layer.querySelector('.pour-tutorial-arrow');
  Object.assign(ring.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});
  const cw=Math.min(310,w-32);card.style.width=cw+'px';const ch=card.offsetHeight,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let x,y,ax,ay,rotation;
  if(s.started&&t.step==='pour'){x=20;y=h-ch-90;ax=box.x+box.w/2;ay=box.y+box.h-20;rotation=-90;}
  else if(box.x+box.w+cw+44<w){x=box.x+box.w+36;y=clamp(box.y,16,h-ch-16);ax=box.x+box.w+9;ay=box.y+box.h/2-12;rotation=180;}
  else if(box.x-cw-36>16){x=box.x-cw-36;y=clamp(box.y,16,h-ch-16);ax=box.x-30;ay=box.y+box.h/2-12;rotation=0;}
  else{x=clamp(box.x,16,w-cw-16);y=box.y>ch+40?box.y-ch-36:box.y+box.h+36;ax=box.x+box.w/2-12;ay=y<box.y?box.y-32:box.y+box.h+5;rotation=y<box.y?90:-90;}
  Object.assign(card.style,{left:clamp(x,16,w-cw-16)+'px',top:clamp(y,16,h-ch-16)+'px'});Object.assign(arrow.style,{left:ax+'px',top:ay+'px',transform:'rotate('+rotation+'deg)'});
 }
};
})(window);

(function(W){
'use strict';
const assets=['assets/outside/outside_66c64bd9a7c116.png','assets/outside/outside_e4adecb8ff1c9c.png'];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function html(direction){return '<div class="bar-door-scene" data-direction="'+direction+'" role="status" aria-live="polite" aria-label="'+(direction==='in'?'언노운 입장 준비 중':'언노운에서 퇴근하는 중')+'"><div class="bar-door-composition" aria-hidden="true"><div class="bar-door-wall-halo"></div><div class="bar-door-sign"><span>언노운</span><small>UNKNOWN</small></div><div class="bar-door-ground"></div><div class="bar-door-light-floor"></div><div class="bar-door-prop bin"></div><div class="bar-door-prop left-bag"></div><div class="bar-door-prop bags"></div><div class="bar-door-frame"><div class="bar-door-rail"></div><div class="bar-door-aperture"><div class="bar-door-interior"><i></i></div><div class="bar-door-leaf"><span class="bar-door-window"></span><span class="bar-door-grip"></span></div></div><div class="bar-door-sill"></div></div><div class="bar-door-spill"></div></div><p class="bar-door-caption">'+(direction==='in'?'영업을 준비하고 있습니다':'오늘의 영업을 마칩니다')+'</p><span class="bar-door-load-track" aria-hidden="true"><i></i></span></div>';}
function paint(host,d){const el=host.querySelector('.bar-door-scene');if(!el)return;const moving=d.motionAt!=null,progress=moving?smooth((d.time-d.motionAt)/1.45):0,open=d.direction==='in'?progress:1-progress;
 el.style.setProperty('--door-open',open);el.style.setProperty('--door-offset',(-open*103)+'%');el.style.setProperty('--door-arrival',smooth(d.time/.55));el.dataset.phase=d.revealAt!=null?'reveal':moving?d.direction==='in'?'opening':'closing':'loading';el.dataset.open=String(open);el.dataset.ready=String(d.ready);
 const caption=el.querySelector('.bar-door-caption');caption.textContent=d.revealAt!=null?'':moving?(d.direction==='in'?'어서 오세요.':'내일 다시 만나요.'):(d.direction==='in'?'영업을 준비하고 있습니다':'오늘의 영업을 마칩니다');
 el.querySelector('.bar-door-load-track').style.opacity=moving?0:1;host.style.opacity=d.revealAt==null?'1':String(1-smooth((d.time-d.revealAt)/.8));
}
W.LunaBarDoor={assets,html,paint};
})(window);

// One completion cue for manual dialogue; it scales with its world-space bubble.
(function(W){'use strict';
const shape='<svg viewBox="0 0 16 12" focusable="false" aria-hidden="true"><path d="M1 2H15L8 10Z" fill="#121c23" stroke="#c0cecf" stroke-width="1.3" stroke-linejoin="round"/></svg>';
function html(ready=false){return '<span class="dialogue-advance-cue" aria-hidden="true"'+(ready?'':' hidden')+'>'+shape+'</span>';}
function sync(bubble,ready){if(!bubble)return;let cue=bubble.querySelector('.dialogue-advance-cue');if(!cue){bubble.insertAdjacentHTML('beforeend',html());cue=bubble.querySelector('.dialogue-advance-cue');}cue.hidden=!ready;bubble.dataset.advanceReady=String(!!ready);}
function draw(ctx,{right,bottom,size,clock=0}){
 const still=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const bob=still?0:(1-Math.cos(clock*Math.PI*2/1.1))*.07*size;
 ctx.save();ctx.translate(right-size*.48,bottom-size*.7+bob);ctx.scale(size/16,size/16);
 ctx.fillStyle='#121c23';ctx.strokeStyle='#c0cecf';ctx.lineWidth=1.3;ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(1,2);ctx.lineTo(15,2);ctx.lineTo(8,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
W.LunaDialogueCue={html,sync,draw};
})(window);

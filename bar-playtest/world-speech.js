// Dialogue bubbles are world objects: never clamp, reflow or dodge the camera.
// Layout is measured in authored units; only the complete bubble is projected.
(function(W){
'use strict';
function place(el,{x,y,scale=1,gap=0,below=false}){
 el.dataset.worldSpeech='true';
 el.style.left=x+'px';el.style.top=(y+(below?gap:-gap)*scale)+'px';el.style.bottom='auto';
 el.style.transformOrigin=below?'50% 0%':'50% 100%';
 el.style.transform='translate(-50%, '+(below?'0%':'-100%')+') scale('+scale+')';
 el.style.setProperty('--tail-x','50%');
}
W.LunaWorldSpeech={place};
})(window);

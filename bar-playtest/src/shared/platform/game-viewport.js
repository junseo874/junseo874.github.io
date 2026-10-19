(function(){
 'use strict';
 // Body-mounted HUDs use the same logical canvas as the scene, not browser pixels.
 let dragPoint=null;
 function frame(){
  const scale=Math.min(innerWidth/1280,innerHeight/720);
  return {scale,x:(innerWidth-1280*scale)/2,y:(innerHeight-720*scale)/2};
 }
 function positionDrag(x,y){
  dragPoint={x,y};
  const el=document.getElementById('drag-ghost');if(!el)return;
  const f=frame(),s=f.scale;
  // The held object IS the cursor. Never clamp it away from the pointer;
  // the full-frame clipping layer keeps its pixels inside the 16:9 aperture.
  el.style.setProperty('--drag-client-x',x+'px');
  el.style.setProperty('--drag-client-y',y+'px');
  el.dataset.pointerInside=String(x>=f.x&&x<=f.x+1280*s&&y>=f.y&&y<=f.y+720*s);
 }
 function fit(){
  // CSS handles resizing synchronously; JS is only an older-browser fallback.
  if(!CSS.supports('transform','scale(tan(atan2(1px, 1px)))'))document.documentElement.style.setProperty('--ui-scale',frame().scale);
  if(dragPoint)positionDrag(dragPoint.x,dragPoint.y);
 }
 window.LunaGameViewport={frame,positionDrag};
 window.addEventListener('resize',fit);
 fit();
})();

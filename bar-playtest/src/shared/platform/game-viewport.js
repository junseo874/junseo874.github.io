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
  // Keep the entire sprite (including the below-pointer portion) in the aperture.
  el.style.left=Math.max(f.x+45*s,Math.min(f.x+1235*s,x))+'px';
  el.style.top=Math.max(f.y+112*s,Math.min(f.y+692*s,y))+'px';
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

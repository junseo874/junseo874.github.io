/* Device-pixel presentation for the 100-PPU exterior art. UI stays 1280×720. */
(function(W){
'use strict';
const PPU=100,WIDTH=1280,HEIGHT=720;
function surface(width,height,dpr=1){
 dpr=Math.max(.5,Number(dpr)||1);
 // A physical-pixel 16:9 rectangle avoids a second fractional CSS resample.
 const unit=Math.max(1,Math.floor(Math.min(width*dpr/16,height*dpr/9)));
 const w=unit*16,h=unit*9;
 return {w,h,dpr,factor:w/WIDTH,cssScale:w/(WIDTH*dpr),left:Math.round((width*dpr-w)/2)/dpr,top:Math.round((height*dpr-h)/2)/dpr};
}
function settledWidth(width,target){
 const raw=target.w/(width*PPU);
 const zoom=raw>=1?Math.max(1,Math.round(raw)):1/Math.max(1,Math.round(1/raw));
 return target.w/(PPU*zoom);
}
function approachWidth(current,goal,dt){
 const next=current+(goal-current)*(1-Math.exp(-Math.max(0,dt)*5));
 // Finish an asymptotic tween exactly on the pixel-perfect endpoint. This
 // tolerance is far below one physical pixel even at the largest viewport.
 return Math.abs(next-goal)<1e-7?goal:next;
}
function view(camera,target,{scene='street',qa=false,floor=-1.48,displayWidth}={}){
 // Quantize the resting endpoints, NOT each frame of a camera animation.
 // A supplied displayWidth is the continuous tween between those endpoints.
 const w=displayWidth??settledWidth(camera.w,target),zoom=target.w/(w*PPU),h=w*HEIGHT/WIDTH,grid=PPU*zoom;
 let x=camera.x,y=camera.y;
 if(scene==='street'&&!qa){x=w>28.8?-7.85:Math.max(-22.25+w/2,Math.min(6.55-w/2,x));y=Math.max(y,floor+h/2);}
 // Snap viewport edges, not physics or actor coordinates.
 x=Math.round((x-w/2)*grid)/grid+w/2;
 y=Math.round((y+h/2)*grid)/grid-h/2;
 if(scene==='street'&&!qa&&y-h/2<floor)y=Math.ceil((floor+h)*grid)/grid-h/2;
 return {x,y,w,zoom,ppu:PPU};
}
function position(x,y,camera){const scale=WIDTH/camera.w;return{x:WIDTH/2+(x-camera.x)*scale,y:HEIGHT/2-(y-camera.y)*scale};}
function sprite(sp,x,y,sx,sy,flip,camera,target){
 const p=position(x,y,camera),scale=WIDTH/camera.w;
 const w=sp.w/sp.ppu*Math.abs(sx)*scale,h=sp.h/sp.ppu*Math.abs(sy)*scale;
 const mirror=(sx<0)!==!!flip,dx=-w*(mirror?1-sp.pivot.x:sp.pivot.x),dy=-h*(sy<0?sp.pivot.y:1-sp.pivot.y),f=target.factor;
 // Half-pixel pivots in odd-width frames must not move their left/top edges
 // off the device grid, including when Luna turns around.
 return {x:Math.round((p.x+dx)*f)/f-dx,y:Math.round((p.y+dy)*f)/f-dy,w,h};
}
W.LunaPixelCamera={PPU,surface,settledWidth,approachWidth,view,position,sprite};
})(typeof window==='undefined'?globalThis:window);

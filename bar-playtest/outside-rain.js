/* FX_Rain_02.gif reference: sparse stepped rain, down-left drift and tiny ground splashes.
   Rendered in world space, not as a camera-sized GIF containing the reference background. */
(function(root){
'use strict';
const mod=(n,d)=>((n%d)+d)%d;
const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// Street actors stand at pivot Y=-.70, not at their soles: Luna's 86 px
// sprite with a .4 pivot extends to -1.044. Keep the complete splash below
// that level, across the lit road surface (the floor art ends at -1.50).
// This is a fixed world-space band, independent of the actor/lift/camera.
const ROAD_BACK=-1.08,ROAD_DEPTH=.22;
const impactY=seed=>ROAD_BACK-random(seed)*ROAD_DEPTH;
function enabled(m){return !!m&&!m.qa&&m.scene==='street'&&((Number(m.config.day)===0||Number(m.config.day)===1)&&m.config.flow==='out'||Number(m.config.day)===2&&m.config.flow==='in');}
function particles(m,cam){
 const drops=[],splashes=[];if(!enabled(m))return {drops,splashes};
 // Match the reference's ~15 fps pixel animation; no randomness is regenerated per draw.
 const time=Math.floor((m.time||0)*15)/15,halfHeight=cam.w*720/1280/2;
 const left=cam.x-cam.w/2,right=cam.x+cam.w/2,bottom=cam.y-halfHeight,top=cam.y+halfHeight;
 for(let layer=0;layer<2;layer++){
  const spacing=layer?.72:.52,period=3.6,speed=layer?2.8:4.1,drift=time*speed*.43;
  for(let col=Math.floor((left-1+drift)/spacing);col<=Math.ceil((right+1+drift)/spacing);col++){
   const seed=col+layer*719,phase=mod(time*speed+random(seed+1)*period,period);
   const x=col*spacing+random(seed+2)*spacing-drift;
   if(x<left-.2||x>right+.2)continue;
   for(let row=Math.floor(bottom/period)-1;row<=Math.ceil(top/period)+1;row++){
    const y=row*period-phase,ground=impactY(seed+9);
    if(y<ground||y<bottom-.2||y>top+.2)continue;
    drops.push({x,y,length:(.085+random(seed+3)*.04)*(layer?.72:1),alpha:layer?.16+random(seed+4)*.12:.30+random(seed+4)*.32,pixel:layer?.004:.006});
   }
  }
 }
 // Impacts stay on the street surface, never attached to the player or elevator.
 if(bottom<ROAD_BACK+.02&&top>ROAD_BACK-ROAD_DEPTH-.02)for(let i=Math.floor(left*6);i<=Math.ceil(right*6);i++){
  const age=mod(time+random(i+1701)*1.7,1.7);if(age>.28)continue;
  splashes.push({x:i/6+random(i+1801)/6,y:impactY(i+1901),age:age/.28,alpha:(1-age/.28)*.62});
 }
 return {drops,splashes};
}
function draw(ctx,m,cam,position){
 const field=particles(m,cam);if(!field.drops.length&&!field.splashes.length)return;
 const scale=1280/cam.w;
 ctx.save();ctx.fillStyle='#b6c5cc';
 for(const d of field.drops){
  ctx.globalAlpha=d.alpha;
  const count=Math.ceil(d.length/.012),pixel=Math.max(.5,d.pixel*scale);
  for(let j=0;j<count;j++){
   const offset=j*d.length/count,p=position(d.x+offset*.43,d.y+offset);
   ctx.fillRect(Math.round(p.x),Math.round(p.y),pixel,Math.max(.7,d.length/count*scale));
  }
 }
 for(const s of field.splashes){
  ctx.globalAlpha=s.alpha;const radius=.009+s.age*.018,pixel=Math.max(.5,.004*scale);
  for(const [x,y] of [[-1,0],[1,0],[-.55,.65],[.55,.65],[0,-.3]]){
   const p=position(s.x+x*radius,s.y+y*radius*(1-s.age*.6));ctx.fillRect(Math.round(p.x),Math.round(p.y),pixel,pixel);
  }
 }
 ctx.restore();
}
root.LunaOutsideRain={enabled,particles,draw};
})(typeof window==='undefined'?globalThis:window);

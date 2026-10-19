/* Engine recording reference: continuous down-left streaks and tiny ground impacts.
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
function wet(m){return !!m&&!m.qa&&(Number(m.config.day)===1||Number(m.config.day)===0&&m.config.flow==='out'||Number(m.config.day)===2&&m.config.flow==='in');}
function enabled(m){return m?.scene==='street'&&wet(m);}
function particles(m,cam){
 const drops=[],splashes=[];if(!enabled(m))return {drops,splashes};
 // Use the full simulation clock: quantizing to 15 Hz made a fast drop jump
 // four display frames at a time. Seeds remain stable during pan/zoom/pause.
 const time=m.time||0,halfHeight=cam.w*720/1280/2;
 const left=cam.x-cam.w/2,right=cam.x+cam.w/2,bottom=cam.y-halfHeight,top=cam.y+halfHeight;
 for(let layer=0;layer<2;layer++){
  const spacing=layer?.46:.32,period=3.2,speed=layer?3.3:4.8,drift=time*speed*.43;
  for(let col=Math.floor((left-1+drift)/spacing);col<=Math.ceil((right+1+drift)/spacing);col++){
   const seed=col+layer*719,phase=mod(time*speed+random(seed+1)*period,period);
   const x=col*spacing+random(seed+2)*spacing-drift;
   if(x<left-.2||x>right+.2)continue;
   for(let row=Math.floor(bottom/period)-1;row<=Math.ceil(top/period)+1;row++){
    const y=row*period-phase,ground=impactY(seed+9);
    if(y<ground||y<bottom-.2||y>top+.2)continue;
    drops.push({id:`${layer}:${col}:${row}`,x,y,length:(.085+random(seed+3)*.04)*(layer?.72:1),alpha:layer?.16+random(seed+4)*.12:.30+random(seed+4)*.32,pixel:layer?.004:.006});
   }
  }
 }
 // Impacts stay on the street surface, never attached to the player or elevator.
 if(bottom<ROAD_BACK+.02&&top>ROAD_BACK-ROAD_DEPTH-.02)for(let i=Math.floor(left*6);i<=Math.ceil(right*6);i++){
  const age=mod(time+random(i+1701)*.95,.95);if(age>.24)continue;
  splashes.push({x:i/6+random(i+1801)/6,y:impactY(i+1901),age:age/.24,alpha:(1-age/.24)*.48});
 }
 return {drops,splashes};
}
function draw(ctx,m,cam,position,pass='all'){
 const field=particles(m,cam);if(!field.drops.length&&!field.splashes.length)return;
 const scale=1280/cam.w;
 ctx.save();ctx.fillStyle='#b6c5cc';
 for(const d of pass==='splashes'?[]:field.drops){
  const count=Math.ceil(d.length/.006),pixel=Math.max(.5,d.pixel*scale);
  for(let j=0;j<count;j++){
   // A bright falling head fading toward the tail, not an opaque dashed rod.
   ctx.globalAlpha=d.alpha*(1-.75*j/count);
   const offset=j*d.length/count,p=position(d.x+offset*.43,d.y+offset);
   ctx.fillRect(Math.round(p.x),Math.round(p.y),pixel,Math.max(.7,d.length/count*scale));
  }
 }
 for(const s of pass==='drops'?[]:field.splashes){
  ctx.globalAlpha=s.alpha;const radius=.009+s.age*.018,pixel=Math.max(.5,.004*scale);
  for(const [x,y] of [[-1,0],[1,0],[-.55,.65],[.55,.65],[0,-.3]]){
   // Flecks rise and settle while the surface ripple spreads sideways.
   const p=position(s.x+x*radius,s.y+y*radius*Math.sin(Math.PI*s.age));ctx.fillRect(Math.round(p.x),Math.round(p.y),pixel,pixel);
  }
 }
 ctx.restore();
}
// Native house apertures. Rain is behind the room sheet; glass beads are
// confined to the two exposed panes below the blinds, before props and actors.
const HOME_OPENINGS=[[339,132,124,51],[585,22,58,53],[585,95,58,143]];
const HOME_GLASS=[[340,156,54,24],[400,156,60,24]];
function drawHome(ctx,m,cam,position,bg,pass){
 if(m?.scene!=='home'||!wet(m)||!bg)return;
 const sp=bg.sprite,left=bg.x-sp.w*sp.pivot.x/sp.ppu,top=bg.y+sp.h*(1-sp.pivot.y)/sp.ppu;
 const at=(x,y)=>position(left+x/sp.ppu,top-y/sp.ppu),scale=1280/cam.w/sp.ppu;
 ctx.save();ctx.beginPath();
 for(const [x,y,w,h]of pass==='glass'?HOME_GLASS:HOME_OPENINGS){const p=at(x,y);ctx.rect(p.x,p.y,w*scale,h*scale);}
 ctx.clip();
 if(pass==='rain'){
  // Reuse exactly the street drop field and speed, never its splash pass.
  draw(ctx,{...m,scene:'street'},cam,position,'drops');
 }else{
  const time=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:(m.time||0);
  for(const [pane,[x,y,w,h]]of HOME_GLASS.entries())for(let i=0;i<12;i++){
   const seed=i+pane*43,period=5+random(seed+300)*5,age=mod(time+random(seed+310)*period,period)/period;
   const travel=Math.max(0,(age-.48)/.52),px=x+2+random(seed+320)*(w-4)+Math.sin(travel*5+seed)*.3;
   const py=y+random(seed+330)*h+travel*travel*h;
   const p=at(px,py),radius=(.35+Math.min(age/.48,1)*.45)*scale;
   // A bead grows in place, then leaves a faint narrow trail as it slides.
   ctx.fillStyle='#aacdd8';ctx.globalAlpha=.18*(1-travel);
   if(travel>0)ctx.fillRect(p.x-radius*.25,p.y-Math.min(5,travel*12)*scale,Math.max(.4,radius*.5),Math.min(5,travel*12)*scale);
   ctx.globalAlpha=.36*(1-travel*.7);ctx.fillRect(p.x-radius/2,p.y-radius/2,radius,radius*1.5);
   ctx.fillStyle='#e0faff';ctx.globalAlpha=.50*(1-travel*.7);ctx.fillRect(p.x-radius/2,p.y-radius/2,Math.max(.4,radius*.4),Math.max(.4,radius*.4));
  }
 }
 ctx.restore();
}
root.LunaOutsideRain={enabled,particles,draw,wet,drawHome,homeOpenings:HOME_OPENINGS,homeGlass:HOME_GLASS};
})(typeof window==='undefined'?globalThis:window);

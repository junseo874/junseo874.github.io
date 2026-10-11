/* Sparse, world-space hover traffic. Never follows the camera or changes
   gameplay coordinates. Render passes are occluded by the nearer city art. */
(function(root){
'use strict';
const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const routes=[
 {id:0,depth:'mid',period:39,phase:12,duration:24,y:.85,spread:.12,width:.25},
 {id:1,depth:'far',period:53,phase:23,duration:37,y:7.8,spread:1.8,width:.17},
 {id:2,depth:'mid',period:61,phase:3,duration:28,y:4.8,spread:.6,width:.28}
];
const colors=[['#303e4b','#52606a'],['#3d3b43','#65606c'],['#364342','#59655f']];
function vehicles(m,depth){
 if(!m||m.qa||m.scene!=='street')return[];
 const time=Math.max(0,Number(m.time)||0),result=[];
 for(const r of routes){
  if(r.depth!==depth)continue;
  const cycle=Math.floor((time+r.phase)/r.period),seed=r.id*107+cycle*13+(Number(m.config?.day)||0)*31;
  const delay=2+random(seed+1)*4,age=time+r.phase-cycle*r.period-delay;
  const duration=r.duration+random(seed+2)*3;
  if(age<0||age>=duration)continue;
  const progress=age/duration,direction=(cycle+r.id)%2? -1:1;
  // Spawn beyond either playable street edge. Short edge fades are in world
  // space too, so panning/zooming cannot spawn, reset or teleport a vehicle.
  result.push({id:r.id+':'+cycle,depth,x:direction===1?-18+progress*27:9-progress*27,
   y:r.y+(random(seed+3)-.5)*r.spread+Math.sin(age*1.4+seed)*.006,
   direction,width:r.width*(.9+random(seed+4)*.2),variant:seed%2,
   color:Math.floor(random(seed+5)*colors.length),
   alpha:(depth==='far'?.56:.82)*Math.min(1,age/.9,(duration-age)/.9)});
 }
 return result;
}
function shape(ctx,points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function draw(ctx,m,cam,position,depth){
 const list=vehicles(m,depth);if(!list.length)return;
 const speed=depth==='far'?[.88,.93]:[.965,.98],scale=1280/cam.w;
 ctx.save();
 for(const car of list){
  const p=position(car.x+(cam.x+7.85)*(1-speed[0]),car.y+cam.y*(1-speed[1]));
  const w=car.width*scale;if(p.x+w<0||p.x-w>1280||p.y+w<0||p.y-w>720)continue;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(car.direction*w/100,w/100);ctx.globalAlpha=car.alpha;
  // Local vehicle coordinates point right. No wheels: two recessed magnetic
  // pods and a restrained blue underglow suggest levitation, not a rocket.
  const glow=ctx.createRadialGradient(0,8,1,0,8,42);
  glow.addColorStop(0,'rgba(103,181,196,.13)');glow.addColorStop(1,'rgba(103,181,196,0)');
  ctx.fillStyle=glow;ctx.fillRect(-44,-9,88,35);
  const [body,roof]=colors[car.color];
  shape(ctx,[[-49,0],[-39,-10],[-24,-12],[-14,-23],[16,-23],[31,-12],[46,-8],[51,0],[43,8],[-39,8]],body);
  shape(ctx,car.variant?[[-28,-12],[-17,-25],[12,-25],[29,-12]]:[[-25,-12],[-13,-22],[15,-22],[31,-12]],roof);
  shape(ctx,[[-19,-13],[-10,-20],[11,-20],[23,-13]],'#8aaeb4');
  ctx.fillStyle=body;ctx.fillRect(-1,-21,3,10);
  shape(ctx,[[-48,1],[50,1],[43,8],[-39,8]],'#202b36');
  ctx.fillStyle='#81969c';ctx.fillRect(-36,-9,52,1.5);
  ctx.fillStyle='#182731';ctx.fillRect(-33,6,19,5);ctx.fillRect(22,6,17,5);
  ctx.fillStyle='#79bcc4';ctx.fillRect(-30,10,13,1.8);ctx.fillRect(25,10,11,1.8);
  ctx.fillStyle='#bfd8d2';ctx.fillRect(43,-5,7,3);
  ctx.fillStyle='#c27966';ctx.fillRect(-48,-5,4,3);
  ctx.restore();
 }
 ctx.restore();
}
root.LunaOutsideTraffic={vehicles,draw};
})(typeof window==='undefined'?globalThis:window);

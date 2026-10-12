/* Bidirectional, world-space hover traffic. Never follows the camera or changes
   gameplay coordinates. Render passes are occluded by the nearer city art. */
(function(root){
'use strict';
const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const routes=[
 // Dedicated opposing lanes: the return direction never waits for another cycle.
 // Each lane retains a short empty interval; all paths start/end off the map.
 {id:0,depth:'mid',direction:1,period:31,phase:12,duration:24,y:.85,spread:.08,width:.25},
 {id:1,depth:'mid',direction:-1,period:32,phase:19,duration:25,y:1.16,spread:.08,width:.27},
 {id:2,depth:'mid',direction:1,period:34,phase:2,duration:26,y:1.57,spread:.1,width:.24},
 {id:3,depth:'mid',direction:-1,period:33,phase:9,duration:25,y:1.9,spread:.1,width:.26},
 {id:4,depth:'mid',direction:1,period:35,phase:21,duration:27,y:4.8,spread:.2,width:.28},
 {id:5,depth:'mid',direction:-1,period:36,phase:6,duration:28,y:5.4,spread:.2,width:.25},
 {id:6,depth:'far',direction:1,period:41,phase:17,duration:33,y:7.8,spread:.4,width:.17},
 {id:7,depth:'far',direction:-1,period:43,phase:29,duration:35,y:9.3,spread:.4,width:.18}
];
// Muted bodywork stays in the city's palette. Black has a lit roof/edge so it
// reads as a vehicle against dark buildings rather than a featureless silhouette.
const colors=[['#10171f','#29313c'],['#263e58','#496581'],['#254a47','#487b71'],['#603439','#875056'],['#7b7c70','#aaa99b'],['#72552d','#a08551'],['#463951','#705c7e']];
function vehicles(m,depth){
 if(!m||m.qa||m.scene!=='street')return[];
 const time=Math.max(0,Number(m.time)||0),result=[];
 for(const r of routes){
  if(r.depth!==depth)continue;
  const cycle=Math.floor((time+r.phase)/r.period),seed=r.id*107+cycle*13+(Number(m.config?.day)||0)*31;
  const delay=1+random(seed+1)*2,age=time+r.phase-cycle*r.period-delay;
  const duration=r.duration+random(seed+2)*2;
  if(age<0||age>=duration)continue;
  const progress=age/duration,direction=r.direction;
  // Spawn beyond either playable street edge. Short edge fades are in world
  // space too, so panning/zooming cannot spawn, reset or teleport a vehicle.
  result.push({id:r.id+':'+cycle,depth,x:direction===1?-18+progress*27:9-progress*27,
   y:r.y+(random(seed+3)-.5)*r.spread+Math.sin(age*1.4+seed)*.006,
   direction,width:r.width*(.9+random(seed+4)*.2),variant:seed%2,
   color:(r.id+cycle+(Number(m.config?.day)||0))%colors.length,
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

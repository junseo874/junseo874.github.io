/* Bidirectional, world-space hover traffic. Never follows the camera or changes
   gameplay coordinates. Render passes are occluded by the nearer city art. */
(function(root){
'use strict';
const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// Depth is shared by size, contrast, parallax and travel time. Width ranges
// never overlap, even with per-vehicle variation or a different camera zoom.
const depths=Object.freeze({
 near:Object.freeze({parallaxX:.975,alpha:.82}),
 mid:Object.freeze({parallaxX:.88,alpha:.64}),
 far:Object.freeze({parallaxX:.64,alpha:.43})
});
const routes=[
 // Dedicated opposing lanes: the return direction never waits for another cycle.
 // Each lane retains a short empty interval; all paths start/end off the map.
 {id:0,depth:'near',direction:1,period:31,phase:12,duration:24,y:.85,width:.36},
 {id:1,depth:'near',direction:-1,period:32,phase:19,duration:25,y:1.16,width:.38},
 {id:2,depth:'near',direction:1,period:34,phase:2,duration:26,y:1.57,width:.34},
 {id:3,depth:'near',direction:-1,period:33,phase:9,duration:25,y:1.9,width:.37},
 {id:4,depth:'near',direction:1,period:35,phase:21,duration:27,y:4.8,width:.38},
 {id:5,depth:'near',direction:-1,period:36,phase:6,duration:28,y:5.4,width:.35},
 {id:6,depth:'mid',direction:1,period:43,phase:17,duration:35,y:7.8,width:.22},
 {id:7,depth:'mid',direction:-1,period:45,phase:29,duration:37,y:9.3,width:.23},
 {id:8,depth:'mid',direction:1,period:44,phase:23,duration:36,y:1.4,width:.22},
 {id:9,depth:'mid',direction:-1,period:46,phase:8,duration:38,y:2.7,width:.24},
 {id:10,depth:'far',direction:1,period:57,phase:27,duration:47,y:8.8,width:.13},
 {id:11,depth:'far',direction:-1,period:59,phase:39,duration:49,y:11.4,width:.14},
 // Lower skyline gaps also show the smallest traffic from the street lookout.
 {id:12,depth:'far',direction:1,period:58,phase:18,duration:48,y:3.6,width:.13},
 {id:13,depth:'far',direction:-1,period:60,phase:31,duration:50,y:4.6,width:.14}
];
// Tight source rectangles measured on C_midground_2_object1.png (1415 × 714).
const sprites = {
 train: {label:'열차', x:0,y:446,w:227,h:22},
 red: {label:'붉은 승용차', x:290,y:691,w:82,h:23},
 compact: {label:'소형 승용차', x:566,y:365,w:55,h:15},
 silver: {label:'은색 차량', x:903,y:294,w:82,h:27},
 blue: {label:'청색 차량', x:1105,y:495,w:77,h:24},
 carrier: {label:'주황색 광고 차량', x:346,y:611,w:216,h:62},
 screen: {label:'전광판 비행선', x:1250,y:0,w:165,h:115}
};
const trafficTypes=['red','compact','silver','blue','train'];
function vehicles(m,depth){
 if(!m||m.qa||m.scene!=='street'||!depths[depth])return[];
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
   y:r.y,
   direction,width:r.width*(.9+random(seed+4)*.2),sprite:trafficTypes[(r.id+cycle+(Number(m.config?.day)||0))%trafficTypes.length],
   alpha:depths[depth].alpha*Math.min(1,age/.9,(duration-age)/.9)});
 }
 return result;
}
function paint(ctx,image,v,p,width){
 const rect=sprites[v.sprite],height=width*rect.h/rect.w;
 if(p.x+width/2<0||p.x-width/2>1280||p.y+height/2<0||p.y-height/2>720)return;
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 ctx.globalAlpha=v.alpha;
 const transform=ctx.getTransform();
 const snap=(x,a,b)=>(Math.round(x*a+b)-b)/a;
 const x=snap(p.x-width/2,transform.a,transform.e),y=snap(p.y-height/2,transform.d,transform.f);
 ctx.translate(v.direction<0?x+width:x,y);
 if(v.direction<0)ctx.scale(-1,1);
 ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,width,height);
 ctx.restore();
}
function draw(ctx,m,cam,position,depth,images){
 const image=images?.get(root.LUNA_OUTSIDE_DATA?.streetVehicleSheet);
 if(!image)return;
 const parallaxX=depths[depth].parallaxX;
 for(const car of vehicles(m,depth)){
  const p=position(car.x+(cam.x+7.85)*(1-parallaxX),car.y);
  paint(ctx,image,car,p,car.width*1280/cam.w*(car.sprite==='train'?2.5:1));
 }
}
root.LunaOutsideTraffic={vehicles,draw,depths,sprites,paint};
})(typeof window==='undefined'?globalThis:window);

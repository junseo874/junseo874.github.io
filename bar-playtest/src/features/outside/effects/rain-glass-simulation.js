/* Port of Unity WindowRainSimulation.cs + WindowRainMotion.cs (2026-10-20).
   Units and force/adhesion/merge equations are preserved; web density is bounded.
   Coordinates are virtual pixels, origin bottom left. */
(function(W){
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const defaults=Object.freeze({virtualRows:270,spawnPerSecond:32,maxDrops:320,maxCoverage:.08,retireAfter:18,retireSpread:12,wetEvaporation:.1,spawnRadius:[.55,1.9],largeDropChance:.03,slideRadius:3.2,pinVariation:.3,gravity:330,drag:4,maxSpeed:150,meander:.35,trailSpacing:4,trailChance:.7,evaporation:.12,intensityResponse:[1.2,2.5],formationTime:.4,mergeTime:.38,stickSlip:.65});
// Conservative area reservation includes stretched heads/tails and raster padding.
// Overlap is deliberately counted twice so merging cannot create extra water budget.
const footprint=r=>3*Math.PI*(r+.75)**2;
// System.Random's seeded subtractive sequence, including its warm-up rounds.
class Random{
 constructor(seed){const a=this.a=new Float64Array(56);let mj=161803398-Math.abs(seed),mk=1;a[55]=mj;
  for(let i=1;i<55;i++){const ii=21*i%55;a[ii]=mk;mk=mj-mk;if(mk<0)mk+=2147483647;mj=a[ii];}
  for(let k=1;k<5;k++)for(let i=1;i<56;i++){a[i]-=a[1+(i+30)%55];if(a[i]<0)a[i]+=2147483647;}
  this.i=0;this.j=21;
 }
 next(){if(++this.i>=56)this.i=1;if(++this.j>=56)this.j=1;let v=this.a[this.i]-this.a[this.j];if(v===2147483647)v--;if(v<0)v+=2147483647;this.a[this.i]=v;return v/2147483647;}
 range(a,b){return lerp(a,b,this.next());}
}
// Unity's native Perlin implementation is not distributed with the project.
// Use coherent gradient noise with the classic permutation, never per-frame random jitter.
const permutation=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const perm=i=>permutation[i&255],fade=t=>t*t*t*(t*(t*6-15)+10);
function grad(h,x,y){h&=15;const u=h<8?x:y,v=h<4?y:(h===12||h===14?x:0);return ((h&1)?-u:u)+((h&2)?-v:v);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);x-=ix;y-=iy;const a=perm(ix)+iy,b=perm(ix+1)+iy;return clamp((lerp(lerp(grad(perm(a),x,y),grad(perm(b),x-1,y),fade(x)),lerp(grad(perm(a+1),x,y-1),grad(perm(b+1),x-1,y-1),fade(x)),fade(y))+1)*.5);}
class Simulation{
 constructor(settings={},seed=20261019){this.settings={...defaults,...settings};this.random=new Random(seed);this.drops=[];this.time=0;this.intensity=0;this.debt=0;this.width=480;this.height=this.settings.virtualRows;}
 newDrop(x,y,radius){return {x,y,px:x,py:y,vx:0,vy:0,hx:0,hy:-1,radius,pin:this.random.range(.85,1.25),phase:this.random.range(0,100),travelled:0,sliding:false,age:0,mx:0,my:0,mergeFraction:0,mergeRemaining:0,adhesionTravel:0,adhesionPause:0,adhesionStops:0};}
 formation(d){return lerp(.2,1,smooth(d.age/Math.max(.05,this.settings.formationTime*(.8+(d.phase%1)*.4))));}
 coverage(){return this.drops.reduce((area,d)=>area+footprint(d.radius),0)/(this.width*this.height);}
 resize(aspect){const width=Math.max(1,this.height*aspect),k=width/this.width;for(const d of this.drops){d.x*=k;d.px*=k;d.mx*=k;}this.width=width;}
 prewarm(seconds=8){this.intensity=1;for(let t=0;t<seconds;t+=1/30)this.step(1/30,1);}
 step(dt,rain,external={x:0,y:0},moving=false){if(dt<=0)return;for(const d of this.drops){d.px=d.x;d.py=d.y;}const steps=clamp(Math.ceil(dt/(1/30)),1,4),h=Math.min(dt,4/30)/steps;for(let s=0;s<steps;s++)this.advance(h,clamp(rain),external,moving);}
 advance(dt,rain,external,moving){
  const s=this.settings,rng=this.random;this.time+=dt;
  const response=s.intensityResponse[rain>this.intensity?0:1],change=dt/Math.max(.05,response);
  this.intensity+=clamp(rain-this.intensity,-change,change);
  const areaLimit=this.width*this.height*s.maxCoverage;
  let areaUsed=this.drops.reduce((area,d)=>area+footprint(d.radius),0);
  // Ease the arrival rate down before the hard area/count limits, without debt
  // building up into a burst when a large drop leaves the screen.
  const room=1-smooth((areaUsed/areaLimit-.7)/.3);
  this.debt+=s.spawnPerSecond*this.intensity*room*dt;
  while(this.debt>=1){this.debt--;const x=rng.range(0,this.width),y=rng.range(0,this.height*1.03);let r=lerp(s.spawnRadius[0],s.spawnRadius[1],Math.pow(rng.next(),2.4));if(rng.next()<s.largeDropChance)r=s.slideRadius*rng.range(1.15,1.6);
   if(this.drops.length>=s.maxDrops||areaUsed+footprint(r)>areaLimit)continue;
   this.drops.push(this.newDrop(x,y,r));areaUsed+=footprint(r);
  }
  const fx=external.x,fy=-s.gravity+external.y,fm=Math.hypot(fx,fy),dx=fm>.001?fx/fm:0,dy=fm>.001?fy/fm:-1,ratio=Math.sqrt(Math.max(.05,s.gravity)/Math.max(.05,fm)),spawned=[];
  for(const d of this.drops){
   d.age+=dt;d.mergeRemaining=Math.max(0,d.mergeRemaining-dt/Math.max(.05,s.mergeTime));
   let threshold=s.slideRadius*ratio*(d.pin+(noise(d.x*.09+17.3,d.y*.09)-.5)*s.pinVariation*2);
   if(moving&&(d.sliding||d.adhesionPause>0))threshold*=.7;
   d.adhesionPause=Math.max(0,d.adhesionPause-dt);if(moving){d.adhesionPause=0;d.adhesionTravel=0;}
   const contact=8+16*noise(d.phase+31,d.adhesionStops*.73);
   if(!moving&&d.pin>=1&&s.stickSlip>0&&d.adhesionPause<=0&&d.radius>threshold&&d.radius<threshold*2.2&&d.adhesionTravel>=contact){d.adhesionPause=(.2+.3*noise(d.phase+73,d.adhesionStops*1.13))*s.stickSlip;d.adhesionTravel=0;d.adhesionStops++;}
   d.sliding=d.radius>threshold&&d.adhesionPause<=0;
   if(d.sliding){
    const excess=1-threshold/d.radius,k=1-Math.exp(-dt*3);if(d.hx*d.hx+d.hy*d.hy<=.01){d.hx=dx;d.hy=dy;}d.hx=lerp(d.hx,dx,k);d.hy=lerp(d.hy,dy,k);const hm=Math.hypot(d.hx,d.hy)||1;d.hx/=hm;d.hy/=hm;
    const wobble=(noise(d.phase,this.time*.8)-.5)*2*s.meander,force=fm*clamp(excess*1.5),drag=Math.exp(-s.drag*dt);
    d.vx=(d.vx+(d.hx-d.hy*wobble)*force*dt)*drag;d.vy=(d.vy+(d.hy+d.hx*wobble)*force*dt)*drag;
    const speed=Math.hypot(d.vx,d.vy),limit=s.maxSpeed*clamp(d.radius/(s.slideRadius*3));if(speed>limit){d.vx*=limit/speed;d.vy*=limit/speed;}
    d.x+=d.vx*dt;d.y+=d.vy*dt;const distance=Math.hypot(d.vx,d.vy)*dt;d.travelled+=distance;d.adhesionTravel+=distance;
    if(d.travelled>s.trailSpacing){d.travelled=0;if(this.drops.length+spawned.length<s.maxDrops&&rng.next()<s.trailChance&&d.radius>1.6){const r=d.radius*rng.range(.22,.36),remaining=Math.sqrt(Math.max(.01,d.radius*d.radius-r*r)),extra=footprint(remaining)+footprint(r)-footprint(d.radius);if(areaUsed+extra<=areaLimit){areaUsed+=extra;d.radius=remaining;spawned.push(this.newDrop(d.x-d.hx*(d.radius+r+.5),d.y-d.hy*(d.radius+r+.5),r));}}}
   }else{
    const drag=Math.exp(-dt*(d.adhesionPause>0?40:12));d.vx*=drag;d.vy*=drag;if(d.vx*d.vx+d.vy*d.vy<1){d.vx=0;d.vy=0;}d.x+=d.vx*dt;d.y+=d.vy*dt;const k=1-Math.exp(-dt*1.5);d.hx=lerp(d.hx,0,k);d.hy=lerp(d.hy,-1,k);
    if(this.intensity<.5)d.radius-=s.evaporation*(1-this.intensity*2)*dt*(d.radius<1.5?1:.4);
    // Gradual renewal even while raining. Staggered ages prevent a synchronized
    // wipe, and running drops keep their original optical/motion behaviour.
    const retire=s.retireAfter+(d.phase%1)*s.retireSpread;
    if(this.intensity>=.5&&d.age>retire)d.radius-=s.wetEvaporation*smooth((d.age-retire)/3)*dt;
   }
  }
  this.drops.push(...spawned);this.merge();this.drops=this.drops.filter(d=>d.radius>=.35&&d.y>=-d.radius*4&&d.x>=-8&&d.x<=this.width+8);
 }
 merge(){
  const grid=new Map(),dead=new Set(),key=(x,y)=>x+','+y;
  this.drops.forEach((d,i)=>{const k=key(Math.floor(d.x/8),Math.floor(d.y/8));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});
  for(let i=0;i<this.drops.length;i++){if(dead.has(i))continue;let a=this.drops[i];const cx=Math.floor(a.x/8),cy=Math.floor(a.y/8);
   for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(const j of grid.get(key(cx+ox,cy+oy))||[]){if(j===i||dead.has(j))continue;const b=this.drops[j],reach=(a.radius+b.radius)*.8;if((a.x-b.x)**2+(a.y-b.y)**2>reach*reach)continue;
    const aa=a.radius*a.radius,ab=b.radius*b.radius,total=aa+ab,keepA=a.sliding===b.sliding?aa>=ab:a.sliding;
    const keep={...(keepA?a:b)},other=keepA?b:a,area=keep.radius*keep.radius,otherArea=other.radius*other.radius;
    keep.mx=other.x-keep.x;keep.my=other.y-keep.y;keep.mergeFraction=otherArea/total;keep.mergeRemaining=1;keep.age=Math.max(keep.age,other.age);
    keep.x=lerp(keep.x,other.x,otherArea/total*.5);keep.y=lerp(keep.y,other.y,otherArea/total*.5);keep.vx=(keep.vx*area+other.vx*otherArea)/total;keep.vy=(keep.vy*area+other.vy*otherArea)/total;keep.radius=Math.sqrt(total);a=keep;dead.add(j);
   }this.drops[i]=a;
  }this.drops=this.drops.filter((d,i)=>!dead.has(i));
 }
 upload(){const data=new Float32Array(this.drops.length*16);this.drops.forEach((d,i)=>{
  const speed=Math.hypot(d.vx,d.vy),moving=speed>.1,stretch=moving?clamp(1+speed/35,1,2.6):1,remaining=smooth(d.mergeRemaining),fraction=d.mergeFraction*remaining,growth=this.formation(d),mx=d.mx*remaining,my=d.my*remaining;
  const x=d.x-mx*d.mergeFraction*.5,y=d.y-my*d.mergeFraction*.5,r=d.radius*Math.sqrt(1-fraction)*growth,other=d.radius*Math.sqrt(fraction)*growth;
  data.set([x,y,r,stretch,moving?d.vx/speed:0,moving?d.vy/speed:-1,moving?d.px+x-d.x:x,moving?d.py+y-d.y:y,mx,my,other,Math.min(r,other)*.65,d.phase,lerp(.035,.2,clamp(speed/20)),0,0],i*16);
 });return data;}
}
class Motion{
 constructor(){this.reset();}
 reset(){this.last=null;this.vx=0;this.vy=0;this.ax=0;this.ay=0;this.moving=false;this.cuts=0;}
 sample(x,y,height,dt){if(dt<=0)return;if(!this.last||height<=0){this.last={x,y};return;}const dx=(x-this.last.x)/height,dy=(y-this.last.y)/height;this.last={x,y};if(Math.hypot(dx,dy)>.25){this.vx=this.vy=this.ax=this.ay=0;this.moving=false;this.cuts++;return;}
  let rx=dx/dt,ry=dy/dt,k=Math.min(1,2.5/(Math.hypot(rx,ry)||1));rx*=k;ry*=k;const px=this.vx,py=this.vy;this.vx=lerp(px,rx,1-Math.exp(-dt/.25));this.vy=lerp(py,ry,1-Math.exp(-dt/.25));this.moving=Math.hypot(this.vx,this.vy)>(this.moving?.015:.04);
  this.ax=lerp(this.ax,(this.vx-px)/dt,1-Math.exp(-dt/.2));this.ay=lerp(this.ay,(this.vy-py)/dt,1-Math.exp(-dt/.2));k=Math.min(1,8/(Math.hypot(this.ax,this.ay)||1));this.ax*=k;this.ay*=k;
 }
}
W.LunaRainSimulation={Simulation,Motion,Random,noise,defaults};
})(typeof window==='undefined'?globalThis:window);

(function(root){
'use strict';
// Web-only 2D double-density relaxation; inspired by Clavet et al. (SCA 2005).
// Numerical particles carry immutable millilitres. Rendering never changes measurement.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const GLASS={left:596,right:790,top:252,bottom:470};
const STEP=1/120,H=20,MAX_PARTICLES=1100;
function nozzle(angle){const t=clamp(angle/95,0,1),k=t*t*(3-2*t);return{x:420+180*k,y:110+55*k};}
class Simulation{
 constructor({targetMl,unitMl,rate=70,startAngle=95,maxAngle=150,tiltSpeed=95,viscosity=.025}){
  this.targetMl=Math.max(.1,targetMl);this.unitMl=unitMl;this.rate=rate;
  this.startAngle=startAngle;this.maxAngle=maxAngle;this.tiltSpeed=tiltSpeed;this.viscosity=viscosity;
  this.quantum=Math.max(.5,this.targetMl/180);this.supplyMl=Math.max(600,this.targetMl*4);
  this.particles=[];this.grid=new Map();this.pairs=[];this.serial=0;this.accumulator=0;
  this.emittedMl=0;this.caughtMl=0;this.airMl=0;this.spilledMl=0;this.nozzleMl=0;
  this.flow=0;this.finishRequested=false;this.ready=false;this.quiet=0;this.time=0;this.maxSpeed=0;
  this.glass={...GLASS};this.peakParticles=0;this.surfaceY=GLASS.bottom;
 }
 requestFinish(s){this.finishRequested=true;s.held=false;}
 flowAt(angle){return clamp((angle-this.startAngle)/Math.max(1,this.maxAngle-this.startAngle),0,1);}
 predicted(s){
  const extraAngle=Math.max(0,s.angle-this.startAngle),tail=this.rate*this.flowAt(s.angle)*extraAngle/(2*this.tiltSpeed);
  return (this.caughtMl+this.airMl+Math.min(tail,Math.max(0,this.supplyMl-this.emittedMl)))/this.unitMl;
 }
 tick(s,dt){
  if(this.ready)return;
  this.accumulator+=Math.max(0,Math.min(.2,dt));
  while(this.accumulator+1e-10>=STEP){
   this.accumulator=Math.max(0,this.accumulator-STEP);
   s.angle=clamp(s.angle+(s.held&&!this.finishRequested?1:-1)*this.tiltSpeed*STEP,0,this.maxAngle);
   this.flow=this.flowAt(s.angle);this.time+=STEP;
   this.emit(s);this.solve(STEP);this.measure();
   s.value=this.caughtMl/this.unitMl;s.predicted=this.predicted(s);
   if(this.finishRequested&&s.angle===0&&this.airMl<1e-8&&this.maxSpeed<45)this.quiet+=STEP;
   else this.quiet=0;
   if(this.quiet>=.2){this.ready=true;break;}
  }
 }
 emit(s){
  if(this.particles.length>=MAX_PARTICLES-12){this.flow=0;return;}
  const ml=Math.min(this.rate*this.flow*STEP,Math.max(0,this.supplyMl-this.emittedMl));
  this.emittedMl+=ml;this.nozzleMl+=ml;
  const flush=this.flow===0||this.emittedMl>=this.supplyMl-1e-8,at=nozzle(s.angle),a=s.angle*Math.PI/180;
  while(this.nozzleMl+1e-10>=this.quantum||(flush&&this.nozzleMl>1e-9)){
   const mass=Math.min(this.quantum,this.nozzleMl);this.nozzleMl=Math.max(0,this.nozzleMl-mass);
   const serial=this.serial++,lane=(serial%4)-1.5,wiggle=Math.sin(serial*2.399)*.6;
   const speed=260+100*this.flow;
   this.particles.push({id:serial,x:at.x+lane*7+wiggle,y:at.y,px:at.x,py:at.y,
    vx:Math.sin(a)*speed+lane*5,vy:-Math.cos(a)*speed,ml:mass,inside:false,age:0,airAge:0,rho:0,near:0});
  }
  this.peakParticles=Math.max(this.peakParticles,this.particles.length);
 }
 neighbours(){
  const ps=this.particles;this.grid.clear();this.pairs.length=0;
  for(let i=0;i<ps.length;i++){
   const p=ps[i];p.rho=0;p.near=0;
   const x=Math.floor(p.x/H),y=Math.floor(p.y/H),key=x+y*128;
   if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(i);
  }
  for(let i=0;i<ps.length;i++){
   const p=ps[i],x=Math.floor(p.x/H),y=Math.floor(p.y/H);
   for(let gx=x-1;gx<=x+1;gx++)for(let gy=y-1;gy<=y+1;gy++){
    const cell=this.grid.get(gx+gy*128);if(!cell)continue;
    for(const j of cell){
     if(j<=i)continue;const b=ps[j],dx=b.x-p.x,dy=b.y-p.y,d2=dx*dx+dy*dy;
     if(d2>=H*H)continue;
     const d=Math.max(.001,Math.sqrt(d2)),q=1-d/H,q2=q*q;
     p.rho+=q2;b.rho+=q2;p.near+=q2*q;b.near+=q2*q;
     this.pairs.push(i,j,dx/d,dy/d,q);
    }
   }
  }
 }
 constrain(p){
  const g=this.glass,r=3;
  // Swept side walls: an outside droplet is not teleported into the vessel.
  if(p.y>=g.top&&p.py<g.bottom+6){
   const wasInside=p.px>=g.left&&p.px<=g.right;
   if(wasInside||p.inside){
    p.x=clamp(p.x,g.left+r,g.right-r);
    if(p.y>g.bottom-r)p.y=g.bottom-r;
   }else if(p.x>=g.left&&p.x<=g.right){
    p.x=p.px<g.left?g.left-r:g.right+r;
   }
  }
 }
 solve(dt){
  const ps=this.particles,dt2=dt*dt;
  for(const p of ps){
   p.px=p.x;p.py=p.y;p.age+=dt;p.vy+=1100*dt;
   p.x+=p.vx*dt;p.y+=p.vy*dt;this.constrain(p);
  }
  for(let iteration=0;iteration<2;iteration++){
   this.neighbours();
   for(let k=0;k<this.pairs.length;k+=5){
    const a=ps[this.pairs[k]],b=ps[this.pairs[k+1]],nx=this.pairs[k+2],ny=this.pairs[k+3],q=this.pairs[k+4];
    // Density + near-density pressure, with a small negative-pressure cohesion limit.
    const pressure=6200*(Math.max(-.3,a.rho-2.5)+Math.max(-.3,b.rho-2.5))*.5;
    const near=14500*(a.near+b.near)*.5;
    const d=clamp(dt2*(pressure*q+near*q*q)*.5,-.3,2);
    a.x-=nx*d;a.y-=ny*d;b.x+=nx*d;b.y+=ny*d;
   }
   for(const p of ps)this.constrain(p);
  }
  for(const p of ps){
   p.vx=clamp((p.x-p.px)/dt,-650,650);p.vy=clamp((p.y-p.py)/dt,-650,650);
  }
  // XSPH-style neighbour velocity smoothing. Uniform falling velocity is preserved.
  for(let k=0;k<this.pairs.length;k+=5){
   const a=ps[this.pairs[k]],b=ps[this.pairs[k+1]],q=this.pairs[k+4],mix=this.viscosity*q;
   const dx=(b.vx-a.vx)*mix,dy=(b.vy-a.vy)*mix;
   a.vx+=dx;a.vy+=dy;b.vx-=dx;b.vy-=dy;
  }
 }
 measure(){
  let caught=0,air=this.nozzleMl,surface=this.glass.bottom,maxSpeed=0;
  const keep=[],g=this.glass;
  for(const p of this.particles){
   p.inside=p.x>=g.left&&p.x<=g.right&&p.y>=g.top&&p.y<=g.bottom;
   p.airAge=p.inside?0:p.airAge+STEP;
   if(!p.inside&&(p.y>540||p.x<0||p.x>1000||p.airAge>8)){
    this.spilledMl+=p.ml;continue;
   }
   keep.push(p);
   if(p.inside){caught+=p.ml;surface=Math.min(surface,p.y);maxSpeed=Math.max(maxSpeed,Math.hypot(p.vx,p.vy));}
   else air+=p.ml;
  }
  this.particles=keep;this.caughtMl=caught;this.airMl=air;this.maxSpeed=maxSpeed;this.surfaceY=surface;
 }
 audit(){return {emitted:this.emittedMl,caught:this.caughtMl,air:this.airMl,spilled:this.spilledMl,error:this.emittedMl-this.caughtMl-this.airMl-this.spilledMl};}
}
function init(s,game){
 if(!['pour','fill_up'].includes(s.type))return;
 const unit=s.unit==='oz'?game.c('unit_oz_to_ml',30):s.unit==='tsp'?game.c('unit_tsp_to_ml',5):1;
 const visc=['grenadine','cream','coconut_milk'].includes(s.ingredient)?.065:.025;
 s.fluid=new Simulation({targetMl:s.target*unit,unitMl:unit,rate:game.c('pour_emit_rate_ml_per_sec',70),
  startAngle:game.c('pour_start_angle_deg',95),maxAngle:game.c('pour_max_tilt_angle_deg',150),
  tiltSpeed:game.c('pour_tilt_speed_deg_per_sec',95),viscosity:visc});
}
const api={Simulation,init,nozzle,GLASS,STEP};
if(typeof module!=='undefined')module.exports=api;root.LunaPour=api;
})(typeof window==='undefined'?globalThis:window);

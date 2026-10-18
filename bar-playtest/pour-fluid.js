(function(root){
'use strict';
// Reference-style ballistic pixel parcels. Foam stores liquid mass, never creates it.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),STEP=1/120;
const GLASS={left:480,right:622,top:330,bottom:525};
// The lip is the rotation origin. Its translation is an independent, damped
// hand motion, not the former circular orbit around the bottle's center.
const MOUTH=Object.freeze({x:510,y:205,pourX:516,pourY:213});
const WITHOUT_POURER=new Set(['soda_water','cola','cranberry_juice','milk','beer','orange_juice','red_wine','champagne']);
const CARBONATED=new Set(['soda_water','cola','tonic_water','beer','champagne']);
const CANS=new Set(['soda_water','cola']);
// Material response is independent of dispensing rate / scoring units.
const MATERIALS=Object.freeze({
 spirit:Object.freeze({kind:'spirit',foamBase:0,foamFlow:0,foamDecay:1,foamDensity:.3,damping:3.6,stream:1,bubbles:0}),
 soda:Object.freeze({kind:'soda',foamBase:.001,foamFlow:.012,foamDecay:2.8,foamDensity:.45,damping:3.2,stream:1.12,bubbles:56}),
 beer:Object.freeze({kind:'beer',foamBase:.006,foamFlow:.22,foamDecay:.32,foamRetention:.25,foamDensity:.28,damping:4.2,stream:1.12,bubbles:96}),
 cola:Object.freeze({kind:'cola',foamBase:.008,foamFlow:.06,foamDecay:1.1,foamDensity:.27,damping:3.8,stream:1.08,bubbles:64}),
 sparkling:Object.freeze({kind:'sparkling',foamBase:.003,foamFlow:.025,foamDecay:1.8,foamDensity:.4,damping:3.4,stream:1,bubbles:64}),
 juice:Object.freeze({kind:'juice',foamBase:0,foamFlow:0,foamDecay:1,foamDensity:.3,damping:5.8,stream:1.25,bubbles:0})
});
const materialFor=id=>id==='beer'?MATERIALS.beer:id==='cola'?MATERIALS.cola:['soda_water','tonic_water'].includes(id)?MATERIALS.soda:id==='champagne'?MATERIALS.sparkling:['orange_juice','cranberry_juice','milk'].includes(id)?MATERIALS.juice:MATERIALS.spirit;
function foamFraction(material,parcel){
 if(material.kind!=='beer')return material.foamBase+material.foamFlow*parcel.emissionFlow;
 // Remember actual discharge at emission, including the glugging pulses.
 // Gentle pours stay thin; a full stream entrains much more air on landing.
 const force=clamp((parcel.emissionRate??95*parcel.emissionFlow)/95,0,1.25);
 return clamp(material.foamBase+material.foamFlow*Math.pow(force,1.65),0,.34);
}
const toolForIngredient=id=>WITHOUT_POURER.has(id)?'none':'pourer';
const POURER={rateScale:1,maxAngle:170,rampDegrees:57};
function nozzle(angle=0){const u=clamp(angle/110,0,1),ease=u*u*(3-2*u);return{x:MOUTH.x+(MOUTH.pourX-MOUTH.x)*ease,y:MOUTH.y+(MOUTH.pourY-MOUTH.y)*ease};}
function containerSize(bw,bh,can=false){const scale=Math.min((can?128:170)/bh,(can?110:90)/bw);return{w:bw*scale,h:bh*scale};}
class Simulation{
 constructor({targetMl,unitMl=1,rate=42,ingredient=''}){
  this.targetMl=Math.max(.1,targetMl);this.unitMl=unitMl;this.baseRate=rate;this.rate=rate;this.ingredient=ingredient;
  this.can=CANS.has(ingredient);this.carbonated=CARBONATED.has(ingredient);this.tool='pourer';this.pixel=true;
  this.startAngle=98;this.maxAngle=this.can?175:170;this.tiltSpeed=this.can?380:420;this.grab=0;this.popped=false;this.gush=0;
  this.glass={...GLASS};this.capacity=Math.max(260,this.targetMl*1.6);this.mlPx=(GLASS.bottom-GLASS.top-8)/this.capacity;
  this.supplyMl=Math.max(this.can?350:600,this.targetMl*2);this.emittedMl=0;this.caughtMl=0;this.airMl=0;this.spilledMl=0;this.nozzleMl=0;
  this.material=materialFor(ingredient);
  this.motion={...nozzle(),vx:0,vy:0};
  this.liquidMl=0;this.foamMl=0;this.retainedFoamMl=0;this.foamDensity=this.material.foamDensity;this.particles=[];this.splash=[];this.serial=0;this.streamSerial=0;this.peakParticles=0;
  this.surface=new Float64Array(49);this.surfaceVelocity=new Float64Array(49);this.impact=0;this.impactX=(GLASS.left+GLASS.right)/2;
  this.time=0;this.accumulator=0;this.flow=0;this.flowNow=0;this.wobble=0;this.quiet=0;this.maxSpeed=0;this.finishRequested=false;this.ready=false;this.surfaceY=GLASS.bottom;
 }
 setTool(tool,s){if(!['none','pourer'].includes(tool)||s.held||s.angle>0||this.finishRequested)return false;this.tool=tool;this.rate=this.can?70:tool==='none'?95:42;return true;}
 requestFinish(s){this.finishRequested=true;s.held=false;s.dragAngle=null;s.pourOffset=null;}
 nozzle(){return{x:this.motion.x,y:this.motion.y};}
 flowAt(angle){const start=this.can?65+85*this.emittedMl/this.supplyMl:this.popped||this.tool==='none'?80:98;this.startAngle=start;return Math.pow(clamp((angle-start)/55,0,1),this.can?1.4:1.6);}
 predicted(){return(this.caughtMl+this.airMl)/this.unitMl;}
 tick(s,dt){if(this.ready)return;this.accumulator+=clamp(dt,0,.2);while(this.accumulator>=STEP){this.accumulator-=STEP;this.step(s,STEP);}}
 step(s,dt){
  this.time+=dt;const held=s.held&&!this.finishRequested;
  this.grab=clamp(this.grab+(held?4:-3)*dt,0,1);
  const target=held?clamp(s.dragAngle??145,0,this.maxAngle):0;
  // Fine tilt follows the hand promptly; the large automatic travel is gone.
  s.angle+=clamp((target-s.angle)*(1-Math.exp(-(held?28:18)*dt)),-this.tiltSpeed*dt,this.tiltSpeed*dt);
  if(Math.abs(target-s.angle)<.02)s.angle=target;
  const aim=nozzle(s.angle),offset=held?s.pourOffset:null,m=this.motion;
  aim.x+=clamp(offset?.x||0,-8,8);
  aim.y+=clamp(offset?.y||0,-6,6);
  // Critically damped spring: follow the hand without snapping or bouncing.
  for(const axis of ['x','y']){const v=axis==='x'?'vx':'vy';m[v]+=((aim[axis]-m[axis])*256-m[v]*32)*dt;m[axis]+=m[v]*dt;if(Math.abs(aim[axis]-m[axis])<.005&&Math.abs(m[v])<.05){m[axis]=aim[axis];m[v]=0;}}
  if(!this.can&&this.tool==='pourer'&&!this.popped&&s.angle>=160&&this.grab>.95){this.popped=true;this.popTime=this.time;this.gush=.55;const at=this.nozzle();this.cap={x:at.x,y:at.y,vx:275,vy:-465,rotation:s.angle*Math.PI/180,spin:16};}
  if(this.cap){const c=this.cap;c.vy+=1200*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rotation+=c.spin*dt;if(c.y>512&&c.vy>0){c.y=512;c.vy*=-.35;c.vx*=.6;c.spin*=.5;}}
  this.flow=this.grab>.95?this.flowAt(s.angle):0;
  this.flowNow=(this.popped?95:this.rate)*this.flow*(1+.28*Math.sin(this.time*15)*Math.sin(this.time*4.3));
  if(this.gush>0){this.flowNow+=70/.55*2*(this.gush/.55);this.gush=Math.max(0,this.gush-dt);}
  if(this.emittedMl>=this.supplyMl){this.flow=0;this.flowNow=0;}
  const amount=Math.min(this.flowNow*dt,Math.max(0,this.supplyMl-this.emittedMl));
  if(amount>0){const at=this.nozzle(),a=s.angle*Math.PI/180,speed=50+Math.min(this.flowNow,120)*1.3;
   this.particles.push({id:this.serial++,x:at.x,y:at.y,vx:Math.sin(a)*speed,vy:-Math.cos(a)*speed,ml:amount,age:0,emissionFlow:this.flow,emissionRate:this.flowNow,inside:false});this.emittedMl+=amount;}
  const b=this.glass,keep=[];
  for(const p of this.particles){p.age+=dt;const prevY=p.y;p.vy+=1200*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   // A stream can only enter through the open rim, not through the side wall.
   if(!p.entered&&prevY<=b.top&&p.y>=b.top&&p.x>b.left+3&&p.x<b.right-3)p.entered=true;
   if(p.entered){p.x=clamp(p.x,b.left+3,b.right-3);if(p.y>=Math.max(b.top,this.surfaceY-this.foamHeight()*.5)){
    const fraction=foamFraction(this.material,p);
    // Reserve 25% of each beer foam addition, including later top-ups.
    // This is part of foamMl, not extra liquid or a visual-only volume.
    this.retainedFoamMl+=p.ml*fraction*(this.material.foamRetention||0);
    this.foamMl+=p.ml*fraction;this.liquidMl+=p.ml*(1-fraction);this.wobble=clamp(this.wobble+p.ml*.13,0,1);
    this.impactX=p.x;this.impact=clamp(this.impact+p.ml*.12,0,1);
    for(let j=0;j<this.surface.length;j++){
     const x=b.left+3+j/(this.surface.length-1)*(b.right-b.left-6),d=x-p.x;
     this.surfaceVelocity[j]+=p.ml*4*(Math.exp(-d*d/80)-.5*Math.exp(-((Math.abs(d)-17)**2)/100));
    }
    if(p.id%5===0)this.splash.push({x:p.x,y:this.surfaceY-this.foamHeight(),vx:Math.sin(p.id*2.4)*70,vy:-50-(p.id%7)*10,life:.35});continue;
   }}
   if(p.y>b.bottom+20||p.age>3){this.spilledMl+=p.ml;continue;}keep.push(p);
  }
  this.particles=keep;const decay=Math.max(0,this.foamMl-this.retainedFoamMl)*(1-Math.exp(-this.material.foamDecay*dt));this.foamMl-=decay;this.liquidMl+=decay;
  if(this.liquidMl>this.capacity){this.spilledMl+=this.liquidMl-this.capacity;this.liquidMl=this.capacity;}
  const room=Math.max(0,this.capacity-this.liquidMl)*this.foamDensity;
  if(this.foamMl>room){this.retainedFoamMl*=room/this.foamMl;this.spilledMl+=this.foamMl-room;this.foamMl=room;this.overflowTime=this.time;}
  this.caughtMl=this.liquidMl+this.foamMl;this.airMl=this.particles.reduce((n,p)=>n+p.ml,0);this.surfaceY=b.bottom-this.liquidMl*this.mlPx;
  for(const p of this.splash){p.life-=dt;p.vy+=800*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}this.splash=this.splash.filter(p=>p.life>0).slice(-80);
  // Damped, coupled height samples: impact makes a trough and reflected waves.
  // Visual displacement has zero mean; never changes measured liquid volume.
  const heights=this.surface,vel=this.surfaceVelocity;
  for(let j=0;j<heights.length;j++)vel[j]+=((heights[Math.max(0,j-1)]+heights[Math.min(heights.length-1,j+1)]-2*heights[j])*190-heights[j]*30-vel[j]*this.material.damping)*dt;
  let mean=0;for(let j=0;j<heights.length;j++){heights[j]=clamp(heights[j]+vel[j]*dt,-12,12);mean+=heights[j]/heights.length;}
  for(let j=0;j<heights.length;j++)heights[j]-=mean;
  this.impact*=Math.exp(-3.8*dt);
  this.wobble*=Math.exp(-3*dt);this.peakParticles=Math.max(this.peakParticles,this.particles.length);
  s.value=this.caughtMl/this.unitMl;s.predicted=this.predicted();
  if(this.finishRequested&&s.angle<.001&&this.airMl<1e-8&&Math.hypot(m.x-MOUTH.x,m.y-MOUTH.y)<.1){this.quiet+=dt;if(this.quiet>.2)this.ready=true;}else this.quiet=0;
 }
 foamHeight(){return this.foamMl/this.foamDensity*this.mlPx;}
 renderParticles(){return this.particles;}
 audit(){return{emitted:this.emittedMl,caught:this.caughtMl,air:this.airMl,spilled:this.spilledMl,error:this.emittedMl-this.caughtMl-this.airMl-this.spilledMl};}
}
function init(s,game){if(!['pour','fill_up'].includes(s.type))return;const unit=s.unit==='oz'?game.c('unit_oz_to_ml',30):s.unit==='tsp'?game.c('unit_tsp_to_ml',5):1;
 s.fluid=new Simulation({targetMl:s.target*unit,unitMl:unit,ingredient:s.ingredient});game.pourTool=toolForIngredient(s.ingredient);s.fluid.setTool(game.pourTool,s);}
const api={Simulation,init,nozzle,MOUTH,containerSize,GLASS,STEP,POURER,toolForIngredient,materialFor,foamFraction};if(typeof module!=='undefined')module.exports=api;root.LunaPour=api;
})(typeof window==='undefined'?globalThis:window);

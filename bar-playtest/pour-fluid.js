(function(root){
'use strict';
// Reference-style ballistic pixel parcels. Foam stores liquid mass, never creates it.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),STEP=1/120;
const GLASS={left:480,right:622,top:330,bottom:525};
// Rotate around one stationary grip. Picking up/releasing never translates it.
const GRIP=Object.freeze({x:475,y:205,radius:85});
const WITHOUT_POURER=new Set(['soda_water','cola','cranberry_juice','milk','beer','orange_juice','red_wine','champagne']);
const CARBONATED=new Set(['soda_water','cola','tonic_water','beer','champagne']);
const CANS=new Set(['soda_water','cola']);
const toolForIngredient=id=>WITHOUT_POURER.has(id)?'none':'pourer';
const POURER={rateScale:1,maxAngle:170,rampDegrees:57};
function nozzle(angle){const a=angle*Math.PI/180;return{x:GRIP.x+GRIP.radius*Math.sin(a),y:GRIP.y-GRIP.radius*Math.cos(a)};}
function containerSize(bw,bh,can=false){const scale=Math.min((can?128:170)/bh,(can?110:90)/bw);return{w:bw*scale,h:bh*scale};}
class Simulation{
 constructor({targetMl,unitMl=1,rate=42,ingredient=''}){
  this.targetMl=Math.max(.1,targetMl);this.unitMl=unitMl;this.baseRate=rate;this.rate=rate;this.ingredient=ingredient;
  this.can=CANS.has(ingredient);this.carbonated=CARBONATED.has(ingredient);this.tool='pourer';this.pixel=true;
  this.startAngle=98;this.maxAngle=this.can?175:170;this.tiltSpeed=this.can?380:420;this.grab=0;this.popped=false;this.gush=0;
  this.glass={...GLASS};this.capacity=Math.max(260,this.targetMl*1.6);this.mlPx=(GLASS.bottom-GLASS.top-8)/this.capacity;
  this.supplyMl=Math.max(this.can?350:600,this.targetMl*2);this.emittedMl=0;this.caughtMl=0;this.airMl=0;this.spilledMl=0;this.nozzleMl=0;
  this.liquidMl=0;this.foamMl=0;this.foamDensity=.18;this.particles=[];this.splash=[];this.serial=0;this.streamSerial=0;this.peakParticles=0;
  this.time=0;this.accumulator=0;this.flow=0;this.flowNow=0;this.wobble=0;this.quiet=0;this.maxSpeed=0;this.finishRequested=false;this.ready=false;this.surfaceY=GLASS.bottom;
 }
 setTool(tool,s){if(!['none','pourer'].includes(tool)||s.held||s.angle>0||this.finishRequested)return false;this.tool=tool;this.rate=this.can?70:tool==='none'?95:42;return true;}
 requestFinish(s){this.finishRequested=true;s.held=false;s.dragAngle=null;}
 flowAt(angle){const start=this.can?65+85*this.emittedMl/this.supplyMl:this.popped||this.tool==='none'?80:98;this.startAngle=start;return Math.pow(clamp((angle-start)/55,0,1),this.can?1.4:1.6);}
 predicted(){return(this.caughtMl+this.airMl)/this.unitMl;}
 tick(s,dt){if(this.ready)return;this.accumulator+=clamp(dt,0,.2);while(this.accumulator>=STEP){this.accumulator-=STEP;this.step(s,STEP);}}
 step(s,dt){
  this.time+=dt;const held=s.held&&!this.finishRequested;
  this.grab=clamp(this.grab+(held?4:-3)*dt,0,1);
  const target=held&&this.grab>.6?clamp(s.dragAngle??(this.can?145:145),0,this.maxAngle):0;
  s.angle+=clamp(target-s.angle,-this.tiltSpeed*dt,this.tiltSpeed*dt);
  if(!this.can&&this.tool==='pourer'&&!this.popped&&s.angle>=160&&this.grab>.95){this.popped=true;this.popTime=this.time;this.gush=.55;const at=nozzle(s.angle,this.tool,this.grab);this.cap={x:at.x,y:at.y,vx:275,vy:-465,rotation:s.angle*Math.PI/180,spin:16};}
  if(this.cap){const c=this.cap;c.vy+=1200*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rotation+=c.spin*dt;if(c.y>512&&c.vy>0){c.y=512;c.vy*=-.35;c.vx*=.6;c.spin*=.5;}}
  this.flow=this.grab>.95?this.flowAt(s.angle):0;
  this.flowNow=(this.popped?95:this.rate)*this.flow*(1+.28*Math.sin(this.time*15)*Math.sin(this.time*4.3));
  if(this.gush>0){this.flowNow+=70/.55*2*(this.gush/.55);this.gush=Math.max(0,this.gush-dt);}
  if(this.emittedMl>=this.supplyMl){this.flow=0;this.flowNow=0;}
  const amount=Math.min(this.flowNow*dt,Math.max(0,this.supplyMl-this.emittedMl));
  if(amount>0){const at=nozzle(s.angle,this.tool,this.grab),a=s.angle*Math.PI/180,speed=50+Math.min(this.flowNow,120)*1.3;
   this.particles.push({id:this.serial++,x:at.x,y:at.y,vx:Math.sin(a)*speed,vy:-Math.cos(a)*speed,ml:amount,age:0,emissionFlow:this.flow,inside:false});this.emittedMl+=amount;}
  const b=this.glass,keep=[];
  for(const p of this.particles){p.age+=dt;const prevY=p.y;p.vy+=1200*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   // A stream can only enter through the open rim, not through the side wall.
   if(!p.entered&&prevY<=b.top&&p.y>=b.top&&p.x>b.left+3&&p.x<b.right-3)p.entered=true;
   if(p.entered){p.x=clamp(p.x,b.left+3,b.right-3);if(p.y>=Math.max(b.top,this.surfaceY-this.foamHeight()*.5)){
    const fraction=this.carbonated?clamp(.03+.23*p.emissionFlow,0,.3):0;
    this.foamMl+=p.ml*fraction;this.liquidMl+=p.ml*(1-fraction);this.wobble=clamp(this.wobble+p.ml*.13,0,1);
    if(p.id%5===0)this.splash.push({x:p.x,y:this.surfaceY-this.foamHeight(),vx:Math.sin(p.id*2.4)*70,vy:-50-(p.id%7)*10,life:.35});continue;
   }}
   if(p.y>b.bottom+20||p.age>3){this.spilledMl+=p.ml;continue;}keep.push(p);
  }
  this.particles=keep;const decay=this.foamMl*(1-Math.exp(-.32*dt));this.foamMl-=decay;this.liquidMl+=decay;
  if(this.liquidMl>this.capacity){this.spilledMl+=this.liquidMl-this.capacity;this.liquidMl=this.capacity;}
  const room=Math.max(0,this.capacity-this.liquidMl)*this.foamDensity;
  if(this.foamMl>room){this.spilledMl+=this.foamMl-room;this.foamMl=room;this.overflowTime=this.time;}
  this.caughtMl=this.liquidMl+this.foamMl;this.airMl=this.particles.reduce((n,p)=>n+p.ml,0);this.surfaceY=b.bottom-this.liquidMl*this.mlPx;
  for(const p of this.splash){p.life-=dt;p.vy+=800*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}this.splash=this.splash.filter(p=>p.life>0).slice(-80);
  this.wobble*=Math.exp(-3*dt);this.peakParticles=Math.max(this.peakParticles,this.particles.length);
  s.value=this.caughtMl/this.unitMl;s.predicted=this.predicted();
  if(this.finishRequested&&s.angle<.001&&this.airMl<1e-8){this.quiet+=dt;if(this.quiet>.2)this.ready=true;}else this.quiet=0;
 }
 foamHeight(){return this.foamMl/this.foamDensity*this.mlPx;}
 renderParticles(){return this.particles;}
 audit(){return{emitted:this.emittedMl,caught:this.caughtMl,air:this.airMl,spilled:this.spilledMl,error:this.emittedMl-this.caughtMl-this.airMl-this.spilledMl};}
}
function init(s,game){if(!['pour','fill_up'].includes(s.type))return;const unit=s.unit==='oz'?game.c('unit_oz_to_ml',30):s.unit==='tsp'?game.c('unit_tsp_to_ml',5):1;
 s.fluid=new Simulation({targetMl:s.target*unit,unitMl:unit,ingredient:s.ingredient});game.pourTool=toolForIngredient(s.ingredient);s.fluid.setTool(game.pourTool,s);}
const api={Simulation,init,nozzle,GRIP,containerSize,GLASS,STEP,POURER,toolForIngredient};if(typeof module!=='undefined')module.exports=api;root.LunaPour=api;
})(typeof window==='undefined'?globalThis:window);

/* Presentation-only adaptation. Never changes the simulation clock, sprite/UI
 * resolution, light energy, particle population, or water history. */
(function(W){'use strict';
class Budget{
 constructor(){this.reset();}
 reset(){this.tier=0;this.last=null;this.samples=[];this.cooldown=0;this.good=0;this.seconds=0;this.changes=0;}
 sample(now,{active=true,cpu=0,mode='auto'}={}){
  if(['high','balanced','economy'].includes(mode)){this.tier={high:0,balanced:1,economy:2}[mode];this.last=null;this.samples=[];return this.scale;}
  if(!active){this.last=null;this.samples=[];this.good=0;return this.scale;}
  const dt=this.last===null?0:now-this.last;this.last=now;
  // Loading, focus changes and debugging stalls are not sustained frame load.
  if(dt<=0||dt>250){this.samples=[];return this.scale;}
  this.seconds+=dt/1000;this.cooldown=Math.max(0,this.cooldown-dt/1000);
  this.samples.push({dt,cpu});if(this.samples.length<90)return this.scale;
  const rows=this.samples.splice(0),ordered=rows.map(v=>v.dt).sort((a,b)=>a-b),p75=ordered[Math.floor(ordered.length*.75)];
  const average=rows.reduce((n,v)=>n+v.dt,0)/rows.length,cost=rows.reduce((n,v)=>n+v.cpu,0)/rows.length;
  if(this.seconds<3||this.cooldown)return this.scale;
  if((average>23||p75>29)&&this.tier<2){this.tier++;this.changes++;this.cooldown=8;this.good=0;}
  else if(average<18.3&&p75<23&&cost<10&&this.tier>0){this.good+=rows.reduce((n,v)=>n+v.dt,0)/1000;if(this.good>=18){this.tier--;this.changes++;this.cooldown=12;this.good=0;}}
  else this.good=0;
  return this.scale;
 }
 get scale(){return [1,.75,.5][this.tier];}
 snapshot(){return {tier:this.tier,scale:this.scale,changes:this.changes};}
}
W.LunaStreetRenderBudget=Budget;
})(typeof window==='undefined'?globalThis:window);

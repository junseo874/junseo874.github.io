/* FX_Carbonated_02.gif reference: a single rising cluster of hollow amber
 * bubbles, not white foam/spray. Native bottle coordinates relative to the cap.
 * The reference repeats its demonstration; each successful opening plays once. */
(function(){
 'use strict';
 const duration=2.05,clamp=n=>Math.max(0,Math.min(1,n));
 const random=n=>{const v=Math.sin(n*127.1+63.7)*43758.5453;return v-Math.floor(v);};
 const outline=[[-8,5],[9,5],[9,53],[17,69],[20,83],[20,151],[-19,151],[-19,83],[-16,70],[-8,53]];
 function width(y){return y<53?8:y<83?8+(y-53)*.36:19;}
 function sample(age,still=false){
  if(age<0||age>=duration)return [];
  const t=Math.floor(age*15)/15,particles=[];
  for(let i=0;i<44;i++){
   const birth=.06+random(i+2)*.52,life=.91+random(i+38)*.28,u=(t-birth)/life;
   if(u<=0||u>=1)continue;
   const progress=still?.48:u,y=109-progress*76;
   const lane=(random(i+71)*2-1)*.85,x=lane*(width(y)-2)+Math.sin(progress*5+i)*.55;
   particles.push({x,y,r:.7+random(i+107)*1.05,alpha:clamp(u*7)*clamp((1-u)*5)*(.24+random(i+13)*.22),i});
  }
  return particles;
 }
 function draw(ctx,age,still=false){
  const particles=sample(age,still);if(!particles.length)return 0;
  ctx.save();ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  // The body label is opaque paper in front of the liquid, not bubbling glass.
  ctx.beginPath();ctx.rect(-30,0,60,160);ctx.moveTo(-21,89);ctx.lineTo(21,85);ctx.lineTo(21,160);ctx.lineTo(-21,160);ctx.closePath();ctx.clip('evenodd');
  ctx.lineWidth=.32;ctx.lineJoin='miter';
  for(const p of particles){
   const x=Math.round(p.x*2)/2,y=Math.round(p.y*2)/2,r=p.r;
   ctx.globalAlpha=p.alpha;ctx.strokeStyle='#e2bb75';ctx.beginPath();
   // Slightly irregular, low-resolution rings match the supplied pixel artwork.
   const points=[[-.55,-.72],[.5,-.72],[1,-.2],[.86,.46],[.36,.8],[-.48,.72],[-1,.22],[-.9,-.35]];
   points.forEach(([dx,dy],i)=>i?ctx.lineTo(x+dx*r,y+dy*r):ctx.moveTo(x+dx*r,y+dy*r));ctx.closePath();ctx.stroke();
   ctx.globalAlpha=p.alpha*.6;ctx.fillStyle='#f6dda1';ctx.fillRect(x-r*.45,y-r*.72,r*.7,.25);
  }
  ctx.restore();return particles.length;
 }
 window.LunaOpenCarbonation={duration,sample,draw};
})();

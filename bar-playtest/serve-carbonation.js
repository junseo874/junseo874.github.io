/* Reference: FX_Carbonated_Beer_01.gif (~15 fps). Keep the supplied drink art intact.
 * Coordinates are in each final sprite's native pixels, not a rectangular particle box.
 * Bubbles stay inside the liquid; condensation belongs to the front of the glass. */
(function(){
 // Final frame of the current 954×539 full-screen drink layers.
 const transform=[0,0,1280/954,720/539];
 const profiles={
  gin_tonic:{transform,count:32,top:172,bottom:386,
   outline:[[413,165],[553,168],[550,365],[535,389],[447,389],[428,370],[426,305],[416,260]],
   // Rosemary/lime sit in front of the liquid: do not paint bubbles over the garnish.
   garnish:[[474,145],[560,130],[556,188],[520,207],[486,259],[472,244]],
   beads:[[425,203],[448,256],[465,327],[540,239],[530,302],[440,354],[512,366]],
   drops:[[435,226],[535,277],[464,305]]},
  gin_fizz:{transform,count:28,top:180,bottom:396,
   outline:[[414,172],[553,172],[548,380],[530,401],[445,401],[427,380],[425,310],[413,253]],
   garnish:[[513,256],[551,254],[541,312],[498,346],[492,332]],
   beads:[[428,203],[446,250],[475,345],[539,221],[531,368],[452,380],[510,388]],
   drops:[[437,224],[535,328],[470,301]]},
  bottle_beer:{transform,count:34,top:201,bottom:357,
   outline:[[420,200],[550,200],[537,276],[523,359],[458,359],[456,335],[456,318],[447,294],[447,284],[432,260]],
   beads:[[435,220],[462,254],[536,227],[485,322],[520,332],[468,342],[512,278]],
   drops:[[448,235],[528,270],[478,300]]}
 };
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const fract=n=>n-Math.floor(n);
 const random=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
 function span(polygon,y){
  const hits=[];
  polygon.forEach(([x1,y1],i)=>{const [x2,y2]=polygon[(i+1)%polygon.length];
   if((y1<=y&&y2>y)||(y2<=y&&y1>y))hits.push(x1+(y-y1)*(x2-x1)/(y2-y1));});
  return hits.length?[Math.min(...hits),Math.max(...hits)]:[0,0];
 }
 function path(ctx,points){ctx.moveTo(...points[0]);for(const pt of points.slice(1))ctx.lineTo(...pt);ctx.closePath();}
 // Pure samples also let the regression test check direction, limits and determinism.
 function sample(id,seconds){
  const p=profiles[id];if(!p)return null;
  const time=Math.floor(Math.max(0,seconds)*15)/15;
  const bubbles=Array.from({length:p.count},(_,i)=>{
   const speed=24+random(i+4)*22,travel=p.bottom-p.top;
   const phase=fract(random(i+31)+time*speed/travel),y=p.bottom-phase*travel;
   const [left,right]=span(p.outline,y),lane=.08+random(i+87)*.84;
   const x=left+(right-left)*lane+Math.sin(time*1.8+i)*.75;
   return {x,y,r:i%7===0?1.1:.5+random(i+61)*.4,
    alpha:(.36+random(i+94)*.36)*clamp(phase*12)*clamp((1-phase)*10)};
  });
  const drops=p.drops.map(([x,y],i)=>{
   const phase=fract(time/(4.6+i*.9)+i*.31);
   const sliding=clamp((phase-.47)/.34),distance=sliding*sliding*(20+i*5);
   return {x,y:y+distance,startY:y,length:sliding*3.5,
    r:.65+clamp(phase/.47)*.75,alpha:clamp(phase*8)*clamp((1-phase)*7)};
  });
  return {time,bubbles,drops};
 }
 function draw(canvas,id,seconds,transform){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const p=profiles[id],s=sample(id,seconds);
  if(!p||seconds<0){canvas.dataset.active='false';return;}
  canvas.dataset.active='true';canvas.dataset.time=String(s.time);canvas.dataset.cocktail=id;
  ctx.save();const [x,y,scale,scaleY=scale]=transform||p.transform;ctx.translate(x,y);ctx.scale(scale,scaleY);
  ctx.globalAlpha=clamp(seconds/.6);ctx.imageSmoothingEnabled=false;
  const fade=ctx.globalAlpha;
  ctx.save();ctx.beginPath();path(ctx,p.outline);ctx.clip();
  if(p.garnish){ctx.beginPath();ctx.rect(-2000,-2000,4000,4000);path(ctx,p.garnish);ctx.clip('evenodd');}
  for(const b of s.bubbles){
   ctx.globalAlpha=fade*b.alpha;ctx.fillStyle='#fffde4';
   // Tiny pixel dots, with a hollow highlight only on the occasional larger bubble.
   const bx=Math.round(b.x),by=Math.round(b.y);
   if(b.r>1){ctx.strokeStyle='#fffde4';ctx.lineWidth=.65;ctx.beginPath();ctx.arc(bx,by,1.45,0,Math.PI*2);ctx.stroke();}
   else ctx.fillRect(bx-.1,by-.1,1.2,b.r>.8?2.3:1.2);
  }
  ctx.restore();ctx.save();ctx.beginPath();path(ctx,p.outline);ctx.clip();
  function bead(x,y,r,alpha,length=0){
   x=Math.round(x);y=Math.round(y);ctx.globalAlpha=fade*alpha;r*=1.15;
   // A subdued lower edge and a warm-white highlight read as water, not glitter.
   ctx.strokeStyle='rgba(104,94,57,.28)';ctx.lineWidth=.8;
   ctx.beginPath();ctx.ellipse(x+.4,y+.7,r,r+length*.28,0,0,Math.PI*2);ctx.stroke();
   if(length){ctx.fillStyle='rgba(255,255,234,.22)';ctx.fillRect(x,y-length-2,.8,length+1);}
   ctx.fillStyle='rgba(255,255,239,.8)';ctx.fillRect(x-1,y-1,1.15,2.3+length*.25);
   ctx.fillStyle='rgba(255,255,239,.3)';ctx.fillRect(x,y,1,1);
  }
  p.beads.forEach(([bx,by],i)=>bead(bx,by,.75+(i%3)*.2,.52));
  s.drops.forEach(d=>bead(d.x,d.y,d.r,d.alpha,d.length));
  ctx.restore();ctx.restore();
 }
 window.LunaServeCarbonation={profiles,sample,draw};
})();

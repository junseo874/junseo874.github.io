/* Reference: FX_Carbonated_Beer_01.gif (~15 fps). Keep the supplied drink art intact.
 * Coordinates are in each final sprite's native pixels, not a rectangular particle box.
 * Bubbles stay inside the liquid; condensation belongs to the front of the glass. */
(function(){
 // Final frame of the current 954×539 full-screen drink layers.
 const transform=[0,0,1280/954,720/539];
 // The current gin tonic/fizz uploads share the sunrise artwork. Keep FX in
 // the visible liquid and out of the ice, garnish and glove on these source files.
 const tall={transform,count:28,top:258,bottom:378,
  outline:[[413,255],[548,255],[545,293],[538,300],[535,318],[525,329],[525,344],[514,357],[514,370],[521,378],[438,378],[430,365],[423,335],[418,295]],
  beads:[[428,278],[450,301],[480,344],[531,277],[509,316],[452,367],[496,371]],
  drops:[[437,275],[504,303],[467,333]]};
 const profiles={
  gin_tonic:{...tall,count:32},gin_fizz:{...tall},
  bottle_beer:{transform,count:34,top:200,bottom:356,
   outline:[[410,198],[547,198],[540,231],[532,257],[523,271],[523,284],[508,302],[501,316],[501,326],[483,337],[483,345],[498,349],[502,358],[449,358],[442,331],[434,300],[424,267],[416,234]],
   beads:[[422,215],[448,258],[531,218],[478,320],[510,282],[460,342],[480,267]],
   drops:[[430,233],[511,259],[462,300]]}
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

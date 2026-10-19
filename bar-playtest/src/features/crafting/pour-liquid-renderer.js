/* Engine-video reference: coherent falling ribbon, local surface impact,
   clear soda fizz, persistent beer head and subsurface aeration. Canvas pixels
   only: no gameplay RNG, extra liquid, image assets or frame-dependent timers. */
(function(W){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pixel=v=>Math.round(v/2)*2;
const noise=n=>{const v=Math.sin(n*127.1+19.7)*43758.5453;return v-Math.floor(v);};
const rgba=(rgb,a)=>'rgba('+rgb.join(',')+','+clamp(a,0,1)+')';
function surfaceAt(f,x){
 const b=f.glass,u=clamp((x-b.left-3)/(b.right-b.left-6),0,1)*(f.surface.length-1),i=Math.floor(u);
 const wave=f.surface[i]+(f.surface[Math.min(i+1,f.surface.length-1)]-f.surface[i])*(u-i);
 const depth=b.bottom-3-f.surfaceY,local=x-f.impactX;
 const trough=f.impact*(5*Math.exp(-local*local/85)-2.2*Math.exp(-((Math.abs(local)-17)**2)/120));
 return clamp(f.surfaceY+(wave+trough)*Math.min(1,depth/10),b.top+1,b.bottom-3);
}
function liquidPath(ctx,f){const b=f.glass;ctx.beginPath();ctx.moveTo(b.left+3,b.bottom);for(let x=b.left+3;x<=b.right-3;x+=2)ctx.lineTo(x,pixel(surfaceAt(f,x)));ctx.lineTo(b.right-3,b.bottom);ctx.closePath();}
function plume(ctx,f,style){
 const b=f.glass,depth=b.bottom-f.surfaceY,beer=f.material.kind==='beer';
 if(depth<6||(!beer&&f.impact<.02))return;
 // Low-resolution density field: soft rolling light inside beer, a much
 // subtler entrained jet in clear liquids. Never a uniform white rectangle.
 const strength=beer?.13+f.impact*.2:f.impact*(f.material.kind==='juice'?.055:.11);
 const upper=beer?f.surfaceY:b.bottom-Math.min(depth,55+f.impact*depth);
 for(let y=Math.max(b.top,upper);y<b.bottom-3;y+=3){
  const v=(y-f.surfaceY)/Math.max(1,depth),width=7+v*16;
  const center=f.impactX+Math.sin(v*9-f.time*2.6)*width*.65;
  for(let x=b.left+4;x<b.right-4;x+=3){
   const jet=Math.exp(-(((x-center)/width)**2)),roll=beer?Math.pow(Math.max(0,Math.sin(x*.067+v*12+f.time*1.8)),3)*.36:0;
   const density=(jet*(.3+v*.7)+roll)*strength*(.65+.35*Math.sin(v*17-f.time*3));
   if(density>.018){ctx.fillStyle=rgba(beer?[255,241,192]:style.rgb,density);ctx.fillRect(x,y,3,3);}
  }
 }
}
function bubbles(ctx,f,style){
 const b=f.glass,depth=b.bottom-f.surfaceY;if(depth<3||!f.material.bubbles)return;
 const beer=f.material.kind==='beer',count=Math.min(f.material.bubbles,Math.ceil(depth*(beer?.9:.6))),color=style.bubble||'#d7f7ff';
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;
 for(let i=0;i<count;i++){
  const seed=noise(i+3),phase=(f.time*(.11+noise(i+31)*.2)+noise(i+91))%1;
  const lane=b.left+8+seed*(b.right-b.left-20),x=pixel(lane+Math.sin(f.time*2+i)*1.5),y=pixel(b.bottom-4-phase*depth);
  const size=phase>.45&&i%3===0?4:2;
  ctx.globalAlpha=(beer?.7:.55)+phase*.23;
  if(size>2){ctx.strokeRect(x,y,size,size);ctx.fillRect(x,y,1,1);}else ctx.fillRect(x,y,size,size);
 }
 ctx.globalAlpha=1;
}
function foam(ctx,f,style){
 const b=f.glass,kind=f.material.kind,beer=kind==='beer',height=f.foamHeight();
 if(height<.25)return;
 const topAt=x=>surfaceAt(f,x)-height+(beer?Math.sin(x*.7+f.time*.7)*1.2:0);
 ctx.save();ctx.beginPath();
 for(let x=b.left+3;x<=b.right-3;x+=2){const y=pixel(topAt(x));if(x===b.left+3)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 for(let x=b.right-3;x>=b.left+3;x-=2)ctx.lineTo(x,pixel(surfaceAt(f,x)+1));
 ctx.closePath();ctx.fillStyle=style.foam||'#e7f4f7';ctx.globalAlpha=beer?.96:kind==='cola'?.72:.38;ctx.fill();ctx.clip();
 for(let i=0;i<Math.min(180,Math.ceil(height*9));i++){
  const x=pixel(b.left+4+noise(i+100)*(b.right-b.left-9)),y=pixel(topAt(x)+noise(i+300)*(height+2));
  ctx.globalAlpha=beer?.36:.2;ctx.fillStyle=i%3===0?(style.shade||'#9cbfc9'):(style.highlight||'#fff');
  ctx.fillRect(x,y,i%4===0?4:2,2);
 }
 ctx.restore();
}
function drawLiquid(ctx,s,style){
 const f=s.fluid,b=f.glass;if(f.liquidMl<.02)return;
 ctx.save();ctx.beginPath();ctx.rect(b.left+3,b.top,b.right-b.left-6,b.bottom-b.top-3);ctx.clip();
 liquidPath(ctx,f);ctx.save();ctx.clip();
 const grad=ctx.createLinearGradient(0,f.surfaceY,0,b.bottom);
 grad.addColorStop(0,rgba(style.rgb,style.alpha));grad.addColorStop(1,rgba(style.rgb.map(c=>Math.round(c*.77)),Math.min(1,style.alpha+.1)));
 ctx.fillStyle=grad;ctx.fillRect(b.left+3,b.top,b.right-b.left-6,b.bottom-b.top);
 plume(ctx,f,style);bubbles(ctx,f,style);ctx.restore();
 // A narrow meniscus follows the actual deformed surface, never a separate
 // sine-wave stripe floating above a flat rectangular fill.
 ctx.fillStyle=style.highlight||rgba(style.rgb.map(c=>Math.min(255,c+45)),.8);
 ctx.globalAlpha=f.material.kind==='soda'?.78:.48;
 for(let x=b.left+3;x<b.right-3;x+=2)ctx.fillRect(x,pixel(surfaceAt(f,x)),2,f.material.kind==='soda'?2:1);
 ctx.globalAlpha=1;foam(ctx,f,style);
 if(f.material.bubbles){
  ctx.fillStyle=style.bubble||'#e3faff';
  for(let i=0;i<9;i++){
   const u=(f.time*(.65+noise(i+25)*.3)+noise(i+70))%1;if(u>.24)continue;
   const x=b.left+8+noise(i+80)*(b.right-b.left-16),y=surfaceAt(f,x)-f.foamHeight()-u*13;
   ctx.globalAlpha=(1-u/.24)*.75;
   ctx.fillRect(pixel(x-2-u*15),pixel(y),2,2);ctx.fillRect(pixel(x+2+u*15),pixel(y),2,2);
  }
 }
 ctx.restore();
}
function drawStream(ctx,s,style){
 const f=s.fluid,groups=[];let group=[];
 for(const p of f.particles){const previous=group.at(-1);if(previous&&(p.id!==previous.id+1||Math.hypot(p.x-previous.x,p.y-previous.y)>42)){groups.push(group);group=[];}group.push(p);}if(group.length)groups.push(group);
 ctx.save();
 // Above the rim the incoming stream is free. Below it every ribbon edge,
 // rounded pixel and highlight must stay inside the same cavity as the fill.
 const b=f.glass;
 ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,b.top);ctx.rect(b.left+3,b.top,b.right-b.left-6,b.bottom-b.top-3);ctx.clip();
 for(const points of groups){
  // One filled ribbon per continuous parcel group avoids translucent blocks
  // piling up at joins. Detached trailing groups remain genuine falling drops.
  const nodes=points.map(p=>({x:pixel(p.x),y:pixel(p.y),w:Math.max(2,((f.tool==='none'||f.popped?5:3)+p.emissionFlow*2)*f.material.stream*(1-.22*Math.min(1,p.age)))}));
  if(points[0].entered&&Math.abs(points[0].y-surfaceAt(f,points[0].x))<22){nodes.unshift({x:pixel(points[0].x),y:pixel(surfaceAt(f,points[0].x)-f.foamHeight()*.5),w:nodes[0].w});}
  ctx.beginPath();nodes.forEach((p,i)=>i?ctx.lineTo(pixel(p.x-p.w/2),p.y):ctx.moveTo(pixel(p.x-p.w/2),p.y));
  for(let i=nodes.length-1;i>=0;i--)ctx.lineTo(pixel(nodes[i].x+nodes[i].w/2),nodes[i].y+2);
  ctx.closePath();ctx.fillStyle=rgba(style.rgb,Math.max(.62,style.alpha));ctx.fill();
  ctx.beginPath();nodes.forEach((p,i)=>i?ctx.lineTo(p.x-1,p.y):ctx.moveTo(p.x-1,p.y));
  ctx.strokeStyle=style.highlight||rgba(style.rgb.map(c=>Math.min(255,c+50)),.45);ctx.globalAlpha=.3;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
 }
 ctx.fillStyle=style.highlight||rgba(style.rgb,.85);
 ctx.beginPath();ctx.rect(b.left+3,0,b.right-b.left-6,b.bottom-3);ctx.clip();
 for(const p of f.splash){ctx.globalAlpha=clamp(p.life/.2,0,1)*.75;ctx.fillRect(pixel(p.x),pixel(p.y),2,Math.abs(p.vy)>70?4:2);}
 ctx.restore();
}
function drawOverflow(ctx,s,style){
 const f=s.fluid,b=f.glass,drops=f.overflowDrops||[];if(!drops.length)return;
 ctx.save();
 // The only permitted escape is over the lip, then DOWN THE OUTSIDE.
 // Interior waves/stream remain clipped; no holes in the walls or base.
 ctx.beginPath();ctx.rect(b.left-35,b.top-5,38,b.bottom-b.top+17);ctx.rect(b.right-3,b.top-5,38,b.bottom-b.top+17);ctx.clip();
 for(const side of [-1,1]){
  const edge=side<0?b.left:b.right,points=drops.filter(p=>p.side===side).sort((a,b)=>a.y-b.y);
  if(f.overflowRate>.5){
   ctx.fillStyle=rgba(style.rgb,Math.max(.6,style.alpha));
   ctx.fillRect(edge-3,b.top-2,6,5);
   if(f.foamHeight()>2){ctx.fillStyle=style.foam||'#fff1cd';ctx.fillRect(edge-3,b.top-3,6,4);}
  }
  let prev=null;
  for(const p of points){
   const width=p.foam>.03?6:4,x=pixel(p.x)+side*Math.round(Math.sin(p.age*9+p.id*.25)),y=pixel(p.y);
   const alpha=Math.min(1,(b.bottom+12-y)/22),from=prev&&y-prev.y<19?prev.y:y-2;
   ctx.globalAlpha=alpha;ctx.fillStyle=rgba(style.rgb,Math.max(.64,style.alpha));ctx.fillRect(x-width/2,from,width,Math.max(3,y-from+2));
   ctx.globalAlpha=alpha*.65;ctx.fillStyle=style.highlight||'#d7faff';ctx.fillRect(x-1,from,2,Math.max(2,y-from));
   if(p.foam>.03){ctx.globalAlpha=alpha*.9;ctx.fillStyle=style.foam||'#fff1cd';ctx.fillRect(x-width/2,y-2,width,4);ctx.fillStyle=style.shade||'#cbbd88';ctx.fillRect(x+1,y,2,2);}
   else if(f.carbonated&&p.id%3===0){ctx.globalAlpha=alpha*.85;ctx.fillStyle=style.bubble||'#e3faff';ctx.fillRect(x-1,y-2,2,2);}
   prev={x,y};
  }
 }
 ctx.restore();
}
W.LunaPourLiquid={drawLiquid,drawStream,drawOverflow,surfaceAt};
})(window);

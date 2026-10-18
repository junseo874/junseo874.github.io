/* Local-pixel display masks, never a full-screen post-process.
 * Insets exclude frames; perspective panels use four-point masks.
 * Source PNGs, printed boards, windows and free-standing neon logos stay intact. */
(function(W){'use strict';
const rect=(id,x,y,w,h)=>({id,points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
const quad=(id,...points)=>({id,points});
const masks={
 B_Fore_Building_1:[
  // Screenshot exclusions: BS25, purple ad, Terraco, vertical restaurant
  // board, hanging restaurant menu and right-hand shop display/phone number remain unprocessed.
  rect('ford-main',499,210,102,22),rect('ford-tv',610,210,40,22),
  rect('restaurant-display',778,121,146,24),
  rect('open',1128,243,20,8)
 ],
 // Coordinates are native pixels of the 2880px midground atlas.
 C_Middle_Building_1:[
  rect('left-vertical',315,334,38,143),quad('left-small',[304,535],[361,551],[361,579],[304,563]),
  rect('left-wide',680,512,139,44),rect('bottom-wide',343,624,176,50),
  rect('neon-soda',1106,277,119,42),
  rect('cathedral-friends',1474,291,79,46),rect('x-ad',1355,418,96,54),
  // The blue portrait board and small green strip are also excluded.
  rect('bottle-ad',1642,360,38,101),
  rect('pig-ad',2002,409,60,68),rect('vertical-pink',2129,468,15,114),
  rect('portrait-small',1654,580,32,78),rect('upper-empty',2243,257,121,36),
  rect('upper-right',2581,214,100,33),quad('side-orange',[2545,327],[2575,311],[2575,429],[2545,444]),
  rect('face-right',2601,301,81,112),rect('right-vertical',2422,346,20,83)
 ],
 C_Middle_Building_2:[
  rect('left-display',14,228,62,26),rect('left-tall',788,253,34,131),
  rect('right-tall',969,253,30,132),rect('middle-ad',1707,229,61,27),
  rect('x-display',1865,338,78,54),rect('face-display',2098,294,29,67),
  rect('pig-display',2372,329,46,54),rect('top-right-title',2657,132,94,31),
  rect('right-edge-vertical',2796,206,17,65)
 ],
 C_Middle_Building_3:[
  rect('silhouette',37,781,112,189),rect('woman',175,997,120,340),
  quad('spiral-screen',[598,1020],[680,1034],[694,1134],[598,1117])
 ],
 terrace:[
  // City art is already flattened: omit screens occluded by its foreground
  // rooftops and the far-right facade. One visible display = one phase/mask.
  rect('upper-left-ad',227,9,18,45),rect('upper-portrait',252,25,39,32),
  quad('upper-slanted',[298,35],[320,23],[320,42],[298,50]),
  rect('portrait-left',197,55,23,63),rect('pink-small',227,68,21,47),
  quad('small-slanted',[292,68],[313,60],[313,87],[292,95]),
  rect('blue-face',274,110,17,23),
  quad('woman-right',[355,46],[370,51],[374,141],[355,136])
 ]
};
const cache=new Map();
function bounds(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return{x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};}
function render(key,time=0,still=false){
 const regions=masks[key];if(!regions)return null;
 let entry=cache.get(key);
 if(!entry){const b=bounds(regions.flatMap(r=>r.points)),canvas=document.createElement('canvas');canvas.width=b.right-b.x;canvas.height=b.bottom-b.y;entry={canvas,x:b.x,y:b.y,stamp:null};cache.set(key,entry);}
 const terrace=key==='terrace';
 const stamp=still?0:Math.floor(Math.max(0,time)*12)+1;if(entry.stamp===stamp)return entry;
 entry.stamp=stamp;const t=still?0:(stamp-1)/12,ctx=entry.canvas.getContext('2d');
 ctx.clearRect(0,0,entry.canvas.width,entry.canvas.height);ctx.save();ctx.translate(-entry.x,-entry.y);
 regions.forEach((r,index)=>{
  const b=bounds(r.points),h=b.bottom-b.y,w=b.right-b.x,phase=index*.73;
  ctx.save();ctx.beginPath();r.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  // A calm moving raster, not brightness flicker or horizontal distortion.
  const step=key==='C_Middle_Building_3'?4:3,shift=still?0:Math.floor(t*5+phase)%step;
  ctx.fillStyle=terrace?'rgba(3,8,19,.09)':'rgba(3,8,19,.16)';
  for(let y=b.y-step+shift;y<b.bottom;y+=step)ctx.fillRect(b.x,y,w,1);
  ctx.fillStyle=terrace?'rgba(211,235,249,.02)':'rgba(211,235,249,.035)';
  for(let y=b.y-step+shift+1;y<b.bottom;y+=step)ctx.fillRect(b.x,y,w,1);
  if(!still){
   const band=Math.max(3,Math.min(12,h*.16)),speed=Math.max(4,h/5),cy=b.y+((t*speed+phase*13)%(h+band*2))-band;
   for(let i=0;i<band;i++){ctx.fillStyle='rgba(211,235,249,'+((terrace ? .035 : .065)*Math.sin(Math.PI*i/band))+')';ctx.fillRect(b.x,Math.floor(cy+i),w,1);}
  }
  ctx.restore();
 });ctx.restore();return entry;
}
function paintSprite(ctx,key,sp,width,height,time,still){
 const e=render(key,time,still);if(!e)return;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
 const sx=width/sp.w,sy=height/sp.h;
 ctx.drawImage(e.canvas,-width*sp.pivot.x+(e.x-sp.x)*sx,-height*(1-sp.pivot.y)+(e.y-sp.y)*sy,e.canvas.width*sx,e.canvas.height*sy);ctx.restore();
}
function paintTerrace(host,time){
 const target=host.querySelector('.terrace-sign-scanlines');if(!target)return;
 const e=render('terrace',time,W.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 if(target.dataset.stamp===String(e.stamp))return;
 const ctx=target.getContext('2d');ctx.clearRect(0,0,480,270);ctx.drawImage(e.canvas,e.x,e.y);target.dataset.stamp=String(e.stamp);
}
W.LunaSignScanlines={masks,render,paintSprite,paintTerrace};
})(window);

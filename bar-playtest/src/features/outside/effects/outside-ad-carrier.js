/* A slow world-space advertising carrier. The chassis is preloaded with street
 * art; the small LED canvas is reused, never fetched/rebuilt as an ad changes. */
(function (W) {
'use strict';
const assetId = 'street-ad-carrier';
const asset = Object.freeze({src:'assets/outside/vehicles/ad-carrier.png',w:1983,h:793,source:'AI-generated original sprite · user vehicle/display references · 2026-10-23'});
const artAssets = Object.freeze({
  'street-ad-violet':{src:'assets/outside/vehicles/ad-portrait-violet.png',w:2172,h:724,source:'AI-generated original adult portrait · user neon billboard references'},
  'street-ad-crimson':{src:'assets/outside/vehicles/ad-portrait-crimson.png',w:2172,h:724,source:'AI-generated original adult portrait · user neon billboard references'}
});
const interval = 5, travelRate = .75;
const ads = Object.freeze([
  {title:'KORATECH',subtitle:'CONNECT YOUR WORLD',color:'#9ed9f4',back:'#211443',kind:'data',art:'street-ad-violet',copyX:6,copyW:70},
  {title:'UNKNOWN',subtitle:'BAR / OPEN TONIGHT',color:'#f5b5c7',back:'#380e24',kind:'bar',art:'street-ad-crimson',copyX:70,copyW:59},
  {title:'PORT',subtitle:'REPAIR / RECOVER',color:'#b9c9ff',back:'#181138',kind:'repair',copyX:66,copyW:61}
]);
// Beyond the full street bounds (-22.25..6.55), including hull/parallax margin.
const flightBounds = Object.freeze({left:-24,right:10});
const flightSpan = flightBounds.right-flightBounds.left;
const routes = Object.freeze([
  {id:'lower',direction:1,duration:112*flightSpan/29,phase:31+5*112/29,y:2.55,width:1.9},
  {id:'upper',direction:-1,duration:124*flightSpan/29,phase:52,y:7.5,width:1.61}
]);
// In front of the middle-city displays, behind street/residence foreground. Opaque blue-toned shading,
// never from letting buildings show through the hull or LED panel.
const depth = Object.freeze({parallax:[.9,.93],alpha:1});
function apply(data) { if(data?.assets)Object.assign(data.assets,{[assetId]:asset},artAssets); }
function adState(time) {
  const t=Math.max(0,Number(time)||0),step=Math.floor(t/interval),age=t-step*interval;
  return {index:step%ads.length,age};
}
function vehicles(m) {
  if(!m||m.qa||m.scene!=='street')return [];
  const time=Math.max(0,Number(m.time)||0);
  return routes.map(r=>{
    // Wrap only beyond the world edge, with no idle/despawn interval. The
    // camera never controls this clock, and ads keep their independent timer.
    const clock=time*travelRate+r.phase,cycle=Math.floor(clock/r.duration),age=clock-cycle*r.duration;
    return {id:r.id+':'+cycle,direction:r.direction,
      x:r.direction===1?flightBounds.left+age/r.duration*flightSpan:flightBounds.right-age/r.duration*flightSpan,
      y:r.y+Math.sin(time*.65+r.phase)*.012,width:r.width,
      alpha:1,ad:adState(time)};
  });
}
let canvas,ctx,chassis,source,stamp;
const posters=new Map();
// Keep the authored LED layout in logical units, not a destructive 320px bitmap.
const layout=Object.freeze({w:320,h:148,extension:20});
const rasterScale=4, rasterWidth=layout.w*rasterScale, rasterHeight=layout.h*rasterScale;
const panel=Object.freeze({x:115,y:55,w:134,h:56}); // extended center, unchanged orange corners
function prepare(image) {
  if(source===image)return;
  source=image;stamp=undefined;
  const original=document.createElement('canvas');original.width=image.naturalWidth;original.height=image.naturalHeight;
  const originalCtx=original.getContext('2d');originalCtx.drawImage(image,0,0);
  // The generated source has alpha 253 even inside solid metal. Correct only
  // near-opaque texels in this render cache; keep the transparent silhouette/AA.
  const pixels=originalCtx.getImageData(0,0,original.width,original.height);
  for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]>=250)pixels.data[i]=255;
  originalCtx.putImageData(pixels,0,0);
  chassis=document.createElement('canvas');chassis.width=rasterWidth;chassis.height=rasterHeight;
  const c=chassis.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  // Extend only a straight middle strip. Roof, antennae, bezel corners and
  // lower thrusters keep their original proportions instead of stretching all art.
  const strip=(sy,sh,dy,dh)=>c.drawImage(original,0,sy/128*original.height,original.width,sh/128*original.height,0,dy*rasterScale,rasterWidth,dh*rasterScale);
  strip(0,70,0,70);strip(70,8,70,8+layout.extension);strip(78,50,78+layout.extension,50);
  // Tint only existing hull pixels, preserving both opaque surfaces and cutout
  // edges. No source asset edits, opacity fade, or per-frame image processing.
  c.save();c.globalCompositeOperation='source-atop';c.fillStyle='rgba(18,32,49,.16)';
  c.fillRect(0,0,rasterWidth,rasterHeight);c.restore();
  canvas=document.createElement('canvas');canvas.width=rasterWidth;canvas.height=rasterHeight;ctx=canvas.getContext('2d');
  ctx.setTransform(rasterScale,0,0,rasterScale,0,0);
}
function preparePosters(images) {
  if(!images)return;
  for(const ad of ads){
    const image=ad.art&&images.get(ad.art);if(!image||posters.get(ad.art)?.image===image)continue;
    const art=document.createElement('canvas');art.width=panel.w*rasterScale;art.height=panel.h*rasterScale;
    const c=art.getContext('2d'),scale=Math.max(art.width/image.naturalWidth,art.height/image.naturalHeight);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(image,(art.width-image.naturalWidth*scale)/2,(art.height-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
    // Restrain printed whites to the street's night exposure, without transparency.
    c.fillStyle='rgba(9,16,35,.18)';c.fillRect(0,0,art.width,art.height);
    posters.set(ad.art,{image,art});stamp=undefined;
  }
}
function paintEmblem(c,time){
  c.save();c.translate(32,25+Math.sin(time*1.3)*.55);
  // A three-lobed luminous recovery emblem, inspired by the supplied purple sign.
  for(let i=0;i<3;i++){
    c.save();c.rotate(i*Math.PI*2/3+Math.sin(time*.7)*.035);
    const glow=c.createLinearGradient(0,-22,0,8);glow.addColorStop(0,'#cddaf9');glow.addColorStop(.5,'#797fdf');glow.addColorStop(1,'#d45ca7');
    c.fillStyle=glow;c.strokeStyle='#9f7ae9';c.lineWidth=.6;
    c.beginPath();c.moveTo(0,-23);c.bezierCurveTo(13,-9,12,2,0,7);c.bezierCurveTo(-12,2,-13,-9,0,-23);c.fill();c.stroke();
    c.fillStyle='#241b4c';c.beginPath();c.ellipse(0,-5,3,8,0,0,Math.PI*2);c.fill();c.restore();
  }
  c.fillStyle='#e596c8';c.beginPath();c.arc(0,0,2.2,0,Math.PI*2);c.fill();c.restore();
}
function paintAd(c,index,time) {
  const ad=ads[index],poster=posters.get(ad.art);c.save();c.translate(panel.x,panel.y);
  c.fillStyle=ad.back;c.fillRect(0,0,panel.w,panel.h);
  if(poster)c.drawImage(poster.art,0,0,panel.w,panel.h);
  else if(ad.kind==='repair'){
    c.fillStyle='#312268';c.fillRect(4,0,1,panel.h);c.fillRect(58,0,1,panel.h);
    c.fillStyle='#8971d0';c.fillRect(5,0,.4,panel.h);c.fillRect(57,0,.4,panel.h);
    for(let i=0;i<8;i++){c.fillStyle=i%2?'#4e477d':'#32566a';c.fillRect(8+i*6,38+(i%3)*2,3,1);}
    paintEmblem(c,time);
  }
  // Color breathing echoes the reference silhouette sign without flashing or
  // moving/scaling the entire portrait. Advertisement changes remain hard cuts.
  c.save();c.globalCompositeOperation='soft-light';c.globalAlpha=.08+.07*Math.sin(time*2.1+index);
  c.fillStyle=index===1?'#ef315f':'#8a64cc';c.fillRect(0,0,panel.w,panel.h);c.restore();
  const x=ad.copyX,w=ad.copyW;
  c.textBaseline='top';c.textAlign='left';c.fillStyle=ad.color;
  c.font='4px monospace';c.fillText(index===0?'NEURAL / SERIES 09':index===1?'AFTER DARK / NIGHT CITY':'ELECTRONICS / DATA LAB',x,7,w);
  c.font='bold '+(index===2?18:12)+'px monospace';c.fillText(ad.title,x,index===2?15:19,w);
  c.fillStyle=index===0?'#c184db':index===1?'#e894b8':'#b27cd5';
  c.fillRect(x,35,w*.7,.6);c.font='4.5px monospace';c.fillText(ad.subtitle,x,39,w);
  // The small ticker moves inside the ad; the ad itself never slides away.
  c.fillStyle='rgba(9,9,25,.7)';c.fillRect(0,48,panel.w,8);
  c.save();c.beginPath();c.rect(3,49,panel.w-6,6);c.clip();c.font='3.5px monospace';c.fillStyle=ad.color;
  const ticker=ad.subtitle+'  /  '+ad.title+'  /  ',period=c.measureText(ticker).width;
  for(let tx=-(time*5%period);tx<panel.w;tx+=period)c.fillText(ticker,tx,50.5);
  c.restore();
  // Slow narrow refresh band plus fine RGB columns, never a broad white flash.
  const beam=(time*9)%72-8,g=c.createLinearGradient(0,beam,0,beam+7);
  g.addColorStop(0,'rgba(169,213,255,0)');g.addColorStop(.5,'rgba(169,213,255,.08)');g.addColorStop(1,'rgba(169,213,255,0)');
  c.fillStyle=g;c.fillRect(0,beam,panel.w,7);
  c.fillStyle='rgba(3,7,20,.24)';for(let y=0;y<panel.h;y+=1.75)c.fillRect(0,y,panel.w,.35);
  c.fillStyle='rgba(1,5,18,.15)';for(let x=0;x<panel.w;x+=1.5)c.fillRect(x,0,.25,panel.h);
  c.strokeStyle=ad.color;c.globalAlpha=.22;c.lineWidth=.5;c.strokeRect(.3,.3,panel.w-.6,panel.h-.6);
  c.restore();
}
function render(image,time,direction,still=false,images) {
  prepare(image);
  preparePosters(images);
  // At most 24 LED frames/sec regardless of host refresh rate. Stable when paused.
  const frame=still?0:Math.floor(Math.max(0,Number(time)||0)*24),key=frame+':'+direction+':'+still;
  if(stamp===key)return canvas;stamp=key;
  const t=frame/24,s=adState(t),mirrored=direction>0;
  ctx.clearRect(0,0,layout.w,layout.h);ctx.save();
  if(mirrored){ctx.translate(320,0);ctx.scale(-1,1);}
  ctx.drawImage(chassis,0,0,layout.w,layout.h);ctx.restore();
  // The sprite faces left. Mirror its hull only; screen lettering stays readable.
  const px=mirrored?320-panel.x-panel.w:panel.x;
  ctx.save();ctx.translate(px-panel.x,0);ctx.beginPath();ctx.rect(panel.x,panel.y,panel.w,panel.h);ctx.clip();
  // Hard cut at the 5-second boundary; no outgoing frame or sliding offset.
  paintAd(ctx,s.index,t);
  ctx.restore();
  // Tiny local running lights breathe; no broad bloom across buildings.
  ctx.fillStyle='rgba(103,193,206,'+(.18+.1*Math.sin(t*2))+')';
  ctx.fillRect(mirrored?274:37,99+layout.extension,12,1);ctx.fillRect(mirrored?19:289,99+layout.extension,9,1);
  return canvas;
}
function draw(c,m,cam,position,images) {
  const image=images?.get(assetId),list=vehicles(m);if(!image||!list.length)return;
  const still=!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const transform=c.getTransform();
  for(const v of list){
    const p=position(v.x+(cam.x+7.85)*(1-depth.parallax[0]),v.y+cam.y*(1-depth.parallax[1]));
    const width=v.width*1280/cam.w,height=width*layout.h/layout.w;
    if(p.x+width/2<0||p.x-width/2>1280||p.y+height/2<0||p.y-height/2>720)continue;
    // Align translation to physical pixels; keep world-space movement continuous.
    const x=(Math.round((p.x-width/2)*transform.a+transform.e)-transform.e)/transform.a;
    const y=(Math.round((p.y-height/2)*transform.d+transform.f)-transform.f)/transform.d;
    c.globalAlpha=v.alpha;c.drawImage(render(image,m.time,v.direction,still,images),x,y,width,height);
  }
  c.restore();
}
W.LunaOutsideAdCarrier={assetId,asset,artAssets,apply,vehicles,adState,ads,interval,travelRate,routes,flightBounds,depth,layout,panel,rasterScale,render,draw};
apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);

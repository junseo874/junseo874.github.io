/* A slow world-space advertising carrier. The chassis is preloaded with street
 * art; the small LED canvas is reused, never fetched/rebuilt as an ad changes. */
(function (W) {
'use strict';
const assetId = 'street-ad-carrier';
const asset = Object.freeze({src:'assets/outside/vehicles/ad-carrier.png',w:1983,h:793,source:'AI-generated original sprite · user vehicle/display references · 2026-10-23'});
const interval = 5, transition = .45, travelRate = .75;
const ads = Object.freeze([
  {title:'KORATECH',subtitle:'CONNECT YOUR WORLD',color:'#79c5d1',back:'#102634',kind:'data'},
  {title:'UNKNOWN',subtitle:'BAR / OPEN TONIGHT',color:'#d194c5',back:'#28182f',kind:'bar'},
  {title:'PORT',subtitle:'REPAIR / RECOVER',color:'#dbb477',back:'#30251b',kind:'repair'}
]);
const routes = Object.freeze([
  {id:'lower',direction:1,period:126,duration:112,phase:31,y:3.2,width:1.9},
  {id:'upper',direction:-1,period:142,duration:124,phase:52,y:8.15,width:1.61}
]);
// Between the far and near middle-city sheets. Opaque blue-toned shading,
// never from letting buildings show through the hull or LED panel.
const depth = Object.freeze({parallax:[.9,.93],alpha:1});
function apply(data) { if(data?.assets)data.assets[assetId]=asset; }
function adState(time) {
  const t=Math.max(0,Number(time)||0),step=Math.floor(t/interval),age=t-step*interval;
  return {index:step%ads.length,previous:(step+ads.length-1)%ads.length,age,
    mix:step===0?1:Math.min(1,age/transition)};
}
function vehicles(m) {
  if(!m||m.qa||m.scene!=='street')return [];
  const time=Math.max(0,Number(m.time)||0);
  return routes.flatMap(r=>{
    const clock=time*travelRate+r.phase,cycle=Math.floor(clock/r.period),age=clock-cycle*r.period;
    if(age>=r.duration)return [];
    return [{id:r.id+':'+cycle,direction:r.direction,
      x:r.direction===1?-19+age/r.duration*29:10-age/r.duration*29,
      y:r.y+Math.sin(time*.65+r.phase)*.012,width:r.width,
      alpha:1,ad:adState(time)}];
  });
}
let canvas,ctx,chassis,source,stamp;
const panel={x:115,y:55,w:134,h:36}; // measured inside the original orange bezel, in 320px canvas space
function prepare(image) {
  if(source===image)return;
  source=image;stamp=undefined;
  chassis=document.createElement('canvas');chassis.width=320;chassis.height=128;
  const c=chassis.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(image,0,0,320,128);
  // The generated source has alpha 253 even inside solid metal. Correct only
  // near-opaque texels in this render cache; keep the transparent silhouette/AA.
  const pixels=c.getImageData(0,0,320,128);
  for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]>=250)pixels.data[i]=255;
  c.putImageData(pixels,0,0);
  // Tint only existing hull pixels, preserving both opaque surfaces and cutout
  // edges. No source asset edits, opacity fade, or per-frame image processing.
  c.save();c.globalCompositeOperation='source-atop';c.fillStyle='rgba(18,32,49,.16)';
  c.fillRect(0,0,320,128);c.restore();
  canvas=document.createElement('canvas');canvas.width=320;canvas.height=128;ctx=canvas.getContext('2d');
}
function paintAd(c,index,time,xOffset) {
  const ad=ads[index];c.save();c.translate(panel.x+xOffset,panel.y);
  c.fillStyle=ad.back;c.fillRect(0,0,panel.w,panel.h);
  // Restrained moving LED columns, not a full-screen flash.
  c.fillStyle=ad.color;c.globalAlpha=.12;
  for(let x=-40;x<180;x+=12)c.fillRect(x+Math.floor(time*8)%12,0,2,36);
  c.globalAlpha=1;c.strokeStyle=ad.color;c.fillStyle=ad.color;c.lineWidth=1;
  if(ad.kind==='data'){
    c.strokeRect(9,10,16,16);c.fillRect(14,15,6,6);
    for(let i=0;i<4;i++){c.fillRect(7,11+i*4,2,1);c.fillRect(25,11+i*4,2,1);}
    c.fillRect(8+Math.floor(time*5)%18,29,3,1);
  }else if(ad.kind==='bar'){
    c.beginPath();c.moveTo(7,9);c.lineTo(27,9);c.lineTo(17,21);c.closePath();c.stroke();
    c.fillRect(17,21,1,8);c.fillRect(12,29,11,1);
    c.fillRect(22,4+Math.floor(time*3)%4,2,2);
  }else{
    c.strokeRect(6,8,22,17);c.fillRect(11,28,13,1);c.fillRect(16,25,3,3);
    c.beginPath();for(let x=9;x<26;x++){const y=16+Math.round(Math.sin(x*.8-time*4)*3);x===9?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
  }
  c.font='bold 12px monospace';c.textBaseline='top';c.textAlign='left';
  c.fillText(ad.title,35,7,96);
  c.font='5px monospace';c.fillText(ad.subtitle,35,23,96);
  c.fillStyle=ad.color;c.globalAlpha=.4;c.fillRect(35,31,Math.floor(94*(time%interval)/interval),1);
  c.restore();
}
function render(image,time,direction,still=false) {
  prepare(image);
  // At most 24 LED frames/sec regardless of host refresh rate. Stable when paused.
  const frame=still?0:Math.floor(Math.max(0,Number(time)||0)*24),key=frame+':'+direction+':'+still;
  if(stamp===key)return canvas;stamp=key;
  const t=frame/24,s=adState(t),mirrored=direction>0;
  ctx.clearRect(0,0,320,128);ctx.save();
  if(mirrored){ctx.translate(320,0);ctx.scale(-1,1);}
  ctx.drawImage(chassis,0,0);ctx.restore();
  // The sprite faces left. Mirror its hull only; screen lettering stays readable.
  const px=mirrored?320-panel.x-panel.w:panel.x;
  ctx.save();ctx.translate(px-panel.x,0);ctx.beginPath();ctx.rect(panel.x,panel.y,panel.w,panel.h);ctx.clip();
  if(s.mix<1){const offset=Math.round(s.mix*panel.w);paintAd(ctx,s.previous,t,-offset);paintAd(ctx,s.index,t,panel.w-offset);}
  else paintAd(ctx,s.index,t,0);
  ctx.fillStyle='rgba(0,0,0,.23)';for(let y=panel.y;y<panel.y+panel.h;y+=3)ctx.fillRect(panel.x,y,panel.w,1);
  ctx.restore();
  // Tiny local running lights breathe; no broad bloom across buildings.
  ctx.fillStyle='rgba(103,193,206,'+(.18+.1*Math.sin(t*2))+')';
  ctx.fillRect(mirrored?274:37,99,12,1);ctx.fillRect(mirrored?19:289,99,9,1);
  return canvas;
}
function draw(c,m,cam,position,images) {
  const image=images?.get(assetId),list=vehicles(m);if(!image||!list.length)return;
  const still=!!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  c.save();c.imageSmoothingEnabled=false;
  for(const v of list){
    const p=position(v.x+(cam.x+7.85)*(1-depth.parallax[0]),v.y+cam.y*(1-depth.parallax[1]));
    const width=v.width*1280/cam.w,height=width*.4;
    if(p.x+width/2<0||p.x-width/2>1280||p.y+height/2<0||p.y-height/2>720)continue;
    c.globalAlpha=v.alpha;c.drawImage(render(image,m.time,v.direction,still),p.x-width/2,p.y-height/2,width,height);
  }
  c.restore();
}
W.LunaOutsideAdCarrier={assetId,asset,apply,vehicles,adState,ads,interval,travelRate,routes,depth,render,draw};
apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);

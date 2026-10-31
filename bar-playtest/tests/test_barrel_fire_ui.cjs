const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};window.fireDraw=o.tick.bind(o);o.tick=()=>{};m.x=-16;m.time=1;o.snapCamera();fireDraw(0);});
 const audit=await p.evaluate(()=>{
  const F=LunaBarrelFire,frames=new Set();let min=Infinity,max=0,warm=0,white=0,partial=0,changed=0,last=null,canvas=null;
  for(let i=0;i<64;i++){
   const r=F.render(i/F.fps),data=r.core.getContext('2d').getImageData(0,0,r.w,r.h).data;
   if(canvas&&canvas!==r.core)throw Error('Unbounded frame allocation');canvas=r.core;
   const url=r.core.toDataURL();frames.add(url);if(last!==null&&url!==last)changed++;last=url;let count=0;
   for(let k=0;k<data.length;k+=4)if(data[k+3]){count++;if(data[k]>data[k+1]+15&&data[k+1]>data[k+2]+10)warm++;if(data[k]>240&&data[k+1]>240&&data[k+2]>240)white++;if(data[k+3]<250)partial++;}
   min=Math.min(min,count);max=Math.max(max,count);if(r.w>22||r.h>29)throw Error('Engine fire quad expanded');
  }
  const first=F.render(1).core.toDataURL(),same=F.render(1.001).core.toDataURL()===first,still=F.render(1,true).core.toDataURL();
  return {frames:frames.size,min,max,warm,white,partial,changed,same,still:still===F.render(60,true).core.toDataURL(),fps:F.fps};
 });
 assert.equal(audit.fps,16);assert.equal(audit.frames,32,'1/1.5/2.5 UV speeds repeat after 2s, exactly 32 stepped frames');assert(audit.min>30&&audit.max<22*29);assert(audit.warm>0&&audit.white>0&&audit.partial>0);assert(audit.same&&audit.still);
 const integration=await p.evaluate(()=>{
  const ctx=document.querySelector('#outside-root canvas').getContext('2d'),original=ctx.drawImage,F=LunaBarrelFire,paint=F.paintSprite,draw=F.draw,events=[];
  ctx.drawImage=function(img,...a){if(img.src)events.push(img.src.split('/').pop());return original.call(this,img,...a);};
  F.draw=function(...a){events.push('fire');return draw(...a);};
  F.paintSprite=function(c,...a){const state=()=>JSON.stringify([c.globalAlpha,c.globalCompositeOperation,c.imageSmoothingEnabled,c.getTransform()]),before=state();paint(c,...a);if(state()!==before)throw Error('Fire leaked canvas state');};
  try{fireDraw(0);}finally{ctx.drawImage=original;F.draw=draw;F.paintSprite=paint;}
  const data=LUNA_BARREL_FIRE,fire=F.placement(),front=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='barrel-front');
  return {back:events.indexOf('camp-props.png'),fire:events.indexOf('fire'),front:events.indexOf('barrel-front.png'),near:events.indexOf('near_foreground_1.png'),dx:Math.abs(fire.x-front.x),lip:front.y+front.sprite.h/front.sprite.ppu,fireTop:fire.y+Math.abs(fire.sy)/2};
 });
 assert(integration.back>=0&&integration.back<integration.fire&&integration.fire<integration.front&&integration.front<integration.near,'back -> flame -> front lip -> foreground');assert(integration.dx<.002);assert(integration.lip<integration.fireTop);
 // Review actual new props and engine FX at several animation phases and camera positions.
 for(const [name,x,t]of [['left',-16.4,.25],['center',-15.95,1.5],['right',-15.4,3.1]]){
  await p.evaluate(([x,t])=>{const o=outsidePlaytest,m=o.model;m.x=x;m.time=t;o.snapCamera();fireDraw(0);},[x,t]);await p.screenshot({path:'/private/tmp/engine-fire-'+name+'.png'});
 }
 await p.setViewportSize({width:960,height:600});await p.evaluate(()=>fireDraw(0));await p.screenshot({path:'/private/tmp/engine-fire-small.png'});
 assert.deepEqual(errors,[]);console.log('BARREL_FIRE_UI_OK',JSON.stringify(audit),JSON.stringify(integration));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

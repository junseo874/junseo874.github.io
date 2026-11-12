const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 const result=await page.evaluate(()=>{
  const optimized=new LunaStreetAtmosphereRenderer({spriteOnly:true}),reference=new LunaStreetAtmosphereRenderer({spriteOnly:true});
  const atlas=document.createElement('canvas');atlas.width=512;atlas.height=512;const a=atlas.getContext('2d');
  a.fillStyle='#987a64';a.fillRect(0,0,512,512);a.fillStyle='#65cbd2';a.fillRect(12,20,90,240);a.clearRect(0,0,8,512);
  const pixels=(renderer,sp,p,compression)=>{const o=renderer.characterLighting(atlas,sp,p),c=document.createElement('canvas');if(renderer===reference){o.image=renderer.canvas;o.y=0;}c.width=sp.w;c.height=sp.h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(o.image,o.x,o.y,o.w,o.h,.13,.27,sp.w,sp.h*compression); return x.getImageData(0,0,sp.w,sp.h).data;};
  let mismatches=0,cases=0,resizes=0;
  const sizes=[[89,86],[128,128],[43,71],[150,190],[89,86],[32,64]];
  optimized.characterLighting(atlas,{x:0,y:0,w:256,h:256,pivot:{x:.5,y:.4}},{x:0,y:0,width:2.56,height:2.56,flip:false,foot:{x:0,y:-.3},state:{position:[1,1],weight:1,color:[1,.4,.1]},config:LunaCharacterLighting.config});
  for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(optimized.canvas,key,{get(){return d.get.call(this);},set(v){resizes++;d.set.call(this,v);}});}
  for(let i=0;i<48;i++){
   const [w,h]=sizes[i%sizes.length],sp={x:i%2*8,y:i%3*12,w,h,pivot:{x:.5,y:.4}},p={x:i*.1,y:0,width:w/100,height:h/100,flip:!!(i%2),foot:{x:i*.1,y:-.3},state:{position:[Math.sin(i),.4],weight:(i%5)/4,color:[1,.4,.1],localLight:[2,i%2,1]},config:LunaCharacterLighting.config};
   // Reproduce the former exact-size buffer for comparison, using identical
   // native shader inputs. This catches wrong crop origins and stale pixels.
   reference.canvas.width=w;reference.canvas.height=h;
   for(const compression of [1,.329835]){const before=pixels(reference,sp,p,compression),after=pixels(optimized,sp,p,compression);for(let n=0;n<before.length;n++)if(before[n]!==after[n])mismatches++;cases++;}
  }
  const steam=LunaVentSteam,sp={x:0,y:0,w:929,h:249,pivot:{x:0,y:1}},c=document.createElement('canvas');c.width=300;c.height=220;const ctx=c.getContext('2d',{willReadFrequently:true});let ventDiff=0;
  for(const [scale,dx,dy,angle]of [[1,-600,-80,0],[2,-1150,-120,.05],[-1,750,170,.3],[1,-1000,-500,0]]){
   const paint=old=>{ctx.resetTransform();ctx.clearRect(0,0,c.width,c.height);ctx.translate(dx,dy);ctx.rotate(angle);ctx.scale(scale,scale);if(old){ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;for(const v of steam.sources.B_Fore_Building_1){const e=steam.render(v,12.3);ctx.drawImage(e.canvas,e.x,e.y,100,70);}ctx.restore();}else steam.paintSprite(ctx,'B_Fore_Building_1',sp,929,249,12.3);return ctx.getImageData(0,0,c.width,c.height).data;};
   const before=paint(true),after=paint(false);for(let n=0;n<before.length;n++)if(before[n]!==after[n])ventDiff++;
  }
  let offscreenFields=0;const original=CanvasRenderingContext2D.prototype.createImageData;CanvasRenderingContext2D.prototype.createImageData=function(...args){offscreenFields++;return original.apply(this,args);};ctx.setTransform(1,0,0,1,-5000,-5000);steam.paintSprite(ctx,'B_Fore_Building_1',sp,929,249,22.1);CanvasRenderingContext2D.prototype.createImageData=original;
  return {cases,mismatches,resizes,ventDiff,offscreenFields,error:optimized.gl.getError()};
 });
 assert.equal(result.mismatches,0,'Native character lighting must remain pixel-identical');assert.equal(result.resizes,0,'Mixed actors must reuse the GPU drawing buffer');assert.equal(result.ventDiff,0,'Culling must preserve every visible plume pixel');assert.equal(result.offscreenFields,0);assert.equal(result.error,0);console.log('STREET_BUFFER_REUSE_OK',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const result=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),image=document.createElement('canvas');image.width=60;image.height=40;
  const c=image.getContext('2d');c.fillStyle='#666';c.fillRect(4,3,20,34);c.fillStyle='#f00';c.fillRect(30,0,30,40);
  const sp={x:0,y:0,w:30,h:40,pivot:{x:.5,y:0}},config=LunaCharacterLighting.config;
  const dest=document.createElement('canvas');dest.width=30;dest.height=40;const d=dest.getContext('2d',{willReadFrequently:true});
  function paint(x,flip=false,weight=1){const out=r.characterLighting(image,sp,{x:0,y:0,width:.3,height:.4,flip,foot:{x:0,y:0},state:{position:[x,.6],weight,color:[.4,.8,1]},config});d.clearRect(0,0,30,40);d.drawImage(out.image,out.x,out.y,30,40,0,0,30,40);return [...d.getImageData(0,0,30,40).data];}
  const left=paint(-.4),right=paint(.4),flipped=paint(.4,true),zero=paint(.4,false,0),again=paint(.4);
  function edge(p,side){let sum=0;for(let y=4;y<35;y++)for(let x=side?22:4;x<(side?24:6);x++)sum+=p[(y*30+x)*4+2];return sum;}
  let leaks=0;for(let y=0;y<40;y++)for(let x=0;x<30;x++)if((x<4||x>=24||y<3||y>=37)&&right[(y*30+x)*4+3])leaks++;
  return {left:[edge(left,0),edge(left,1)],right:[edge(right,0),edge(right,1)],flip:[edge(flipped,0),edge(flipped,1)],zero:[edge(zero,0),edge(zero,1)],leaks,stable:JSON.stringify(right)===JSON.stringify(again),gl:r.gl.getError()};
 });
 assert(result.left[0]>result.left[1]);assert(result.right[1]>result.right[0]);assert(result.flip[0]>result.flip[1],'world-lit edge stays correct when sprite mirrors');assert(result.right[1]>result.zero[1]);assert.equal(result.leaks,0);assert(result.stable);assert.equal(result.gl,0);
 await page.evaluate(()=>{const o=outsidePlaytest;window.rimTick=o.tick;o.tick=()=>{};o.model.tick=()=>{};o.model.start({day:3,flow:'out',place:'bar'});o.model.story.cancel();o.model.backgroundStory.cancel();barGame.progress.flags.boobi_revealed=true;barGame.progress.flags.boobi_adopted=false;});
 for(const c of [{name:'shops',x:-5,y:-.7},{name:'lamp-left',x:-11,y:-.7},{name:'lamp-right',x:-9.7,y:-.7,facing:1},{name:'upper',x:-16,y:9.74,level:1},{name:'lift',x:-12.645,y:4.39,elevatorY:4,level:1}]){
  await page.evaluate(c=>{const o=outsidePlaytest,m=o.model;Object.assign(m,{level:0,elevatorY:-1.09,anim:'idle',animTime:.2,facing:-1},c);o.snapCamera();for(let i=0;i<25;i++){m.time+=1/60;rimTick(0);}},c);
  await page.screenshot({path:'/tmp/character-rim-'+c.name+'.png'});
  const state=await page.evaluate(()=>{const m=outsidePlaytest.model,s=LunaStreetAtmosphere.inspect(m),a=LunaCharacterLighting.inspect(m);return {error:s.error,gl:s.renderer.gl.getError(),player:!!a?.actors.get('player'),cat:!!a?.actors.get('boobi'),count:a?.actors.size,weight:a?.actors.get('player')?.weight};});
  assert.equal(state.error,null);assert.equal(state.gl,0);assert(state.player);assert(state.count<65);
  if(c.name==='upper')assert(state.cat,'outdoor Boobi dummy shares rim lighting');
 }
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>rimTick(0));assert.deepEqual(errors,[]);
 console.log('CHARACTER_LIGHTING_UI_OK',JSON.stringify(result),'street/corridor/lift, source alpha, adjacent atlas protection, flip, pause, resize');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

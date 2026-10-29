const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});
 try{
  for(const dpr of [1,2]){
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
   await page.evaluate(async()=>{
    Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();
    const o=outsidePlaytest,m=o.model;window.tailTick=o.tick;o.tick=()=>{};
    m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.x=-3;m.y=-.7;o.snapCamera();tailTick(0);
    m.story.beginRows('tail-test',{x:m.x,y:m.y},[{type:'say',actor:'luna',text:'화자가 화면 밖에 있어도 방향이 보여야 해.'}]);
    m.story.speech.elapsed=99;tailTick(0);o.refreshHUD();await document.fonts.ready;
   });
   for(const viewport of [{width:1280,height:720},{width:960,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    for(const [x,direction,file]of [[640,'center','A'],[-300,'left','B'],[640,'center','A'],[1600,'right','C'],[1280,'center','A'],[0,'center','A']]){
     const result=await page.evaluate(async({x})=>{
      const el=document.querySelector('.outside-speech');
      LunaWorldSpeech.place(el,{x,y:400,scale:1,gap:22});
      await Promise.all([...el.querySelectorAll('.textbox-tail')].map(n=>{const im=new Image();im.src=n.getAttribute('href');return im.decode();}));
      const visible=[...el.querySelectorAll('.textbox-tail')].filter(n=>getComputedStyle(n).display!=='none');
      const tail=visible[0],b=el.getBoundingClientRect(),tr=tail.getBoundingClientRect();
      return {direction:el.dataset.speechTail,count:visible.length,src:tail.getAttribute('href'),ratio:tr.width/tr.height,expected:Number(tail.getAttribute('width'))/58,relativeY:(tr.top-b.top)/b.height,left:parseFloat(el.style.left),width:el.offsetWidth,text:el.querySelector('p').getAttribute('aria-label')};
     },{x});
     assert.equal(result.direction,direction);assert.equal(result.count,1);assert(result.src.endsWith('tail_'+file+'.png'));
     assert(Math.abs(result.ratio-result.expected)<.003,JSON.stringify(result));assert(result.relativeY>.9&&result.relativeY<1);
     assert(result.left-result.width/2>=11.9&&result.left+result.width/2<=1268.1,'body stays inside logical viewport');
     assert.equal(result.text,'화자가 화면 밖에 있어도 방향이 보여야 해.');
     if(dpr===1&&viewport.width===1280&&[640,-300,1600].includes(x))await page.screenshot({path:'/private/tmp/exterior-tail-'+direction+'.png'});
    }
   }
   const projected=await page.evaluate(()=>{
    const el=document.querySelector('.outside-speech'),states=[];
    // One stationary speaker moves across the projected viewport as the
    // camera pans. Direction must not stick to the previous edge or scale.
    for(const scale of [.75,1,1.4])for(const cameraX of [-4,0,4,0]){
     const x=640-cameraX*1280/4.8;
     LunaWorldSpeech.place(el,{x,y:300,scale,gap:22});
     states.push([el.dataset.speechTail,el.querySelectorAll('.exterior-textbox-skin').length]);
    }
    return states;
   });
   assert.deepEqual(projected,Array.from({length:3},()=>[['right',1],['center',1],['left',1],['center',1]]).flat());
   await page.evaluate(()=>LunaExteriorTextbox.attach(document.querySelector('.outside-speech'),{tail:false}));
   assert.equal(await page.locator('.outside-speech .piece-9').evaluate(el=>getComputedStyle(el).display),'none');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('EXTERIOR_TAIL_OK center/left/right and return, 3 viewports, DPR 1/2, no-tail captions, authored aspect ratios');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

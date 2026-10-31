const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});
 try{
  for(const dpr of [1,2]){
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
   await page.evaluate(async()=>{
    Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();
    const a=outsidePlaytest,m=a.model;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.x=-1.985;m.y=-.7;m.level=0;
    window.ambientSizeTick=a.tick;a.tick=()=>{};a.snapCamera();ambientSizeTick(0);
    for(const id of ['outside_day0_port_pair','outside_day0_store_passers'])m.backgroundStory.begin(id,{id},true);
    m.backgroundStory.tick(.23);a.refreshHUD();await document.fonts.ready;
   });
   assert.equal(await page.locator('.outside-background-speech:visible').count(),2,'real concurrent NPC conversations');
   await page.evaluate(()=>{for(const s of outsidePlaytest.model.backgroundStory.channels.values())s.speech.elapsed=99;outsidePlaytest.refreshHUD();});
   if(dpr===1)await page.screenshot({path:'/private/tmp/ambient-speech-size-live.png'});
   // Same sentence/anchor through both real rendering paths isolates the
   // size change from differing dialogue copy, wrapping and actor positions.
   for(const viewport of [{width:1280,height:720},{width:960,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    for(const auto of [false,true])for(const text of ['그래.','거리에서 나누는 주변 대화는 직접 대화보다 작게 보여요. '.repeat(3)]){
     const result=await page.evaluate(({text,auto})=>{
      const a=outsidePlaytest,m=a.model;
      const v={key:'size-'+text+auto,full:text,text,auto,anchor:{x:m.x,y:m.y+.4}};
      m.story.view=()=>v;m.backgroundStory.views=()=>[{...v,key:'npc-'+v.key,auto:true},{...v,key:'tv-'+v.key,auto:true}];a.refreshHUD();
      const measure=el=>{
       const b=el.getBoundingClientRect(),cs=getComputedStyle(el),scale=b.width/parseFloat(cs.width),p=el.querySelector('p'),style=getComputedStyle(p),tail=el.querySelector('.piece-9').getBoundingClientRect();
       return {width:b.width,height:b.height,bottom:b.bottom,font:parseFloat(style.fontSize)*scale,pad:parseFloat(cs.paddingLeft)*scale,tail:tail.width,tailHeight:tail.height,text:p.getAttribute('aria-label')};
      };
      return {direct:measure(document.querySelector('.outside-speech')),ambient:[...document.querySelectorAll('.outside-background-speech:not([hidden])')].map(measure)};
     },{text,auto});
     for(const b of result.ambient){
      for(const key of ['width','height','font','pad','tail','tailHeight'])assert(Math.abs(b[key]/result.direct[key]-.8)<.002,key+JSON.stringify(result));
      assert(Math.abs(b.bottom-result.direct.bottom)<.1,'same world head gap');assert.equal(b.text,text);
     }
    }
    const directions=await page.evaluate(()=>{
     const a=outsidePlaytest,m=a.model,out=[];
     for(const dx of [-8,0,8,0]){
      const text='방향 확인',v={key:'edge',full:text,text,auto:true,anchor:{x:m.x+dx,y:m.y+.4}};
      m.backgroundStory.views=()=>[v];a.refreshHUD();
      const el=document.querySelector('.outside-background-speech:not([hidden])'),stage=document.querySelector('.outside-stage').getBoundingClientRect(),b=el.getBoundingClientRect();
      out.push({direction:el.dataset.speechTail,contained:b.left>=stage.left&&b.right<=stage.right});
     }return out;
    });
    assert.deepEqual(directions.map(d=>d.direction),['left','center','right','center']);assert(directions.every(d=>d.contained));
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('AMBIENT_SPEECH_SIZE_OK real NPC channels, 80% body/text/padding/tails, direct manual/auto unchanged, stable gap, edge tails, 3 sizes and DPR 1/2');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.addStyleTag({content:'.qa-launch{display:none!important}'});
  for(const kind of ['general','regular','tutorial']){
   await p.evaluate(kind=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:true});c.ui.auto=true;
    if(kind==='general'){
     g.reset(99,'general',7,true,{variant:'original'});g.spawn();const base=Object.values(g.seats).find(Boolean);
     g.queue=[];g.queueIndex=0;g.seats={L:{...base,seat:'L',state:'WAIT_COASTER',coaster:false,left:999,limit:999,lines:[g.makeLine('luna','코스터 부탁해요.')],lineIndex:0,lineDone:null},M:null,R:null};g.focus='L';
    }else{
     g.reset(kind==='tutorial'?0:1,'regular',42,false,{variant:'original'});g.phase='regular';g.screen='bar';g.dialogue=null;g.storyCoaster=null;g.currentOrder=null;g.focus='L';g.seats={L:{actor:'chris',coaster:false,state:'STORY'},M:null,R:null};
     if(kind==='tutorial'){
      const step={type:'coaster',actor:'chris'};g.story={scene:{id:'coaster-speech-test'},steps:[step,{type:'say',actor:'luna','text.ko':'이렇게요?'}],index:0};g.tutorial={kind:'coaster',seat:'L',step};
     }else{
      g.story={scene:{id:'coaster-speech-test'},steps:[{type:'say',actor:'chris','text.ko':'안녕하세요.'},{type:'say',actor:'luna','text.ko':'주문하시겠어요?'},{type:'order',actor:'chris',arg:'exact:dry_martini'}],index:0};g.pump();g.dialogue.chars=g.dialogue.text.length;
     }
    }
    if(kind==='general'){const line=g.seats.L.lines[0];line.chars=line.text.length;}
    g.overview=false;g.cameraLeft=0;g.transition=0;c.screen(c.playView);c.render(true);
   },kind);
   await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
   const popup=p.locator('[data-drag="coaster"]'),bubble=p.locator(kind==='tutorial'?'.day0-guide-copy':'.dialogue-wrap');
   await popup.waitFor();await bubble.waitFor({state:'visible'});
   const original=await bubble.innerText();
   async function grab(){const r=await popup.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await bubble.waitFor({state:'hidden'});assert(await p.locator('#drag-ghost').isVisible());assert(await p.locator('[data-drop="L"] .delivery-arrow').isVisible());}
   await grab();
   const before=await p.evaluate(()=>({index:barGame.seats.L.lineIndex,story:barGame.story?.index,left:barGame.seats.L.left}));
   await p.waitForTimeout(2400);assert(await bubble.isHidden());
   const after=await p.evaluate(()=>({index:barGame.seats.L.lineIndex,story:barGame.story?.index,left:barGame.seats.L.left}));
   assert.equal(after.index,before.index);assert.equal(after.story,before.story);
   if(kind==='general')assert(after.left<before.left,'Patience must continue while speech is hidden');
   await p.mouse.move(100,150);await p.mouse.up();await bubble.waitFor({state:'visible'});assert.equal(await bubble.innerText(),original);assert(await p.evaluate(()=>!barGame.seats.L.coaster));
   await grab();await p.evaluate(()=>dispatchEvent(new PointerEvent('pointercancel')));await p.mouse.up();await bubble.waitFor({state:'visible'});assert(await p.evaluate(()=>!barGame.seats.L.coaster));
   await grab();const r=await p.locator('[data-drop="L"]').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height*.8);await p.mouse.up();
   await p.waitForFunction(()=>barGame.seats.L.coaster);assert(await p.locator('#drag-ghost').isHidden());
   if(kind==='tutorial')assert.equal(await p.locator('.day0-guide[data-guide="coaster"]').count(),0);
  }
  assert.deepEqual(errors,[]);console.log('PASS coaster speech: general/regular/tutorial hide on pickup, hold dialogue only, invalid-drop/cancel restore, valid delivery advances');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

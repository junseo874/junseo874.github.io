const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.addStyleTag({content:'.qa-launch{display:none!important}'});
  for(const kind of ['general-L','general-M','general-R','regular','tutorial']){
   const seat=await p.evaluate(kind=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:kind!=='general-R'});
    if(kind.startsWith('general')){
     g.reset(99,'general',7,true,{variant:'original'});g.spawn();const base=Object.values(g.seats).find(Boolean),seat=kind.slice(-1);
     g.queue=[];g.queueIndex=0;g.seats={L:null,M:null,R:null};g.seats[seat]={...base,seat,state:'WAIT_COASTER',coaster:false,left:999,limit:999,lines:[]};g.focus=seat;
    }else if(kind==='regular'){
     g.reset(1,'regular',42,false,{variant:'original'});g.phase='regular';g.dialogue=null;g.storyCoaster=null;g.focus='L';g.seats={L:{actor:'tom',coaster:false,state:'STORY'},M:null,R:null};
     g.story={scene:{id:'coaster-key-test'},steps:[{type:'say',actor:'tom','text.ko':'안녕하세요.'},{type:'say',actor:'luna','text.ko':'주문하시겠어요?'},{type:'order',actor:'tom',arg:'exact:dry_martini'}],index:0};g.pump();g.dialogue.chars=g.dialogue.text.length;
    }else{
     // Isolate the legacy day-0 tutorial input state from campaign-specific story routing.
     g.reset(0,'regular',4,true,{variant:'original'});g.phase='regular';g.screen='bar';g.dialogue=null;g.storyCoaster=null;g.currentOrder=null;g.focus='R';
     g.seats={L:null,M:null,R:{actor:'chris',coaster:false,state:'STORY'}};
     const step={type:'coaster',actor:'chris'};g.story={scene:{id:'coaster-tutorial-key-test'},steps:[step,{type:'say',actor:'luna','text.ko':'이렇게요?'}],index:0};g.tutorial={kind:'coaster',seat:'R',step};
    }
    g.overview=false;g.cameraLeft=0;g.transition=0;c.screen(c.playView);c.render(true);return g.focus;
   },kind);
   await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
   const popup=p.locator('[data-drag="coaster"]');await popup.waitFor();
   assert((await popup.innerText()).includes('드래그'),'Primary instruction remains drag');
   for(const focused of [false,true]){
    if(focused)await popup.focus();else await p.evaluate(()=>document.activeElement?.blur());
    for(const key of ['Space','Enter'])await p.keyboard.press(key);
    assert(await p.evaluate(seat=>!barGame.seats[seat].coaster,seat),kind+': Space/Enter cannot provide coaster');
   }
   await p.evaluate(()=>lunaCampaign.ui.drag='coaster');await p.keyboard.press('KeyE');
   assert(await p.evaluate(seat=>!barGame.seats[seat].coaster,seat),'No competing shortcut during drag');await p.evaluate(()=>lunaCampaign.ui.drag=null);
   await p.evaluate(()=>{barGame.transition=10;});await p.keyboard.press('KeyE');assert(await p.evaluate(seat=>!barGame.seats[seat].coaster,seat));await p.evaluate(()=>barGame.transition=0);
   await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.down('KeyE');
   await p.waitForFunction(seat=>barGame.seats[seat].coaster,seat,{timeout:3000}).catch(async error=>{throw Error(kind+' '+JSON.stringify(await p.evaluate(()=>({focus:barGame.focus,paused:barGame.isPaused(),camera:barGame.cameraMoving,cameraLeft:barGame.cameraLeft,transition:barGame.transition,overlay:barGame.overlay,tutorial:barGame.tutorial?.kind,ready:barGame.storyCoasterReady(),drag:lunaCampaign.ui.drag,inspector:lunaCampaign.ui.inspector,view:lunaCampaign.view,phase:barGame.phase,error:barGame.error})))+' '+error.message);});
   const count=await p.evaluate(()=>barGame.logs.filter(x=>['coaster','story_coaster'].includes(x.event)).length);
   await p.keyboard.down('KeyE');await p.keyboard.up('KeyE');
   assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>['coaster','story_coaster'].includes(x.event)).length),count,'Held E cannot deliver twice');
   if(kind.startsWith('general')){
    assert.equal(await p.evaluate(()=>barGame.seats[barGame.focus].state),'ORDER_DIALOGUE');
    await p.evaluate(()=>{const g=barGame;for(let i=0;i<1000&&g.seats[g.focus].state==='ORDER_DIALOGUE';i++)g.tick(.05);});
    await p.keyboard.press('KeyE');assert(await p.evaluate(()=>barGame.seats[barGame.focus].reasking),'E still asks again after ordering');
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS: general L/M/R, regular and day-0 tutorial accept E, reject Space/Enter, preserve drag-first copy, held-key/drag/transition guards and E reask');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

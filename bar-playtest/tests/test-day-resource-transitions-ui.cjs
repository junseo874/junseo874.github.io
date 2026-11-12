const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  for(let day=0;day<4;day++){
   const p=await browser.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   await p.waitForFunction(()=>window.lunaCampaign);
   await p.evaluate(async day=>{
    LunaFocusSettings.setEnabled(false);
    const c=lunaCampaign;c.toPicker();c.session.install({developer:false,serviceVersion:'A'});
    barGame.reset(day,'full',10,false,{serviceVersion:'A'});
    barGame.progress.inventory={wild_dog:1,bitters:1};barGame.progress.flags.campaign_observation=true;
    c.session.day=day;c.session.route='out';c.session.carry=structuredClone(barGame.progress);
    Object.assign(outsidePlaytest.config,{day,flow:'out',place:'home',variant:'original'});
    await outsidePlaytest.start({wakeAtSofa:true});c.screen(c.playView);c.sleep();
   },day);
   if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
   let finished=false;
   for(let n=0;n<1500;n++){
    const state=await p.evaluate(()=>{
     const c=lunaCampaign;
     // Accelerate clocks and acknowledge dialogue; all resource requests and transition callbacks are real.
     for(let i=0;i<10;i++)c.tick(.05);
     if(!c.memoryTransition&&!c.dayTransition){
      if(c.view==='scene'){c.dialog.chars=1e6;c.next();}
      else if(c.view==='scene-choice')c.action('scene-choice:'+c.sceneChoiceOptions()[0].seq);
      else if(c.view==='prologue'){
       if(c.cinema?.dialogueWait){c.cinema.dialogueWait.revealed=true;c.advanceCinemaDialogue();}
       if(c.cinema?.dailyWake)c.finishCinema();
      }
     }
     return {view:c.view,day:c.session.day,error:c.loadError,transition:!!c.dayTransition,scene:outsidePlaytest.model?.scene};
    });
    assert.notEqual(state.view,'load-error',state.error);
    if(day===3?state.view==='ending':state.day===day+1&&!state.transition&&state.view==='game'){
     if(day<3)assert.equal(state.scene,'home');finished=true;break;
    }
    await p.waitForTimeout(20);
   }
   assert(finished,'Night '+day+' must reach the next day / ending');
   if(day<3){
    await p.evaluate(()=>lunaCampaign.startBar(lunaCampaign.session.day,lunaCampaign.session.carry));
    await p.waitForFunction(()=>lunaCampaign.doorTransition?.ready||lunaCampaign.view==='load-error',null,{timeout:120000});
    assert.notEqual(await p.evaluate(()=>lunaCampaign.view),'load-error',await p.evaluate(()=>lunaCampaign.loadError));
    await p.waitForFunction(()=>!lunaCampaign.doorTransition&&lunaCampaign.view==='game',null,{timeout:30000});
    assert.equal(await p.evaluate(()=>barGame.day),day+1);
    await p.screenshot({path:'/tmp/luna-resource-audit-day-'+(day+1)+'.png'});
   }
   assert.deepEqual(errors,[]);
   console.log('DAY_RESOURCE_TRANSITION_OK',day,day===3?'ending':day+1);
   await p.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

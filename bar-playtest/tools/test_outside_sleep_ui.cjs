const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 const baseline=await p.evaluate(()=>JSON.stringify({progress:barGame.progress,day:lunaCampaign.session.day,route:lunaCampaign.session.route,completed:lunaCampaign.session.completed}));
 async function start(day,variant,flow='out',extra={}){await p.evaluate(async cfg=>{outsidePlaytest.exit(true);lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{place:'home',...cfg});await outsidePlaytest.start();const m=outsidePlaytest.model;m.x=2.557;m.story.cancel();m.backgroundStory.cancel();m.updateNear();},{day,variant,flow,...extra});}
 for(const variant of ['original','gpt'])for(let day=0;day<=3;day++){
  await start(day,variant);await p.keyboard.press('KeyE');
  if(day===0||day===1||day===3){await p.locator(day===1?'.campaign-black-scene':'.terrace-scene').waitFor();if(day===1){assert.equal(await p.locator('.campaign-portrait,.campaign-scene-label').count(),0);assert.equal(await p.locator('.campaign-black-scene').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');await p.screenshot({path:'/private/tmp/workshop-black.png'});}assert.equal(await p.evaluate(()=>outsidePlaytest.model.config.day),day);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');await p.keyboard.press('Escape');await p.evaluate(()=>{for(let i=0;i<80&&lunaCampaign.view==='scene'&&!lunaCampaign.dayTransition;i++){lunaCampaign.dialog.chars=1e5;lunaCampaign.next();}});}
  if(day<3){await p.waitForFunction(d=>!lunaCampaign.dayTransition&&lunaCampaign.view==='developer'&&outsidePlaytest.model.config.day===d,day+1);
   assert.deepEqual(await p.evaluate(()=>({day:outsidePlaytest.config.day,flow:outsidePlaytest.model.config.flow,place:outsidePlaytest.config.place,scene:outsidePlaytest.model.scene,variant:outsidePlaytest.config.variant})),{day:day+1,flow:'in',place:'home',scene:'home',variant});
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);assert.equal(await p.locator('.outside-overlay').isVisible(),false);
   // Sleep wakes at the sofa; a second interaction cannot skip another day.
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);assert.equal(await p.evaluate(()=>outsidePlaytest.model.near.id),'sofa');assert.equal(await p.evaluate(()=>outsidePlaytest.camera.x),1.14);
   await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=2.557;m.updateNear();});await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>lunaCampaign.view),'notice');assert.equal(await p.evaluate(()=>outsidePlaytest.config.day),day+1);await p.keyboard.press('Escape');
   const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyA');await p.waitForTimeout(130);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x)<x);
  }else{assert.equal(await p.evaluate(()=>outsidePlaytest.active),false);assert.equal(await p.locator('.campaign-card h1').textContent(),'외부 일차 테스트 완료');await p.keyboard.press('Escape');await p.locator('#outside-day').waitFor();assert.equal(await p.locator('#outside-day').inputValue(),'3');}
  assert.equal(await p.evaluate(()=>JSON.stringify({progress:barGame.progress,day:lunaCampaign.session.day,route:lunaCampaign.session.route,completed:lunaCampaign.session.completed})),baseline);
 }
 await start(99,'original','out',{qaCase:'sofa'});await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.config.day),99);assert.equal(await p.locator('.terrace-scene').count(),0);assert.equal(await p.evaluate(()=>outsidePlaytest.advanceDay()),false);
 assert.deepEqual(errors,[]);console.log('OUTSIDE_SLEEP_OK: 0–3 days × original/GPT, terrace then advance, direct advance without dialogue, morning/controls, 3-day completion, campaign isolation, QA99 exclusion');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

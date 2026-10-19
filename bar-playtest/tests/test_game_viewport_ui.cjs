const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const sizes=[[1280,720],[960,540],[390,844],[1920,800],[1001,777],[2560,1440],[844,390],[1280,720]];
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio','--disable-gpu']});
 let checks=0;
 try{for(const dpr of [1,2]){
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  async function inside(selector,logicalWidth){
   const r=await p.locator(selector+':visible').boundingBox();assert(r,selector+' visible');
   const {scale:s,x,y}=await p.evaluate(()=>LunaGameViewport.frame());
   assert(r.x>=x-1&&r.y>=y-1&&r.x+r.width<=x+1280*s+1&&r.y+r.height<=y+720*s+1,selector+' in game frame '+JSON.stringify({r,s,x,y}));
   if(logicalWidth)assert(Math.abs(r.width/s-logicalWidth)<2,selector+' scales once: '+r.width/s);
   checks++;return r;
  }
  async function resize(w,h){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(100);}
  for(const [w,h]of sizes){await resize(w,h);await inside('.updates-dialog',620);await inside('.updates-close');await inside('.updates-confirm');}
  await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{lunaCampaign.developer();barGame.reset(99,'practice',1,true);barGame.screen='bar';});
  for(const [w,h]of sizes){
   await resize(w,h);
   await p.evaluate(()=>{LunaStoryNotices.clear();delete barGame.progress.flags.shiba_met;LunaStoryNotices.meet(barGame.progress,'shiba');LunaStoryNotices.forced({encounter:{}});});
   await p.locator('.story-notice-people').waitFor();await p.waitForTimeout(350);
   await inside('#story-notices',1280);await inside('.story-notice-people',220);await inside('.story-notice-event',350);
   if(await p.locator('#campaign-developer-back').isVisible())await inside('#campaign-developer-back');await inside('.qa-launch');
   await p.evaluate(()=>{LunaStoryNotices.clear();LunaStoryNotices.affinity(barGame.progress,'tom',1);});
   await p.waitForTimeout(350);await inside('.story-notice-people',350);
  }
  await p.screenshot({path:'/private/tmp/responsive-notices-'+dpr+'.png'});
  await p.evaluate(()=>lunaQA.open());await p.locator('#qa-lab').waitFor();
  for(const [w,h]of sizes){await resize(w,h);await inside('.qa-panel',1060);await inside('[data-qa="close"]');}
  await p.locator('[data-qa="close"]').click();assert(await p.locator('#qa-lab').isHidden());
  await p.evaluate(()=>lunaCampaign.screen('options'));
  for(const [w,h]of sizes){await resize(w,h);await inside('.luna-settings',1000);}
  await p.evaluate(()=>lunaCampaign.developer());
  for(const overlay of ['settings','help','dossier','dailyUnlocks','ingredientWarning']){
   await p.evaluate(value=>{barGame.overlay=value;},overlay);
   const selector=overlay==='settings'?'.luna-settings':overlay==='dossier'?'.dossier-screen':overlay==='dailyUnlocks'?'.daily-unlocks':'.modal';
   await p.locator(selector+':visible').waitFor();
   let base;
   for(const [w,h]of sizes){await resize(w,h);const r=await inside(selector,base);base??=r.width;}
  }
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await p.evaluate(()=>{outsidePlaytest.config.day=99;return outsidePlaytest.start();});
  await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.evaluate(()=>{lunaCampaign.screen('developer');outsidePlaytest.model.start({...outsidePlaytest.config,day:99});outsidePlaytest.snapCamera();});
  await p.locator('.qa-launch.is-outside').waitFor();
  for(const [w,h]of sizes){await resize(w,h);await inside('.qa-launch.is-outside');}
  await p.locator('.qa-launch.is-outside').click();await inside('.qa-panel',1060);await p.locator('[data-qa="close"]').click();
  // The real drag positioning function must remain safe at all four edges,
  // including a resize with a stationary pointer and a long global toast.
  await p.evaluate(()=>{const t=document.getElementById('toast');t.textContent='화면 크기를 바꿔도 안내가 게임 화면 안에 표시됩니다. '.repeat(5);t.classList.add('visible');document.getElementById('drag-ghost').hidden=false;LunaGameViewport.positionDrag(innerWidth/2,innerHeight/2);});
  for(const [w,h]of sizes){
   await resize(w,h);await inside('#toast');await inside('#drag-ghost',1280);
   for(const [x,y]of [[0,0],[w,0],[0,h],[w,h]]){await p.evaluate(([x,y])=>LunaGameViewport.positionDrag(x,y),[x,y]);await inside('#drag-ghost',1280);}
  }
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS',checks,'game-frame bounds / proportional UI checks: DPR 1/2, repeated resize, updates, people/events/affinity, QA, settings, profiles, unlocks, warnings, toast and drag edges');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

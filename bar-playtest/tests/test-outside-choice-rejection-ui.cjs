const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs');
const {chromium}=runtime.load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{
   Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();
   const m=outsidePlaytest.model;barGame.progress.money=199;barGame.progress.flags={};
   m.x=LunaOutsideBeggar.people[0].x+.27;m.story.cancel();m.backgroundStory.cancel();m.updateNear();outsidePlaytest.snapCamera();m.interact();
   for(let i=0;i<50&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}
   outsidePlaytest.tick(0);
  });
  const panel=p.locator('#outside-root .world-choices'),pay=panel.locator('[data-choice="beggar-pay"]'),question=panel.locator('[data-choice="beggar-question"]');
  const selected=()=>panel.locator('.is-selected').getAttribute('data-choice');
  assert.equal(await selected(),'beggar-pay');
  assert.equal(await pay.evaluate(e=>e.disabled),false,'Unavailable items are natively focusable');
  assert.equal(await pay.getAttribute('aria-disabled'),'true');
  assert.equal(await panel.locator('button small').count(),0,'No persistent condition subtitles');
  const original=await pay.innerText();
  await p.keyboard.press('Enter');
  assert.equal(await pay.innerText(),'돈이 부족합니다.');
  assert(await pay.evaluate(e=>e.classList.contains('is-rejected')));
  assert.equal(await pay.locator('span').evaluate(e=>getComputedStyle(e).animationName),'world-choice-reject, title-signal');
  assert.deepEqual(await pay.locator('span').evaluate(e=>({text:e.dataset.text,before:getComputedStyle(e,'::before').animationName,after:getComputedStyle(e,'::after').animationName})),{text:'돈이 부족합니다.',before:'title-signal-slice',after:'title-signal-slice'});
  await p.waitForTimeout(350);
  assert.equal(await pay.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(239, 51, 64)');
  assert.equal(await p.evaluate(()=>barGame.progress.money),199);
  assert(await p.evaluate(()=>outsidePlaytest.model.story.speech.choice));
  await p.screenshot({path:'/private/tmp/outside-choice-rejected.png'});
  await p.keyboard.press('KeyS');assert.equal(await pay.innerText(),original);
  assert(!await pay.evaluate(e=>e.classList.contains('is-rejected')));
  await p.keyboard.press('KeyS');assert.equal(await selected(),'beggar-question');
  assert.equal(await question.innerText(),'???');await p.waitForTimeout(800);await p.keyboard.press('KeyE');
  assert.equal(await question.innerText(),'관련 정보가 필요합니다.');
  await p.keyboard.press('KeyS');assert.equal(await selected(),'beggar-pay');assert.equal(await question.innerText(),'???');
  // Mouse uses the same rejection path (Playwright's normal click respects aria-disabled).
  const box=await pay.boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
  assert.equal(await pay.innerText(),'돈이 부족합니다.');
  await panel.locator('[data-choice="beggar-refuse"]').hover();assert.equal(await pay.innerText(),original);
  await p.mouse.wheel(0,100);assert.equal(await selected(),'beggar-question');
  await p.keyboard.press('Space');assert(await question.evaluate(e=>e.classList.contains('is-rejected')));
  for(const width of [640,1280,1920]){
   await p.setViewportSize({width,height:width*9/16});await p.waitForTimeout(120);
   const r=await panel.boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=width*9/16+1,JSON.stringify(r));
  }
  await p.emulateMedia({reducedMotion:'reduce'});await p.keyboard.press('KeyE');
  assert.equal(await question.locator('span').evaluate(e=>getComputedStyle(e).animationName),'none');
  // Unlock while the menu is open: restore label and commit exactly once with Enter.
  await p.mouse.move(10,10);
  await p.evaluate(()=>{barGame.progress.money=200;outsidePlaytest.tick(0);});
  await pay.focus();assert.equal(await selected(),'beggar-pay');
  await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>barGame.progress.money),0);
  assert(!await p.evaluate(()=>outsidePlaytest.model.story.speech.choice));
  // Every conditional external branch supplies its own specific reason.
  const reasons=await p.evaluate(()=>{
   const m=outsidePlaytest.model,p=barGame.progress,all=[];m.story.cancel();m.config.day=1;m.config.flow='out';p.money=0;p.flags={};p.inventory={};
   for(const stage of ['cat','repair','boss-first','boss-repeat']){m.story.speech={line:{stage}};all.push(...LunaOutsideNeighborhood.choiceView(m).options);}
   for(const stage of ['items','greeting','quiz']){m.story.speech={line:{stage,item:'bitters'}};all.push(...LunaOutsideShop.choiceView(m).options);}
   all.push(...LunaOutsideThug.choiceView().options);m.story.speech=null;
   return all.filter(o=>o.disabled).map(o=>({id:o.id,reason:o.disabledReason}));
  });
  assert(reasons.length>=10);for(const r of reasons)assert(r.reason?.length>6&&r.reason.length<=20,JSON.stringify(r));
  assert.deepEqual(errors,[]);console.log('PASS outside locked-option focus, E/Enter/Space/mouse rejection, reset, no transaction, unlock, reasons, responsive layout and reduced motion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

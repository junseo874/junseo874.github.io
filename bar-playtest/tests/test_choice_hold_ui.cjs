const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{
   window.confirmed=[];window.advanced=0;const g=barGame,choose=g.choose,advance=g.advance;
   g.choose=function(id){confirmed.push({id,time:performance.now()});return choose.call(this,id);};
   g.advance=function(){advanced++;return advance.call(this);};
   window.setupChoice=()=>{
    g.reset(0,'story',1);g.tutorial=null;g.overlay=null;g.phase='regular';g.screen='bar';g.dialogue=null;g.transition=0;g.cameraLeft=0;g.cameraMoving=false;
    const step=g.t.steps.find(s=>s.type==='choice'&&g.t.scenes.some(c=>c.id===s.context&&Number(c.day)===0));
    g.story.scene=g.t.scenes.find(c=>c.id===step.context);g.story.steps=g.t.steps.filter(s=>s.context===step.context).sort((a,b)=>Number(a.seq)-Number(b.seq));g.story.index=g.story.steps.indexOf(step);g.choice=null;g.pump();lunaCampaign.render(true);
   };setupChoice();
  });
  const first=()=>p.locator('.choices button:not(:disabled)').first();
  assert.equal(await p.locator('.dialogue-wrap').count(),0,'choice without a preceding line has no empty bubble');
  await p.evaluate(()=>{const g=barGame,line=g.makeLine('luna','직전 바 대사');line.chars=line.text.length;g.lastStoryLine=line;g.changed();});
  await p.waitForTimeout(100);
  assert.equal(await p.locator('.dialogue-wrap').count(),0,'bar choices must not retain the preceding dialogue');
  await p.evaluate(()=>setupChoice());
  assert.equal(await p.locator('.choice-hold-hint').innerText(),'E키나 마우스 좌클릭으로 꾹 눌러 선택');
  for(const viewport of [{width:960,height:700},{width:1920,height:1080},{width:1280,height:720}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(100);
   const hint=await p.locator('.choice-hold-hint').boundingBox(),last=await p.locator('.choices button').last().boundingBox();
   assert(hint.y>=last.y+last.height&&hint.y+hint.height<=viewport.height&&hint.x>=0&&hint.x+hint.width<=viewport.width,'Hint stays below choices and inside the viewport');
  }
  const count=()=>p.evaluate(()=>confirmed.length);
  const progress=()=>first().evaluate(el=>Number(el.style.getPropertyValue('--choice-progress')));
  const glitch=()=>first().locator('.choice-label').evaluate(el=>({name:getComputedStyle(el).animationName,repeat:getComputedStyle(el).animationIterationCount,before:getComputedStyle(el,'::before').animationName,after:getComputedStyle(el,'::after').animationName,text:el.textContent,copy:el.dataset.text,time:el.getAnimations().find(a=>a.animationName==='title-signal')?.currentTime}));
  const reset=async()=>{await p.mouse.move(2,2);await p.evaluate(()=>setupChoice());await first().waitFor();};
  await first().click();assert.equal(await count(),0,'Tap is not confirmation');
  assert.equal((await glitch()).name,'none','Hover/focus alone does not glitch');
  await p.keyboard.press('Enter');await p.keyboard.press('Space');assert.equal(await count(),0);
  await first().hover();await p.mouse.down();await p.waitForTimeout(200);
  assert((await progress())>.2&&(await progress())<.9);assert.equal(await count(),0);
  const running=await glitch();assert.equal(running.name,'title-signal');assert.equal(running.repeat,'infinite');assert.equal(running.before,'title-signal-slice');assert.equal(running.after,'title-signal-slice');assert.equal(running.text,running.copy,'The complete choice text is duplicated into the title slices');
  await p.waitForTimeout(120);assert((await glitch()).time>running.time+70,'The same animation keeps running across hold progress updates');
  await p.screenshot({path:'/private/tmp/luna-choice-hold-half.png'});
  await p.mouse.up();assert.equal(await progress(),0);assert.equal(await count(),0);
  assert.equal((await glitch()).name,'none');assert.equal((await glitch()).before,'none');assert.equal((await glitch()).after,'none','All slices stop immediately on release');
  await p.mouse.down();await p.waitForTimeout(250);await p.mouse.move(2,2);await p.waitForTimeout(850);await p.mouse.up();assert.equal(await count(),0,'Leaving cancels');
  assert.equal((await glitch()).name,'none','Leaving the option removes the effect');
  await first().focus();await p.keyboard.down('Enter');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.waitForTimeout(800);await p.keyboard.up('Enter');assert.equal(await count(),0,'Moving selection cancels');
  assert.equal((await glitch()).name,'none');
  await first().focus();await p.keyboard.down('Space');await p.waitForTimeout(200);await p.evaluate(()=>{barGame.overlay='help';lunaCampaign.render(true);});await p.waitForTimeout(900);await p.keyboard.up('Space');assert.equal(await count(),0,'Overlay cancels');
  await reset();await p.keyboard.down('Enter');await p.waitForTimeout(200);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(900);await p.keyboard.up('Enter');assert.equal(await count(),0,'Blur cancels');
  await reset();await first().hover();const selected=await first().getAttribute('data-id');await p.mouse.down();await p.waitForTimeout(430);assert.equal(await count(),0,'Must not confirm at the old 0.4-second threshold');
  await p.waitForFunction(()=>confirmed.length===1,null,{timeout:350});await p.waitForTimeout(200);const advances=await p.evaluate(()=>advanced);await p.mouse.up();await p.waitForTimeout(100);
  assert.equal(await count(),1);assert.equal(await p.evaluate(()=>confirmed[0].id),selected);assert.equal(await p.evaluate(()=>advanced),advances,'Release must not advance next line');
  assert(await p.evaluate(()=>barGame.progress.flags.day0_choice_hold_learned),'Successful first choice is remembered');
  assert.equal(await p.locator('.choice-hold-hint').count(),0,'Hint disappears after the first selection');
  for(const key of ['KeyE','Enter','Space']){
   await reset();const before=await count();
   // D02: bar choices have no entry delay; D01's existing 0.5s hold is unchanged.
   await p.keyboard.down(key);await p.waitForTimeout(430);assert.equal(await count(),before,'Keyboard also waits beyond 0.4 seconds');
   await p.waitForFunction(n=>confirmed.length===n+1,before,{timeout:350});const a=await p.evaluate(()=>advanced);
   await p.keyboard.down(key);await p.waitForTimeout(200);await p.keyboard.up(key);assert.equal(await count(),before+1);assert.equal(await p.evaluate(()=>advanced),a,'Held/released key does not advance following dialogue');
  }
  assert.equal(await p.evaluate(()=>barGame.error),null);assert.deepEqual(errors,[]);
  await reset();await p.emulateMedia({reducedMotion:'reduce'});await first().focus();await p.keyboard.down('Space');await p.waitForTimeout(100);assert.equal((await glitch()).name,'none','Respect the same reduced-motion policy as the title');await p.keyboard.up('Space');
  console.log('PASS first-choice hint at 3 sizes, remembered completion, 0.5s mouse/E/Enter/Space hold, cancellation, one-shot confirmation and no next-line leak.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

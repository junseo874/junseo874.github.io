const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
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
  const count=()=>p.evaluate(()=>confirmed.length);
  const progress=()=>first().evaluate(el=>Number(el.style.getPropertyValue('--choice-progress')));
  const reset=async()=>{await p.mouse.move(2,2);await p.evaluate(()=>setupChoice());await first().waitFor();};
  await first().click();assert.equal(await count(),0,'Tap is not confirmation');
  await p.keyboard.press('Enter');await p.keyboard.press('Space');assert.equal(await count(),0);
  await first().hover();await p.mouse.down();await p.waitForTimeout(200);
  assert((await progress())>.2&&(await progress())<.9);assert.equal(await count(),0);
  await p.screenshot({path:'/private/tmp/luna-choice-hold-half.png'});
  await p.mouse.up();assert.equal(await progress(),0);assert.equal(await count(),0);
  await p.mouse.down();await p.waitForTimeout(250);await p.mouse.move(2,2);await p.waitForTimeout(850);await p.mouse.up();assert.equal(await count(),0,'Leaving cancels');
  await first().focus();await p.keyboard.down('Enter');await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await p.waitForTimeout(800);await p.keyboard.up('Enter');assert.equal(await count(),0,'Moving selection cancels');
  await first().focus();await p.keyboard.down('Space');await p.waitForTimeout(200);await p.evaluate(()=>{barGame.overlay='help';lunaCampaign.render(true);});await p.waitForTimeout(900);await p.keyboard.up('Space');assert.equal(await count(),0,'Overlay cancels');
  await reset();await p.keyboard.down('Enter');await p.waitForTimeout(200);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(900);await p.keyboard.up('Enter');assert.equal(await count(),0,'Blur cancels');
  await reset();await first().hover();const selected=await first().getAttribute('data-id');await p.mouse.down();await p.waitForTimeout(430);assert.equal(await count(),0,'Must not confirm at the old 0.4-second threshold');
  await p.waitForFunction(()=>confirmed.length===1,null,{timeout:350});await p.waitForTimeout(200);const advances=await p.evaluate(()=>advanced);await p.mouse.up();await p.waitForTimeout(100);
  assert.equal(await count(),1);assert.equal(await p.evaluate(()=>confirmed[0].id),selected);assert.equal(await p.evaluate(()=>advanced),advances,'Release must not advance next line');
  for(const key of ['Enter','Space']){
   await reset();const before=await count();await p.keyboard.down(key);await p.waitForTimeout(430);assert.equal(await count(),before,'Keyboard also waits beyond 0.4 seconds');
   await p.waitForFunction(n=>confirmed.length===n+1,before,{timeout:350});const a=await p.evaluate(()=>advanced);
   await p.keyboard.down(key);await p.waitForTimeout(200);await p.keyboard.up(key);assert.equal(await count(),before+1);assert.equal(await p.evaluate(()=>advanced),a,'Held/released key does not advance following dialogue');
  }
  assert.equal(await p.evaluate(()=>barGame.error),null);assert.deepEqual(errors,[]);
  console.log('PASS 0.5s mouse/Enter/Space hold, visible progress, short-tap/reset/leave/navigation/overlay/blur cancellation, one-shot confirmation and no next-line leak.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

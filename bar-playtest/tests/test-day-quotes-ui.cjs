const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
const expected=[
 ['"살아갈 이유가 있는 사람은 거의 어떤 삶의 방식도 견뎌낼 수 있다."','- 프리드리히 니체, 『우상의 황혼』 -'],
 ['"수동적인 감정은 우리가 그것에 대해 명석하고 판명한 관념을 형성하는 순간,\n수동적인 감정이기를 그친다."','- 바뤼흐 스피노자, 『에티카』 -'],
 ['"모든 인간은 예나 지금이나 노예와 자유인으로 나뉜다.\n하루의 3분의 2를 자기 자신을 위해 갖지 못하는 사람은 노예이기 때문이다."','- 프리드리히 니체, 『인간적인 너무나 인간적인』 -']
];
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{lunaCampaign.tick=()=>true;lunaCampaign.screen('developer');});
  const seek=async time=>{await p.evaluate(t=>{lunaCampaign.dayTransition.time=t;lunaCampaign.paintDayTransition();},time);return p.evaluate(()=>{
   const opacity=s=>+document.querySelector(s).style.opacity;
   return {text:opacity('.day-transition-quote-text'),author:opacity('.day-transition-author'),day:opacity('.day-transition-title'),old:opacity('.day-digit-old'),next:opacity('.day-digit-new'),shade:opacity('.day-transition-shade'),rise:document.querySelector('.day-transition-quote-text').style.transform};
  });};
  for(let from=0;from<3;from++){
   await p.evaluate(from=>{window.prepares=0;lunaCampaign.beginDayTransition(from,from+1,async()=>{prepares++;await new Promise(r=>{window.finishPrepare=r;});lunaCampaign.screen('developer');});},from);
   assert.equal(await p.locator('.day-transition-quote-text').textContent(),expected[from][0]);
   assert.equal(await p.locator('.day-transition-author').textContent(),expected[from][1]);
   assert.equal(await p.locator('.day-digit-old').textContent(),String(from));
   assert.equal(await p.locator('.day-digit-new').textContent(),String(from+1));
   for(const time of [.65,1.5,2.149,2.15]){
    const blank=await seek(time);assert.equal(blank.shade,1);assert.equal(blank.text,0);assert.equal(blank.author,0);assert.equal(blank.day,0);
   }
   let state=await seek(2.35);assert(state.text>0&&state.text<1&&state.author===0&&state.day===0&&state.shade===1);
   assert.notEqual(state.rise,'translateY(0px)');
   state=await seek(2.65);assert.equal(state.text,1);assert(state.author>0&&state.author<1);
   state=await seek(3.15);assert.equal(state.author,1);
   state=await seek(7.14);assert.equal(state.text,1);assert.equal(state.author,1);assert.equal(state.day,0);
   for(const key of ['KeyE','Enter','Space','Escape','Control'])await p.keyboard.press(key);
   assert.equal(await p.evaluate(()=>lunaCampaign.dayTransition.time),7.14);
   state=await seek(7.4);assert(state.text>0&&state.text<1&&state.day>0);assert.equal(state.old,1);assert.equal(state.next,0);
   state=await seek(8);assert.equal(state.text,0);assert.equal(state.author,0);assert.equal(state.old,1);
   state=await seek(8.325);assert(Math.abs(state.old-.5)<1e-6);assert(Math.abs(state.next-.5)<1e-6);
   await seek(3.5);
   await p.evaluate(()=>document.fonts.ready);
   const assertFontSize=async()=>assert(await p.evaluate(()=>{
    const original=Math.max(18,Math.min(innerWidth*.02,26)),size=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
    return Math.abs(size('.day-transition-quote-text')-original*.85)<.02&&Math.abs(size('.day-transition-author')-original*.85*.75)<.02;
   }),'Both quote and author are 15% smaller');
   await assertFontSize();
   const lines=await p.locator('.day-transition-quote-text').evaluate(el=>el.getBoundingClientRect().height/parseFloat(getComputedStyle(el).lineHeight));
   assert(Math.abs(lines-(from===0?1:2))<.1,'Respect authored line breaks without extra wrapping');
   await p.screenshot({path:'/private/tmp/day-quote-'+from+'.png'});
   for(const size of [{width:960,height:600},{width:390,height:844}]){
    await p.setViewportSize(size);await p.waitForTimeout(80);
    await assertFontSize();
    assert(await p.locator('.day-transition-quote').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1&&el.scrollWidth<=el.clientWidth+1&&Math.abs((a.left+a.right-b.left-b.right)/2)<1;}));
   }
   await p.setViewportSize({width:1280,height:720});
   // Pause does not consume hold time; the renderer is driven by the transition clock.
   assert(await p.evaluate(()=>{const d=lunaCampaign.dayTransition,t=d.time;Object.defineProperty(document,'hidden',{configurable:true,value:true});lunaCampaign.tickDayTransition(.5);delete document.hidden;return d.time===t;}));
   await p.evaluate(()=>{lunaCampaign.dayTransition.time=8.699;lunaCampaign.tickDayTransition(0);});
   assert.equal(await p.evaluate(()=>prepares),0);
   await p.evaluate(()=>{lunaCampaign.dayTransition.time=8.7;lunaCampaign.tickDayTransition(0);});
   await p.waitForFunction(()=>prepares===1);
   await p.evaluate(()=>{lunaCampaign.dayTransition.time=20;lunaCampaign.tickDayTransition(0);});
   assert.equal(await p.locator('.day-transition-shade').evaluate(el=>+el.style.opacity),1);
   assert.equal(await p.evaluate(()=>lunaCampaign.dayTransition.revealAt),null);
   await p.evaluate(()=>finishPrepare());await p.waitForFunction(()=>lunaCampaign.dayTransition.ready);
   await p.evaluate(()=>lunaCampaign.tickDayTransition(0));
   assert.equal(await p.evaluate(()=>lunaCampaign.dayTransition.revealAt),20);
   await p.evaluate(()=>{lunaCampaign.dayTransition.time=20.45;lunaCampaign.paintDayTransition();});
   assert(Math.abs(await p.locator('.day-transition-shade').evaluate(el=>+el.style.opacity)-.5)<1e-6);
   await p.evaluate(()=>{lunaCampaign.dayTransition.time=20.91;lunaCampaign.tickDayTransition(0);});
   assert.equal(await p.locator('.campaign-day-transition').count(),0);
   assert.equal(await p.evaluate(()=>prepares),1);assert.equal(await p.locator('#app').evaluate(el=>el.inert),false);
  }
  // Cancellation, including a queued prepare, cannot advance a stale transition.
  assert.equal(await p.evaluate(async()=>{let calls=0;const c=lunaCampaign;c.beginDayTransition(0,1,()=>calls++);c.dayTransition.time=8.75;c.tickDayTransition(0);c.cancelDayTransition();await Promise.resolve();await Promise.resolve();c.screen('developer');return calls;}),0);
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.evaluate(()=>lunaCampaign.beginDayTransition(1,2,()=>{}));
  assert.equal((await seek(2.35)).rise,'translateY(0px)');
  await p.evaluate(()=>{lunaCampaign.cancelDayTransition();lunaCampaign.screen('developer');});
  // Errors retain the authored day/quote when retrying; no input-lock dead end.
  await p.evaluate(()=>{const c=lunaCampaign;c.beginDayTransition(2,3,()=>Promise.reject(Error('test preparation failure')));c.dayTransition.time=8.75;c.tickDayTransition(0);});
  await p.waitForFunction(()=>lunaCampaign.view==='load-error');
  assert.equal(await p.locator('.campaign-day-transition').count(),0);
  await p.evaluate(()=>lunaCampaign.retryLoad());
  assert.equal(await p.locator('.day-transition-quote-text').textContent(),expected[2][0]);
  await p.evaluate(()=>{lunaCampaign.cancelDayTransition();lunaCampaign.screen('developer');});

  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await p.waitForFunction(()=>resourceReview.ready);
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  await f.evaluate(()=>{lunaCampaign.tick=()=>true;});
  const records=await p.evaluate(()=>resourceReview.rows.filter(r=>r.launch?.type==='day-transition'));
  assert.equal(records.length,3,'UI / effects / background each exposes the day options');
  for(const row of records)assert.deepEqual(row.variants.map(v=>v.label),['0일차 → 1일차','1일차 → 2일차','2일차 → 3일차']);
  await p.locator('[data-group="out-ui"]').click();
  await p.locator('[data-id="ui:day-transition"]').click();
  await p.locator('#inspect-state').selectOption('1-2');
  await p.locator('[data-action="launch"]').click();
  await f.waitForFunction(()=>lunaCampaign.dayTransition?.from===1);
  for(const from of [2,0,1]){
   await p.locator('#lab-state').selectOption(from+'-'+(from+1));
   await f.waitForFunction(day=>lunaCampaign.dayTransition?.from===day,from);
   assert.equal(await f.locator('.day-transition-quote-text').textContent(),expected[from][0]);
   await f.evaluate(()=>{lunaCampaign.dayTransition.time=3;lunaCampaign.paintDayTransition();});
   await p.locator('#replay').click();
   await f.waitForFunction(()=>lunaCampaign.dayTransition?.time===0);
  }
  await p.locator('#close-lab').click();
  assert.equal(await f.locator('.campaign-day-transition').count(),0);
  for(const row of records.filter(r=>r.id!=='ui:day-transition')){
   await p.evaluate(row=>resourceReview.launch({...row.variants[2].launch,reviewId:row.id,variantId:'2-3'},row.title,row.note),row);
   assert.equal(await p.locator('#lab-state').inputValue(),'2-3');
   assert.equal(await f.locator('.day-transition-quote-text').textContent(),expected[2][0]);
   await p.locator('#close-lab').click();
  }
  assert.deepEqual(errors,[]);
  console.log('DAY_QUOTES_OK: three exact quotes/line breaks, 15% smaller fonts, 1.5s black hold, staggered rise/fade, 4s reading hold, crossfade before roll, 3 sizes, pause/input/slow prepare/cancel/retry, all review selectors/replay/cleanup');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{barGame.reset(99,'practice',1,true);barGame.screen='bar';});
  const arrow=p.locator('.story-notice-arrow');
  for(const delta of [1,-1]){
   await p.evaluate(delta=>{LunaStoryNotices.clear();LunaStoryNotices.affinity(barGame.progress,'tom',delta);},delta);
   await arrow.waitFor({state:'visible'});await p.waitForTimeout(350);
   const r=await arrow.evaluate(el=>{
    const animation=el.getAnimations()[0];animation.pause();const samples=[];
    for(const time of [100,500,1000]){animation.currentTime=time;const css=getComputedStyle(el),ring=el.parentElement.getBoundingClientRect();samples.push({y:new DOMMatrixReadOnly(css.transform).m42,opacity:Number(css.opacity),ring:[ring.x,ring.y,ring.width,ring.height]});}
    animation.currentTime=500;return {text:el.textContent,samples,overflow:getComputedStyle(el.parentElement).overflow,iterations:animation.effect.getTiming().iterations===Infinity};
   });
   assert.equal(r.text,delta>0?'↑':'↓');assert.equal(r.overflow,'hidden');assert(r.iterations);
   assert(delta>0?r.samples[0].y>r.samples[1].y&&r.samples[1].y>r.samples[2].y:r.samples[0].y<r.samples[1].y&&r.samples[1].y<r.samples[2].y);
   assert.deepEqual(r.samples[0].ring,r.samples[2].ring,'Only arrow moves, never the circular frame');
   assert.equal(r.samples[1].opacity,1);assert(r.samples[2].opacity<1);
   await p.screenshot({path:'/private/tmp/affinity-arrow-'+(delta>0?'up':'down')+'.png'});
   await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(50);
   assert.equal(await arrow.evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await arrow.evaluate(el=>getComputedStyle(el).opacity),'1');
   await p.emulateMedia({reducedMotion:'no-preference'});
  }
  await p.evaluate(()=>{LunaStoryNotices.clear();delete barGame.progress.flags.port_met;LunaStoryNotices.meet(barGame.progress,'port');});
  await p.waitForFunction(()=>document.querySelector('.story-notice-people').dataset.kind==='meet');assert.equal(await arrow.count(),0);assert.equal(await p.locator('.story-notice-people .story-notice-icon').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS ascending/descending arrow motion, fixed circle, clipped fade, repeated animation, reduced motion and iconless discovery');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

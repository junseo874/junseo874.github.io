const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE+'?mode=minigames');
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('stir',v),variant);await p.locator('.stir-screen').waitFor();await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),0);
  await p.keyboard.press('KeyW');
  const result=await p.evaluate(()=>new Promise(resolve=>{
   const s=barGame.gimmick,spoon=document.querySelector('[data-spoon-angle]'),frames=[],samples=[];
   let begin=null,input=0,lastFrame=s.motionFrame,lastDom=null,domUpdates=0,stateUpdates=0,lastState=null,mismatches=0,identityLost=false;
   function sample(now){
    if(begin===null)begin=now;const t=now-begin;
    const node=document.querySelector('[data-spoon-angle]'),dom=Number(node.dataset.spoonAngle);
    identityLost ||= node!==spoon;
    if(lastState!==null&&s.spoonAngle!==lastState)stateUpdates++;
    if(lastDom!==null&&dom!==lastDom)domUpdates++;
    if(Math.abs(dom-s.spoonAngle)>.00051||Number(document.querySelector('[data-motion-frame]').dataset.motionFrame)!==s.motionFrame)mismatches++;
    for(const el of document.querySelectorAll('.stir-live-glass [data-ice-index]')){
     const c=s.ice[Number(el.dataset.iceIndex)],expect='translate('+(100+c.x)+' '+(100-c.y)+') rotate('+(-c.spin)+') scale(1)';
     if(el.getAttribute('transform')!==expect)mismatches++;
    }
    const order=[...document.querySelector('[data-side-ice]').children].map(el=>Number(el.dataset.iceIndex));
    const expected=s.ice.map((c,i)=>({i,y:c.y})).sort((a,b)=>b.y-a.y).map(c=>c.i);
    if(order.join(',')!==expected.join(','))mismatches++;
    if(s.motionFrame!==lastFrame){frames.push({t,frame:s.motionFrame});lastFrame=s.motionFrame;}
    samples.push({t,frame:s.motionFrame});lastDom=dom;lastState=s.spoonAngle;
    if(input<8&&t>=150+input*200){barGame.gimmickInput(['KeyD','KeyS','KeyA','KeyW'][input%4]);input++;}
    if(t<2600)requestAnimationFrame(sample);
    else resolve({variant:barGame.variant,samples:samples.length,frames,domUpdates,stateUpdates,mismatches,identityLost,pending:s.stirMotionPending,success:s.success,failures:s.failures,tail:samples.filter(r=>r.t>2250).map(r=>r.frame)});
   }requestAnimationFrame(sample);
  }));
  assert.equal(result.mismatches,0,'DOM must reflect the current simulation every frame');
  assert.equal(result.identityLost,false,'Do not recreate the spoon per frame');
  assert(result.domUpdates/result.stateUpdates>.9,'Spoon must not wait for the throttled full UI render');
  assert.equal(result.pending,0);assert.equal(new Set(result.tail).size,1,'No autonomous hand loop after input stops');
  assert.equal(result.success,2);assert.equal(result.failures,0);
  const gaps=result.frames.slice(1).map((f,i)=>f.t-result.frames[i].t).sort((a,b)=>a-b),median=gaps[Math.floor(gaps.length/2)];
  assert(median>=60&&median<=110,'12 FPS hand timing should remain even');
  console.log('STIR_CADENCE',JSON.stringify({variant,samples:result.samples,domUpdates:result.domUpdates,stateUpdates:result.stateUpdates,handMedianMs:Math.round(median),handMaxMs:Math.round(Math.max(...gaps))}));
  // Starting a new gesture, focus loss and retry must not leak animation time.
  await p.keyboard.press('KeyD');await p.keyboard.press('Escape');await p.waitForTimeout(100);
  const frozen=await p.evaluate(()=>({state:JSON.stringify(barGame.gimmick),top:document.querySelector('.stir-live-glass').innerHTML,side:document.querySelector('.stir-side-glass').innerHTML}));
  await p.waitForTimeout(250);
  assert.deepEqual(await p.evaluate(()=>({state:JSON.stringify(barGame.gimmick),top:document.querySelector('.stir-live-glass').innerHTML,side:document.querySelector('.stir-side-glass').innerHTML})),frozen);
  await p.keyboard.press('Escape');await p.evaluate(()=>barGame.retryMinigame());await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-motion-frame]').getAttribute('data-motion-frame'),'0');
  assert.equal(await p.evaluate(()=>barGame.gimmick.stirMotionPending),0);
 }
 assert.deepEqual(errors,[]);console.log('STIR_SMOOTH_UI_OK: both variants, per-frame spoon/ice, bounded gesture, pause, retry, unchanged scoring.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

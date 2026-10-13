const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.evaluate(()=>lunaCampaign.newGame('A'));
  await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  await p.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(c=>c.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
  await p.keyboard.press('KeyE');
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=1.22;m.updateNear();});
  await p.locator('.outside-interact-ready').waitFor({state:'visible'});
  await p.waitForTimeout(700);
  const info=await p.locator('.outside-interact').evaluate(el=>{
   const b=document.querySelector('.outside-background-speech'),s=getComputedStyle(el),r=el.getBoundingClientRect(),br=b.getBoundingClientRect();
   return {z:+s.zIndex,bubbleZ:+getComputedStyle(b).zIndex,y:r.y,bubbleBottom:br.bottom,animation:s.animationName};
  });
  assert(info.z>info.bubbleZ);assert(info.y>info.bubbleBottom);
  assert(info.animation.includes('outside-key-float'));
  // Freeze at exact float keyframes: motion is only two stage pixels.
  assert.equal(await p.locator('.outside-interact').evaluate(el=>{
   const a=el.getAnimations().find(a=>a.animationName==='outside-key-float');a.pause();a.currentTime=0;
   const y0=new DOMMatrix(getComputedStyle(el).transform).m42;a.currentTime=1400;
   return Math.abs(new DOMMatrix(getComputedStyle(el).transform).m42-y0);
  }),2);
  await p.screenshot({path:'/private/tmp/tv-interaction-prompt.png'});
  // Even when speech overlaps, hit testing must reach the E button first.
  assert(await p.locator('.outside-interact').evaluate(el=>{
   const r=el.getBoundingClientRect(),b=document.querySelector('.outside-background-speech'),saved=b.style.cssText;
   b.style.left=el.style.left;b.style.top=el.style.top;
   const front=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.outside-interact')===el;
   b.style.cssText=saved;return front;
  }));
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await p.locator('.outside-interact').evaluate(el=>getComputedStyle(el).animationName),'none');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.evaluate(()=>{lunaCampaign.storyVersion='B';outsidePlaytest.refreshHUD();});
  assert.equal(await p.locator('.outside-interact-ready').count(),0);
  await p.evaluate(()=>{lunaCampaign.storyVersion='A';outsidePlaytest.refreshHUD();});
  await p.locator('.outside-interact').click();
  await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition);
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.title),'TV 다큐 · 인공생명체의 역사');
  assert.deepEqual(errors,[]);
  console.log('INTERACTION_PROMPT_OK: TV screen anchor, foreground layer/hit target, 2px float, reduced motion, B preserved, documentary entry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

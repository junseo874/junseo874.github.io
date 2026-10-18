const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(()=>lunaCampaign.scene('night0','테라스','terrace',()=>{}));
  await page.waitForFunction(()=>!lunaCampaign.memoryTransition);
  await page.evaluate(()=>{lunaCampaign.tick=()=>{};});
  let checked=0;
  for(const [width,height]of [[1280,720],[640,360]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   for(const key of ['night0','night1','night2','ending']){
    const count=await page.evaluate(key=>LUNA_CAMPAIGN_DATA.scenes[key]?.length||0,key);
    for(let index=0;index<count;index++){
     await page.evaluate(({key,index})=>{const c=lunaCampaign;c.dialog={rows:LUNA_CAMPAIGN_DATA.scenes[key],index,chars:0,background:'terrace',done:()=>{}};c.screen('scene');},{key,index});
     const bubble=page.locator('.terrace-speech'),cue=bubble.locator('.dialogue-advance-cue');
     assert.equal(await bubble.locator('.textbox-piece').count(),11);
     assert(await cue.isHidden());const before=await bubble.boundingBox();
     assert(before.x>=0&&before.y>=0&&before.x+before.width<=width+1&&before.y+before.height<=height+1);
     const positions=await bubble.locator('.outside-speech-text>span').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y];}));
     await page.evaluate(()=>{lunaCampaign.dialog.chars=8;lunaCampaign.paintLine();});
     assert.deepEqual(await bubble.boundingBox(),before);
     assert.deepEqual(await bubble.locator('.outside-speech-text>span').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y];})),positions);
     // Reveal the remainder without advancing short lines to another actor.
     await page.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});
     assert.deepEqual(await bubble.boundingBox(),before);assert(await cue.isVisible());
     const style=await bubble.evaluate(e=>{const s=getComputedStyle(e),p=getComputedStyle(e.querySelector('p'));return{padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],background:s.backgroundColor,after:getComputedStyle(e,'::after').content,font:p.fontSize,align:p.textAlign,arrow:getComputedStyle(e.querySelector('.dialogue-advance-cue')).backgroundImage};});
     assert.deepEqual(style.padding,['14px','34px','14px','28px']);assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.after,'none');assert.equal(style.font,'17px');assert.equal(style.align,'center');assert(style.arrow.includes('IMG_textbox_arrow.png'));
     checked++;
    }
   }
  }
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog={rows:[{actor:'chris',text:'오늘도 수고했어. 잠깐 바람이라도 쐬고 들어가자.'},{actor:'luna',text:'응. 조금만 더 있다가 들어갈게.'}],index:0,chars:1e5,background:'terrace',done:()=>{}};c.screen('scene');});
  await page.screenshot({path:'/private/tmp/terrace-exterior-textbox.png'});
  await page.locator('.terrace-speech').click();assert.equal(await page.evaluate(()=>lunaCampaign.dialog.index),1);assert(await page.locator('.dialogue-advance-cue').isHidden());
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.rows[1]={actor:'luna',text:'와일드 독, 비터스, 각설탕을 기억해.',emphasis:['와일드 독','비터스','각설탕']};c.dialog.chars=1e5;c.draw();});
  assert.equal(await page.locator('.terrace-speech .outside-story-emphasis').first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 173, 104)');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.terrace-speech .dialogue-advance-cue').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);console.log('PASS terrace shared skin, '+checked+' line/viewport cases, stable glyph layout, cue, click advance, emphasis and reduced motion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

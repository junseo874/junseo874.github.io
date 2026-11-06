const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  const screenDrawn=()=>page.evaluate(()=>{
   const proto=CanvasRenderingContext2D.prototype,original=proto.drawImage;let drawn=false;
   proto.drawImage=function(image,...args){if(image?.src?.includes('IntractObjects_TV_on.png'))drawn=true;return original.call(this,image,...args);};
   try{outsidePlaytest.tick(0);}finally{proto.drawImage=original;}
   return drawn;
  });
  const choose=async id=>{await page.waitForTimeout(550);await page.locator('.world-choices [data-choice="'+id+'"]').click();};
  for(const day of [0,1,2,3])for(const flow of ['in','out']){
   await page.evaluate(async({day,flow})=>{
    LunaFocusSettings.setEnabled(false);
    const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(day);
    Object.assign(c.outside.config,{day,flow,place:'home'});await c.outside.start();c.screen(c.playView);
    const m=c.outside.model;m.controlsTutorial=false;m.story.cancel();m.x=1.22;m.updateNear();c.outside.snapCamera();c.outside.tick(0);
   },{day,flow});
   assert(await page.evaluate(()=>outsidePlaytest.model.tvOff));
   assert.equal(await screenDrawn(),false,'off screen layer is not drawn');
   assert.equal(await page.locator('.outside-interact').textContent(),'ETV 상호작용');
   assert.equal(await page.evaluate(()=>outsidePlaytest.model.backgroundStory.channels.size),0);
   await page.keyboard.press('KeyE');
   await page.locator('.world-choices [data-choice="confirm"]').waitFor({state:'visible'});
   assert.deepEqual(await page.locator('.world-choices button').allTextContents(),['본다','끈다','취소']);
   assert.equal(await screenDrawn(),true,'on screen layer is drawn');
   assert.equal(await page.evaluate(()=>lunaCampaign.cinema),null,'powering on never starts cinema directly');
   if(day!==0){
    await page.waitForTimeout(550);await page.keyboard.press('KeyE');
    const watch=page.locator('.world-choices [data-choice="confirm"]');
    assert.equal(await watch.textContent(),'볼만한 방송이 없습니다.');
    assert.match(await watch.getAttribute('class'),/is-rejected/);
    assert(await page.evaluate(()=>!outsidePlaytest.model.tvOff&&outsidePlaytest.model.dialog?.kind==='tv'));
    assert.equal(await page.evaluate(()=>outsidePlaytest.model.chooseObject('confirm')),false,'model also rejects unavailable watch');
    await page.keyboard.press('ArrowDown');
    assert.equal(await watch.textContent(),'본다','moving selection restores the label');
   }
   await choose('cancel');
   assert(await page.evaluate(()=>!outsidePlaytest.model.tvOff&&!outsidePlaytest.model.dialog));
   const expected=day===0?(flow==='in'?'outside_day0_documentary_ambient':'outside_day0_tv_news1'):day===1&&flow==='in'?'outside_day1_tv_news2':null;
   if(expected)await page.waitForFunction(id=>outsidePlaytest.model.backgroundStory.channels.has(id),expected,{timeout:60000});
   else assert.equal(await page.evaluate(()=>outsidePlaytest.model.backgroundStory.channels.size),0);
   if(day===1&&flow==='in'){
    await page.waitForFunction(()=>outsidePlaytest.model.backgroundStory.views().some(v=>v.text.length>=15));
    await page.screenshot({path:'/tmp/luna-tv-on-broadcast.png'});
   }
   await page.keyboard.press('KeyE');await page.keyboard.press('Escape');
   assert(await page.evaluate(()=>!outsidePlaytest.model.tvOff&&!outsidePlaytest.model.dialog),'Escape keeps power on');
   await page.keyboard.press('KeyE');await choose('off');
   assert(await page.evaluate(()=>outsidePlaytest.model.tvOff&&!outsidePlaytest.model.dialog));
   assert.equal(await screenDrawn(),false);
   assert.equal(await page.evaluate(()=>outsidePlaytest.model.backgroundStory.channels.size),0);
   await page.waitForTimeout(150);
   assert.equal(await page.locator('.outside-background-speech:not([hidden])').count(),0,'no stale broadcast after off');
   if(day===1&&flow==='in')await page.screenshot({path:'/tmp/luna-tv-off.png'});
  }
  assert.deepEqual(errors,[]);
  console.log('HOME_TV_POWER_OK: 8 day/period cases, actual screen layer rendering, power/menu/cancel/Escape/off, broadcast schedule and unavailable choice feedback');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

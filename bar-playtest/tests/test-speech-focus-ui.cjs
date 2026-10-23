const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:true});
   Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});
   await outsidePlaytest.start();lunaCampaign.screen('developer');
   const m=outsidePlaytest.model;m.story.cancel();m.encounter=null;
   m.story.beginRows('focus-test',{x:m.x,y:m.y},[0,1,2,3].map(i=>({type:'say',actor:'luna',text:'즐길 건 다 즐기면서 살고 있었구만. '+i})));
   m.story.speech.elapsed=99;outsidePlaytest.refreshHUD();
  });
  const bubble=page.locator('.outside-speech');
  await bubble.waitFor();await page.keyboard.press('Tab');await bubble.focus();
  assert(await bubble.evaluate(el=>el.matches(':focus-visible')),'keyboard focus reproduced');
  assert.equal(await bubble.locator('.exterior-textbox-skin').evaluate(el=>getComputedStyle(el).filter),'none','no automatic focus glow');
  for(const method of ['KeyE','Enter','click']) {
   const before=await page.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;outsidePlaytest.refreshHUD();return outsidePlaytest.model.story.speech.index;});
   if(method==='click')await bubble.click();else await page.keyboard.press(method);
   assert.equal(await page.evaluate(()=>outsidePlaytest.model.story.speech?.index),before+1,method+' still advances');
  }
  await page.evaluate(()=>{outsidePlaytest.exit(true);lunaCampaign.screen('notice');});
  for(const kind of ['terrace','cinema']) {
   await page.evaluate(kind=>{
    const stage=document.querySelector('#campaign-root .campaign-stage');
    stage.innerHTML='<div class="'+(kind==='terrace'?'terrace-scene':'')+'"><button id="speech-fixture" class="campaign-speech '+(kind==='terrace'?'terrace-speech':'exterior-textbox')+'" style="position:absolute;left:320px;top:220px;transform:none;width:400px">'+LunaExteriorTextbox.html()+'<p>즐길 건 다 즐기면서 살고 있었구만.</p></button></div><button id="choice-fixture">선택지</button>';
   },kind);
   const el=page.locator('#speech-fixture');
   await page.mouse.move(1,1);await page.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(250);
   const appearance=()=>el.evaluate(el=>{const s=getComputedStyle(el),skin=getComputedStyle(el.querySelector('.exterior-textbox-skin'));return {outline:s.outlineStyle,shadow:s.boxShadow,filter:s.filter,skinFilter:skin.filter,background:s.backgroundColor,border:s.borderColor};});
   const before=await appearance(),pixels=await el.screenshot();
   await page.keyboard.press('Tab');await el.focus();
   assert(await el.evaluate(el=>el.matches(':focus-visible')));
   assert.deepEqual(await appearance(),before,kind+' focused appearance stable');
   assert.equal(before.outline,'none');assert.equal(before.skinFilter,'none');
   assert.deepEqual(await el.screenshot(),pixels,kind+' focus pixels unchanged');
   await el.hover();await page.mouse.down();
   assert.deepEqual(await appearance(),before,kind+' hovered/pressed appearance stable');
   await page.mouse.up();
   await page.keyboard.press('ArrowDown');await page.locator('#choice-fixture').focus();
   const choice=await page.locator('#choice-fixture').evaluate(el=>({focused:document.activeElement===el,visible:el.matches(':focus-visible'),outline:getComputedStyle(el).outlineStyle}));
   assert(choice.focused&&choice.visible,'real choice keyboard focus: '+JSON.stringify(choice));
   // The site's existing global rule suppresses native outlines. Verify that
   // this dialogue sheet does not alter a non-dialogue button's focus styling.
   const unaffected=await page.locator('#choice-fixture').evaluate(el=>{
    const sheet=[...document.styleSheets].find(s=>s.href?.includes('/exterior-textbox.css'));
    const read=()=>{const s=getComputedStyle(el);return [s.outline,s.boxShadow,s.borderColor,s.backgroundColor,s.color];};
    const before=read();sheet.disabled=true;const after=read();sheet.disabled=false;return {before,after};
   });
   assert.deepEqual(unaffected.before,unaffected.after,'real choice focus styling unaffected');
  }
  assert.deepEqual(errors,[]);console.log('SPEECH_FOCUS_OK automatic focus, E/Enter/click, terrace/cinema unchanged pixels, choice focus retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const rt=require('../../tools/lib/test-runtime.cjs');
const text='... … ...... …… 잠깐만... 기다려… 1.5 / 가!?';
(async()=>{
 for(const file of ['stardust-400.ttf','stardust-700.ttf','stardust-800.ttf','font.ttf']){
  const path='bar-playtest/assets/fonts/'+file;
  assert(fs.readFileSync(path).equals(execFileSync('git',['show','HEAD:'+path])),'original font untouched: '+file);
 }
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  const metrics=await page.evaluate(async()=>{
   const old=new FontFace('OriginalStardust','url(assets/fonts/stardust-400.ttf)');document.fonts.add(await old.load());
   for(const weight of [400,700,800])await document.fonts.load(weight+' 18px LunaPixel','루나 ... …');
   const c=document.createElement('canvas').getContext('2d'),result=[];
   for(const size of [17,18,28])for(const value of ['.','...','…','루나 ABC 123 !?,']){
    const measure=family=>{c.font=size+'px '+family;const m=c.measureText(value);return {width:m.width,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent};};
    result.push({size,value,original:measure('OriginalStardust'),current:measure('LunaPixel')});
   }
   for(const [id,value]of [['marks','...…'],['letters','루나 ABC 123 !?,']])for(const weight of [400,700,800]){
    const el=document.createElement('span');el.id=id+weight;el.textContent=value;el.style.cssText=`position:fixed;top:0;font:${weight} 18px LunaPixel`;document.body.append(el);
   }
   return result;
  });
  for(const m of metrics)assert.deepEqual(m.current,m.original,'native glyph metrics including punctuation: '+JSON.stringify(m));
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  for(const kind of ['marks','letters'])for(const weight of [400,700,800]){
   const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#'+kind+weight});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   assert(fonts.length&&fonts.every(f=>f.isCustomFont&&/Stardust/i.test(f.familyName)),JSON.stringify(fonts));
  }
  await page.evaluate(text=>{
   for(const el of document.querySelectorAll('[id^="marks"],[id^="letters"]'))el.remove();
   lunaCampaign.screen('developer');const g=barGame;g.reset(99,'practice',1);g.screen='bar';g.phase='regular';g.speed=0;
   g.seats={L:{actor:'port',state:'STORY'},M:null,R:null};g.dialogue=g.makeLine('luna',text);g.dialogue.chars=999;g.changed();
  },text);
  await page.waitForFunction(()=>!barGame.cameraMoving&&barGame.transition===0);
  await page.locator('.dialogue-text').waitFor();
  assert.equal(await page.locator('.dialogue-text').evaluate(e=>getComputedStyle(e).letterSpacing),'normal','bar native spacing');
  await page.screenshot({path:'/private/tmp/luna-native-font-bar.png'});
  await page.evaluate(async text=>{
   Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();
   const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.x=-3;m.y=-.7;o.snapCamera();
   m.story.beginRows('marks-test',{x:m.x,y:m.y},[{type:'say',actor:'luna',text}]);m.story.speech.elapsed=99;o.tick(0);o.refreshHUD();
  },text);
  await page.locator('.outside-speech p').waitFor();
  assert.equal(await page.locator('.outside-speech p').getAttribute('aria-label'),text,'no text replacement');
  assert.equal(await page.locator('.outside-speech p').evaluate(e=>getComputedStyle(e).letterSpacing),'normal','outside native spacing');
  await page.screenshot({path:'/private/tmp/luna-native-font-outside.png'});
  await page.evaluate(text=>lunaCampaign.scene([{actor:'luna',text}],'테라스','terrace',()=>{}),text);
  await page.waitForFunction(()=>!lunaCampaign.memoryTransition);
  await page.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});
  await page.locator('.terrace-speech p').waitFor();
  assert.equal(await page.locator('.terrace-speech p').evaluate(e=>getComputedStyle(e).letterSpacing),'normal','terrace native spacing');
  await page.screenshot({path:'/private/tmp/luna-native-font-terrace.png'});
  await page.goto('http://127.0.0.1:8123/cutscene-studio/');
  const editor=await page.evaluate(async()=>{
   const old=new FontFace('OriginalEditor','url(../bar-playtest/assets/fonts/font.ttf)');document.fonts.add(await old.load());
   await document.fonts.load('18px StudioGame','루나 ... …');
   const c=document.createElement('canvas').getContext('2d');
   return ['.','...','…','루나 ABC 123 !?,'].map(value=>{
    const measure=family=>{c.font='18px '+family;const m=c.measureText(value);return {width:m.width,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent};};
    return {value,current:measure('"LunaPixel", "StudioGame", sans-serif'),original:measure('OriginalEditor')};
   });
  });
  for(const m of editor)assert.deepEqual(m.current,m.original,'editor original font: '+m.value);
  assert(!requests.some(url=>/dialogue-marks|luna-dialogue-marks|kopubworld/.test(url)),'no replacement font or stylesheet requests');
  assert.deepEqual(errors,[]);
  console.log('NATIVE_DIALOGUE_FONT_OK original bytes, glyph widths/heights including dots, zero added spacing, 17/18/28px, 400/700/800, bar/exterior/terrace/editor Canvas, unchanged text, no supplemental font');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

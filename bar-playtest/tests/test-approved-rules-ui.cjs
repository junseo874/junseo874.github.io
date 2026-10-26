const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();const m=outsidePlaytest.model;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=LunaHomeArt.wardrobeTarget().x;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
 await page.keyboard.press('KeyE');await page.locator('.world-choices:visible').waitFor();
 await page.keyboard.press('Escape');assert(await page.evaluate(()=>!outsidePlaytest.model.story.blocking));assert.equal(await page.locator('.luna-settings:visible').count(),0);
 await page.keyboard.press('Escape');await page.locator('.luna-settings:visible').waitFor();await page.keyboard.press('Escape');
 const measurements=await page.evaluate(()=>{
  const stage=document.querySelector('.outside-stage'),el=document.createElement('div');el.className='outside-speech';el.innerHTML='<p>화면 가장자리에서 긴 말풍선이 화면 밖으로 나가지 않으며 꼬리는 화자를 가리킵니다.</p>';stage.append(el);LunaExteriorTextbox.attach(el);
  const out=[];for(const x of [60,640,1220]){LunaWorldSpeech.place(el,{x,y:400});const s=stage.getBoundingClientRect(),b=el.getBoundingClientRect(),tail=el.querySelector('.piece-9').getBoundingClientRect(),scale=s.width/1280;out.push({left:(b.left-s.left)/scale,right:(b.right-s.left)/scale,tail:((tail.left+tail.right)/2-s.left)/scale,x});}el.remove();return out;
 });
 for(const m of measurements){assert(m.left>=11&&m.right<=1269,JSON.stringify(m));assert(Math.abs(m.tail-m.x)<2,JSON.stringify(m));}
 const stability=await page.evaluate(()=>{const m=outsidePlaytest.model,original=m.targets;m.targets=()=>[{id:'a',x:0},{id:'b',x:.2}];m.x=.099;m.updateNear();const first=m.near.id;m.x=.101;m.updateNear();const retained=m.near.id;m.x=.16;m.updateNear();const next=m.near.id;m.targets=original;m.updateNear();return {first,retained,next};});
 assert.deepEqual(stability,{first:'a',retained:'a',next:'b'});
 await page.evaluate(()=>{outsidePlaytest.exit(true);lunaCampaign.scene([{actor:'luna',text:'첫 번째 대사'},{actor:'chris',text:'다음 대사'}],'입력 검수','black',()=>{});});
 await page.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
 assert.equal(await page.evaluate(()=>lunaCampaign.canSkipCinema()),false);
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(700);await page.keyboard.up('ControlLeft');assert.equal(await page.evaluate(()=>lunaCampaign.dialog.index),0);
 assert.notEqual(await page.evaluate(()=>getComputedStyle(lunaCampaign.host).cursor),'none','manual dialogue keeps pointer');
 await page.screenshot({path:'/private/tmp/approved-rules-manual-dialogue.png'});
 assert.deepEqual(errors,[]);console.log('APPROVED_RULES_UI_OK: topmost cancel then settings, left/right bubble clamping with attached tail, nearest-target hysteresis, no Ctrl/Space skip and manual pointer');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{
   const g=barGame;g.reset(0,'story',1);g.overlay=null;g.tutorial=null;g.phase='regular';g.screen='bar';g.dialogue=null;g.transition=0;g.cameraLeft=0;g.cameraMoving=false;
   g.seats={L:null,M:{actor:'port',state:'STORY'},R:null};g.focus='M';g.overview=false;
   const rows=['안녕하세요. 오늘부터 함께 일하게 된 루나입니다.','이곳에서는 어떤 일을 하면 될까요?','칵테일 만드는 방법을 알려 주세요.','아직 고를 수 없는 선택지'];
   g.choice={step:{arg:'resource-test'},rows:rows.map((text,i)=>({seq:String(i+1),'text.ko':text,'text.en':text,when:i===3?'false':'',lock_reason:'잠겨 있습니다.'}))};
   window.choiceFixture=g.choice;window.chosen=[];const choose=g.choose;g.choose=function(id){chosen.push(id);return choose.call(this,id);};
   lunaCampaign.render(true);
  });
  const buttons=p.locator('.choices button');await buttons.first().waitFor();
  assert.equal(await buttons.count(),4);
  const gauge=await buttons.first().evaluate(el=>{
   const meter=el.querySelector('.choice-progress'),box=el.getBoundingClientRect(),r=meter.getBoundingClientRect();
   return {height:r.height,width:r.width/box.width,left:(r.left-box.left)/box.width,right:(box.right-r.right)/box.width,bottom:(box.bottom-r.bottom)/box.height,idleWidth:parseFloat(getComputedStyle(meter,'::before').width)/r.width};
  });
  assert.equal(gauge.height,2);assert(Math.abs(gauge.width-.89)<.001);assert(Math.abs(gauge.left-.06)<.001);assert(Math.abs(gauge.right-.05)<.001);assert(Math.abs(gauge.bottom-4/156)<.001);assert(Math.abs(gauge.idleWidth-.14)<.001);
  const styles=()=>buttons.evaluateAll(els=>els.map(el=>({bg:getComputedStyle(el,'::before').backgroundImage,arrow:getComputedStyle(el,'::after').opacity,gauge:getComputedStyle(el.querySelector('.choice-progress'),'::before').backgroundColor,box:el.getBoundingClientRect().toJSON()})));
  let s=await styles();assert(s[0].bg.includes('IMG_choice_B.png'));assert(s[1].bg.includes('IMG_choice_A.png'));assert.equal(s[0].box.width,675);
  await buttons.nth(1).hover();s=await styles();assert(s[1].bg.includes('IMG_choice_B.png'));assert(s[0].bg.includes('IMG_choice_A.png'));assert.equal(s[1].arrow,'1');assert.equal(s[0].arrow,'0');assert.equal(s[1].box.width,s[0].box.width);
  assert.equal(s[1].gauge,'rgb(84, 223, 234)','Hovered gauge follows cyan choice highlight');assert.equal(s[0].gauge,'rgb(150, 155, 158)','Previous gauge returns to neutral');
  await buttons.nth(3).hover();s=await styles();assert.equal(s[3].gauge,'rgb(150, 155, 158)','Disabled choice stays neutral');
  assert(await buttons.first().evaluate(el=>LunaUIAudioPolicy.allows(el,'hover')&&!LunaUIAudioPolicy.allows(el,'click')));
  await p.mouse.move(2,2);await buttons.first().focus();await p.keyboard.press('ArrowDown');assert(await buttons.nth(1).evaluate(el=>el===document.activeElement));
  s=await styles();assert.equal(s[1].gauge,'rgb(84, 223, 234)','Keyboard focus uses the same cyan gauge');assert.equal(s[0].gauge,'rgb(150, 155, 158)');
  await buttons.first().focus();await p.screenshot({path:'/private/tmp/luna-choice-resources.png'});
  for(const size of [{width:960,height:540},{width:1920,height:1080}]){await p.setViewportSize(size);await p.waitForTimeout(100);const b=await p.locator('.choices').boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=size.width&&b.y+b.height<=size.height);}
  await p.setViewportSize({width:1280,height:720});
  await p.evaluate(()=>{choiceFixture.rows[0]['text.ko']='안녕하세요. 오늘부터 함께 일하게 된 루나입니다. 아직은 서툴지만 손님에게 어울리는 한 잔을 만들어 보고 싶어요.';lunaCampaign.render(true);});
  await p.mouse.move(2,2);await buttons.first().focus();
  const before=await buttons.first().boundingBox();
  assert(await buttons.first().locator('.choice-label').evaluate(el=>el.offsetHeight>parseFloat(getComputedStyle(el).lineHeight)*1.5),'Long labels wrap');
  await p.keyboard.down('Space');await p.waitForTimeout(120);
  assert.equal(await buttons.first().locator('.choice-label').evaluate(el=>getComputedStyle(el).animationName),'title-signal');
  assert.equal(await buttons.nth(1).locator('.choice-label').evaluate(el=>getComputedStyle(el).animationName),'none','Other choices remain still');
  const during=await buttons.first().boundingBox();assert.equal(during.width,before.width);assert.equal(during.height,before.height,'Glitch does not shift the multiline choice layout');
  await p.screenshot({path:'/private/tmp/luna-choice-hold-glitch-multiline.png'});await p.keyboard.up('Space');
  assert.equal(await buttons.first().locator('.choice-label').evaluate(el=>getComputedStyle(el).animationName),'none');
  // Use an actual script choice to verify the unchanged keyboard confirmation path.
  await p.evaluate(()=>{
   const g=barGame,step=g.t.steps.find(s=>s.type==='choice'&&g.t.scenes.some(c=>c.id===s.context&&Number(c.day)===g.day));
   const scene=g.t.scenes.find(c=>c.id===step.context);g.story.scene=scene;g.story.steps=g.t.steps.filter(s=>s.context===scene.id).sort((a,b)=>Number(a.seq)-Number(b.seq));g.story.index=g.story.steps.findIndex(s=>s===step);g.dialogue=null;g.choice=null;g.cameraMoving=false;g.cameraLeft=0;g.transition=0;g.pump();lunaCampaign.render(true);
  });
  await p.locator('.choices button:not(:disabled)').first().waitFor();
  await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
  await p.locator('.choices button:not(:disabled)').first().focus();
  await p.keyboard.down('Enter');await p.waitForFunction(()=>chosen.length===1);await p.keyboard.up('Enter');assert.equal(await p.evaluate(()=>barGame.error),null);
  assert.deepEqual(errors,[]);console.log('PASS choice PNG states, single hover/focus highlight, keyboard navigation/confirmation, hover-only audio policy, 960/1280/1920 layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

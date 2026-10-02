const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 const pair='outside_day0_port_pair',poster='outside_day0_shiba_wanted';
 async function start(cfg){await p.evaluate(async cfg=>{outsidePlaytest.exit(true);lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar',variant:'original',...cfg});await outsidePlaytest.start();},cfg);}
 for(const variant of ['original','gpt']){
  await start({variant});await p.keyboard.down('KeyA');await p.waitForFunction(()=>!!outsidePlaytest.model.backgroundStory.speech);await p.keyboard.up('KeyA');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.backgroundStory.speech.id),pair);assert.equal(await p.locator('.outside-background-speech strong').count(),0);assert.equal(await p.locator('.outside-background-text').getAttribute('aria-label'),'저기 언노운에 불 켜져 있는데? 영업 다시 시작하는 건가?');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.blocking),false);assert.equal(await p.evaluate(()=>outsidePlaytest.camera.w),4.8);await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.backgroundStory.speech.index),0);
  await p.evaluate(()=>{outsidePlaytest.model.backgroundStory.speech.elapsed=5;outsidePlaytest.refreshHUD();});await p.screenshot({path:'/private/tmp/outside-notion-pair-'+variant+'.png'});
  const seen=await p.evaluate(()=>{const a=outsidePlaytest,m=a.model,seen=new Set([LUNA_OUTSIDE_DIALOGUES.outside_day0_port_pair[0].text]);for(let i=0;i<1200;i++){if(m.backgroundStory.speech)seen.add(m.backgroundStory.speech.line.text);a.tick(.05);}return [...seen];});assert.equal(seen.length,5);
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=m.targets().find(t=>t.id==='wanted-poster').x;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});assert(await p.locator('.outside-interact').isVisible());
  for(let i=0;i<2;i++){await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.id),poster);await p.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=5;outsidePlaytest.refreshHUD();});assert.equal(await p.locator('.outside-speech strong').count(),0);assert.equal(await p.locator('.outside-speech p').evaluate(e=>getComputedStyle(e).marginTop),'0px');if(i===0)await p.screenshot({path:'/private/tmp/outside-notion-poster-'+variant+'.png'});await p.evaluate(()=>{const s=outsidePlaytest.model.story;for(let i=0;s.speech&&i<20;i++)s.advance();});}
 }
 // Real draw calls: removed street props must not be drawn even at their old positions.
 const retired=await p.evaluate(()=>{const a=outsidePlaytest,d=LUNA_OUTSIDE_DATA,ctx=document.querySelector('#outside-root canvas').getContext('2d'),original=ctx.drawImage;let bad=[];for(const day of [0,1,2,3]){a.model.start({day,flow:'out'});for(const n of d.scenes.street.nodes.filter(n=>['1 experiment_recruit','3 poster_help_wanted','7 poster_human_trafficking','10 real_estate_posting'].includes(n.name))){a.model.x=n.x;a.snapCamera();ctx.drawImage=function(im,...args){if(im.src.endsWith(d.assets[n.sprite.asset].src)&&args.slice(0,4).join()===['x','y','w','h'].map(k=>n.sprite[k]).join())bad.push(n.name);return original.call(this,im,...args);};a.tick(0);}}ctx.drawImage=original;return bad;});assert.deepEqual(retired,[]);
 await start({day:99});await p.keyboard.press('Tab');const labels=await p.locator('[data-qa-field="outsideCase"] option').allTextContents();assert(labels.some(s=>s.includes('포트 가게 앞')));assert(labels.some(s=>s.includes('지명수배')));assert(!labels.some(s=>/임상시험|라디오|TV|시바 ·|구인|퇴근하던 행인|병 상자|주민/.test(s)));assert.equal(await p.locator('[data-qa-field="snack"]').count(),0);await p.screenshot({path:'/private/tmp/outside-notion-qa-list.png'});
 // Every QA dialogue/runtime scene remains runnable, with both activation overrides.
 await p.keyboard.press('Tab');
 const cases=await p.evaluate(()=>LunaOutsideQA.catalog().filter(c=>!c.physical&&!c.shop).map(c=>c.id));
 for(const id of cases)for(const activation of ['manual','proximity']){
  await p.evaluate(({id,activation})=>{const a=outsidePlaytest;a.model.start({day:99,qaCase:id,qaActivation:activation});a.model.x=0;a.model.updateNear();a.snapCamera();if(activation==='manual')a.model.interact();for(let i=0;i<60;i++)a.tick(.02);},{id,activation});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech?.id),id);assert(await p.locator('.outside-speech').isVisible());assert.equal(await p.locator('.outside-speech strong').count(),0);
 }
 for(const id of ['lift-up','lift-down','lift-call','lift-logo']){
  await p.evaluate(id=>{const a=outsidePlaytest,m=a.model;m.start({day:99,qaCase:id});m.x=LunaResidence.layout.elevatorX;m.updateNear();m.interact();for(let i=0;i<10;i++)a.tick(.05);},id);assert(await p.evaluate(()=>!!outsidePlaytest.model.ride));assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.story.speech),false);
 }
 // Actual main-campaign route uses the same curated content, not old fallbacks.
 await p.evaluate(async()=>{outsidePlaytest.exit(true);lunaCampaign.session.developer=false;lunaCampaign.session.day=0;await lunaCampaign.street('out','bar');});await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.doorTransition);await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=-.9;outsidePlaytest.tick(.02);});assert(await p.evaluate(()=>lunaCampaign.active));assert.equal(await p.evaluate(()=>outsidePlaytest.model.backgroundStory.speech?.id),pair);assert.deepEqual(await p.evaluate(()=>Object.keys(LUNA_OUTSIDE_DIALOGUES)),[pair,'outside_day1_samho_smuggler',poster]);
 assert.deepEqual(errors,[]);console.log('OUTSIDE_NOTION_UI_OK: original/GPT/main, auto pair, repeatable poster, retired props not rendered, QA catalog and all remaining scenes, silent elevators');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

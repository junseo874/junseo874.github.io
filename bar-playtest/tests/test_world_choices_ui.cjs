const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.evaluate(()=>lunaCampaign.newGame('A'));await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  await p.evaluate(()=>{const c=lunaCampaign,first=c.cinema.scene.clips.find(l=>l.choiceAfter);window.guideSounds=0;const play=LunaControlsTutorial.play;LunaControlsTutorial.play=(...a)=>{guideSounds++;return play(...a);};c.cinema.time=first.start;c.cinema.dialogueWait={id:first.id,age:0,revealed:false};c.cinema.player.render(first.start,null,false,0,c.cinema.dialogueWait);});
  await p.keyboard.press('KeyE');await p.waitForSelector('.world-choices:not([hidden])');
  const selected=()=>p.locator('.world-choices:not([hidden]) .is-selected').getAttribute('data-choice');
  assert.equal(await selected(),'awake');assert(await p.locator('#campaign-root .world-choice-tutorial').isVisible());
  const guide=p.locator('#campaign-root .world-choice-tutorial');
  assert.equal(await guide.locator('.choice-guide-confirm').textContent(),'E로 선택 확정');
  assert(!/휠 위|휠 아래|마우스 클릭|끝에서|반대쪽/.test(await guide.innerText()));
  assert.equal(await guide.locator('.choice-guide-mouse .choice-guide-wheel').count(),2);
  assert.deepEqual(await guide.locator('.choice-guide-triangle polygon').evaluateAll(es=>es.map(e=>e.getAttribute('points'))),['6,1 11,9 1,9','1,1 11,1 6,9']);
  assert.equal(await guide.evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(108, 189, 201)');
  assert.equal(await guide.locator('header').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await p.waitForTimeout(350);await p.screenshot({path:'/private/tmp/first-contact-choice.png'});
  assert.deepEqual(await p.locator('#campaign-root .world-choices .is-selected').evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color})),{background:'rgb(80, 217, 245)',text:'rgb(8, 43, 54)'});
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.find(l=>l.choiceAfter).text.match(/\[c:(#[a-f0-9]+)\]/i)[1]),'#50d9f5');
  assert.equal(await p.locator('#campaign-root .world-choice-confirm').evaluate(e=>getComputedStyle(e).color),'rgb(80, 217, 245)');
  const markerState=()=>p.locator('#campaign-root .world-choices').evaluate(panel=>{
   const marker=panel.querySelector('.world-choice-confirm'),row=panel.querySelector('.is-selected'),inactive=panel.querySelector('button:not(.is-selected)'),m=marker.getBoundingClientRect(),r=row.getBoundingClientRect(),css=getComputedStyle(inactive);
   window.originalChoiceMarker??=marker;
   return {count:panel.querySelectorAll('.world-choice-confirm').length,inside:panel.querySelectorAll('button kbd').length,same:originalChoiceMarker===marker,markerLeft:m.x,markerRight:m.right,rowLeft:r.x,markerY:m.y+m.height/2,rowY:r.y+r.height/2,width:panel.offsetWidth,font:getComputedStyle(row).fontSize,background:css.backgroundColor,image:css.backgroundImage,motion:getComputedStyle(marker).transitionDuration,quiet:['hover','click'].every(kind=>LunaUIAudioPolicy.allows(row,kind)===false)};
  });
  const firstMarker=await markerState();assert.equal(firstMarker.count,1);assert.equal(firstMarker.inside,0);assert(firstMarker.markerRight<firstMarker.rowLeft);assert.equal(firstMarker.width,270);assert.equal(firstMarker.font,'16px');assert.equal(firstMarker.background,'rgba(0, 0, 0, 0)');assert.equal(firstMarker.image,'none');assert(firstMarker.quiet);assert.equal(firstMarker.motion,'0.14s');
  await p.keyboard.press('KeyQ');assert.equal(await selected(),'awake');
  await p.keyboard.press('KeyW');assert.equal(await selected(),'silent');
  await p.waitForTimeout(200);const secondMarker=await markerState();assert(secondMarker.same&&secondMarker.markerY>firstMarker.markerY&&Math.abs(secondMarker.markerY-secondMarker.rowY)<1);
  const fittedRows=await p.locator('#campaign-root .world-choices button').evaluateAll(rows=>rows.map(row=>({width:row.offsetWidth,text:row.querySelector('span').getBoundingClientRect().width,left:row.offsetLeft})));
  assert(fittedRows[1].width<fittedRows[0].width&&fittedRows[1].width<70);
  assert(fittedRows.every(row=>Math.abs(row.width-row.text-23)<2),'Background fits text plus only padding/borders');
  assert.equal(fittedRows[0].left,fittedRows[1].left,'Choice and E columns stay fixed while widths differ');
  await p.screenshot({path:'/private/tmp/compact-choice-second-row.png'});
  await p.keyboard.press('KeyS');assert.equal(await selected(),'awake');
  await p.mouse.wheel(0,-100);assert.equal(await selected(),'silent');
  await p.keyboard.press('Space');await p.keyboard.press('Enter');assert(await p.evaluate(()=>!!lunaCampaign.cinema.dialogueChoice));
  await p.keyboard.press('Escape');assert(!(await p.locator('#campaign-root .world-choice-tutorial').count()));
  await p.keyboard.press('Escape');assert.equal(await selected(),'silent');assert.equal(await p.evaluate(()=>guideSounds),1);
  await p.waitForTimeout(820);await p.keyboard.down('KeyE');await p.keyboard.down('KeyE');await p.waitForTimeout(650);
  assert(!(await p.locator('#campaign-root .world-choice-tutorial').isVisible()));
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.find(l=>l.id===lunaCampaign.cinema.dialogueWait.id).text),'....');
  await p.keyboard.up('KeyE');
  await p.keyboard.press('KeyE');await p.keyboard.press('KeyE');await p.waitForTimeout(550);
  assert((await p.evaluate(()=>lunaCampaign.cinema.scene.clips.find(l=>l.id===lunaCampaign.cinema.dialogueWait.id).text)).includes('일어났으면 빨리'));
  // A fresh run can choose the other response; typing completion reveals choices automatically.
  await p.evaluate(()=>lunaCampaign.newGame('A'));await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  await p.evaluate(()=>{const c=lunaCampaign,first=c.cinema.scene.clips.find(l=>l.choiceAfter);c.cinema.time=first.start;c.cinema.dialogueWait={id:first.id,age:99,revealed:false};});
  await p.waitForSelector('#campaign-root .world-choices:not([hidden])');
  for(const width of [640,1920]){await p.setViewportSize({width,height:width*9/16});await p.waitForTimeout(180);const box=await p.locator('#campaign-root .world-choices').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=width*9/16+1,JSON.stringify({width,box}));}
  await p.setViewportSize({width:1280,height:720});await p.locator('[data-choice="awake"]').click();await p.waitForTimeout(550);
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.find(l=>l.id===lunaCampaign.cinema.dialogueWait.id).text),'지금 일어났어요.');
  await p.keyboard.press('KeyE');await p.keyboard.press('KeyE');await p.waitForTimeout(550);
  assert((await p.evaluate(()=>lunaCampaign.cinema.scene.clips.find(l=>l.id===lunaCampaign.cinema.dialogueWait.id).text)).includes('일어났으면 빨리'));
  // Four rows, disabled skipping, wrap, opposite-facing placement and pointer confirmation.
  await p.evaluate(()=>{lunaCampaign.toPicker();lunaCampaign.screen('game');const stage=document.createElement('div');stage.id='choice-test-stage';Object.assign(stage.style,{position:'fixed',inset:'0',width:'1280px',height:'720px',zIndex:999});document.body.append(stage);window.testChoiceView={key:'four',head:{x:640,y:350},facing:-1,options:[{id:'a',label:'첫 번째'},{id:'b',label:'두 번째',disabled:true},{id:'c',label:'세 번째'},{id:'d',label:'네 번째'}]};window.testChoiceUI=LunaWorldChoices.create(stage,id=>window.confirmedChoice=id);testChoiceUI.update(testChoiceView);window.addEventListener('keydown',testChoiceUI.key,true);});
  assert.equal(await p.locator('.world-choices').getAttribute('data-side'),'right');
  await p.keyboard.press('KeyW');assert.equal(await selected(),'d');await p.keyboard.press('KeyS');assert.equal(await selected(),'a');await p.keyboard.press('KeyS');assert.equal(await selected(),'c');
  await p.evaluate(()=>{testChoiceView.options[2].label='아주 긴 선택지도 화면 밖으로 나가지 않고 문장 길이에 맞춰 자연스럽게 줄바꿈되어야 합니다. 공백없는긴선택지문장도화면밖으로넘치지않아야합니다.';testChoiceUI.update(testChoiceView);});
  const wrapped=await p.locator('[data-choice="c"]').evaluate(e=>({width:e.offsetWidth,height:e.offsetHeight,fits:e.scrollWidth<=e.clientWidth}));assert(wrapped.width<=270&&wrapped.height>32&&wrapped.fits);
  await p.evaluate(()=>{testChoiceView.facing=1;testChoiceUI.update(testChoiceView);});assert.equal(await p.locator('.world-choices').getAttribute('data-side'),'left');
  await p.waitForTimeout(400);
  const mirrored=await p.locator('.world-choices').evaluate(panel=>{const rows=[...panel.querySelectorAll('button')],marker=panel.querySelector('.world-choice-confirm'),m=marker.getBoundingClientRect(),arrow=getComputedStyle(marker,':after');return {edges:rows.map(e=>e.getBoundingClientRect().right),align:rows.map(e=>getComputedStyle(e).textAlign),markerLeft:m.left,arrow:[arrow.borderLeftWidth,arrow.borderRightWidth]};});
  assert(mirrored.edges.every(x=>Math.abs(x-mirrored.edges[0])<1));assert(mirrored.align.every(x=>x==='right'));assert(mirrored.markerLeft>mirrored.edges[0]);assert.deepEqual(mirrored.arrow,['0px','5px']);
  await p.keyboard.press('KeyS');assert.equal(await selected(),'d');await p.waitForTimeout(180);
  assert(await p.locator('.world-choices').evaluate(panel=>{const m=panel.querySelector('.world-choice-confirm').getBoundingClientRect(),r=panel.querySelector('.is-selected').getBoundingClientRect();return Math.abs(m.y+m.height/2-r.y-r.height/2)<1;}));
  await p.evaluate(()=>{testChoiceView.head.x=1270;testChoiceUI.update(testChoiceView);});const rightEdge=await p.locator('.world-choice-confirm').boundingBox();assert(rightEdge.x+rightEdge.width<=1280);
  await p.evaluate(()=>{testChoiceView.head.x=10;testChoiceUI.update(testChoiceView);});assert((await p.locator('.world-choice-confirm').boundingBox()).x>=0);
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.world-choice-confirm').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await p.locator('[data-choice="d"]').click();assert.equal(await p.evaluate(()=>confirmedChoice),'d');
  await p.evaluate(()=>{window.removeEventListener('keydown',testChoiceUI.key,true);testChoiceUI.dispose();document.querySelector('#choice-test-stage').remove();});
  await p.evaluate(async()=>{const c=lunaCampaign;c.session.install({developer:false});barGame.reset(0,'full',1,false);barGame.progress.money=500;Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();c.screen(c.playView);const m=outsidePlaytest.model;m.x=LunaOutsideBeggar.people[0].x+.27;m.story.cancel();m.backgroundStory.cancel();m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  await p.keyboard.press('KeyE');await p.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<40&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}outsidePlaytest.refreshHUD();});
  await p.waitForTimeout(820);await p.screenshot({path:'/private/tmp/street-head-choices.png'});
  assert.equal(await p.locator('.outside-speech .outside-choices').count(),0);
  const px=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.press('KeyQ');assert.equal(await selected(),'beggar-pay');
  await p.keyboard.press('KeyW');assert.equal(await selected(),'beggar-question');await p.keyboard.press('KeyE');assert(await p.locator('[data-choice="beggar-question"]').evaluate(e=>e.classList.contains('is-rejected')));await p.keyboard.press('KeyS');assert.equal(await selected(),'beggar-pay');
  // Current CSV/story price is 200 (the old 150 expectation predates the beggar rewrite).
  await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>barGame.progress.money),300);assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),px);
  assert.deepEqual(errors,[]);console.log('PASS first-contact choices, W/S + wheel wrap, Q ignored, E confirm, held-key isolation, tutorial/pause/sound lifecycle, common rejoin, four rows and disabled options.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

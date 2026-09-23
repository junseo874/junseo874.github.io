// Presentation regression: real camera completion, speaker anchors and torso seams.
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
  const settled=()=>p.waitForFunction(()=>!barGame.cameraMoving&&barGame.transition===0&&document.querySelector('.dialogue-wrap'));
  await p.evaluate(()=>{
    const g=barGame;g.reset(99,'practice',1);g.screen='bar';g.phase='regular';g.dialogSpeed=.01;
    g.seats={L:{actor:'port',state:'STORY'},M:null,R:null};
    g.dialogue=g.makeLine('port','카메라 이동이 끝나고 포트의 대사가 표시됩니다.');
  });await settled();
  // Deliberately longer than the normal 550ms. A fixed timeout must not pass.
  const slow=await p.addStyleTag({content:'.bar-scene-layer{transition-duration:1.1s!important}'});
  await p.evaluate(()=>{
    barGame.seats.R={actor:'aili',state:'STORY'};
    barGame.dialogue=barGame.makeLine('port','둘이 앉아 있을 때는 제 아래에서 대사가 나와야 합니다.');
  });
  await p.waitForFunction(()=>barGame.cameraMoving&&document.querySelector('.counter-plane').getAnimations().length>0);
  await p.waitForTimeout(650);
  assert.equal(await p.evaluate(()=>barGame.cameraMoving),true);
  assert.equal(await p.locator('.dialogue-wrap').count(),0);
  assert.equal(await p.evaluate(()=>barGame.dialogue.chars),0);
  await p.keyboard.press('Enter');await p.keyboard.press('Space');
  assert.equal(await p.evaluate(()=>barGame.dialogue.chars),0,'Input revealed a hidden line during zoom');
  await settled();
  const center=async()=>{const b=await p.locator('.dialogue-wrap').boundingBox();return b.x+b.width/2;};
  assert(Math.abs(await center()-370)<1);assert.equal(await p.locator('.dialogue-wrap').getAttribute('data-speaker-seat'),'L');
  await p.evaluate(()=>barGame.dialogue.chars=barGame.dialogue.text.length);await p.waitForTimeout(150);
  await p.screenshot({path:'/private/tmp/bar-staging-pair-left.png'});
  await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('aili','이제 오른쪽에 앉은 제 차례네요.');barGame.dialogue.chars=barGame.dialogue.text.length;});
  await p.waitForFunction(()=>document.querySelector('.dialogue-wrap')?.dataset.speakerSeat==='R');
  assert(Math.abs(await center()-910)<1);await p.screenshot({path:'/private/tmp/bar-staging-pair-right.png'});
  const guestY=(await p.locator('.dialogue-wrap').boundingBox()).y;
  await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('luna','두 분의 주문을 확인하겠습니다.');barGame.dialogue.chars=barGame.dialogue.text.length;});
  await p.locator('.player-speech').waitFor();assert(Math.abs(await center()-640)<1);
  assert((await p.locator('.dialogue-wrap').boundingBox()).y>guestY);
  await p.screenshot({path:'/private/tmp/bar-staging-pair-luna.png'});
  await p.evaluate(()=>{barGame.seats.R=null;barGame.dialogue=barGame.makeLine('port','다시 한 명일 때의 대사입니다.');});
  await p.waitForFunction(()=>barGame.cameraMoving);await p.waitForTimeout(650);
  assert.equal(await p.locator('.dialogue-wrap').count(),0);assert.equal(await p.evaluate(()=>barGame.dialogue.chars),0);
  await settled();assert(Math.abs(await center()-640)<1);assert.equal(await p.locator('.dialogue-wrap').getAttribute('data-speaker-seat'),null);
  // A new target midway through a transition must wait for the LAST destination.
  await p.evaluate(()=>{barGame.seats.R={actor:'aili',state:'STORY'};});
  await p.waitForFunction(()=>barGame.cameraMoving);await p.waitForTimeout(250);
  await p.evaluate(()=>{barGame.seats.L=null;barGame.dialogue=barGame.makeLine('aili','마지막 카메라 목적지에서 출력합니다.');});
  await p.waitForTimeout(700);assert.equal(await p.locator('.dialogue-wrap').count(),0);await settled();
  assert(Math.abs(await center()-640)<1);
  // Choice input also cannot bypass staging.
  await p.evaluate(()=>{
    barGame.seats.L={actor:'port',state:'STORY'};barGame.dialogue=null;
    barGame.choice={step:{arg:'staging_test',effects:null},rows:[{seq:1,'text.ko':'대기',when:null,effects:null}]};
  });await p.waitForFunction(()=>barGame.cameraMoving);await p.waitForTimeout(150);
  assert.equal(await p.locator('.choices').count(),0);assert.equal(await p.evaluate(()=>barGame.choose(1)),false);
  await p.waitForFunction(()=>!barGame.cameraMoving&&document.querySelector('.choices'));
  await p.evaluate(()=>barGame.choice=null);await slow.evaluate(e=>e.remove());

  // Native torso seams, measured from the source canvases, independent of the
  // production placement helper. Hands below the seam must stay on the table.
  const states=await p.evaluate(()=>Object.entries(LUNA_DATA.characterLayers).flatMap(([actor,poses])=>
    Object.keys(poses).map(pose=>({actor,pose}))));
  let checked=0;
  for(const {actor,pose} of states){
    await p.evaluate(({actor,pose})=>{
      const g=barGame;g.seats={L:{actor,state:'STORY'},M:null,R:null};
      const expression=pose.replace(new RegExp('^'+actor+'_','i'),'').replace(/_(talk|default)$/,'');
      g.dialogue=g.makeLine(actor,'캐릭터 자세의 테이블 접점을 검수하는 중입니다.',null,expression);g.dialogSpeed=.001;
      if(pose.endsWith('_default'))g.dialogue.chars=g.dialogue.text.length;
    },{actor,pose});await settled();await p.waitForTimeout(700);
    assert.equal(await p.locator('.actor').getAttribute('data-pose'),pose);
    const anchor=await p.evaluate(({actor,pose})=>{
      const el=document.querySelector('.actor-layer'),art=LUNA_DATA.assets[el.dataset.layer];
      let native=440;
      if(actor==='bubi')native=476;
      else if(actor==='port'&&pose.includes('serious'))native=317;
      else if(actor==='port'&&pose.includes('event_surprise'))native=418;
      else if(actor==='samho'&&pose.startsWith('drunk_'))native=229;
      else if(actor==='samho'&&pose.startsWith('success_'))native=301;
      else if(actor==='samho'&&pose.startsWith('fail_'))native=310;
      const box=el.getBoundingClientRect(),plane=document.querySelector('.counter-plane').getBoundingClientRect();
      return {actual:box.top+native*box.height/art.h,expected:plane.top+(actor==='bubi'?535:500)*plane.width/2041};
    },{actor,pose});
    assert(Math.abs(anchor.actual-anchor.expected)<1,`${actor}/${pose}: ${JSON.stringify(anchor)}`);checked++;
  }
  // Real QA scene: enter two, then the CSV exit step starts the one-person shot.
  await p.evaluate(()=>{
    const g=barGame;g.reset(99,'regular',1);g.loadScene(g.t.scenes.find(s=>s.id==='t99_two_guests'));
  });await settled();assert.equal(await p.locator('.dialogue-wrap').getAttribute('data-speaker-seat'),'L');
  await p.evaluate(()=>{
    const g=barGame;g.dialogue=null;g.story.index=g.story.steps.findIndex(s=>s.type==='exit');g.pump();
  });await p.waitForFunction(()=>barGame.cameraMoving&&barGame.dialogue?.actor==='aili');
  assert.equal(await p.locator('.dialogue-wrap').count(),0);await settled();assert(Math.abs(await center()-640)<1);
  assert.deepEqual(errors,[]);
  console.log(`REGULAR_STAGING_OK: actual zoom-out/in end, input lock, interrupted movement, L/R/Luna anchors, choice gating, ${checked} native pose seams, real Day 99 enter/exit.`);
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

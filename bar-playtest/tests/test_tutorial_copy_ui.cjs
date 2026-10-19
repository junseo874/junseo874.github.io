const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  // Follow real story transitions to the seat lesson, without changing story content.
  await page.evaluate(()=>{
   const g=barGame;g.reset(0,'full',7,true,{variant:'original'});
   for(let i=0;i<3000&&g.tutorial?.kind!=='seatIndicator';i++){
    if(g.tutorial?.kind==='seatExplore'){
     if(!g.cameraMoving&&!g.cameraLeft&&!g.transition){const seats=['L','M','R'],delta=Math.sign(seats.indexOf(g.tutorialSeatTarget())-seats.indexOf(g.focus));g.focusSeat(seats[seats.indexOf(g.focus)+delta]);}
    }else if(g.choice)g.choose(1);else if(g.dialogue){g.advance();g.advance();}
    g.tick(.1);
   }
   lunaCampaign.render(true);
  });
  await page.locator('[data-guide="seatIndicator"]').waitFor();
  assert.equal(await page.locator('.day0-guide-copy span').innerText(),'여기에서 좌석 상태를 확인할 수 있어요.');
  assert.equal(await page.locator('[data-act="tutorialBarContinue"] kbd').innerText(),'E');
  await page.keyboard.press('KeyE');
  const dialog=page.getByRole('dialog',{name:'좌석 알림'});await dialog.waitFor();
  assert.equal(await dialog.locator('.day0-seat-legend-row').count(),4);
  assert.deepEqual(await dialog.locator('h3').allTextContents(),['빈 좌석','앉은 좌석','오래 기다림','손님 퇴장']);
  assert.deepEqual(await dialog.locator('.day0-seat-legend-row p').allTextContents(),['아직 손님이 없습니다.','손님이 앉아 있는 좌석을 나타냅니다.','손님이 장시간 기다리고 있는 상태를 나타냅니다.','바를 나가는 손님을 나타냅니다.']);
  assert.deepEqual(await dialog.locator('.seat-color-label span').allTextContents(),['회색','민트색','주황색','빨간색']);
  assert.equal(await dialog.locator('.seat-state-picture').count(),4);
  assert.equal(await dialog.locator('.seat-guest,.seat-symbol,.seat-bag,.seat-legend-page,.day0-seat-summary,img').count(),0);
  assert.equal(await dialog.locator('button kbd').innerText(),'E');
  assert(!/Space|좌석의 색을 확인하고/.test(await dialog.innerText()));
  assert(!/깜빡|퇴장 중|인내심|10초/.test(await dialog.innerText()));
  assert(await dialog.evaluate(e=>e.contains(document.activeElement)));
  await page.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)));
  const storyIndex=await page.evaluate(()=>barGame.story.index);
  await page.keyboard.down('Control');await page.waitForTimeout(350);await page.keyboard.up('Control');
  assert.equal(await page.evaluate(()=>barGame.story.index),storyIndex);
  for(const viewport of [{width:1280,height:720},{width:960,height:540},{width:600,height:800}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(150);
   assert(await dialog.evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1&&e.scrollHeight<=e.clientHeight+1;}),'Panel fits '+JSON.stringify(viewport));
   assert(await dialog.locator('.day0-seat-legend-row').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),'Cards do not overflow');
   assert(await dialog.evaluate(e=>{const panel=e.getBoundingClientRect(),title=e.querySelector('h2').getBoundingClientRect();return Math.abs(title.x+title.width/2-panel.x-panel.width/2)<1;}),'Title is centered');
   for(const selector of ['.seat-color-label','.seat-state-picture','h3','p']){
    assert(await dialog.locator('.day0-seat-legend-row '+selector).evaluateAll(es=>{const rs=es.map(e=>e.getBoundingClientRect());return rs.every(r=>Math.abs(r.y-rs[0].y)<1);}),selector+' rows align');
   }
  }
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);
  await page.screenshot({path:'/private/tmp/luna-seat-tutorial-four-colors.png'});
  await page.keyboard.press('KeyE');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>barGame.tutorial),null);
  assert.equal(await page.evaluate(()=>barGame.logs.filter(e=>e.event==='tutorial_complete'&&e.kind==='seatIndicator').length),1);
  // Check every edited preparation instruction, including corrected spacing.
  const copies=await page.evaluate(()=>{
   const g={variant:'original',day:0,screen:'prep',tutorial:{kind:'prepAdd'},cocktail:()=>({glass:'beer_glass'})};
   const view=LunaDay0Tutorial({g,ui:{tab:'glass'},L:ko=>ko});
   const read=(kind,beer=false)=>{g.day=beer?1:0;g.tutorial={kind,beer};return view.html();};
   return Object.fromEntries(['prepAdd','prepGinAgain','prepRecipeRead','prepRecipeClose','recipe','beerOpener','beerStart'].map(k=>[k,read(k,k.startsWith('beer'))]));
  });
  assert(copies.prepAdd.includes('진을 클릭해 선택해 보세요'));
  assert(copies.prepGinAgain.includes('다시 진을 담아 제조를 준비하세요'));
  assert(copies.prepRecipeClose.includes('확인이 끝났다면 레시피를 닫아 주세요'));
  assert(copies.prepRecipeRead.includes('<kbd>E</kbd>'));
  assert.equal(await page.evaluate(()=>{const g={variant:'original',day:0,screen:'prep',tutorial:{kind:'prepRecipeRead'}},view=LunaDay0Tutorial({g,ui:{tab:'glass'},L:ko=>ko});let action;view.key({code:'KeyE',preventDefault(){}},document,a=>action=a);return action;}),'tutorialContinue');
  assert(copies.recipe.includes('서비스 패널을 열어 보세요'));
  assert(copies.beerOpener.includes('맥주 뚜껑을 따기 위해 병따개를 담으세요.'));
  assert(copies.beerStart.includes('제조 시작하기'));
  await page.evaluate(()=>{const g=barGame;g.reset(0,'practice',1,true,{variant:'original'});g.currentOrder={actor:'chris',cocktail:'gin_tonic',seat:'R'};g.selectCocktail('gin_tonic');g.debugFill();g.startCraft();lunaCampaign.render(true);});
  const card=page.locator('.pour-tutorial-card');await card.waitFor();
  assert.equal(await card.locator('small').count(),0);
  assert.match(await card.locator('p').innerText(),/^이번 재료의 목표량은 \d+ ml예요\.$/);
  assert.equal(await card.locator('button').innerText(),'따르기 시작');
  await card.locator('button').click();
  assert.equal(await page.evaluate(()=>barGame.gimmick.pourTutorial.step),'pour');
  await page.evaluate(()=>{const s=barGame.gimmick;s.started=true;s.held=false;s.fluid.liquidMl=5;s.fluid.emittedMl=5;s.fluid.caughtMl=5;});
  await page.waitForFunction(()=>document.querySelector('.pour-tutorial[data-step="finish"]:not([hidden])'));
  assert.equal(await card.locator('h3').innerText(),'현재량을 확인해요');
  assert((await card.locator('p').innerText()).includes('「따르기 마치기」'));
  assert((await page.locator('.pour-finish').innerText()).includes('따르기 마치기'));
  assert.deepEqual(errors,[]);
  console.log('PASS: updated seat copy, four aligned simple icons, centered heading, removed page/summary, E hints and actual progression, 3 screen sizes, story progression and pouring copy/button consistency.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

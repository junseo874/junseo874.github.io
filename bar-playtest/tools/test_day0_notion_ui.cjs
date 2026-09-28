const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/?update=day0-notion';
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(URL);await p.locator('.updates-confirm').click();
 for(const variant of ['original','gpt'])for(const skip of [false,true]){
  await p.evaluate(variant=>{barGame.reset(0,'full',3,true,{variant});barGame.lang='ko';},variant);
  await p.waitForFunction(()=>barGame.dialogue&&!barGame.cameraMoving&&!barGame.transition);
  assert.equal(await p.evaluate(()=>barGame.dialogue.text),'루나? 방금 시작한다고 했을 텐데?');
  await p.keyboard.down('ControlLeft');await p.locator('.choices').waitFor();await p.keyboard.up('ControlLeft');
  assert.equal(await p.locator('.choices button').count(),2);await p.screenshot({path:'/private/tmp/day0-notion-choice.png'});
  await p.locator('.choices button').nth(skip?1:0).click();
  let crafts=0;
  for(let i=0;i<1400;i++){
   const state=await p.evaluate(()=>({tutorial:barGame.tutorial?.kind,finished:barGame.finished,error:barGame.error,transition:barGame.transition,camera:barGame.cameraMoving||barGame.cameraLeft,dialogue:!!barGame.dialogue,craft:['bar','recipe','prep','gimmick'].includes(barGame.screen)&&!!barGame.currentOrder&&!barGame.drink&&barGame.story?.steps[barGame.story.index]?.type==='craft'}));
   assert.equal(state.error,null);if(state.finished)break;
   if(state.transition||state.camera){await p.waitForTimeout(40);continue;}
   if(state.tutorial==='coaster'){const a=await p.locator('[data-drag="coaster"]').boundingBox(),z=await p.locator('[data-drop="R"]').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(z.x+z.width/2,z.y+z.height*.8,{steps:8});await p.mouse.up();continue;}
   if(state.tutorial==='recipe'){await p.locator('.service-handle').click();await p.locator('#service-panel [data-act="recipes"]').click();continue;}
   if(state.tutorial){
    const selectors={recipeSelect:'[data-act="selectRecipe"][data-id="gin_tonic"]',prepRecipeOpen:'.recipe-toggle',prepRecipeRead:'[data-act="tutorialContinue"]',prepRecipeClose:'.prep-recipe-heading [data-act="togglePrepRecipe"]',prepNavigate:'.shelf-dots [data-act="tab"][data-id="liquor"]',prepAdd:'.shelf-slide[data-current="true"] [data-hover-item="gin"]',prepRemove:'.prep-inventory [data-act="pick"][data-id="gin"]'};
    if(variant==='original'&&['prepNavigate','prepSodaNavigate'].includes(state.tutorial)){await p.keyboard.press('KeyD');await p.waitForTimeout(600);continue;}
    Object.assign(selectors,{prepGlass:'.shelf-slide[data-current="true"] [data-id="long_drink"]',prepGinAgain:'.shelf-slide[data-current="true"] [data-id="gin"]',prepSodaAdd:'.shelf-slide[data-current="true"] [data-id="soda_water"]',prepStart:'.craft-start'});
    if(state.tutorial==='prepSodaHover'){await p.waitForTimeout(600);await p.locator('.shelf-slide[data-current="true"] [data-id="soda_water"]').hover();continue;}
    if(state.tutorial==='prepHover'){await p.waitForTimeout(600);await p.locator('.shelf-slide[data-current="true"] [data-hover-item="gin"]').hover();}else {assert(selectors[state.tutorial],state.tutorial);await p.locator(selectors[state.tutorial]).click();}continue;
   }
   if(state.dialogue){const finalSeats=await p.evaluate(()=>barGame.dialogue?.id==='dlg_day0_notion_bar_122'?[barGame.seats.L?.actor,barGame.seats.R?.actor]:null);if(finalSeats)assert.deepEqual(finalSeats,['port','chris']);await p.keyboard.press('Enter');await p.keyboard.press('Enter');continue;}
   if(state.craft){
    if(await p.evaluate(()=>barGame.screen==='bar'))await p.locator('.story-craft-prompt [data-act="recipes"]').click();
    // Both serving result branches are exercised in a real browser; minigames themselves are unchanged.
    await p.evaluate(wrong=>{const g=barGame,id=g.currentOrder.cocktail;g.selectCocktail(wrong?(id==='gin_tonic'?'gin_fizz':'gin_tonic'):id);g.debugCraft('poor');},skip&&crafts===0);
    await p.waitForTimeout(1800);await p.evaluate(()=>barGame.offer());await p.waitForTimeout(100);
    const offered=await p.evaluate(()=>({screen:barGame.screen,drink:!!barGame.drink}));assert(offered.drink);
    await p.evaluate(()=>{const g=barGame;g.serve(g.currentOrder.seat);});crafts++;continue;
   }
   await p.waitForTimeout(30);
  }
  const result=await p.evaluate(()=>({finished:barGame.finished,history:barGame.history.map(h=>h.id),seats:[barGame.seats.L?.actor,barGame.seats.R?.actor],error:barGame.error}));
  assert.equal(result.finished,true);assert.equal(result.error,null);assert.equal(crafts,skip?3:2);
  assert(result.history.includes('dlg_day0_notion_bar_122'));assert.equal(result.history.includes('dlg_day0_notion_bar_31'),skip);
  console.log('BROWSER_DAY0_OK',variant,skip?'skip + wrong order + retry':'tutorial + matching orders');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

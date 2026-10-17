const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{const g=barGame;g.reset(99,'practice',1,true,{variant:'original'});g.selectCocktail('dry_martini');g.debugFill();g.startCraft();lunaCampaign.render(true);});
 await p.waitForFunction(()=>barGame.gimmick?.type==='pour');
 assert.equal(await p.locator('[data-pour-ingredient]').innerText(),'진');
 await p.evaluate(()=>{barGame.craft.index=1;barGame.nextGimmick();lunaCampaign.render(true);});
 assert.equal(await p.locator('[data-pour-ingredient]').innerText(),await p.evaluate(()=>barGame.name('dry_vermouth')));
 assert.equal(await p.locator('[data-pour-ingredient]').getAttribute('data-pour-ingredient'),'dry_vermouth');
 for(const vp of [{width:1280,height:720},{width:960,height:540},{width:600,height:800}]){
  await p.setViewportSize(vp);await p.waitForTimeout(100);
  const state=await p.locator('.pour-ingredient-readout').evaluate(el=>{const b=el.getBoundingClientRect(),parent=el.closest('.fluid-screen').getBoundingClientRect(),name=getComputedStyle(el.querySelector('strong')),label=getComputedStyle(el.querySelector('span'));return {textAlign:getComputedStyle(el).textAlign,color:name.color,targetColor:getComputedStyle(document.querySelector('.pour-target-value')).color,large:parseFloat(name.fontSize)>parseFloat(label.fontSize),inside:b.left>=parent.left&&b.right<=parent.right&&b.bottom<=parent.bottom,lowerLeft:b.left<parent.left+parent.width*.1&&b.top>parent.top+parent.height*.6};});
  assert.equal(state.textAlign,'left');assert.equal(state.color,state.targetColor);assert(state.large&&state.inside&&state.lowerLeft,JSON.stringify(state));
  if(vp.width===1280)await p.screenshot({path:'/private/tmp/pour-ingredient-name.png'});
 }
 await p.evaluate(()=>{barGame.lang='en';lunaCampaign.render(true);});
 assert.equal(await p.locator('.pour-ingredient-readout span').innerText(),'Ingredient');
 assert.equal(await p.locator('[data-pour-ingredient]').innerText(),await p.evaluate(()=>barGame.name(barGame.gimmick.ingredient)));
 await p.evaluate(()=>{barGame.lang='ko';barGame.startMinigame('fill_up');lunaCampaign.render(true);});
 assert.equal(await p.locator('[data-pour-ingredient]').getAttribute('data-pour-ingredient'),await p.evaluate(()=>barGame.gimmick.ingredient));
 assert.deepEqual(errors,[]);console.log('PASS ingredient changes, fill-up, localization, target-color match and lower-left alignment at 3 viewport sizes');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

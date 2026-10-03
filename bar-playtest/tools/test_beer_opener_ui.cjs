const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 for(const variant of ['original','gpt']){
  await p.evaluate(variant=>{const g=barGame;g.reset(1,'practice',1,true,{variant});g.selectCocktail('bottle_beer');g.pickItem('mug');g.pickItem('beer');},variant);
  await p.locator('[data-act="craft"]').click();
  const dialog=p.getByRole('alertdialog');await dialog.waitFor();assert((await dialog.innerText()).includes('병따개가 필요합니다'));
  assert.equal(await p.evaluate(()=>barGame.screen),'prep');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'확인');
  await p.screenshot({path:'/private/tmp/beer-opener-warning-'+variant+'.png'});
  await dialog.getByRole('button',{name:'확인',exact:true}).click();
  await p.locator('[data-act="tab"][data-id="tool"]').click();await p.waitForTimeout(600);
  await p.locator('.shelf-item[data-act="pickOpener"]').click();
  // Removing the opener must restore the guard without losing beer or glass.
  await p.locator('.inventory-slot[data-act="pickOpener"]').click();await p.locator('[data-act="craft"]').click();await dialog.waitFor();
  await p.keyboard.press('Escape');await p.locator('.shelf-item[data-act="pickOpener"]').click();await p.locator('[data-act="craft"]').click();
  assert.deepEqual(await p.evaluate(()=>barGame.craft.queue.map(s=>[s.type,s.ingredient])),[['open','beer'],['pour','beer']]);
  assert.equal(await p.evaluate(()=>barGame.gimmick.type),'open');
  await p.evaluate(()=>{barGame.gimmickInput('Space');barGame.gimmick.beatTime=1.6;barGame.gimmickInput('Space');});
  await p.waitForFunction(()=>barGame.gimmick?.completed||barGame.gimmick?.type==='pour');
  if(variant==='original'){await p.waitForTimeout(800);await p.locator('[data-act="endGimmick"]').click();}
  await p.waitForFunction(()=>barGame.gimmick?.type==='pour');assert.equal(await p.evaluate(()=>barGame.gimmick.ingredient),'beer');
 }
 assert.deepEqual(errors,[]);console.log('BEER_OPENER_UI_OK: both versions, warning, keyboard dismissal, opener select/remove, open then pour');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

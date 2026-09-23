// Regressions for unrelated craft keys, keyboard choices and build tool penalties.
const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/').replace(/\/?$/, '/');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
 async function prepare(type){
  await p.evaluate(type=>{
   const g=barGame;g.reset(99,'practice',1);
   g.selectCocktail(type==='open'?'bottle_beer':type==='stir'?'dry_martini':type==='shake'?'gin_fizz':'gin_tonic');
   g.debugFill();g.startCraft();g.craft.index=g.craft.queue.findIndex(q=>q.type===type);g.nextGimmick();
  },type);await p.waitForTimeout(150);
 }
 const unrelated=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
 for(const type of ['open','shake','pour','fill_up']){
  await prepare(type);
  for(const key of unrelated)await p.keyboard.press(key);
  await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(()=>({started:barGame.gimmick.started,time:barGame.craft.elapsed,failures:barGame.gimmick.failures,value:barGame.gimmick.value,hit:barGame.gimmick.hit})),{started:false,time:0,failures:0,value:0,hit:false},type+' wrong key started a gimmick');
  if(['pour','fill_up'].includes(type)){
   await p.keyboard.down('Space');await p.waitForTimeout(150);
   assert.equal(await p.evaluate(()=>barGame.gimmick.held),true);await p.keyboard.up('Space');
   assert.equal(await p.evaluate(()=>barGame.gimmick.held),false);
  }else await p.keyboard.press('Space');
  assert.equal(await p.evaluate(()=>barGame.gimmick.started),true);
  for(const key of unrelated)await p.keyboard.press(key);
  assert.equal(await p.evaluate(()=>barGame.gimmick.failures),0,type+' wrong key added failure');
  assert.equal(await p.evaluate(()=>barGame.gimmick.hit),false,type+' wrong key counted a shake hit');
  await p.keyboard.press('Escape');const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick));
  await p.keyboard.press('Space');await p.keyboard.press('KeyD');await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);
  await p.keyboard.press('Escape');
 }
 await prepare('stir');await p.keyboard.press('Space');await p.keyboard.press('KeyD');
 assert.equal(await p.evaluate(()=>barGame.gimmick.started),false);
 await p.keyboard.press('KeyW');await p.keyboard.press('Space');
 assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);
 for(const key of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'])await p.keyboard.press(key);
 assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 console.log('CRAFT_INPUT_OK: unrelated keys ignored before/after start, valid keys preserved, pause guarded.');

 const selected=()=>p.evaluate(()=>document.activeElement?.dataset?.act==='choice'?document.activeElement.dataset.id:null);
 async function choices(){
  await p.evaluate(()=>barGame.reset(99,'regular',9));
  await p.waitForFunction(()=>barGame.transition===0&&!barGame.cameraMoving&&barGame.choice);
  await p.locator('.choices button').first().waitFor();await p.waitForFunction(()=>document.activeElement?.dataset?.act==='choice');
 }
 for(const key of ['Enter','Space']){
  await choices();assert.equal(await selected(),'1');
  await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');assert.equal(await selected(),'3');
  await p.waitForTimeout(250);assert.equal(await selected(),'3','render reset the selected choice');
  await p.keyboard.press(key);
  assert.equal(await p.evaluate(()=>barGame.story.scene.id),'t99_two_guests');
  assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>x.event==='choice').length),1);
 }
 // Disabled rows are excluded, and Tab still opens the service panel.
 await choices();await p.evaluate(()=>{
  const g=barGame;g.choice={...g.choice,rows:g.choice.rows.map(r=>({...r,when:['1','3'].includes(String(r.seq))?'flag.keyboard_test_locked':r.when}))};
 });await p.waitForFunction(()=>document.activeElement?.dataset?.id==='2');
 await p.keyboard.press('ArrowDown');assert.equal(await selected(),'4');
 await p.keyboard.press('ArrowDown');assert.equal(await selected(),'2');
 await p.keyboard.press('ArrowUp');assert.equal(await selected(),'4');
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>barGame.overlay),'service');
 await p.keyboard.press('ArrowDown');assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>x.event==='choice').length),0);
 await p.keyboard.press('Escape');await p.keyboard.press('ArrowDown');assert.equal(await selected(),'2');
 await p.locator('.choices button[data-id="4"]').click();
 assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>x.event==='choice').length),1);

 // Two consecutive choice steps: holding a confirm key must not accept both.
 for(const key of ['Enter','Space']){
  await choices();await p.evaluate(()=>{
   const g=barGame,step={...g.choice.step};
   g.story.steps=[step,{...step,seq:2}];g.story.index=0;
   g.choice={step,rows:g.choice.rows.map(r=>({...r,goto:null,effects:null,when:null}))};
  });await p.waitForTimeout(150);
  await p.keyboard.down(key);for(let i=0;i<3;i++)await p.keyboard.down(key);await p.keyboard.up(key);
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>x.event==='choice').length),1,'held key accepted the next choice');
  assert.equal(await p.evaluate(()=>barGame.story.index),1);assert(await p.evaluate(()=>!!barGame.choice));
 }
 // Camera guard must also apply to the new choice input route.
 await choices();await p.evaluate(()=>{barGame.cameraLeft=1;});
 await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.keyboard.press('Space');
 assert.equal(await p.evaluate(()=>barGame.logs.filter(x=>x.event==='choice').length),0);
 console.log('CHOICE_INPUT_OK: real QA branches via Enter/Space, arrow navigation, locked choices, menus, mouse, held keys and staging.');

 for(const tool of [null,'shaker','mixing_glass']){
  await p.evaluate(tool=>{
   const g=barGame;g.reset(99,'practice',1);g.selectCocktail('gin_tonic');g.debugFill();g.prep.tool=tool;g.prep.opener=true;g.startCraft();
   while(g.screen==='gimmick'){
    g.gimmick.started=true;g.gimmick.value=g.gimmick.target;g.gimmick.success=g.gimmick.targetStacks;g.gimmick.completed=true;g.endGimmick();
   }
  },tool);await p.locator('.result-table').waitFor();
  assert.equal(await p.evaluate(()=>barGame.result.penalties.tool),tool?10:0);
  assert.equal(await p.evaluate(()=>barGame.result.score),tool?90:100);
  await p.waitForFunction(expected=>[...document.querySelectorAll('.result-table tr')].find(r=>r.textContent.includes('도구 누락·불일치'))?.lastElementChild.textContent===expected,tool?'−10.0':'−0.0');
  assert.equal(await p.locator('.result-table tr').filter({hasText:'도구 누락·불일치'}).locator('td').last().textContent(),tool?'−10.0':'−0.0');
  assert.equal(await p.evaluate(()=>!!barGame.result.debug),false);
 }
 assert.deepEqual(errors,[]);
 console.log('BUILD_TOOL_UI_OK: actual scoring shown as 100/90/90, no debug grade override, auxiliary opener exempt.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const variant of ['original','gpt']){
  await p.evaluate(variant=>{const g=barGame;g.reset(99,'practice',1,true,{variant});g.selectCocktail('dry_martini');lunaCampaign.render(true);},variant);
  const detail=p.locator('#prep-recipe-detail');
  if(!await detail.isVisible())await p.locator('.prep-recipe-brief').click();
  await detail.waitFor();
  const text=await detail.innerText();assert(text.includes('진 60ml'));assert(text.includes('드라이 베르무트 20ml'));assert(!/180\s*ml|45\s*ml|6oz|1\.5oz/.test(text));
  if(variant==='original')await p.screenshot({path:'/private/tmp/martini-recipe-60-20.png'});
  await p.evaluate(()=>{const g=barGame;g.debugFill();g.startCraft();lunaCampaign.render(true);});
  await p.waitForFunction(()=>barGame.gimmick?.type==='pour');
  assert.equal(await p.evaluate(()=>barGame.gimmick.target),60);assert.equal(await p.evaluate(()=>barGame.gimmick.unit),'ml');
  assert((await p.locator('.pour-top-readout').innerText()).includes('60'));
  await p.evaluate(()=>{const g=barGame;g.craft.index=1;g.nextGimmick();lunaCampaign.render(true);});
  assert.equal(await p.evaluate(()=>barGame.gimmick.target),20);assert.equal(await p.evaluate(()=>barGame.gimmick.ingredient),'dry_vermouth');
  assert((await p.locator('.pour-top-readout').innerText()).includes('20'));
 }
 assert.deepEqual(errors,[]);console.log('PASS original/GPT recipe display and actual gin/vermouth pouring targets: 60ml / 20ml');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

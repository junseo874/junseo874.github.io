const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  for(const variant of ['original','gpt'])for(const day of [0,1,2,3]){
   await p.evaluate(({variant,day})=>{lunaCampaign.session.uninstall();lunaCampaign.screen('developer');const g=barGame;g.reset(day,'regular',4,false,{variant});g.phase='regular';g.progress.flags.day0_seats_revealed=true;g.tutorial=null;g.story=null;g.dialogue={actor:'tom',text:'안녕.',chars:3};lunaCampaign.render(true);},{variant,day});
   assert.equal(await p.locator('.seat-indicators').count(),0,`${variant} day ${day}: regular dialogue`);
   await p.evaluate(()=>{barGame.dialogue=null;lunaCampaign.render(true);});
   assert.equal(await p.locator('.seat-indicators').count(),0,'No flicker between regular lines');
   await p.evaluate(()=>{barGame.phase='general';lunaCampaign.render(true);});
   assert.equal(await p.locator('.seat-indicators button').count(),3,'General service retains indicators');
  }
  await p.evaluate(()=>{const g=barGame;g.reset(0,'regular',4,false,{variant:'original'});g.phase='regular';g.story=null;g.dialogue=null;g.progress.flags.day0_seats_revealed=true;g.tutorial={kind:'seatIndicator'};lunaCampaign.render(true);});
  assert.equal(await p.locator('.seat-indicators button').count(),3,'Indicator tutorial retains its target');
  assert.deepEqual(errors,[]);console.log('REGULAR_INDICATORS_OK: days 0–3, both variants, hidden throughout regular dialogue, general service and indicator lesson preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

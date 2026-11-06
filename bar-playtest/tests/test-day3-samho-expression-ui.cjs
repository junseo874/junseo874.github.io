const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{
   LunaFocusSettings.setEnabled(false);lunaCampaign.session.uninstall();lunaCampaign.screen('developer');
   const g=barGame;g.reset(3,'regular',42,false);
   Object.assign(g,{screen:'bar',phase:'regular',overlay:null,tutorial:null,transition:0,cameraLeft:0,cameraMoving:false});
   g.seats={L:{actor:'samho',id:'samho',state:'STORY',seated:true,expression:'default',glass:'bottle_beer',coaster:true},M:null,R:{actor:'tom',id:'tom',state:'STORY',seated:true,expression:'default'}};
   const rows=LUNA_DATA.tables.steps.filter(r=>r.context==='campaign_d3_bar').sort((a,b)=>a.seq-b.seq);
   const first=rows.findIndex(r=>r.row_id==='notion_d3_luna_beer_served'),last=rows.findIndex(r=>r.row_id==='kihyun_campaign_d3_bar_94');
   g.story={scene:{id:'day3-drunk-review'},steps:rows.slice(first,last+1),index:0};g.pump();lunaCampaign.render(true);
  });
  const actor=page.locator('.actor[data-actor="samho"]');
  await page.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft);
  await page.waitForFunction(()=>document.querySelector('.actor[data-actor="samho"]')?.dataset.pose==='idle_default');
  const next=()=>page.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;barGame.advance();lunaCampaign.render(true);});
  await next();
  await page.waitForFunction(()=>document.querySelector('.actor[data-actor="samho"]')?.dataset.pose.startsWith('drunk_'));
  assert.equal(await page.evaluate(()=>barGame.dialogue.expression),'drunk');
  assert.equal(await page.evaluate(()=>barGame.seats.L.glassEmpty),true);
  await page.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;lunaCampaign.render(true);});
  await page.waitForFunction(()=>document.querySelector('.actor[data-actor="samho"]')?.dataset.pose==='drunk_default');
  await next();
  assert.equal(await page.evaluate(()=>barGame.dialogue.actor),'tom');
  await page.waitForFunction(()=>document.querySelector('.actor[data-actor="samho"]')?.dataset.pose==='drunk_default');
  assert(await actor.isVisible());
  await page.screenshot({path:'/tmp/luna-day3-samho-drunk.png'});
  for(let i=0;i<20;i++){
   const state=await page.evaluate(()=>({text:barGame.dialogue.text,actor:barGame.dialogue.actor,arg:barGame.dialogue.expression,samho:barGame.seats.L.expression}));
   assert.equal(state.samho,'drunk');if(state.actor==='samho')assert.equal(state.arg,'drunk');
   if(state.text==='끅, 루나 안녕~...')break;
   assert(i<19,'Must reach the farewell');await next();
  }
  assert.deepEqual(errors,[]);
  console.log('DAY3_SAMHO_EXPRESSION_UI_OK: default before drinking, native drunk say, completed line and speaker handoff, farewell.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

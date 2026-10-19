const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});p.on('request',r=>requests.push(r.url()));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  let cases=0;
  for(const main of [false,true]){
   await p.evaluate(async main=>{const c=lunaCampaign,a=outsidePlaytest;a.exit(true);c.session.uninstall();c.session.install({developer:!main});barGame.reset(1,'full',1,false);Object.assign(a.config,{day:1,flow:'out',place:'bar'});await a.start();c.screen(c.playView);},main);
   const checked=await p.evaluate(()=>{
    const a=outsidePlaytest,m=a.model,g=barGame;let count=0;
    if(typeof LunaBDVendor!=='undefined'||typeof lunaCampaign.playBDCinema!=='undefined')throw Error('Retired BD entry point still available');
    if(LUNA_OUTSIDE_DATA.scenes.street.nodes.some(n=>n.bdVendor||/bd-vendor/.test(n.id+' '+n.name)))throw Error('BD actor remains in scene');
    if(LunaCutsceneLibrary.catalog.some(c=>c.id==='bd')||LunaOutsideQA.catalog().some(c=>/BD|bd-vendor/.test(c.label+' '+c.id)))throw Error('BD QA/cinema entry remains');
    for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const legacyPurchase of [false,true]){
     g.progress.money=700;g.progress.flags={bd_chip_purchased:legacyPurchase};
     m.start({day,flow,place:'bar'});m.x=5.65;m.updateNear();a.snapCamera();a.refreshHUD();
     if(m.near||m.targets().some(t=>t.id==='bd-vendor')||m.interact())throw Error('Removed NPC is still interactable');
     if(m.story.speech||m.ride||m.transition||g.progress.money!==700||g.progress.flags.bd_chip_purchased!==legacyPurchase)throw Error('Removed interaction changed state');
     count++;
    }
    // The retired vendor used to own the wallet helper: its consumers must
    // continue working without any global vendor object.
    g.progress.money=499;if(!LunaOutsideThug.choiceView().options[0].disabled)throw Error('Thug no-funds gate lost');
    g.progress.money=500;if(LunaOutsideThug.choiceView().options[0].disabled)throw Error('Thug wallet lost');
    g.progress.money=875;m.start({day:99,qaCase:'shop:repeat'});m.x=0;m.updateNear();m.interact();
    if(m.qa.shopProgress.money!==875||g.progress.money!==875)throw Error('QA shop wallet lost/isolation broken');
    m.start({day:3,flow:'out',place:'bar'});m.x=5.65;m.updateNear();a.snapCamera();a.tick(0);
    return count;
   });cases+=checked;
   assert(await p.locator('.outside-interact').isHidden());await p.keyboard.press('KeyE');
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
  }
  await p.screenshot({path:'/private/tmp/street-bd-vendor-removed.png'});
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  assert(await p.evaluate(()=>resourceReview.rows.every(r=>r.id!=='outside-role:bd-vendor'&&!/^BD/.test(r.title||'')&&!JSON.stringify(r).includes('"id":"bd"'))));
  assert(!requests.some(url=>/\/bd-vendor\.js(?:\?|$)/.test(url)));
  assert.deepEqual(errors,[]);console.log('PASS '+cases+' main/developer/day/route/legacy-save cases: no BD actor, prompt, payment or cinema; removed gallery/resource entries; thug and QA shop wallets retained');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

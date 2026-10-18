const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  // Keep the developer-only QA launcher from covering the actual service controls.
  await p.addStyleTag({content:'.qa-launch{display:none!important}'});
  for(const main of [false,true]){
   await p.evaluate(main=>{const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:!main});g.reset(99,'general',7,true,{variant:'original'});g.spawn();const base=Object.values(g.seats).find(Boolean);if(!base)throw Error('No general guest fixture');g.queue=[];g.queueIndex=0;g.seats=Object.fromEntries(['L','M','R'].map(seat=>[seat,{...base,id:'drag-'+seat,seat,coaster:false,glass:null,state:'WAIT_COASTER',left:999,limit:999,lines:[],lineIndex:0,lineDone:null}]));g.focus='L';g.overview=false;g.cameraLeft=0;g.transition=0;c.screen(c.playView);g.changed();},main);
   for(const seat of ['L','M','R']){
    if(seat!=='L')await p.keyboard.press('KeyD');
    await p.waitForFunction(seat=>barGame.focus===seat&&!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition,seat);
    const popup=p.locator('[data-drag="coaster"]'),target=p.locator('[data-drop="'+seat+'"]');await popup.waitFor();
    await popup.locator('.coaster-pickup-arrow').waitFor();
    assert((await popup.innerText()).includes('드래그'));
    for(const key of ['Space','Enter'])await p.keyboard.press(key);
    await popup.focus();for(const key of ['Space','Enter'])await p.keyboard.press(key);
    assert(await p.evaluate(seat=>!barGame.seats[seat].coaster&&barGame.seats[seat].state==='WAIT_COASTER',seat),'No shortcut delivery, including focused card');
    assert(await p.evaluate(seat=>{const g=barGame,guest=g.seats[seat],other=seat==='L'?'M':'L';if(g.coaster()||g.coaster(seat,'Space')||g.coaster(other,'drag'))return false;for(const field of ['paused','cameraMoving','transition']){g[field]=true;const changed=g.coaster(seat,'drag');g[field]=field==='transition'?0:false;if(changed)return false;}const left=guest.left;guest.left=0;const expired=g.coaster(seat,'drag');guest.left=left;return !expired&&!guest.coaster;},seat));
    async function grab(){const r=await popup.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();assert(await p.locator('#drag-ghost').isVisible(),JSON.stringify(await p.evaluate(({main,seat,r})=>({main,seat,r,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML,paused:barGame.isPaused(),camera:barGame.cameraMoving,transition:barGame.transition,left:barGame.cameraLeft,screen:barGame.screen,view:lunaCampaign.view,drag:lunaCampaign.ui.drag,error:barGame.error}),{main,seat,r})));assert.equal(await popup.locator('.coaster-pickup-arrow').count(),0);assert(await target.locator('.delivery-arrow').isVisible());}
    await grab();await p.mouse.move(100,150);await p.mouse.up();assert(await p.evaluate(seat=>!barGame.seats[seat].coaster,seat));await popup.locator('.coaster-pickup-arrow').waitFor();
    await grab();await p.evaluate(()=>dispatchEvent(new PointerEvent('pointercancel')));await p.mouse.up();assert(await p.evaluate(seat=>!barGame.seats[seat].coaster,seat));assert(await p.locator('#drag-ghost').isHidden());
    await grab();const r=await target.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height*.8,{steps:5});
    if(main&&seat==='M')await p.screenshot({path:'/private/tmp/general-coaster-drag.png'});
    await p.mouse.up();await p.waitForFunction(seat=>barGame.seats[seat].coaster,seat);
    assert(await target.locator('img.coaster').isVisible());assert.equal(await target.locator('.delivery-cue').count(),0);assert.equal(await p.locator('[data-drag="coaster"]').count(),0);
    assert(await p.evaluate(seat=>{const g=barGame,guest=g.seats[seat];if(guest.state!=='ORDER_DIALOGUE'||g.coaster(seat,'drag'))return false;for(let i=0;i<1000&&guest.state==='ORDER_DIALOGUE';i++)g.tick(.05);return guest.state==='WAIT_SERVE'&&!!guest.order&&guest.coaster;},seat),'Valid drop starts exactly one order and retains coaster');
    assert(await target.locator('img.coaster').isVisible());
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS general guests: campaign/developer L/M/R drag delivery, Space/Enter rejected, invalid/cancel restore, paused/camera/expired/other-seat guards, single order and persistent coaster');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

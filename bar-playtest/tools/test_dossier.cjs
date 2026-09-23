const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
 await p.evaluate(()=>{barGame.reset(99,'general',3);barGame.progress.flags={chris_met:true,port_met:true,aili_met:true};barGame.progress.affinity={chris:0,port:10,aili:30,samho:99};for(let i=0;i<53;i++)barGame.tick(.1);});
 await p.keyboard.press('Tab');await p.locator('[data-act="dossierOpen"]').click();
 assert.equal(await p.locator('.guest-card').count(),7);assert.equal(await p.locator('.guest-card.unmet').count(),4);
 assert.equal(await p.locator('.guest-card[data-id="chris"] .filled').count(),1);
 assert.equal(await p.locator('.guest-card[data-id="port"] .filled').count(),2);
 assert.equal(await p.locator('.guest-card[data-id="aili"] .filled').count(),3);
 assert.equal(await p.locator('.guest-card[data-id="samho"]').isDisabled(),true);
 assert.equal((await p.locator('.guest-card[data-id="samho"]').innerText()).trim(),'?');
 const time=await p.evaluate(()=>barGame.barTime),flags=await p.evaluate(()=>JSON.stringify(barGame.progress.flags));
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>barGame.barTime),time);
 await p.screenshot({path:'/private/tmp/bar-dossier-list.png'});
 await p.locator('.guest-card[data-id="chris"]').click();
 assert.equal(await p.locator('.profile-section.locked').count(),2);assert.equal(await p.locator('.dossier-list-shell').getAttribute('inert'),'');
 assert.equal(await p.locator('[data-observation-stage="1"]').count(),1);
 await p.screenshot({path:'/private/tmp/bar-dossier-detail.png'});
 const profileY=(await p.locator('.profile-left').boundingBox()).y,headerY=(await p.locator('#profile-name').boundingBox()).y;
 await p.locator('.profile-body').evaluate(el=>el.scrollTop=el.scrollHeight);await p.waitForTimeout(180);
 assert((await p.locator('.profile-body').evaluate(el=>el.scrollTop))>0);
 assert.equal((await p.locator('.profile-left').boundingBox()).y,profileY);assert.equal((await p.locator('#profile-name').boundingBox()).y,headerY);
 await p.mouse.click(5,300);assert.equal(await p.locator('.dossier-detail').count(),1);
 await p.keyboard.press('Escape');assert.equal(await p.locator('.dossier-detail').count(),0);assert.equal(await p.evaluate(()=>barGame.overlay),'dossier');
 assert.equal(await p.evaluate(()=>barGame.barTime),time);
 await p.locator('.dossier-list-scroll').evaluate(el=>el.scrollTop=190);await p.waitForTimeout(180);
 await p.locator('.guest-card[data-id="port"]').click();assert.equal(await p.locator('.profile-section.locked').count(),1);
 // Browser automation may scroll the card into view before clicking; preserve the actual opening position.
 const listScroll=await p.locator('.dossier-list-scroll').evaluate(el=>el.scrollTop);
 assert.equal(await p.locator('.profile-body').evaluate(el=>el.scrollTop),0);
 await p.keyboard.press('Escape');assert.equal(await p.locator('.dossier-list-scroll').evaluate(el=>el.scrollTop),listScroll);
 await p.locator('.guest-card[data-id="aili"]').click();assert.equal(await p.locator('.profile-section.locked').count(),0);
 assert.equal(await p.locator('[data-observation-stage="3"]').count(),1);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>barGame.overlay),null);
 await p.waitForTimeout(180);assert((await p.evaluate(()=>barGame.barTime))>time);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.progress.flags)),flags);
 // F2 previews change no gameplay values, including Shiba's unconfirmed higher levels.
 const before=await p.evaluate(()=>JSON.stringify(barGame.progress));await p.keyboard.press('F2');
 await p.locator('[data-change="dossierTestActor"]').selectOption('shiba');await p.locator('[data-act="dossierPreview"][data-id="3"]').click();
 await p.locator('.guest-card[data-id="shiba"]').click();assert.equal(await p.locator('.profile-section.locked').count(),0);
 assert.equal(await p.evaluate(()=>JSON.stringify(barGame.progress)),before);assert.equal(await p.locator('.portrait-placeholder').count(),2);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 await p.evaluate(()=>{barGame.progress.flags.shiba_met=true;barGame.progress.affinity.shiba=99;});
 await p.keyboard.press('Tab');await p.locator('[data-act="dossierOpen"]').click();assert.equal(await p.locator('.guest-card[data-id="shiba"] .filled').count(),1);
 // Layout remains four columns; no footer, header, or page overflow on smaller viewports.
 for(const size of [{width:820,height:650},{width:600,height:800}]){
  await p.setViewportSize(size);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const y=await p.locator('.guest-card').evaluateAll(els=>els.slice(0,4).map(el=>el.getBoundingClientRect().top));assert(y.every(v=>v===y[0]));
  await p.locator('.guest-card[data-id="port"]').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:'/private/tmp/bar-dossier-'+size.width+'.png'});await p.keyboard.press('Escape');
 }
 await p.keyboard.press('Escape');await p.evaluate(()=>{barGame.lang='en';});await p.keyboard.press('Tab');await p.locator('[data-act="dossierOpen"]').click();
 assert.equal(await p.locator('#dossier-title').innerText(),'Guest profiles');
 await p.locator('.guest-card[data-id="port"]').click();assert.equal(await p.locator('#profile-name').innerText(),'Port');
 assert.deepEqual(errors,[]);console.log('DOSSIER_BROWSER_OK: 7 cards, hidden identities, 1/10/30 stages, gated sections, independent scrolling, ESC layers, unchanged flags, paused/resumed timers, isolated preview, Shiba safeguard, responsive four columns, EN.');
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

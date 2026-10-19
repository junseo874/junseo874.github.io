const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,ignoreDefaultArgs:['--hide-scrollbars']});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[],bad=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{barGame.reset(99,'general',3);barGame.progress.flags={chris_met:true,port_met:true,aili_met:true};barGame.progress.affinity={chris:0,port:10,aili:30,samho:99};barGame.overlay='dossier';lunaCampaign.render(true);});
 assert.equal(await p.locator('.guest-card').count(),7);assert.equal(await p.locator('.guest-card.unmet').count(),4);
 for(const [id,n]of [['chris',1],['port',2],['aili',3]])assert.equal(await p.locator('.guest-card[data-id="'+id+'"] .filled').count(),n);
 assert(await p.locator('.guest-card[data-id="samho"]').isDisabled());assert.equal(await p.locator('.guest-card.unmet .guest-card-caption').count(),0);
 const flags=await p.evaluate(()=>JSON.stringify(barGame.progress)),time=await p.evaluate(()=>barGame.barTime);
 await p.locator('.guest-card[data-id="port"]').hover();await p.waitForTimeout(200);await p.screenshot({path:'/private/tmp/luna-profile-list.png'});
 for(const [id,locked]of [['chris',2],['port',1],['aili',0]]){
  await p.locator('.guest-card[data-id="'+id+'"]').click();assert.equal(await p.locator('.profile-section.locked').count(),locked);assert.equal(await p.locator('.dossier-list-shell').getAttribute('inert'),'');
  if(id==='chris'){await p.screenshot({path:'/private/tmp/luna-profile-detail.png'});const before=await p.locator('.profile-left').boundingBox();await p.locator('.profile-body').evaluate(e=>e.scrollTop=e.scrollHeight);await p.waitForTimeout(100);assert(await p.locator('.profile-body').evaluate(e=>e.scrollTop>0));assert.deepEqual(await p.locator('.profile-left').boundingBox(),before);}
  await p.locator('.profile-right .profile-close').click();assert.equal(await p.locator('.dossier-detail').count(),0);
 }
 assert.equal(await p.evaluate(()=>barGame.barTime),time);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.progress)),flags);
 for(const size of [{width:820,height:650},{width:600,height:800},{width:1920,height:1080}]){
  await p.setViewportSize(size);await p.waitForTimeout(150);
  const y=await p.locator('.guest-card').evaluateAll(es=>es.slice(0,4).map(e=>e.getBoundingClientRect().y));assert(y.every(v=>v===y[0]));
  await p.locator('.dossier-list-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await p.locator('.dossier-list-scroll').evaluate(e=>e.scrollTop>0));
  await p.locator('.guest-card[data-id="port"]').click();const detail=await p.locator('.dossier-detail').boundingBox(),screen=await p.locator('.dossier-screen').boundingBox();assert(detail.x>=screen.x&&detail.y>=screen.y&&detail.x+detail.width<=screen.x+screen.width+1&&detail.y+detail.height<=screen.y+screen.height+1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(size.width===820)await p.screenshot({path:'/private/tmp/luna-profile-compact.png'});
  await p.keyboard.press('Escape');assert.equal(await p.locator('.dossier-detail').count(),0);
 }
 await p.evaluate(()=>{barGame.lang='en';lunaCampaign.render(true);});assert.equal(await p.locator('#dossier-title').textContent(),'Guest profiles');
 await p.locator('.guest-card[data-id="port"]').click();assert.equal(await p.locator('#profile-name').textContent(),'Port');await p.keyboard.press('Escape');
 await p.locator('.dossier-header .profile-close').click();assert.equal(await p.evaluate(()=>barGame.overlay),null);
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log('PASS profile artwork: four-column list, locked identities, 3 affinity stages, gates, detail scroll, close/ESC layers, pause and data preservation, compact/full HD, EN, no missing assets.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

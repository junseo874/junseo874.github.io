const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.locator('[data-id="guest-appearance"]').click();
 assert.equal(await p.locator('.version-tabs [aria-pressed="true"]').count(),1);
 assert.equal(await p.locator('[data-act="guestLooksPart"]').count(),23);
 assert.equal(await p.locator('[data-id="guest_f_mouth_4"],[data-id="guest_f_mouth_5"]').count(),0);
 const layers=()=>p.locator('[data-look-layer]').evaluateAll(els=>els.map(e=>e.dataset.lookLayer));
 const female=await layers();await p.locator('[data-act="guestLooksGender"][data-id="m"]').click();
 assert.equal(await p.locator('[data-act="guestLooksPart"]').count(),25);
 assert.equal(await p.locator('[data-id="guest_m_mouth_4"],[data-id="guest_m_mouth_5"]').count(),0);
 await p.locator('[data-id="guest_m_top_3"]').click();await p.locator('[data-id="guest_m_Acc_2"]').click();
 assert((await layers()).includes('guest_m_Acc_2'));
 await p.locator('[data-id="guest_m_top_1"]').click();assert(!(await layers()).includes('guest_m_Acc_2'));
 assert(await p.locator('[data-id="guest_m_Acc_2"]').isDisabled());
 for(const key of ['guest_m_cyberware_1','guest_m_cyberware_3']){
  assert(await p.locator(`[data-id="${key}"]`).isDisabled());
  await p.locator('[data-id="guest_m_top_3"]').click();await p.locator(`[data-id="${key}"]`).click();
  assert((await layers()).includes(key));
  await p.locator('[data-id="guest_m_top_2"]').click();assert(!(await layers()).includes(key));
  assert(await p.locator(`[data-id="${key}"]`).isDisabled());
 }
 for(const top of [1,2,3]){
  await p.locator(`[data-id="guest_m_top_${top}"]`).click();
  assert(!(await p.locator('[data-id="guest_m_cyberware_2"]').isDisabled()));
  await p.locator('[data-id="guest_m_cyberware_2"]').click();
  assert((await layers()).includes('guest_m_cyberware_2'));
 }
 await p.locator('[data-act="guestLooksGender"][data-id="f"]').click();assert.deepEqual(await layers(),female);
 await p.locator('[data-act="guestLooksRandom"]').click();
 const selected=await p.locator('.guest-look-options [aria-pressed="true"]').evaluateAll(es=>es.map(e=>e.dataset.id).filter(k=>k!=='none'));
 assert.deepEqual(selected,await layers());
 await p.waitForFunction(()=>[...document.querySelectorAll('.guest-look-screen img')].every(i=>i.complete&&i.naturalWidth));
 await p.locator('.guest-look-screen').evaluate(e=>e.scrollTop=0);
 await p.mouse.move(1400,950);await p.waitForTimeout(200);
 await p.screenshot({path:'/private/tmp/guest-look-tab.png'});
 await p.locator('[data-act="version"][data-id="original"]').click();assert(await p.locator('#start-mode').isVisible());
 assert.deepEqual(errors,[]);console.log('GUEST_APPEARANCE_TAB_UI_OK: both genders, all 46 eligible assets, selection persistence, accessory constraints, tab navigation and images.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

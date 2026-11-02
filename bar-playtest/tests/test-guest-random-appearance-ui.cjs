const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 const result=await p.evaluate(async()=>{
  const g=barGame;g.reset(99,'practice',127,true);g.screen='bar';g.phase='general';g.qaKeepGeneral=true;g.story=null;g.dialogue=null;g.spawnLeft=9999;g.overview=true;
  g.queue=Array.from({length:3},()=>({personality:'gentle',order:'gin_tonic',max_rounds:1}));g.queueIndex=0;
  for(let i=0;i<3;i++)g.spawn();
  const guests=Object.values(g.seats),before=JSON.stringify(guests.map(x=>x.appearance));
  for(const guest of guests)for(const key of guest.appearance.layers){const im=new Image();im.src=LUNA_DATA.assets[key].src;await im.decode();}
  window.guestAppearanceBefore=before;return guests.map(x=>x.appearance.layers);
 });assert.equal(result.length,3);
 await p.waitForTimeout(1500);assert.equal(await p.locator('.actor.pixel-actor').count(),3);
 const orders=await p.locator('.actor.pixel-actor').evaluateAll(actors=>actors.map(a=>[...a.querySelectorAll('[data-layer]')].map(n=>n.dataset.layer)));
 for(const keys of orders){const face=keys.findIndex(k=>/_talk_eyes_\d+$/.test(k)),brow=keys.findIndex(k=>/_eyebrow_\d+$/.test(k)),hair=keys.findIndex(k=>/_hair_\d+$/.test(k));assert(brow>=0);if(face>=0)assert(face<brow);assert(brow<hair);}
 await p.screenshot({path:'/private/tmp/random-guests-after.png'});
 assert(await p.evaluate(()=>JSON.stringify(Object.values(barGame.seats).map(x=>x.appearance))===guestAppearanceBefore));
 assert.deepEqual(errors,[]);console.log('GUEST_RANDOM_UI_OK: three spawned composite customers, decoded native assets, stable identities, no browser errors.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

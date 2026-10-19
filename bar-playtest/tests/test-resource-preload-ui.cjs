const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 // Deliberately hold a real UI resource as if the deployed connection were slow.
 const resource='assets/ui/cursors/crosshair.svg';let release,requested;
 const held=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>requested=resolve);
 await p.route('**/data/presentation/preload-manifest.json',route=>route.fulfill({json:{common:[resource],bar:['assets/serving/atlases/background.png']}}));
 await p.route('**/'+resource,async route=>{requested();await held;await route.continue();});
 await p.evaluate(()=>{void lunaCampaign.newGame();});await arrived;
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'loading');assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>lunaCampaign.view),'loading');release();
 await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
 assert(await p.evaluate(()=>{const a=outsidePlaytest;return a.active&&!a.loading&&!a.loadError;}));
 // Deduplication and a failed preparation can both be retried without reload.
 let failures=0;await p.route('**/preload-failure.png',route=>{failures++;return route.fulfill({status:503,body:'unavailable'});});
 assert(await p.evaluate(async()=>{try{await Promise.all([LunaResources.batch(['preload-failure.png']),LunaResources.batch(['preload-failure.png'])]);return false;}catch{return true;}}));assert.equal(failures,2);
 await p.unroute('**/preload-failure.png');await p.route('**/preload-failure.png',route=>route.fulfill({status:200,body:'retry works'}));
 await p.evaluate(()=>LunaResources.batch(['preload-failure.png']));
 let releaseBar,barRequested;
 const barHeld=new Promise(resolve=>releaseBar=resolve),barArrived=new Promise(resolve=>barRequested=resolve);
 await p.route('**/assets/serving/atlases/background.png',async route=>{barRequested();await barHeld;await route.continue();});
 await p.evaluate(()=>{lunaCampaign.cancelMemoryTransition();lunaCampaign.disposeCinema();lunaCampaign.startBar(0,lunaCampaign.session.carry);});
 await barArrived;assert.equal(await p.evaluate(()=>lunaCampaign.doorTransition.ready),false);
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>lunaCampaign.doorTransition.ready),false);releaseBar();
 await p.waitForFunction(()=>lunaCampaign.doorTransition?.ready,null,{timeout:60000});
 const audit=await browser.newPage();await audit.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 await audit.evaluate(async()=>{await LunaResources.prepare('common');await LunaResources.prepare('bar');});await audit.close();
 assert.deepEqual(errors,[]);console.log('PASS slow UI/bar keeps loading opaque, decoded exterior before reveal, dedupe, failed load retry, full shipped common/bar inventory');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

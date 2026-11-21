const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 // Deliberately hold a real UI resource as if the deployed connection were slow.
 const resource='assets/01.ArtResources/05.UI/01.Shared/WebGenerated/Cursors/Web_IMG_cursor_crosshair_icon.png';let release,requested;
 const held=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>requested=resolve);
 let releaseBar,barRequested,barRequests=0;
 const barHeld=new Promise(resolve=>releaseBar=resolve),barArrived=new Promise(resolve=>barRequested=resolve);
 await p.route('**/assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/03.Background/Background.png',async route=>{barRequests++;barRequested();await barHeld;await route.continue();});
 await p.evaluate(()=>{const original=window.fetch;window.preloadFetches=[];window.fetch=(url,options)=>{window.preloadFetches.push({url:String(url),cache:options?.cache});return original(url,options);};});
 await p.route('**/data/presentation/preload-manifest.json',route=>route.fulfill({json:{common:[resource],bar:['assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/03.Background/Background.png']}}));
 await p.route('**/'+resource,async route=>{requested();await held;await route.continue();});
 let scriptRequests=0;await p.route('**/src/cinema/sprites.js?*',route=>++scriptRequests===1?route.fulfill({status:503,body:'unavailable'}):route.continue());
 await p.evaluate(()=>{void lunaCampaign.newGame();});await arrived;
 assert.equal(await p.evaluate(()=>window.preloadFetches.find(r=>r.url.endsWith('/preload-manifest.json'))?.cache),'no-cache');
 assert(!await p.evaluate(()=>window.preloadFetches.some(r=>r.url.endsWith('/Web_IMG_cursor_crosshair_icon.png'))),'image decode must not be preceded by a duplicate fetch');
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'loading');assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>lunaCampaign.view),'loading');release();
 await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});assert.equal(scriptRequests,2,'transient script failure recovers without a popup');
 await barArrived;assert(await p.evaluate(()=>LunaBarDoor.ready),'door art must already be decoded while the opening plays');
 assert(await p.evaluate(()=>{const a=outsidePlaytest;return a.active&&!a.loading&&!a.loadError;}));
 // Deduplication and a failed preparation can both be retried without reload.
 let failures=0;await p.route('**/preload-failure.png',route=>{failures++;return route.fulfill({status:503,body:'unavailable'});});
 assert(await p.evaluate(async()=>{try{await Promise.all([LunaResources.batch(['preload-failure.png']),LunaResources.batch(['preload-failure.png'])]);return false;}catch{return true;}}));assert.equal(failures,2);
 await p.unroute('**/preload-failure.png');await p.route('**/preload-failure.png',route=>route.fulfill({status:200,body:'retry works'}));
 await p.evaluate(()=>LunaResources.batch(['preload-failure.png']));
 // A broken cutscene image must not poison StudioMedia for the entire session.
 let docAttempts=0;const docArt='**/documentary-care.png*';await p.route(docArt,route=>{docAttempts++;return route.fulfill({status:503,body:'offline'});});
 const docError=await p.evaluate(()=>lunaCampaign.prepareStudio('documentary').then(()=>'',e=>e.message));
 assert.match(docError,/documentary-care\.png/);assert.equal(docAttempts,2);
 await p.unroute(docArt);await p.evaluate(()=>lunaCampaign.prepareStudio('documentary').then(()=>null));
 assert(await p.evaluate(()=>StudioMedia.getImage('documentary-tv-0').naturalWidth>0));
 await p.evaluate(()=>{lunaCampaign.cancelMemoryTransition();lunaCampaign.disposeCinema();lunaCampaign.startBar(0,lunaCampaign.session.carry);});
 assert.equal(await p.evaluate(()=>lunaCampaign.doorTransition.ready),false);
 assert(await p.locator('.bar-door-composition').isVisible());
 assert(await p.locator('.bar-door-composition img').evaluateAll(imgs=>imgs.length===3&&imgs.every(i=>i.complete&&i.naturalWidth>0)));
 await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>lunaCampaign.doorTransition.ready),false);releaseBar();
 await p.waitForFunction(()=>lunaCampaign.doorTransition?.ready,null,{timeout:60000});
 assert.equal(barRequests,1,'entry must join the preload already in flight');
 await p.waitForFunction(()=>!lunaCampaign.doorTransition&&lunaCampaign.view==='game');
 // Simulate an exterior image not present on the inbound commute; use the real scene loader on exit.
 let releaseStreet;
 const streetHeld=new Promise(resolve=>releaseStreet=resolve);
 await p.route('**/IMG_interaction.png?exit-test',async route=>{await streetHeld;await route.continue();});
 const streetRequest=p.waitForRequest('**/IMG_interaction.png?exit-test');
 await p.evaluate(()=>{LUNA_OUTSIDE_DATA.assets.testExit={src:'assets/ui/outside/IMG_interaction.png?exit-test'};void lunaCampaign.street('out');});
 await streetRequest;await p.waitForTimeout(3200);
 assert.deepEqual(await p.evaluate(()=>[lunaCampaign.view,lunaCampaign.doorTransition.ready,lunaCampaign.doorTransition.motionAt]),['bar-door',false,null]);
 assert(await p.locator('#outside-root').evaluate(el=>el.inert),'the hidden destination cannot take input');
 releaseStreet();await p.waitForFunction(()=>!lunaCampaign.doorTransition&&lunaCampaign.view==='game'&&outsidePlaytest.model.scene==='street');
 const audit=await browser.newPage();await audit.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 await audit.evaluate(async()=>{await LunaResources.prepare('common');await LunaResources.prepare('bar');});await audit.close();
 assert.deepEqual(errors,[]);console.log('PASS slow UI/bar keeps loading opaque, decoded exterior before reveal, dedupe, failed load retry, full shipped common/bar inventory');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

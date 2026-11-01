const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs'),sharp=load('sharp');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=extract');await p.waitForFunction(()=>window.resourceReview?.ready,null,{timeout:90000});
 const inventory=await p.evaluate(()=>({rows:resourceReview.rows,entries:ResourceExtraction.entries}));
 assert.equal(new Set(inventory.rows.map(r=>r.id)).size,inventory.rows.length,'unique review IDs');
 for(const kind of ['beer','cocktail','long_drink'])assert(inventory.rows.some(r=>r.id==='art:table_empty_glass_'+kind&&r.facets.kind==='glass'&&r.facets.usage==='table'));
 for(const file of ['9_ArtResources/01.Characters/01.Bar/07.Tom/Idle/Talk/body.png','9_ArtResources/01.Characters/01.Bar/07.Tom/Idle/Talk/face_bottom_talk.png','9_ArtResources/05.UI/02.Title/01.Sprites/IMG_logo.png','outside/effects/fire/cloud.png','outside/effects/fire/distortion.png','outside/effects/tx-ledsign-scrollmask-01.png','outside/shiba-wanted-poster-20261019.png','tutorials/mixing/stir-0.png','tutorials/controls/interaction-npc.png'])assert(inventory.entries.some(e=>e.src==='assets/'+file),file);
 assert(!inventory.entries.some(e=>/\.ttf|reference\/(exports|previews)/.test(e.src)),'only reusable image assets');
 assert(!inventory.rows.find(r=>r.id==='actor:tom:idle_talk').note.includes('정적 이미지'));
 // Decode every standalone source, including previously missed non-animated art.
 const sources=[...new Set(inventory.entries.flatMap(e=>[e.src,...(e.layer?.rects||[]).map(f=>f.src)].filter(Boolean)))];
 for(const src of sources){
  if(src.startsWith('data:')){await sharp(Buffer.from(src.slice(src.indexOf(',')+1),'base64')).metadata();continue;}
  const rel=src.startsWith('http')?new URL(src).pathname.replace(/^\/bar-playtest\//,''):src;await sharp(fs.readFileSync(path.resolve(root,rel.split('?')[0]))).metadata();
 }
 const bad=await p.evaluate(async()=>{const bad=[];for(const a of ResourceExtraction.entries){const l=a.layer||{};if(!l.rects&&!(l.frames>1))continue;try{for(let n=0;n<(l.rects?.length||l.frames||1);n++)await ResourceExtraction.raster(a,n);}catch(e){bad.push([a.title,e.message]);}}return bad;});assert.deepEqual(bad,[],'all animation frames within source bounds');
 await p.click('[data-group="bar-characters"]');await p.evaluate(()=>resourceReview.select('actor:tom:idle_talk'));
 const mouth=p.locator('.image-download').filter({has:p.locator('strong',{hasText:'char_tom_talk_face_bottom_talk'})});
 let pending=p.waitForEvent('download');await mouth.locator('a').click();let d=await pending;assert.equal(await d.failure(),null);
 assert.equal(d.suggestedFilename(),'face_bottom_talk.png','download preserves canonical original filename');
 const original=fs.readFileSync(path.join(root,'assets/9_ArtResources/01.Characters/01.Bar/07.Tom/Idle/Talk/face_bottom_talk.png'));assert(fs.readFileSync(await d.path()).equals(original),'original sheet byte equality');
 await mouth.locator('input').fill('3');pending=p.waitForEvent('download');await mouth.locator('[data-download-image]').click();d=await pending;
 const bytes=fs.readFileSync(await d.path()),meta=await sharp(bytes).metadata();assert.equal(meta.width,551);assert.equal(meta.height,530);assert(meta.hasAlpha);
 const expected=await sharp(original).extract({left:1102,top:0,width:551,height:530}).ensureAlpha().raw().toBuffer(),actual=await sharp(bytes).ensureAlpha().raw().toBuffer();
 for(let i=0;i<actual.length;i+=4){assert.equal(actual[i+3],expected[i+3]);if(actual[i+3]===255)assert(actual.subarray(i,i+3).equals(expected.subarray(i,i+3)));}
 await mouth.locator('input').fill('999');pending=p.waitForEvent('download');await mouth.locator('[data-download-image]').click();await pending;assert.equal(await mouth.locator('input').inputValue(),'4');
 await p.screenshot({path:'/private/tmp/resource-current-tom.png',fullPage:true});
 await p.click('[data-group="bar-items"]');await p.fill('#search','빈 잔');assert.equal(await p.locator('#grid .card').count(),3);await p.evaluate(()=>resourceReview.select('art:table_empty_glass_beer'));
 pending=p.waitForEvent('download');await p.locator('#inspect-downloads a').click();d=await pending;assert(fs.readFileSync(await d.path()).equals(fs.readFileSync(path.join(root,'assets/9_ArtResources/03.Crafting/03.Cocktails/02.Table/Glasses/beer_glass.png'))));
 await p.screenshot({path:'/private/tmp/resource-current-glasses.png',fullPage:true});
 await p.click('[data-group="extraction"]');await p.fill('#extract-search','꼬리');assert.equal(await p.locator('.extract-card').count(),3);
 for(const card of await p.locator('.extract-card').all()){pending=p.waitForEvent('download');await card.locator('[data-extract="raw"]').click();d=await pending;assert.equal(await d.failure(),null);assert((await sharp(fs.readFileSync(await d.path())).metadata()).hasAlpha);}
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:'/private/tmp/resource-current-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS current artwork:',inventory.rows.length,'review rows;',inventory.entries.length,'extraction entries;',sources.length,'decoded image sources; every animation frame; original bytes, alpha, layer frame downloads, empty glasses, three tails and mobile layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

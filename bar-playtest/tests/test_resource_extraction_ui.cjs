const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1500,height:1000},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=extract');await p.waitForFunction(()=>window.resourceReview?.ready,{},{timeout:60000});
 assert(await p.locator('#extraction-view').isVisible());assert(await p.locator('#catalog-view').isHidden());assert(await p.locator('#inspector').isHidden());
 const inventory=await p.evaluate(()=>ResourceExtraction.entries);assert(inventory.length>150);assert(!inventory.some(a=>/resource-(previews|exports)/.test(a.src)));assert(inventory.some(a=>a.title.includes('외부 말풍선')));assert(inventory.some(a=>a.title.includes('코스터')));
 await p.selectOption('#extract-category','UI · 분리 그래픽');assert.equal(await p.locator('.extract-card').count(),18);
 await p.fill('#extract-search','상호작용');assert.equal(await p.locator('.extract-card').count(),2);
 const icon=p.locator('.extract-card').filter({has:p.locator('h3',{hasText:'아이콘만'})});
 let pending=p.waitForEvent('download');await icon.locator('[data-extract="raw"]').click();let d=await pending;assert.equal(await d.failure(),null);let buf=fs.readFileSync(await d.path());let meta=await sharp(buf).metadata();assert.equal(meta.width,32);assert.equal(meta.height,32);assert(meta.hasAlpha);
 const alpha=await sharp(buf).raw().toBuffer();assert.equal(alpha[3],0,'transparent corner');
 await p.screenshot({path:'/private/tmp/resource-extraction-interaction.png'});
 await p.fill('#extract-search','선택지');assert.equal(await p.locator('.extract-card').count(),16);await p.screenshot({path:'/private/tmp/resource-extraction-choices.png'});
 // Original artwork must be byte-identical, not a screenshot.
 await p.selectOption('#extract-category','UI · 원본 조각');await p.fill('#extract-search','IMG_choice_A.png');assert.equal(await p.locator('.extract-card').count(),1);
 pending=p.waitForEvent('download');await p.locator('[data-extract="raw"]').click();d=await pending;assert(fs.readFileSync(await d.path()).equals(fs.readFileSync(path.resolve(__dirname,'../assets/ui/choices/IMG_choice_A.png'))));
 // Individual Tom layers, including a chosen animation frame, retain sprite geometry.
 await p.selectOption('#extract-category','전체');await p.fill('#extract-search','tom-idle-20261019/body.png');assert.equal(await p.locator('.extract-card').count(),1);
 await p.fill('[data-frame]','3');await p.locator('[data-frame]').press('Tab');
 pending=p.waitForEvent('download');await p.locator('[data-extract="frame"]').click();d=await pending;buf=fs.readFileSync(await d.path());meta=await sharp(buf).metadata();assert.equal(meta.width,551);assert.equal(meta.height,530);
 const expected=await sharp(path.resolve(__dirname,'../assets/characters/tom/idle/body.png')).extract({left:1102,top:0,width:551,height:530}).raw().toBuffer();const actual=await sharp(buf).raw().toBuffer();
 // Browsers may round RGB values at translucent edges; compare alpha and opaque pixels.
 for(let i=0;i<actual.length;i+=4){assert.equal(actual[i+3],expected[i+3]);if(actual[i+3]===255)assert(actual.subarray(i,i+3).equals(expected.subarray(i,i+3)));}
 await p.check('[data-trim]');pending=p.waitForEvent('download');await p.locator('[data-extract="frame"]').click();d=await pending;meta=await sharp(fs.readFileSync(await d.path())).metadata();assert(meta.width<551&&meta.height<530);
 await p.fill('[data-frame]','999');await p.locator('[data-frame]').press('Tab');assert.equal(await p.locator('[data-frame]').inputValue(),'4');
 await p.fill('#extract-search','');assert.equal(await p.locator('.extract-card').count(),36);const first=await p.locator('.extract-card').first().getAttribute('data-graphic');await p.click('[data-extract-page="1"]');assert.notEqual(await p.locator('.extract-card').first().getAttribute('data-graphic'),first);
 await p.fill('#extract-search','없는리소스-xyz');assert.equal(await p.locator('.extract-card').count(),0);assert(await p.locator('[data-extract-page="1"]').isDisabled());
 await p.click('[data-group="bar-ui"]');assert(await p.locator('#extraction-view').isHidden());assert(await p.locator('#catalog-view').isVisible());await p.evaluate(()=>resourceReview.select('ui:exterior:street'));assert((await p.locator('#inspect-downloads').innerText()).includes('그래픽 요소별 PNG 추출'));
 await p.evaluate(()=>resourceReview.launch({type:'pair'},'말풍선 테스트',''));assert(await p.locator('#lab').isVisible());await p.locator('#close-lab').click();await p.waitForFunction(()=>document.querySelector('#lab').classList.contains('parked'));
 await p.click('[data-group="missing"]');assert(await p.locator('#missing-view').isVisible());assert(await p.locator('#extraction-view').isHidden());
 await p.click('[data-group="extraction"]');await p.fill('#extract-search','상호작용');await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/resource-extraction-mobile.png',fullPage:true});
 // Every newly registered standalone PNG exists and can be decoded.
 const assets=await p.evaluate(()=>ResourceExtractionAssets);assert(!assets.some(a=>a.src==='assets/ui/exterior-textbox/GRD_textbox.png'),'Exclude dialogue-filled reference sheets');
 for(const a of assets){const bytes=fs.readFileSync(path.resolve(__dirname,'..',a.src)),m=await sharp(bytes).metadata();assert.equal(m.width,a.w);assert.equal(m.height,a.h);if(a.category==='UI · 분리 그래픽'){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert(data.some((v,i)=>i%info.channels===info.channels-1&&v>0),a.src+' must not be blank');}}
 assert.deepEqual(errors,[]);console.log('PASS:',inventory.length,'graphics;',assets.length,'registered UI PNGs; isolated E, original bytes, selected layer/frame, trim, pagination, navigation, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

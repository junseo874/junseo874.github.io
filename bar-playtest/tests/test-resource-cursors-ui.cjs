const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs'),{chromium}=rt.load('playwright'),sharp=rt.load('sharp');
(async()=>{
 const browser=await chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=cursors');
  await page.waitForFunction(()=>window.resourceReview?.ready);
  const rows=await page.evaluate(()=>resourceReview.rows.filter(r=>r.cursor));
  const files=fs.readdirSync(path.join(__dirname,'../assets/ui/cursors')).filter(f=>f.endsWith('.svg'));
  assert.deepEqual(rows.map(r=>r.cursor.id+'.svg').sort(),files.sort(),'Every native cursor must be available');
  assert.equal(await page.locator('#grid .card').count(),12);
  for(const row of rows){
   // Space real downloads to avoid Chromium's bulk-download rate limit.
   await page.waitForTimeout(1100);
   await page.locator('[data-id="'+row.id+'"]').click();
   const rawEvent=page.waitForEvent('download');await page.locator('#inspect-downloads a').click();
   const raw=await rawEvent;assert.equal(await raw.failure(),null);
   assert(fs.readFileSync(await raw.path()).equals(fs.readFileSync(path.join(__dirname,'../assets/ui/cursors',row.cursor.id+'.svg'))));
   const saved=page.waitForEvent('download');await page.locator('#inspect-downloads button').click();
   const png=await saved;assert.equal(await png.failure(),null);
   const {data,info}=await sharp(await png.path()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(info.width,32);assert.equal(info.height,32);
   const expected=await page.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return Array.from(ctx.getImageData(0,0,32,32).data);},row.cursor.src);
   assert.deepEqual([...data],expected,'PNG must preserve native cursor pixels and transparent padding');
   assert(expected.some((v,i)=>i%4===3&&v===0));assert(expected.some((v,i)=>i%4===3&&v>0));
  }
  await page.locator('[data-group="extraction"]').click();
  await page.selectOption('#extract-category','UI · 마우스 커서');
  assert.equal(await page.locator('.extract-card').count(),12);
  const saved=page.waitForEvent('download');await page.locator('.extract-card [data-extract="raw"]').first().click();
  const png=await saved;assert.equal(await png.failure(),null);assert.equal((await sharp(await png.path()).metadata()).width,32);
  await page.locator('[data-group="common-cursors"]').click();
  await page.locator('[data-id="cursor:default"]').click();
  await page.screenshot({path:'/private/tmp/resource-cursors-review.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="close-inspector"]').click();
  await page.selectOption('#category-select','common-cursors');
  await page.locator('[data-id="cursor:pointer"]').click();
  assert(await page.locator('#inspect-downloads button').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS all 12 cursor SVG originals and exact transparent 32px PNG exports; extraction, navigation and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

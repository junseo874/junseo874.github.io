const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
 const browser = await chromium.launch({executablePath:runtime.chrome,headless:true});
 try {
  const page = await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.locator('.version-tabs a[href="data-review.html"]').click();
  await page.waitForFunction(()=>!document.getElementById('table').disabled);
  assert.equal(await page.locator('#table option').count(),44);
  for(const width of [390,760,1440]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
   assert(await page.locator('#rows tr').count()>0);
  }
  await page.locator('#search').fill('__no_matching_dialogue__');
  assert.equal(await page.locator('#rows tr').count(),0);
  await page.locator('#search').fill('');
  await page.locator('#metadata').check();
  assert((await page.locator('#head').innerText()).includes('row_id'));
  await page.locator('#next').click();
  assert((await page.locator('#page').innerText()).startsWith('2 /'));
  const href=await page.locator('#download').getAttribute('href');
  assert.equal((await page.request.get(new URL(href,page.url()).href)).status(),200);
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.waitForFunction(()=>window.LUNA_DATA?.sharedCsv);
  const data=await page.evaluate(()=>({tables:Object.keys(LUNA_DATA.tables).length,lines:Object.keys(LUNA_DATA.sharedStory).length,story:!!LUNA_CAMPAIGN_DATA.bar}));
  assert.equal(data.tables,29);assert(data.lines>=25);assert(data.story);
  assert.deepEqual(errors,[]);
  console.log('SHARED_DATA_UI_OK: 44 CSV tables, search/download/pagination, 3 responsive widths, runtime shared data.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
const {chromium}=load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html?tab=popups');await p.waitForFunction(()=>resourceReview.ready);
  const category=async id=>{if(await p.locator('#category-select').isVisible())await p.selectOption('#category-select',id);else await p.locator(`[data-group="${id}"]`).click();};
  const within=async selector=>{const b=await p.locator(selector).boundingBox(),v=p.viewportSize();assert(b&&b.width>0&&b.height>0,selector+' visible');assert(b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,selector+' fits '+JSON.stringify({b,v}));return b;};
  assert.equal(await p.locator('#filter-panel').getAttribute('open'),null);
  await p.locator('#grid [data-id="popup:lesson-stir"]').click();
  assert(await p.locator('#lab').evaluate(el=>el.classList.contains('parked')),'Cards preview first, not auto-launch');
  assert.equal(await p.locator('.resource-details').getAttribute('open'),null);
  await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(300);
  await p.locator('#grid img').evaluateAll(images=>Promise.all(images.filter(im=>im.getBoundingClientRect().top<innerHeight).map(im=>im.decode())));
  await p.screenshot({path:'/private/tmp/resource-workspace-desktop.png'});
  await p.locator('[data-action="launch"]').click();await p.locator('#popup-switch').waitFor();
  for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[800,600],[390,844],[320,568],[844,390]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(150);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
   const b=await within('.frame-wrap');assert(Math.abs(b.width/b.height-16/9)<.02,'16:9 stage');
   const toolbar=await within('.lab-toolbar');assert(b.y>=toolbar.y+toolbar.height-1,'Stage below toolbar');
   for(const selector of ['#close-lab','#replay','#lab-fullscreen','#popup-switch','#lab-state','#lab-files>summary'])await within(selector);
   if(width===1440||width===390)await p.screenshot({path:`/private/tmp/resource-workspace-lab-${width}.png`});
  }
  await p.setViewportSize({width:1280,height:720});
  await p.selectOption('#lab-state','stir-1');await p.waitForTimeout(150);assert.equal(await p.locator('#lab-state').inputValue(),'stir-1');
  await p.selectOption('#popup-switch','popup:affinity');await p.locator('#popup-actor').waitFor();await p.selectOption('#popup-actor','samho');
  await p.waitForTimeout(150);await p.locator('#replay').click();await p.waitForTimeout(150);assert.equal(await p.locator('#popup-actor').inputValue(),'samho');
  await p.locator('#lab-files>summary').click();const pending=p.waitForEvent('download');await p.locator('#lab-downloads').getByRole('link',{name:'팝업 참고 PNG',exact:true}).click();assert.equal(await (await pending).failure(),null);
  await p.locator('#lab-files>summary').click();await p.locator('#lab-fullscreen').click();await p.locator('#fullscreen-exit').waitFor();await p.locator('#fullscreen-exit').click();await p.waitForTimeout(100);await within('#close-lab');
  await p.locator('#close-lab').click();assert(await p.locator('#lab').evaluate(el=>el.inert));
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);
  // Resizing with a selection preserves access to details as a bounded drawer.
  await within('#inspector');assert(await p.locator('.workspace>main').evaluate(el=>el.inert));await p.keyboard.press('Escape');assert(!(await p.locator('#inspector').isVisible()));assert(!(await p.locator('.workspace>main').evaluate(el=>el.inert)));
  for(const group of ['bar-ui','out-ui','common-popups','common-sounds','extraction','missing']){
   await category(group);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),group+' mobile overflow');
  }
  await category('bar-ui');await p.locator('#search').fill('정산');await p.locator('#grid .card').first().click();await within('#inspector');
  await p.screenshot({path:'/private/tmp/resource-workspace-mobile-detail.png'});await p.locator('.inspector-close').click();assert(!(await p.locator('#inspector').isVisible()));
  await p.locator('#filter-panel>summary').click();await p.locator('[data-status="code"]').click();assert((await p.locator('#filter-count').innerText()).includes('1'));
  await p.locator('[data-filter-reset]').click();assert.equal(await p.locator('#search').inputValue(),'');
  await p.setViewportSize({width:1440,height:900});await category('common-popups');await p.locator('#grid [data-id="popup:lesson-stir"]').click();await p.locator('[data-action="launch"]').click();await p.goBack();await p.waitForFunction(()=>document.querySelector('#lab').classList.contains('parked'));
  assert.deepEqual(errors,[]);console.log('RESOURCE_WORKSPACE_OK: eight viewport sizes, contained 16:9 stage/toolbar, preview-first cards, states/actors/replay, fullscreen, PNG download, drawer focus, filters, six mobile categories and browser back');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

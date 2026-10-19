// Run with Playwright installed and the repository served over HTTP.
// Optional: STUDIO_URL, PLAYWRIGHT_MODULE, CHROME_PATH.
const { chromium } = require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../src/model.js');
require('../src/tags.js');
require('../src/model-v2.js');
const M = globalThis.StudioModel;
for (const id of ['encounter', 'cinematic', 'cat']) {
  const p = M.template(id);
  assert.deepEqual(M.validate(p), p);
  assert.equal(M.issues(p).length, 0);
  assert.deepEqual(M.sample(p, 5.5), M.sample(p, 5.5));
}
const p = M.template();
assert.equal(M.sample(p, 3).actors.luna.x, -3.8);
assert.equal(M.sample(p, 3).actors.luna.animation, 'idle');
assert.equal(M.sample(p, 1).actors.luna.animation, 'walk');
assert.equal(M.sample(p, 6).dialogue.actor, 'samho');
p.clips[0].id = '\" onclick=evil';
assert.throws(() => M.validate(p));
(async () => {
 const browser = await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});
 const page = await browser.newPage({viewport:{width:1600,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:8123/cutscene-studio/');
 await page.waitForFunction(()=>cutsceneStudio.ready);
 assert.equal(await page.locator('#asset-error').isVisible(),false);
 assert.equal(await page.locator('.clip').count(),10);
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-studio-desktop.png'),fullPage:true});
 // E-only gate freezes time; seeking never blocks.
 await page.evaluate(()=>cutsceneStudio.seek(7.9));
 await page.locator('#play').click();
 await page.waitForFunction(()=>!!cutsceneStudio.waiting);
 const frozen=await page.evaluate(()=>cutsceneStudio.time);
 await page.keyboard.press('Space');
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>cutsceneStudio.time),frozen);
 await page.keyboard.press('e');
 await page.waitForFunction(()=>!cutsceneStudio.waiting&&cutsceneStudio.time>8.1);
 await page.evaluate(()=>cutsceneStudio.seek(8));
 assert.equal(await page.evaluate(()=>cutsceneStudio.waiting),null);
 // Text edit and undo/redo.
 const dialogue=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='dialogue'));
 await page.evaluate(id=>cutsceneStudio.select(id),dialogue.id);
 await page.locator('[data-field=text]').fill('편집 테스트입니다.\n두 번째 줄.');
 await page.locator('[data-field=text]').press('Tab');
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).text,dialogue.id),'편집 테스트입니다.\n두 번째 줄.');
 await page.locator('#undo').click();
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).text,dialogue.id),dialogue.text);
 await page.locator('#redo').click();
 // Timeline drag and resizing.
 let box=await page.locator('[data-clip="'+dialogue.id+'"]').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+15);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+15,{steps:5});await page.mouse.up();
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).start,dialogue.id),6);
 await page.locator('#undo').click();
 box=await page.locator('[data-clip="'+dialogue.id+'"]').boundingBox();
 await page.mouse.move(box.x+box.width-2,box.y+15);await page.mouse.down();await page.mouse.move(box.x+box.width+43,box.y+15,{steps:5});await page.mouse.up();
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).duration,dialogue.id),4);
 // Move speed controls duration.
 const move=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='move'));
 await page.evaluate(id=>cutsceneStudio.select(id),move.id);
 await page.locator('[data-field=speed]').fill('1.1');await page.locator('[data-field=speed]').press('Tab');
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).duration,move.id),1);
 // A/B handles belong to path view; scene view uses per-object gizmos.
 await page.locator('#scene-view').click();
 for (const type of ['move','camera']) {
  const c=await page.evaluate(type=>cutsceneStudio.project.clips.find(c=>c.type===type),type);
  await page.evaluate(id=>cutsceneStudio.select(id),c.id);
  const handle=await page.evaluate(c=>{
   const cam=cutsceneStudio.sample().camera;
   cam.y=Math.max(cam.y,-1.48+cam.w*720/1280/2);
   const r=document.querySelector('#stage').getBoundingClientRect(),ratio=Math.min(r.width/1280,r.height/720);
   return {x:r.left+(r.width-1280*ratio)/2+(640+(c.to.x-cam.x)*1280/cam.w)*ratio,
    y:r.top+(r.height-720*ratio)/2+(360-(c.to.y-cam.y)*1280/cam.w)*ratio,delta:30/ratio*cam.w/1280};
  },c);
  await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(handle.x+30,handle.y,{steps:5});await page.mouse.up();
  const x=await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).to.x,c.id);
  assert.ok(Math.abs(x-c.to.x-handle.delta)<.003,'world handle '+type);
 }
 // Export/import is a real JSON round trip, not just a button mockup.
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
 const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 M.validate(exported);
 await page.locator('#file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#confirm-replace').click();
 delete exported.media;
 assert.deepEqual(await page.evaluate(()=>cutsceneStudio.project),exported);
 await page.waitForTimeout(350);await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);
 assert.deepEqual(await page.evaluate(()=>cutsceneStudio.project),exported);
 await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
 await page.waitForFunction(()=>document.querySelector('#modal').open);
 assert.match(await page.locator('#modal-title').textContent(),/불러오지/);
 await page.locator('#close-modal').click();
 // Template replacement, input bypass, deterministic scrub.
 await page.locator('.template-fold summary').click();await page.locator('[data-template=cat]').click();await page.locator('#confirm-replace').click();
 await page.evaluate(()=>cutsceneStudio.seek(7.9));await page.locator('#gates').uncheck();await page.locator('#play').click();
 await page.waitForFunction(()=>cutsceneStudio.time>8.1);
 assert.equal(await page.evaluate(()=>cutsceneStudio.waiting),null);
 await page.evaluate(()=>cutsceneStudio.seek(8.5));
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-studio-cat.png'),fullPage:true});
 // Mobile: horizontally scrollable timeline, not overflowing page.
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-studio-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: model, assets, E gates, edits, undo/redo, timeline drag/resize, movement speed, JSON roundtrip, autosave, invalid import, templates, bypass, mobile and page errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

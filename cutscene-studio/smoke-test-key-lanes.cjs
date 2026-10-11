const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{
const p=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8123/cutscene-studio/');await p.waitForFunction(()=>cutsceneStudio.ready);
// Unbound scene-object coverage; selected-clip edits are covered by smoke-test-bound-recording.
const fixture=await p.evaluate(()=>{const q=cutsceneStudio.project;q.clips=q.clips.filter(c=>c.type!=='move');return q;});await p.locator('#file').setInputFiles({name:'unbound.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await p.locator('#confirm-replace').click();
const seek=t=>p.evaluate(t=>cutsceneStudio.seek(t),t),data=()=>p.evaluate(()=>cutsceneStudio.project),state=async()=> (await data()).clips.find(c=>c.type==='state'&&c.actor==='luna');
const set=async(field,value)=>{const el=p.locator('[data-field="'+field+'"]');await el.fill(String(value));await el.dispatchEvent('change');};
await p.locator('[data-timeline-view=keys]').click();assert.ok(await p.locator('.key-group').count());assert.equal(await p.locator('.key-empty').count(),0);
await seek(2);await p.locator('[data-scene-object=luna]').click();await p.locator('[data-property-watch=position]').click();
await seek(4);await set('scene.x',-1);await set('scene.y',2);await seek(6);await set('scene.x',1);
await p.locator('[data-property-watch=opacity]').click();await seek(8);await set('scene.opacity',.4);
let c=await state();const id=c.id,group=()=>p.locator('[data-key-group="'+id+'"]'),get=async()=> (await data()).clips.find(c=>c.id===id);
assert.equal(await group().locator('.key-property').count(),3);assert.equal(await group().locator('.property-key').count(),Object.values(c.keyframes).flat().length);
const key=c.keyframes.x.find(k=>k.t===2),marker=()=>p.locator('[data-kf-id="'+key.id+'"]');
await marker().scrollIntoViewIfNeeded();assert.match(await marker().getAttribute('title'),/60f/);await marker().click();assert.equal(await p.evaluate(()=>cutsceneStudio.time),2);assert.match(await p.locator('#key-selection').innerText(),/60f/);
const drag=async(dx,cancel=false)=>{await marker().scrollIntoViewIfNeeded();const r=await marker().boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+dx,r.y+r.height/2,{steps:8});if(cancel)await p.keyboard.press('Escape');await p.mouse.up();};
await drag(135);c=await get();assert.equal(c.keyframes.x.find(k=>k.id===key.id).t,5);assert.equal(c.start,0);assert.equal(c.keyframes.x.length,4);assert.deepEqual(c.keyframes.x.map(k=>k.t),[0,4,5,6]);
await p.keyboard.press('ArrowRight');assert.ok(Math.abs((await get()).keyframes.x.find(k=>k.id===key.id).t-(5+1/30))<1e-8);
await p.locator('#undo').click();assert.equal((await get()).keyframes.x.find(k=>k.id===key.id).t,5);
await drag(-90,true);assert.equal((await get()).keyframes.x.find(k=>k.id===key.id).t,5);
await drag(-45);c=await get();assert.equal(c.keyframes.x.length,4);assert.ok(c.keyframes.x.some(k=>k.t===4));assert.ok(Math.abs(c.keyframes.x.find(k=>k.id===key.id).t-(4+1/30))<1e-8);await p.evaluate(()=>StudioModel.validate(cutsceneStudio.project));
await marker().click();await p.keyboard.press('Delete');assert.equal((await get()).keyframes.x.length,3);assert.ok(await get());await p.locator('#undo').click();assert.equal((await get()).keyframes.x.length,4);
await marker().click();await p.locator('#delete-timeline-key').click();assert.equal((await get()).keyframes.x.length,3);await p.locator('#undo').click();
await marker().click();await set('key.time',1);assert.equal((await get()).keyframes.x[1].id,key.id);assert.equal((await get()).keyframes.x[1].t,1);
// Sequence frame labels use absolute time, even when the clip starts later.
await set('start',1);assert.match(await marker().getAttribute('title'),/60f/);
await group().locator('[data-key-fold]').click();assert.equal(await group().locator('.key-property').count(),0);await group().locator('[data-key-fold]').click();assert.equal(await group().locator('.key-property').count(),3);
// Add an intermediate key directly on the property row.
const lane=group().locator('[data-key-channel=x]');await lane.scrollIntoViewIfNeeded();const r=await lane.boundingBox();await p.mouse.dblclick(r.x+3*45,r.y+r.height/2);assert.ok((await get()).keyframes.x.some(k=>Math.abs(k.t-2)<1e-8));
await p.locator('[data-timeline-view=clips]').click();assert.ok(await p.locator('[data-clip="'+id+'"]').count());await p.locator('[data-show-keyframes]').click();assert.equal(await p.locator('[data-timeline-view=keys]').getAttribute('aria-selected'),'true');
await marker().click();await p.locator('#zoom').fill('100');await p.locator('#zoom').dispatchEvent('input');await marker().scrollIntoViewIfNeeded();
await p.screenshot({path:path.join(os.tmpdir(),'cutscene-key-lanes.png'),fullPage:true});
const expected=(await get()).keyframes;await p.waitForTimeout(300);await p.reload();await p.waitForFunction(()=>cutsceneStudio.ready);assert.deepEqual((await get()).keyframes,expected);await p.locator('[data-timeline-view=keys]').click();assert.equal(await group().locator('.key-property').count(),3);
const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('#export').click()]);const json=fs.readFileSync(await dl.path());await p.locator('#file').setInputFiles({name:'lanes.json',mimeType:'application/json',buffer:json});await p.locator('#confirm-replace').click();assert.deepEqual((await get()).keyframes,expected);
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await marker().scrollIntoViewIfNeeded();await marker().click();assert.match(await p.locator('#key-selection').innerText(),/60f/);
assert.deepEqual(errors,[]);console.log('PASS property rows, live recording, frame labels, reorder/collision, one-frame nudges, delete, undo/cancel, numeric edits, folding, double-click insertion, tabs, JSON/autosave, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
require('./model.js');require('./tags.js');require('./model-v2.js');require('./keyframes.js');
const M=StudioModel,K=StudioKeyframes;
const pose=s=>({camera:s.camera,actors:Object.fromEntries(Object.entries(s.actors).map(([id,a])=>[id,{x:a.x,y:a.y,scale:a.scale,active:a.active,rotation:a.rotation,opacity:a.opacity,facing:a.facing,animation:a.animation,age:a.age}]))});
for(const type of ['encounter','cinematic','cat','lab']){
 const p=M.template(type),times=Array.from({length:Math.ceil(p.duration*30)+1},(_,i)=>i/30),before=times.map(t=>pose(M.sample(p,t)));
 const rounded=v=>JSON.parse(JSON.stringify(v,(_,value)=>typeof value==='number'?Math.round(value*1e9)/1e9:value));
 K.hydrate(p);times.forEach((t,i)=>assert.deepEqual(rounded(pose(M.sample(p,t))),rounded(before[i])));const once=JSON.stringify(p);K.hydrate(p);assert.equal(JSON.stringify(p),once);M.validate(p);
 for(const c of p.clips.filter(c=>['camera','move','visual'].includes(c.type)))assert.equal(c.keyframes.x.length,2);
}
const custom=M.template('lab'),cc=custom.clips.find(c=>c.type==='camera');cc.ease='custom';cc.easeCurve=[.2,.8,.7,.1];const before=K.value(cc,'x',1.4);K.add(cc,'y',1).value=3;const existing=JSON.stringify(cc.keyframes.y);K.hydrate(custom);assert.equal(K.value(cc,'x',1.4),before);assert.equal(JSON.stringify(cc.keyframes.y),existing);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8123/cutscene-studio/');await page.waitForFunction(()=>cutsceneStudio.ready);
 // Load an old saved project that contains no explicit movement keyframes.
 const old=M.template('lab');await page.locator('#file').setInputFiles({name:'legacy-lab.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await page.locator('#confirm-replace').click();
 await page.locator('[data-timeline-view=keys]').click();const hound=old.clips.find(c=>c.assetId==='lab-hound-idle'),id=hound.id,get=()=>page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id),id);
 const group=page.locator('[data-key-group="'+id+'"]');assert.equal(await group.locator('.key-property').count(),2);assert.equal(await group.locator('.property-key').count(),4);assert.equal(await page.locator('#record-scene').getAttribute('aria-pressed'),'false');
 const keys=(await get()).keyframes.x,last=keys.at(-1),marker=()=>page.locator('[data-kf-id="'+last.id+'"]');await marker().scrollIntoViewIfNeeded();assert.match(await marker().getAttribute('title'),/840f/);await marker().click();assert.equal(await page.locator('[data-field="key.value"]').inputValue(),'-1.3');
 const box=await marker().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-90,box.y+box.height/2,{steps:6});await page.mouse.up();assert.equal((await get()).keyframes.x.at(-1).t,4);await page.evaluate(()=>cutsceneStudio.seek(25));assert.ok(Math.abs(await page.evaluate(()=>cutsceneStudio.sample().actors.hound.x)-(-1.575))<1e-8);
 await page.locator('#undo').click();assert.equal((await get()).keyframes.x.at(-1).t,6);await page.evaluate(()=>cutsceneStudio.seek(25));assert.ok(Math.abs(await page.evaluate(()=>cutsceneStudio.sample().actors.hound.x)-(-1.85))<1e-8);
 await marker().click();await page.keyboard.press('Delete');assert.equal((await get()).keyframes.x.length,1);await page.evaluate(()=>cutsceneStudio.seek(25));assert.equal(await page.evaluate(()=>cutsceneStudio.sample().actors.hound.x),-2.4);
 const first=page.locator('[data-kf-id="'+keys[0].id+'"]');await first.click();await page.keyboard.press('Delete');assert.equal((await get()).keyframes.x,undefined);await page.locator('[data-timeline-view=clips]').click();await page.locator('[data-timeline-view=keys]').click();assert.equal((await get()).keyframes.x,undefined);await page.evaluate(()=>cutsceneStudio.seek(25));assert.equal(await page.evaluate(()=>cutsceneStudio.sample().actors.hound.x),-2.4);
 // New endpoint edits re-create the visible keys after all keys were intentionally removed.
 await page.evaluate(id=>cutsceneStudio.select(id),id);await page.locator('[data-field="to.x"]').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal((await get()).keyframes.x.length,2);assert.equal((await get()).keyframes.x.at(-1).value,0);
 await page.locator('#undo').click();await page.locator('#undo').click();await page.locator('#undo').click();assert.deepEqual((await get()).keyframes.x,keys);
 await marker().click();await page.screenshot({path:path.join(os.tmpdir(),'cutscene-legacy-hound-keys.png'),fullPage:true});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);const json=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(json.clips.find(c=>c.id===id).transformKeysInitialized,true);await page.waitForTimeout(300);await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);assert.deepEqual((await get()).keyframes.x,keys);
 assert.deepEqual(errors,[]);console.log('PASS old templates preserve every frame, custom easing and existing keys; Hound visible without recording, drag changes scene, delete/freeze, undo, endpoint sync, JSON/autosave');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

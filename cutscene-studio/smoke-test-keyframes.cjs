const assert=require('node:assert/strict'),fs=require('node:fs');
require('./model.js');require('./tags.js');require('./model-v2.js');require('./keyframes.js');
const M=StudioModel,K=StudioKeyframes,p=M.template(),c=p.clips.find(c=>c.type==='camera');p.clips=[c];c.start=0;c.duration=5;c.ease='linear';c.from.x=0;c.to.x=10;
const mid=K.add(c,'x',2);mid.value=0;
assert.equal(K.value(c,'x',1),0);assert.equal(K.value(c,'x',2),0);assert.equal(K.value(c,'x',3.5),5);assert.equal(M.sample(p,5).camera.x,10);
mid.ease='hold';assert.equal(K.value(c,'x',4.999),0);assert.equal(K.value(c,'x',5),10);
mid.ease='custom';mid.easeCurve=[0,1,0,1];assert.ok(K.value(c,'x',3.5)>9.8);assert.deepEqual(M.validate(p).clips[0].keyframes,c.keyframes);
const invalid=M.copy(p);invalid.clips[0].keyframes.x[1].t=0;assert.throws(()=>M.validate(invalid));
const invalidChannel=M.copy(p);invalidChannel.clips[0].keyframes.foo=invalidChannel.clips[0].keyframes.x;assert.throws(()=>M.validate(invalidChannel));
c.duration=10;K.resize(c,5);assert.equal(mid.t,4);assert.equal(c.keyframes.x.at(-1).t,10);K.endpoint(c,'to','x',7);assert.equal(K.value(c,'x',10),7);
const audio=M.clip('audio',0,{duration:10,assetId:'lab-radio',volume:1,fadeIn:2,fadeOut:2});K.add(audio,'volume',5).value=.5;assert.equal(K.audioGain(audio,0),0);assert.equal(K.audioGain(audio,5),.5);assert.equal(K.audioGain(audio,10),0);audio.duration=5;K.resize(audio,10);assert.equal(audio.fadeIn,1);
for(const [type,ch,v] of [['move','y',3],['visual','rotation',90],['fx','strength',.2]]){const proj=M.template(),cl=M.clip(type,0,{actor:'luna',assetId:'asset-test',track:'test',duration:5});proj.tracks.push({id:'test',type,name:'test',height:48,muted:false});proj.clips=[cl];K.add(cl,ch,2).value=v;const s=M.sample(proj,2);assert.equal(type==='fx'?s.fx[0][ch]:s.actors.luna[ch],v);M.validate(proj);}
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
console.log('PASS model keyframes; starting browser');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8123/cutscene-studio/');await page.waitForFunction(()=>cutsceneStudio.ready);
 const clip=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='camera'));const data=()=>page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id),clip.id);
 await page.evaluate(id=>cutsceneStudio.select(id),clip.id);
 const set=async(path,value)=>{await page.locator('[data-field="'+path+'"]').fill(String(value));await page.locator('[data-field="'+path+'"]').dispatchEvent('change');};
 await set('duration',5);await set('from.x',0);await set('to.x',10);await page.locator('[data-field=ease]').selectOption('linear');
 await page.evaluate(start=>cutsceneStudio.seek(start+2),clip.start);await page.locator('#add-keyframe').click();await set('key.value',0);
 console.log('keys inserted');assert.equal((await data()).keyframes.x.length,3);assert.equal(await page.locator('[data-field=ease]').count(),1);assert.equal(await page.locator('[data-field=ease]').inputValue(),'inherit');
 await page.evaluate(start=>cutsceneStudio.seek(start+3.5),clip.start);assert.equal(await page.evaluate(()=>cutsceneStudio.sample().camera.x),5);
 await page.locator('[data-field=ease]').selectOption('hold');assert.equal(await page.locator('.editable-curve').count(),0);assert.equal(await page.evaluate(()=>cutsceneStudio.sample().camera.x),0);
 await page.locator('[data-field=ease]').selectOption('custom');await page.locator('[data-curve-handle="0"]').focus();await page.keyboard.press('ArrowUp');assert.equal((await data()).keyframes.x[1].ease,'custom');assert.equal((await data()).ease,'linear');
 console.log('curve works');const key=(await data()).keyframes.x[1],marker=page.locator('[data-kf-id="'+key.id+'"]');await marker.scrollIntoViewIfNeeded();let box=await marker.boundingBox();const before=await data();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:5});await page.mouse.up();assert.ok((await data()).keyframes.x[1].t>key.t+.9);assert.equal((await data()).start,before.start);await page.locator('#undo').click();assert.deepEqual((await data()).keyframes,before.keyframes);
 console.log('key drag works');await set('duration',10);assert.equal((await data()).keyframes.x[1].t,4);assert.equal((await data()).keyframes.x[2].t,10);await set('to.x',9);assert.equal((await data()).keyframes.x.at(-1).value,9);
 // Arrow-key edits remain focused; Delete removes a key, not the parent clip.
 await page.locator('[data-key-select="'+key.id+'"]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');assert.ok((await data()).keyframes.x[1].t>4.19);
 await page.keyboard.press('Delete');assert.equal((await data()).keyframes.x.length,2);await page.locator('#undo').click();assert.equal((await data()).keyframes.x.length,3);
 // A clip edge resize retimes keys from the original snapshot, not cumulatively per pointer event.
 const edge=page.locator('[data-clip="'+clip.id+'"] [data-edge=right]');await edge.scrollIntoViewIfNeeded();const eb=await edge.boundingBox(),oldClip=await data();await page.mouse.move(eb.x+eb.width/2,eb.y+eb.height/2);await page.mouse.down();await page.mouse.move(eb.x+eb.width/2+45,eb.y+eb.height/2,{steps:6});await page.mouse.up();const resized=await data();assert.equal(resized.duration,11);assert.ok(Math.abs(resized.keyframes.x[1].t-oldClip.keyframes.x[1].t*1.1)<1e-8);await page.locator('#undo').click();
 // Key value supports the same numeric scrubbing as every other inspector field.
 await page.locator('[data-key-select="'+key.id+'"]').click();await set('key.value',2);assert.equal((await data()).keyframes.x[1].value,2);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);const json=fs.readFileSync(await download.path());const expected=(await data()).keyframes;await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);assert.deepEqual((await data()).keyframes,expected);
 await page.locator('#file').setInputFiles({name:'keys.json',mimeType:'application/json',buffer:json});await page.locator('#confirm-replace').click();assert.deepEqual((await data()).keyframes,expected);
 console.log('persistence works');await page.locator('.template-fold summary').click();await page.locator('[data-template=lab]').click();await page.locator('#confirm-replace').click();const sound=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='audio'));await page.evaluate(id=>cutsceneStudio.select(id),sound.id);
 const soundData=()=>page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id),sound.id),fade=page.locator('[data-clip="'+sound.id+'"] [data-audio-fade=fadeIn]');await fade.scrollIntoViewIfNeeded();box=await fade.boundingBox();await page.mouse.move(box.x+5,box.y+3);await page.mouse.down();await page.mouse.move(box.x+95,box.y+3,{steps:6});await page.mouse.up();assert.ok((await soundData()).fadeIn>=2);assert.equal((await soundData()).start,sound.start);await page.locator('#undo').click();assert.equal((await soundData()).fadeIn,sound.fadeIn);
 await fade.scrollIntoViewIfNeeded();box=await fade.boundingBox();await page.mouse.move(box.x+5,box.y+3);await page.mouse.down();await page.mouse.move(box.x+50,box.y+3,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.equal((await soundData()).fadeIn,sound.fadeIn);
 await page.evaluate(s=>cutsceneStudio.seek(s.start+5),sound);await page.locator('#add-keyframe').click();await set('key.value',.15);assert.equal(await page.locator('[data-field=volume]').isDisabled(),true);assert.equal((await soundData()).keyframes.volume[1].value,.15);
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-keyframes.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: segment/hold/custom curves, transform/effect/audio sampling, validation, timeline key dragging, fade handles, undo/cancel, duration retiming, endpoint sync, JSON/autosave, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

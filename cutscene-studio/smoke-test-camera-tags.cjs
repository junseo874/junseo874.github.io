const assert=require('node:assert/strict');
require('./tags.js');require('./camera-impulses.js');
const parse=StudioTags.parse;
const parsed=parse('A[camshake]B[T:0.5][camshake:2,0.6]C');
assert.equal(parsed.text,'ABC');assert.equal(parsed.triggers.length,2);assert.deepEqual(parsed.triggers[1],{type:'camshake',index:2,delay:.5,strength:2,duration:.6});
for(const t of ['[camshake:0,1]','[camshake:1,-1]','[camshake:NaN]','[camshake:1,2,3]','[/camshake]','[camshake:,1]'])assert.equal(parse(t).text,t);
const clip={id:'line',track:'dialogue',type:'dialogue',text:'A[camshake]B[T:0.5][camshake:2,0.6]C',start:0,duration:1,cps:10,textEffect:'typewriter'},project={clips:[clip],tracks:[{id:'dialogue',muted:false}]};
const engine=StudioCameraImpulses.create();engine.reset(project,0);engine.step(project,.09,null,0,.09,true);assert.equal(engine.sample().fired,0);engine.step(project,.1,null,0,.01,true);assert.equal(engine.sample().fired,1);assert.ok(Math.abs(engine.sample().x)>20);
engine.step(project,.6,null,0,.5,true);assert.equal(engine.sample().fired,1);assert.equal(engine.sample().active,0);engine.step(project,.7,null,0,.1,true);assert.equal(engine.sample().fired,2);
const frozen=engine.sample();engine.step(project,.7,null,0,1,false);assert.deepEqual(engine.sample(),frozen);engine.reveal(clip);assert.equal(engine.sample().fired,2);
engine.step(project,1,'line',4,4,true);assert.equal(engine.sample().active,0);assert.equal(engine.sample().x,0);
engine.reset(project,.8);engine.step(project,.9,null,0,.1,true);assert.equal(engine.sample().active,0);engine.reset(project,0);engine.step(project,.1,null,0,.1,true);assert.equal(engine.sample().active,1);
const held={...clip,text:'AB[T:1][camshake]C',duration:.15};project.clips=[held];engine.reset(project,0);engine.step(project,.14999,'line',.7,.7,true);assert.equal(engine.sample().fired,0);engine.step(project,.14999,'line',1.1,.4,true);assert.equal(engine.sample().fired,1);
engine.reset(project,0);engine.reveal(held);engine.reveal(held);assert.equal(engine.sample().fired,1);
project.tracks[0].muted=true;engine.reset(project,0);engine.step(project,.14999,'line',3,3,true);assert.equal(engine.sample().active,0);project.tracks[0].muted=false;
project.clips=[{...clip,text:'[camshake:3,0.1]A[camshake:3,0.1]B',textEffect:'instant'}];engine.reset(project,0);engine.step(project,.01,null,0,.01,true);assert.equal(engine.sample().fired,2);assert.ok(Math.abs(engine.sample().x)<=84);

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});try{
 const p=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.STUDIO_URL||'http://127.0.0.1:8123/cutscene-studio/');await p.waitForFunction(()=>cutsceneStudio.ready);
 const id=await p.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='dialogue').id);await p.evaluate(id=>cutsceneStudio.select(id),id);
 await p.locator('[data-field=text]').fill('잠깐! 멈춰!');await p.locator('[data-field=text]').press('Tab');await p.locator('[data-field=text]').evaluate(el=>{el.focus();el.setSelectionRange(4,7);});
 await p.locator('#tag-impact-strength').fill('2');await p.locator('#tag-impact-duration').fill('0.6');await p.locator('[data-tag=camshake]').click();
 assert.equal(await p.locator('[data-field=text]').inputValue(),'잠깐! [camshake:2,0.6]멈춰!');
 await p.locator('#undo').click();assert.equal(await p.locator('[data-field=text]').inputValue(),'잠깐! 멈춰!');await p.locator('#redo').click();
 await p.locator('[data-field=text]').fill('가[T:0.3][camshake:2,0.6]멈춰!');await p.locator('[data-field=text]').press('Tab');await p.locator('[data-field=cps]').fill('10');await p.locator('[data-field=cps]').press('Tab');
 await p.evaluate(()=>cutsceneStudio.seek(5));await p.locator('#play').click();await p.waitForFunction(()=>cutsceneStudio.cameraImpulse.active===1);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.fired),1);
 await p.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-camera-trigger.png'),fullPage:true});
 await p.waitForFunction(()=>cutsceneStudio.cameraImpulse.active===0);await p.waitForFunction(()=>!!cutsceneStudio.waiting);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.fired),1);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.x),0);
 // Replaying re-arms the point trigger, scrubbing past it does not fire it.
 await p.evaluate(()=>cutsceneStudio.seek(6));await p.locator('#play').click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.active),0);
 await p.evaluate(()=>cutsceneStudio.seek(5));await p.locator('#play').click();await p.waitForFunction(()=>cutsceneStudio.cameraImpulse.active===1);
 // E reveals outstanding text and emits the outstanding trigger only once.
 await p.evaluate(()=>cutsceneStudio.seek(5));await p.locator('[data-field=text]').fill('가[T:10][camshake:1,0.3]끝');await p.locator('[data-field=text]').press('Tab');await p.evaluate(()=>cutsceneStudio.seek(5));await p.locator('#play').click();await p.keyboard.press('e');await p.waitForFunction(()=>cutsceneStudio.cameraImpulse.fired===1);await p.keyboard.press('e');await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.fired),1);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.active),0);
 // A trigger in the final frame still fires and settles after sequence playback ends.
 await p.evaluate(()=>cutsceneStudio.seek(5));await p.locator('[data-field=text]').fill('가[T:2.89][camshake:1,0.3]끝');await p.locator('[data-field=text]').press('Tab');await p.locator('#project-duration').fill('8');await p.locator('#project-duration').press('Tab');await p.locator('#gates').uncheck();await p.evaluate(()=>cutsceneStudio.seek(7.9));await p.locator('#play').click();await p.waitForFunction(()=>cutsceneStudio.time===8);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.fired),1);await p.waitForFunction(()=>cutsceneStudio.cameraImpulse.active===0);assert.equal(await p.evaluate(()=>cutsceneStudio.cameraImpulse.x),0);
 await p.evaluate(()=>cutsceneStudio.seek(5));await p.reload();await p.waitForFunction(()=>cutsceneStudio.ready);assert.ok(await p.evaluate(()=>cutsceneStudio.project.clips.some(c=>c.text?.includes('[camshake:1,0.3]'))));
 assert.deepEqual(errors,[]);console.log('PASS: point parser, pause ordering, one-shot, decay, bounded stacking, seek/replay, muted track, instant/E reveal, waiting, toolbar selection preservation, undo/redo, persistence, browser rendering');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

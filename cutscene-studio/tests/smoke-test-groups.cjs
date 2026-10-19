const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{
 const p=await b.newPage({viewport:{width:1600,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 await p.goto('http://127.0.0.1:8123/cutscene-studio/');await p.waitForFunction(()=>cutsceneStudio.ready);
 const data=await p.evaluate(()=>{const q=StudioModel.template('lab');StudioKeyframes.hydrate(q);return q;});
 await p.locator('#file').setInputFiles({name:'groups.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.locator('#confirm-replace').click();
 assert.equal(await p.locator('.timeline-group').count(),6);
 const actors=p.locator('[data-timeline-group=actors]');assert.equal(await actors.locator('.timeline-target').count(),3);
 assert.equal(await p.locator('[data-clip]').count(),data.clips.length);
 const initial=await p.evaluate(()=>JSON.stringify(cutsceneStudio.project)),sample=await p.evaluate(()=>JSON.stringify(StudioModel.sample(cutsceneStudio.project,30)));
 await p.locator('[data-group-fold=actors]').click();assert.equal(await actors.locator('[data-clip]').count(),0);assert.equal(await actors.locator('.summary-range').count(),data.clips.filter(c=>c.type==='visual').length);
 assert.equal(await p.evaluate(()=>JSON.stringify(cutsceneStudio.project)),initial);assert.equal(await p.evaluate(()=>JSON.stringify(StudioModel.sample(cutsceneStudio.project,30))),sample);
 await p.locator('#timeline-collapse-all').click();assert.equal(await p.locator('[data-clip]').count(),0);await p.locator('#timeline-expand-all').click();assert.equal(await p.locator('[data-clip]').count(),data.clips.length);
 const hound=p.locator('[data-timeline-target="target:actors:actor:hound"]');await hound.locator('[data-target-properties]').click();assert.ok(await hound.locator('.key-property').count()>0);await hound.locator('[data-target-properties]').click();
 await p.locator('[data-timeline-view=keys]').click();assert.equal(await p.locator('.timeline-group').count(),6);assert.ok(await hound.locator('.key-property').count()>0);
 const before=await hound.locator('.key-property').count();await p.locator('#timeline-all-properties').check();assert.ok(await hound.locator('.key-property').count()>before);await p.locator('#timeline-all-properties').uncheck();assert.equal(await hound.locator('.key-property').count(),before);
 const c=data.clips.find(c=>c.actor==='hound'&&c.type==='visual'),keyrow=p.locator('[data-key-group="'+c.id+'"]');await p.locator('[data-group-fold=actors]').click();await p.evaluate(id=>cutsceneStudio.select(id),c.id);await p.locator('[data-show-keyframes]').click();assert.ok(await keyrow.isVisible());assert.equal(await p.locator('[data-group-fold=actors]').getAttribute('aria-expanded'),'true');
 // Empty channels can receive keys without creating another clip.
 await p.locator('#timeline-all-properties').check();const lane=keyrow.locator('[data-key-channel=opacity]');await lane.scrollIntoViewIfNeeded();const r=await lane.boundingBox();await p.mouse.dblclick(r.x+(c.start+.5)*45,r.y+r.height/2);assert.equal(await p.evaluate(()=>cutsceneStudio.project.clips.length),data.clips.length);assert.ok(await p.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).keyframes.opacity.length,c.id));
 await p.locator('#timeline-all-properties').uncheck();await p.locator('[data-timeline-view=clips]').click();
 await p.locator('#timeline-collapse-all').click();await p.locator('[data-group-fold=actors]').click();await p.locator('[data-group-fold=camera]').click();await p.locator('#timeline-scroll').evaluate(el=>el.scrollTop=0);
 await p.screenshot({path:'/private/tmp/cutscene-groups.nJhlzT/timeline-groups.png',fullPage:true});
 // One underlying visual track can contain different kinds without losing or duplicating clips.
 const mixed=await p.evaluate(()=>{const q=cutsceneStudio.project;for(const kind of ['object','effect']){const id='test-'+kind;StudioMedia.assets.set(id,{...StudioMedia.assets.get('lab-hound-idle'),id,kind,builtin:true});q.actors[id]={name:kind,x:0,y:0,facing:'left',asset:true};q.visibleActors.push(id);q.clips.push(StudioModel.clip('visual',0,{actor:id,assetId:id,track:'hound',title:kind}));}return q;});
 await p.locator('#file').setInputFiles({name:'mixed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mixed))});await p.locator('#confirm-replace').click();await p.locator('#timeline-expand-all').click();
 assert.equal(await p.locator('[data-clip]').count(),mixed.clips.length);assert.equal(await p.locator('[data-timeline-group=environment] [data-clip]').count(),1);assert.equal(await p.locator('[data-timeline-group=fx] [data-timeline-target="target:fx:actor:test-effect"] [data-clip]').count(),1);
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS category/actor grouping, summary ranges, presentation-only folds, both modes, full properties, reveal, insertion, mobile');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});

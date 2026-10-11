const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const seed=sessionStorage.getItem('preview-seed');if(seed){localStorage.setItem('unknown-cutscene-studio-v1',seed);sessionStorage.removeItem('preview-seed');}});
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8123/cutscene-studio/');await page.waitForFunction(()=>cutsceneStudio.ready);
 assert.equal(await page.locator('.clip-preview').count(),await page.locator('.clip').count());
 for(const kind of ['camera','dialogue','fx'])assert.ok(await page.locator(`[data-preview-kind="${kind}"] svg`).count());
 assert.equal(await page.locator('.clip-preview.has-image').count(),2);
 const original=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='move'));
 const thumb=page.locator(`[data-clip="${original.id}"] .clip-preview`),box=await thumb.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:5});await page.mouse.up();
 assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).start,original.id),Math.round((original.start+1)*4)/4);
 await page.locator('#undo').click();
 await page.waitForTimeout(300);
 // Red first frame / green second frame makes accidental whole-sheet previews detectable.
 await page.evaluate(async()=>{
  const cv=document.createElement('canvas');cv.width=128;cv.height=64;const g=cv.getContext('2d');g.fillStyle='#ff0000';g.fillRect(16,16,32,32);g.fillStyle='#00ff00';g.fillRect(64,0,64,64);
  const a={id:'asset-preview-test',name:'테스트 시트',kind:'animation',src:cv.toDataURL(),width:128,height:64,fw:64,fh:64,cols:2,count:2,fps:10,ppu:100};await StudioMedia.put(a);
  const p=StudioModel.template('lab');p.assets.push(a.id);p.tracks.push({id:'preview-test',type:'visual',name:'이미지',height:64,muted:false});
  p.actors.preview={name:'미리보기',x:0,y:0,facing:'left',asset:true};
  p.clips.push({...StudioModel.clip('visual',0),id:'preview-test',track:'preview-test',actor:'preview',assetId:a.id,duration:3});
  StudioModel.validate(p);
  sessionStorage.setItem('preview-seed',JSON.stringify(p));
 });
 await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);
 assert.ok(await page.locator('[data-preview-kind="audio"] svg').count());
 const check=await page.locator('[data-clip="preview-test"] canvas').evaluate(cv=>{const d=cv.getContext('2d').getImageData(0,0,96,96).data;let red=0,green=0;for(let i=0;i<d.length;i+=4){if(d[i]>200&&d[i+1]<20&&d[i+3]>200)red++;if(d[i+1]>200&&d[i]<20&&d[i+3]>200)green++;}return {red,green};});
 assert.ok(check.red>6000,JSON.stringify(check));assert.equal(check.green,0);
 assert.equal(await page.locator('.clip-preview.has-image').count(),await page.evaluate(()=>cutsceneStudio.project.clips.filter(c=>c.type==='visual').length));
 assert.ok(await page.locator('.clip-tiny').count());
 const tiny=page.locator('.clip-tiny').first();assert.equal(await tiny.locator('.clip-copy').isVisible(),false);
 await page.evaluate(()=>{sessionStorage.setItem('preview-seed',JSON.stringify(StudioModel.template('lab')));});await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);
 await page.locator('#fit').click();await page.evaluate(()=>cutsceneStudio.seek(26));
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-studio-previews.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: all clip icons, native/lab thumbnails, first-frame crop, transparent padding, cold reload, narrow clips, drag from thumbnail, undo, no page errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

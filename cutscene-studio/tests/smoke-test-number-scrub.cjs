const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8123/cutscene-studio/');await page.waitForFunction(()=>cutsceneStudio.ready);
 const camera=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='camera'));await page.evaluate(id=>cutsceneStudio.select(id),camera.id);
 const input=path=>page.locator(`[data-field="${path}"]`),handle=path=>page.locator(`[data-number-scrub="field:${path}"]`);
 const value=()=>page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).from.x,camera.id);
 const begin=async(locator,dx)=>{await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:8});};
 await input('from.x').fill('-2');await input('from.x').press('Enter');assert.equal(await value(),-2);
 await begin(handle('from.x'),60);assert.equal(await value(),-1.4);assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('numeric-scrubbing')));await page.mouse.up();
 await page.locator('#undo').click();assert.equal(await value(),-2);await page.locator('#redo').click();assert.equal(await value(),-1.4);
 // Esc restores the whole drag and preserves the previous redo stack.
 await page.locator('#undo').click();const before=await page.evaluate(()=>cutsceneStudio.project);await begin(handle('from.x'),100);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await page.evaluate(()=>cutsceneStudio.project),before);assert.equal(await page.locator('#redo').isDisabled(),false);await page.locator('#redo').click();assert.equal(await value(),-1.4);
 await page.keyboard.down('Shift');await begin(handle('from.x'),60);await page.mouse.up();await page.keyboard.up('Shift');assert.equal(await value(),-1.34);await page.locator('#undo').click();assert.equal(await value(),-1.4);
 // An unfocused numeric value can itself be dragged; ordinary click and typing remain available.
 await page.locator('#clip-type').click();await begin(input('from.x'),60);await page.mouse.up();assert.equal(await value(),-.8);
 await input('from.x').fill('0');await input('from.x').press('Enter');assert.equal(await value(),0);
 await input('from.x').fill('');await input('from.x').press('Enter');assert.equal(await value(),0);assert.equal(await input('from.x').inputValue(),'0');
 await begin(handle('from.x'),50);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.equal(await value(),0);
 // Timing fields update their timeline width while held and are one undo operation.
 const prior=await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).duration,camera.id);
 const clip=page.locator(`[data-clip="${camera.id}"]`),width=(await clip.boundingBox()).width;
 await begin(handle('duration'),50);assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).duration,camera.id),prior+1);assert.ok((await clip.boundingBox()).width>width);await page.mouse.up();await page.locator('#undo').click();assert.equal(await page.evaluate(id=>cutsceneStudio.project.clips.find(c=>c.id===id).duration,camera.id),prior);
 // Normalised values clamp at bounds and immediately recover when dragging back.
 await page.evaluate(()=>cutsceneStudio.add('fx',0));await input('strength').fill('0.9');await input('strength').press('Enter');await begin(handle('strength'),100);assert.equal(await input('strength').inputValue(),'1');await page.mouse.move((await handle('strength').boundingBox()).x+20,(await handle('strength').boundingBox()).y+6);assert.ok(Number(await input('strength').inputValue())<1);await page.mouse.up();
 // Rotation/layer zero previously fell through to their negative minimum.
 await page.locator('[data-asset="lab-sol-idle"]').click();await input('rotation').fill('0');await input('rotation').press('Enter');await input('layer').fill('0');await input('layer').press('Enter');assert.equal(await page.evaluate(()=>cutsceneStudio.project.clips.at(-1).rotation),0);assert.equal(await page.evaluate(()=>cutsceneStudio.project.clips.at(-1).layer),0);
 // Tag parameters also scrub without modifying dialogue until the tag is inserted.
 const line=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='dialogue'));await page.evaluate(id=>cutsceneStudio.select(id),line.id);const text=await input('text').inputValue();await begin(page.locator('[data-number-scrub="id:tag-impact-strength"]'),100);await page.mouse.up();assert.equal(await page.locator('#tag-impact-strength').inputValue(),'1.5');assert.equal(await input('text').inputValue(),text);
 await page.locator('[data-tag=camshake]').click();assert.match(await input('text').inputValue(),/\[camshake:1.5,0.4\]/);
 await page.evaluate(id=>cutsceneStudio.select(id),camera.id);await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-number-scrub.png'),fullPage:true});
 await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);assert.equal(await value(),0);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: typing/Enter, label/value scrubbing, live preview/timeline, one-step undo/redo, Shift precision, Escape/blur rollback, clamp recovery, zero/empty, tag parameters, autosave, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

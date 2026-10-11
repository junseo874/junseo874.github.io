const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
require('./tags.js');require('./model.js');require('./model-v2.js');
const nested=StudioTags.parse('A[size:150%][c:#ff5566]B[size:75%]C[/size]D[/c][/size]E');
assert.equal(nested.text,'ABCDE');assert.deepEqual(nested.chars.map(c=>c.size),[1,1.5,.75,1.5,1]);assert.equal(nested.chars[2].color,'#ff5566');
for(const src of ['[size:0%]x[/size]','[size:999%]x[/size]','[size:bad]x[/size]','[size:NaN%]x[/size]'])assert.equal(StudioTags.parse(src).text,src);
const p=StudioModel.template();for(const c of p.clips)if(c.type==='dialogue'){delete c.fontFamily;delete c.fontScale;}
assert.equal(StudioModel.validate(p).clips.find(c=>c.type==='dialogue').fontScale,100);
const bad=StudioModel.template();bad.clips.find(c=>c.type==='dialogue').fontScale=500;assert.throws(()=>StudioModel.validate(bad));
assert.equal(StudioModel.clip('dialogue',0).fontFamily,'system');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8123/cutscene-studio/');await page.waitForFunction(()=>cutsceneStudio.ready);
 assert.equal(await page.evaluate(()=>document.fonts.check('16px StudioGame')),true);
 const id=await page.evaluate(()=>cutsceneStudio.project.clips.find(c=>c.type==='dialogue').id);await page.evaluate(id=>cutsceneStudio.select(id),id);
 await page.locator('[data-field=fontFamily]').selectOption('game');await page.locator('[data-field=fontScale]').fill('120');await page.locator('[data-field=fontScale]').press('Tab');
 await page.locator('[data-field=text]').fill('잠깐! 여기로 와.');await page.locator('[data-field=text]').press('Tab');
 await page.locator('[data-field=text]').evaluate(el=>{el.focus();el.setSelectionRange(0,3);});
 await page.locator('#tag-size').fill('180');await page.locator('[data-tag=size]').click();
 assert.equal(await page.locator('[data-field=text]').inputValue(),'[size:180%]잠깐![/size] 여기로 와.');
 await page.locator('#undo').click();assert.equal(await page.locator('[data-field=text]').inputValue(),'잠깐! 여기로 와.');await page.locator('#redo').click();
 // Mix font sizes, styles and line breaks; layout is computed from full text, not the reveal count.
 const checks=await page.evaluate(()=>{
  const ctx=document.createElement('canvas').getContext('2d'),c={text:'작은 말 [size:200%][c:#ff5566]큰 소리[/c][/size][br]다음 문장 [size:75%]속삭임[/size]',fontScale:120,fontFamily:'game'};
  const a=StudioTypography.layout(ctx,c,2.28*100,100),b=StudioTypography.layout(ctx,c,2.28*50,50);
  const linesSafe=a.rows.every(row=>row.width<=228+.01);
  const noOverlap=a.glyphs.every(ch=>ch.y>=0&&ch.y<=a.height);
  return {linesSafe,noOverlap,rows:a.rows.length,ratio:a.height/b.height,sizes:[...new Set(a.glyphs.map(ch=>Math.round(ch.fontSize*100)/100))]};
 });
 assert.ok(checks.linesSafe&&checks.noOverlap);assert.ok(checks.rows>=2);assert.ok(Math.abs(checks.ratio-2)<.05,JSON.stringify(checks));assert.equal(checks.sizes.length,3);
 const scene=await page.evaluate(()=>cutsceneStudio.project);assert.equal(scene.clips.find(c=>c.id===id).fontFamily,'game');assert.equal(scene.clips.find(c=>c.id===id).fontScale,120);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);const json=fs.readFileSync(await download.path());assert.equal(JSON.parse(json).clips.find(c=>c.id===id).fontScale,120);
 await page.reload();await page.waitForFunction(()=>cutsceneStudio.ready);await page.evaluate(id=>cutsceneStudio.select(id),id);assert.equal(await page.locator('[data-field=fontFamily]').inputValue(),'game');assert.equal(await page.locator('[data-field=fontScale]').inputValue(),'120');
 await page.locator('#file').setInputFiles({name:'typography.json',mimeType:'application/json',buffer:json});await page.locator('#confirm-replace').click();await page.evaluate(id=>cutsceneStudio.select(id),id);
 assert.equal(await page.locator('[data-field=text]').inputValue(),'[size:180%]잠깐![/size] 여기로 와.');
 await page.locator('[data-field=textEffect]').selectOption('instant');await page.evaluate(()=>cutsceneStudio.seek(6.5));
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cutscene-studio-typography.png'),fullPage:true});
 for(const font of ['system','serif','mono','game'])await page.locator('[data-field=fontFamily]').selectOption(font);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: size tags/nesting/invalid syntax, legacy defaults, font validation, selection toolbar, undo/redo, mixed-size wrapping, zoom scaling, game font, autosave and JSON roundtrip, all font presets, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

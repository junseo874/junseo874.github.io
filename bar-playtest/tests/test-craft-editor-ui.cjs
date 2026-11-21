/* Exercise both delivery paths with a real browser, writing only a temporary CSV tree. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs'),S=require('../../tools/dialogue-editor-storage.cjs'),{Book}=require('../src/dev/dialogue-editor/recipe-book.js'),{generate}=require('../../tools/build-shared-data.cjs');
(async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-craft-ui-')),opts={base:path.join(tmp,'csv'),runtime:path.join(tmp,'runtime'),backupRoot:path.join(tmp,'backups')};
 await require('./helpers/copy-editor-source.cjs')(opts.base);await fs.cp(path.join(__dirname,'../data/runtime'),opts.runtime,{recursive:true});
 const original=await S.snapshot(opts.base),browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/dialogue-editor',async r=>{try{await r.fulfill({json:r.request().method()==='POST'?await S.save(r.request().postDataJSON(),opts):{...await S.snapshot(opts.base),token:'test',mode:'local-csv'}});}catch(e){await r.fulfill({status:409,json:{error:e.message}});}});
  await p.goto((process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/recipe-editor.html');await p.click('[data-id=johnny_old_fashioned]');for(const id of ['wild_dog','bitters','sugar_cube']){const expected=original.presentation.assets['item_'+id].src;assert.equal(await p.locator('[data-pick='+id+'] image').getAttribute('href'),expected);assert.equal(await p.locator('.recipe-icon-slot img').evaluateAll((els,s)=>els.filter(e=>e.getAttribute('src')===s).length,expected),1);}await p.click('[data-id=gin_tonic]');await p.fill('[data-field="name.ko"]','검수용 칵테일');await p.fill('[data-field="recipe_desc.ko"]','잘 섞어 주세요.');await p.selectOption('[data-field=mix]','shake');
  await p.click('[data-pick=soda_water]');await p.click('[data-pick=milk]');await p.fill('[data-step="1"] [data-line=qty]','22.5');await p.click('[data-step="1"] [data-shift="-1"]');
  assert.equal(await p.locator('.recipe-lines li').first().innerText().then(s=>s.includes('22.5')),true);assert.match(await p.locator('.prep-recipe').innerText(),/잘 섞어 주세요/);
  await p.click('[data-peek=hover]');assert.match(await p.locator('.recipe-peek').innerText(),/검수용 칵테일/);
  await p.click('[data-table=shelf_items]');await p.click('[data-id=milk]');await p.fill('[data-field="desc.ko"]','선반 설명 검수');assert.match(await p.locator('#preview').innerText(),/선반 설명 검수/);
  const download=p.waitForEvent('download');await p.click('#export');const file=await download;assert.match(file.suggestedFilename(),/^luna-craft-.*\.zip$/);const archive=path.join(tmp,'export.zip');await file.saveAs(archive);
  assert.equal((await S.snapshot(opts.base)).revision,original.revision);await p.click('#save');await p.waitForFunction(()=>document.querySelector('#state').textContent.includes('저장 완료'));
  const after=await S.snapshot(opts.base),book=new Book(after.files);assert.equal(book.row('shelf_items','milk')['desc.ko'],'선반 설명 검수');assert.equal(book.row('cocktails','gin_tonic').target_mix_method,'shake');
  assert.deepEqual(Object.keys(original.files).filter(k=>original.files[k]!==after.files[k]).sort(),['craft/cocktails.csv','craft/recipes.csv','craft/shelf_items.csv','web-views.json']);
  const unzip=require('node:child_process').execFileSync;for(const k of ['craft/cocktails.csv','craft/recipes.csv','craft/shelf_items.csv','web-views.json'])assert.equal(unzip('unzip',['-p',archive,'bar-playtest/data/shared-csv/'+k],{encoding:'utf8',maxBuffer:32*1024*1024}),after.files[k]);
  const built=await generate(k=>Promise.resolve(after.files[k]));assert.deepEqual(built.result.data.tables.recipes.filter(r=>r.context==='gin_tonic').map(r=>[r.ingredient,r.qty]),[['milk',22.5],['gin',45]]);
  for(const [k,v] of Object.entries(built.files))assert.equal(await fs.readFile(path.join(opts.runtime,k),'utf8'),v);
  await assert.rejects(()=>S.save({mode:'craft',files:{},revision:original.revision},opts),/변경/);
  await p.reload();await p.click('[data-id=gin_tonic]');assert.match(await p.locator('.prep-recipe').innerText(),/검수용 칵테일/);
  await p.fill('[data-step="0"] [data-line=qty]','0');await p.click('#save');await p.waitForFunction(()=>document.querySelector('#state').textContent.includes('양수'));assert.equal((await S.snapshot(opts.base)).revision,after.revision);assert.deepEqual(errors,[]);
  console.log('CRAFT_EDITOR_UI_OK: live recipe and hover, changes and ordering, ZIP, local save/reopen, stale/invalid rejection and runtime parity.');
 }finally{await browser.close();await fs.rm(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

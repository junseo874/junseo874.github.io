const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs'),sharp=load('sharp');
const web=path.resolve(__dirname,'..'),D=require('../data/presentation/runtime-assets.json');
(async()=>{
 const updated=Object.entries(D.assets).filter(([,a])=>a.source?.startsWith('9_ArtResources/'));
 for(const [key,a]of updated){
  const bytes=fs.readFileSync(path.join(web,a.src)),meta=await sharp(bytes).metadata();
  assert.deepEqual([meta.width,meta.height],[a.w,a.h],key);assert(meta.hasAlpha,key);
  const original=path.resolve(web,'../../..',a.source);
  if(fs.existsSync(original))assert(bytes.equals(fs.readFileSync(original)),key+' preserves supplied bytes');
 }
 for(const id of ['bottle_beer','gin_tonic','gin_fizz','dry_martini','cosmopolitan','kahlua_milk','screwdriver','tequila_sunrise','godfather','red_wine','champagne','johnny_old_fashioned']){
  assert.equal(D.assets['cocktail_'+id].src,D.assets['recipe_cocktail_'+id].src);
  assert.equal(D.assets['cocktail_'+id].w,220);assert.equal(D.assets['cocktail_'+id].h,411);
 }
 const b=await load('playwright').chromium.launch({executablePath:chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()===404)missing.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{
   lunaCampaign.screen('developer');barGame.reset(99,'practice',1,true,{variant:'original'});
   barGame.phase='regular';barGame.screen='bar';barGame.story=null;barGame.dialogue=null;
   barGame.seats={L:{id:'haru',actor:'haru',state:'STORY',expression:'idle',seated:true,coaster:true,glass:'red_wine'},M:null,R:{id:'tom',actor:'tom',state:'STORY',expression:'success',seated:true,coaster:true,glass:'johnny_old_fashioned'}};
   barGame.cameraLeft=0;barGame.cameraMoving=false;barGame.transition=0;lunaCampaign.render(true);
  });
  await p.waitForTimeout(900);
  const view=await p.evaluate(()=>({haru:barData.assets.char_haru_static,haruLayers:barData.characterLayers.haru,tom:barData.characterLayers.tom.success_default,html:document.querySelector('#app').innerHTML}));
  assert.deepEqual(view.haruLayers.idle_default,view.haruLayers.idle_talk);
  assert.equal(view.haru.frames,1);assert.equal(view.haru.fps,0);
  assert.deepEqual(view.tom,['char_tom_success']);assert(view.html.includes('Haru_Idle.png'));assert(view.html.includes('Tom_success.png'));
  await p.screenshot({path:'/private/tmp/luna-latest-bar-art.png'});
  await p.evaluate(async()=>{
   Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();
   outsidePlaytest.model.x=1.4;outsidePlaytest.model.story.cancel();outsidePlaytest.model.backgroundStory.cancel();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
  });
  const house=await p.evaluate(()=>({version:LUNA_OUTSIDE_DATA.homeArtVersion,layers:LunaHomeArt.layers,targets:outsidePlaytest.model.targets()}));
  assert.equal(house.version,'current-house-631');assert.equal(house.layers.length,13);
  for(const id of ['bed','wardrobe','home-book'])assert(house.targets.some(t=>t.id===id&&t.nodeName!=='main_bg'));
  await p.screenshot({path:'/private/tmp/luna-latest-home-art.png'});
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await p.waitForFunction(()=>window.resourceReview?.ready,null,{timeout:90000});
  const rows=await p.evaluate(()=>resourceReview.rows);
  for(const id of ['actor:haru:idle_default','actor:tom:success_default','actor:tom:fail_default','art:table_empty_glass_flute','art:table_empty_glass_wine','art:table_empty_glass_old_fashioned','art:title-flame'])assert(rows.some(r=>r.id===id),id);
  const sequence=rows.find(r=>r.id==='art:title-flame').layers[0];assert.equal(sequence.frames,348);assert.equal(sequence.fps,60);
  for(const n of [0,170,347]){
   const m=await sharp(fs.readFileSync(path.join(web,sequence.rects[n].src))).metadata();assert.deepEqual([m.width,m.height],[3840,2160]);
  }
  await p.evaluate(()=>resourceReview.select('actor:haru:idle_default'));
  await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/luna-haru-review.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log('LATEST_ART_OK:',updated.length,'registrations, 12 cocktail representatives, Haru static, Tom reactions, 13 house layers, review and 348 flame frames.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

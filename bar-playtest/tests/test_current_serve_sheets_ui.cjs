const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const files={gin_tonic:'gintonic',cosmopolitan:'cosmopolitan',dry_martini:'drymartini',gin_fizz:'ginfizz',kahlua_milk:'kahluamilk',bottle_beer:'beer',screwdriver:'screwdriver',tequila_sunrise:'tequila_sunrise',champagne:'champagne',red_wine:'wine',whiskey_sour:'whisky',godfather:'godfather',johnny_old_fashioned:'old_fashioned'};
(async()=>{
 const dir=path.resolve(__dirname,'../assets/01.ArtResources/04.Cutscenes/03.Bar/01.Serving/02.Drink_Serving_Screen_Sheets');
 const bg=await sharp(path.resolve(dir,'../03.Background/Background.png')).metadata();assert.equal(bg.width,959);assert.equal(bg.height,550);
 for(const name of Object.values(files).map(n=>n+'.png')){
  const local=path.join(dir,name),original=process.env.LUNA_SERVE_SOURCE_DIR?path.join(process.env.LUNA_SERVE_SOURCE_DIR,name):'';
  if(fs.existsSync(original))assert(fs.readFileSync(original).equals(fs.readFileSync(local)),name+' original bytes');
  const m=await sharp(local).metadata();assert.equal(m.width,5774);assert.equal(m.height,2767);
  const {data,info}=await sharp(local).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // The animator left the bottom-right cell empty. Showing it would make the
  // glass disappear just as the grade appears.
  const lastCell=await sharp(local).extract({left:4812,top:2214,width:960,height:551}).extractChannel('alpha').raw().toBuffer();
  assert(!lastCell.some(Boolean),name+' final atlas slot is padding');
  for(let f=0;f<29;f++){
   const x=2+(f%6)*962,y=2+Math.floor(f/6)*553;let visible=0;
   for(let yy=y;yy<y+551;yy+=4)for(let xx=x;xx<x+960;xx+=4)if(data[(yy*info.width+xx)*4+3])visible++;
   assert(visible>100,name+' frame '+f+' must not be empty');
   assert(y+551<=info.height&&x+960<=info.width,'Frame must stay within its source atlas');
  }
 }
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.route('**/gintonic.png',async route=>{await new Promise(r=>setTimeout(r,700));await route.continue();});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  async function craft(id){await p.evaluate(id=>{const g=barGame;g.reset(99,'practice',1,true);g.selectCocktail(id);g.debugFill();g.startCraft();g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));g.craft.index=g.craft.queue.length;g.nextGimmick();g.changed();},id);await p.locator('.serve-presentation[data-cocktail="'+id+'"]').waitFor();}
  for(const id of Object.keys(files)){
   await craft(id);assert.equal(await p.locator('[data-act=offer]').count(),0,'No early offer: '+id);
   if(id==='gin_tonic'){
    await p.locator('.serve-loading').waitFor();assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'0');
    await p.locator('.serve-loading').waitFor({state:'hidden'});
    await p.keyboard.press('Escape');const frame=await p.locator('.serve-canvas').getAttribute('data-frame');await p.waitForTimeout(250);assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),frame);await p.keyboard.press('Escape');
   }
   await p.locator('[data-act=offer]').waitFor();assert.equal(await p.locator('.serve-fallback').count(),0);
   assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'28');
   assert((await p.locator('.serve-canvas').getAttribute('data-source')).endsWith('/'+files[id]+'.png'));
   // Verify source composition byte-for-byte at 1:1. Fractional display
   // sampling and the browser compositor are exercised by the pixel-grid test.
   await p.setViewportSize({width:960,height:540});
   await p.waitForFunction(()=>{const c=document.querySelector('.serve-canvas');return c.width===960&&c.height===540;});
   const exact=await p.evaluate(async id=>{
    const native=document.createElement('canvas');native.width=960;native.height=540;const ctx=native.getContext('2d');ctx.imageSmoothingEnabled=false;
    const background=new Image();background.src=LUNA_SERVE_BACKGROUND.src;await background.decode();ctx.drawImage(background,0,0);ctx.drawImage(background,958,0,1,540,959,0,1,540);
    const sheet=LUNA_SERVE_SHEETS[id],image=new Image();image.src=sheet.src;await image.decode();ctx.drawImage(image,3850,2214,960,551,0,0,960,551);
    const actual=document.querySelector('.serve-canvas').getContext('2d');
    const pixels=actual.getImageData(0,0,960,540).data,reference=ctx.getImageData(0,0,960,540).data;
    return pixels.every((channel,i)=>channel===reference[i]);
   },id);assert(exact,'Actual canvas must equal synchronized new background + drink: '+id);
   await p.screenshot({path:'/private/tmp/current-serve-'+id+'.png'});
   // Every supplied drink must keep the same composition, not merely the
   // outer UI section. Exercise both sides of the old integer-scale jumps.
   for(const viewport of [{width:390,height:844},{width:953,height:600},{width:955,height:600},{width:1919,height:1080},{width:1921,height:1081},{width:2048,height:1181},{width:1280,height:720}]){
    await p.setViewportSize(viewport);await p.waitForTimeout(70);
    const check=await p.evaluate(()=>{
     const stage=document.querySelector('.serve-frame').getBoundingClientRect(),canvas=document.querySelector('.serve-canvas'),art=canvas.getBoundingClientRect();
     const pixel=1/devicePixelRatio,stageArea=document.querySelector('.serve-presentation').getBoundingClientRect();
     const fitsStage=['left','top','right','bottom'].every(edge=>Math.abs(art[edge]-stageArea[edge])<=pixel);
     const inside=b=>b.left>=stage.left-pixel&&b.top>=stage.top-pixel&&b.right<=stage.right+pixel&&b.bottom<=stage.bottom+pixel;
     const controls=[...document.querySelectorAll('.serve-actions button,.serve-grade')].map(e=>e.getBoundingClientRect());
     const fx=document.querySelector('.serve-carbonation'),grade=document.querySelector('.serve-grade').getBoundingClientRect();
     // Reference grade is centered above the drink, at the same logical size on every viewport.
     const headerClear=Math.abs((grade.left+grade.right)/2-(stage.left+stage.right)/2)<1&&Math.abs(grade.width/stage.width-440/1280)<.002;
     const gc=document.querySelector('.serve-grade-effects'),gradePainted=gc.getContext('2d').getImageData(gc.width*.3,gc.height*.05,gc.width*.4,gc.height*.17).data.some((v,i)=>i%4===3&&v>0);
     return {width:art.width/stage.width,height:art.height/stage.height,inside:fitsStage&&inside(art)&&controls.every(inside)&&headerClear&&gradePainted,frame:canvas.dataset.frame,fxAligned:!fx||JSON.stringify(fx.getBoundingClientRect())===JSON.stringify(art)};
    });
    assert(check.width>.99&&check.height>.99&&check.inside&&check.fxAligned&&check.frame==='28',JSON.stringify({id,viewport,check}));
    if(['bottle_beer','dry_martini'].includes(id)&&[390,2048].includes(viewport.width))await p.screenshot({path:'/private/tmp/serve-responsive-'+id+'-'+viewport.width+'.png'});
   }
  }
  for(const viewport of [{width:1920,height:1080},{width:1103,height:777},{width:1280,height:720}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(100);
   const bounds=await p.locator('.serve-presentation').boundingBox(),s=Math.min(viewport.width/1280,viewport.height/720);
   assert(Math.abs(bounds.width-1280*s)<.1&&Math.abs(bounds.height-720*s)<.1,'Serving UI keeps its screen scale');
   assert(Math.abs(bounds.x-(viewport.width-bounds.width)/2)<.1&&Math.abs(bounds.y-(viewport.height-bounds.height)/2)<.1,'Serving screen remains centered');
   assert(await p.locator('[data-act=offer]').isVisible());
  }
  await p.locator('[data-act=offer]').click();assert.equal(await p.evaluate(()=>barGame.drink.selected),'johnny_old_fashioned');assert.equal(await p.evaluate(()=>barGame.transactions.length),0);
  await craft('bottle_beer');assert.equal(await p.locator('.serve-grade').count(),0,'Repeated recipe restarts');await p.locator('[data-act=discard]').waitFor();
  const before=await p.evaluate(()=>barGame.progress.money),price=await p.evaluate(()=>Number(barGame.cocktail('bottle_beer').price));await p.locator('[data-act=discard]').click();assert.equal(await p.evaluate(()=>barGame.progress.money),before-price);await p.waitForFunction(()=>barGame.screen==='prep');
  // A failed sheet request must retain the correct static drink and working controls.
  await p.route('**/wine.png',r=>r.abort());await craft('red_wine');await p.locator('[data-act=offer]').waitFor();assert.equal(await p.locator('.serve-fallback').count(),1);assert.equal(await p.locator('.serve-grade-effects').evaluate(c=>c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height*.6),1,1).data[3]),0,'Grade overlay must not cover the static fallback drink with an opaque backdrop');
  assert(!requests.some(url=>/\/01.Legacy\/|\/04.ServingAnime\/|serve-gin-tonic\.png|serve-cosmo\.png|serve-background\.png|serve-kahlua\.png/.test(url)),'No retired serving resources requested');
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  const catalog=await p.evaluate(()=>resourceReview.rows.filter(r=>r.group==='bar-serve').map(r=>({id:r.id,status:r.status,layer:r.layers[0]})));
  for(const id of Object.keys(files)){const r=catalog.find(r=>r.id==='serve:'+id);assert.equal(r.status,'registered');assert.equal(r.layer.sx,2);assert.equal(r.layer.sy,2);assert.equal(r.layer.fw,960);assert.equal(r.layer.fh,551);assert.equal(r.layer.w,5774);}
  assert.deepEqual(errors,[]);console.log('PASS current 13 drink sheets + static background; 377 nonempty frames; 91 responsive drink/viewport cases with contained controls and aligned FX; exact source bytes and compositing; load gate, pause, offer/discard, reset, truthful missing-sheet fallback, resource catalog; no retired assets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

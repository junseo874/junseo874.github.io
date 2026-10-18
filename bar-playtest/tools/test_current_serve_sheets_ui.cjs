const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sharp=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const files={gin_tonic:'gin_tonic',cosmopolitan:'cosmopolitan',dry_martini:'drymartini',gin_fizz:'ginfizz',kahlua_milk:'kahluaMilk',bottle_beer:'beer',screwdriver:'screwdriver',tequila_sunrise:'tequila_sunrise'};
(async()=>{
 const dir=path.resolve(__dirname,'../assets/serve-20261019');
 for(const name of ['background.png',...Object.values(files).map(n=>'give_drink_'+n+'.png')]){
  const local=path.join(dir,name),original=path.join('/Users/lee/Desktop/Drink_Serving_Screen_Sheets',name);
  if(fs.existsSync(original))assert(fs.readFileSync(original).equals(fs.readFileSync(local)),name+' original bytes');
  const m=await sharp(local).metadata();assert.equal(m.width,5738);assert.equal(m.height,2707);
  const {data,info}=await sharp(local).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let f=0;f<30;f++){
   const x=2+(f%6)*956,y=2+Math.floor(f/6)*541;let visible=0;
   for(let yy=y;yy<y+539;yy+=4)for(let xx=x;xx<x+954;xx+=4)if(data[(yy*info.width+xx)*4+3])visible++;
   assert(visible>100,name+' frame '+f+' must not be empty');
  }
 }
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.route('**/give_drink_gin_tonic.png',async route=>{await new Promise(r=>setTimeout(r,700));await route.continue();});
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
   assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'29');
   assert((await p.locator('.serve-canvas').getAttribute('data-source')).endsWith('/give_drink_'+files[id]+'.png'));
   const exact=await p.evaluate(async id=>{
    const canvas=document.createElement('canvas');canvas.width=954;canvas.height=540;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    for(const sheet of [LUNA_SERVE_BACKGROUND,LUNA_SERVE_SHEETS[id]]){const image=new Image();image.src=sheet.src;await image.decode();ctx.drawImage(image,4782,2166,954,539,0,0,954,539);}
    return canvas.toDataURL()===document.querySelector('.serve-canvas').toDataURL();
   },id);assert(exact,'Actual canvas must equal synchronized new background + drink: '+id);
   await p.screenshot({path:'/private/tmp/current-serve-'+id+'.png'});
  }
  for(const viewport of [{width:1920,height:1080},{width:1103,height:777},{width:1280,height:720}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(100);
   const bounds=await p.locator('.serve-presentation').boundingBox(),s=Math.min(viewport.width/1280,viewport.height/720);
   assert(Math.abs(bounds.width-1280*s)<.1&&Math.abs(bounds.height-720*s)<.1,'Serving UI keeps its screen scale');
   assert(Math.abs(bounds.x-(viewport.width-bounds.width)/2)<.1&&Math.abs(bounds.y-(viewport.height-bounds.height)/2)<.1,'Serving screen remains centered');
   assert(await p.locator('[data-act=offer]').isVisible());
  }
  await p.locator('[data-act=offer]').click();assert.equal(await p.evaluate(()=>barGame.drink.selected),'tequila_sunrise');assert.equal(await p.evaluate(()=>barGame.transactions.length),0);
  await craft('bottle_beer');assert.equal(await p.locator('.serve-grade').count(),0,'Repeated recipe restarts');await p.locator('[data-act=discard]').waitFor();
  const before=await p.evaluate(()=>barGame.progress.money),price=await p.evaluate(()=>Number(barGame.cocktail('bottle_beer').price));await p.locator('[data-act=discard]').click();assert.equal(await p.evaluate(()=>barGame.progress.money),before-price);await p.waitForFunction(()=>barGame.screen==='prep');
  // A recipe without a supplied sheet must not show the wrong drink's animation.
  await craft('red_wine');await p.locator('[data-act=offer]').waitFor();assert.equal(await p.locator('.serve-fallback').count(),1);
  assert(!requests.some(url=>/\/Legacy\/|serve-gin-tonic\.png|serve-cosmo\.png|serve-background\.png|serve-kahlua\.png/.test(url)),'No retired serving resources requested');
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  const catalog=await p.evaluate(()=>resourceReview.rows.filter(r=>r.group==='bar-serve').map(r=>({id:r.id,status:r.status,layer:r.layers[0]})));
  for(const id of Object.keys(files)){const r=catalog.find(r=>r.id==='serve:'+id);assert.equal(r.status,'registered');assert.equal(r.layer.sx,2);assert.equal(r.layer.sy,2);assert.equal(r.layer.fw,954);assert.equal(r.layer.fh,539);assert.equal(r.layer.w,5738);}
  assert.deepEqual(errors,[]);console.log('PASS current 8 drink sheets + synchronized background; 270 nonempty frames; exact source bytes and compositing; load gate, pause, offer/discard, reset, truthful missing-sheet fallback, resource catalog; no retired assets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

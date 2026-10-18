const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/terrace-20261019');
 const sources={city:'/Users/lee/Desktop/project/9_ArtResources/02.Environments/04.Terrace/01.Sprites/Terrace_BG_City.png',building:'/Users/lee/Desktop/project/9_ArtResources/02.Environments/04.Terrace/01.Sprites/Terrace.png',balustrade:'/Users/lee/Desktop/project/9_ArtResources/02.Environments/04.Terrace/01.Sprites/balustrade.png',characters:'/Users/lee/Desktop/project/9_ArtResources/01.Characters/02.Outside/01.Luna/Terrace/Terrace.png'};
 for(const [name,src]of Object.entries(sources))if(fs.existsSync(src))assert(fs.readFileSync(src).equals(fs.readFileSync(path.join(dir,name+'.png'))),'Original bytes: '+name);
 const frames=[];for(let i=0;i<8;i++)frames.push(await sharp(path.join(dir,'characters.png')).extract({left:i*129,top:0,width:129,height:138}).png().toBuffer());
 assert(new Set(frames.map(b=>b.toString('base64'))).size>1,'Supplied sheet has distinct poses');
 // Reconstruct in memory only to verify authoring coordinates against the old preview.
 const composed=await sharp(path.join(dir,'city.png')).composite([{input:path.join(dir,'building.png'),left:0,top:0},{input:frames[0],left:85,top:98},{input:path.join(dir,'balustrade.png'),left:86,top:179}]).removeAlpha().raw().toBuffer();
 const preview=await sharp(path.join(root,'assets/campaign/terrace-20261018.png')).removeAlpha().raw().toBuffer();
 // The newly supplied city is a different skyline from the flattened preview.
 // Compare foreground geometry only; use the new city unchanged behind it.
 let delta=0,samples=0;for(let y=0;y<270;y++)for(let x=0;x<219;x++)for(let c=0;c<3;c++){const i=(y*480+x)*3+c;delta+=Math.abs(preview[i]-composed[i]);samples++;}
 assert(delta/samples<2,'Foreground placement must match reference composition');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('terrace-20261019/')&&!r.ok())failed.push(r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(()=>lunaCampaign.scene('night0','테라스','terrace',()=>{}));await page.waitForFunction(()=>!lunaCampaign.memoryTransition);
  await page.evaluate(()=>{window.terraceTick=lunaCampaign.tick.bind(lunaCampaign);lunaCampaign.tick=()=>{};lunaCampaign.dialog.terraceTime=0;lunaCampaign.paintLine();});
  const actors=page.locator('.terrace-characters');assert.equal(await actors.getAttribute('data-frame'),'0');
  assert.deepEqual(await page.locator('.terrace-art').evaluate(e=>[...e.children].map(n=>n.className)),['terrace-city','terrace-sign-scanlines','terrace-building','terrace-characters','terrace-balustrade']);
  assert.equal(await page.locator('.terrace-scene img[src*="terrace-20261018"]').count(),0);
  for(let i=0;i<8;i++){
   await page.evaluate(i=>{lunaCampaign.dialog.terraceTime=(i+.01)/6;lunaCampaign.paintLine();},i);
   assert.equal(await actors.getAttribute('data-frame'),String(i));
   assert.equal(await actors.evaluate(e=>getComputedStyle(e).backgroundPositionX),(-i*129)+'px');
   if([0,4].includes(i))await page.screenshot({path:'/private/tmp/terrace-animated-frame-'+i+'.png'});
  }
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.terraceTime=1.32;window.terraceTick(.05);});assert.equal(await actors.getAttribute('data-frame'),'0','Loop wraps without blank frame');
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.terraceTime=.7;c.dialog.chars=1e5;c.next();});assert.equal(await actors.getAttribute('data-frame'),'4','Dialogue advance preserves animation time');
  const time=await page.evaluate(()=>lunaCampaign.dialog.terraceTime);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>lunaCampaign.view),'options');
  await page.evaluate(()=>{for(let i=0;i<12;i++)window.terraceTick(.05);});assert.equal(await page.evaluate(()=>lunaCampaign.dialog.terraceTime),time);
  await page.keyboard.press('Escape');assert.equal(await actors.getAttribute('data-frame'),'4');
  await page.evaluate(()=>{for(let i=0;i<4;i++)window.terraceTick(.05);});assert.notEqual(await actors.getAttribute('data-frame'),'4');
  for(const [width,height]of [[640,360],[1280,720]]){await page.setViewportSize({width,height});await page.waitForTimeout(60);const rect=await page.locator('.terrace-art').boundingBox();assert(Math.abs(rect.width-width)<1&&Math.abs(rect.height-height)<1);}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS 8-frame terrace layers; original asset bytes; foreground preview mean pixel difference '+(delta/samples).toFixed(4)+'; loop, line continuity, pause/resume, viewport scaling, preload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

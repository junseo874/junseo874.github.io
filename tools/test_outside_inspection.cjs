const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(e?'not found':b);});
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/bar-playtest/`);
 await page.locator('[data-campaign="developer"]').click();await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{LunaFocusSettings.enabled=false;await outsidePlaytest.start();});
 await page.waitForFunction(()=>!outsidePlaytest.loading&&!outsidePlaytest.loadError);
 await page.evaluate(()=>document.fonts.ready);
 const coverage=await page.evaluate(()=>{
  let count=0;
  for(const day of [0,1,2,3])for(const flow of ['out','in']){
   const m=new LunaOutside.Model({day,flow,place:'bar'}),target=m.targets().find(t=>t.id==='wanted-poster');
   if(!target)throw Error('Missing poster '+day+flow);
   m.x=target.x;m.y=target.y;m.updateNear();m.interact();
   if(m.dialog?.kind!=='inspection'||m.story.speech)throw Error('Old poster dialogue opened');
   const x=m.x;m.tick(.05,{move:1});if(m.x!==x)throw Error('Movement during inspection');
   m.interact();if(m.dialog)throw Error('Close failed');m.interact();if(!m.dialog)throw Error('Reopen failed');count++;
  }
  if(LunaOutsideInspection.forTarget({id:'bar'})!==null)throw Error('Other objects changed');
  const o=outsidePlaytest,m=o.model,t=m.targets().find(t=>t.id==='wanted-poster');
  m.story.cancel();m.controlsTutorial=false;m.x=t.x;m.y=t.y;m.updateNear();o.snapCamera();o.refreshHUD();return count;
 });
 assert.equal(coverage,8);
 await page.keyboard.press('e');await page.locator('.outside-inspection').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('.outside-inspection-image')?.naturalWidth>0);
 assert.equal(await page.locator('#outside-inspection-description').textContent(),'어떤 개를 현상 수배하는 포스터로 보인다.');
 assert.equal(await page.locator('.outside-inspection-caption .textbox-piece').count(),11);
 assert.equal(await page.locator('#outside-root .outside-speech:visible').count(),0);
 await page.keyboard.press('Space');assert.equal(await page.locator('.outside-inspection:visible').count(),1);
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',repeat:true,bubbles:true})));
 assert.equal(await page.locator('.outside-inspection:visible').count(),1);
 const x=await page.evaluate(()=>outsidePlaytest.model.x);
 await page.keyboard.down('a');await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>outsidePlaytest.model.x),x);await page.keyboard.up('a');
 for(const [width,height]of [[1280,720],[640,360],[1920,1080],[900,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(80);
  const b=await page.locator('.outside-inspection-image').boundingBox(),caption=await page.locator('.outside-inspection-caption').boundingBox(),exit=await page.locator('.outside-inspection-exit').boundingBox();
  assert(Math.abs(b.x+b.width/2-width/2)<2,'Poster centre');assert(b.y>=0&&b.y+b.height<caption.y,'Poster above caption');
  const stage=await page.locator('#outside-root .outside-stage').boundingBox(),scale=stage.width/1280,stageBottom=stage.y+stage.height;
  assert(caption.x>=0&&caption.x+caption.width<=width&&caption.x>exit.x+exit.width,'Caption fits beside exit');
  assert(Math.abs(stageBottom-caption.y-caption.height-28*scale)<1,'Caption pinned to screen bottom');
  assert(caption.y-b.y-b.height>90*scale,'Caption separated from poster');
  assert.equal(await page.locator('.outside-inspection-caption .piece-9:visible').count(),0,'No tail');
  assert(exit.x>=0&&exit.x<width*.1&&exit.y+exit.height<=height,'Bottom-left exit');
 }
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:'/private/tmp/shiba-poster-inspection.png'});
 await page.keyboard.press('e');assert.equal(await page.locator('.outside-inspection').count(),0);
 await page.keyboard.press('e');await page.locator('.outside-inspection-exit').click();assert.equal(await page.locator('.outside-inspection').count(),0);
 await page.keyboard.press('e');await page.keyboard.press('Escape');assert.equal(await page.locator('.outside-inspection').count(),0);
 assert.equal(await page.evaluate(()=>outsidePlaytest.model.paused),false);
 assert.deepEqual(errors,[]);console.log('PASS: exact image inspection on all 8 day/commute combinations; existing textbox skin, 4 viewport sizes, movement lock, E/click/Escape close, repeat guard, reopening.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

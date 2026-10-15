const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();
 await p.locator('.title-logo.logo-ready').waitFor();
 const result=await p.evaluate(()=>{
  const c=lunaCampaign,logo=c.titleLogo,canvas=document.querySelector('.title-logo canvas'),snap=time=>{logo.time=time;logo.tick(0);return canvas.toDataURL();};
  const clean=snap(0),tear=snap(1.03),other=snap(2.02),rest=snap(2.4);
  return {changed:clean!==tear,different:tear!==other,restored:clean===rest,width:document.querySelector('.title-logo').getBoundingClientRect().width,canvasWidth:canvas.width};
 });assert(result.changed&&result.different&&result.restored);assert.equal(result.width,447);assert(result.canvasWidth>1340);
 await p.evaluate(()=>{lunaCampaign.titleLogo.time=0;lunaCampaign.titleLogo.tick(0);});
 await p.waitForTimeout(1100);
 assert(await p.evaluate(()=>lunaCampaign.titleLogo.time>.8),'Automatic animation without hover');
 await p.evaluate(()=>{const l=lunaCampaign.titleLogo;l.time=1.03;l.tick(0);l.tick=()=>{};});
 await p.screenshot({path:'/private/tmp/luna-title-logo-glitch.png'});
 await p.locator('[data-campaign="options"]').click();assert.equal(await p.evaluate(()=>lunaCampaign.titleLogo),null);
 await p.locator('[data-campaign="resume"]').click();await p.locator('.title-logo.logo-ready').waitFor();
 await p.emulateMedia({reducedMotion:'reduce'});
 const reduced=await p.evaluate(()=>{const l=lunaCampaign.titleLogo,c=document.querySelector('.title-logo canvas');l.time=0;l.tick(0);const a=c.toDataURL();l.time=1.03;l.tick(0);return a===c.toDataURL();});assert(reduced);
 await p.setViewportSize({width:960,height:540});await p.waitForFunction(()=>Math.round(document.querySelector('.title-logo').getBoundingClientRect().width)===335);
 assert.equal(await p.locator('.title-logo canvas').count(),1);assert.equal(await p.locator('.title-logo img').getAttribute('alt'),'Project LUNA');assert.deepEqual(errors,[]);
 console.log('PASS logo: timed strip displacement, changing tear patterns, exact clean restoration, automatic playback, layout preserved, one canvas, menu cleanup, reduced motion, scaled viewport, no runtime errors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

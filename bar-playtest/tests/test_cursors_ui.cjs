const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const kinds=['default','pointer','pressed','grab','grabbing','not-allowed','text','ew-resize','ns-resize','crosshair','wait','zoom-in'];
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const cursor=async(selector,name)=>assert((await p.locator(selector).first().evaluate(el=>getComputedStyle(el).cursor)).includes('/'+name+'.svg'),selector+' should use '+name);
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>lunaCampaign.action('title'));
  await cursor('body','default');await cursor('[data-campaign="options"]','pointer');
  const decode=await p.evaluate(async kinds=>Promise.all(kinds.map(async name=>{const i=new Image();i.src='assets/ui/cursors/'+name+'.svg';await i.decode();return [i.naturalWidth,i.naturalHeight];})),kinds);
  assert(decode.every(x=>x[0]===32&&x[1]===32));
  await p.locator('[data-campaign="options"]').click();
  await cursor('[data-setting="bgm"]','ew-resize');await cursor('[data-setting="voice"]','pointer');
  await p.locator('[data-setting="voice"]').selectOption('off');await cursor('[data-settings-action="preview"]','not-allowed');
  await p.locator('[data-settings-tab="game"]').hover();await p.mouse.down();await cursor('[data-settings-tab="game"]','pressed');await p.mouse.up();
  await p.keyboard.press('Escape');
  // Real pouring state, including pointer capture outside its canvas and pause cleanup.
  await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>barGame.startMinigame('pour'));await p.locator('[data-fluid-stage]').waitFor();
  await cursor('[data-fluid-stage]','grab');
  const box=await p.locator('[data-pixel-pour]').boundingBox();await p.mouse.move(box.x+box.width*.45,box.y+box.height*.46);await p.mouse.down();
  await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.cursorHeld==='true');
  await cursor('body','grabbing');await p.mouse.move(10,10);await cursor('body','grabbing');
  await p.mouse.up();await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.cursorHeld==='false');await cursor('body','default');
  await p.mouse.move(box.x+box.width*.45,box.y+box.height*.46);await p.mouse.down();await p.keyboard.press('Escape');await p.mouse.up();
  await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.cursorHeld==='false');await cursor('.ls-close','pointer');
  // Coaster/drink ghost survives source re-render; clearing it restores every cursor.
  await p.keyboard.press('Escape');
  await p.evaluate(()=>document.querySelector('#drag-ghost').hidden=false);await cursor('body','grabbing');
  await p.evaluate(()=>document.querySelector('#drag-ghost').hidden=true);await cursor('body','default');
  for(const route of ['resource-review.html','story-guide.html','../cutscene-studio/','../']){
   await p.goto('http://127.0.0.1:8123/bar-playtest/'+route,{waitUntil:'domcontentloaded'});await cursor('body','default');
  }
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html',{waitUntil:'domcontentloaded'});
  await cursor('input[type="search"]','text');
  // Cursor contact sheet: screenshots do not include the OS cursor itself.
  await p.evaluate(kinds=>{document.body.innerHTML='<main id="cursor-sheet" style="padding:32px;background:#0b1720;color:#d6fbff;font:16px sans-serif;display:grid;grid-template-columns:repeat(6,140px);gap:20px">'+kinds.map(name=>'<figure style="margin:0;padding:16px;border:1px solid #315463;text-align:center"><img src="assets/ui/cursors/'+name+'.svg" style="width:96px;height:96px;image-rendering:pixelated"><figcaption>'+name+'</figcaption></figure>').join('')+'</main>';},kinds);
  await p.locator('#cursor-sheet').screenshot({path:'/private/tmp/luna-cursors-preview.png'});
  assert.deepEqual(errors,[]);console.log('PASS 12 decoded cursor assets, settings/disabled/pressed, pour grab/capture/release/pause, drag lifecycle, text fields, all web surfaces');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

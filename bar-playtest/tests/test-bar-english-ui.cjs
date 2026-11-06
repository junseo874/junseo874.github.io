const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{lunaCampaign.screen('developer');barGame.reset(0,'full',3,true,{variant:'original'});});
  await p.waitForFunction(()=>barGame.dialogue&&!barGame.cameraMoving&&!barGame.transition);
  const ko=await p.evaluate(()=>barGame.dialogue.text);
  async function language(v){
   await p.keyboard.press('Escape');
   await p.locator('.luna-settings:visible [data-settings-tab="game"]').click();
   await p.locator('.luna-settings:visible [data-setting="language"]').selectOption(v);
   await p.locator('.luna-settings:visible .ls-primary[data-settings-action="close"]').click();
  }
  await language('en');
  const en=await p.evaluate(()=>barGame.dialogue.text);
  assert.match(en,/remember/i);
  await p.waitForFunction(en=>document.querySelector('.dialogue-text .text-ink')?.textContent===en,en);
  await language('ko');assert.equal(await p.evaluate(()=>barGame.dialogue.text),ko);
  await language('en');
  await p.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;barGame.advance();});
  await p.locator('.choices .choice-label').first().waitFor();
  assert.match((await p.locator('.choices').innerText()),/Skip tutorial/i);
  assert.equal(await p.evaluate(()=>['steps','bar_choices','barks'].flatMap(k=>barGame.t[k]).filter(r=>/[가-힣]/.test(r['text.ko'])&&(!r['text.en']||/[가-힣]/.test(r['text.en']))).length),0);
  console.log('PASS English bar script, guest barks and choices; settings switches the live bubble in both directions.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

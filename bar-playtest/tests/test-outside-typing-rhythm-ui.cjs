const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
 const result=await page.evaluate(async()=>{
  const a=outsidePlaytest;Object.assign(a.config,{day:2,flow:'out',place:'bar'});await a.start();a.tick=()=>{};
  const m=a.model;m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.controlsTutorial=false;barGame.dialogSpeed=1;
  const row={type:'say',actor:'luna',text:'가 나.다...라'},target={x:m.x,y:m.y};
  m.story.beginRows('typing-test',target,[row]);const samples=[];
  for(const dt of [2/55,2/55,.349,.001,1/55,.299,.001,.299,.001,1/55]){m.story.tick(dt);a.refreshHUD();samples.push(m.story.view().text);}
  const full=m.story.view().text,source=document.querySelector('.outside-speech:not(.outside-background-speech) p');
  const domText=source?.textContent,box=source?.getBoundingClientRect();
  m.story.cancel();m.backgroundStory.beginRows('typing-bg',target,[row],true);m.backgroundStory.tick(2/55);a.refreshHUD();
  const background=m.backgroundStory.view().text;
  // All campaign cutscene backgrounds now share the same rhythm (not bar service).
  a.exit(true);const c=lunaCampaign,tick=c.tick;c.tick=()=>false;c.memoryTransition=null;c.dayTransition=null;c.doorTransition=null;
  const sceneSamples={};
  for(const bg of ['street','home','city','bar','johnny-memory']){
   c.scene([row],'속도 검사',bg,()=>{});c.dialog.chars=0;
   for(let i=0;i<6;i++)tick.call(c,.05);
   sceneSamples[bg]=c.dialog.chars;
  }
  return{samples,full,domText,visible:box?.width>0,background,sceneSamples};
 });
 assert.deepEqual(result.samples,['가 ','가 나.','가 나.','가 나.다','가 나.다.','가 나.다.','가 나.다..','가 나.다..','가 나.다...','가 나.다...라']);
 assert(result.visible);assert.equal(result.full,'가 나.다...라');assert(result.domText.includes(result.full));assert.equal(result.background,'가 ');
 for(const bg of ['street','home','city','bar','johnny-memory'])assert.equal(result.sceneSamples[bg],4,bg+' cutscene uses lone-period pause without space pause');
 assert.deepEqual(errors,[]);console.log('OUTSIDE_TYPING_RHYTHM_UI_OK: real exterior render/audio clock, ambient channel and all campaign scene backgrounds.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

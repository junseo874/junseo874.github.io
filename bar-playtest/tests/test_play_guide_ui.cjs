const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await page.waitForFunction(()=>window.resourceReview?.ready);
  const frame=page.frames().find(f=>f.url().includes('resourceReview=1'));
  await page.evaluate(()=>resourceReview.launch({type:'review-opening'},'플레이 안내',''));
  await frame.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait);
  await page.waitForTimeout(1800);
  const guide=await frame.evaluate(()=>{
   const c=lunaCampaign.cinema,drawn=[],original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){drawn.push({text,x,y});return original.call(this,text,x,y,...rest);};
   try{c.player.render(c.time,null,false,0,c.dialogueWait);}finally{CanvasRenderingContext2D.prototype.fillText=original;}
   return {texts:c.scene.clips.filter(l=>l.introControls).map(l=>l.text),labels:drawn.filter(d=>d.y===565)};
  });
  assert(guide.texts.length>=2);
  assert(guide.texts.every(t=>t.includes('E키 또는 스페이스바')&&!t.includes('마우스')));
  assert.deepEqual(guide.labels.map(d=>d.text),['E키','스페이스바']);
  assert.equal((guide.labels[0].x+guide.labels[1].x)/2,640);
  await frame.locator('.campaign-prologue').click({position:{x:100,y:100}});
  await frame.waitForFunction(()=>lunaCampaign.cinema.time>=1&&!lunaCampaign.cinema.dialogueWait);
  assert.deepEqual(errors,[]);
  console.log('PLAY_GUIDE_OK: two centered keyboard labels, no mouse guidance, left-click still advances');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

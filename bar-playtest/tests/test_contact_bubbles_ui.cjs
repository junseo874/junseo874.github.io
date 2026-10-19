const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');await p.evaluate(()=>document.fonts.load('17px LunaPixel'));
 const stats=await p.evaluate(()=>{
  const lines=lunaCampaign.cinema.scene.clips.filter(c=>c.track==='phone-lines'),ctx=document.createElement('canvas').getContext('2d');
  return lines.map(c=>{const b=StudioTypography.bubble(ctx,c,1280/15),zoom=StudioTypography.bubble(ctx,c,2560/15);return {text:StudioTags.parse(c.text).text,wait:c.wait,font:c.fontFamily,size:b.text.glyphs[0].fontSize,px:b.paddingX,py:b.paddingY,w:b.width,h:b.height,rows:b.text.rows.length,zoom:zoom.width/b.width,remote:c.remote,color:b.text.glyphs[0].color};});
 });
 assert.equal(stats.length,6);for(const s of stats){assert(s.wait);assert.equal(s.font,'game');assert(Math.abs(s.size-17)<.001);assert.equal(s.px,17);assert.equal(s.py,13);assert(s.w<=420.01);assert(Math.abs(s.zoom-2)<.001);if(s.remote)assert.equal(s.color,'#50d9f5');}
 assert(stats[4].w<180);assert(stats[5].rows>1);
 for(const index of [0,4,5]){
  await p.evaluate(index=>{const c=lunaCampaign.cinema,line=c.scene.clips.filter(c=>c.track==='phone-lines')[index];c.time=line.start+.05;c.dialogueWait={id:line.id,age:20,revealed:true};c.player.render(c.time,null,false,.5,c.dialogueWait);},index);
  await p.screenshot({path:'/private/tmp/contact-bubble-'+index+'.png'});
 }
 await p.keyboard.press('KeyE');assert(await p.evaluate(()=>lunaCampaign.view==='game'&&!lunaCampaign.cinema&&outsidePlaytest.model.controlsTutorial));
 assert.deepEqual(errors,[]);console.log(JSON.stringify(stats));console.log('PASS: six manual phone lines, 17px game font, 17/13 padding, short fit, long wrapping, zoom invariance, cyan contact color and key progression.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

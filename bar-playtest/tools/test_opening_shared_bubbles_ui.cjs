const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');
  await page.evaluate(()=>lunaCampaign.newGame());await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const source=await page.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>['dream-lines','interruption','phone-lines'].includes(c.track)));
  assert.equal(source.length,16);assert(source.every(c=>c.fontFamily==='game'&&c.bubbleStyle==='outside'));
  const show=async id=>{
   await page.evaluate(id=>{const c=lunaCampaign.cinema,line=c.scene.clips.find(c=>c.id===id);c.time=line.start+.6;c.dialogueWait={id,age:20,revealed:true};},id);
   await page.waitForTimeout(120);
  };
  const front=source.find(c=>c.interruption),back=source.find(c=>c.overlay);
  await show(front.id);
  const overlaps=await page.evaluate(([front,back])=>{
   const a=document.querySelector('[data-clip-id="'+front+'"]'),b=document.querySelector('[data-clip-id="'+back+'"]'),x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
   return {sameBottom:Math.abs(x.bottom-y.bottom)<1,overlap:Math.min(x.right,y.right)-Math.max(x.left,y.left),
    above:+a.style.zIndex>+b.style.zIndex,opaque:getComputedStyle(a).backgroundColor,hiddenCue:a.querySelector('.dialogue-advance-cue').hidden};
  },[front.id,back.id]);
  assert(overlaps.sameBottom&&overlaps.overlap>30&&overlaps.above&&overlaps.hiddenCue);
  assert.equal(overlaps.opaque,'rgb(8, 15, 27)');
  await page.screenshot({path:'/private/tmp/opening-shared-bubble-overlap.png'});
  for(const width of [960,1280,1920]){
   await page.setViewportSize({width,height:Math.round(width*9/16)});await page.waitForTimeout(150);
   for(const line of [source[0],source[1],source.find(c=>c.remote)]){
    await show(line.id);
    const stats=await page.evaluate(id=>{
     const el=document.querySelector('[data-clip-id="'+id+'"]'),p=el.querySelector('p'),s=getComputedStyle(el),text=getComputedStyle(p),r=el.getBoundingClientRect();
     const reference=document.createElement('div');reference.className='outside-speech';reference.innerHTML='<p>대사</p>';document.body.append(reference);
     const rs=getComputedStyle(reference),rp=getComputedStyle(reference.querySelector('p'));
     const result={font:text.fontSize,line:text.lineHeight,pad:s.padding,border:s.borderRadius,color:text.color,
      expected:{font:rp.fontSize,line:rp.lineHeight,pad:rs.padding,border:rs.borderRadius,color:rp.color},
      inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
      cue:!el.querySelector('.dialogue-advance-cue').hidden,plain:el.getAttribute('aria-label')};
     reference.remove();return result;
    },line.id);
    assert.equal(stats.font,stats.expected.font);assert.equal(stats.line,stats.expected.line);
    assert.equal(stats.pad,stats.expected.pad);assert.equal(stats.border,stats.expected.border);assert.equal(stats.color,stats.expected.color);
    assert(stats.inside);assert.equal(stats.cue,!!line.wait);
   }
   await page.screenshot({path:'/private/tmp/opening-shared-bubble-'+width+'.png'});
  }
  // A partial line reserves the same width, wrapping and height as the completed line.
  const long=source[1];await show(long.id);
  const stable=await page.evaluate(id=>{
   const c=lunaCampaign.cinema,el=()=>document.querySelector('[data-clip-id="'+id+'"]');
   const before={w:el().offsetWidth,h:el().offsetHeight};
   c.dialogueWait={id,age:0,revealed:false};c.time=c.scene.clips.find(x=>x.id===id).start+.01;
   c.player.render(c.time,null,false,0,c.dialogueWait);
   return {before,after:{w:el().offsetWidth,h:el().offsetHeight}};
  },long.id);assert.deepEqual(stable.before,stable.after);
  // Seek out of dialogue and ensure no stale bubbles leak into the alarm/blackout.
  const cleared=await page.evaluate(()=>{const c=lunaCampaign.cinema;c.dialogueWait=null;c.time=c.skipUntil;c.player.render(c.time,null,false);return document.querySelectorAll('.studio-speech-bubble').length;});assert.equal(cleared,0);
  await page.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=20261013-shared-speech');
  await page.waitForFunction(()=>cutsceneStudio.ready);await page.locator('#guides').uncheck();
  await page.evaluate(()=>{const c=cutsceneStudio.project.clips.find(c=>c.interruption);cutsceneStudio.select(null);cutsceneStudio.seek(c.start+.6);});
  assert.equal(await page.locator('.studio-speech-bubble').count(),2);
  await page.locator('.stage-wrap').screenshot({path:'/private/tmp/opening-shared-bubble-studio.png'});
  assert.deepEqual(errors,[]);console.log('PASS: shared street CSS/font, DOM text, 960/1280/1920 sizing, opaque interruption, stable typing, manual-only cue, cleanup, matching studio renderer.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

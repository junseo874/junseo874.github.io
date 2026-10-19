const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(async()=>{const c=lunaCampaign,scene=await c.prepareStudio('documentary');c.cinema={studio:true,scene,time:0};c.screen('prologue');c.tick=()=>true;});
 const sample=async()=>p.locator('.studio-speech-bubble').evaluate(e=>{const s=getComputedStyle(e),p=e.querySelector('p'),r=e.getBoundingClientRect();return{padding:s.padding,font:getComputedStyle(p).fontSize,pieces:e.querySelectorAll('.textbox-piece').length,w:e.offsetWidth,h:e.offsetHeight,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,tail:getComputedStyle(e.querySelector('.piece-9')).display,overflow:p.scrollWidth>p.clientWidth+1};});
 const ids=await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue').map(c=>c.id));
 for(const id of ids){
  await p.evaluate(id=>{const c=lunaCampaign.cinema,l=c.scene.clips.find(l=>l.id===id);c.time=l.start+.02;c.dialogueWait={id,age:0,revealed:false};c.player.render(c.time,null,false,0,c.dialogueWait);},id);
  const early=await sample();
  await p.evaluate(()=>{const c=lunaCampaign.cinema;c.dialogueWait.revealed=true;c.player.render(c.time,null,false,0,c.dialogueWait);});
  const full=await sample();assert.equal(full.pieces,11);assert.equal(full.padding,'14px 34px 14px 28px');assert.equal(full.font,'17px');assert(full.inside&&!full.overflow);assert(full.w<=420);assert.equal(full.tail,'none');assert.deepEqual([early.w,early.h],[full.w,full.h]);
 }
 await p.screenshot({path:'/private/tmp/tv-shared-textbox.png'});
 await p.evaluate(async()=>{const c=lunaCampaign;c.disposeCinema();const scene=await c.prepareStudio('opening');c.cinema={studio:true,scene,time:0};c.screen('prologue');});
 const opening=await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue'&&!['intro','tv'].includes(c.layout)).map(c=>({id:c.id,remote:!!c.remote})));
 for(const {id,remote}of opening){await p.evaluate(id=>{const c=lunaCampaign.cinema,l=c.scene.clips.find(l=>l.id===id);c.time=l.start+.01;c.dialogueWait={id,age:10,revealed:true};c.player.render(c.time,null,false,0,c.dialogueWait);},id);const e=p.locator('[data-clip-id="'+id+'"]');assert.equal(await e.locator('.textbox-piece').count(),11);assert.equal(await e.evaluate(e=>getComputedStyle(e).padding),'14px 34px 14px 28px');if(remote)assert(await e.locator('p span').first().evaluate(e=>getComputedStyle(e).color)==='rgb(80, 217, 245)');}
 await p.screenshot({path:'/private/tmp/opening-common-textbox.png'});
 // Tagged glyphs no longer fall back to a different canvas bubble.
 await p.evaluate(()=>{const c=lunaCampaign.cinema,l=c.scene.clips.find(l=>l.type==='dialogue'&&!l.layout);l.text='[shake]흔들림[/shake] [c:#50d9f5]연락[/c]';l.textEffect='shake';c.time=l.start+.1;c.dialogueWait={id:l.id,age:10,revealed:true};c.player.render(c.time,null,false,0,c.dialogueWait);});
 assert(await p.locator('.exterior-textbox .cinema-glyph-shake').count()>0);
 // The old engine-backed memory player uses the same skin too.
 await p.evaluate(async()=>{const c=lunaCampaign;c.disposeCinema();for(const name of ['sfx','terrace-memory','player'])await c.script(name);Engine.initAnchors();const scene=buildTerraceMemory(c.data.scenes.terraceMemory);c.cinema={scene,time:scene.lines[0].t+1};c.screen('prologue');});
 assert.equal(await p.locator('.campaign-cinema-ui .bubble .textbox-piece').count(),11);
 assert.equal(await p.locator('.campaign-cinema-ui .bubble').evaluate(e=>getComputedStyle(e).padding),'14px 34px 14px 28px');
 await p.screenshot({path:'/private/tmp/memory-common-textbox.png'});
 await p.evaluate(()=>{lunaCampaign.disposeCinema();lunaCampaign.scene([{actor:'luna',text:'짧은 대사. 그리고 다음 줄에서도 움직이지 않게 확인해 봅니다.'}],'테스트','street',()=>{});lunaCampaign.dialog.chars=2;lunaCampaign.paintLine();});
 const before=await p.locator('.campaign-speech').boundingBox();await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});assert.deepEqual(await p.locator('.campaign-speech').boundingBox(),before);assert.equal(await p.locator('.campaign-speech .textbox-piece').count(),11);
 assert.deepEqual(errors,[]);console.log('PASS '+ids.length+' TV lines, '+opening.length+' opening/contact lines, stable typing, tags, legacy memory and static external scenes share the exterior skin');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

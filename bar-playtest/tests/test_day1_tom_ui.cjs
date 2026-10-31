const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').count())await p.locator('.updates-confirm').click();
for(const mode of ['original','gpt','campaign']){
 await p.evaluate(mode=>{const c=lunaCampaign;c.session.uninstall();c.view=mode==='campaign'?'game':'developer';c.host.hidden=true;c.app.inert=false;c.ui.variant=mode==='gpt'?'gpt':'original';if(mode==='campaign')c.session.install();barGame.reset(1,'regular',42,true,{variant:c.ui.variant});barGame.overlay=null;barGame.tutorial=null;barGame.pendingDailyUnlocks=false;barGame.transition=0;barGame.cameraLeft=0;barGame.cameraMoving=false;barGame.story=null;barGame.screen='bar';barGame.phase='regular';barGame.seats={L:null,M:{id:'tom',actor:'tom',seated:true,state:'STORY',coaster:true,glass:'dry_martini',expression:'idle'},R:null};barGame.dialogSpeed=.02;barGame.dialogue=barGame.makeLine('tom','음... 그러면 드라이 마티니로 한 잔 부탁할게.');},mode);
 await p.waitForFunction(()=>document.querySelector('.actor[data-actor="tom"] .actor-layer')&&!barGame.cameraMoving);await p.waitForTimeout(900);
 const tom=p.locator('.actor[data-actor="tom"]'),layers=tom.locator('.actor-layer'),layer=layers.first();assert.equal(await layers.count(),5);assert.equal(await layer.getAttribute('data-layer'),'char_tom_talk_body');assert.equal(await tom.locator('.dummy-actor').count(),0);
 const expected=['char_tom_talk_body','char_tom_idle_face_top','char_tom_idle_eyes','char_tom_idle_eyebrow','char_tom_talk_face_bottom_talk'];
 assert.deepEqual(await layers.evaluateAll(es=>es.map(e=>e.dataset.layer)),expected);
 for(const talking of [true,false]){
  if(!talking){await p.evaluate(()=>barGame.dialogue.chars=barGame.dialogue.text.length);await p.waitForFunction(()=>document.querySelector('.actor[data-actor="tom"]').dataset.pose==='idle_default');}
  const frames=new Set(),mouthFrames=new Set();
  for(let i=0;i<14;i++){
   const sample=await layers.evaluateAll(es=>es.map(el=>({frame:+el.dataset.frame,bg:getComputedStyle(el).backgroundImage,w:el.style.width,h:el.style.height,bottom:el.style.bottom})));
   assert.equal(new Set(sample.slice(0,talking?4:5).map(s=>s.frame)).size,1,'body and head retain their authored breathing frame');
   assert(sample.every(s=>s.bg.includes('/characters/tom/')&&s.w==='100%'&&s.h==='100%'));
   assert(sample.slice(0,talking?4:5).every(s=>parseFloat(s.bottom)===0));
   if(talking){const shift=[0,1,1,-1];assert(Math.abs(-parseFloat(sample[4].bottom)*530/100-(shift[sample[0].frame]-shift[sample[4].frame]))<.001,'articulated mouth remains attached to head (CSS serialization tolerance)');}
   frames.add(sample[0].frame);mouthFrames.add(sample[4].frame);await p.waitForTimeout(150);
  }
  assert.deepEqual([...frames].sort(),[0,1,2,3],talking?'talk loop':'idle loop');
  assert.deepEqual([...mouthFrames].sort(),[0,1,2,3],talking?'all supplied mouth shapes':'idle lower-face loop');
 }
 const baseline=await layer.evaluate(el=>{const rect=el.getBoundingClientRect(),plane=document.querySelector('.counter-plane').getBoundingClientRect();return {actual:rect.top+rect.height*420/530,expected:plane.top+500*plane.width/2041};});assert(Math.abs(baseline.actual-baseline.expected)<1,JSON.stringify(baseline));
 assert.equal(await tom.getAttribute('data-table-anchor'),'420');
 assert.deepEqual(await p.evaluate(()=>{const a=barData.assets.char_tom_idle_body;return [a.w,a.h,a.frames,a.frameWidth,barData.webActorBounds.tom];}),[2204,530,4,551,[96,109,454,441]]);
 await p.screenshot({path:'/private/tmp/day1-tom-'+mode+'.png'});
 await p.evaluate(()=>{barGame.dialogue=null;lunaCampaign.render(true);});
 await p.screenshot({path:'/private/tmp/day1-tom-'+mode+'-idle.png'});
 console.log('PASS '+mode+' Tom five-layer four-frame talk/idle + table alignment');
}
await p.setViewportSize({width:960,height:540});await p.waitForTimeout(250);assert(await p.locator('.actor[data-actor="tom"] .actor-layer').first().isVisible());await p.screenshot({path:'/private/tmp/day1-tom-small.png'});
assert.deepEqual(errors,[]);console.log('PASS no browser errors');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').count())await p.locator('.updates-confirm').click();
for(const mode of ['original','gpt','campaign']){
 await p.evaluate(mode=>{const c=lunaCampaign;c.session.uninstall();c.view=mode==='campaign'?'game':'developer';c.host.hidden=true;c.app.inert=false;c.ui.variant=mode==='gpt'?'gpt':'original';if(mode==='campaign')c.session.install();barGame.reset(1,'regular',42,true,{variant:c.ui.variant});barGame.overlay=null;barGame.tutorial=null;barGame.pendingDailyUnlocks=false;barGame.transition=0;barGame.cameraLeft=0;barGame.cameraMoving=false;barGame.story=null;barGame.screen='bar';barGame.phase='regular';barGame.seats={L:null,M:{id:'tom',actor:'tom',seated:true,state:'STORY',coaster:true,glass:'dry_martini',expression:'idle'},R:null};barGame.dialogSpeed=.02;barGame.dialogue=barGame.makeLine('tom','음… 그러면 드라이 마티니로 한 잔 부탁할게.');},mode);
 await p.waitForFunction(()=>document.querySelector('.actor[data-actor="tom"] .actor-layer')&&!barGame.cameraMoving);await p.waitForTimeout(900);
 const tom=p.locator('.actor[data-actor="tom"]'),layer=tom.locator('.actor-layer');assert.equal(await layer.count(),1);assert.equal(await layer.getAttribute('data-layer'),'char_tom_static');assert.equal(await tom.locator('.dummy-actor').count(),0);
 const first=await layer.getAttribute('data-frame');await p.waitForTimeout(600);assert.equal(first,'0');assert.equal(await layer.getAttribute('data-frame'),'0');
 await p.evaluate(()=>barGame.dialogue.chars=barGame.dialogue.text.length);await p.waitForTimeout(200);assert.equal(await layer.getAttribute('data-frame'),'0');
 const baseline=await layer.evaluate(el=>{const rect=el.getBoundingClientRect(),plane=document.querySelector('.counter-plane').getBoundingClientRect();return {actual:rect.top+rect.height*420/530,expected:plane.top+500*plane.width/2041};});assert(Math.abs(baseline.actual-baseline.expected)<1,JSON.stringify(baseline));
 assert.equal(await tom.getAttribute('data-table-anchor'),'420');
 assert((await layer.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('char-tom-idle-20261018.png'));
 assert.deepEqual(await p.evaluate(()=>{const a=barData.assets.char_tom_static;return [a.w,a.h,a.alphaBBox];}),[551,530,[96,109,454,441]]);
 await p.screenshot({path:'/private/tmp/day1-tom-'+mode+'.png'});
 await p.evaluate(()=>{barGame.dialogue=null;lunaCampaign.render(true);});
 await p.screenshot({path:'/private/tmp/day1-tom-'+mode+'-idle.png'});
 console.log('PASS '+mode+' Tom static talk/idle + table alignment');
}
await p.setViewportSize({width:960,height:540});await p.waitForTimeout(250);assert(await p.locator('.actor[data-actor="tom"] .actor-layer').isVisible());await p.screenshot({path:'/private/tmp/day1-tom-small.png'});
assert.deepEqual(errors,[]);console.log('PASS no browser errors');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

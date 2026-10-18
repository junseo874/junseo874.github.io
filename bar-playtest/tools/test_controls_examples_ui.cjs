const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.setDefaultTimeout(15000);
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
 const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
 await p.evaluate(()=>resourceReview.launch({type:'review-controls',id:'movement'},'이동',''));
 const panel=f.locator('.outside-controls-tutorial');await panel.waitFor();
 assert.equal(await panel.getAttribute('data-step'),'0');
 assert.equal(await panel.locator('.controls-luna canvas').count(),2);
 await f.evaluate(()=>outsidePlaytest.controlsTutorialKey({code:'KeyE',repeat:false,preventDefault(){},stopImmediatePropagation(){}}));
 assert.equal(await panel.getAttribute('data-step'),'0','Initial lock retained');
 assert.equal(await panel.locator('h2').textContent(),'이동 · 달리기');
 assert.equal(await panel.locator('.controls-run-card .controls-keycap').allTextContents().then(a=>a.join('+')),'Shift+A+D');
 const poses=await panel.locator('.controls-luna canvas').evaluateAll(cs=>cs.map(c=>({pose:c.dataset.motion,w:c.width,h:c.height,png:c.toDataURL(),height:parseFloat(c.style.height),animation:getComputedStyle(c).animationName,painted:[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].some((v,i)=>i%4===3&&v>0)})));
 assert(poses.every(c=>c.painted&&c.height===c.h*3&&c.animation==='none'));assert.notEqual(poses[0].png,poses[1].png,'Use the running pose, not a duplicated walking image');
 for(const viewport of [{width:1280,height:720},{width:640,height:360},{width:1920,height:1080}]){
  await p.setViewportSize(viewport);assert(await panel.evaluate(el=>el.scrollWidth===el.clientWidth));
  assert(await panel.locator('.controls-motion-card').evaluateAll(cards=>cards.every(card=>{const a=card.getBoundingClientRect();return [...card.querySelectorAll('canvas,kbd')].every(e=>{const b=e.getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom;});})));
 }
 await p.waitForTimeout(2150);
 await f.evaluate(()=>{dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));outsidePlaytest.controlsTutorialKey({code:'KeyE',repeat:false,preventDefault(){},stopImmediatePropagation(){}});});
 assert.equal(await panel.getAttribute('data-step'),'1');
 const checks=await panel.evaluate(async el=>{
  const svgs=[...el.querySelectorAll('.controls-example')];
  const rows=await Promise.all(svgs.map(async svg=>{
   const im=new Image();im.src=svg.querySelector('image').getAttribute('href');await im.decode();
   const v=svg.viewBox.baseVal,b=svg.getBoundingClientRect(),mark=svg.querySelector('.controls-target-mark'),mb=mark.getBBox();
   return {size:[b.width,b.height],crop:[v.width,v.height],natural:[im.naturalWidth,im.naturalHeight],color:getComputedStyle(mark).stroke,inside:mb.x>=v.x&&mb.y>=v.y&&mb.x+mb.width<=v.x+v.width&&mb.y+mb.height<=v.y+v.height};
  }));return rows;
 });
 assert.equal(checks.length,2);assert(checks[0].size.every((n,i)=>Math.abs(n-checks[1].size[i])<.1));assert.deepEqual(checks[0].crop,[400,310]);assert.deepEqual(checks[1].crop,[400,310]);
 assert.deepEqual(checks.map(c=>c.natural),[[605,431],[506,448]]);assert(checks.every(c=>c.inside&&c.color==='rgb(255, 117, 107)'));
 assert.equal(await panel.locator('.controls-progress-hint').textContent(),'E키를 눌러 진행');
 assert.equal(await panel.locator('.controls-interact-key kbd').textContent(),'E');
 for(const [width,height] of [[1280,720],[900,700],[1920,1080]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  assert(await panel.evaluate(el=>el.scrollWidth===el.clientWidth));
  assert(await panel.locator('figure').evaluateAll(fs=>fs.every(f=>{const a=f.getBoundingClientRect(),b=f.querySelector('svg').getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom;})));
 }
 await f.evaluate(()=>{dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));outsidePlaytest.controlsTutorialKey({code:'KeyE',repeat:false,preventDefault(){},stopImmediatePropagation(){}});});
 await panel.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 console.log('CONTROLS_EXAMPLES_OK: supplied screenshots, equal crop/card sizes, red target markers, E/lock preserved, responsive and no errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

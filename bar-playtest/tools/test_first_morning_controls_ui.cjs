const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.popupSounds=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){if(new Error().stack.includes('controls-tutorial.js'))window.popupSounds.push(this.buffer.duration);return start.apply(this,args);};
 });
 await p.goto('http://127.0.0.1:8123/bar-playtest/');
 await p.mouse.click(10,10);
 await p.waitForFunction(()=>LunaControlsTutorial.ready);
 await p.evaluate(()=>lunaCampaign.newGame());
 await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
 assert.equal(await p.locator('.outside-controls-tutorial').count(),0);
 await p.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(c=>c.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
 const panel=p.locator('.outside-controls-tutorial');
 await p.waitForFunction(()=>outsidePlaytest.model.controlsTutorial);
 assert(await panel.isVisible());assert.equal(await panel.getAttribute('aria-modal'),'true');
 assert.equal(await panel.getAttribute('data-step'),'0');
 assert.equal(await panel.locator('.controls-description').textContent(),'A와 D를 눌러 이동합니다.\nShift를 누른 채 이동하면 달립니다.');
 const checkHint=async()=>{
  assert(await panel.evaluate(el=>{const p=el.getBoundingClientRect(),heading=el.querySelector('.controls-heading>div'),r=heading.getBoundingClientRect();return getComputedStyle(heading).textAlign==='center'&&Math.abs(r.x+r.width/2-p.x-p.width/2)<1;}),'Tutorial label and title centered on the popup');
  assert.equal(await panel.locator('.controls-progress-hint').textContent(),'E키를 눌러 진행');
  assert(await panel.evaluate(el=>{const h=el.querySelector('.controls-progress-hint'),body=el.querySelector('.controls-description');return getComputedStyle(h).textAlign==='center'&&parseFloat(getComputedStyle(h).fontSize)<parseFloat(getComputedStyle(body).fontSize)&&h.getBoundingClientRect().top>=body.getBoundingClientRect().bottom;}));
 };
 await checkHint();
 assert.equal(await panel.getAttribute('data-locked'),'true');
 assert.equal(await panel.locator('button,.controls-footer,.controls-dismiss-hint').count(),0);
 await p.keyboard.down('KeyE');
 await p.waitForTimeout(1750);
 assert.equal(await panel.getAttribute('data-step'),'0');assert.equal(await panel.getAttribute('data-locked'),'true');
 // Clicking and holding E cannot bypass the initial two seconds.
 await panel.click();
 assert.equal(await panel.getAttribute('data-step'),'0');
 await p.waitForTimeout(350);await p.keyboard.down('KeyE');
 assert.equal(await panel.getAttribute('data-step'),'0');
 assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);
 await p.keyboard.up('KeyE');
 for(const key of ['KeyA','KeyD','Space','Enter','KeyQ','Escape','Tab']){await p.keyboard.press(key);assert.equal(await panel.getAttribute('data-step'),'0');}
 await panel.click();assert.equal(await panel.getAttribute('data-step'),'0');
 assert.equal(await p.evaluate(()=>popupSounds.length),1);
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:900,height:700}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(150);const r=await panel.boundingBox();
  assert(Math.abs(r.x+r.width/2-viewport.width/2)<2);assert(Math.abs(r.y+r.height/2-viewport.height/2)<2);
  assert(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height);
 }
 await p.setViewportSize({width:1440,height:900});
 await p.screenshot({path:'/private/tmp/controls-movement.png'});
 const key=panel.locator('.controls-keycap').first();
 assert.equal(await key.evaluate(el=>getComputedStyle(el).animationName),'controls-keypress');
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await key.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});
 await p.keyboard.down('KeyE');assert.equal(await panel.getAttribute('data-step'),'1');
 await p.waitForTimeout(400);await p.keyboard.down('KeyE');assert(await panel.isVisible());await p.keyboard.up('KeyE');
 assert.equal(await p.evaluate(()=>!!barGame.progress.objectives?.first_commute),false);
 assert.equal(await panel.locator('.controls-description').textContent(),'E키를 눌러 오브젝트나 다른 인물들과 상호작용할 수 있습니다.');
 await checkHint();
 assert.equal(await panel.locator('svg.controls-example').count(),2);
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:900,height:700}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(150);
  const contained=await panel.locator('figure').evaluateAll(figures=>figures.every(figure=>{
   const a=figure.getBoundingClientRect(),b=figure.querySelector('.controls-example').getBoundingClientRect();
   return b.left>=a.left&&b.top>=a.top&&b.right<=a.right&&b.bottom<=a.bottom;
  }));assert(contained,'Sprites must stay inside their cards');
  assert(await panel.evaluate(el=>el.scrollWidth===el.clientWidth),'Copy must fit the panel');
 }
 await p.setViewportSize({width:1440,height:900});
 const painted=await panel.locator('.controls-example image').evaluateAll(nodes=>Promise.all(nodes.map(async el=>{const im=new Image();im.src=el.getAttribute('href');await im.decode();return im.naturalWidth>0;})));
 assert(painted.every(Boolean),'Both supplied screenshots are loaded');
 assert.equal(await panel.locator('.controls-target-mark').count(),2);
 assert.equal(await p.evaluate(()=>popupSounds.length),2);
 await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>popupSounds.length),2,'No repeated sound on render');
 await p.screenshot({path:'/private/tmp/controls-interaction.png'});
 // No timeout. Other keys and clicks do not dismiss; held E cannot leak into gameplay.
 await p.evaluate(()=>{for(let i=0;i<300;i++)outsidePlaytest.tick(.05);});assert(await panel.isVisible());
 for(const key of ['KeyA','KeyD','Space','Enter']){await p.keyboard.press(key);assert(await panel.isVisible());}
 await panel.click();assert(await panel.isVisible());
 await p.keyboard.down('KeyE');assert(await panel.isHidden());await p.keyboard.down('KeyE');
 await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);await p.keyboard.up('KeyE');
 assert.equal(await p.evaluate(()=>barGame.progress.objectives.first_commute.status),'active');
 await p.keyboard.down('KeyA');await p.waitForTimeout(150);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x<2.557));
 // Reopening resets the two-second lock; both pages still require E.
 await p.evaluate(()=>outsidePlaytest.showControlsTutorial());assert.equal(await panel.getAttribute('data-locked'),'true');
 await p.waitForTimeout(2100);await p.keyboard.press('KeyE');assert.equal(await panel.getAttribute('data-step'),'1');
 await p.waitForTimeout(350);await p.keyboard.press('KeyE');assert(await panel.isHidden());
 assert.equal(await p.evaluate(()=>popupSounds.length),4);
 const states=await p.evaluate(()=>[0,1,2,3].flatMap(day=>['in','out'].map(flow=>{const m=new LunaOutside.Model({day,flow,place:'home'});m.wakeAtSofa();return {day,flow,x:m.x,sofa:m.targets().some(t=>t.id==='sofa'),near:m.near?.id};})));
 for(const s of states){assert.equal(s.x,2.557);assert.equal(s.sofa,s.flow==='out');assert.equal(s.near,s.flow==='out'?'sofa':undefined);}
 assert.deepEqual(errors,[]);console.log('PASS movement → interaction / 2s lock / E-only progression / held key and click protection / real sprites / sound once per popup / responsive layout / reduced motion / no input leakage / goal after both pages');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

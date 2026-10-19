const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();});
  const results=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,results=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const place of ['home','homeDoor','bar']){
    m.start({day,flow,place});
    for(const target of m.targets()){
     m.x=target.x;m.updateNear();a.snapCamera();a.refreshHUD();
     const el=document.querySelector('.outside-interact'),s=getComputedStyle(el),key=el.querySelector('kbd').getBoundingClientRect(),label=el.querySelector('span').getBoundingClientRect();
     results.push({day,flow,place,id:target.id,visible:!el.hidden,left:s.left,bottom:s.bottom,transform:s.transform,text:el.textContent,ordered:key.right<label.left,inline:el.style.cssText});
    }
   }
   return results;
  });
  assert(results.length>20);
  for(const r of results){
   assert(r.visible,JSON.stringify(r));assert.equal(r.left,'28px');assert.equal(r.bottom,'28px');assert.equal(r.transform,'none');
   const expected={tv:'TV 보기',exit:'나가기',sofa:'휴식하기',home:'들어가기',elevator:'작동하기',bar:'들어가기','wanted-poster':'보기','shiba-shop':'대화하기','bd-vendor':'대화하기','street-beggar':'대화하기','street-beggar-witness':'대화하기','day2-thug-information':'대화하기','story-samho':'대화하기'};
   assert(expected[r.id],'Unclassified target '+r.id);assert.equal(r.text,'E'+expected[r.id]);assert(r.ordered);assert.equal(r.inline,'');
  }
  const ids=new Set(results.map(r=>r.id));for(const id of ['tv','exit','sofa','home','elevator','bar','wanted-poster','shiba-shop','bd-vendor','street-beggar','street-beggar-witness'])assert(ids.has(id));
  assert.equal(await p.evaluate(()=>LunaOutside.interactionLabel(outsidePlaytest.model,{id:'day2-thug-information'})),'대화하기');
  assert([...ids].some(id=>/resident|vendor|encounter|samho|smuggler/.test(id)),'Actual NPC targets covered');
  await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:0,flow:'out',place:'home'});m.x=1.22;m.updateNear();a.snapCamera();a.tick(0);});
  const prompt=p.locator('.outside-interact');
  const checkStyle=async()=>{
   const style=await prompt.evaluate(el=>{const s=getComputedStyle(el),k=getComputedStyle(el.querySelector('kbd'));return {background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopWidth,shadow:s.boxShadow,font:s.fontSize,radius:k.borderRadius,width:k.width,height:k.height};});
   assert.deepEqual(style,{background:'rgba(0, 0, 0, 0)',image:'none',border:'0px',shadow:'none',font:'17px',radius:'50%',width:'32px',height:'32px'});
  };
  await checkStyle();await prompt.hover();await checkStyle();await p.mouse.move(0,0);
  for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:900,height:700}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(150);
   const r=await prompt.boundingBox(),stage=await p.locator('.outside-stage').boundingBox(),scale=stage.width/1280;
   assert(Math.abs(r.x-stage.x-28*scale)<1);
   assert(Math.abs(stage.y+stage.height-r.y-r.height-28*scale)<1);
  }
  await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(150);
  await p.screenshot({path:'/private/tmp/interaction-bottom-left.png'});
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=0;m.updateNear();outsidePlaytest.refreshHUD();});assert(await prompt.isHidden());
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=1.22;m.updateNear();outsidePlaytest.refreshHUD();});assert(await prompt.isVisible());
  await p.keyboard.press('Escape');assert(await prompt.isHidden());await p.keyboard.press('Escape');assert(await prompt.isVisible());
  // The relocated hint still performs the same interaction on click.
  await prompt.click();
  await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition,null,{timeout:60000});
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.template),'documentary');
  assert(await prompt.isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS '+results.length+' object/NPC targets / fixed bottom-left E + label / 3 viewport sizes / proximity and pause visibility / click enters TV');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

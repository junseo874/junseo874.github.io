const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
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
   assert(r.visible,JSON.stringify(r));assert.equal(r.left,'36px');assert.equal(r.bottom,'16px');assert.equal(r.transform,'none');
   const expected={tv:'TV 보기',exit:'나가기',sofa:'휴식하기',home:'들어가기',elevator:'작동하기',bar:'들어가기','wanted-poster':'보기','shiba-shop':'대화하기','street-beggar':'대화하기','street-beggar-witness':'대화하기','day2-thug-information':'대화하기','story-samho':'대화하기'};
   Object.assign(expected,{bed:'보기',wardrobe:'보기','neighborhood-boss':'대화하기','neighborhood-guard':'대화하기','neighborhood-repair':'대화하기','neighborhood-box':'보기','neighborhood-cat':'보기','neighborhood-home-cat':'보기'});
   assert(expected[r.id],'Unclassified target '+r.id);assert.equal(r.text,'E'+expected[r.id]);assert(r.ordered);assert.equal(r.inline,'');
  }
  const ids=new Set(results.map(r=>r.id));for(const id of ['bed','wardrobe','tv','exit','sofa','home','elevator','bar','wanted-poster','shiba-shop','street-beggar','street-beggar-witness'])assert(ids.has(id));
  assert.equal(await p.evaluate(()=>LunaOutside.interactionLabel(outsidePlaytest.model,{id:'day2-thug-information'})),'대화하기');
  assert([...ids].some(id=>/resident|beggar|shiba-shop|encounter|samho|smuggler/.test(id)),'Actual NPC targets covered');
  await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:0,flow:'out',place:'home'});m.x=1.22;m.updateNear();a.snapCamera();a.tick(0);});
  const prompt=p.locator('.outside-interact');
  const checkStyle=async()=>{
   const style=await prompt.evaluate(el=>{const s=getComputedStyle(el),k=getComputedStyle(el.querySelector('kbd'));return {background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopWidth,shadow:s.boxShadow,font:s.fontSize,radius:k.borderRadius,width:k.width,height:k.height};});
   assert.deepEqual(style,{background:'rgba(0, 0, 0, 0)',image:'none',border:'0px',shadow:'none',font:'18px',radius:'0px',width:'22px',height:'22px'});
  };
  const typography=await prompt.evaluate(el=>{const s=getComputedStyle(el),key=getComputedStyle(el.querySelector('kbd'));return {font:s.fontFamily,weight:s.fontWeight,key:key.backgroundImage};});
  assert(typography.font.includes('Paperlogy'));assert.equal(typography.weight,'700');assert(typography.key.includes('/assets/ui/outside/IMG_interaction.png'));
  await checkStyle();await prompt.hover();await checkStyle();await p.mouse.move(0,0);
  for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:900,height:700}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(150);
   const r=await prompt.boundingBox(),stage=await p.locator('.outside-stage').boundingBox(),scale=stage.width/1280;
   assert(Math.abs(r.x-stage.x-36*scale)<1);
   assert(Math.abs(stage.y+stage.height-r.y-r.height-16*scale)<1);
  }
  await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(150);
  await p.screenshot({path:'/private/tmp/interaction-bottom-left.png'});
  // x=0 is now the interactive wardrobe; use the empty gap before the TV.
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=.65;m.updateNear();outsidePlaytest.refreshHUD();});assert(await prompt.isHidden());
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

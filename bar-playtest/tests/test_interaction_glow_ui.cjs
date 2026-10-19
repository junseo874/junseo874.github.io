const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();});
 const cases=[['tv','home',0],['sofa','home',0],['exit','home',0],['bar','bar',1],['wanted-poster','bar',1],['shiba-shop','bar',1],['home','homeDoor',0],['elevator','bar',0],['elevator','homeDoor',0]];
 for(const [id,place,day] of cases){
  const result=await p.evaluate(({id,place,day})=>{const a=outsidePlaytest,m=a.model;m.start({day,place,flow:'out'});const t=m.targets().find(t=>t.id===id);if(!t)throw Error('Missing target '+id);m.x=t.x-.2;m.updateNear();a.snapCamera();a.tick(0);return {near:m.near?.id,glow:a.interactionGlow};},{id,place,day});
  assert.equal(result.near,id);assert.equal(result.glow.target,id);assert.equal(result.glow.drawn.length,1,JSON.stringify(result));
  if(id==='sofa'){
   const draw=result.glow.drawn[0];assert.equal(draw.node,'main_bg');assert.equal(draw.asset,'629b82812402bc');
   assert.deepEqual(draw.region.slice(0,4),[410,180,109,53]);
   assert(draw.region[4].every(([x,y])=>x>=0&&y>=0&&x<=109&&y<=53),'Contour remains inside the current sofa bounds');
   assert.equal(await p.evaluate(()=>{const node=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='IntractObjects');return LunaInteractionGlow.region({id:'sofa'},node,node.sprite,node.x,node.y,outsidePlaytest.model);}),null,'Never reuse the loose blanket atlas as the full sofa');
   // The old guessed polygon floated above the backrest and rounded across
   // empty space at the left. Check the mask itself in source-pixel space.
   const pixels=await p.evaluate(()=>{
    const node=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg'),sp=node.sprite;
    const c=document.createElement('canvas');c.width=sp.w;c.height=sp.h;const ctx=c.getContext('2d');
    const glow=LunaInteractionGlow.create();glow.begin({id:'sofa'},outsidePlaytest.model);
    ctx.translate(sp.w*sp.pivot.x,sp.h*(1-sp.pivot.y));glow.paint(ctx,null,sp,node,node.x,node.y,sp.w,sp.h);
    return [[490,183],[424,190],[490,179],[410,229],[434,200],[433,198],[430,200],[425,201]].map(([x,y])=>ctx.getImageData(x,y,1,1).data[3]);
   });
   assert(pixels[0]>200&&pixels[1]>200,'Outline hugs the real backrest');
   assert(pixels[2]<80&&pixels[3]<80,'No old floating arc over or to the left of the sofa');
   assert(pixels[4]>200&&pixels[5]>200,'Outline follows the inward armrest edge in Chrishouse2');
   assert(pixels[6]<80&&pixels[7]<80,'No contour crossing the visible blue wall inside the armrest recess');
  }
  assert(await p.locator('.outside-interact').isVisible());
  await p.screenshot({path:'/private/tmp/glow-'+id+'-'+place+'.png'});
 }
 // Call an absent elevator: the local boarding rails, not a distant car, glow.
 const away=await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:0,place:'homeDoor',flow:'out'});m.elevatorY=LunaResidence.layout.elevatorBottom;m.x=LunaResidence.layout.elevatorX;m.updateNear();a.snapCamera();a.tick(0);return a.interactionGlow;});
 assert.equal(away.drawn[0].node,'Elevator Line');
 await p.screenshot({path:'/private/tmp/glow-elevator-away.png'});
 // A direct-rendered NPC has the same proximity outline as scene-node NPCs.
 const npc=await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:2,place:'homeDoor',flow:'in'});m.notionFlags={day2_thug_done:true};const t=m.targets().find(t=>t.id==='day2-thug-information');m.x=t.x-.2;m.updateNear();a.snapCamera();a.tick(0);return a.interactionGlow;});
 assert.equal(npc.target,'day2-thug-information');assert.equal(npc.drawn.length,1);
 await p.screenshot({path:'/private/tmp/glow-thug.png'});
 // No stale glow after leaving range, in dialogs, tutorials, or pause screens.
 for(const state of ['far','dialog','tutorial','pause']){
  const result=await p.evaluate(state=>{const a=outsidePlaytest,m=a.model;m.start({day:0,place:'home',flow:'out'});m.x=1.22;m.updateNear();if(state==='far'){m.x=0;m.updateNear();}if(state==='dialog')m.dialog={title:'test',text:'test'};if(state==='tutorial')m.controlsTutorial=true;if(state==='pause')m.paused=true;a.tick(0);return a.interactionGlow;},state);
  assert.equal(result.target,null);assert.equal(result.drawn.length,0);assert(await p.locator('.outside-interact').isHidden());
 }
 await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:1,place:'bar',flow:'out'});m.x=5.45;m.updateNear();a.snapCamera();for(let i=0;i<100;i++)a.tick(.05);});
 assert(await p.evaluate(()=>outsidePlaytest.interactionGlow.cacheSize<40),'Cache reuses animated sprite frames');
 assert.deepEqual(errors,[]);console.log('PASS sprite outlines + current full-shot sofa contour: source/bounds/pixel regression, TV / doors / poster / animated NPC / elevator + call rails; proximity and modal guards; bounded mask cache');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

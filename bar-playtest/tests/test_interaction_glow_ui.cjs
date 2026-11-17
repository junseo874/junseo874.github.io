const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();});
 // Match the ring against the alpha of each displayed pixel at native scale.
 const props = {
  tv:'IntractObjects', sofa:'home-bedding', bed:'home-bed', wardrobe:'home-wardrobe',
  'home-book':'home-book', exit:'Room_Entrance', home:'residence-home-door'
 };
 const cases=[['tv','home',0],['sofa','home',0],['bed','home',0],['wardrobe','home',0],['home-book','home',0],['exit','home',0],['bar','bar',1],['wanted-poster','bar',1],['shiba-shop','bar',2],['home','homeDoor',0],['elevator','bar',0],['elevator','homeDoor',0],['sofa','home',0,true]];
 for(const [id,place,day,adopted=false] of cases){
  const result=await p.evaluate(({id,place,day,adopted})=>{
   const a=outsidePlaytest,m=a.model;
   m.start({day,place,flow:id==='bar'?'in':'out'});
   barGame.progress.flags.boobi_adopted=adopted;
   const target=m.targets().find(t=>t.id===id);
   m.x=target.x;m.updateNear();a.snapCamera();a.tick(0);
   return {near:m.near?.id,glow:a.interactionGlow};
  },{id,place,day,adopted});
  assert.equal(result.near,id);assert.equal(result.glow.target,id);assert.equal(result.glow.drawn.length,1,JSON.stringify(result));
  if(props[id]){
   const [draw]=result.glow.drawn;
   assert.equal(draw.node,props[id]);
   if(adopted)assert.equal(draw.asset,'home-sofa-uncovered');
   const pixels=await p.evaluate(async draw=>{
    const m=outsidePlaytest.model,node=LUNA_OUTSIDE_DATA.scenes[m.scene].nodes.find(n=>n.name===draw.node);
    const asset=LUNA_OUTSIDE_DATA.assets[draw.asset],im=new Image();im.src=asset.src;await im.decode();
    const w=im.naturalWidth,h=im.naturalHeight,sp={...node.sprite,asset:draw.asset,w,h};
    const c=document.createElement('canvas');c.width=w+4;c.height=h+4;const ctx=c.getContext('2d');
    ctx.drawImage(im,2,2);const source=ctx.getImageData(0,0,c.width,c.height).data;
    ctx.clearRect(0,0,c.width,c.height);ctx.translate(2+w*sp.pivot.x,2+h*(1-sp.pivot.y));
    const glow=LunaInteractionGlow.create();glow.begin(m.near,m);
    glow.paint(ctx,im,sp,node,node.x,node.y,w,h);
    const out=ctx.getImageData(0,0,c.width,c.height).data;
    const solid=(x,y)=>source[(y*c.width+x)*4+3]>20;
    let matches=0,errors=0;
    for(let y=1;y<c.height-1;y++)for(let x=1;x<c.width-1;x++){
     let border=false;
     if(!solid(x,y))for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)border ||= solid(x+dx,y+dy);
     if(border)matches++;
     if(border!==(out[(y*c.width+x)*4+3]>200))errors++;
    }
    return {w,h,matches,errors};
   },draw);
   assert.deepEqual(draw.region,[0,0,pixels.w,pixels.h],id);
   assert(pixels.matches>0);assert.equal(pixels.errors,0,id+' must outline the actual sprite alpha');
  }
  assert(await p.locator('.outside-interact').isVisible());
  await p.screenshot({path:'/private/tmp/glow-'+id+'-'+place+(adopted?'-uncovered':'')+'.png'});
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
 for(const state of ['homeward','dialog','tutorial','pause']){
  const result=await p.evaluate(state=>{const a=outsidePlaytest,m=a.model;m.start({day:0,place:'home',flow:'out'});m.x=1.22;m.updateNear();if(state==='homeward')m.start({day:1,place:'bar',flow:'out'});if(state==='dialog')m.dialog={title:'test',text:'test'};if(state==='tutorial')m.controlsTutorial=true;if(state==='pause')m.paused=true;a.tick(0);return {glow:a.interactionGlow,promptHidden:document.querySelector('.outside-interact').hidden};},state);
  assert.equal(result.glow.target,null,state);assert.equal(result.glow.drawn.length,0,state);assert(result.promptHidden,state);
 }
 await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:1,place:'bar',flow:'out'});m.x=5.45;m.updateNear();a.snapCamera();for(let i=0;i<100;i++)a.tick(.05);});
 assert(await p.evaluate(()=>outsidePlaytest.interactionGlow.cacheSize<40),'Cache reuses animated sprite frames');
 assert.deepEqual(errors,[]);console.log('PASS current furniture and entrance sprite outlines, both sofas, NPC and elevator highlights, modal guards and mask cache');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

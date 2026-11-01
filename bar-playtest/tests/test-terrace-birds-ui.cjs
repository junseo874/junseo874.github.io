const assert=require('node:assert/strict'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs'),sharp=rt.load('sharp');
(async()=>{
 // All animation cells share a fixed foot row; preserve every original RGBA byte.
 for(const kind of ['crow','pigeon']){
  const file=path.join(__dirname,'../assets/9_ArtResources/01.Characters/02.Outside/09.StreetNPC/Idle/'+(kind==='crow'?'Crow':'Pigeon')+'_idle.png');
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,129*12);assert.equal(info.height,138);
  for(let frame=0;frame<12;frame++){
   let bottom=-1;for(let y=0;y<138;y++)for(let x=0;x<129;x++)if(data[(y*info.width+frame*129+x)*4+3])bottom=y;
   assert.equal(bottom,114,kind+' fixed foot contact in frame '+frame);
  }
 }
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{window.birdTick=lunaCampaign.tick;});
  for(const day of [0,1,2]){
   await p.evaluate(day=>{lunaCampaign.tick=birdTick;lunaCampaign.session.day=day;lunaCampaign.scene('night'+day,'테라스','terrace',()=>{});},day);
   await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&lunaCampaign.view==='scene');
   await p.evaluate(()=>{lunaCampaign.tick=()=>false;const d=lunaCampaign.dialog;d.terraceEntryTime=99;d.terraceTime=2;d.chars=1e5;lunaCampaign.paintLine();});
   const initial=await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog));
   assert.deepEqual(initial.map(v=>v.kind),day===0?['crow','crow','crow']:day===1?['crow','crow']:['pigeon','pigeon','crow','crow']);
   assert(initial.every(v=>v.y===93||v.y===261));
   assert(initial.every(v=>v.facing===1),'All birds retain the original right-facing orientation');
   await p.screenshot({path:'/private/tmp/terrace-birds-day'+day+'.png'});
   if(day===1){
    // Fill the current line then really advance it; rendering/revealing text alone cannot summon the bird.
    for(let i=0;i<3;i++){
     await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
     assert.equal(await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog).length),i<2?2:3);
    }
    const start=await p.evaluate(()=>({at:lunaCampaign.dialog.terraceBirds.arrivalAt,pose:LunaTerraceBirds.poses(lunaCampaign.dialog)[1]}));
    assert(!start.pose.landed&&start.pose.y>270&&start.pose.x>360,'Enter below the right-hand skyline');
    await p.evaluate(()=>{for(let i=0;i<28;i++)LunaTerrace.tick(lunaCampaign.dialog,.05);lunaCampaign.paintLine();});
    const middle=await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog)[1]);
    assert(!middle.landed&&middle.y<261&&middle.x>250&&middle.x<310,'Follow the shallow crest across the lower skyline');
    await p.screenshot({path:'/private/tmp/terrace-birds-arriving.png'});
    await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();lunaCampaign.screen('options');lunaCampaign.screen('scene');});
    assert.equal(await p.evaluate(()=>lunaCampaign.dialog.terraceBirds.arrivalAt),start.at,'Next line/remount cannot restart arrival');
    assert.deepEqual(await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog)[1]),middle,'Remount preserves the exact flight position');
    const approach=await p.evaluate(()=>{const samples=[];for(let i=0;i<32;i++){LunaTerrace.tick(lunaCampaign.dialog,.05);samples.push(LunaTerraceBirds.poses(lunaCampaign.dialog)[1]);}lunaCampaign.paintLine();return samples;});
    assert(approach.every((v,i)=>v.facing===1&&v.x<=(i?approach[i-1].x:middle.x)),'Continue left without reversing or changing facing');
    assert(approach.at(-1).x-approach.at(-2).x===0,'Settle without a last-frame position jump');
    const landed=await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog)[1]);
    assert(landed.landed&&landed.y===261&&landed.x===159&&landed.facing===1);
    await p.screenshot({path:'/private/tmp/terrace-birds-landed.png'});
    await p.evaluate(()=>{for(let i=0;i<8;i++)LunaTerrace.tick(lunaCampaign.dialog,.05);lunaCampaign.paintLine();});
    assert.notEqual(await p.evaluate(()=>LunaTerraceBirds.poses(lunaCampaign.dialog)[1].frame),landed.frame);
   }
   // Birds and building have identical camera translation, including during the entrance pan.
   const pan=await p.evaluate(()=>{const d=lunaCampaign.dialog;d.terraceEntryTime=2;LunaTerrace.paint(d,document.querySelector('.campaign-stage'));return ['.terrace-building','.terrace-birds'].map(s=>getComputedStyle(document.querySelector(s)).transform);});
   assert.equal(pan[0],pan[1]);
  }
  // The glass surface must include the birds, not erase them or refract a different frame.
  const pixels=await p.evaluate(()=>{const d=lunaCampaign.dialog;d.terraceEntryTime=99;lunaCampaign.paintLine();const c=document.querySelector('.terrace-glass'),before=c.toDataURL(),saved=d.terraceBirds;d.terraceBirds={day:3};lunaCampaign.paintLine();const after=c.toDataURL();d.terraceBirds=saved;lunaCampaign.paintLine();return before!==after;});
  assert(pixels,'Birds must be in the composed glass image');
  await p.setViewportSize({width:960,height:600});await p.waitForTimeout(250);await p.evaluate(()=>lunaCampaign.paintLine());await p.screenshot({path:'/private/tmp/terrace-birds-small.png'});
  assert.deepEqual(errors,[]);console.log('PASS terrace birds: 12 frames/feet; days 0–2; third-line arrival; settling/idle; remount continuity; camera and glass composition');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

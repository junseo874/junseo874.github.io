const assert=require('node:assert/strict'),path=require('node:path'),rt=require('../../tools/lib/test-runtime.cjs');
const base=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/',out=process.env.LUNA_REVIEW_DIR;
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  const enter=day=>p.evaluate(async day=>{
   const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.install();barGame.reset(day,'full',1,false);
   c.session.day=day;c.session.carry=structuredClone(barGame.progress);
   Object.assign(c.outside.config,{day,flow:day?'in':'out',place:'bar'});await c.outside.start();c.screen(c.playView);
  },day);
  const approach=(id,dx)=>p.evaluate(({id,dx})=>{
   const o=outsidePlaytest,m=o.model,t=m.targets().find(t=>t.id===id);if(!t)throw Error('Missing actor '+id);
   m.story.cancel();m.backgroundStory.cancel();Object.assign(m,{x:t.x+dx,y:-.7,level:0});o.snapCamera();m.updateNear();o.tick(0);
   return {id:m.near?.id,x:t.x,active:lunaCampaign.active};
  },{id,dx});
  await enter(0);
  assert.deepEqual(await approach('street-beggar-witness',.14),{id:'street-beggar-witness',x:-11.05,active:true});
  await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='street-beggar-witness');
  assert.deepEqual(await approach('street-beggar',.34),{id:'street-beggar',x:-10.01,active:true});
  if(out)await p.screenshot({path:path.join(out,'street-crates.png')});
  await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='street-beggar');
  await enter(1);assert(await p.evaluate(()=>!LunaOutsideBeggar.targets(outsidePlaytest.model).length));
  await p.evaluate(()=>{
   const mod=LunaOutsideNewspaper,draw=mod.drawNode;window.seatFrames=[];
   mod.drawNode=(m,n,fn)=>draw(m,n,(sp,x,y,sx,sy,flip,...tail)=>{
    if(n.newspaperActor)seatFrames.push([sp.asset,x,y,flip]);return fn(sp,x,y,sx,sy,flip,...tail);
   });
  });
  for(const dx of [.29,-.29]){
   assert.deepEqual(await approach('street-newspaper',dx),{id:'street-newspaper',x:-7.18,active:true});
   if(out&&dx>0)await p.screenshot({path:path.join(out,'street-newspaper-seat.png')});
   await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='street-newspaper');
   await p.waitForFunction(()=>seatFrames.at(-1)?.[0]==='ambient-NewspaperDown');
   await p.evaluate(()=>{outsidePlaytest.model.story.cancel();outsidePlaytest.tick(0);});
  }
  const frames=await p.evaluate(()=>seatFrames);assert.deepEqual(new Set(frames.map(a=>a[0])),new Set(['ambient-Newspaper','ambient-NewspaperDown','ambient-NewspaperUp']));
  assert(frames.every(([,x,y,flip])=>x===-7.18&&Math.abs(y+.9)<1e-6&&flip===false),'every rendered frame stays seated and right-facing');
  // Read only: inspect the actual images/orientation painted by the position picker.
  const ed=await b.newPage({viewport:{width:1280,height:800}});ed.on('pageerror',e=>errors.push(e.message));
  await ed.addInitScript(()=>{const proto=CanvasRenderingContext2D.prototype,original=proto.drawImage;window.mapCast={};
   proto.drawImage=function(im,...args){if(this.canvas.id==='placement-map'&&im.src){const t=this.getTransform();mapCast[im.src.split('/').pop()]={flip:t.a<0,px:t.e};}return original.call(this,im,...args);};
  });
  for(const [flow,id,x,y,file,flip]of [['beggar/intro','beggar',-10.01,-.94,'homeless_idle.png',false],['newspaper/intro','newspaper',-7.18,-.9,'newspaper_idle.png',false]]){
   await ed.goto(base+'outside-dialogue-editor.html?flow='+flow);await ed.locator('[data-detail-action=place]').click();
   await ed.waitForFunction(file=>mapCast[file],file);assert.equal(await ed.locator('#place-actor').inputValue(),id);
   assert.equal(Number(await ed.locator('#place-x').inputValue()),x);assert.equal(await ed.locator('#place-y').innerText(),'Y '+y.toFixed(3));
   assert.equal(await ed.evaluate(f=>mapCast[f].flip,file),flip);
   if(id==='beggar'){
    await ed.waitForFunction(()=>mapCast['npc_m1_idle.png']?.px<mapCast['homeless_idle.png']?.px);
    await ed.locator('#place-actor').selectOption('witness');assert.equal(Number(await ed.locator('#place-x').inputValue()),-11.05);
   }
   if(out)await ed.locator('#placement-dialog').screenshot({path:path.join(out,'editor-'+id+'.png')});
   await ed.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);console.log('STREET_SEATING_OK: live targets, both approaches/three newspaper gestures, both position-picker casts');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

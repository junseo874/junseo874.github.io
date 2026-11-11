const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('/shaking/'))missing.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');await p.locator('.updates-confirm').click();
  const open=async()=>{await p.locator('[data-act="miniStart"][data-id="shake"]').click();await p.locator('[data-act="miniShakePlay"][data-id="2"]').click();await p.frameLocator('iframe').locator('#tutNext').waitFor();const f=p.frames().find(f=>f.url().includes('/shaking/'));return f;};
  const snapshot=()=>p.evaluate(()=>JSON.stringify({progress:barGame.progress,craft:barGame.craft,phase:barGame.phase,screen:barGame.screen}));
  const before=await snapshot(),f=await open();
  assert.equal(await f.evaluate(()=>S.phase),'tut');
  assert.equal(await f.locator('#inset,.lab-nav').count(),0);
  assert.equal(await f.locator('#openSet').isVisible(),false);
  assert.equal(await f.locator('.top').isVisible(),false);
  assert.equal(await f.locator('#oSnd').isVisible(),false);
  for(const [width,height]of [[1920,1080],[820,650],[390,844],[1280,720]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);
   const fit=await f.evaluate(()=>{const r=document.querySelector('.app').getBoundingClientRect();return Math.abs(r.width/r.height-16/9)<.001&&r.left>=-.1&&r.top>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1});assert.ok(fit);
  }
  await f.locator('#tutNext').click();await f.locator('#tutNext').click();
  await f.waitForFunction(()=>S.phase==='close');
  const timerStart=await f.evaluate(()=>S.startT);
  await f.waitForFunction(()=>GT-S.startT>=1100);
  assert.notEqual(await f.locator('#timer').textContent(),'00:00','Timer runs during initial alignment');
  assert.equal(await f.evaluate(()=>shakerView().a),-Math.PI/2);
  const movement=await f.evaluate(()=>{const a=S.angDeg;S.angDeg=-9.5;const left=closingTinOffset();S.angDeg=22.5;const right=closingTinOffset();S.angDeg=5.5;const center=closingTinOffset();S.angDeg=a;return{left,right,center}});
  assert.ok(movement.center.x>movement.left.x&&movement.center.x>movement.right.x,'Shallow arc rises at the center and lowers at both ends');
  assert.ok(movement.center.x-movement.right.x<20,'Arc stays subtle');
  assert.ok(movement.left.angle<0&&movement.right.angle>0,'Tin tilts with both sides of the arc');
  assert.equal(movement.center.angle,0,'Tin is upright at the center');
  assert.ok(Math.abs(movement.right.angle)<Math.PI/10,'Tilt remains below 18 degrees');
  assert.ok(movement.left.y<0&&movement.right.y>0,'Upper tin moves smoothly across the center');
  await f.evaluate(()=>{S.angDeg=5;press('A');});assert.equal(await f.evaluate(()=>S.closeQ),null);
  await f.evaluate(()=>{S.angDeg=5;press('Space');toggleSettings(true);});
  assert.ok(await f.evaluate(()=>Math.abs(closingTinOffset(S.slapT+160).angle)<1e-9),'Closing aligns the tilt before the camera rotation');
  await p.waitForTimeout(850);assert.equal(await f.evaluate(()=>S.phase),'close','Closing delay pauses in settings');
  await f.locator('#sBack').click();await f.waitForFunction(()=>S.phase==='shake');
  assert.equal(await f.evaluate(()=>S.startT),timerStart,'Closing does not restart the elapsed clock');
  assert.equal(await f.evaluate(()=>shakerView().zoom),1);
  const poses=await f.evaluate(()=>{
    const frames=[];for(const key of ['D','A','D','A','D']){
      beginLunaStroke(key);
      const arrival=S.lunaMotion.t+(S.lunaMotion.frames.length-1)*65;
      if(lunaStrokePulse(arrival+80)<=0||lunaStrokePulse(arrival+500)!==0)throw Error('Stroke effect must pulse once at the arrival pose');
      S.lunaMotion.t-=1000;frames.push(lunaStrokeFrame(GT));
      if(lunaStrokeFrame(GT)!==lunaStrokeFrame(GT+5000))throw Error('Pose must hold until the next input');
    }
    S.lunaMotion=null;S.lunaPushCount=0;return frames;
  });
  assert.deepEqual(poses,['push','mid','low3','mid','push'],'D alternates high/low extension; A stops at center');
  const sounds=await f.evaluate(()=>{const hit=ShakeLabAudio.hit;let count=0;ShakeLabAudio.hit=()=>count++;S.roundT=GT;press(S.seq[S.k]);const first=count;press(S.seq[S.k]);ShakeLabAudio.hit=hit;return[first,count]});
  assert.deepEqual(sounds,[1,2],'Both directional inputs sound, without double playback at round completion');
  await f.evaluate(()=>{S.seq='AD';S.k=0;S.roundT=GT;});
  for(const key of ['A','D']){
   await p.keyboard.press('Key'+key);await p.waitForTimeout(300);
   const motion=await f.evaluate(()=>({angle:shakerXf().a,ice:S.ices.reduce((s,o)=>s+o.x,0)/S.ices.length,water:S.h.reduce((s,h,i)=>s+h*(B.CH.x0+i*B.PX),0)/S.h.reduce((s,h)=>s+h,0),impact:Math.max(...S.ices.map(o=>o.wallSpeed||0))}));
   const sign=key==='A'?-1:1;
   assert.ok(motion.angle*sign>0&&motion.ice*sign>0&&motion.water*sign>0,key+' tilts and sends both contents toward the selected side');
   assert.ok(motion.impact>500,key+' produces a strong wall impact');
  }
  await f.evaluate(()=>{audio();});await p.waitForTimeout(200);
  // Version 2 always uses recording 2, regardless of legacy preferences.
  for(const voice of [1,2]){
   await f.evaluate(id=>{OPT.snd=id;ShakeLabAudio.hit();},voice);
   assert.equal(await f.evaluate(()=>document.body.dataset.lastSound),'shaker_02_hit.wav');
  }
  await f.evaluate(()=>{toggleSettings(true);});
  const paused=await f.evaluate(()=>({time:GT,round:S.round}));await p.waitForTimeout(200);
  assert.deepEqual(await f.evaluate(()=>({time:GT,round:S.round})),paused);
  await f.locator('#sBack').click();
  // Exercise every pattern, including the four-key sour rounds, through real keyboard input.
  for(const recipe of ['daiquiri','fizz','sour']){
   await f.evaluate(id=>{R=RECIPES.find(r=>r.id===id);reset()},recipe);
   await f.locator('#tutNext').click();await f.locator('#tutNext').click();
   await f.evaluate(()=>{S.angDeg=5;press('Space');});await f.waitForFunction(()=>S.phase==='shake');
   const iceCheck=await f.evaluate(()=>{
    const C=B.CH,coverage=S.ices.reduce((a,o)=>a+4*o.size*o.size,0)/((C.x1-C.x0)*DEPTH);
    for(let i=0;i<600;i++){stepWater(1/240,Math.sin(i*.09)*2800,900);stepIces(1/240,Math.sin(i*.09)*2800,900);}
    return{coverage,valid:S.ices.every(o=>{const e=o.size*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));return[o.x,o.y,o.rot,o.vx,o.vy].every(Number.isFinite)&&o.x-e>=C.x0-.01&&o.x+e<=C.x1+.01&&o.y-e>=C.y0-.01&&o.y+e<=C.y1+.01})};
   });
   assert.ok(Math.abs(iceCheck.coverage-.25)<1e-6,'Ice fills 25% of the cutaway area');assert.ok(iceCheck.valid,'Large ice remains finite and inside the shaker under strong alternating acceleration');
   for(let round=0;round<10;round++){
    const seq=await f.evaluate(()=>{S.roundT=GT;return S.seq;});
    assert.match(seq,/^(AD)+$/,'Every round keeps A → D without a reversed phase');
    for(const key of seq)await p.keyboard.press('Key'+key);
   }
   assert.equal(await f.evaluate(()=>S.phase),'unseal');
   const ending=await f.evaluate(()=>{
    const water=drawWater,ice=drawIcePx;let calls=0;drawWater=drawIcePx=()=>calls++;drawShaker(GT);drawWater=water;drawIcePx=ice;
    return{calls,angle:shakerView(S.unseal.t+1000).a,zoom:shakerView(S.unseal.t+1000).zoom};
   });
   assert.equal(ending.calls,0,'Successful ending immediately hides the cutaway');
   assert.equal(ending.angle,-Math.PI/2);assert.ok(Math.abs(ending.zoom-.68)<1e-9);
   const fade=await f.evaluate(()=>[1600,1800,2000,2999].map(age=>unsealPresentation(S.unseal.t+age).alpha));
   assert.deepEqual(fade,[1,.5,0,0],'Upper tin fades after separation and remains hidden during the one-second hold');
   await f.evaluate(()=>toggleSettings(true));const endTime=await f.evaluate(()=>GT);await p.waitForTimeout(150);assert.equal(await f.evaluate(()=>GT),endTime);await f.locator('#sBack').click();
   await f.waitForFunction(()=>S.phase==='unseal'&&GT-S.unseal.t>=2100);
   assert.equal(await f.locator('#res').isVisible(),false,'No result while lower tin holds alone');
   await f.waitForFunction(()=>S.phase==='done');
   assert.equal(await f.locator('#rsScore').textContent(),'100');
   assert.equal(await f.evaluate(()=>S.res.filter(x=>x==='O').length),10);
   if(recipe!=='sour'){
    await f.locator('#again').click();await f.locator('#tutNext').click();await f.locator('#tutNext').click();
   }
  }
  await f.locator('#again').click();await f.locator('#tutNext').click();await f.locator('#tutNext').click();
  await f.evaluate(()=>{S.angDeg=5;press('Space');});await f.waitForFunction(()=>S.phase==='shake');
  for(let i=0;i<3;i++){
   await f.evaluate(()=>{press(S.seq[S.k]==='A'?'D':'A');});
   if(i<2)await f.waitForFunction(()=>!S.pending);
  }
  assert.deepEqual(await f.evaluate(()=>({phase:S.phase,water:S.h,ice:S.ices.length,drops:S.drops2.length})),{phase:'pop',water:null,ice:0,drops:0});
  assert.ok(await f.evaluate(()=>S.fx.filter(p=>p.k==='liquid').length>=64),'Final failure bursts liquid outside the opaque shell');
  const flow=await f.evaluate(()=>{const t=S.pop.t;update(t+400,100);return{count:S.fx.filter(p=>p.k==='liquid').length,gravity:S.fx.every(p=>p.k!=='liquid'||p.g>0)}});
  assert.ok(flow.count>64&&flow.gravity,'Liquid continues to drain and falls under gravity');
  const hiddenContents=await f.evaluate(()=>{const water=drawWater,ice=drawIcePx;let calls=0;drawWater=drawIcePx=()=>calls++;drawShaker(GT);drawWater=water;drawIcePx=ice;return calls});
  assert.equal(hiddenContents,0,'Detached tin does not render liquid or ice');
  await f.waitForFunction(()=>S.phase==='done');assert.equal(await f.locator('#rsScore').textContent(),'0');
  await f.locator('#other').click();await p.locator('[data-act="miniShakePlay"]').first().waitFor();assert.equal(await p.locator('[data-act="miniShakePlay"]').count(),2);
  assert.equal(await snapshot(),before,'Standalone version must not mutate gameplay');
  await p.locator('[data-act="miniShakePlay"][data-id="1"]').click();
  await p.locator('.rhythm-board').waitFor();
  assert.equal(await p.evaluate(()=>barGame.gimmick.type),'shake');
  assert.equal(await p.locator('iframe').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log('SHAKING_VERSIONS_OK: V1 retained; V2 all recipes/success/failure, pause-safe callbacks, real WAVs, navigation and campaign isolation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('/shaking/'))missing.push(r.url());});
  await p.addInitScript(()=>localStorage.setItem('luna.shake.sound.v2','1'));
  await p.goto((process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/')+'?dev=1&mode=minigames');await p.locator('.updates-confirm').click();
  const open=async()=>{await p.locator('[data-act="miniStart"][data-id="shake"]').click();await p.locator('[data-act="miniShakePlay"][data-id="2"]').click();await p.frameLocator('iframe').locator('#tutNext').waitFor();const f=p.frames().find(f=>f.url().includes('/shaking/'));return f;};
  const snapshot=()=>p.evaluate(()=>JSON.stringify({progress:barGame.progress,craft:barGame.craft,phase:barGame.phase,screen:barGame.screen}));
  const before=await snapshot(),f=await open();
  await f.waitForFunction(()=>typeof S !== 'undefined' && S?.phase==='tut');
  assert.equal(await f.evaluate(()=>S.phase),'tut');
  assert.equal(await f.locator('#inset,.lab-nav').count(),0);
  assert.equal(await f.locator('#openSet').isVisible(),false);
  assert.equal(await f.locator('.top').isVisible(),false);
  assert.equal(await f.locator('#sndtabs,#oSnd,[data-s]').count(),0);
  for(const [width,height]of [[3840,2160],[1920,1080],[820,650],[390,844],[1280,720]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);
   const fit=await f.evaluate(()=>{const r=document.querySelector('.app').getBoundingClientRect();return Math.abs(r.width/r.height-16/9)<.001&&r.left>=-.1&&r.top>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1});assert.ok(fit);
  }
  const lesson=f.getByRole('dialog',{name:'쉐이킹',exact:true});
  const card=lesson.locator('.mix-lesson-card');
  assert.match(await card.evaluate(el=>getComputedStyle(el).backgroundImage),/Web_GRD_mix_lesson_card_background/);
  const diagram=lesson.locator('figure svg');
  assert(await diagram.locator('.guide-close').isVisible(),'First page renders the tin alignment demo');
  await lesson.getByRole('button',{name:'다음 · E'}).click();
  assert(!(await diagram.locator('.guide-close').isVisible()),'Closing overlay is hidden during the stroke demo');
  await f.waitForFunction(()=>guideGrid.bank);
  const guideKeys=await diagram.evaluate(svg=>{
   svg.pauseAnimations();
   const original=guidePaint.fillText,frames=[];
   try{
    for(const t of [.1,.5,.9,1.3,1.8,2.8,3.8]){
     const labels=[];svg.setCurrentTime(t);
     guidePaint.fillText=function(text,...args){
      if(['D','A','E'].includes(text))labels.push([text,Math.round(this.getTransform().f/(guideCanvas.height/300))]);
      return original.call(this,text,...args);
     };
     drawShakerGuide();frames.push(labels);
    }
   }finally{guidePaint.fillText=original;}
   return frames;
  });
  assert.deepEqual(guideKeys.map(frame=>frame.map(([key])=>key)),[['D'],[],['A'],[],['E'],['A'],['D']]);
  const low=guideKeys[0][0][1],middle=guideKeys[2][0][1],high=guideKeys[4][0][1];
  assert(low>177&&high<133&&Math.abs(low+high-2*middle)<=1,'Guide cues mark the mirrored outside rim corners');
  await lesson.getByRole('button',{name:'이전'}).press('Enter');
  assert.equal(await lesson.locator('#tutPage').innerText(),'1');
  await f.locator('#tutNext').click();await f.locator('#tutNext').click();
  await f.waitForFunction(()=>S.phase==='close');
  const actorVisible=()=>f.evaluate(()=>{drawLuna(GT);return lc.getImageData(0,0,lv.width,lv.height).data.some((v,i)=>i%4===3 && v>0);});
  assert.equal(await f.locator('#luna-panel').isVisible(),true,'Standby monitor frame stays visible');
  assert.equal(await f.locator('#luna-feed').isVisible(),false,'Bar and actor stay hidden during standby');
  assert.equal(await actorVisible(),false);
  assert.equal(await f.evaluate(()=>shakerView().zoom),1);
  const timerStart=await f.evaluate(()=>S.startT);
  await f.waitForFunction(()=>GT-S.startT>=1100);
  assert.notEqual(await f.locator('#timer').textContent(),'00:00','Timer runs during initial alignment');
  assert.equal(await f.evaluate(()=>shakerView().a),Math.PI/2);
  const movement=await f.evaluate(()=>{const a=S.angDeg;S.angDeg=-9.5;const left=closingTinOffset();S.angDeg=22.5;const right=closingTinOffset();S.angDeg=6.5;const center=closingTinOffset();S.angDeg=a;return{left,right,center}});
  assert.ok(movement.center.x>movement.left.x&&movement.center.x>movement.right.x,'Shallow arc rises at the center and lowers at both ends');
  assert.ok(movement.center.x-movement.right.x<20,'Arc stays subtle');
  assert.ok(movement.left.angle<0&&movement.right.angle>0,'Tin tilts with both sides of the arc');
  assert.equal(movement.center.angle,0,'Tin is upright at the center');
  assert.ok(Math.abs(movement.right.angle)<Math.PI/10,'Tilt remains below 18 degrees');
  assert.ok(movement.left.y<0&&movement.right.y>0,'Upper tin moves smoothly across the center');
  await f.evaluate(()=>{S.angDeg=5;press('A');});assert.equal(await f.evaluate(()=>S.closeQ),null);
  await f.evaluate(()=>{S.angDeg=5;press('Space');toggleSettings(true);});
  // Measure the two sprite centers in the actual split-shell draw, from seal to horizontal rest.
  const seating=await f.evaluate(()=>{
    const original=ctx.drawImage,poses=[];
    try{for(const age of [160,580,1000]){
      const centers={};
      ctx.drawImage=function(sheet,sx,sy,sw,sh,x,y,w,h){
        if(sheet===gameGrid.bank.parts)centers[sy]=new DOMPoint(x+w/2,y+h/2).matrixTransform(this.getTransform());
        return original.apply(this,arguments);
      };
      drawShaker(S.slapT+age);
      poses.push([centers[105].x-centers[0].x,centers[105].y-centers[0].y]);
    }}finally{ctx.drawImage=original;}
    return poses;
  });
  assert(Math.abs(seating[0][0])<2 && seating[0][1]<0,'Small tin begins directly above the large tin');
  assert(seating[1][0]<0 && seating[1][1]<0,'Small tin descends through the upper left');
  assert(seating[2][0]<0 && Math.abs(seating[2][1])<2,'Small tin finishes on the left');
  assert.equal(await f.locator('#luna-feed').isVisible(),false,'Only the readout is visible immediately after sealing');
  assert.deepEqual(await f.locator('#luna-panel .seal-readout > *').allTextContents(),['SHAKER ASSEMBLED','START...']);
  assert.equal(await f.locator('#seal-notice').isVisible(),true);
  assert.ok(await f.evaluate(()=>Math.abs(closingTinOffset(S.slapT+160).angle)<1e-9),'Closing aligns the tilt before the camera rotation');
  await p.waitForTimeout(850);assert.equal(await f.evaluate(()=>S.phase),'close','Closing delay pauses in settings');
  await f.locator('#sBack').click();
  await f.waitForFunction(()=>document.querySelector('#luna-panel').classList.contains('is-opening'));
  assert.equal(await f.locator('#luna-feed').isVisible(),true,'Picture opens as the notice fades');
  await f.waitForFunction(()=>S.phase==='shake');
  assert.equal(await f.locator('#luna-feed').evaluate(el=>getComputedStyle(el).clipPath),'none','First playable frame shows the whole feed');
  assert.equal(await actorVisible(),true);
  assert.equal(await f.evaluate(()=>S.startT),timerStart,'Closing does not restart the elapsed clock');
  assert.equal(await f.evaluate(()=>shakerView().zoom),1);
  const poses=await f.evaluate(()=>{
    const frames=[];for(const key of ['D','A','E','A','D']){
      beginLunaStroke(key);
      const arrival=S.lunaMotion.t+(S.lunaMotion.frames.length-1)*lunaFrameMs;
      if(lunaStrokePulse(arrival+80)<=0||lunaStrokePulse(arrival+500)!==0)throw Error('Stroke effect must pulse once at the arrival pose');
      S.lunaMotion.t-=1000;frames.push(lunaStrokeFrame(GT));
      if(lunaStrokeFrame(GT)!==lunaStrokeFrame(GT+5000))throw Error('Pose must hold until the next input');
    }
    S.lunaMotion=null;return frames;
  });
  assert.deepEqual(poses,[6,0,2,4,6],'D and E use the supplied low/high extension cels and A returns to the chest');
  await f.evaluate(()=>{
    const hit=ShakeLabAudio.hit;let count=0;
    ShakeLabAudio.hit=()=>count++;
    window.readHits=()=>{ShakeLabAudio.hit=hit;return count};
  });
  for(const key of ['D','A']){
   await f.waitForFunction(k=>readyShakeKey(GT)===k,key);
   await p.keyboard.press('Key'+key);
  }
  assert.equal(await f.evaluate(()=>readHits()),2,'One sound per accepted direction');
  for(const key of ['E','A']){
   await f.waitForFunction(k=>readyShakeKey(GT)===k,key);await p.keyboard.press('Key'+key);await p.waitForTimeout(300);
   const motion=await f.evaluate(()=>({angle:shakerXf().a,ice:S.ices.reduce((s,o)=>s+o.x,0)/S.ices.length,water:S.h.reduce((s,h,i)=>s+h*(B.CH.x0+i*B.PX),0)/S.h.reduce((s,h)=>s+h,0),impact:Math.max(...S.ices.map(o=>o.wallSpeed||0))}));
   const sign=key==='A'?-1:1;
   assert.ok((key==='A'?Math.abs(motion.angle)<.02:motion.angle<-.15)&&motion.ice*sign>0&&motion.water*sign>0,key+' reaches its pose and sends the contents toward the selected side');
   assert.ok(motion.impact>500,key+' produces a strong wall impact');
  }
  await f.evaluate(()=>{audio();});await p.waitForTimeout(200);
  // Version 2 always uses recording 2, regardless of legacy preferences.
  await f.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/shaker_02_hit.wav')));
  await f.evaluate(()=>ShakeLabAudio.hit());
  assert.equal(await f.evaluate(()=>document.body.dataset.lastSound),'shaker_02_hit.wav');
  assert(!await f.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/shaker_01_hit.wav'))));
  await f.evaluate(()=>{toggleSettings(true);});
  const paused=await f.evaluate(()=>({time:GT,round:S.round}));await p.waitForTimeout(200);
  assert.deepEqual(await f.evaluate(()=>({time:GT,round:S.round})),paused);
  await f.locator('#sBack').click();
  // Exercise every pattern, including the four-key sour rounds, through real keyboard input.
  for(const [recipe,lo,hi,slots,score] of [['daiquiri',-9.5,-8,1,92],['fizz',11,12,2,97],['sour',5.5,7,3,100]]){
   await f.evaluate(id=>{R=RECIPES.find(r=>r.id===id);reset()},recipe);
   assert.equal(await f.locator('#luna-feed').isVisible(),false,'Retry returns the monitor to standby');
   await f.locator('#tutNext').click();await f.locator('#tutNext').click();
   await f.waitForFunction(([lo,hi])=>S.angDeg>=lo&&S.angDeg<=hi,[lo,hi]);await p.keyboard.press('Space');
   await f.waitForFunction(()=>S.phase==='shake');assert.equal(await f.evaluate(()=>S.dur),slots);
   assert.equal(await f.locator('#seal-notice').isVisible(),false,'Readout clears before A/D play');
   const iceCheck=await f.evaluate(()=>{
    const C=B.CH,coverage=S.ices.reduce((a,o)=>a+4*o.size*o.size,0)/((C.seam-C.x0)*(C.left+C.middle)+(C.x1-C.seam)*(C.middle+C.right));
    for(let i=0;i<600;i++){stepWater(1/240,Math.sin(i*.09)*2800,900);stepIces(1/240,Math.sin(i*.09)*2800,900);}
    return{coverage,valid:S.ices.every(o=>{const e=o.size*(Math.abs(Math.cos(o.rot))+Math.abs(Math.sin(o.rot)));return[o.x,o.y,o.rot,o.vx,o.vy].every(Number.isFinite)&&o.x-e>=C.x0-.01&&o.x+e<=C.x1+.01&&Math.abs(o.y)+e<=Math.min(halfHeight(o.x-e),halfHeight(o.x+e))+.01})};
   });
   assert.ok(Math.abs(iceCheck.coverage-.25)<1e-6,'Ice fills 25% of the cutaway area');assert.ok(iceCheck.valid,'Large ice remains finite and inside the shaker under strong alternating acceleration');
   let strokes=0;
   for(let round=0;round<10;round++){
    const seq=await f.evaluate(()=>{S.roundT=GT;return S.seq;});
    const count=recipe==='sour'&&round%2===1?4:2;
    assert.equal(seq,'DAEADAEA'.slice(strokes%4,strokes%4+count));strokes+=count;
    for(const key of seq){await f.waitForFunction(k=>readyShakeKey(GT)===k,key);await p.keyboard.press('Key'+key);}
   }
   await f.waitForFunction(()=>S.phase==='unseal');
   const ending=await f.evaluate(()=>{
    const water=drawWater,ice=drawIcePx;let calls=0;drawWater=drawIcePx=()=>calls++;drawShaker(GT);drawWater=water;drawIcePx=ice;
    return{calls,angle:shakerView(S.unseal.t+1400).a,zoom:shakerView(S.unseal.t+1400).zoom};
   });
   assert.equal(ending.calls,0,'Successful ending immediately hides the cutaway');
   assert.equal(ending.angle,Math.PI/2);assert.equal(ending.zoom,1);
   const fade=await f.evaluate(()=>[1750,1880,2000,2999].map(age=>unsealPresentation(S.unseal.t+age).alpha));
   assert.deepEqual(fade,[1,.5,0,0],'Upper tin fades after separation and remains hidden during the one-second hold');
   await f.evaluate(()=>toggleSettings(true));const endTime=await f.evaluate(()=>GT);await p.waitForTimeout(150);assert.equal(await f.evaluate(()=>GT),endTime);await f.locator('#sBack').click();
   await f.waitForFunction(()=>S.phase==='unseal'&&GT-S.unseal.t>=2100);
   assert.equal(await f.evaluate(()=>document.body.dataset.lastSound),'shake-complete.wav','Opening the tin plays no additional cue');
   const motion=await f.evaluate(()=>{
    const start=S.unseal.t;
    return [shakerView(start+640).a,shakerView(start+850).a,unsealPresentation(start+1400),unsealPresentation(start+1740)];
   });
   assert.equal(motion[0],motion[1],'The joined tins pause on the diagonal');
   assert.equal(motion[2].y,0);assert.ok(motion[3].y>30&&motion[3].angle>0,'Upper tin releases upward and sideways');
   assert.equal(await f.locator('#res').isVisible(),false,'No result while lower tin holds alone');
   await f.waitForFunction(()=>S.phase==='done');
   assert.equal(await f.locator('#rsScore').textContent(),String(score));
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
  const shutdown=await f.locator('#luna-feed').evaluate(el=>{
    const style=getComputedStyle(el);return [style.animationName,style.animationDirection];
  });
  assert.deepEqual(shutdown,['monitor-open','reverse']);
  assert.deepEqual(await f.evaluate(()=>({phase:S.phase,water:S.h,ice:S.ices.length,drops:S.drops2.length})),{phase:'pop',water:null,ice:0,drops:0});
  assert.ok(await f.evaluate(()=>S.fx.filter(p=>p.k==='liquid').length>=64),'Final failure bursts liquid outside the opaque shell');
  const flow=await f.evaluate(()=>{const t=S.pop.t;update(t+400,100);return{count:S.fx.filter(p=>p.k==='liquid').length,gravity:S.fx.every(p=>p.k!=='liquid'||p.g>0)}});
  assert.ok(flow.count>64&&flow.gravity,'Liquid continues to drain and falls under gravity');
  const hiddenContents=await f.evaluate(()=>{const water=drawWater,ice=drawIcePx;let calls=0;drawWater=drawIcePx=()=>calls++;drawShaker(GT);drawWater=water;drawIcePx=ice;return calls});
  assert.equal(hiddenContents,0,'Detached tin does not render liquid or ice');
  await f.locator('#seal-notice[data-failed]').waitFor();
  assert.equal(await f.locator('#luna-feed').isVisible(),false);
  assert.deepEqual(await f.locator('#seal-notice .seal-readout > *').allTextContents(),['SHAKE FAILED','SEAL BROKEN']);
  assert.equal(await f.locator('#seal-notice').evaluate(el=>getComputedStyle(el).color),'rgb(255, 105, 121)');
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

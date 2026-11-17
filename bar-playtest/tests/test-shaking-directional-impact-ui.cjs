const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/src/dev/shaking/version-2.html');
  await page.locator('#tutNext').click();await page.locator('#tutNext').click();
  await page.evaluate(()=>{S.angDeg=5;press('Space');});
  assert.deepEqual(await page.evaluate(()=>S.fx.map(f=>f.k)),['ring'],'Sealing shows only the impact ring');
  await page.waitForFunction(()=>S.phase==='shake');
  // Count the actual keycaps and labels, including any inactive remnants.
  await page.evaluate(()=>{
   window.strokeSnapshot=()=>{
    const original=ctx.fillText,rect=ctx.roundRect,lit=[];let caps=0;
    ctx.fillText=function(txt,...args){
     if(['A','D','E'].includes(txt))lit.push(txt);
     return original.call(this,txt,...args);
    };
    ctx.roundRect=function(...args){caps++;return rect.apply(this,args);};
    try{drawKeys(GT);}finally{ctx.fillText=original;ctx.roundRect=rect;}
    if(caps!==lit.length)throw Error('Orphaned keycap');
    return [lit,S.tx,S.k,S.round,S.misses,S.texts.at(-1)?.txt,S.phase];
   };
  });
  assert.deepEqual((await page.evaluate(()=>strokeSnapshot()))[0],['D']);
  await page.keyboard.press('KeyD');await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await page.evaluate(()=>strokeSnapshot()),[[],62,1,0,1,'너무 빨라..','shake']);
  await page.waitForFunction(()=>!S.strokeMoving);
  assert.deepEqual(await page.evaluate(()=>[strokeSnapshot()[0],S.px,S.py]),[['A'],62,44]);
  await page.keyboard.press('KeyA');await page.keyboard.press('KeyD');
  assert.deepEqual(await page.evaluate(()=>strokeSnapshot()),[[],-62,0,1,2,'너무 빨라..','shake']);
  await page.waitForFunction(()=>!S.strokeMoving);
  const box=await page.locator('#cv').boundingBox();
  await page.mouse.click(box.x+box.width*.8,box.y+box.height*.35);
  assert.deepEqual(await page.evaluate(()=>[S.tx,S.ty,S.lunaMotion.frames.at(-1)]),[62,-44,2]);
  await page.mouse.click(box.x+box.width*.2,box.y+box.height/2);
  assert.equal(await page.evaluate(()=>S.phase),'pop');
  await page.evaluate(()=>reset());
  await page.locator('#tutNext').click();await page.locator('#tutNext').click();
  await page.evaluate(()=>{S.angDeg=5;press('Space');});await page.waitForFunction(()=>S.phase==='shake');
  // Both duplicate keys still incur a MISS, without advancing either animation.
  for(const key of ['D','A']){
   await page.waitForFunction(k=>readyShakeKey(GT)===k,key);
   await page.keyboard.press('Key'+key);
   await page.waitForFunction(()=>!S.strokeMoving);
   const snapshot=()=>page.evaluate(()=>[S.lunaMotion.t,S.strokeIndex,S.kickT,S.tx,S.ty]);
   const settled=await snapshot();
   await page.keyboard.press('Key'+key);
   assert.deepEqual(await snapshot(),settled);
   assert.equal(await page.evaluate(()=>S.texts.at(-1).txt),'MISS');
  }
  await page.waitForFunction(()=>!S.pending);
  for(const pattern of ['DA','EADA']){
   await page.evaluate(pattern=>{S.seq=pattern;S.k=0;S.round=0;S.combo=0;S.mix=0;S.chill=0;},pattern);
   for(let i=0;i<pattern.length;i++){
    await page.waitForFunction(key=>readyShakeKey(GT)===key,pattern[i]);
    assert.deepEqual(await page.evaluate(()=>strokeSnapshot()[0]),[pattern[i]]);
    await page.evaluate(()=>{S.roundT=GT;S.fx=[];S.texts=[];});
    await page.keyboard.press('Key'+pattern[i]);
    const state=await page.evaluate(()=>({rings:S.fx.filter(f=>f.k==='ring'),particles:S.fx.filter(f=>f.k!=='ring').length,texts:S.texts,round:S.round,combo:S.combo,mix:S.mix}));
    assert.equal(state.rings.length,1,'Exactly one impact per valid key, including round completion');
    assert.equal(state.particles,0,'Sealed shaker has no external fragments');
    assert.equal(state.texts.length,1);
    assert.equal(state.texts[0].txt,'SHAKE!');
    // Check the painted locations while the same effect travels between both poses.
    const samples=await page.evaluate(key=>{
     const oldX=S.px,shake=OPT.shake,arc=ctx.arc,fillText=ctx.fillText;
     const rendered=[];OPT.shake=false;
     try{
      for(const [x,age] of [[-B.TRAVEL,100],[B.TRAVEL,340]]){
       S.px=x;
       const base=key==='A'?-186*shakerPixel:188*shakerPixel,[ex,ey]=toWorld(base,0);
       let ring,label;
       ctx.arc=function(ax,ay,r,...args){if(r<60)ring=[ax,ay];return arc.call(this,ax,ay,r,...args);};
       ctx.fillText=function(txt,...args){if(txt==='SHAKE!'){const pose=this.getTransform(),d=cv.width/W;label=[pose.e/d,pose.f/d,this.globalAlpha];}return fillText.call(this,txt,...args);};
       draw(S.fx[0].t+age);rendered.push({ex,ey,ring,label});
      }
     }finally{S.px=oldX;OPT.shake=shake;ctx.arc=arc;ctx.fillText=fillText;}
     return rendered;
    },pattern[i]);
    for(const {ring,label,ex,ey} of samples){
     assert.ok(Math.hypot(ring[0]-ex,ring[1]-ey)<.1,'Ring centered on the pressed tin base');
     assert.ok(label[0]>45&&label[0]<880-45,'Word fits inside the playfield');
    }
    assert.equal(samples[0].label[0],samples[1].label[0],'Word does not follow the moving tin');
    assert.ok(samples[0].label[1]>samples[1].label[1]&&samples[0].label[2]>samples[1].label[2],'Word rises and fades');
    assert.equal(state.round,i===pattern.length-1?1:0);
    assert.equal(state.combo,state.round);
    if(!state.round)assert.equal(state.mix,0,'A feedback must not award round progress');
    if(pattern==='DA'){
     await page.waitForTimeout(70);
     await page.screenshot({path:'/private/tmp/shake-impact-'+pattern[i]+'.png'});
    }
   }
  }
  await page.waitForFunction(()=>!S.strokeMoving);
  const last=await page.evaluate(()=>{S.seq='DA';S.k=1;S.round=R.rounds-1;S.roundT=GT;S.fx=[];S.texts=[];press('A');return{phase:S.phase,rings:S.fx.filter(f=>f.k==='ring').length};});
  assert.deepEqual(last,{phase:'shake',rings:1},'Final A travels to its endpoint');
  await page.waitForFunction(()=>S.phase==='unseal' && S.px===S.tx);
  const late=await page.evaluate(()=>{S.phase='shake';S.seq='DA';S.k=0;S.round=0;S.roundT=GT-win()*.6;S.texts=[];press('D');return S.texts.map(t=>t.txt);});
  assert.deepEqual(late,['SHAKE!']);
  await page.waitForFunction(()=>!S.strokeMoving);
  const wrong=await page.evaluate(()=>{S.phase='shake';S.strokeIndex=2;S.seq='EA';S.k=0;S.waitT=0;S.pending=false;S.round=0;S.misses=0;S.dur=3;S.fx=[];S.texts=[];press('A');return{rings:S.fx.filter(f=>f.k==='ring').length,labels:S.texts.map(t=>t.txt),misses:S.misses};});
  assert.deepEqual(wrong,{rings:0,labels:['MISS'],misses:1});
  await page.waitForFunction(()=>!S.pending);
  const timeout=await page.evaluate(()=>{
   S.dur=2;S.misses=1;S.texts=[];S.roundT=GT-win()-1;
   const wanted=readyShakeKey(GT),round=S.round;
   update(GT,0);
   return {label:S.texts.map(t=>t.txt),misses:S.misses,timeouts:S.timeouts,phase:S.phase,
     result:S.res.at(-1),advanced:S.round===round+1,wanted};
  });
  assert.deepEqual(timeout,{label:['MISS'],misses:1,timeouts:1,phase:'shake',result:'M',advanced:true,wanted:'E'});
  await page.waitForFunction(()=>readyShakeKey(GT)==='E');
  await page.keyboard.press('KeyD');
  assert.equal(await page.evaluate(()=>S.phase),'pop','D cannot replace E on the upper stroke');
  const colors=await page.evaluate(()=>[0,.249999,.25,.499999,.5,.749999,.75,1].map(gaugeColor));
  assert.deepEqual(colors,['rgba(240,250,255,.95)','rgba(240,250,255,.95)','#b7ee55','#b7ee55','#ff993d','#ff993d','#ff4b4b','#ff4b4b']);
  // Sample the painted upper and lower contours. Dimmed pixels must match an empty track.
  const wipe=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=360;canvas.height=110;
   const c=canvas.getContext('2d',{willReadFrequently:true});c.translate(180,55);
   function paint(elapsed){c.fillStyle='#09151c';c.fillRect(-180,-55,360,110);drawDurabilityGauge(c,elapsed,3,0);return c.getImageData(0,0,360,110).data;}
   const empty=paint(1);
   return [0,.25,.5,.75].map(elapsed=>{
    const pixels=paint(elapsed),ends=[-1,-1],peaks=[0,0,0];
    for(let y=10;y<100;y++){
     if(Math.abs(y-55)<23)continue;
     for(let x=0;x<360;x++){const i=4*(y*360+x);
      if(pixels[i]+pixels[i+1]-empty[i]-empty[i+1]<100)continue;
      ends[Number(y>55)]=Math.max(ends[Number(y>55)],x);
      for(let j=0;j<3;j++)peaks[j]=Math.max(peaks[j],pixels[i+j]);
     }
    }
    return {ends,peaks};
   });
  });
  for(const [i,frame] of wipe.entries()){
   assert(frame.ends.every(x=>Math.abs(x-(340-80*i))<4),`Contour ends at quarter ${i}: ${frame.ends}`);
  }
  assert(wipe[0].peaks.every(c=>c>215));assert(wipe[1].peaks[1]>wipe[1].peaks[0]);
  assert(wipe[2].peaks[0]>wipe[2].peaks[1]);assert(wipe[3].peaks[1]<wipe[2].peaks[1]);
  await page.evaluate(()=>reset());
  await page.locator('#tutNext').click();await page.locator('#tutNext').click();
  await page.keyboard.press('Space');await page.waitForFunction(()=>readyShakeKey(GT)==='D');
  await page.evaluate(()=>setPause(true));
  const layouts=await page.evaluate(()=>{
   const text=ctx.fillText,fill=ctx.fillRect,stroke=ctx.strokeRect,rows=[];
   try{for(const dur of [1,2,3])for(let misses=0;misses<=dur;misses++){
    S.dur=dur;S.misses=misses;S.closeQ='P';let label;const pips=[];
    ctx.fillText=function(value,x,y){if(value==='결합 내구도')label={x,width:this.measureText(value).width};return text.apply(this,arguments);};
    ctx.fillRect=function(x,y,w,h){if(y===-10&&w===20&&h===20)pips.push({x,color:this.fillStyle});return fill.apply(this,arguments);};
    ctx.strokeRect=function(x,y,w,h){if(y===-9&&w===18&&h===18)pips.push({x:x-1,color:this.strokeStyle});return stroke.apply(this,arguments);};
    drawGauge(GT);rows.push({label,pips,dur,misses,center:0});
   }}finally{ctx.fillText=text;ctx.fillRect=fill;ctx.strokeRect=stroke;}
   return rows;
  });
  for(const row of layouts){
   assert.deepEqual(row.pips.map(p=>p.color),[
    ...Array(row.dur-row.misses).fill('#7be3a4'),...Array(row.misses).fill('#ff6a6a'),...Array(3-row.dur).fill('#41535c')
   ]);
   assert.ok(Math.abs((row.label.x+row.pips.at(-1).x+20)/2-row.center)<.01,'All three durability slots stay centered');
  }
  for(const [i,elapsed]of [0,.25,.5,.75].entries()){
   await page.evaluate(elapsed=>{S.roundT=GT-elapsed*win();draw(GT);},elapsed);
   await page.screenshot({path:'/private/tmp/shake-gauge-quarter-'+i+'.png'});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS directional impacts and progress; quarter-time white/lime/orange/red gauge with matching glow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

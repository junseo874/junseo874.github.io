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
  for(const pattern of ['AD','ADAD']){
   await page.evaluate(pattern=>{S.seq=pattern;S.k=0;S.round=0;S.combo=0;S.mix=0;S.chill=0;},pattern);
   for(let i=0;i<pattern.length;i++){
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
       const base=key==='A'?-250:248,[ex,ey]=toWorld(base,0);
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
    if(pattern==='AD'){
     await page.waitForTimeout(70);
     await page.screenshot({path:'/private/tmp/shake-impact-'+pattern[i]+'.png'});
    }
   }
  }
  const last=await page.evaluate(()=>{S.seq='AD';S.k=1;S.round=R.rounds-1;S.roundT=GT;S.fx=[];S.texts=[];press('D');return{phase:S.phase,rings:S.fx.filter(f=>f.k==='ring').length};});
  assert.deepEqual(last,{phase:'unseal',rings:1},'Final D impact survives the transition');
  const late=await page.evaluate(()=>{S.phase='shake';S.seq='AD';S.k=0;S.round=0;S.roundT=GT-win()*.6;S.texts=[];press('A');return S.texts.map(t=>t.txt);});
  assert.deepEqual(late,['SHAKE!']);
  const wrong=await page.evaluate(()=>{S.phase='shake';S.seq='AD';S.k=0;S.waitT=0;S.pending=false;S.round=0;S.misses=0;S.dur=2;S.fx=[];S.texts=[];press('D');return{rings:S.fx.filter(f=>f.k==='ring').length,labels:S.texts.map(t=>t.txt),misses:S.misses};});
  assert.deepEqual(wrong,{rings:0,labels:['MISS'],misses:1});
  const timeout=await page.evaluate(()=>{S.pending=false;S.waitT=0;S.texts=[];S.roundT=GT-win()-1;update(GT,0);return S.texts.map(t=>t.txt);});
  assert.deepEqual(timeout,['MISS'],'Timeout at the last safe miss shows a single label');
  const colors=await page.evaluate(()=>[0,.249999,.25,.499999,.5,.749999,.75,1].map(gaugeColor));
  assert.deepEqual(colors,['rgba(240,250,255,.95)','rgba(240,250,255,.95)','#b7ee55','#b7ee55','#ff993d','#ff993d','#ff4b4b','#ff4b4b']);
  // Inspect the actual stroked gauge and glow at each boundary, not only the helper.
  const strokes=await page.evaluate(()=>{
   setPause(true);S.phase='shake';S.round=0;S.seq='AD';S.k=0;S.waitT=0;S.pending=false;S.flash=0;S.label=null;S.fx=[];S.texts=[];
   const original=ctx.stroke,colors=[];
   ctx.stroke=function(...args){if(this.getLineDash().length)colors.push({line:this.strokeStyle,glow:this.shadowColor});return original.apply(this,args);};
   try{for(const elapsed of [0,.25,.5,.75]){S.roundT=GT-elapsed*win();drawGauge(GT);}}finally{ctx.stroke=original;}
   return colors;
  });
  assert.equal(strokes.length,4);assert(strokes.every(s=>s.line===s.glow));
  assert.deepEqual(strokes.slice(1).map(s=>s.line),['#b7ee55','#ff993d','#ff4b4b']);
  const layouts=await page.evaluate(()=>{
   const text=ctx.fillText,rect=ctx.fillRect,rows=[];
   try{for(const durability of [0,1,2]){
    S.dur=durability;S.misses=0;S.closeQ='P';let label,hint,pips=[];
    ctx.fillText=function(value,x,y,...rest){if(value==='결합 내구도')label={x,y,width:this.measureText(value).width};if(value.includes('버틴다')||value.includes('빠진다'))hint={x,y,align:this.textAlign};return text.call(this,value,x,y,...rest);};
    ctx.fillRect=function(x,y,w,h){if(y===CAP.y-72&&w===20&&h===20)pips.push({x,y,w,h});return rect.call(this,x,y,w,h);};
    drawKeys(GT);rows.push({label,hint,pips,center:CAP.x+CAP.w/2,top:CAP.y});
   }}finally{ctx.fillText=text;ctx.fillRect=rect;}
   return rows;
  });
  for(const [i,row]of layouts.entries()){
   assert.equal(row.pips.length,i+1);
   assert.ok(Math.abs((row.label.x+row.pips.at(-1).x+20)/2-row.center)<.01,'Whole seam row is centered');
   assert.equal(row.hint,undefined,'Durability is shown using pips only');
  }
  for(const [i,elapsed]of [0,.25,.5,.75].entries()){
   await page.evaluate(elapsed=>{S.roundT=GT-elapsed*win();draw(GT);},elapsed);
   await page.screenshot({path:'/private/tmp/shake-gauge-quarter-'+i+'.png'});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS directional impacts and progress; quarter-time white/lime/orange/red gauge with matching glow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

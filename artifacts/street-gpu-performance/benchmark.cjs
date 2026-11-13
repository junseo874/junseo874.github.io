// Run alone, with the local server on 8123. No rendering-quality overrides.
// STREET_BASELINE_REF=<commit> measures that revision's six effect/view files.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),rt=require(root+'/tools/lib/test-runtime.cjs');
const ref=process.env.STREET_BASELINE_REF,label=ref?'before':'after';
const summary=a=>{a.sort((a,b)=>a-b);return{mean:a.reduce((s,v)=>s+v,0)/a.length,median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};};
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
 await p.addInitScript(()=>{let s=753;Math.random=()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};});
 if(ref)for(const file of ['street-atmosphere-renderer.js','rain-glass-renderer.js','rain-glass-simulation.js','outside-rain-glass.js','street-atmosphere.js','outside-view.js']){
  const filePath='src/features/outside/'+(file==='outside-view.js'?'':'effects/')+file;
  const body=execFileSync('git',['show',ref+':bar-playtest/'+filePath],{cwd:root,encoding:'utf8'});
  await p.route('**/'+filePath+'*',route=>route.fulfill({contentType:'application/javascript',body}));
 }
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();window.perfTick=outsidePlaytest.tick;outsidePlaytest.tick=()=>{};});
 const cd=await p.context().newCDPSession(p),rows=[];
 for(const rate of (process.env.STREET_CPU_RATES||'1,4').split(',').map(Number)){await cd.send('Emulation.setCPUThrottlingRate',{rate});
  for(const [name,x,day]of [['shops',-2,3],['camp',-15.7,3],['dry',-2,2]]){
   await p.evaluate(({x,day})=>{const o=outsidePlaytest,m=o.model;m.start({day,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();Object.assign(m,{x,y:-.7,level:0,controlsTutorial:false});o.snapCamera();perfTick(0);},{x,day});
   const data=await p.evaluate(async gpuTimers=>{
    const o=outsidePlaytest,m=o.model,queries=[],gpu={},durations=[],intervals=[],positions=[],transfers={scene:0,rain:0};
    const r=LunaStreetAtmosphere.inspect(m).renderer,rr=LunaRainGlass.inspect(document.querySelector('#outside-root canvas'))?.renderer;
    let measured=false;
    // Queries are sequential even when the renderers share one GL context.
    const original=[];for(const [renderer,names]of [[r,['fog','puddles','characterShadow','post']],...(rr?[[rr,['maps','render']]]:[])]){
     const g=renderer.gl,e=gpuTimers&&g.getExtension('EXT_disjoint_timer_query_webgl2');
     for(const name of names){const f=renderer[name];original.push(()=>renderer[name]=f);renderer[name]=function(...args){if(!measured||!e)return f.apply(this,args);const q=g.createQuery();g.beginQuery(e.TIME_ELAPSED_EXT,q);const result=f.apply(this,args);g.endQuery(e.TIME_ELAPSED_EXT);queries.push({q,g,e,name});return result;};}
    }
    const f=r.upload;original.push(()=>r.upload=f);r.upload=function(t,c){if(measured&&t===this.scene)transfers.scene++;return f.apply(this,arguments);};
    if(rr){const g=rr.gl,f=g.texImage2D;original.push(()=>g.texImage2D=f);g.texImage2D=function(...args){if(measured&&args.at(-1)===document.querySelector('#outside-root canvas')&&g.getParameter(g.TEXTURE_BINDING_2D)===rr.source)transfers.rain++;return f.apply(this,args);};}
    let previous=0;
    for(let i=0;i<160;i++){
     // Real input, model updates, camera follow and animated effects run together.
     const direction=Math.floor(i/40)%2?'ArrowLeft':'ArrowRight';
     if(i%40===0){for(const key of ['ArrowLeft','ArrowRight'])window.dispatchEvent(new KeyboardEvent('keyup',{code:key}));window.dispatchEvent(new KeyboardEvent('keydown',{code:direction}));}
     const now=await new Promise(requestAnimationFrame);measured=i>=40;
     if(measured)intervals.push(now-previous);previous=now;
     const t=performance.now();perfTick(1/60);if(measured){durations.push(performance.now()-t);positions.push(m.x);}
    }
    for(const key of ['ArrowLeft','ArrowRight'])window.dispatchEvent(new KeyboardEvent('keyup',{code:key}));
    measured=false;await new Promise(resolve=>setTimeout(resolve,250));
    for(const {q,g,e,name}of queries){if(!g.getParameter(e.GPU_DISJOINT_EXT)&&g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE))(gpu[name]??=[]).push(g.getQueryParameter(q,g.QUERY_RESULT)/1e6);g.deleteQuery(q);}
    for(const restore of original)restore();
    return{durations,intervals,gpu,transfers,movement:Math.max(...positions)-Math.min(...positions),error:LunaStreetAtmosphere.inspect(m).error,gl:r.gl.getError(),pixels:[r.canvas.width,r.canvas.height]};
   },process.env.STREET_GPU_TIMERS!=='0');
   if(data.movement<.05)throw Error(name+' did not move; benchmark is invalid');
   const row={name,rate,cpu:summary(data.durations),frame:summary(data.intervals),gpu:Object.fromEntries(Object.entries(data.gpu).map(([k,v])=>[k,{count:v.length,...summary(v)}])),transfers:data.transfers,movement:data.movement,error:data.error,gl:data.gl,pixels:data.pixels};
   row.effectGpuMs=Object.keys(data.gpu).length?Object.values(data.gpu).flat().reduce((s,v)=>s+v,0)/data.durations.length:null;
   rows.push(row);console.log(label,JSON.stringify(row));
  }
 }
 fs.writeFileSync(path.join(__dirname,label+'.json'),JSON.stringify({baseline:ref||null,rows},null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});

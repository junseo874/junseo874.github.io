/* Opt-in local Chrome GPU audit, not a timing assertion in the regression suite.
 * node bar-playtest/tools/profile-outside-rendering.cjs [URL] [DPR=2]
 * Optional BASELINE_EFFECTS_DIR serves saved renderer/shadow sources for A/B.
 */
const fs=require('node:fs'),path=require('node:path'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const cdp=await browser.newBrowserCDPSession(),info=await cdp.send('SystemInfo.getInfo');
 const dpr=Number(process.argv[3])||2,page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.BASELINE_EFFECTS_DIR)for(const file of ['street-atmosphere-renderer.js','character-shadows.js']){
  const body=fs.readFileSync(path.join(process.env.BASELINE_EFFECTS_DIR,file),'utf8');await page.route('**/effects/'+file+'*',route=>route.fulfill({contentType:'application/javascript',body}));
 }
 await page.goto(process.argv[2]||'http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const result=await page.evaluate(async()=>{
  const o=outsidePlaytest,m=o.model,tick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=-2;o.snapCamera();
  const queries=[],cpu=[],intervals=[],stats={},p=LunaStreetAtmosphereRenderer.prototype,r=LunaRainRenderer.Renderer.prototype;
  const targets=[...['fog','puddles','shafts','characterShadow','post'].map(k=>[p,k]),...['maps','render'].map(k=>[r,k])],original=targets.map(([obj,k])=>obj[k]);let recording=false;
  targets.forEach(([obj,k],i)=>obj[k]=function(...args){
   const gl=this.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   if(!recording||!ext)return original[i].apply(this,args);
   const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const value=original[i].apply(this,args);gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push({gl,ext,q,k});return value;
  });
  let previous;
  try{for(let i=0;i<100;i++){
   const now=await new Promise(requestAnimationFrame);recording=i>=20&&i<80;m.time+=1/60;const start=performance.now();tick(0);
   if(recording){cpu.push(performance.now()-start);intervals.push(now-previous);}previous=now;
  }}finally{targets.forEach(([obj,k],i)=>obj[k]=original[i]);}
  let rejected=0;for(const {gl,ext,q,k}of queries){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT))(stats[k]??=[]).push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);else rejected++;gl.deleteQuery(q);}
  const summarize=a=>{a.sort((a,b)=>a-b);return {samples:a.length,median:a[Math.floor(a.length*.5)],p90:a[Math.floor(a.length*.9)],mean:a.reduce((a,b)=>a+b,0)/a.length};};
  const gpu={};for(const [k,v]of Object.entries(stats))gpu[k]=summarize(v);
  const renderer=LunaStreetAtmosphere.inspect(m).renderer;
  return {physicalSize:[renderer.canvas.width,renderer.canvas.height],raining:LunaOutsideRain.enabled(m),gpuTimerAvailable:!!renderer.gl.getExtension('EXT_disjoint_timer_query_webgl2'),rejectedQueries:rejected,gpuMilliseconds:gpu,cpuSubmissionMilliseconds:summarize(cpu),rafMilliseconds:summarize(intervals)};
 });
 console.log(JSON.stringify({devices:info.gpu.devices,dpr,...result,errors},null,2));if(errors.length)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

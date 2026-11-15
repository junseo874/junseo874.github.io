const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(process.env.BASELINE_ANCHOR)await p.route('**/events/outside-ambient.js?*',route=>route.fulfill({contentType:'application/javascript',body:require('node:child_process').execFileSync('git',['show','HEAD:bar-playtest/src/features/outside/events/outside-ambient.js'],{encoding:'utf8'})}));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});await outsidePlaytest.start();});
 const result=await p.evaluate(()=>{
  const o=outsidePlaytest,m=o.model;window.step=o.tick;o.tick=()=>{};m.tick=()=>{};m.x=-2.87;m.controlsTutorial=false;m.updateNear();LunaOutsideShop.openStock(m,m.near);m.story.speech.elapsed=99;o.snapCamera();
  const poses=[],rects=[],frames=new Set();
  for(let i=0;i<180;i++){m.time=i/30;step(0);const v=m.story.view();if(v?.anchor)poses.push(v.anchor);const el=document.querySelector('.outside-speech');const box=el.getBoundingClientRect();rects.push([box.x,box.y]);frames.add(m.engineActorViews.find(p=>p.engineActor?.role==='shiba')?.sp.x);}
  const variants=[];
  for(const [name,a]of Object.entries(LUNA_OUTSIDE_DATA.animations)){if(!a.frames.length)continue;const pts=a.frames.map(sp=>LunaOutsideAmbient.head(sp,1,2));if(pts.some(p=>p))variants.push({name,stable:pts.every(p=>JSON.stringify(p)===JSON.stringify(pts[0]))});}
  return{poses,rects,frames:frames.size,variants};
 });
 assert(result.frames>1,'actual Shiba animation advances');assert(result.poses.length===180);assert(result.poses.every(p=>JSON.stringify(p)===JSON.stringify(result.poses[0])),'world speech anchor stays fixed throughout animation');assert(result.rects.every(p=>JSON.stringify(p)===JSON.stringify(result.rects[0])),'actual DOM bubble stays fixed');assert(result.variants.every(v=>v.stable),JSON.stringify(result.variants));
 await p.screenshot({path:'/tmp/shiba-speech-stable.png'});assert.deepEqual(errors,[]);console.log('SHIBA_SPEECH_STABLE_OK',result.frames,'frames;',result.variants);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

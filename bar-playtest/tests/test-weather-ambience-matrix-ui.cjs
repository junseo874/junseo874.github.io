const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();});
 for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const place of ['bar','home']){
  await p.evaluate(({day,flow,place})=>{const a=outsidePlaytest,m=a.model;m.start({day,flow,place});m.paused=true;m.controlsTutorial=false;m.time=2.5;a.snapCamera();a.tick(0);},{day,flow,place});
  await p.waitForTimeout(100);
  const wet=day===1||day===3||day===0&&flow==='out'||day===2&&flow==='in',street=place==='bar';
  const result=await p.evaluate(()=>{const m=outsidePlaytest.model,s=LunaStreetAudio.state;return {wet:LunaOutsideRain.wet(m),rain:LunaOutsideRain.particles(m,{x:m.x,y:m.y+.8,w:4.8}).drops.length>0,city:s.target>0,rainAudio:s.rain.target>0,house:s.house.target>0,failed:s.failed||s.rain.failed||s.house.failed};});
  assert.deepEqual(result,{wet,rain:street&&wet,city:street,rainAudio:street&&wet,house:!street&&wet,failed:false},day+'/'+flow+'/'+place);cases.push({day,flow,place});
 }
 // Visible terrace and sound must inherit the same route, not the hidden room.
 for(const day of [0,1,2,3])for(const flow of ['in','out']){
  await p.evaluate(({day,flow})=>{const c=lunaCampaign;c.screen('developer');outsidePlaytest.model.start({day,flow,place:'home'});outsidePlaytest.model.paused=true;c.session.day=day;c.scene([{actor:'luna',text:'날씨와 환경음 확인'}],'검수','terrace',()=>c.screen('developer'));},{day,flow});
  await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&document.querySelector('.terrace-rain'));
  await p.waitForTimeout(120);
  const wet=day===1||day===3||day===0&&flow==='out'||day===2&&flow==='in';
  const state=await p.evaluate(()=>{const c=document.querySelector('.terrace-rain'),s=LunaStreetAudio.state;return {rain:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0),audio:s.rain.target>0,city:s.target>0,house:s.house.target>0};});
  assert.deepEqual(state,{rain:wet,audio:wet,city:true,house:false},day+'/'+flow+'/terrace');
  cases.push({day,flow,place:'terrace'});
 }
 await p.evaluate(()=>{lunaCampaign.screen('loading');});await p.waitForTimeout(100);
 assert(await p.evaluate(()=>{const s=LunaStreetAudio.state;return !s.target&&!s.rain.target&&!s.house.target;}),'No ambience leaking into loading');
 assert.deepEqual(errors,[]);console.log('WEATHER_AMBIENCE_MATRIX_OK',cases.length,'day/route/place cases, terrace rain pixels/audio, indoor/outdoor separation, loading silence');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

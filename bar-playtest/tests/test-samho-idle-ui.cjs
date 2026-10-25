const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'in',place:'bar'});await outsidePlaytest.start();});
 const report=await p.evaluate(()=>{
  const a=outsidePlaytest,m=a.model,D=LUNA_OUTSIDE_DATA,anim=D.animations.samhoIdle,records=[];
  const ctx=document.querySelector('#outside-root canvas').getContext('2d'),original=ctx.drawImage;
  function capture(){const cells=[];ctx.drawImage=function(im,...args){if(im.src?.includes('/samho-idle.png'))cells.push(args.slice(0,4));return original.call(this,im,...args);};try{a.snapCamera();a.tick(0);}finally{ctx.drawImage=original;}return cells;}
  for(const [day,flow]of [[1,'out'],[2,'in'],[3,'in'],[3,'out']]){
   m.start({day,flow,place:'bar'});m.controlsTutorial=false;m.paused=true;
   m.x=day===1?3.96:day===2?-6.7:LunaResidence.layout.elevatorX+(flow==='in'?1:2.5);
   for(let i=0;i<8;i++){
    m.story.cancel();m.time=(i+.2)/anim.fps;const before=capture();
    m.story.beginRows('idle-check',{x:m.x+.5,y:-.7},[{type:'say',actor:'samho',text:'같은 대기 애니메이션'}]);
    const speaking=capture();if(!before.length)throw Error('Missing Samho '+day+'/'+flow);
    const expected=[i%3*84,Math.floor(i/3)*81,84,81];
    if(JSON.stringify(before)!==JSON.stringify(speaking)||before.some(cell=>JSON.stringify(cell)!==JSON.stringify(expected)))throw Error('Idle differs during dialogue '+day+'/'+flow+'/'+i);
    records.push({day,flow,frame:i});
   }
  }
  for(const qaCase of ['runtime:commute2','runtime:commute3','runtime:samho-contract','outside_day1_samho_smuggler']){
   m.start({day:99,qaCase,qaActivation:'manual'});m.paused=true;m.time=.43;m.x=0;
   const cells=capture();if(!cells.length||cells.some(cell=>cell[0]!==168||cell[1]!==81))throw Error('QA idle differs '+qaCase);
  }
  m.start({day:2,flow:'in',place:'bar'});m.paused=false;m.x=-6.7;LunaOutsideSamhoCommute.start(m);m.encounter.stage='active';m.story.beginRows('idle-check',m.encounter.target,[{type:'say',actor:'samho',text:'같은 대기 애니메이션'}]);
  m.time=.43;const before=m.time;m.tick(.05);if(m.time<=before)throw Error('Dialogue stops animation clock');m.paused=true;const paused=m.time;m.tick(.05);if(m.time!==paused)throw Error('Pause advances animation');
  m.paused=false;m.tick=()=>{};m.story.speech.elapsed=99;a.snapCamera();a.tick(0);return {count:records.length,frames:anim.frames.length,fps:anim.fps,loop:JSON.stringify(LunaSamhoAnimation.frame(0))===JSON.stringify(LunaSamhoAnimation.frame(8/12))};
 });
 assert.deepEqual(report,{count:32,frames:8,fps:12,loop:true});await p.waitForTimeout(350);await p.screenshot({path:'/private/tmp/samho-idle-audit.png'});
 assert.deepEqual(errors,[]);console.log('SAMHO_IDLE_OK',report,'same actual rendered cells while standing/speaking, all street scenes and QA, full rows, pause and loop');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

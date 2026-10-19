const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.LunaOutsideNPCExit&&window.LunaOutsideNotion);
  const result=await p.evaluate(()=>{
   const out=[];
   for(const [module,kind,stage,direction]of [
    [LunaOutsideThug,'thug','depart',1],
    [LunaOutsideSamhoCommute,LunaOutsideSamhoCommute.id,'depart',1],
    [LunaOutsideSamhoCommute,LunaOutsideSamhoCommute.id,'depart',-1],
    [LunaOutsideNotion,LunaOutsideNotion.contract,'dealer-exit',-1],
    [LunaOutsideNotion,LunaOutsideNotion.contract,'samho-exit',1]
   ]){
    let seeks=0;const camera={x:0,y:0,w:4.8};
    const e={kind,stage,elapsed:0,from:0,departFrom:0,actionX:0,direction,npcX:0,dealerX:0,alpha:1,dealerAlpha:1,target:{x:0},camera};
    const m={encounter:e,x:-1,animTime:0,story:{speech:{index:0},seek(){seeks++;}}};
    const frames=[];for(let i=0;i<26;i++){module.tick(m,.05);frames.push({t:e.elapsed,x:stage==='dealer-exit'?e.dealerX:e.npcX,alpha:stage==='dealer-exit'?e.dealerAlpha:e.alpha,index:m.story.speech.index});}
    out.push({kind,stage,direction,frames,seeks,playerX:m.x,camera:e.camera});
   }
   const arms=[];
   for(const t of [.2,.6,.75,.9,1.2,1.7]){
    const calls=[];const ctx=new Proxy({}, {get:(_,key)=>(...args)=>calls.push(key)});
    const m={scene:'street',level:1,config:{day:1,flow:'in'},thugFlags:{},time:t,x:LunaResidence.layout.homeX,encounter:{kind:'thug',stage:t<1.65?'punch':'active',elapsed:t,npcX:LunaResidence.layout.homeX+.7,alpha:1,hurt:t>=.85}};
    let sprites=0;LunaOutsideThug.draw(m,()=>sprites++,ctx,(x,y)=>({x:x*100,y:y*100}));arms.push({t,calls,sprites});
   }
   // Preserve the attack's original approach/recoil and its dialogue hand-off.
   let seeks=0;const m={x:0,animTime:0,encounter:{kind:'thug',stage:'punch',elapsed:0,from:.7,npcX:.7,target:{}},story:{speech:{index:0},seek(){seeks++;}}};
   const punch=[];for(let i=0;i<34;i++){LunaOutsideThug.tick(m,.05);punch.push(m.encounter.npcX);}
   return {out,arms,punch,hurt:m.encounter.hurt,seeks};
  });
  for(const c of result.out){
   const f=c.frames;assert(f.slice(0,19).every(r=>r.alpha===1&&r.index===0),c.stage+' walks before fading');
   assert(f[22].alpha>.45&&f[22].alpha<.55,c.stage+' smooth fade halfway');
   assert.equal(f.at(-1).alpha,0);assert.equal(f.at(-1).index,1);assert.equal(c.seeks,1);
   assert(Math.abs(f.at(-1).x-c.direction*.845)<1e-8,'Short local departure');
   assert(f.every(r=>Math.abs(r.x)<.85));assert.equal(c.playerX,-1);assert.deepEqual(c.camera,{x:0,y:0,w:4.8});
  }
  for(const a of result.arms){assert.equal(a.sprites,1);assert(!a.calls.some(k=>['stroke','fillRect','moveTo','lineTo'].includes(k)),'No extra arm/hand at '+a.t);}
  assert(Math.min(...result.punch)<.34&&result.punch.at(-1)>.6,'Body lunge and recoil preserved');assert(result.hurt);assert.equal(result.seeks,1);
  await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();
  for(const mode of ['developer','main','qa'])for(const scene of ['commute2','commute3','contract']){
   await p.evaluate(async({mode,scene})=>{
    const c=lunaCampaign,a=outsidePlaytest,day=scene==='commute2'?2:3;
    a.exit(true);c.session.uninstall();c.session.install({developer:mode!=='main'});barGame.reset(day,'full',1,false);
    c.session.day=day;c.session.route=scene==='contract'?'out':'in';c.session.carry=structuredClone(barGame.progress);
    Object.assign(a.config,{day:mode==='qa'?99:day,flow:c.session.route,place:'bar',qaCase:mode==='qa'?'runtime:'+(scene==='contract'?'samho-contract':scene):undefined});
    await a.start();c.screen(c.playView);
    const m=a.model;m.paused=false;
    m.x=mode==='qa'?0:scene==='commute2'?-6.5:LunaResidence.layout.elevatorX+(scene==='contract'?3.05:.8);
    if(scene==='contract')LunaOutsideNotion.start(m,LunaOutsideNotion.contract);else LunaOutsideSamhoCommute.start(m);
   },{mode,scene});
   const live=await p.evaluate(()=>{
    const m=outsidePlaytest.model,departures={},seen=[];
    for(let i=0;i<700&&m.encounter;i++){
     const e=m.encounter;e.cameraReady=true;const stage=e.stage,depart=['depart','dealer-exit','samho-exit'].includes(stage);
     const x=m.x,camera=JSON.stringify(e.camera);
     if(m.story.speech?.line&&!m.story.speech.choice){seen.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();}
     if(depart){const elapsed=e.elapsed;m.paused=true;m.tick(.05,{move:1});if(elapsed!==m.encounter.elapsed)throw Error('Paused departure advanced');m.paused=false;}
     m.tick(.05,{move:1});
     if(depart){const list=departures[stage]??=[];list.push({t:e.elapsed,x:stage==='dealer-exit'?e.dealerX:e.npcX,alpha:stage==='dealer-exit'?e.dealerAlpha:e.alpha});if(m.x!==x)throw Error('Player moved during departure');if(e.stage===stage&&JSON.stringify(e.camera)!==camera)throw Error('Camera follows departure');}
    }
    return {departures,seen:seen.length,finished:!m.encounter,qaDone:m.qa?.done};
   });
   assert(live.finished&&live.seen>0,mode+' '+scene+' completes');
   assert.deepEqual(Object.keys(live.departures),scene==='contract'?['dealer-exit','samho-exit']:['depart'],mode+' '+scene+' departure stages');
   for(const frames of Object.values(live.departures)){assert(frames.length>=25&&frames.length<=27);assert(frames.slice(0,19).every(f=>f.alpha===1));assert.equal(frames.at(-1).alpha,0);assert(Math.abs(frames.at(-1).x-frames[0].x)<.85);}
   if(mode==='qa')assert(live.qaDone);
  }
  assert.deepEqual(errors,[]);console.log('PASS shared 1s walk + 0.3s fade, both directions, short travel, fixed player/camera, single dialogue continuation, no added arm; all 9 main/developer/QA commute2/commute3/contract flows complete');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.evaluate(()=>lunaCampaign.developer());
  for(const actor of ['chris','port','aili','samho','bubi']){
   let release;const gate=new Promise(r=>release=r);
   await p.route('**/*pose-loading-test='+actor,async route=>{await gate;await route.continue();});
   await p.evaluate(actor=>{
    const D=barData,states=D.characterLayers[actor],talk=Object.keys(states).find(k=>/idle_talk$/i.test(k));
    for(const key of states[talk])D.assets[key]={...D.assets[key],src:D.assets[key].src+'?pose-loading-test='+actor};
    const g=barGame;g.reset(99,'general',7);g.queue=[];g.speed=0;g.cameraLeft=0;g.focus='L';g.overview=false;
    g.seats={L:{id:'loading_'+actor,actor,seated:true,state:'WAIT_COASTER',left:999,limit:999,lines:[],lineIndex:0},M:null,R:null};
    window.testLine=null;g.currentDialogue=()=>window.testLine;
   },actor);
   await p.waitForFunction(actor=>document.querySelector('.actor[data-actor="'+actor+'"]')?.dataset.pose.endsWith('idle_default'),actor);
   await p.evaluate(async()=>{
    await Promise.all([...document.querySelectorAll('.actor-layer')].map(el=>{
     const im=new Image();im.src=el.style.backgroundImage.slice(5,-2);return im.decode();
    }));
    window.savedActor=document.querySelector('.actor');
   });
   await p.waitForTimeout(100);
   await p.evaluate(actor=>{window.testLine={actor,text:'이미지 준비 중에도 캐릭터가 사라지지 않아야 합니다.',chars:0,expression:'idle'};},actor);
   await p.waitForTimeout(300);
   const pending=await p.locator('.actor').evaluate(el=>({pose:el.dataset.pose,same:el===window.savedActor,opacity:+el.style.opacity}));
   try{
    assert(pending.pose.endsWith('idle_default'),'Undecoded pose replaced visible actor: '+actor+' / '+pending.pose);
    assert(pending.same);assert.equal(pending.opacity,1);
   }finally{release();}
   await p.waitForFunction(actor=>document.querySelector('.actor[data-actor="'+actor+'"]')?.dataset.pose.endsWith('idle_talk'),actor);
   assert(await p.locator('.actor').evaluate(el=>el===window.savedActor));
   await p.evaluate(()=>window.testLine=null);
   await p.waitForFunction(actor=>document.querySelector('.actor[data-actor="'+actor+'"]')?.dataset.pose.endsWith('idle_default'),actor);
   await p.unroute('**/*pose-loading-test='+actor);
   console.log('POSE_READY_OK',actor);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

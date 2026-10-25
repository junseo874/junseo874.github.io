const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  const audit=await page.evaluate(async()=>{
   const host=document.createElement('div');
   Object.assign(host.style,{position:'fixed',inset:'0',zIndex:99999,background:'#142735'});
   document.body.append(host);
   const ui=LunaWorldChoices.create(host,()=>{}),samples=[];
   const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
   for(const facing of [-1,1])for(const selected of [0,2]){
    ui.update({key:'corners-'+facing+'-'+selected,head:{x:640,y:350},facing,rejectUnavailable:true,
     options:[{id:'ride',label:'내려간다'},{id:'cancel',label:'취소'},{id:'repair',label:'빠른 이동',disabled:true,disabledReason:'수리가 필요합니다.'}]});
    for(let i=0;i<selected;i++)ui.key({code:'KeyS',preventDefault(){},stopImmediatePropagation(){}});
    const row=host.querySelector('.is-selected'),animation=row.getAnimations().find(a=>a.animationName?.startsWith('world-choice-in'));
    animation.pause();
    const delay=Number(animation.effect.getTiming().delay);
    animation.currentTime=delay+300;await frame();
    const expected=getComputedStyle(row).clipPath;
    for(const time of [-1,0,1,45,90,179,180,181,260]){
     animation.currentTime=delay+time;await frame();
     samples.push({facing,selected,time,expected,clip:getComputedStyle(row).clipPath});
    }
    if(selected===2){
     ui.key({code:'Enter',preventDefault(){},stopImmediatePropagation(){}});
     samples.push({facing,selected,time:'rejected',expected,clip:getComputedStyle(row).clipPath});
    }
   }
   window.cornerTestUI=ui;window.cornerTestHost=host;
   return samples;
  });
  for(const sample of audit){
   assert(sample.expected.startsWith('polygon('),'Final selected shape is chamfered');
   assert.equal(sample.clip,sample.expected,'Corner must stay fixed through delay/entry/finish/rejection: '+JSON.stringify(sample));
  }
  await page.screenshot({path:'/private/tmp/choice-corners-fixed.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.locator('.world-choices .is-selected').evaluate(row=>getComputedStyle(row).animationName==='none'&&getComputedStyle(row).clipPath.startsWith('polygon(')));
  await page.evaluate(()=>{cornerTestUI.dispose();cornerTestHost.remove();});
  assert.deepEqual(errors,[]);
  console.log('PASS fixed chamfer throughout entry: both directions, first/staggered selection, delay, 9 timeline samples, rejection and reduced motion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

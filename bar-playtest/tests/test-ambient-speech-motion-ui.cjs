const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 for(const dpr of [1,2]){
  const p=await browser.newPage({viewport:{width:dpr===1?1280:973,height:720},deviceScaleFactor:dpr}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  const result=await p.evaluate(async()=>{
   const a=outsidePlaytest;Object.assign(a.config,{day:0,flow:'out',place:'bar'});await a.start();
   const m=a.model,b=m.backgroundStory,tick=a.tick;a.tick=()=>{};m.story.cancel();b.cancel();m.encounter=null;m.controlsTutorial=false;m.x=-3;m.y=-.7;m.level=0;a.snapCamera();
   for(const id of ['outside_day0_port_pair','outside_day0_store_passers'])b.begin(id,{id},true);
   b.tick=()=>{};for(const s of b.channels.values())s.speech.elapsed=1;tick(0);await document.fonts.ready;a.refreshHUD();
   const originals=new Map([...document.querySelectorAll('.outside-background-speech')].map(el=>[el.dataset.storyId,{el,ink:el.querySelector('p>span'),width:el.style.width}]));
   const check=(v,msg)=>{if(!v)throw Error(msg);};let samples=0,edges=0;
   for(let i=0;i<130;i++){
    m.x=-3-3.7*Math.sin(i/130*Math.PI*2);tick(1/30);
    const stage=document.querySelector('.outside-stage').getBoundingClientRect(),unit=stage.width/1280,cam=a.renderCamera;
    for(const v of b.views()){
     const id=v.key.split(':')[0],old=originals.get(id),el=document.querySelector('[data-story-id="'+id+'"]');
     check(el===old.el,'channel DOM swapped: '+id);check(el.querySelector('p>span')===old.ink,'typing remounted: '+id);check(el.style.width===old.width,'line width changed while moving');
     check(el.style.left==='0px'&&el.style.top==='0px'&&el.style.transform.startsWith('translate3d('),'not composited');
     const rect=el.getBoundingClientRect(),projected=LunaPixelCamera.position(v.anchor.x,v.anchor.y,cam),w=el.offsetWidth*4.8/cam.w*.8;
     const expected=Math.max(12+w/2,Math.min(1268-w/2,projected.x));
     check(Math.abs((rect.left+rect.width/2-stage.left)/unit-expected)<.6,'bubble detached from current camera');
     check(rect.left>=stage.left-.1&&rect.right<=stage.right+.1,'offscreen clipping');
     if(el.dataset.speechTail!=='center')edges++;samples++;
    }
   }
   const [id,story]=b.channels.entries().next().value,anchor=story.view().anchor,old=originals.get(id);
   for(const [dx,visible]of [[3.99,true],[4.01,true],[3.99,true],[4.15,true],[4.21,false],[4.05,false],[3.99,true]]){
    m.x=anchor.x+dx;m.y=anchor.y;a.refreshHUD();const el=document.querySelector('[data-story-id="'+id+'"]');
    check(el===old.el&&el.querySelector('p>span')===old.ink,'boundary remounted bubble');check(!el.hidden===visible,'distance band '+dx);
   }
   m.dialog={title:'일시 상호작용'};a.refreshHUD();check([...originals.values()].every(o=>o.el.hidden),'pause must hide');
   m.dialog=null;m.x=anchor.x;m.y=anchor.y;a.refreshHUD();check(old.el.querySelector('p>span')===old.ink,'pause remounted typing');
   b.cancel();a.refreshHUD();check(document.querySelectorAll('.outside-background-speech').length===1&&document.querySelector('.outside-background-speech').hidden,'completed channel cleanup');
   return{samples,edges};
  });
  assert(result.samples>100&&result.edges>0);assert.deepEqual(errors,[]);console.log('AMBIENT_MOTION_OK',dpr,result);await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

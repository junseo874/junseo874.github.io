const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs');
const {chromium}=runtime.load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();});
  const result=await p.evaluate(()=>{
   const m=outsidePlaytest.model,D=LunaOutsideDiscovery,p=barGame.progress,checks=[];
   lunaCampaign.session.carry={flags:{}};
   function ok(value,label){if(!value)throw Error(label);checks.push(label);}
   function start(day=1,place='bar',flow='out'){m.story.cancel();m.start({day,place,flow});m.paused=false;}
   function target(id){return m.targets().find(t=>t.id===id);}
   function interact(t){m.x=t.x;m.updateNear();ok(m.near?.id===t.id,'nearest '+t.id);ok(m.interact(),'interact '+t.id);}
   p.flags={};p.inventory={};p.money=0;start(0);
   let t=target('street-beggar-witness');
   ok(D.unseen(m,t),'untouched NPC has badge');
   interact(t);
   ok(!D.unseen(m,t),'badge clears as interaction starts, before reading');
   m.story.cancel();ok(!D.unseen(m,t),'cancelled dialogue still counts as interaction');
   p.flags.street_beggar_witness_met=true;p.flags.street_beggar_paid=true;m.beggarWitnessPaidVisit='0:out';
   ok(!D.unseen(m,t),'new repeat and paid dialogue never restore badge');
   p.flags={};start();t=target('neighborhood-repair');interact(t);m.story.choose('cancel');
   ok(!D.unseen(m,t),'cancel from NPC choices still counts');
   p.money=400;p.flags.repairman_met=true;ok(!D.unseen(m,t),'newly affordable repair does not restore badge');
   p.flags={};p.money=0;start(3);t=target('shiba-shop');interact(t);m.story.cancel();
   p.flags.shiba_shop_met=true;p.money=500;p.inventory.wild_dog=1;
   ok(!D.unseen(m,t),'shop repeat, stock, quiz and new purchase never restore badge');
   p.flags={};start(1,'homeDoor');t=target('neighborhood-box');interact(t);
   ok(!D.unseen(m,t),'box clears before reveal animation completes');
   for(let i=0;i<40;i++)LunaOutsideNeighborhood.tick(m,.05);
   ok(p.flags.boobi_revealed,'box reveal still completes');
   t=target('neighborhood-cat');ok(D.unseen(m,t),'revealed cat is separate from box');
   interact(t);m.story.cancel();p.inventory.tuna_can=1;
   ok(!D.unseen(m,t),'new feeding choice does not reset cat badge');
   p.flags.boobi_adopted=true;start(1,'home');
   ok(!D.unseen(m,target('neighborhood-home-cat')),'same cat keeps interaction history inside home');
   p.flags={};start(1);t=target('wanted-poster');interact(t);m.interact();
   ok(!D.unseen(m,t),'poster is recorded when opened');
   const saved=structuredClone(p.flags);p.flags=structuredClone(saved);start(2);
   ok(!D.unseen(m,target('wanted-poster')),'history survives progress restoration and day changes');
   ok(lunaCampaign.session.carry.flags[D.interactionToken(t.id)],'history carried into campaign session');
   p.flags={};
   for(const id of ['tv','elevator','sofa','home','exit','bar']){
    ok(!D.unseen(m,{id}),'routine object excluded even before use: '+id);
   }
   for(const flow of ['in','out'])for(const seen of [false,true]){
    const day=0; // TV interaction is intentionally available only on day 0.
    p.flags=seen?{day0_tv_seen:true}:{};start(day,'home',flow);m.controlsTutorial=false;
    t=target('tv');m.x=t.x;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
    ok(!outsidePlaytest.discoveryMarkers.some(v=>v.id==='tv'),'TV never renders a badge: '+day+'/'+flow+'/'+seen);
    ok(m.near?.id==='tv'&&outsidePlaytest.interactionGlow.target==='tv','TV interaction and outline retained');
    const prompt=document.querySelector('.outside-interact');
    ok(!prompt.hidden&&prompt.textContent==='ETV 보기','TV E prompt retained');
   }
   p.flags.elevator_repaired=true;ok(!D.unseen(m,{id:'elevator'}),'repair never gives elevator a badge');
   p.flags={shiba_shop_met:true};start(3);ok(!D.unseen(m,target('shiba-shop')),'legacy NPC met flags migrate');
   p.flags={};start(1);t=target('wanted-poster');D.remember(m,D.objectToken(m,t.id));
   ok(!D.unseen(m,t),'legacy poster history migrates');
   p.flags={};const rows=LUNA_DATA.sharedStory['neighborhood/guardBlocked'];
   D.witnessed(m,'neighborhood/guardBlocked',rows);t=target('neighborhood-guard');
   ok(!D.unseen(m,t),'old blocked guard greeting migrates after flow changes');
   p.flags={};start(1,'home');m.x=2.57;
   const nearby=[{id:'new-a',x:m.x,y:0},{id:'new-b',x:m.x+.2,y:0},{id:'sofa',x:m.x,y:0}];
   let strokes=0,fills=0;
   const ctx={save(){},restore(){},strokeText(){strokes++},fillText(){fills++}};
   const markers=D.draw(ctx,m,nearby,p=>({x:p*100,y:100}),t=>t);
   ok(markers.length===2&&fills===2,'multiple untouched targets render together, routine objects excluded');
   ok(strokes===0,'question marks never draw a black outline');
   ok(ctx.fillStyle===LunaInteractionGlow.style.color&&ctx.shadowColor===LunaInteractionGlow.style.shadow,'cyan fill and glow match interaction outline');
   for(const distance of [.399,.4,.401])ok(D.inRange({x:0},{id:'npc',x:distance})===(distance<.4),'range '+distance);
   ok(D.inRange(m,{id:'elevator',x:m.x+.61}),'elevator interaction range unchanged');
   m.paused=true;t={id:'blocked-test',x:m.x};m.near=t;m.interact();
   ok(D.unseen(m,t),'blocked input is not an interaction');
   p.flags={boobi_adopted:true};start(1,'home');
   // Adoption is legacy evidence of touching Boobi; use a genuinely untouched poster for visual checks.
   p.flags={};start(1);t=target('wanted-poster');m.x=t.x;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
   ok(outsidePlaytest.discoveryMarkers.some(v=>v.id===t.id),'untouched poster renders in real scene');
   return checks;
  });
  assert(result.length>=30);
  await p.screenshot({path:'/private/tmp/outside-discovery-first-interaction.png'});
  for(const state of ['pause','dialog','tutorial','far','capture','cutscene']){
   const count=await p.evaluate(state=>{
    const m=outsidePlaytest.model;m.start({day:1,flow:'out',place:'bar'});
    m.x=m.targets().find(t=>t.id==='wanted-poster').x;m.updateNear();
    if(state==='pause')m.paused=true;if(state==='dialog')m.dialog={title:'test',text:'test'};
    if(state==='tutorial')m.controlsTutorial=true;if(state==='far'){m.x=10;m.updateNear();}
    if(state==='cutscene'){m.encounter={kind:'test',camera:{x:m.x,y:0,w:4.8}};m.updateNear();}
    if(state==='capture')LunaCaptureMode.set(true);
    outsidePlaytest.tick(0);return outsidePlaytest.discoveryMarkers.length;
   },state);assert.equal(count,0,state);
   if(state==='capture')await p.evaluate(()=>LunaCaptureMode.set(false));
  }
  assert.deepEqual(errors,[]);console.log('PASS first-interaction badges: '+result.join('; '));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

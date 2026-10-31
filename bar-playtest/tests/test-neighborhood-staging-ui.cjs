const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});await outsidePlaytest.start();});
 const checks=await p.evaluate(()=>{
  const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,A=LunaOutsideAmbient,progress=barGame.progress,out=[];
  const ok=(v,label)=>{if(!v)throw Error(label);out.push(label);},near=(a,b)=>Math.abs(a-b)<.00001;
  function start(place='bar'){m.story.cancel();m.start({day:2,flow:'out',place});m.controlsTutorial=false;m.backgroundStory.cancel();}
  function run(t){for(let s=0;s<t-.0001;s+=.05)m.tick(.05);a.tick(0);}
  function finish(){for(let i=0;i<1000&&m.story.speech&&!m.story.speech.choice;i++){if(m.neighborhood.action)m.tick(.05);else{m.story.speech.elapsed=999;m.story.advance();}}}
  progress.flags={};start();
  for(const pose of N.poses(m)){
   ok(pose.sp.asset==='ambient-'+A.roleKinds[pose.id],'dedicated supplied sheet: '+pose.id);
   const bounds=A.bounds(pose.sp),sole=pose.y+(114-bounds.bottom)/100*pose.scale,head=N.anchor(m,pose.id),measured=A.head(pose.sp,pose.x,pose.y,pose.scale,pose.scale,pose.flip);
   ok(pose.sp.h===138,'no cropped legs: '+pose.id);ok(near(sole,-.974),'ground sole: '+pose.id);
   ok(near(head.x,measured.x)&&near(head.y,measured.y),'measured head: '+pose.id);
  }
  ok(N.poses(m).find(p=>p.id==='boss').scale===1,'authored boss proportions without dummy enlargement');
  for(const [kind,sheet]of Object.entries(A.sheets)){
   const b=A.bounds(A.sprite(kind));ok(b.bottom===114,'supplied sheet foot union: '+kind);
   const heads=[];for(let i=0;i<sheet.frames;i++)heads.push(A.head(A.sprite(kind,(i+.25)*.75/sheet.frames),0,0).y);
   ok(heads.every(y=>near(y,heads[0])),'stable full-cycle head: '+kind);
  }
  for(const side of [-1,1]){m.x=N.places.repair.x+side*.3;const t=N.targets(m).find(t=>t.actor==='repair');N.interact(m,t);ok(m.facing===-side,'Luna faces repairman '+side);ok(N.poses(m).find(p=>p.id==='repair').flip===(side>0),'repairman faces Luna '+side);m.story.cancel();}
  const campIds=['guard','boss','gang-left','gang-far','gangmate'],idle={guard:false,boss:true,'gang-left':true,'gang-far':true,gangmate:false};
  const camp=()=>N.poses(m).filter(p=>campIds.includes(p.id));
  for(const day of [0,1,2,3])for(const x of [-17,-15.2,-13]){
   m.config.day=day;m.x=x;
   ok(camp().every(p=>p.flip===idle[p.id]),'camp faces inward independently of Luna '+day+'/'+x);
  }
  m.config.day=2;
  for(const actor of ['guard','boss'])for(const side of [-1,1]){
   progress.flags={gang_pass_granted:actor==='boss'};m.x=N.places[actor].x+side*.3;
   const t=N.targets(m).find(t=>t.actor===actor);N.interact(m,t);
   const checkFacing=()=>{for(const p of camp()){
    const involved=p.id===actor||actor==='boss'&&p.id==='gangmate';
    ok(p.flip===(involved?m.x>p.x:idle[p.id]),'direct conversation attention '+actor+'/'+side+'/'+p.id);
   }};
   checkFacing();m.story.speech.elapsed=999;m.story.advance();checkFacing();
   if(actor==='boss')ok(m.story.speech.line.actor==='luna','Luna response keeps camp attention');
   finish();checkFacing();ok(m.story.speech.choice,'choices keep camp attention');
   m.story.choose(actor==='boss'?'boss-wait':'cancel');finish();
   ok(!m.story.speech&&camp().every(p=>p.flip===idle[p.id]),'completion returns camp to each other '+actor+'/'+side);
   N.interact(m,t);m.story.cancel();ok(camp().every(p=>p.flip===idle[p.id]),'cancel restores camp '+actor+'/'+side);
  }
  progress.flags={};N.interact(m,N.targets(m).find(t=>t.actor==='repair'));
  ok(camp().every(p=>p.flip===idle[p.id]),'unrelated repair dialogue cannot turn camp');m.story.cancel();
  progress.flags={boobi_revealed:true};start('homeDoor');m.x=N.places.cat.x-.3;
  m.story.beginRows('neighborhood/audit',N.targets(m)[0],[{type:'neighborhood-action',action:'neighbor-in'},{type:'say',actor:'neighbor',text:'밤에 너무 시끄러워서 잠을 못자겠다고.'}]);
  let previous=N.poses(m).find(p=>p.id==='neighbor').x;
  for(let i=0;i<20;i++){m.tick(.05);const v=N.poses(m).find(p=>p.id==='neighbor');ok(v.x<=previous&&previous-v.x<=.01201&&!v.flip,'slow left-facing approach '+i);previous=v.x;}
  ok(m.neighborhood.action?.name==='neighbor-in','neighbour is not rushing in within one second');run(1.1);
  const n=N.poses(m).find(p=>p.id==='neighbor');ok(near(n.y,LunaResidence.layout.upperY-.274),'corridor soles match Luna');
  ok(n.sp.asset==='ambient-Neighbor','adoption cutscene uses dedicated neighbor');
  ok(n.x-N.places.cat.x>=.59,'neighbour stays clear of cat perch');ok(!n.flip&&m.facing===1,'conversation faces both participants');
  const nHead=N.anchor(m,'neighbor'),cHead=N.anchor(m,'boobi');ok(Math.abs(nHead.x-cHead.x)>.55,'cat cannot occlude neighbour head');
  m.story.beginRows('neighborhood/audit',{},[{type:'neighborhood-action',action:'neighbor-out'}]);run(.25);
  ok(N.poses(m).find(p=>p.id==='neighbor').flip,'departure reverses facing to right');
  ok(N.poses(m).find(p=>p.id==='neighbor').x>n.x,'departure moves right');
  for(const side of [-1,1]){progress.flags={repairman_met:true};progress.money=400;start();m.x=N.places.repair.x+side*.3;N.interact(m,N.targets(m).find(t=>t.actor==='repair'));m.story.choose('pay');finish();run(.2);
   const v=N.poses(m).find(p=>p.id==='repair');ok(v.flip===(side<0),'repair departure faces travel '+side);ok((v.x-N.places.repair.x)*-side>0,'repair departs away from player '+side);ok(near(v.y,-.974),'no bouncing below ground');run(1.5);ok(!N.poses(m).some(p=>p.id==='repair'),'repair fades without walking off camera');}
  progress.flags={boobi_adopted:true};start('home');m.x=2.55;a.snapCamera();let done=0;N.beforeRest(m,()=>done++);
  ok(!N.poses(m).some(p=>p.id==='chris'),'Chris does not walk in before blackout');run(.5);
  ok(N.fadeAlpha(m)===1,'rest includes fully opaque black hold');
  const ctx=document.querySelector('.outside-stage canvas').getContext('2d'),data=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
  ok(data.every((v,i)=>i%4===3||v===0),'entire game canvas is black');
  const chris=N.poses(m).find(p=>p.id==='chris'),startCam=N.camera(m);ok(chris.x===N.places.chris.x&&chris.flip,'Chris already standing right of TV toward sofa');
  const samples=[];for(let i=0;i<46;i++){run(.05);samples.push({...a.camera});ok(N.poses(m).find(p=>p.id==='chris').x===chris.x,'Chris stationary '+i);}
  ok(samples.every(c=>c.w===4.8&&c.y===.023),'camera never zooms or moves vertically');
  ok(samples.every((c,i)=>!i||c.x>=samples[i-1].x),'camera moves only left to right');
  ok(near(samples.at(-1).x-startCam.x,.32),'short .32 world-unit pan');
  ok(N.fadeAlpha(m)===0&&m.story.speech.line?.actor==='chris','first dialogue after reveal belongs to standing Chris');
  finish();ok(done===1&&progress.flags.boobi_rest_seen,'rest continues once after interlude');
  return out;
 });
 for(const scene of ['neighbor','rest','gang','box','shiba']){
  await p.evaluate(scene=>{const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;barGame.progress.flags={boobi_revealed:scene!=='box',boobi_adopted:scene==='rest',gang_pass_granted:scene==='gang'};m.story.cancel();m.start({day:2,flow:'out',place:scene==='rest'?'home':['neighbor','box'].includes(scene)?'homeDoor':'bar'});m.x=scene==='gang'?N.places.boss.x+.3:scene==='shiba'?-2.38:scene==='rest'?2.55:scene==='box'?N.places.box.x-.25:N.places.cat.x-.3;
   if(scene==='rest'){N.beforeRest(m,()=>{});for(let i=0;i<56;i++)m.tick(.05);}
   if(scene==='neighbor'){m.story.beginRows('neighborhood/audit',{},[{type:'neighborhood-action',action:'neighbor-in'},{type:'say',actor:'neighbor',text:'밤에 너무 시끄러워서 잠을 못자겠다고.'}]);for(let i=0;i<44;i++)m.tick(.05);}
   m.updateNear();a.snapCamera();a.tick(0);
  },scene);
  if(scene==='gang'){
   const feet=await p.evaluate(()=>{const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,canvas=document.querySelector('.outside-stage canvas'),ctx=canvas.getContext('2d'),factor=canvas.width/1280;
    const subjects=N.poses(m).filter(p=>['guard','boss','gang-left','gang-far','gangmate'].includes(p.id));
    const patches=()=>subjects.map(p=>{const v=LunaPixelCamera.position(p.x,p.y,a.renderCamera);return ctx.getImageData(Math.round((v.x-18)*factor),Math.round((v.y-8)*factor),Math.ceil(36*factor),Math.ceil(8*factor)).data;});
    a.tick(0);const shown=patches(),draw=N.drawCamp;let absent;try{N.drawCamp=()=>{};a.tick(0);absent=patches();}finally{N.drawCamp=draw;a.tick(0);}
    return subjects.map((p,i)=>({id:p.id,changed:shown[i].reduce((n,v,k)=>n+(k%4!==3&&v!==absent[i][k]?1:0),0)}));
   });assert(feet.every(p=>p.changed>5),'visible foot pixels must survive foreground: '+JSON.stringify(feet));
  }
  await p.screenshot({path:'/private/tmp/neighborhood-fixed-'+scene+'.png'});
  if(scene==='gang'){
   await p.evaluate(()=>{const m=outsidePlaytest.model,N=LunaOutsideNeighborhood;N.interact(m,N.targets(m).find(t=>t.actor==='boss'));m.story.speech.elapsed=99;outsidePlaytest.tick(0);});
   await p.screenshot({path:'/private/tmp/neighborhood-gang-conversation.png'});
  }
 }
 assert.deepEqual(errors,[]);console.log('NEIGHBORHOOD_STAGING_OK',checks.length,'checks: complete silhouettes/soles, shared heads, facing, slow arrival/exit, cat clearance, opaque rest fade, fixed Chris, constant-scale horizontal pan');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

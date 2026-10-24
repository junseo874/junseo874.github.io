const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.session.uninstall();lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();});
 const snapshot=()=>p.evaluate(()=>{const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;return{x:m.x,edge:N.places.guard.x+.34,speech:m.story.speech?.id||null,blocking:m.story.blocking,near:m.near?.id,pass:!!barGame.progress.flags.gang_pass_granted,interacted:!!barGame.progress.flags['outside_interacted_v1_neighborhood-guard'],glow:a.interactionGlow?.target};});
 const drain=()=>p.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<60&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}outsidePlaytest.tick(0);});
 for(const [day,flow]of [[0,'out'],[1,'in'],[1,'out'],[2,'in'],[3,'out']]){
  await p.evaluate(({day,flow})=>{const a=outsidePlaytest,m=a.model;barGame.progress.flags={};lunaCampaign.session.carry=structuredClone(barGame.progress);m.start({day,flow,place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=LunaOutsideNeighborhood.places.guard.x+.45;m.updateNear();a.snapCamera();a.tick(0);},{day,flow});
  await p.keyboard.down('KeyA');await p.waitForTimeout(600);await p.keyboard.up('KeyA');
  let s=await snapshot();assert(Math.abs(s.x-s.edge)<.0001);assert.equal(s.speech,null);assert(!s.blocking&&!s.interacted);assert.equal(s.near,'neighborhood-guard');assert.equal(s.glow,'neighborhood-guard');
  await p.keyboard.down('KeyA');await p.waitForTimeout(300);await p.keyboard.up('KeyA');assert.equal((await snapshot()).speech,null,'Repeated contact stays silent');
  await p.keyboard.down('KeyD');await p.waitForTimeout(200);await p.keyboard.up('KeyD');assert((await snapshot()).x>s.x,'Can freely walk away without closing dialogue');
  await p.keyboard.down('KeyA');await p.waitForTimeout(400);await p.keyboard.up('KeyA');
  await p.keyboard.press('KeyE');s=await snapshot();assert(s.interacted&&s.blocking);
  const eligible=day>1||day===1&&flow==='out';assert.equal(s.speech,'neighborhood/'+(eligible?'guardMenu':'guardBlocked'));
  if(eligible){await p.locator('[data-choice="cancel"]').click();assert(!(await snapshot()).pass);}
  else await drain();
  await p.keyboard.down('KeyA');await p.waitForTimeout(200);await p.keyboard.up('KeyA');s=await snapshot();assert(Math.abs(s.x-s.edge)<.0001&&!s.speech&&!s.pass,'Cancel/early-day dialogue does not unlock or retrigger');
 }
 // Explicitly choosing the ingredient-search route unlocks only after its dialogue.
 await p.keyboard.press('KeyE');await p.locator('[data-choice="ask"]').click();
 assert.equal((await snapshot()).speech,'neighborhood/guardPass');assert(!(await snapshot()).pass);
 await p.evaluate(()=>outsidePlaytest.model.story.cancel());assert(!(await snapshot()).pass,'Interrupted passage dialogue stays locked');
 await p.keyboard.press('KeyE');await p.locator('[data-choice="ask"]').click();await drain();assert((await snapshot()).pass);
 assert(await p.evaluate(()=>lunaCampaign.session.carry.flags.gang_pass_granted));
 await p.keyboard.down('KeyA');await p.waitForTimeout(700);await p.keyboard.up('KeyA');let s=await snapshot();assert(s.x<s.edge-.3&&!s.speech,'Walk through without auto dialogue after permission');
 await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:3,flow:'in',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=LunaOutsideNeighborhood.places.guard.x+.34;m.updateNear();a.snapCamera();a.tick(0);});
 await p.keyboard.down('KeyA');await p.waitForTimeout(400);await p.keyboard.up('KeyA');s=await snapshot();assert(s.pass&&s.x<s.edge&&!s.speech,'Permission persists on return');
 assert.deepEqual(errors,[]);console.log('GANG_GUARD_INTERACTION_OK: five day/route cases, held/repeated collision silent, free retreat, E/glow, cancel/interruption locked, completed dialogue unlock and carry.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

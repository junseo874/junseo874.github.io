const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');
 const checks=await p.evaluate(async()=>{
  const main=lunaCampaign,opening=main.cinema.scene,tv=await main.prepareStudio('documentary');main.resumeView='prologue';main.screen('options');
  const original=opening.clips.filter(c=>c.type==='dialogue');
  if(![...original,...tv.clips.filter(c=>c.type==='dialogue')].every(c=>c.cps===LunaOutsideStory.cps))throw Error('Different clip speeds');
  const results=[];
  for(const speed of [.5,1,2])for(const group of ['dream-lines','phone-lines','tv-lines']){
   barGame.dialogSpeed=speed;
   const project=structuredClone(group==='tv-lines'?tv:opening),line=project.clips.find(c=>c.type==='dialogue'&&c.track===group);
   line.text='가'.repeat(100);line.textEffect='typewriter';
   const player=LunaStudioCinema.player(document.createElement('canvas'),document.createElement('div'),project),wait=line.wait?{id:line.id,age:0,revealed:false}:null;
   player.render(line.start,null,false,.5,wait);
   if(wait)wait.age=.2;
   player.render(line.start+(wait?0:.2),line.start,true,.5,wait);
   const story=new LunaOutsideStory.Story(outsidePlaytest.model);story.beginRows('speed-test',{x:0,y:0},[{type:'say',actor:'luna',text:line.text}]);story.tick(.2);
   results.push({speed,group,cinema:player.dialogueCount(line),outside:story.view().text.length});player.dispose();
  }
  // Keep revealed progress when the options UI recreates the player at a lower speed.
  const project=structuredClone(opening),line=project.clips.find(c=>c.track==='phone-lines');line.text='가'.repeat(100);
  barGame.dialogSpeed=1;let player=LunaStudioCinema.player(document.createElement('canvas'),document.createElement('div'),project),wait={id:line.id,age:0,revealed:false};
  player.render(line.start,null,false,.5,wait);wait.age=.4;player.render(line.start,null,false,.5,wait);const before=player.dialogueCount(line);player.dispose();barGame.dialogSpeed=.5;
  player=LunaStudioCinema.player(document.createElement('canvas'),document.createElement('div'),project);player.render(line.start,null,false,.5,wait);const after=player.dialogueCount(line);wait.age=.6;player.render(line.start,null,false,.5,wait);const later=player.dialogueCount(line);player.dispose();
  // The same count must drive the key action: reveal first, then advance.
  barGame.dialogSpeed=1;const c=main.cinema,contact=c.scene.clips.find(c=>c.track==='phone-lines');c.time=contact.start;c.dialogueWait={id:contact.id,age:0,revealed:false};main.screen('prologue');main.advanceCinemaDialogue();const revealed=c.dialogueWait.revealed;main.advanceCinemaDialogue();const advanced=c.time>contact.start+contact.duration;
  return {results,before,after,later,revealed,advanced};
 });
 for(const r of checks.results){assert.equal(r.cinema,r.outside,JSON.stringify(r));assert.equal(r.cinema,Math.floor(55*.2*r.speed));}
 assert.equal(checks.before,22);assert.equal(checks.after,checks.before);assert(checks.later>checks.after);assert(checks.revealed&&checks.advanced);assert.deepEqual(errors,[]);
 console.log('PASS: dream/contact/TV all match outside at 55 chars/s, including 0.5x/1x/2x; settings redraw retains progress; reveal/advance shares the renderer count.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

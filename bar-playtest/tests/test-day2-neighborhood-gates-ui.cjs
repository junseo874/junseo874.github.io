const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{LunaFocusSettings.setEnabled(false);Object.assign(outsidePlaytest.config,{day:2,flow:'in',place:'homeDoor'});await outsidePlaytest.start();});
 const results=await p.evaluate(()=>{
  const c=lunaCampaign,g=barGame,a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,S=LunaOutsideShop,R=LunaResidence.layout,checks=[];
  const ok=(v,label)=>{if(!v)throw Error(label);checks.push(label);};
  for(const developer of [true,false]){
   c.session.uninstall();c.session.install({developer});c.screen(c.playView);
   for(const day of [0,1,2,3])for(const flow of ['in','out']){
    g.progress.flags={};g.progress.inventory={};g.progress.money=1000;
    m.start({day,flow,place:'homeDoor'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
    ok(N.targets(m).some(t=>t.id==='neighborhood-box')===(day>=2),`${developer}/${day}/${flow} box gate`);
    m.x=N.places.box.x;N.tick(m,.05);ok(!!g.progress.flags.boobi_box_shaken===(day>=2),'shake starts only from day2');
    m.level=0;m.y=-.7;
    ok(S.visible(m)===(day>=2),'shop gate');ok(S.targets(m).length===(day>=2?1:0),'shop prompt gate');
    const guard=N.targets(m).find(t=>t.id==='neighborhood-guard');
    if(guard){ok(N.interact(m,guard),'guard remains interactive');ok(m.story.speech.id==='neighborhood/'+(day>=2?'guardMenu':'guardBlocked'),'guard quest gate');m.story.cancel();}
    ok(N.targets(m).some(t=>t.actor==='repair')===(day>=1),'repair stays day1');
    g.progress.flags.gang_pass_granted=true;ok(N.targets(m).some(t=>t.actor==='boss')===(day>=2),'boss gate even with old pass');
    S.begin(m,{id:S.id,x:-2.68,y:-.596},false);m.story.speech={...m.story.speech,line:{type:'shop-choice',stage:'items'},choice:true};
    ok(S.choiceView(m).options.some(o=>o.id==='shop-buy-tuna_can')===(day>=2),'tuna gate');
    if(day<2){ok(!S.choose(m,'shop-buy-bitters'),'stale early purchase blocked');ok(g.progress.money===1000,'no early charge');}
    m.story.cancel();
   }
  }
  c.session.uninstall();c.session.install({developer:true});c.screen('developer');
  g.progress.flags={boobi_revealed:true};m.start({day:2,flow:'in',place:'homeDoor'});m.controlsTutorial=false;
  m.x=N.places.cat.x;m.tick(.05);ok(!m.encounter,'cat approach does not force neighbor dialogue');
  m.x=R.homeX+1.90-.30;m.tick(.05);m.tick(.05);ok(m.encounter?.kind==='day2-corridor-thug','door approach starts neighbor');
  ok(Math.abs(m.encounter.npcX-(R.homeX+1.90))<1e-8,'actor at next door');
  m.story.cancel();m.encounter=null;g.progress.flags.day2_thug_done=true;m.notionFlags.day2_thug_done=true;m.x=R.homeX+1.75;
  const info=LunaOutsideNotion.targets(m)[0];ok(Math.abs(info.x-(R.homeX+1.90))<1e-8,'information target matches actor');
  ok(info.x-N.places.cat.x>.8,'cat and NPC separated');
  m.x=N.places.cat.x;m.updateNear();ok(m.near?.id==='neighborhood-cat','cat remains independently selectable');
  m.x=info.x-.18;m.updateNear();ok(m.near?.id===info.id,'neighbor independently selectable');
  a.snapCamera();a.tick(0);return checks.length;
 });
 await p.waitForTimeout(350);await p.screenshot({path:'/private/tmp/day2-neighbor-door.png'});
 assert.deepEqual(errors,[]);console.log('DAY2_NEIGHBORHOOD_OK '+results+' main/developer day/route gates, stale purchase, unchanged repair, door trigger and separated targets');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

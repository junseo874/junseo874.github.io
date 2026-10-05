// Regression: all days/routes keep NPCs on their own floors during lift travel.
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:8123/'))errors.push(r.status()+' '+r.url());});
  if(process.env.LUNA_STAGE)await page.route('http://127.0.0.1:8123/**',async route=>{
   const url=new URL(route.request().url()),file=path.join(process.env.LUNA_STAGE,decodeURIComponent(url.pathname));
   if(fs.existsSync(file)&&fs.statSync(file).isFile())await route.fulfill({path:file});else await route.continue();
  });
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  for(const main of [false,true])for(const day of [0,1,2,3])for(const flow of ['in','out']){
   await page.evaluate(async ({main,day,flow})=>{
    lunaCampaign.toPicker();lunaCampaign.session.install({developer:!main});barGame.reset(day,'full',10,false);
    barGame.progress.flags={day1_thug_done:true,day2_thug_done:true,campaign_observation:true};barGame.progress.inventory={wild_dog:1,bitters:1};
    lunaCampaign.session.day=day;lunaCampaign.session.route=flow;lunaCampaign.session.carry=structuredClone(barGame.progress);
    Object.assign(outsidePlaytest.config,{day,flow,place:'bar'});await outsidePlaytest.start();lunaCampaign.screen(lunaCampaign.playView);
    outsidePlaytest.model.thugFlags.day1_thug_done=true;outsidePlaytest.model.notionFlags={day2_thug_done:true};
   },{main,day,flow});
   const result=await page.evaluate(()=>{
    const a=outsidePlaytest,m=a.model,R=LunaResidence.layout,violations=[],renders={},levels=[];
    const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){}},position=(x,y)=>({x,y});
    function probe(){
     const record=source=>(sp,x,y)=>{
      (renders[source]??=[]).push({x,y});
      if(source==='samho'&&Math.abs(y+.7)>1e-9)violations.push({source,y,playerY:m.y});
      if(source==='notion'&&m.config.day===2&&Math.abs(y-(R.upperY-.24))>1e-9)violations.push({source,y,playerY:m.y});
      if(!Number.isFinite(x)||!Number.isFinite(y))violations.push({source,x,y});
     };
     LunaOutsideSamhoCommute.draw(m,record('samho'));
     LunaOutsideNotion.draw(m,record('notion'),ctx,position);
     LunaOutsideThug.draw(m,record('thug'),ctx,position);
     for(const n of LUNA_OUTSIDE_DATA.scenes.street.nodes){LunaOutsideResidents.drawNode(m,n,record('resident'),ctx,position);LunaOutsideEncounters.drawNode(m,n,record('trade'));}
     if(m.config.day===2&&m.config.flow==='in'){
      const anchor=LunaOutsideNotion.anchor(m,LunaOutsideNotion.thug);
      if(Math.abs(anchor.y-(R.upperY+.43))>1e-9)violations.push({source:'thug speech',y:anchor.y});
     }
     const c=a.camera,floor=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='1F Floor').y+.02;
     if(c.y-c.w*720/1280/2<floor-1e-8)violations.push({source:'camera floor',...c});
    }
    m.x=R.elevatorX;m.updateNear();a.snapCamera();a.tick(.05);
    for(let trip=0;trip<2;trip++){
     if(!m.interact()||!m.ride)throw Error('Lift did not start '+JSON.stringify({day:m.config.day,flow:m.config.flow,level:m.level,view:lunaCampaign.view,near:m.near}));
     for(let i=0;i<280&&m.ride;i++){if(i%5===0){a.tick(.05);probe();}else m.tick(.05);}
     if(m.ride)throw Error('Lift did not finish');levels.push(m.level);probe();
    }
    // Calling an empty elevator must not move either the caller or the NPCs.
    m.elevatorY=R.elevatorTop;m.updateNear();m.interact();if(!m.ride?.call)throw Error('Expected lift call');
    const y=m.y;for(let i=0;i<160&&m.ride;i++)m.tick(.05);if(m.y!==y||m.level!==0)throw Error('Caller moved');
    return{violations:violations.slice(0,5),levels,renders:Object.fromEntries(Object.entries(renders).map(([k,v])=>[k,v.length])),arrival:m.arrivals};
   });
   assert.deepEqual(result.violations,[],JSON.stringify({main,day,flow,result}));
   assert.deepEqual(result.levels,[1,0]);assert.equal(result.arrival,2);
   if([2,3].includes(day)&&flow==='in')assert(result.renders.samho>0);
   if(day===2&&flow==='in')assert(result.renders.notion>0);
   console.log('PASS lift world positions, up/down/call, camera floor',main?'main':'developer',day,flow);
  }
  // A developer restart resets local event progress; campaign progress stays separate.
  const reset=await page.evaluate(()=>{
   lunaCampaign.toPicker();lunaCampaign.session.install({developer:true});
   const m=new LunaOutside.Model({day:2,flow:'in',place:'homeDoor'});m.notionFlags.day2_thug_done=true;
   m.start({day:2,flow:'in',place:'homeDoor'});m.x=LunaResidence.layout.homeX+.2;m.tick(.05);
   return{done:!!m.notionFlags.day2_thug_done,kind:m.encounter?.kind};
  });
  assert.equal(reset.done,false);assert.equal(reset.kind,'day2-corridor-thug');
  // Story names are recorded as seen, without revealing Tom in history too early.
  const history=await page.evaluate(()=>{
   const g=barGame;lunaCampaign.toPicker();lunaCampaign.session.install({developer:true});g.reset(1,'regular',42,false);
   g.phase='regular';g.progress.flags.tom_name_known=false;g.history=[];
   const step=g.stepDone;g.stepDone=()=>{};
   g.dialogue={actor:'tom',text:'이름 공개 전',step:{type:'say'},id:'qa-tom-before'};g.finishLine();
   g.progress.flags.tom_name_known=true;g.dialogue={actor:'tom',text:'이름 공개 후',step:{type:'say'},id:'qa-tom-after'};g.finishLine();g.stepDone=step;
   g.overlay='history';lunaCampaign.screen('developer');g.changed();return g.history;
  });
  assert.equal(history[0].anonymous,true);assert.equal(history[1].anonymous,false);
  await page.waitForFunction(()=>document.querySelectorAll('.history-line').length===2);
  assert.deepEqual(await page.locator('.history-line b').allTextContents(),['???',await page.evaluate(()=>barGame.name('tom'))]);
  assert.deepEqual(errors,[]);console.log('WORLD_NPC_REGRESSION_OK 16 day/route/mode combinations + restart + history privacy');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

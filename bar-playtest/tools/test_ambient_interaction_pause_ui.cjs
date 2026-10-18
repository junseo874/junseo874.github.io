const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 for(const [main,variant]of [[false,'original'],[false,'gpt'],[true,'original']]){
  await p.evaluate(async({main,variant})=>{const c=lunaCampaign,a=outsidePlaytest;a.exit(true);c.session.uninstall();c.session.install({developer:!main});barGame.reset(0,'full',1,false);c.session.day=0;c.session.route='out';c.session.carry=structuredClone(barGame.progress);Object.assign(a.config,{day:0,flow:'out',place:'bar',variant});await a.start();c.screen(c.playView);},{main,variant});
  for(const kind of ['poster','object-modal','shop','vendor']){
   const result=await p.evaluate(kind=>{
    const a=outsidePlaytest,m=a.model,b=m.backgroundStory;
    m.story.cancel();m.encounter=null;m.dialog=null;m.config.day=['shop','vendor'].includes(kind)?2:0;m.x=-1.985;m.y=-.7;m.level=0;b.cancel();barGame.progress.money=1000;
    for(const id of ['outside_day0_port_pair','outside_day0_store_passers'])b.begin(id,{id},true);
    b.tick(.23);a.snapCamera();a.refreshHUD();
    const snapshot=()=>[...b.channels].map(([id,s])=>({id,index:s.speech.index,elapsed:s.speech.elapsed,text:s.view().text}));
    const before=snapshot();
    if(kind==='poster'){m.updateNear();if(!m.near?.source)throw Error('Poster target not found');m.interact();}
    else if(kind==='object-modal')m.dialog={title:'오브젝트',text:'확인 중'};
    else if(kind==='shop')LunaOutsideShop.interact(m,{id:'shiba-shop',x:-2.68,y:-.596});
    else LunaBDVendor.interact(m,{id:'bd-vendor',x:5.65,y:-.7});
    // Vendor/shop choice menus must keep the same pause as spoken lines.
    if(['shop','vendor'].includes(kind))for(let i=0;i<100&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}
    const started=!!m.dialog||m.story.blocking,choice=!!m.story.speech?.choice;
    let ambientAudio=0;const audio=LunaDialogueAudio.reveal;LunaDialogueAudio.reveal=(...args)=>{if(args[3])ambientAudio++;};
    for(let i=0;i<240;i++)m.tick(.05);
    LunaDialogueAudio.reveal=audio;a.refreshHUD();
    const hidden=[...document.querySelectorAll('.outside-background-speech')].every(e=>e.hidden),during=snapshot();
    if(kind==='object-modal')m.interact();
    else {if(kind==='vendor')m.story.choose('leave');if(kind==='shop')m.story.choose('shop-no');for(let i=0;i<100&&m.story.blocking;i++){m.story.speech.elapsed=99;m.story.advance();}}
    const ended=!m.dialog&&!m.story.blocking;a.refreshHUD();const resumed=snapshot(),views=b.views().length;
    b.tick(.1);const after=snapshot();
    return{before,during,resumed,after,hidden,started,ended,views,ambientAudio,choice};
   },kind);
   assert(result.started&&result.ended,kind);assert(result.hidden,kind+' hides all bubbles');assert.deepEqual(result.during,result.before,kind+' freezes typing and line clocks');assert.deepEqual(result.resumed,result.before,kind+' resumes exact position');assert.equal(result.views,2);assert.equal(result.ambientAudio,0);assert(result.after.every((s,i)=>s.elapsed>result.before[i].elapsed));if(['shop','vendor'].includes(kind))assert(result.choice);
  }
 }
 assert.deepEqual(errors,[]);console.log('AMBIENT_INTERACTION_PAUSE_OK: original/GPT/campaign, poster, object modal, NPC/shop/vendor choices, two channels freeze/hide/silent then resume exact line and typing');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

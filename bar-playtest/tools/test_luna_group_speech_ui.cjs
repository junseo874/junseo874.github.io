const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  async function setup({day=3,main=false,seats=['L','R'],order='R',actor='luna',general=false}={}){
   await p.evaluate(v=>{
    const c=lunaCampaign;c.toPicker();c.session.install({developer:!v.main});
    const g=barGame;g.reset(99,'practice',1,true);g.day=v.day;g.story=null;g.tutorial=null;g.pendingDailyUnlocks=null;
    g.screen='bar';g.phase=v.general?'general':'regular';g.transition=0;g.cameraLeft=0;g.overview=false;g.focus='L';
    g.seats={L:null,M:null,R:null};v.seats.forEach((seat,i)=>g.seats[seat]={id:'speech-test-'+i,actor:i?'tom':'samho',state:'STORY'});
    g.currentOrder=v.order?{seat:v.order,actor:'tom',cocktail:'bottle_beer'}:null;
    g.dialogue=g.makeLine(v.actor,'삼호는 톰 걸 만들고 나서 주문을 받도록 하겠습니다.');
    g.dialogue.chars=g.dialogue.text.length;
    if(v.general){g.seats.L.lines=[g.dialogue];g.seats.L.lineIndex=0;}
    g.paused=v.general;c.session.day=v.day;c.session.route='bar';c.screen(c.playView);c.render(true);
   },{day,main,seats,order,actor,general});
   await p.waitForTimeout(1050);
   await p.waitForFunction(()=>document.querySelector('.dialogue-wrap')&&!barGame.cameraMoving);
  }
  async function measure(){return p.evaluate(()=>{
   const el=document.querySelector('.dialogue-wrap'),r=el.getBoundingClientRect(),stage=document.querySelector('.bar-stage').getBoundingClientRect(),plane=document.querySelector('.counter-plane'),matrix=new DOMMatrixReadOnly(getComputedStyle(plane).transform);
   return {center:(r.x+r.width/2-stage.x)*1280/stage.width,anchor:+el.dataset.worldX,seat:el.dataset.speakerSeat,width:r.width*1280/stage.width/matrix.a,layout:el.offsetWidth};
  });}
  for(const main of [false,true])for(const day of [1,2,3]){
   await setup({main,day,order:day===1?'L':day===2?'R':null});
   const m=await measure();assert.equal(m.anchor,1020);assert.equal(m.seat,'M');assert(Math.abs(m.center-640)<1);
  }
  for(const seats of [['L','M'],['M','R'],['L','M','R']]){
   await setup({seats});assert.equal((await measure()).anchor,1020);assert(Math.abs((await measure()).center-640)<1);
  }
  // Keep both customers attached to their own seats.
  for(const [actor,center,seat]of [['samho',370,'L'],['tom',910,'R']]){
   await setup({actor});const m=await measure();assert(Math.abs(m.center-center)<1);assert.equal(m.seat,seat);
  }
  // One guest and ordinary service retain their existing closer-seat anchor.
  for(const seat of ['L','R']){
   await setup({seats:[seat],order:null});assert(Math.abs((await measure()).center-640)<1);
  }
  await setup({general:true,order:'L'});assert.equal((await measure()).anchor,520);
  // Match the reported Samho/Tom screen, then preserve world geometry through zoom.
  await setup({main:true,day:3,order:'R'});
  await p.screenshot({path:'/private/tmp/luna-group-speech-centered.png'});
  const before=await measure();
  await p.evaluate(()=>{barGame.seats.R=null;barGame.currentOrder=null;lunaCampaign.render(true);});
  await p.waitForTimeout(1050);const after=await measure();
  assert.equal(after.anchor,before.anchor,'same line keeps its world anchor during camera changes');
  assert.equal(after.layout,before.layout);assert(Math.abs(after.width-before.width)<.1);
  assert.deepEqual(errors,[]);console.log('LUNA_GROUP_SPEECH_OK main/developer days1-3, order independence, all seat pairs, guest anchors, solo/general, fixed world geometry');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

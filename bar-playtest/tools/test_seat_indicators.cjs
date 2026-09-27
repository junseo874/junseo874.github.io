const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const f of ['data.js','bar-views.js'])vm.runInContext(fs.readFileSync(dir+'/'+f,'utf8'),ctx);
const D=ctx.window.LUNA_DATA,guest={id:'a',state:'WAIT_COASTER',left:100,limit:100};
const g={realTime:0,seats:{L:guest},logs:[]},v=ctx.window.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
const s=()=>v.seatIndicator('L');
assert(s().className.includes('pulse-arrival'));g.realTime=.45;assert(s().className.includes('pulse-dim'));
g.realTime=3;assert.equal(s().className,'seat-occupied');
guest.left=50;assert.equal(s().state,'warn');guest.left=50.01;assert.equal(s().state,'occupied');
guest.left=10.01;assert.equal(s().state,'warn');guest.left=10;assert.equal(s().state,'danger');
guest.left=8;guest.limit=12;assert.equal(s().state,'danger','10 seconds outranks half patience');
guest.state='REACTION';assert.equal(s().state,'occupied','Do not warn after service');
guest.state='EXITING';assert.equal(s().state,'exit');g.realTime=3.45;assert(s().className.includes('pulse-dim'));
g.seats.L=null;assert.equal(s().className,'seat-empty');
g.seats.L={...guest,id:'new',state:'WAIT_COASTER',left:100,limit:100};assert(s().className.includes('pulse-arrival'));
g.seats.L={...guest,id:'late',state:'WAIT_COASTER',left:100,limit:100};g.logs.push({event:'guest_enter',guest:'late',time:0});assert(!s().className.includes('pulse-arrival'));
console.log('SEAT_UNIT_OK: entry once, replacement guest, stale entry, exact 50%/10s, danger precedence, exit/empty/reset.');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/');
 for(const variant of ['original','gpt']){
  await p.evaluate(()=>barGame.reset(99,'practice',1,false));
  await p.locator('[data-act="version"][data-id="'+variant+'"]').click();
  await p.evaluate(variant=>{
   const g=barGame;g.reset(99,'general',7,true,{variant});for(let i=0;i<100;i++)g.tick(.1);
   const base=g.seats.L;g.queue=[];g.queueIndex=0;g.speed=0;g.focus='L';g.overview=false;g.cameraLeft=0;g.dialogue=null;
   const make=(seat,left,state)=>({...base,id:'indicator_'+seat,seat,left,limit:100,state,order:state==='WAIT_SERVE'?{id:'order_'+seat,cocktail:'gin_tonic',seat}:null,lines:[],lineIndex:0,lineDone:null,exitLeft:999});
   g.seats={L:make('L',100,'WAIT_COASTER'),M:make('M',50,'WAIT_SERVE'),R:make('R',0,'EXITING')};
   for(const seat of ['L','M','R'])g.log('guest_enter',{guest:g.seats[seat].id,seat});
  },variant);
  const button=seat=>p.locator('.seat-indicators [data-id="'+seat+'"]');
  await button('M').waitFor();await p.waitForFunction(()=>document.querySelector('.seat-indicators [data-id=M]')?.classList.contains('seat-warn'));
  assert.equal(await button('M').locator('span').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 167, 71)');
  assert.equal(await button('R').locator('span').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 98, 91)');
  for(const seat of ['M','R'])assert.equal(await button(seat).evaluate(e=>getComputedStyle(e,'::after').content),'none','No warning glyph');
  const samples=[];for(let i=0;i<9;i++){samples.push(await button('L').getAttribute('class'));await p.waitForTimeout(100);}
  assert(samples.some(s=>s.includes('seat-pulse-dim'))&&samples.some(s=>!s.includes('seat-pulse-dim')));
  await button('M').click();await p.waitForFunction(()=>barGame.focus==='M');
  assert.equal(await button('M').getAttribute('aria-pressed'),'true');
  assert.equal(await button('M').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  assert.equal(await button('M').locator('span').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 167, 71)');
  await p.evaluate(()=>{barGame.seats.M.left=10;});await p.waitForFunction(()=>document.querySelector('.seat-indicators [data-id=M]').classList.contains('seat-danger'));
  await p.keyboard.press('Escape');await p.waitForTimeout(180);
  const paused=await button('R').getAttribute('class');await p.waitForTimeout(500);assert.equal(await button('R').getAttribute('class'),paused);
  await p.keyboard.press('Escape');await p.waitForTimeout(2600);assert(!(await button('L').getAttribute('class')).includes('pulse-arrival'),JSON.stringify(await p.evaluate(()=>({time:barGame.realTime,paused:barGame.isPaused(),overlay:barGame.overlay,error:barGame.error,entry:barGame.logs.filter(e=>e.event==='guest_enter').slice(-3)}))));
  await p.evaluate(()=>{barGame.seats.L=null;barGame.seats.M.left=45;});
  await p.waitForFunction(()=>document.querySelector('.seat-indicators [data-id=L]').classList.contains('seat-empty'));
  await p.screenshot({path:'/private/tmp/seat-indicators-'+variant+'.png'});
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.waitForFunction(()=>document.querySelector('.seat-indicators [data-id=R]').classList.contains('seat-pulse-dim'));
  assert.equal(await button('R').locator('span').evaluate(e=>getComputedStyle(e).opacity),'1');
  await p.emulateMedia({reducedMotion:'no-preference'});
 }
 assert.deepEqual(errors,[]);console.log('SEAT_UI_OK: both variants, green/orange/red, entry blink, selected ring retains warning, exit blink, pause, empty, reduced motion, click navigation.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});

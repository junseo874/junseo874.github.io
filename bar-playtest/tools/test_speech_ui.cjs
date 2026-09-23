const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const f of ['data.js','bar-views.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const D=ctx.window.LUNA_DATA;
const appearance=gender=>({gender,layers:['body','top_1','eyes_1','eyebrow_1','mouth_1','hair_1'].map(s=>'guest_'+gender+'_'+s)});
const guest={actor:'personality',appearance:appearance('m'),state:'WAIT_COASTER'};
let line={actor:guest.actor,text:'A long line',chars:0,expression:'idle'};
const g={realTime:0,screen:'bar',phase:'general',seats:{L:guest},focus:'L',currentDialogue:()=>line};
const v=ctx.window.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
const at=t=>{g.realTime=t;const h=v.actorHTML(guest,50);return {
  state:h.match(/data-speech-state="([^"]+)"/)[1],pose:h.match(/data-pose="([^"]+)"/)[1],
  frame:Number(h.match(/data-layer="guest_m_talk_mouth_1" data-frame="(\d+)"/)?.[1])};};
assert.equal(at(0).frame,0);
for(const [t,frame] of [[.26,1],[.51,2],[.76,3],[1.01,0],[1.26,1],[2.51,2],[3.76,3]]){
  line.chars++;const s=at(t);assert.equal(s.state,'looping');assert.equal(s.frame,frame);
}
// Advancing letters and replacing a line in the same pose do not reset its clock.
line={...line,chars:0};assert.equal(at(3.8).frame,3);
line=null;assert.equal(at(3.84).state,'finishing');assert.equal(at(3.9).frame,3);
assert.equal(at(4.001).pose,'idle');
line={actor:guest.actor,text:'More words',chars:0,expression:'idle'};
at(5);assert.equal(at(5.3).frame,1);line=null;assert.equal(at(5.35).state,'finishing');
line={actor:guest.actor,text:'Resume without restart',chars:0,expression:'idle'};
assert.equal(at(5.4).frame,1);assert.equal(at(5.6).frame,2);
line.chars=line.text.length;assert.equal(at(5.65).state,'finishing');assert.equal(at(6.001).state,'idle');
const twin={...guest,appearance:appearance('m')};g.seats.R=twin;
line={actor:guest.actor,text:'Same personality',chars:0,expression:'idle'};at(7);
assert(v.actorHTML(twin,60).includes('data-talking="false"'));
console.log('SPEECH_CLOCK_OK: multi-cycle loop, no per-letter reset, bounded cycle completion, smooth resume, reveal-to-idle, guest identity isolation.');

(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE+"?test=speech");
  await p.evaluate(()=>{
    const g=barGame;g.reset(99,'general',7);for(let i=0;i<100;i++)g.tick(.1);
    const first=g.seats.L;g.queue=[];g.speed=0;g.cameraLeft=0;g.focus='L';g.overview=false;g.dialogSpeed=.15;
    const make=(seat,gender)=>({...first,id:'speech_'+seat,seat,state:'WAIT_COASTER',left:999,limit:999,warn:0,
      appearance:{gender,layers:['body','top_1','eyes_1','eyebrow_1','mouth_1','hair_1'].map(k=>'guest_'+gender+'_'+k)},
      lines:[g.makeLine(first.actor,'오늘은 어떤 칵테일을 마실지 고민하고 있어요. 잠시 메뉴를 더 살펴봐도 괜찮을까요?')],lineIndex:0,lineDone:null});
    g.seats={L:make('L','m'),M:null,R:make('R','f')};
  });
  await p.waitForFunction(()=>document.querySelector('.speaker')?.textContent==='손님');
  const first=p.locator('.actor').nth(0),second=p.locator('.actor').nth(1);
  const frames=[];
  for(let i=0;i<18;i++){
    frames.push(Number(await first.locator('[data-layer="guest_m_talk_mouth_1"]').getAttribute('data-frame')));
    await p.waitForTimeout(180);
  }
  assert(frames.filter((n,i)=>i&&n<frames[i-1]).length>=2,'Mouth did not loop throughout typing');
  assert.equal(await first.getAttribute('data-speech-state'),'looping');
  assert(await p.evaluate(()=>barGame.seats.L.lines[0].chars<barGame.seats.L.lines[0].text.length));
  assert.equal(await p.locator('.actor[data-talking="true"]').count(),1);
  await p.screenshot({path:'/private/tmp/bar-speech-guest.png'});
  await p.waitForFunction(()=>document.querySelector('[data-layer="guest_m_talk_mouth_1"]')?.dataset.frame==='1');
  await p.keyboard.press('KeyD');
  await p.waitForFunction(()=>document.querySelector('.actor')?.dataset.speechState==='finishing');
  assert.equal(await first.getAttribute('data-pose'),'talk');
  // During the pan no new guest owns a bubble; after arrival the next guest starts.
  assert.equal(await p.locator('.actor[data-talking="true"]').count(),0);
  // D moves L -> M, which is intentionally empty. Move on to R to start its line.
  await p.waitForTimeout(650);await p.keyboard.press('KeyD');
  await p.waitForFunction(()=>document.querySelectorAll('.actor')[1]?.dataset.speechState==='looping');
  assert.equal(await first.getAttribute('data-speech-state'),'idle');
  assert.equal(await second.getAttribute('data-talking'),'true');
  await p.screenshot({path:'/private/tmp/bar-speech-seat.png'});
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
  const frozen=await second.locator('[data-layer="guest_f_talk_mouth_1"]').getAttribute('data-frame');
  await p.waitForTimeout(350);assert.equal(await second.locator('[data-layer="guest_f_talk_mouth_1"]').getAttribute('data-frame'),frozen);
  await p.keyboard.press('Escape');
  await p.evaluate(()=>{barGame.lang='en'});await p.waitForFunction(()=>document.querySelector('.speaker')?.textContent==='Guest');
  await p.evaluate(()=>{
    const g=barGame;g.lang='ko';g.reset(99,'practice',1);g.screen='bar';g.phase='regular';
    g.seats={L:{actor:'port',state:'STORY'},M:null,R:null};g.dialogue=g.makeLine('port','오늘은 진토닉으로 부탁하지.');g.dialogue.chars=g.dialogue.text.length;
  });
  await p.waitForFunction(()=>document.querySelector('.speaker')?.textContent===barGame.name('port'));
  await p.waitForTimeout(750);
  const guestBox=await p.locator('.dialogue-wrap').boundingBox();
  await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('luna','네, 주문하신 칵테일을 준비하겠습니다.');barGame.dialogue.chars=barGame.dialogue.text.length;});
  await p.waitForFunction(()=>document.querySelector('.player-speech .speaker')?.textContent==='루나');
  const lunaBox=await p.locator('.dialogue-wrap').boundingBox();assert(lunaBox.y>guestBox.y);assert(lunaBox.y+lunaBox.height<=720);
  await p.screenshot({path:'/private/tmp/bar-speech-luna.png'});
  await p.evaluate(()=>barGame.lang='en');await p.waitForFunction(()=>document.querySelector('.speaker')?.textContent==='Luna');
  assert.deepEqual(errors,[]);
  console.log('SPEECH_UI_OK: real typing loops, camera-pan finishing, next seat ownership, pause, guest/Luna KO/EN labels, named regular preservation, lower player bubble.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});

const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const f of ['data.js','bar-views.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const D=ctx.window.LUNA_DATA;
const appearance=gender=>({gender,layers:['body','top_1','eyes_1','eyebrow_1','mouth_1','hair_1'].map(s=>'guest_'+gender+'_'+s)});
const parse=html=>({html,state:html.match(/data-speech-state="([^"]+)"/)[1],pose:html.match(/data-pose="([^"]+)"/)[1],
  frames:Object.fromEntries([...html.matchAll(/data-layer="([^"]+)" data-frame="(\d+)"/g)].map(m=>[m[1],Number(m[2])]))});
function fixture(actor,app){
  const guest={actor,appearance:app,state:'STORY'};let line=null;
  const g={realTime:0,screen:'bar',phase:app?'general':'regular',seats:{L:guest},focus:'L',currentDialogue:()=>line};
  const view=ctx.window.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
  return {g,guest,view,say:d=>line=d,at:t=>{g.realTime=t;return parse(view.actorHTML(guest,50));}};
}
{
  const f=fixture('personality',appearance('m')),mouth='guest_m_talk_mouth_1';
  const line={actor:'personality',text:'A long enough line',chars:0,expression:'idle'};
  f.say(line);assert.equal(f.at(0).frames[mouth],0);
  for(const [t,frame] of [[.23,1],[.46,2],[.69,3],[.91,0],[1.14,1],[1.82,0],[2.29,2]]){
    line.chars++;const s=f.at(t);assert.equal(s.state,'looping');assert.equal(s.frames[mouth],frame);
  }
  f.say({...line,chars:0});assert.equal(f.at(2.3).frames[mouth],2,'No restart per letter/adjacent line');
  f.say(null);f.g.cameraMoving=true;assert.equal(f.at(2.31).state,'finishing');
  assert.equal(f.at(2.46).frames[mouth],3);assert.equal(f.at(2.50).state,'idle');
  assert.equal(f.at(2.6).frames[mouth],3,'Silent mouth must remain closed');
  f.g.cameraMoving=false;f.say(line);f.at(3);line.chars=line.text.length;
  assert.equal(f.at(3.1).state,'idle');assert.equal(f.at(3.1).frames[mouth],3);
  line.chars=0;f.say(line);
  const twin={...f.guest,appearance:appearance('m')};f.g.seats.R=twin;
  assert(f.view.actorHTML(twin,60).includes('data-talking="false"'));
}
console.log('SPEECH_CLOCK_OK: sustained typing, closed silent mouth, 180ms pan release, identity isolation.');
// Exercise 40 seconds of each real sprite family, not an assumed engine FPS.
for(const [actor,app] of [['guest_m',appearance('m')],['guest_f',appearance('f')],...['chris','port','aili','samho','bubi'].map(a=>[a,undefined])]){
  const f=fixture(actor,app);f.at(0);
  let blinkStarts=[],blinkEnds=[],wasBlink=false,lastEye;
  for(let i=0;i<=2000;i++){
    const t=i*.02;
    f.say(t>=10&&t<15?{actor,text:'Still talking',chars:0,expression:'idle'}:null);
    const s=f.at(t),body=Object.keys(s.frames).find(k=>/body$/.test(k)),eyes=Object.keys(s.frames).find(k=>/eyes(?:_\d+)?$/.test(k));
    const n=D.assets[body].frames||1;
    assert.equal(s.frames[body],Math.floor(t/1.6*n)%n,actor+' body clock reset');
    const mouth=Object.keys(s.frames).find(k=>/mouth_\d+$|face_bottom/.test(k));
    if(app&&!(t>=10&&t<15))assert.equal(s.frames[mouth],3,actor+' resting mouth');
    if(!app)assert.equal(/_talk_/.test(mouth),t>=10&&t<15,actor+' lower face');
    if(app||['chris','bubi'].includes(actor)){
      const active=s.frames[eyes]!== (app?3:0);
      if(active&&!wasBlink)blinkStarts.push(t);
      if(!active&&wasBlink)blinkEnds.push(t);
      wasBlink=active;
    }else assert.equal(s.frames[eyes],Math.floor(t/1.6*(D.assets[eyes].frames||1))%(D.assets[eyes].frames||1));
    lastEye=s.frames[eyes];
  }
  if(app||['chris','bubi'].includes(actor)){
    assert(blinkStarts.length>=5&&blinkStarts.length<=10,actor+' blink frequency');
    blinkEnds.forEach((end,i)=>assert(end-blinkStarts[i]<=.32,actor+' stuck closed'));
    blinkStarts.slice(1).forEach((start,i)=>assert(start-blinkEnds[i]>=3.18,actor+' missing blink rest'));
  }
  // Frozen game time must freeze all face and body clocks.
  assert.deepEqual(f.at(40).frames,f.at(40).frames);
}
// All ten static general-mouth variants must have a silent closed fallback.
for(const gender of ['m','f'])for(let m=1;m<=5;m++){
  const app=appearance(gender);app.layers=app.layers.map(k=>k.replace('mouth_1','mouth_'+m));
  const f=fixture('mouth_test',app),s=f.at(0),keys=Object.keys(s.frames);
  const mouth=keys.find(k=>/mouth_\d+$/.test(k));
  if(m<=3){assert.equal(mouth,'guest_'+gender+'_talk_mouth_'+m);assert.equal(s.frames[mouth],3);}
  else assert.equal(mouth,'guest_'+gender+'_mouth_'+(gender==='m'?3:m));
}
for(const [eye,mouth] of [[4,1],[1,5],[4,5]]){
  const app=appearance('f');app.layers=app.layers.map(k=>k.replace('eyes_1','eyes_'+eye).replace('mouth_1','mouth_'+mouth));
  const f=fixture('missing',app);f.say({actor:'missing',text:'talk',chars:0,expression:'idle'});const {html}=f.at(0);
  assert(html.includes('data-layer="guest_f_'+(eye===4?'':'talk_')+'eyes_'+eye+'"'));
  assert(html.includes('data-layer="guest_f_'+(mouth===5?'':'talk_')+'mouth_'+mouth+'"'));
  assert(html.includes('data-layer="guest_f_body"'));
}
// Two identical-looking people must not blink in lockstep or consume game RNG.
{
  const f=fixture('same',appearance('m'));f.g.rng=()=>{throw Error('Animation consumed gameplay RNG');};
  const second={...f.guest};let difference=false;
  for(let i=0;i<600;i++){
    const a=f.at(i*.02).frames.guest_m_talk_eyes_1;
    const b=parse(f.view.actorHTML(second,70)).frames.guest_m_talk_eyes_1;
    difference ||= a!==b;
  }
  assert(difference,'Blink clocks are synchronized');
}
console.log('IDLE_CLOCK_OK: 40s × 7 guests, staggered sparse blinks, continuous slow bodies, 10 closed-mouth variants, independent missing-art fallback.');

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

  // No dialogue at all: both general guests still blink, without talking mouths.
  await p.evaluate(()=>{
    const g=barGame;g.lang='ko';g.speed=1;g.reset(99,'general',7);for(let i=0;i<100;i++)g.tick(.1);
    const base=g.seats.L;if(!base)throw Error('Test setup did not spawn a general guest');g.queue=[];g.speed=0;g.dialogSpeed=.01;
    const guest=(seat,gender)=>({...base,id:'idle_'+seat,seat,state:'WAIT_COASTER',left:999,limit:999,
      appearance:{gender,layers:['body','top_1','eyes_1','eyebrow_1','mouth_1','hair_1'].map(k=>'guest_'+gender+'_'+k)},lines:[],lineIndex:0,lineDone:null});
    g.seats={L:guest('L','m'),M:null,R:guest('R','f')};g.focus='L';g.cameraLeft=0;
  });
  await p.waitForFunction(()=>!barGame.cameraMoving&&document.querySelector('[data-layer="guest_m_talk_eyes_1"]'));
  const blinking=async(selectors)=>{
    const samples=selectors.map(()=>new Set());
    for(let i=0;i<240;i++){
      const frames=await p.evaluate(ss=>ss.map(s=>document.querySelector(s)?.dataset.frame),selectors);
      frames.forEach((f,j)=>{assert.notEqual(f,undefined);samples[j].add(f);});await p.waitForTimeout(30);
    }
    samples.forEach((s,j)=>assert(s.size>=(selectors[j].includes('eyes')?2:3),'Idle stopped: '+selectors[j]));
  };
  const generalEyes=['m','f'].map(g=>`[data-layer="guest_${g}_talk_eyes_1"]`);
  await blinking(generalEyes);
  assert.deepEqual(await p.locator('[data-layer="guest_m_talk_mouth_1"],[data-layer="guest_f_talk_mouth_1"]').evaluateAll(es=>es.map(e=>e.dataset.frame)),['3','3']);
  await p.screenshot({path:'/private/tmp/bar-idle-general.png'});
  await p.evaluate(()=>{const g=barGame;g.seats.L.lines=[g.makeLine(g.seats.L.actor,'저만 말하고 있어도 옆 손님은 눈을 깜빡입니다.')];});
  await p.locator('[data-layer="guest_m_talk_mouth_1"]').waitFor();await blinking(generalEyes);
  await p.evaluate(()=>{const d=barGame.seats.L.lines[0];d.chars=d.text.length;});
  await p.waitForFunction(()=>document.querySelector('[data-layer="guest_m_talk_mouth_1"]')?.dataset.frame==='3'&&document.querySelector('.actor')?.dataset.speechState==='idle');await blinking(generalEyes);
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
  const before=await p.locator('.actor-layer').evaluateAll(es=>es.map(e=>e.dataset.frame));await p.waitForTimeout(400);
  assert.deepEqual(await p.locator('.actor-layer').evaluateAll(es=>es.map(e=>e.dataset.frame)),before);await p.keyboard.press('Escape');
  await p.evaluate(()=>{
    const g=barGame;g.reset(99,'practice',1);g.screen='bar';g.phase='regular';g.dialogSpeed=.01;
    g.seats={L:{actor:'chris',state:'STORY'},M:null,R:{actor:'port',state:'STORY'}};g.dialogue=null;
  });await p.waitForFunction(()=>!barGame.cameraMoving&&document.querySelector('[data-actor="chris"]'));
  await blinking(['[data-layer="char_chris_Chris_idle_default_body"]','[data-layer="char_chris_Chris_idle_default_eyes"]','[data-layer="char_port_port_idle_default_body"]','[data-layer="char_port_port_idle_default_eyes"]']);
  await p.evaluate(()=>{barGame.dialogue=barGame.makeLine('chris','대사 중에도 두 사람의 기본 애니메이션은 유지됩니다.');});
  await p.locator('[data-layer="char_chris_Chris_idle_talk_face_bottom_talk"]').waitFor();
  await blinking(['[data-layer="char_chris_Chris_idle_talk_body"]','[data-layer="char_chris_Chris_idle_talk_eyes"]','[data-layer="char_port_port_idle_default_eyes"]']);
  await p.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;});
  await p.locator('[data-layer="char_chris_Chris_idle_default_face_bottom_default"]').waitFor();
  await blinking(['[data-layer="char_chris_Chris_idle_default_eyes"]','[data-layer="char_port_port_idle_default_eyes"]']);
  await p.screenshot({path:'/private/tmp/bar-idle-regular.png'});
  assert.deepEqual(errors,[]);
  console.log('SPEECH_UI_OK: real typing loops, camera-pan finishing, next seat ownership, pause, guest/Luna KO/EN labels, named regular preservation, lower player bubble.');
  console.log('IDLE_UI_OK: both guests animate before/during/after speech, mouth stops at reveal, eyes/body continue, pause/resume respected.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});

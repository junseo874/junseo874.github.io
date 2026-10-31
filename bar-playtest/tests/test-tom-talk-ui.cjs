const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),rt=require('../../tools/lib/test-runtime.cjs');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['data/runtime/game-data.js','src/features/bar/bar-guest-art.js','src/features/bar/bar-views.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const D=W.LUNA_DATA,mouth='char_tom_talk_face_bottom_talk';
for(const key of new Set([...D.characterLayers.tom.idle_default,...D.characterLayers.tom.idle_talk])){const a=D.assets[key];assert.equal(a.w,2204);assert.equal(a.h,530);assert.equal(a.frameWidth,551);assert.equal(a.frames,4);assert(fs.existsSync(path.join(root,a.src)));}
const guest={actor:'tom',seated:true,state:'STORY'},g={realTime:0,screen:'bar',phase:'regular',seats:{M:guest},focus:'M',currentDialogue:()=>line};
let line=null;const view=W.LunaBarViews({D,g,ui:{},L:k=>k,esc:String});
function sample(t){g.realTime=t;const html=view.actorHTML(guest,50);return{html,parts:[...html.matchAll(/data-layer="([^"]+)" data-frame="(\d+)" style="([^"]+)"/g)].map(m=>({key:m[1],frame:+m[2],bottom:parseFloat(m[3].match(/bottom:([^;]+)/)[1])}))};}
sample(0);line={actor:'tom',expression:'idle',text:'톰의 긴 대사',chars:0};sample(.01);
const shifts=[0,1,1,-1],combinations=new Set();
for(let i=0;i<400;i++){
 const t=.01+(i+.37)*.037,s=sample(t),body=Math.floor(t/1.6*4)%4,sp=Math.floor((t-.01)/.9*4)%4;
 assert.equal(s.parts.length,5);const lips=s.parts.find(p=>p.key===mouth);assert(lips);
 assert.equal(lips.frame,sp,'mouth clock at '+t);assert(Math.abs(-lips.bottom*530/100-(shifts[body]-shifts[sp]))<1e-8,'chin tracks head, not articulation frame');
 assert(s.parts.filter(p=>p!==lips).every(p=>p.frame===body),'body/eyes/brows retain breathing clock');combinations.add(body+':'+sp);
}
assert.equal(combinations.size,16);
line.chars=line.text.length;assert(sample(15).parts.every(p=>p.key.startsWith('char_tom_idle_')),'completion restores original idle');
line={actor:'luna',text:'루나의 대사',chars:0};assert(sample(15.2).parts.every(p=>p.key.startsWith('char_tom_idle_')),'another speaker cannot animate Tom mouth');
assert.equal(sample(15.2).html,sample(15.2).html,'paused clock is stable');
console.log('TOM_TALK_CLOCK_OK: 16 head/mouth combinations, independent .9s speech, continuous 1.6s body, completion and speaker handoff');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  for(const mode of ['original','gpt','campaign']){
   await p.evaluate(mode=>{const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:mode!=='campaign'});c.ui.variant=mode==='gpt'?'gpt':'original';g.reset(1,'regular',42,true,{variant:c.ui.variant});Object.assign(g,{overlay:null,tutorial:null,pendingDailyUnlocks:false,transition:0,cameraLeft:0,cameraMoving:false,story:null,choice:null,screen:'bar',phase:'regular',paused:true});g.seats={L:null,M:{id:'tom',actor:'tom',seated:true,state:'STORY',coaster:true,expression:'idle'},R:null};g.dialogue=g.makeLine('tom','대화 시트의 입 움직임과 정렬을 확인하고 있어.');g.dialogue.chars=0;c.screen(c.playView);g.changed();},mode);
   await p.waitForFunction(()=>document.querySelector('.actor[data-actor="tom"][data-pose="idle_talk"] [data-layer="char_tom_talk_face_bottom_talk"]'));
   const actor=p.locator('.actor[data-actor="tom"]');const before=await actor.boundingBox();
   const result=await p.evaluate(()=>{
    const g=barGame,read=()=>[...document.querySelectorAll('.actor[data-actor="tom"] .actor-layer')].map(e=>({key:e.dataset.layer,frame:+e.dataset.frame,bottom:e.style.bottom})),samples=[];
    for(let i=0;i<20;i++){g.realTime+=.113;lunaCampaign.render(true);samples.push(read());}
    g.dialogue.chars=g.dialogue.text.length;lunaCampaign.render(true);const idle=read();g.dialogue=g.makeLine('luna','다른 사람이 말하는 중입니다.');lunaCampaign.render(true);return{samples,idle,other:read()};
   });
   assert(result.samples.every(s=>s.length===5));assert.equal(new Set(result.samples.map(s=>s.find(p=>p.key===mouth).frame)).size,4);
   assert(result.idle.every(p=>p.key.startsWith('char_tom_idle_')));assert.deepEqual(result.idle,result.other);
   assert.deepEqual(await actor.boundingBox(),before,'no position/size jump on pose change');assert.equal(await actor.getAttribute('data-table-anchor'),'420');
   const baseline=await actor.locator('.actor-layer').first().evaluate(el=>{const r=el.getBoundingClientRect(),plane=document.querySelector('.counter-plane').getBoundingClientRect();return{actual:r.top+r.height*420/530,expected:plane.top+500*plane.width/2041};});assert(Math.abs(baseline.actual-baseline.expected)<1,'torso stays at bar surface');
   await p.evaluate(()=>{const g=barGame;g.dialogue=g.makeLine('tom','내가 말할 때만 자연스럽게 움직이는 거지.');g.dialogue.chars=0;lunaCampaign.render(true);});
   for(let frame=0;frame<4;frame++){await p.evaluate(()=>{barGame.realTime+=.225;lunaCampaign.render(true);});await p.screenshot({path:'/private/tmp/tom-talk-'+mode+'-'+frame+'.png'});}
   const paused=await actor.innerHTML();await p.waitForTimeout(180);assert.equal(await actor.innerHTML(),paused,'pause freezes all five layers');
   await p.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;lunaCampaign.render(true);});await p.screenshot({path:'/private/tmp/tom-idle-'+mode+'.png'});
  }
  await p.setViewportSize({width:960,height:540});assert(await p.locator('.actor[data-actor="tom"]').isVisible());
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
  const record=await p.evaluate(()=>resourceReview.rows.find(r=>r.id==='actor:tom:idle_talk'));
  assert(record.layers.some(l=>l.key===mouth&&l.frames===4));assert(record.layers.some(l=>l.key==='char_tom_talk_body'));
  assert.deepEqual(errors,[]);console.log('TOM_TALK_UI_OK: original/remix/main, five decoded layers, all mouth frames, idle/handoff/pause, stable table anchor, review catalog');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

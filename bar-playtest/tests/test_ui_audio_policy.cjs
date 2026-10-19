const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.uiCues={hover:0,click:0};const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){const d=this.buffer?.duration;if(Math.abs(d-5455/48000)<.0001)uiCues.hover++;if(Math.abs(d-52267/48000)<.0001)uiCues.click++;return start.apply(this,args);};});
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.waitForFunction(()=>LunaHoverAudio.ready&&LunaClickAudio.ready);
 // Use real delegated events in the campaign root. Test controls have no
 // campaign actions, so sound checks cannot accidentally change game state.
 await p.evaluate(()=>{const fixture=document.createElement('div');fixture.id='audio-policy-fixture';fixture.style='position:fixed;right:20px;top:20px;z-index:99999;background:#123;padding:20px';lunaCampaign.host.append(fixture);});
 await p.addStyleTag({content:'#audio-policy-fixture *{position:static!important;transform:none!important;display:block!important;width:auto!important;height:auto!important;min-width:0!important;max-width:none!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;animation:none!important;margin:0!important}#audio-policy-fixture button{padding:15px!important}'});
 const cases=[
  ['bar dialogue','<div class="dialogue-wrap"><button data-act="advance">말풍선</button></div>',0,0],
  ['bar choice','<div class="choices"><button data-act="choice">선택지</button></div>',1,0],
  ['outside dialogue','<button class="outside-speech">대사</button>',0,0],
  ['poster exit','<section class="outside-inspection"><button data-outside-action="interact">나가기</button></section>',0,0],
  ['seat A/D','<button data-act="seat">A</button>',0,0],
  ['shelf A/D','<button data-act="shelfCategory">D</button>',0,0],
  ['coaster','<button data-drag="coaster">코스터</button>',0,0],
  ['cocktail','<button data-drag="drink">칵테일</button>',0,0],
  ['tutorial','<div class="day0-guide"><button>확인</button></div>',0,0],
  ['seat guide','<div class="day0-seat-legend"><button>확인</button></div>',0,0],
  ['movement guide','<div class="outside-controls-tutorial"><button>닫기</button></div>',0,0],
  ['pour guide','<div class="pour-tutorial"><button>확인</button></div>',0,0],
  ['service opener','<button data-act="service">서비스</button>',0,0],
  ['service child','<div id="service-panel"><button data-act="sales">매출</button></div>',0,0],
  ['recipe card','<div class="recipe-list"><button data-act="selectRecipe">레시피</button></div>',0,0],
  ['recipe detail','<div class="prep-recipe"><button>닫기</button></div>',0,0],
  ['recipe toggle','<button data-act="togglePrepRecipe">상세 레시피</button>',0,0],
  ['craft start','<button data-act="craft">제조 시작</button>',1,0],
  ['settings kept','<button>설정</button>',1,1]
 ];
 for(const [label,html,hover,click] of cases){
  await p.mouse.move(5,5);await p.evaluate(html=>document.querySelector('#audio-policy-fixture').innerHTML=html,html);
  const before=await p.evaluate(()=>({...uiCues}));
  await p.locator('#audio-policy-fixture button').hover();await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>uiCues.hover)-before.hover,hover,label+' hover');
  await p.locator('#audio-policy-fixture button').click();await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>uiCues.click)-before.click,click,label+' click');
 }
 await p.mouse.move(5,5);await p.evaluate(()=>document.querySelector('#audio-policy-fixture').innerHTML='<div class="choices"><button data-act="choice">새 선택지</button></div>');
 const before=await p.evaluate(()=>uiCues.hover);await p.locator('#audio-policy-fixture button').focus();await p.waitForTimeout(160);assert.equal(await p.evaluate(()=>uiCues.hover),before,'Auto-focus is silent');
 await p.evaluate(()=>{
  const saved=window.outsidePlaytest,m={near:null},el=document.createElement('button'),holder=document.createElement('div');
  holder.id='outside-root';holder.append(el);el.dataset.outsideAction='interact';
  try{
   window.outsidePlaytest={model:m};
   m.near={id:'wanted-poster'};
   if(LunaUIAudioPolicy.allows(el,'click')||LunaUIAudioPolicy.allows(el,'hover'))throw Error('Poster entry must be silent');
   m.near={id:'elevator'};
   if(!LunaUIAudioPolicy.allows(el,'click')||!LunaUIAudioPolicy.allows(el,'hover'))throw Error('Other interaction sound changed');
  }finally{window.outsidePlaytest=saved;}
 });
 await p.evaluate(()=>{
  const saved=window.barGame,holder=document.createElement('div'),el=document.createElement('button');holder.id='app';holder.append(el);
  try{for(const screen of ['gimmick','result','discarding','minigame_result']){
   window.barGame={screen,overlay:null};
   if(LunaUIAudioPolicy.allows(el,'click'))throw Error(screen+' click must be silent');
   if(!LunaUIAudioPolicy.allows(el,'hover'))throw Error('Hover feedback must remain');
   window.barGame.overlay='settings';if(!LunaUIAudioPolicy.allows(el,'click'))throw Error('Settings click must remain');
  }}finally{window.barGame=saved;}
 });
 assert.deepEqual(errors,[]);console.log('PASS silent crafting/serving clicks, poster, dialogue and retained settings/hover feedback.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

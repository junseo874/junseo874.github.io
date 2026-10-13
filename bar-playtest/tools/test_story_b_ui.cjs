const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();
 await p.locator('[data-campaign="story:B"]').waitFor();await p.screenshot({path:'/private/tmp/story-version-picker.png'});
 await p.locator('[data-campaign="story:B"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue'||lunaCampaign.view==='load-error',null,{timeout:60000});
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue',await p.evaluate(()=>lunaCampaign.loadError));
 assert.equal(await p.evaluate(()=>lunaCampaign.storyVersion),'B');assert.equal(await p.evaluate(()=>outsidePlaytest.active),false);
 assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.lines[0].text),'루나, 활성화된 프로토콜은?');
 await p.keyboard.down('Space');await p.waitForFunction(()=>lunaCampaign.view==='awakening');await p.keyboard.up('Space');await p.waitForFunction(()=>lunaCampaign.view==='game');
 await p.waitForFunction(()=>barGame.dialogue?.text==='루나, 듣고 있나?');await p.waitForTimeout(600);await p.screenshot({path:'/private/tmp/story-b-bar-wake.png'});
 // Normal completion uses the same bar transition as the skip path.
 await p.evaluate(()=>lunaCampaign.newGame('B'));await p.waitForFunction(()=>lunaCampaign.view==='prologue');await p.evaluate(()=>{lunaCampaign.cinema.time=lunaCampaign.cinema.scene.end-.001;});await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.dialogue.text),'루나, 듣고 있나?');
 // Terrace choice must show one branch, then rejoin, without putting markers in speech.
 for(const seq of [1,2]){
  await p.evaluate(()=>{const c=lunaCampaign;c.g.progress.flags={};c.scene(c.data.scenes.night2.slice(2),'테라스','terrace',()=>c.screen('game'));});await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&lunaCampaign.view==='scene');
  await p.evaluate(()=>{for(let i=0;i<30&&lunaCampaign.view==='scene';i++){lunaCampaign.dialog.chars=9999;lunaCampaign.next();}});
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'scene-choice');await p.locator(`[data-campaign="scene-choice:${seq}"]`).click();
  const said=await p.evaluate(()=>{const said=[];for(let i=0;i<60&&lunaCampaign.view==='scene';i++){said.push(lunaCampaign.dialog.rows[lunaCampaign.dialog.index].text);lunaCampaign.dialog.chars=9999;lunaCampaign.next();}return said;});
  assert.equal(said.some(s=>s.startsWith('자신이 팔았다고')),seq===1);assert.equal(said.some(s=>s.startsWith('시바한테서요')),seq===2);assert(said.at(-1).includes('피곤해'));
 }
 // The day-two terrace must actually play B's memory before its choice scene.
 await p.evaluate(()=>{const c=lunaCampaign;window.storyBFinished=false;c.playSleepScenes(2,()=>{window.storyBFinished=true;c.screen('game');});});
 let memorySeen=false;
 for(let i=0;i<160;i++){
  await p.waitForFunction(()=>!lunaCampaign.memoryTransition);
  const state=await p.evaluate(()=>{const c=lunaCampaign;return{done:window.storyBFinished,view:c.view,background:c.dialog?.background,text:c.dialog?.rows[c.dialog.index]?.text};});
  if(state.done)break;
  if(state.background==='johnny-memory'){memorySeen=true;assert(!state.text.includes('라이 위스키'));assert.equal(await p.locator('[data-memory-pov="johnny"]').count(),1);}
  if(state.view==='scene-choice')await p.locator('[data-campaign="scene-choice:1"]').click();
  else await p.evaluate(()=>{lunaCampaign.dialog.chars=99999;lunaCampaign.next();});
 }
 assert(memorySeen);assert(await p.evaluate(()=>window.storyBFinished&&barGame.progress.flags.campaign_observation));
 // B -> A resets scripts and retains the current dream/home/manual contact flow.
 await p.evaluate(()=>lunaCampaign.toPicker());await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();await p.locator('[data-campaign="story:A"]').click();
 await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});assert.equal(await p.evaluate(()=>lunaCampaign.storyVersion),'A');
 assert(await p.evaluate(()=>lunaCampaign.cinema.skipUntil>0&&outsidePlaytest.active&&lunaCampaign.cinema.scene.clips.some(c=>c.type==='dialogue'&&c.wait)));
 assert(await p.evaluate(()=>LUNA_DATA.tables.steps.some(r=>r.context==='d1_tutorial_chris'&&r['text.ko']==='…그럼 이제 한번 시작해 볼까?')));
 await p.evaluate(()=>lunaCampaign.developer());assert.equal(await p.evaluate(()=>lunaCampaign.data===LUNA_CAMPAIGN_DATA),true);
 assert.deepEqual(errors,[]);console.log('STORY_B_UI_OK: selection, skip/end -> bar, exclusive terrace branches, B -> A -> developer isolation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

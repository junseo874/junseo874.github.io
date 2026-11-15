const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/');
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const [id,response,followup] of [['silent','...','...방금 일어났나 보군. 늦장 부리지 말고 와.'],['awake','지금 일어났어요.','일어났으면 준비해서 와. 늦지 말고.']]){
  await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.cinema?.player);
  await p.evaluate(()=>{LunaFocusSettings.setEnabled(false);const c=lunaCampaign,s=c.cinema,first=s.scene.clips.find(l=>l.choiceAfter);s.time=first.start;s.dialogueWait={id:first.id,age:99,revealed:true};s.player.render(s.time,null,false,0,s.dialogueWait);c.advanceCinemaDialogue();});
  await p.locator('.world-choices:not([hidden])').waitFor();await p.waitForTimeout(900);await p.locator('[data-choice="'+id+'"]').click();
  await p.waitForFunction(()=>!lunaCampaign.cinema.dialogueChoice);
  const actual=await p.evaluate(()=>{const s=lunaCampaign.cinema;return{response:StudioTags.parse(s.scene.clips.find(l=>l.choiceResponse).text).text,followup:StudioTags.parse(s.scene.clips.find(l=>l.choiceFollowup).text).text,common:s.scene.clips.filter(l=>l.track==='phone-lines').slice(-2).map(l=>StudioTags.parse(l.text).text)};});
  assert.equal(actual.response,response);assert.equal(actual.followup,followup);assert.deepEqual(actual.common,['네.','언노운 위치는 기억하고 있지? 끊는다.']);
 }
 assert.deepEqual(errors,[]);console.log('DAY0_PHONE_BRANCHES_OK: both rendered choices apply authored replies and rejoin the common ending');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

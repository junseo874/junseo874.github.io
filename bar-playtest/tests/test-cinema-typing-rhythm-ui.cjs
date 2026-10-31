const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.locator('[data-act="version"][data-id="cutscenes"]').click();await p.locator('[data-act="cutscenePlay"][data-id="opening-a"]').click();
 await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&lunaCampaign.cinema?.player&&!lunaCampaign.memoryTransition,null,{timeout:60000});
 const report=await p.evaluate(()=>{
  LunaFocusSettings.setEnabled(false);const c=lunaCampaign;c.tick=()=>false;const s=c.cinema,player=s.player;
  const lines=s.scene.clips.filter(l=>l.type==='dialogue'&&l.textEffect!=='instant'),failures=[];let checks=0;
  const sample=(line,age,revealed=false)=>{s.time=line.start;s.dialogueWait={id:line.id,age,revealed};player.render(s.time,null,false,0,s.dialogueWait);return player.dialogueCount(line);};
  for(const line of lines){
   barGame.dialogSpeed=1;sample(line,0);
   const parsed=StudioTags.parse(line.text),timing=LunaDialogueRhythm.timing(parsed.text,line.cps,parsed.pauses);
   for(let i=0;i<timing.times.length;i++){
    if(timing.chars[i-1]!=='.')continue;
    for(const delta of [-.0001,0]){const n=sample(line,timing.times[i]+delta);checks++;if(n!==(delta<0?i:i+1))failures.push({id:line.id,i,delta,n});}
   }
   if(line.layout==='intro'){
    sample(line,0);c.advanceCinemaDialogue();
    if(s.dialogueWait?.id!==line.id||s.dialogueWait.revealed)failures.push('intro cannot be skipped during typing');
    sample(line,timing.duration-.0001);c.advanceCinemaDialogue();
    if(s.dialogueWait?.id!==line.id)failures.push('intro final period must finish');
    if(StudioOpening.typingPending(line,timing.duration+.0001))failures.push('intro cannot remain stuck');
   }
  }
  const phone=lines.find(l=>l.actor==='phone');phone.text='크리스. 잠깐... 들려?';
  for(const speed of [.5,1,2,4]){
   barGame.dialogSpeed=speed;sample(phone,0);const t=LunaDialogueRhythm.timing(StudioTags.parse(phone.text).text,phone.cps);
   for(let i=0;i<t.times.length;i++){if(sample(phone,t.times[i]/speed)!==i+1)failures.push({speed,i});checks++;}
  }
  barGame.dialogSpeed=1;sample(phone,0);const paused=sample(phone,.2);if(sample(phone,.2)!==paused)failures.push('redraw advanced clock');
  if(sample(phone,.2,true)!==StudioTags.parse(phone.text).chars.length)failures.push('full reveal');
  sample(phone,0);sample(phone,4/phone.cps);const beforeDot=player.dialogueCount(phone);sample(phone,4/phone.cps+.349);const afterPause=player.dialogueCount(phone);
  const dom=[...document.querySelectorAll('.studio-speech-bubble span')].filter(e=>e.style.visibility!=='hidden').map(e=>e.textContent).join('');
  return{failures,checks,phoneLines:lines.filter(l=>l.track==='phone-lines').length,intro:lines.filter(l=>l.layout==='intro').length,beforeDot,afterPause,dom};
 });
 assert.deepEqual(report.failures,[]);assert.equal(report.phoneLines,5);assert.equal(report.intro,4);assert(report.checks>50);
 assert.equal(report.beforeDot,4);assert.equal(report.afterPause,4);assert(report.dom.includes('크리스.'));
 await p.screenshot({path:'/private/tmp/cinema-period-phone.png'});
 assert.deepEqual(errors,[]);console.log('CINEMA_TYPING_RHYTHM_UI_OK: all four opening cards and five contact lines, exact pauses, .5/1/2/4 speed, redraw, full reveal and actual phone bubble.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

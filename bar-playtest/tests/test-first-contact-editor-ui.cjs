// Exercise the actual save handler on an isolated copy, then feed that exact
// saved file to a new game's real opening, without touching the project data.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {saveContact}=require('../../tools/first-contact-storage.cjs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'luna-contact-')),file=path.join(dir,'first-contact.json');
 await fs.copyFile(path.resolve(__dirname,'../../cutscene-studio/data/first-contact.json'),file);
 const original=await fs.readFile(file,'utf8');
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{const p=await browser.newPage(),base=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/',errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/first-contact.json',async r=>r.fulfill({contentType:'application/json',body:await fs.readFile(file,'utf8')}));
  await p.route('**/api/dialogue-editor',async r=>{if(r.request().method()!=='POST')return r.continue();assert.equal(r.request().postDataJSON().mode,'first-contact');await r.fulfill({json:await saveContact(r.request().postDataJSON(),{file,backups:path.join(dir,'backups')})});});
  await p.goto(base+'outside-dialogue-editor.html?day=0#first-contact');
  const fields=p.locator('#contact-fields textarea');await fields.first().waitFor();assert.equal(await fields.count(),14);
  const values=Array.from({length:14},(_,i)=>'통화 검수 '+i);
  for(const [i,v]of values.entries())await fields.nth(i).fill(v);await p.click('#contact-save');await p.waitForFunction(()=>document.querySelector('#contact-status').textContent.startsWith('저장됨'));
  const saved=await fs.readFile(file,'utf8'),opts={file,backups:path.join(dir,'backups')};
  await assert.rejects(saveContact({original,values},opts),/변경/);
  await assert.rejects(saveContact({original:saved,values:['',...values.slice(1)]},opts),/빈 대사/);
  assert.equal(await fs.readFile(file,'utf8'),saved);
  await p.click('#contact-close');await p.click('#edit-contact');await fields.first().waitFor();assert.equal(await fields.nth(6).inputValue(),values[6]);await p.click('#contact-close');
  await p.goto(base);if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  for(const [id,offset] of [['awake',1],['silent',6]]){
   await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.cinema?.player);
   const texts=await p.evaluate(()=>{LunaFocusSettings.setEnabled(false);const c=lunaCampaign,s=c.cinema,rows=s.scene.clips.filter(l=>l.track==='phone-lines'),first=rows[0];s.time=first.start;s.dialogueWait={id:first.id,age:99,revealed:true};s.player.render(s.time,null,false,0,s.dialogueWait);c.advanceCinemaDialogue();return rows.map(l=>StudioTags.parse(l.text).text);});
   assert.equal(texts[0],values[0]);assert.deepEqual(texts.slice(-2),values.slice(4,6));const option=p.locator('[data-choice="'+id+'"]');await option.waitFor();assert((await option.innerText()).includes(values[offset]));await p.waitForTimeout(900);await option.click();await p.waitForFunction(()=>!lunaCampaign.cinema.dialogueChoice);
   assert.deepEqual(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(l=>l.choiceResponse||l.choiceFollowup).map(l=>StudioTags.parse(l.text).text)),values.slice(offset+1,offset+3));
  }assert.deepEqual(errors,[]);console.log('FIRST_CONTACT_EDITOR_OK: saved and reopened 14 fields; both branches play in the actual opening');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

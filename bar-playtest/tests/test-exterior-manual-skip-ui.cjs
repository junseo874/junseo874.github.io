const assert = require('node:assert/strict');
const rt = require('../../tools/lib/test-runtime.cjs');
(async () => {
  const browser = await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
  try {
    const p = await browser.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await p.locator('.updates-confirm').isVisible()) await p.locator('.updates-confirm').click();
    await p.evaluate(async () => {
      const c = lunaCampaign; c.session.install({developer:false}); barGame.reset(1,'full',1,false);
      Object.assign(outsidePlaytest.config,{day:1,flow:'in',place:'bar'}); await outsidePlaytest.start(); c.screen(c.playView);
      const m = outsidePlaytest.model; m.x=LunaOutsideNewspaper.place.x+.3; m.y=-.7; m.level=0;
      m.story.cancel(); m.backgroundStory.cancel(); m.updateNear(); outsidePlaytest.snapCamera();
    });
    await p.keyboard.down('ControlLeft'); await p.waitForTimeout(350); await p.keyboard.up('ControlLeft');
    assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null,'Ctrl must not initiate an interaction');
    await p.evaluate(()=>{
      const m=outsidePlaytest.model, target={x:m.x,y:m.y}, rows=['자동 대사','다음 자동 대사'].map(text=>({type:'say',actor:'luna',text}));
      m.story.beginRows('auto-skip-check',target,rows,true);
      m.backgroundStory.beginRows('ambient-skip-check',target,rows,true);
    });
    await p.keyboard.down('ControlLeft'); await p.waitForTimeout(550); await p.keyboard.up('ControlLeft');
    assert.deepEqual(await p.evaluate(()=>{
      const m=outsidePlaytest.model, indices=[m.story.speech.index,m.backgroundStory.channels.get('ambient-skip-check').speech.index];
      m.story.cancel(); m.backgroundStory.cancel(); return indices;
    }),[0,0],'Neither automatic speech nor ambient channels consume Ctrl');
    await p.keyboard.press('KeyE');
    await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='street-newspaper');
    await p.keyboard.down('ControlRight'); await p.waitForFunction(()=>outsidePlaytest.model.story.speech.index>0);
    await p.keyboard.up('ControlRight');
    const index=()=>p.evaluate(()=>outsidePlaytest.model.story.speech.index);
    const stopped=await index(); await p.waitForTimeout(400); assert.equal(await index(),stopped);
    await p.keyboard.down('ControlLeft');
    await p.waitForFunction(()=>outsidePlaytest.model.story.speech.choice);
    await p.waitForTimeout(450); assert(await p.locator('[data-choice="newspaper-right"]').isVisible());
    await p.keyboard.up('ControlLeft');
    await p.evaluate(()=>{outsidePlaytest.exit(true);return lunaCampaign.newGame();});
    await p.waitForFunction(()=>lunaCampaign.cinema?.player);
    await p.evaluate(()=>{const c=lunaCampaign.cinema,l=c.scene.clips.find(x=>x.choiceAfter);c.time=l.start;c.dialogueWait={id:l.id,age:99,revealed:false};c.player.render(c.time,null,false,0,c.dialogueWait);});
    await p.keyboard.down('ControlRight'); await p.waitForFunction(()=>!!lunaCampaign.cinema.dialogueChoice);
    await p.waitForTimeout(450); assert(await p.locator('#campaign-root .world-choices:not([hidden])').isVisible());
    await p.keyboard.up('ControlRight'); assert.deepEqual(errors,[]);
    console.log('PASS: no interaction from idle, manual street dialogue and release, newspaper and first-contact choices stop Ctrl');
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });

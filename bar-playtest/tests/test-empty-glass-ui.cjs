const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{
  LunaFocusSettings.setEnabled(false);lunaCampaign.session.uninstall();lunaCampaign.screen('developer');const g=barGame;
  g.reset(1,'regular',42,false);g.phase='regular';g.focus='R';g.seats={L:null,M:null,R:{actor:'chris',id:'chris',state:'STORY',seated:true,coaster:false}};
  g.story={scene:{id:'empty-review'},index:0,steps:[{type:'say',actor:'chris','text.ko':'어서 와.'},{type:'coaster',actor:'chris'},{type:'say',actor:'chris','text.ko':'음...'},{type:'empty_glass',actor:'chris'},{type:'say',actor:'luna','text.ko':'어떤가요?'}]};g.pump();lunaCampaign.render(true);
 });
 await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft);
 assert.equal(await p.locator('.stack[data-drag=coaster]').count(),0,'Greeting has no premature coaster UI');
 await p.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;barGame.advance();lunaCampaign.render(true);});
 await p.locator('.stack[data-drag=coaster]').waitFor();assert(await p.locator('[data-drop=R] .delivery-cue').isVisible());
 const src=await p.locator('.stack[data-drag=coaster]').boundingBox(),zone=await p.locator('[data-drop=R]').boundingBox();
 await p.mouse.move(src.x+src.width/2,src.y+src.height/2);await p.mouse.down();await p.mouse.move(zone.x+zone.width/2,zone.y+zone.height*.8,{steps:10});await p.mouse.up();
 await p.waitForFunction(()=>barGame.dialogue?.text==='음...');assert(await p.evaluate(()=>barGame.seats.R.coaster));
 await p.evaluate(()=>{Object.assign(barGame.seats.R,{glass:'gin_tonic',glassKind:'long_drink',glassEmpty:false});lunaCampaign.render(true);});
 await p.locator('[data-drop=R] .drink-art[data-art-usage=table]').waitFor();
 await p.screenshot({path:'/private/tmp/day0-glass-full.png'});
 const full=await p.locator('[data-drop=R] .drink-art').boundingBox();
 await p.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;barGame.advance();lunaCampaign.render(true);});
 const empty=p.locator('[data-drop=R] img.empty-glass');await empty.waitFor();await empty.evaluate(e=>e.decode());
 assert((await empty.getAttribute('src')).endsWith('long_drink_glass.png'));
 const box=await empty.boundingBox();assert(Math.abs(full.y+full.height-box.y-box.height)<2,'Glass bases stay on the coaster');
 await p.screenshot({path:'/private/tmp/day0-glass-empty.png'});
 for(const [kind,file] of [['weizen','beer_glass.png'],['martini','cocktail_glass.png'],['flute','cocktail_glass.png'],['wine','cocktail_glass.png'],['old_fashioned','long_drink_glass.png'],['unknown','long_drink_glass.png']]){
  await p.evaluate(kind=>{barGame.seats.R.glassKind=kind;lunaCampaign.render(true);},kind);await empty.evaluate(e=>e.decode());assert((await empty.getAttribute('src')).endsWith(file),kind);
 }
 assert.deepEqual(errors,[]);console.log('EMPTY_GLASS_UI_OK: explicit coaster drag, full to empty at dialogue trigger, matching base and six fallback mappings');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

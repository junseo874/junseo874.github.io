const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('node:path'),root=process.env.LUNA_TEST_ROOT||path.resolve(__dirname,'..');
const box={window:{}};for(const f of ['data.js','campaign-data.js','campaign-engine.js'])vm.runInNewContext(fs.readFileSync(root+'/'+f,'utf8'),box);
const C=require(root+'/core.js'),R=require(root+'/remix.js'),story=box.window.LUNA_CAMPAIGN_DATA,D=C.millilitreData(JSON.parse(JSON.stringify(box.window.LUNA_DATA)));
const raw=D.tables.steps.filter(s=>s.context==='day2_notion_bar'),expected=story.bar[2].filter(r=>r.type==='say').map(r=>[r.actor,r.text]);assert.equal(JSON.stringify(raw.filter(r=>r.type==='say').map(r=>[r.actor,r['text.ko']])),JSON.stringify(expected));assert.deepEqual(raw.filter(r=>r.type==='order').map(r=>[r.actor,r.arg]),[['samho','free']]);assert(!raw.some(r=>r.type.startsWith('campaign_')));
for(const mode of ['raw','original','gpt','mainA','mainB']){
 const g=new C.Game(D);R.attach(g);let session;const seen=[],cues=[],drinks=[];let last,afterDoor=false;
 if(mode!=='raw'){session=new box.window.LunaCampaignEngine.Session(g,D,story);session.install({developer:!mode.startsWith('main'),serviceVersion:mode==='mainB'?'B':'A'});session.onStep=()=>assert.fail('No menu or observation quiz in day2');}
 g.onStoryCue=kind=>{cues.push(kind);if(kind==='door')afterDoor=true;};g.reset(2,'regular',42,true,{variant:mode==='gpt'?'gpt':'original'});
 for(let i=0;i<15000&&!g.finished;i++){
  assert.equal(g.error,null);g.cameraMoving=false;if(g.transition||g.cameraLeft){g.tick(.1);continue;}
  if(g.dialogue){if(last!==g.dialogue){seen.push([g.dialogue.actor,g.dialogue.text]);last=g.dialogue;if(afterDoor)assert(['chris','port'].includes(g.dialogue.actor));}g.advance();g.advance();continue;}
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){const o=g.currentOrder;assert(o.freeChoice);g.openRecipes();assert(g.selectCocktail('kahlua_milk'));assert.equal(o.cocktail,'kahlua_milk');g.debugCraft('good');g.offer();assert(g.serve(o.seat,'drag'));drinks.push(o.actor);continue;}g.tick(.1);
 }
 assert(g.finished,mode+' stalled');assert.equal(JSON.stringify(seen),JSON.stringify(expected));assert.deepEqual(drinks,['samho']);assert.deepEqual(cues,['message','door']);assert(g.progress.flags.johnny_chip_received);assert(g.progress.flags.day2_luna_left);session?.uninstall();console.log('PASS '+mode+' dialogue '+seen.length+', free recipe crafting, Samho only order, cues, Chris/Port after Luna exits');
}

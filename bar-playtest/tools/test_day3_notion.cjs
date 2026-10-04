const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('node:path'),root=process.env.LUNA_TEST_ROOT||path.resolve(__dirname,'..');
const box={window:{}};for(const f of ['data.js','campaign-data.js','campaign-engine.js'])vm.runInNewContext(fs.readFileSync(root+'/'+f,'utf8'),box);
const C=require(root+'/core.js'),R=require(root+'/remix.js'),story=box.window.LUNA_CAMPAIGN_DATA,D=C.millilitreData(JSON.parse(JSON.stringify(box.window.LUNA_DATA)));
const raw=D.tables.steps.filter(s=>s.context==='day3_notion_bar'),expected=story.bar[3].filter(r=>r.type==='say').map(r=>[r.actor,r.text]);assert.equal(JSON.stringify(raw.filter(r=>r.type==='say').map(r=>[r.actor,r['text.ko']])),JSON.stringify(expected));assert.deepEqual(raw.filter(r=>r.type==='order').map(r=>[r.actor,r.arg]),[['tom','exact:johnny_old_fashioned']]);assert(!raw.some(r=>r.type.startsWith('campaign_')));
for(const mode of ['raw','original','gpt','mainA','mainB']){
 const g=new C.Game(D);R.attach(g);let session;const seen=[],cues=[],drinks=[];let last,afterDoor=false;
 if(mode!=='raw'){session=new box.window.LunaCampaignEngine.Session(g,D,story);session.install({developer:!mode.startsWith('main'),serviceVersion:mode==='mainB'?'B':'A'});session.onStep=()=>assert.fail('No menu or observation quiz in day3');}
 g.onStoryCue=kind=>{cues.push(kind);if(kind==='door')afterDoor=true;};g.reset(3,'regular',42,true,{variant:mode==='gpt'?'gpt':'original',storyPrerequisites:true});
 for(let i=0;i<15000&&!g.finished;i++){
  if(g.overlay==='johnnyUnlock'){g.confirmJohnnyUnlock();continue;}assert.equal(g.error,null);g.cameraMoving=false;if(g.transition||g.cameraLeft){g.tick(.1);continue;}
  if(g.dialogue){if(last!==g.dialogue){seen.push([g.dialogue.actor,g.dialogue.text]);last=g.dialogue;if(afterDoor)assert(['chris','port'].includes(g.dialogue.actor));}g.advance();g.advance();continue;}
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){const o=g.currentOrder;assert(!o.freeChoice);g.openRecipes();assert(g.selectCocktail('johnny_old_fashioned'));assert.equal(o.cocktail,'johnny_old_fashioned');g.debugCraft('good');assert.deepEqual(g.result.results.filter(r=>r.ingredient).map(r=>[r.type,r.ingredient,r.value]),[['pour','wild_dog',45],['pour','bitters',5],['add','sugar_cube',1]]);if(session){assert.equal(session.problems(g.result).length,0);const wrong=structuredClone(g.result);wrong.results.find(r=>r.ingredient==='sugar_cube').value=2;assert(session.problems(wrong).some(x=>x.includes('각설탕')));}g.offer();assert(g.serve(o.seat,'drag'));drinks.push(o.actor);continue;}g.tick(.1);
 }
 assert(g.finished,mode+' stalled');assert.equal(JSON.stringify(seen),JSON.stringify(expected));assert.deepEqual(drinks,['tom']);assert.deepEqual(cues,[]);assert(g.progress.flags.day3_sugar_received);session?.uninstall();console.log('PASS '+mode+' dialogue '+seen.length+', correct restoration recipe, Tom only order, Aili delivery, no obsolete response choice');
}

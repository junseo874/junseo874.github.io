const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('node:path'),root=path.resolve(__dirname,'..');
const box={window:{}};for(const name of ['data.js','campaign-data.js','campaign-engine.js'])vm.runInNewContext(fs.readFileSync(root+'/'+name,'utf8'),box);
const C=require(root+'/core.js'),R=require(root+'/remix.js'),D=C.millilitreData(JSON.parse(JSON.stringify(box.window.LUNA_DATA))),story=box.window.LUNA_CAMPAIGN_DATA;
const rows=D.tables.steps.filter(s=>s.context==='day1_notion_regular'),say=rows.filter(s=>s.type==='say');
assert.equal(say.length,133);assert.equal(rows.length,149);
assert.equal(JSON.stringify(say.map(s=>[s.actor,s['text.ko']])),JSON.stringify(story.bar[1].filter(s=>s.type==='say').map(s=>[s.actor,s.text])));
assert.deepEqual(rows.filter(s=>s.type==='order').map(s=>[s.actor,s.arg]),[['tom','exact:dry_martini'],['aili','exact:gin_fizz']]);
assert.equal(D.tables.scenes.filter(s=>+s.day===1&&s.phase==='bar').length,1);
for(const [table,id,day]of [['cocktails','dry_martini',1],['shelf_items','dry_vermouth',1],['cocktails','cosmopolitan',2],['shelf_items','cointreau',2],['shelf_items','cranberry_juice',2],['shelf_items','milk',2],['shelf_items','kahlua',2]])assert.equal(+D.tables[table].find(r=>r.id===id).unlock_day,day,id);
const art=D.assets.char_tom_static;assert.equal(art.frames,1);assert(art.static);assert.equal(JSON.stringify(D.characterLayers.tom.idle_default),JSON.stringify(D.characterLayers.tom.idle_talk));assert(fs.existsSync(root+'/'+art.src));
for(const mode of ['original','gpt','campaign']){
 const g=new C.Game(D);R.attach(g);let session;
 if(mode==='campaign'){session=new box.window.LunaCampaignEngine.Session(g,D,story);session.install();}
 g.reset(1,'regular',42,true,{variant:mode==='gpt'?'gpt':'original'});
 const seen=[],drinks=[];let last=null;
 for(let i=0;i<10000&&!g.finished;i++){
  assert.equal(g.error,null);g.cameraMoving=false;
  if(g.transition||g.cameraLeft){g.tick(.1);continue;}
  if(g.dialogue){if(last!==g.dialogue){seen.push([g.dialogue.actor,g.dialogue.text]);last=g.dialogue;}g.advance();g.advance();continue;}
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   const o=g.currentOrder;drinks.push(o.cocktail);assert(g.cocktailsAvailable().some(c=>c.id===o.cocktail));g.openRecipes();g.selectCocktail(o.cocktail);assert.equal(g.screen,'prep');g.debugCraft('good');for(let n=0;n<20;n++)g.tick(.1);g.offer();assert.equal(g.serve(o.seat,'drag'),true);continue;
  }
  g.tick(.1);
 }
 assert(g.finished,mode+' stalled');assert.equal(g.error,null);assert.equal(seen.length,133,mode);assert.equal(JSON.stringify(seen),JSON.stringify(story.bar[1].filter(s=>s.type==='say').map(s=>[s.actor,s.text])));assert.deepEqual(drinks,['dry_martini','gin_fizz']);session?.uninstall();console.log('PASS '+mode+' 133 lines + Tom/Aili orders + full regular service');
}

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const base=path.resolve(__dirname,'..'),sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(base,'data/runtime/game-data.js'),'utf8'),sandbox);
const data=sandbox.window.LUNA_DATA,before=JSON.parse(JSON.stringify(data)),art=require('../src/features/bar/cocktail-art.js');
art.apply(data);
const changed=Object.keys(data.assets).filter(k=>JSON.stringify(data.assets[k])!==JSON.stringify(before.assets[k]));
assert.equal(JSON.stringify(data.tables),JSON.stringify(before.tables));
const reps={bottle_beer:'beer_final',screwdriver:'screwdriver_final',tequila_sunrise:'tequila_sunrise_final'};
const tables={bottle_beer:'beer',dry_martini:'dry_martini',cosmopolitan:'cosmopolitan',screwdriver:'screwdriver',tequila_sunrise:'tequila_sunrise'};
const mapped=[...Object.keys(reps).flatMap(id=>['cocktail_'+id,'recipe_cocktail_'+id]),...Object.keys(tables).map(id=>'table_cocktail_'+id)];
assert.equal(mapped.length,11);
assert(changed.every(key=>mapped.includes(key)),'Art overrides must not change unrelated assets');
for(const key of mapped){const a=data.assets[key],png=fs.readFileSync(path.join(base,a.src));assert.equal(png.readUInt32BE(16),a.w);assert.equal(png.readUInt32BE(20),a.h);}
// Deleted dummy files must not be required even before the runtime art override loads.
for(const key of [...Object.keys(reps).flatMap(id=>['cocktail_'+id,'recipe_cocktail_'+id]),'table_cocktail_bottle_beer']){
 assert.equal(JSON.stringify(before.assets[key]),JSON.stringify(data.assets[key]),key+': base registration must already use completed art');
}
for(const [key,asset]of Object.entries(before.assets))assert(fs.existsSync(path.join(base,decodeURIComponent(asset.src.split(/[?#]/)[0]))),key+': missing base asset');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'data/provenance/source-inventory.json'),'utf8'));
for(const [src]of Object.entries(inventory.graphics))assert(!/assets\/cocktails\/static\/(?:recipe-)?cocktail-(?:screwdriver|tequila-sunrise|bottle-beer)\.png$/.test(src),'Retired dummy must not remain in the inventory');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const [id,name] of Object.entries(reps)){
  await p.evaluate(()=>{barGame.reset(99,'practice',1,true,{variant:'original'});lunaCampaign.render(true);});
  const card=p.locator('.recipe-card[data-id="'+id+'"] .drink-art');
  assert((await card.getAttribute('src')).endsWith('/representative/'+name+'.png'));
  await p.evaluate(id=>{barGame.selectCocktail(id);lunaCampaign.render(true);},id);
  if(!await p.locator('#prep-recipe-detail').isVisible())await p.locator('.prep-recipe-brief').click();
  const hero=p.locator('#prep-recipe-detail .drink-art');
  await hero.waitFor();assert((await hero.getAttribute('src')).endsWith('/representative/'+name+'.png'));
  assert(await hero.evaluate(async e=>{await e.decode();return e.naturalWidth>0;}));
  if(id==='tequila_sunrise')await p.screenshot({path:'/private/tmp/cocktail-latest-recipe.png'});
 }
 for(const [id,name] of Object.entries(tables)){
  await p.evaluate(id=>{const g=barGame;g.reset(99,'practice',1,true,{variant:'original'});g.screen='bar';g.seats.M={id:'chris',actor:'chris',state:'STORY',coaster:true,glass:id,expression:'idle',seated:true};g.transition=0;g.cameraLeft=0;g.cameraMoving=false;lunaCampaign.render(true);},id);
  const glass=p.locator('.native-coaster .drink-art');await glass.waitFor();
  assert((await glass.getAttribute('src')).endsWith('/table/'+name+'.png'));
  assert.deepEqual(await glass.evaluate(async e=>{await e.decode();const s=getComputedStyle(e);return [e.naturalWidth,e.naturalHeight,s.width,s.height,s.objectFit,s.objectPosition];}),[69,112,'69px','112px','contain','50% 100%']);
  if(id==='tequila_sunrise')await p.screenshot({path:'/private/tmp/cocktail-latest-table.png'});
 }
 assert.deepEqual(errors,[]);console.log('PASS: 3 representative images, 5 native-size table images, 11 mappings, recipe UI, transparent PNG decoding; gameplay data unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

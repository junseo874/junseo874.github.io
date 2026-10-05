const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const dir=process.env.LUNA_TEST_ROOT||path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core'),R=require(dir+'/remix'),M=require(dir+'/minigames'),P=require(dir+'/pour-fluid');
const bare=['soda_water','cola','cranberry_juice','milk','beer','orange_juice','red_wine','champagne'];
const ingredients=[...new Set(ctx.window.LUNA_DATA.tables.recipes.map(r=>r.ingredient))];
for(const id of bare)assert(ingredients.includes(id),id+' must use a real ingredient ID');
let cases=0;
for(const variant of ['original','gpt']){
 const g=new C.Game(C.millilitreData(ctx.window.LUNA_DATA));R.attach(g);M.attach(g);g.startMinigame('pour',variant);
 assert.equal(g.setPourTool,undefined,'No player-facing tool override');
 for(const ingredient of ingredients)for(const type of ['pour','fill_up'])for(const [target,unit] of [[5,'ml'],[99.9,'ml'],[100,'ml'],[300,'ml'],[4,'oz'],[20,'tsp']]){
  const expected=bare.includes(ingredient)?'none':'pourer';
  g.pourTool=expected==='none'?'pourer':'none';
  g.craft.queue=[{type,ingredient,target,unit}];g.craft.index=0;g.nextGimmick();const s=g.gimmick;
  assert.equal(P.toolForIngredient(ingredient),expected);assert.equal(s.fluid.tool,expected,ingredient+'/'+target+unit);
  assert.equal(g.pourTool,expected);assert.equal(s.fluid.rate/s.fluid.baseRate,expected==='none'?4:1);
  assert.equal(s.fluid.caughtMl,0);assert.equal(s.started,false);g.tick(.05);assert.equal(s.fluid.tool,expected);
  g.nextGimmick();assert.equal(g.gimmick.fluid.tool,expected,'Retry preserves ingredient rule');cases++;
 }
 g.craft.queue=[{type:'pour',ingredient:'gin',target:300,unit:'ml'},{type:'fill_up',ingredient:'soda_water',target:30,unit:'ml'},{type:'pour',ingredient:'wild_dog',target:100,unit:'ml'}];
 for(let i=0;i<3;i++){g.craft.index=i;g.nextGimmick();assert.equal(g.gimmick.fluid.tool,['pourer','none','pourer'][i]);}
}
assert.equal(P.toolForIngredient('new-ingredient'),'pourer');
console.log('POUR_INGREDIENT_RULE_OK',cases,'ingredient/type/amount/unit/variant cases, rates, retries, next ingredient, no manual override');

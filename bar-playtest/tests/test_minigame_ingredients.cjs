const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(dir+'/data/runtime/game-data.js','utf8'),ctx);
const C=require('../src/core/core.js'),M=require('../src/features/crafting/minigames.js'),R=require('../src/features/bar/remix.js'),g=new C.Game(ctx.window.LUNA_DATA);
R.attach(g);M.attach(g);
const baseline=JSON.stringify(g.data),items=M.ingredients(g);
const pourable=new Set(g.t.shelf_items.filter(i=>i.kind==='ingredient'&&['pour','fill_up'].includes(i.default_action)).map(i=>i.id));
assert.deepEqual(new Set(items.map(i=>i.id)),pourable);assert(items.some(i=>i.id==='beer'));assert(items.some(i=>i.id==='soda_water'));
for(const item of items){
 g.startMinigame('pour',{ingredient:item.id});
 assert.equal(g.gimmick.ingredient,item.id);assert.equal(g.gimmick.fluid.ingredient,item.id);
 assert.equal(g.craft.queue.length,1);assert.equal(g.craft.queue[0].type,'pour');
 assert.deepEqual(g.craft.actual.ingredients,[item.id]);assert.equal(g.currentOrder,null);
 const target=g.gimmick.target;g.retryMinigame();assert.equal(g.gimmick.ingredient,item.id);assert.equal(g.gimmick.target,target);
}
for(const item of M.ingredients(g,'fill_up')){g.startMinigame('fill_up',{ingredient:item.id});assert.equal(g.gimmick.type,'fill_up');assert.equal(g.gimmick.ingredient,item.id);}
const before=g.craft.id;assert.throws(()=>g.startMinigame('pour',{ingredient:'sugar_cube'}));assert.equal(g.craft.id,before);
assert.equal(JSON.stringify(g.data),baseline);
for(const ingredient of ['gin','beer','soda_water','cola']){
 g.startMinigame('pour',{ingredient});require('./helpers/pour-test-driver.cjs')(g);
 assert.equal(g.screen,'minigame_result');assert.equal(g.minigame.result.score,100);
 g.retryMinigame();assert.equal(g.gimmick.ingredient,ingredient);assert.equal(g.gimmick.started,false);
}
console.log('PASS all practice ingredients, physical material, retry, single stage, invalid input and data isolation');

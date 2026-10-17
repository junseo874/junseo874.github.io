const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core.js'),raw=ctx.window.LUNA_DATA,before=JSON.stringify(raw),D=C.millilitreData(raw);
const recipe=D.tables.recipes.filter(r=>r.context==='dry_martini');
assert.deepEqual(Array.from(recipe,r=>[r.ingredient,r.qty,r.unit]),[['gin',60,'ml'],['dry_vermouth',20,'ml']]);
assert.equal(JSON.stringify(raw),before,'Imported source snapshot is not mutated');
assert.equal(JSON.stringify(C.millilitreData(D)),JSON.stringify(D),'Repeated normalization keeps 60/20');
const c=D.tables.cocktails.find(c=>c.id==='dry_martini'),actual={selected:c.id,glass:c.glass,tool:'mixing_glass',ingredients:['gin','dry_vermouth']};
const q=C.buildQueue(D,c,actual);assert.deepEqual(q.map(r=>[r.type,r.ingredient,r.target??null,r.unit??null]),[['pour','gin',60,'ml'],['pour','dry_vermouth',20,'ml'],['stir',null,null,null]]);
const results=q.map(r=>({...r,value:r.target,completion:1,completed:true}));
assert.equal(C.scoreCraft(D,c,actual,results,10).score,100);
const old=results.map(r=>({...r,value:r.ingredient==='gin'?180:r.ingredient==='dry_vermouth'?45:r.value}));
assert(C.scoreCraft(D,c,actual,old,10).score<100,'Old amounts are no longer scored as correct');
for(const lang of ['ko','en']){assert(c['recipe_desc.'+lang].includes('60ml'));assert(c['recipe_desc.'+lang].includes('20ml'));assert(!/oz/.test(c['recipe_desc.'+lang]));}
console.log('PASS Dry Martini: 60ml gin + 20ml dry vermouth, queue, correct/old-amount scoring, bilingual copy, idempotence and source preservation');

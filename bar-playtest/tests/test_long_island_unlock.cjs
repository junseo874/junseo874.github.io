const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(dir+'/data/runtime/game-data.js','utf8'),ctx);
const C=require(dir+'/src/core/core.js'),raw=ctx.window.LUNA_DATA,before=JSON.stringify(raw),data=C.millilitreData(raw);
const has=rows=>rows.some(c=>c.id==='long_island');
for(const day of [0,1,2,3,99]){
 const game=new C.Game(data,{day});
 assert.equal(has(game.cocktailsAvailable()),day>=2,`Availability on day ${day}`);
 assert.equal(has(game.dailyUnlocks().cocktails),day===2,`New unlocks on day ${day}`);
}
assert.equal(JSON.stringify(raw),before,'Imported source remains unchanged');
assert.equal(JSON.stringify(C.millilitreData(data)),JSON.stringify(data),'Normalization is idempotent');
console.log('PASS Long Island Iced Tea: unavailable through day 1, unlocked on day 2, retained in practice');

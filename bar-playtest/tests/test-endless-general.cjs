const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../data/runtime/game-data.js','utf8'),ctx);
const {Game}=require('../src/core/core.js'),D=ctx.window.LUNA_DATA,g=new Game(D);
const looks=new Set();for(let i=0;i<30;i++){g.reset(1,'general',1);looks.add(g.appearance().layers.join('|'));}assert(looks.size>1,'same day and seed must not fix appearance');
for(const day of [0,1,2,3,99]){
 g.reset(day,'endless-general',1);assert.equal(g.phase,'general');assert.equal(g.queue.length,1);
 for(let i=0;i<100;i++){
  g.seats={L:null,M:null,R:null};g.tableFades={};g.spawn();const guest=Object.values(g.seats).find(Boolean);
  assert(guest.appearance);assert(!guest.slot.character);assert.equal(guest.slot.order,null);assert.equal(g.queue.length,1);assert.equal(g.queueIndex,0);
  g.beginOrder(guest,false);assert(g.cocktailsAvailable().some(c=>c.id===guest.nextCocktail));
 }
 g.seats={L:null,M:null,R:null};g.tableFades={};g.tickGeneral(.1);g.finishGeneralService();assert.equal(g.phase,'general');assert(!g.finished);
 // Normal pause still freezes arrivals.
 g.paused=true;const serial=g.serial;g.tick(100);assert.equal(g.serial,serial);g.paused=false;
}
g.reset(1,'general',1);assert.equal(g.endlessGeneral,false);assert(g.queue.length>1);g.reset(0,'full',1);assert.equal(g.endlessGeneral,false);
console.log('ENDLESS_GENERAL_OK: fresh identities on same seed, 500 anonymous arrivals, bounded queue, available orders, pause and normal-mode reset.');

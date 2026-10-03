const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),C=require('../core');
const box={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../data.js'),'utf8'),box);const D=C.millilitreData(box.window.LUNA_DATA);
for(const [day,orders] of [[1,['bottle_beer','bottle_beer']],[2,['screwdriver','tequila_sunrise']]]){
 const g=new C.Game(D);g.reset(day,'general',123,true);assert.deepEqual(g.queue.map(s=>s.order),orders);assert(g.queue.every(s=>s.max_rounds==='1'&&!s.character));assert.equal(g.spawnLeft,5);
 for(let i=0;i<2;i++){g.spawn();const guest=Object.values(g.seats).find(s=>s?.slot===g.queue[i]);g.beginOrder(guest,false);assert.equal(guest.nextCocktail,orders[i]);assert.equal(g.spawnLeft,20);}
}
const seats=new Set();for(let seed=1;seed<100000;seed+=997){const g=new C.Game(D);g.reset(1,'general',seed,true);g.spawn();const first=Object.entries(g.seats).find(([,s])=>s);seats.add(first[0]);assert.equal(g.focus,first[0]);g.spawn();assert.equal(Object.values(g.seats).filter(Boolean).length,2);assert.equal(g.focus,first[0],'second arrival must not steal camera');}
assert.deepEqual([...seats].sort(),['L','M','R']);console.log('TWO_GUEST_SCHEDULE_OK day1 two beers/day2 screwdriver+sunrise, no Port/reorders, 5/20 seconds, random free LMR, occupied seats protected, first guest focus only');

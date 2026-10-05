const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),C=require('../core');
const box={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../data.js'),'utf8'),box);const D=C.millilitreData(box.window.LUNA_DATA);
for(const [day,orders] of [[1,['bottle_beer','gin_fizz']],[2,['screwdriver','godfather']]]){
 const g=new C.Game(D);g.reset(day,'general',123,true);assert.deepEqual(g.queue.map(s=>s.order),orders);assert(g.queue.every(s=>s.max_rounds==='1'&&!s.character));assert.equal(g.spawnLeft,5);
 for(const id of orders){
  const cocktail=D.tables.cocktails.find(c=>c.id===id);assert(Number(cocktail.unlock_day)<=day&&!cocktail.unlock_when);
  for(const r of D.tables.recipes.filter(r=>r.context===id)){const item=D.tables.shelf_items.find(i=>i.id===r.ingredient);assert(item&&Number(item.unlock_day)<=day&&!item.unlock_when,'recipe ingredient must be available: '+r.ingredient);}
 }
 for(let i=0;i<2;i++){g.spawn();const guest=Object.values(g.seats).find(s=>s?.slot===g.queue[i]);g.beginOrder(guest,false);assert.equal(guest.nextCocktail,orders[i]);assert.equal(g.spawnLeft,20);}
}
assert.equal(D.tables.cocktails.find(c=>c.id==='gin_fizz').mix,'shake');
assert.equal(D.tables.cocktails.find(c=>c.id==='godfather').mix,'stir');
const seats=new Set();for(let seed=1;seed<100000;seed+=997){const g=new C.Game(D);g.reset(1,'general',seed,true);g.spawn();const first=Object.entries(g.seats).find(([,s])=>s);seats.add(first[0]);assert.equal(g.focus,first[0]);g.spawn();assert.equal(Object.values(g.seats).filter(Boolean).length,2);assert.equal(g.focus,first[0],'second arrival must not steal camera');}
assert.deepEqual([...seats].sort(),['L','M','R']);console.log('TWO_GUEST_SCHEDULE_OK day1 beer+gin fizz/day2 screwdriver+godfather (stir), recipes unlocked, no Port/reorders, 5/20 seconds, random free LMR, occupied seats protected, first guest focus only');

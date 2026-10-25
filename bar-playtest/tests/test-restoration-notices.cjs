const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W={};
for(const file of ['shared/ui/story-notices.js','features/campaign/restoration-notices.js'])vm.runInNewContext(fs.readFileSync(root+'/src/'+file,'utf8'),{window:W});
const N=W.LunaStoryNotices,R=W.LunaRestorationNotices;
for(const order of [['wild_dog','bitters','memory'],['bitters','wild_dog','memory'],['memory','wild_dog','bitters'],['bitters','memory','wild_dog']]){
 N.clear();const g={progress:{flags:{},inventory:{}},changed(){}},c={session:{carry:{flags:{}}}};
 for(const key of order){
  if(key==='memory')g.progress.flags.campaign_observation=true;else g.progress.inventory[key]=1;
  R.check(g,c);
  const both=g.progress.inventory.wild_dog&&g.progress.inventory.bitters;
  assert.equal(N.pending.filter(e=>e.kind==='goal-complete').length,both?1:0);
  assert.equal(N.pending.filter(e=>e.kind==='recipe-unlock').length,0,'No duplicate recipe toast, even with memory knowledge');
 }
 assert.equal(N.pending.find(e=>e.kind==='goal-complete').title,'올드패션드 재료 구하기!');
 assert(!N.pending.some(e=>e.kind==='goal-new'));
 assert(!g.progress.flags.old_fashioned_recipe_notice_pending);assert(!g.progress.flags.old_fashioned_recipe_notified);
 R.check(g,c);assert.equal(N.pending.length,1,'Queued goal cannot duplicate');
 assert.equal(c.session.carry.objectives.old_fashioned_materials.status,'completed');
 assert(!g.progress.flags.johnny_recipe_unlocked,'Existing manufacturing gate is unchanged');
 N.clear();g.progress=structuredClone(g.progress);R.check(g,c);assert.equal(N.pending.length,0,'Saved milestones remain one-shot');
}
N.clear();const g={progress:{flags:{campaign_observation:true},inventory:{wild_dog:1,bitters:1}},changed(){},data:{assets:{}}};
R.check(g,null,{qa:{}});assert.equal(N.pending.length,0);assert(!g.progress.objectives,'QA is isolated');
assert.equal(R.flush,undefined,'No frame polling or pending recipe delivery');
console.log('RESTORATION_NOTICES_OK ingredient/memory order, one-shot material goal, carry/day cloning, QA isolation, no recipe toast and unchanged crafting gate');

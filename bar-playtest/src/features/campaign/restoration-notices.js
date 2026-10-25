/* Announce real restoration milestones, never seeded inventory or gallery previews. */
(function(W){
'use strict';
const goal='old_fashioned_materials';
function sync(g,c){
 const p=g.progress,carry=c?.session?.carry;
 if(carry){
  if(p.objectives?.[goal]){carry.objectives??={};carry.objectives[goal]={...p.objectives[goal]};}
 }
 g.changed();
}
function check(g,c,m){
 if(m?.qa||!g?.progress)return false;
 const p=g.progress,n=W.LunaStoryNotices;
 if(!['wild_dog','bitters'].every(id=>Number(p.inventory?.[id])>0))return false;
 n.startGoal(p,goal,'올드패션드 재료 구하기!',{silent:true});
 const changed=n.completeGoal(p,goal);
 if(changed)sync(g,c);
 return changed;
}
W.LunaRestorationNotices={check};
})(window);

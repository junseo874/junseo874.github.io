// Prototype callbacks use active game time, not wall time. Reset clears stale results.
let labTasks=[];
function labDelay(fn,ms){labTasks.push({fn,left:ms});}
function labTick(dt){
 if(dt<=0)return;
 const due=labTasks.filter(t=>(t.left-=dt)<=0);
 labTasks=labTasks.filter(t=>t.left>0);
 for(const t of due)t.fn();
}

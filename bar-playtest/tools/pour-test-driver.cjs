const assert=require('assert/strict');
module.exports=function pour(g,ratio=1){
 const s=g.gimmick;assert(s?.fluid);g.holdPour(true);
 for(let i=0;i<10000&&g.gimmick===s;i++){
  if(!s.fluid.finishRequested&&s.fluid.predicted(s)>=s.target*ratio)g.endGimmick();
  g.tick(1/120);
 }
 assert.notEqual(g.gimmick,s,'Pour did not settle');return g.craft.results.at(-1);
};

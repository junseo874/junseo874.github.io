const assert=require('assert/strict');
module.exports=function pour(g,ratio=1){
 const s=g.gimmick;assert(s?.fluid);g.holdPour(true);
 for(let i=0;i<10000&&g.gimmick===s;i++){
  // Feather the last few millilitres using the same tilt input as pointer drag.
  if(s.held&&(s.target*ratio-s.fluid.predicted(s))*s.fluid.unitMl<10)s.dragAngle=s.fluid.startAngle+16;
  if(s.held&&s.fluid.predicted(s)>=s.target*ratio)g.holdPour(false);
  if(!s.held&&s.fluid.canFinish(s))g.endGimmick();
  g.tick(1/120);
 }
 assert.notEqual(g.gimmick,s,'Pour did not settle');return g.craft.results.at(-1);
};

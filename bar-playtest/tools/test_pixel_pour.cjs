const assert=require('node:assert/strict');
const path=require('node:path');
const {Simulation,toolForIngredient}=require(path.join(process.argv[2]||path.resolve(__dirname,'..'),'pour-fluid.js'));
const bare=['soda_water','cola','cranberry_juice','milk','beer','orange_juice','red_wine','champagne'];
for(const id of bare)assert.equal(toolForIngredient(id),'none');
for(const id of ['gin','vodka','tequila','bitters','tonic_water'])assert.equal(toolForIngredient(id),'pourer');
for(const ingredient of ['gin','soda_water','cola','beer','milk','bitters']){
 for(const angle of [70,110,145,170]){
  for(const dt of [1/120,1/60,1/30]){
   const s={held:false,angle:0},f=new Simulation({ingredient,targetMl:ingredient==='bitters'?2:100});
   f.setTool(toolForIngredient(ingredient),s);s.held=true;s.dragAngle=angle;
   for(let t=0;t<8;t+=dt){f.tick(s,dt);assert(Math.abs(f.audit().error)<1e-7);assert(f.caughtMl>=0&&f.foamMl>=0);}
   f.requestFinish(s);for(let t=0;t<5&&!f.ready;t+=dt)f.tick(s,dt);
   assert(f.ready,`${ingredient}/${angle} must finish`);assert.equal(f.airMl,0);assert(Math.abs(f.audit().error)<1e-7);
   assert(f.emittedMl<=f.supplyMl+1e-8);if(!f.carbonated)assert.equal(f.foamMl,0);
  }
 }
}
const s={held:false,angle:0},f=new Simulation({ingredient:'soda_water',targetMl:100});f.setTool('none',s);s.held=true;s.dragAngle=145;
for(let t=0;t<2;t+=1/120)f.tick(s,1/120);s.held=false;s.dragAngle=null;
for(let t=0;t<1;t+=1/120)f.tick(s,1/120);
const mass=f.caughtMl,foam=f.foamMl;assert(foam>0);
for(let t=0;t<5;t+=1/120)f.tick(s,1/120);
assert(f.foamMl<foam);assert(Math.abs(f.caughtMl-mass)<1e-7,'Settling foam must not create liquid');
console.log('PASS 72 ingredient/angle/frame-rate cases; pourer rules, finite supply, finish, mass conservation and foam settling');

const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'in',place:'homeDoor'});await outsidePlaytest.start();});
 let anchors;
 for(const day of [0,1,2,3])for(const flow of ['in','out']){
  const result=await p.evaluate(({day,flow})=>{
   const a=outsidePlaytest,m=a.model;m.start({day,flow,place:'homeDoor'});m.paused=false;m.tick=()=>{};m.controlsTutorial=false;m.time=2.5;a.snapCamera();a.tick(0);
   const n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');
   const poses=LunaCorridorBirds.poses(m,n),draws=[];LunaCorridorBirds.draw(m,n,n,(sp,x,y,sx,sy,flip)=>draws.push({asset:sp.asset,flip,x,y}));
   return {wet:LunaOutsideRain.wet(m),poses,draws};
  },{day,flow});
  const wet=day===1||day===3||day===0&&flow==='out'||day===2&&flow==='in';
  assert.equal(result.wet,wet);assert.equal(result.poses.length,7);
  assert(result.poses.every(v=>v.kind===(wet?'crow':'pigeon')));assert(result.draws.every(v=>!v.flip));
  const positions=result.poses.map(v=>[v.x,v.y]);if(anchors)assert.deepEqual(positions,anchors,'Stable anchors across weather/day/route');else anchors=positions;
  assert(result.poses.every(v=>Math.abs(v.y-11.11)<1e-8),'Feet contact the upper sill, not the playable floor');
  for(let i=1;i<positions.length;i++){
   const gap=positions[i][0]-positions[i-1][0],expected=[.15,.68,.18,.24,.57,.24][i-1];
   assert(Math.abs(gap-expected)<1e-8,'Tight left pair, asymmetric middle trio, unchanged right pair');
  }
  if(day===0){await p.waitForTimeout(150);await p.screenshot({path:'/private/tmp/corridor-birds-'+(wet?'rain':'dry')+'.png'});}
 }
 const checks=await p.evaluate(()=>{
  const a=outsidePlaytest,m=a.model,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');
  const before=LunaCorridorBirds.poses(m,n);m.time+=.2;const after=LunaCorridorBirds.poses(m,n);
  const shifted=LunaCorridorBirds.poses(m,n,{x:n.x+.5,y:n.y+.2});
  return {animated:before.some((v,i)=>v.frame!==after[i].frame),shifted:shifted.every((v,i)=>Math.abs(v.x-after[i].x-.5)<1e-8&&Math.abs(v.y-after[i].y-.2)<1e-8),house:LunaCorridorBirds.poses({...m,scene:'home'},n).length,qa:LunaCorridorBirds.poses({...m,qa:{}},n).length};
 });assert.deepEqual(checks,{animated:true,shifted:true,house:0,qa:0});
 await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.x-=.8;a.snapCamera();a.tick(0);});await p.setViewportSize({width:960,height:600});await p.waitForTimeout(200);await p.screenshot({path:'/private/tmp/corridor-birds-moving.png'});
 assert.deepEqual(errors,[]);console.log('CORRIDOR_BIRDS_OK: 8 weather cases, fixed seven anchors, all right-facing, feet/sill, idle phase, camera anchoring, no house/QA leakage');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

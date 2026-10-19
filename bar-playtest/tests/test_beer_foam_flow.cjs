const assert=require('node:assert/strict'),P=require('../src/features/crafting/pour-fluid.js');
const beer=P.materialFor('beer');
const fractions=[10,30,60,95,120].map(emissionRate=>P.foamFraction(beer,{emissionRate,emissionFlow:1}));
for(let i=1;i<fractions.length;i++)assert(fractions[i]>fractions[i-1]);
assert(fractions[3]>fractions[0]*10);assert(fractions[4]<=.34);
function pour(angle,fps=120){
 const f=new P.Simulation({ingredient:'beer',targetMl:180}),s={angle:0,held:false};f.setTool('none',s);s.held=true;s.dragAngle=angle;
 while(f.caughtMl<100&&f.time<30)f.tick(s,1/fps);
 assert(f.caughtMl>=100,'Reaches equal amount at '+angle);
 const result={angle,foam:f.foamHeight(),ml:f.caughtMl,retained:f.retainedFoamMl,time:f.time};
 s.held=false;s.dragAngle=null;for(let i=0;i<120;i++)f.tick(s,1/120);const caught=f.caughtMl,retained=f.retainedFoamMl;
 for(let i=0;i<90*120;i++)f.tick(s,1/120);
 assert(Math.abs(f.foamMl-retained)<1e-8);assert(Math.abs(f.caughtMl-caught)<1e-7);assert(Math.abs(f.audit().error)<1e-7);
 return result;
}
const samples=[100,115,145].map(angle=>pour(angle));
assert(samples[2].foam>30&&samples[2].foam<70);
assert(samples[2].foam>samples[1].foam*2);assert(samples[1].foam>samples[0].foam*2);
// Compare fixed elapsed time for frame-rate independence.
const runs=[30,60,120].map(fps=>{
 const f=new P.Simulation({ingredient:'beer',targetMl:180}),s={held:false,angle:0};f.setTool('none',s);s.held=true;s.dragAngle=145;
 for(let i=0;i<fps*2;i++)f.tick(s,1/fps);return f;
});
for(const f of runs.slice(1))for(const key of ['foamMl','caughtMl','retainedFoamMl'])assert(Math.abs(f[key]-runs[0][key])<1e-8,key);
console.log('PASS actual-flow foam curve, equal-volume slow/medium/fast contrast, 25% retention, conservation and frame rates',samples);
// Render the three equal-volume states without adding more liquid between shots.
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await page.locator('.updates-close').count())await page.locator('.updates-close').click();
 for(const [label,angle] of [['slow',100],['medium',115],['fast',145]]){
  const state=await page.evaluate(angle=>{
   const g=barGame;g.startMinigame('pour');const s=g.gimmick;s.ingredient='beer';s.target=180;s.unit='ml';LunaPour.init(s,g);g.holdPour(true);s.dragAngle=angle;
   while(s.fluid.caughtMl<100&&s.fluid.time<30)s.fluid.tick(s,1/120);
   g.tick=()=>{};g.changed();return {foam:s.fluid.foamHeight(),ml:s.fluid.caughtMl};
  },angle);
  assert(state.ml>=100&&state.ml<102);await page.locator('[data-pixel-pour]').waitFor();await page.waitForTimeout(150);
  await page.screenshot({path:'/private/tmp/beer-flow-'+label+'.png'});
 }
 assert.deepEqual(errors,[]);console.log('PASS slow/medium/fast equal-volume browser renders');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

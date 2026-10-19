const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent('<canvas width="1000" height="540"></canvas>');
  for(const file of ['src/features/crafting/pour-fluid.js','src/features/crafting/pour-liquid-renderer.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',file)});
  const result=await page.evaluate(()=>{
   const ctx=document.querySelector('canvas').getContext('2d'),style={rgb:[70,180,220],alpha:.7,highlight:'#dfffff',foam:'#ffffff'};
   let frames=0,firstFill=0;
   function check(f){
    ctx.clearRect(0,0,1000,540);LunaPourLiquid.drawLiquid(ctx,{fluid:f},style);LunaPourLiquid.drawStream(ctx,{fluid:f},style);
    const b=f.glass,data=ctx.getImageData(0,b.top,1000,540-b.top).data;
    for(let y=b.top;y<540;y++)for(let x=0;x<1000;x++)if(data[((y-b.top)*1000+x)*4+3]&&(x<b.left+3||x>=b.right-3||y>=b.bottom-3))throw Error(`Leak ${f.ingredient} t=${f.time} at ${x},${y}`);
    frames++;
   }
   for(const ingredient of ['gin','beer','soda_water','cola','champagne','milk'])for(const angle of [100,145,170]){
    const f=new LunaPour.Simulation({ingredient,targetMl:100}),s={held:false,angle:0};f.setTool(LunaPour.toolForIngredient(ingredient),s);s.held=true;s.dragAngle=angle;
    if(f.surfaceY!==f.glass.bottom-3)throw Error('Incorrect empty floor');
    for(let i=0;i<1200;i++){
     f.tick(s,1/120);
     if(Math.abs(f.audit().error)>1e-7)throw Error('Mass conservation');
     if(f.splash.some(p=>p.x<f.glass.left+3||p.x>=f.glass.right-3||p.y>=f.glass.bottom-3))throw Error('Escaped splash');
     if(i%24===0||(f.liquidMl>0&&f.liquidMl<4&&i%3===0)){check(f);if(f.liquidMl>0&&f.liquidMl<4)firstFill++;}
    }
    // Force rounded ribbons, foam and droplets onto all cavity boundaries.
    f.particles=[{id:1,x:482,y:515,age:0,emissionFlow:1,entered:true},{id:2,x:621,y:521,age:0,emissionFlow:1,entered:true}];
    f.splash=[{x:478,y:521,life:.2,vy:100},{x:622,y:522,life:.2,vy:100},{x:510,y:525,life:.2,vy:100}];check(f);
   }
   // Incoming stream remains visible above the open rim.
   const f=new LunaPour.Simulation({ingredient:'gin',targetMl:100});
   f.particles=[{id:1,x:510,y:220,age:0,emissionFlow:1},{id:2,x:512,y:240,age:0,emissionFlow:1}];check(f);
   if(!ctx.getImageData(500,210,30,40).data.some((v,i)=>i%4===3&&v))throw Error('Incoming stream hidden');
   return {frames,firstFill};
  });
  assert(result.firstFill>0);console.log('PASS glass containment, initial filling, edge stress, incoming stream, mass conservation:',result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

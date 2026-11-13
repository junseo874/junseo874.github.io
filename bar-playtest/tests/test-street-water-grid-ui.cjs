const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 const result=await p.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d',{willReadFrequently:true}),r=new LunaStreetAtmosphereRenderer(),rows=[];
  const paint=()=>{ctx.fillStyle='#181d29';ctx.fillRect(0,0,1280,720);for(let x=0;x<1280;x+=11){ctx.fillStyle=x%2?'#f05591':'#25bbef';ctx.fillRect(x,80,5,430);}ctx.fillStyle='#ffffee';ctx.fillRect(600,260,15,120);};
  for(const [index,pool]of LUNA_STREET_ATMOSPHERE.puddles.entries())for(const offset of [0,.007,.043]){
   const camera={x:pool.x+offset,y:pool.y+.6,w:4.8},ripples=new Float32Array(64).fill(-1);ripples.set([.5,.5,.25,1,.35,.7,.7,.8]);
   const snapshot=field=>{r.floatBloom=field;paint();r.puddles(ctx,camera,[pool],()=>ripples,()=>{});return ctx.getImageData(0,0,1280,720).data;};
   const direct=snapshot(false),grid=snapshot(true);let sum=0,max=0;for(let i=0;i<direct.length;i++){const d=Math.abs(direct[i]-grid[i]);sum+=d;max=Math.max(max,d);}rows.push({index,offset,mean:sum/direct.length,max});
  }
  const sizes=[...r.waterFields.values()].map(f=>[f.w,f.h]),error=r.gl.getError();r.dispose();return {rows,sizes,error};
 });assert.equal(result.error,0);assert(result.sizes.length<=9);for(const row of result.rows){assert(row.mean<.03,JSON.stringify(row));assert(row.max<=3,JSON.stringify(row));}console.log('STREET_WATER_GRID_OK',JSON.stringify(result));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});

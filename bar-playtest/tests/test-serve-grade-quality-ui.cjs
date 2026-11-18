const assert=require('node:assert/strict');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await load('playwright').chromium.launch({executablePath:chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}});await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.LunaServeGrade);
 const report=await p.evaluate(async()=>{
  const api=LunaServeGrade,records=[];
  for(const grade of Object.keys(api.assets)){
   const image=new Image();image.src=api.assets[grade].src;await image.decode();
   const player=api.createPlayback();player.reset(grade);await new Promise((resolve,reject)=>{const began=performance.now(),tick=()=>{if(player.ready)resolve();else if(performance.now()-began>10000)reject(Error('grade load timeout'));else setTimeout(tick,10);};tick();});
   for(const width of [1280,3840]){if(width===3840){player.reset(grade);await new Promise(resolve=>{const tick=()=>player.ready?resolve():setTimeout(tick,10);tick();});}for(const time of [.27,.30,.37,.42,3.4]){
    const scale=width/1280,canvas=document.createElement('canvas'),original=document.createElement('canvas');canvas.width=original.width=width;canvas.height=original.height=width*9/16;
    player.draw(canvas,image,time);if(canvas.dataset.renderError)throw Error(canvas.dataset.renderError);const rendering=LunaGradeEngine.create(),g=LUNA_SERVE_GRADE_REVEAL.grades.find(g=>g.id===grade);rendering.draw(canvas,g,{particles:[]},api.motionAt(time,grade),image,time,null,null,new Map());rendering.dispose();const x=original.getContext('2d'),r=api.bounds,m=api.motionAt(time,grade),anchorY=r.y+.405*r.w/2.522;
    x.scale(scale,scale);x.translate(640,anchorY);x.scale(m.sx,m.sy);x.translate(-640,-anchorY);x.globalAlpha=m.opacity;x.imageSmoothingQuality='high';x.drawImage(image,r.x,r.y,r.w,r.h);
    const a=canvas.getContext('2d').getImageData(0,0,width,canvas.height).data,e=x.getImageData(0,0,width,canvas.height).data;
    // Compare opaque stroke interiors; Unity trilinear and Canvas high-quality edge filters differ.
    let solid=0,missing=0,darkened=0;
    for(let i=0;i<e.length;i+=4)if(e[i+3]>=250&&[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>e[i+4*d+3]>=250)){solid++;if(a[i+3]<245)missing++;if(a[i]+a[i+1]+a[i+2]<(e[i]+e[i+1]+e[i+2])*.55)darkened++;}
    const top=anchorY+(r.y-anchorY)*m.sy,left=640+(r.x-640)*m.sx;
    records.push({grade,width,time,solid,missing,darkened,top,left,right:left+r.w*m.sx,source:canvas.dataset.lettering,error:canvas.dataset.renderError});
   }
   }
   player.dispose();
  }
  return records;
 });
 for(const r of report){assert.equal(r.error,undefined);assert.equal(r.missing,0,'Opaque original letters must never be clipped: '+JSON.stringify(r));assert(r.top>=16&&r.left>=0&&r.right<=1280,JSON.stringify(r));assert(r.darkened===0,'Opaque stroke interiors must not disappear before the authored foreground effects: '+JSON.stringify(r));assert(r.source.endsWith('/FX_TX_GradeText_'+r.grade[0].toUpperCase()+r.grade.slice(1)+'_01.png'));}
 console.log('GRADE_QUALITY_OK: all 5 original PNGs, 50 HD/4K reveal samples, tall overshoot inside stage, no clipped glyphs or disappearing stroke interiors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

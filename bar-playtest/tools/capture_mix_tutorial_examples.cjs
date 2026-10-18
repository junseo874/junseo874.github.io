// Capture only real game board regions; markers are a separate SVG UI layer.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const out=path.resolve(__dirname,'../assets/mix-tutorial-20261018');fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  // Keep unrelated clock/count-in overlays out of the explanatory regions.
  await p.addStyleTag({content:'.mix-timer,.rhythm-count-in{visibility:hidden!important}'});
  await p.evaluate(()=>{barGame.tick=()=>{};});
  const data={};
  for(const mode of ['stir','path','fall','cross'])for(const page of [0,1]){
   await p.evaluate(({mode,page})=>{
    const g=barGame,kind=mode==='stir'?'stir':'shake';lunaCampaign.ui.shakeMode=mode;
    g.startMinigame(kind);g.progress.flags['mix_tutorial_'+kind]=true;delete g.gimmick.mixTutorial;
    const s=g.gimmick;
    if(mode==='stir'){if(page){g.gimmickInput('KeyW');g.gimmickInput('KeyD');s.circleTime=.7;s.spoonAngle=90;}}
    else {s.started=true;if(mode==='path'){s.rhythm.trackTime=page?1.1:.65;LunaShakeRhythm.updatePath(s,g.rng);}else{s.rhythm.trackTime=s.rhythm.notes[0].time-(page?0:.5);}s.elapsed=s.rhythm.trackTime;}
    lunaCampaign.render(true);
   },{mode,page});
   await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);
   const region=await p.evaluate(({mode,page})=>{
    const el=document.querySelector(mode==='stir'?'.stir-dial':'.rhythm-stage'),b=el.getBoundingClientRect(),pad=mode==='stir'?30:0;
    const clip={x:b.x-pad,y:b.y-pad,width:b.width+pad*2,height:b.height+pad*2};
    const box=(selector,label)=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x-clip.x-4,y:r.y-clip.y-4,w:r.width+8,h:r.height+8,label};};
    let marks;
    if(mode==='stir')marks=page?[box('.stir-orbit','1'),box('.mix-direction[data-id="KeyS"]','2')]:['W','D','S','A'].map((k,i)=>box('.mix-direction[data-id="Key'+k+'"]',String(i+1)));
    else if(mode==='path')marks=[box('[data-path-marker]','1'),box('[data-path-node="fixed:1"] .path-core','2')];
    else marks=[box('[data-rhythm-note="0"] .note-body','1'),box('.rhythm-target .target-orbit','2')];
    return{clip,marks};
   },{mode,page});
   const id=mode+'-'+page;await p.screenshot({path:path.join(out,id+'.png'),clip:region.clip});
   data[id]={src:'assets/mix-tutorial-20261018/'+id+'.png',w:region.clip.width,h:region.clip.height,marks:region.marks};
  }
  fs.writeFileSync(path.resolve(__dirname,'../mix-tutorial-examples.js'),'/* Generated from real game board crops by tools/capture_mix_tutorial_examples.cjs. */\nwindow.LunaMixExamples='+JSON.stringify(data,null,1)+';\n');
  console.log('Captured 8 real board regions and marker coordinates');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

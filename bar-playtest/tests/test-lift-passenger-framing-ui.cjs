const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 const data=await p.evaluate(async()=>{
  lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'homeDoor'});await outsidePlaytest.start();
  const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=R.elevatorX;m.updateNear();m.tick=()=>{};o.snapCamera();o.tick(0);
  const nodes=LUNA_OUTSIDE_DATA.scenes.street.nodes,body=nodes.find(n=>n.name==='Elevator'),front=nodes.find(n=>n.name==='Elevator Fore'),line=nodes.find(n=>n.name==='Elevator Line');
  return{R,body,front,line,engineLine:LunaEngineWorld.node('street',line.id),frames:['idle','walk','run'].flatMap(id=>LUNA_OUTSIDE_DATA.animations[id].frames),assets:LUNA_OUTSIDE_DATA.assets};
 });
 assert.equal(data.R.cabinOffsetY,-.18);assert.equal(data.line.y,data.engineLine.y,'stationary support stays fixed');
 const read=async s=>rt.load('sharp')(path.resolve(__dirname,'..',data.assets[s.asset].src)).extract({left:s.x,top:s.y,width:s.w,height:s.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const front=await read(data.front.sprite),checks=[];
 for(const frame of data.frames){const actor=await read(frame);
  for(const [label,py,cy]of [['upper',data.R.upperY,data.R.elevatorTop],['lower',-.7,data.R.elevatorBottom],['riding',4+data.R.passengerOffset,4]])for(const flip of [false,true]){
   let shoulders=0,feet=0,leaks=0;
   const fy=data.front.y+cy-data.R.elevatorBottom,sp=data.front.sprite;
   for(let y=26;y<frame.h;y++)for(let x=0;x<frame.w;x++){
    if(actor.data[(y*frame.w+x)*4+3]<128)continue;
    const wx=data.R.elevatorX+(flip?frame.w*frame.pivot.x-x-.5:x+.5-frame.w*frame.pivot.x)/frame.ppu;
    const wy=py+(frame.h*(1-frame.pivot.y)-y-.5)/frame.ppu;
    const fx=Math.floor((wx-data.front.x)/data.front.sx*sp.ppu+sp.w*sp.pivot.x),sy=Math.floor(sp.h*(1-sp.pivot.y)-(wy-fy)/data.front.sy*sp.ppu);
    const opacity=fx>=0&&fx<sp.w&&sy>=0&&sy<sp.h?front.data[(sy*sp.w+fx)*4+3]:0;
    if(y>=41&&y<=46&&opacity<128)shoulders++;
    if(y>=75){feet++;if(opacity<128)leaks++;}
   }
   assert(shoulders>=8,JSON.stringify({label,flip,shoulders}));assert.equal(leaks,0,JSON.stringify({label,flip,feet,leaks}));checks.push({label,shoulders,feet});
  }
 }
 const out=path.resolve(__dirname,'../../artifacts/lift-framing');fs.mkdirSync(out,{recursive:true});
 await p.screenshot({path:path.join(out,'upper.png')});
 for(const [label,from,to]of [['descending',data.R.elevatorTop,data.R.elevatorBottom],['ascending',data.R.elevatorBottom,data.R.elevatorTop]]){
  const state=await p.evaluate(({from,to})=>{
   const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.story.cancel();m.level=from===R.elevatorTop?1:0;m.elevatorY=from;m.y=m.level?R.upperY:-.7;
   m.ride={from,to,time:0,call:false,duration:12};m.tickLift(6);
   const engine=LUNA_CHARACTER_SHADOWS.receivers.find(r=>r.ancestry.includes('Elevator')),receiver=LunaCharacterShadows.receivers(m).find(r=>r.id===engine.id);
   const expected=engine.rect.map((v,i)=>v+(i%2?m.elevatorY-R.elevatorBottom+R.cabinOffsetY:0));
   o.snapCamera();o.tick(0);return{offset:m.y-m.elevatorY,expected,actual:receiver.rect};
  },{from,to});
  assert(Math.abs(state.offset-data.R.passengerOffset)<1e-9);state.actual.forEach((v,i)=>assert(Math.abs(v-state.expected[i])<1e-9));
  await p.screenshot({path:path.join(out,label+'.png')});
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.tickLift(8);m.time+=20;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.ride),null);
  await p.screenshot({path:path.join(out,label+'-landed.png')});
 }
 assert.deepEqual(errors,[]);console.log('LIFT_PASSENGER_FRAMING_OK',checks.length,'idle/walk/run frame/facing/stop cases: neck and chest visible, no toe leakage; both travel directions, shared receiver offset and unchanged rail/passenger anchors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

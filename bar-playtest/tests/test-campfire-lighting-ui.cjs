const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{
  Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();
  const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};
  window.campDraw=o.tick.bind(o);o.tick=()=>{};m.x=-15.65;m.time=1;o.snapCamera();campDraw(0);
 });
 const source=await page.evaluate(()=>{
  const m=outsidePlaytest.model,F=LunaBarrelFire,S=LunaCharacterShadows,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='B_Obects');
  const fire=F.worldLight(m),original={x:n.x,y:n.y,flip:n.flip,active:n.active};
  n.x+=2;n.y+=3;const shifted=F.worldLight(m);Object.assign(n,original);n.flip=!n.flip;const flipped=F.worldLight(m);Object.assign(n,original);
  n.active=false;const inactive=F.worldLight(m);Object.assign(n,original);
  const gains=[1,1.04,1.2,1.7].map(time=>{m.time=time;return [F.worldLight(m).gain,F.render(time).energy];});
  const p={x:fire.x,y:-.974};return {fire,shift:[shifted.x-fire.x,shifted.y-fire.y],mirror:flipped.x+fire.x-2*n.x,inactive:inactive.active,gains,
   upstairs:S.influence({x:fire.x,y:9.74},fire),distant:S.influence({x:-10,y:p.y},fire),
   near:S.influence(p,fire),far:S.influence({x:fire.x-1.5,y:p.y},fire),
   directions:[S.direction({x:fire.x-.4,y:p.y},fire,1)[0],S.direction({x:fire.x+.4,y:p.y},fire,1)[0]]};
 });
 assert(Math.abs(source.fire.x+15.946)<1e-6&&Math.abs(source.fire.y+.629)<1e-6,'source matches the replacement prop flame, not original atlas');
 assert.deepEqual(source.shift,[2,3]);assert(Math.abs(source.mirror)<1e-6);assert.equal(source.inactive,false);
 assert(source.gains.every(([a,b])=>a===b));assert(new Set(source.gains.map(p=>p[0])).size>1);
 assert.equal(source.upstairs,0);assert.equal(source.distant,0);assert(source.near>source.far);assert(source.directions[0]<0&&source.directions[1]>0);
 const optics=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),image=document.createElement('canvas');image.width=40;image.height=80;
  const c=image.getContext('2d');c.fillStyle='#444';c.fillRect(10,5,20,70);
  const sp={x:0,y:0,w:40,h:80,pivot:{x:.5,y:0}},canvas=document.createElement('canvas');canvas.width=40;canvas.height=80;const d=canvas.getContext('2d',{willReadFrequently:true});
  function paint(x,flip=false){const out=r.characterLighting(image,sp,{x:0,y:0,width:.4,height:.8,flip,foot:{x:0,y:0},state:{position:[x,.4],weight:1,color:[1,.48,.12],localLight:[2.6,1,.87]},config:{...LunaCharacterLighting.config,rimIntensity:.4,rimGlow:.2}});d.clearRect(0,0,40,80);d.drawImage(out.image,0,0);return d.getImageData(0,0,40,80).data;}
  function edge(p,x){let sum=0;for(let y=38;y<42;y++)sum+=p[(y*40+x)*4];return sum;}
  const left=paint(-.15),far=paint(-1),right=paint(.15),flip=paint(.15,true);let leaks=0;
  for(let y=0;y<80;y++)for(let x=0;x<40;x++)if((x<10||x>=30||y<5||y>=75)&&left[(y*40+x)*4+3])leaks++;
  return {left:[edge(left,10),edge(left,29)],right:[edge(right,10),edge(right,29)],flip:[edge(flip,10),edge(flip,29)],far:edge(far,10),leaks,gl:r.lightingRenderer.gl.getError()};
 });
 assert(optics.left[0]>optics.left[1]);assert(optics.right[1]>optics.right[0]);assert(optics.flip[0]>optics.flip[1]);
 assert(optics.left[0]>optics.far,'nearby flame inside transparent sprite bounds must not extinguish the rim');assert.equal(optics.leaks,0);assert.equal(optics.gl,0);
 const samples=[];
 for(const pose of [{name:'left',x:-16.55,y:-.7,fire:true},{name:'right',x:-15.2,y:-.7,fire:true},{name:'away',x:-11,y:-.7,fire:false},{name:'upper',x:-15.8,y:9.74,level:1,fire:false}]){
  const sample=await page.evaluate(pose=>{
   const o=outsidePlaytest,m=o.model;Object.assign(m,{level:0,facing:-1},pose);o.snapCamera();
   for(let i=0;i<45;i++){m.time+=1/60;campDraw(0);}
   const a=LunaCharacterLighting.inspect(m),state=a.actors.get('player'),before=JSON.stringify(state),soles=[];
   const r=LunaStreetAtmosphere.inspect(m).renderer,paint=r.characterLighting;
   r.characterLighting=function(image,sp,p){if(['boss','gang-left','gang-far','gangmate'].includes(sp.lightingId))soles.push({id:sp.lightingId,y:p.foot.y});return paint.call(this,image,sp,p);};
   try{campDraw(0);}finally{r.characterLighting=paint;}
   const gang=['boss','gang-left','gang-far','gangmate'].map(id=>({id,selected:a.actors.get(id)?.selected}));
   const shadows=LunaCharacterShadows.inspect(m),renderer=LunaStreetAtmosphere.inspect(m).renderer;
   return {name:pose.name,selected:state.selected,gang,soles,stable:before===JSON.stringify(a.actors.get('player')),slots:shadows.slots.length,fireEnergy:shadows.slots.find(s=>s.id==='barrel-fire')?.energy,gl:renderer.gl.getError()};
  },pose);
  assert.equal(sample.selected==='barrel-fire',pose.fire,pose.name);assert(sample.stable);assert(sample.slots<=16);assert(sample.fireEnergy>0);assert.equal(sample.gl,0);
  if(pose.fire){assert(sample.soles.length>=4&&sample.soles.every(s=>Math.abs(s.y+.974)<1e-6),'NPC light distances use opaque soles, not transparent atlas padding');}
  if(pose.fire)assert(sample.gang.every(g=>g.selected==='barrel-fire'),'all four camp members face the fire light: '+JSON.stringify(sample.gang));
  samples.push(sample);await page.screenshot({path:'/private/tmp/campfire-lighting-'+pose.name+'.png'});
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 const still=await page.evaluate(()=>{const m=outsidePlaytest.model;m.time=3;const a=LunaBarrelFire.worldLight(m).gain;m.time=30;return [a,LunaBarrelFire.worldLight(m).gain,LunaBarrelFire.render(30,true).energy];});assert(still.every(x=>x===still[0]));
 assert.deepEqual(errors,[]);console.log('CAMPFIRE_LIGHTING_UI_OK',JSON.stringify({source,optics,samples}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const optics=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true}),r=new LunaStreetAtmosphereRenderer(),cam={x:0,y:0,w:4};
  const actor=document.createElement('canvas');actor.width=40;actor.height=60;const a=actor.getContext('2d');a.fillStyle='#fff';a.fillRect(7,0,18,20);a.fillRect(10,20,20,25);a.fillRect(10,45,6,15);a.fillRect(24,45,6,15);
  const spec={image:actor,sp:{x:0,y:0,w:40,h:60,pivot:{x:.5,y:0}},pivot:{x:0,y:0},width:.4,height:.6,foot:{x:0,y:0},flip:false,rect:[-.5,-.2,.5,.01],softness:1,color:LUNA_CHARACTER_SHADOWS.player.color,ambient:.3,contact:[0,-.12,0,.1],field:LunaCharacterShadows.fillField({x:0,y:0},[])};
  function paint(dx,flip=false){ctx.fillStyle='#808080';ctx.fillRect(0,0,1280,720);r.characterShadow(ctx,cam,{...spec,flip,projections:[[dx,-.28,.65,1]],emitters:[[-dx,1,5,1]]});return ctx.getImageData(0,0,1280,720).data;}
  function measure(p){let weight=0,x=0,leaks=0,bright=0;for(let y=0;y<720;y++)for(let col=0;col<1280;col++){const i=(y*1280+col)*4,d=128-p[i];if(p[i]>128||p[i+1]>128||p[i+2]>128)bright++;if(d>1){weight+=d;x+=col*d;if(y<360||y>=424||col<480||col>=800)leaks++;}}return {weight,x:x/weight,leaks,bright};}
  const left=paint(-.6),right=paint(.6),paused=paint(.6),flipped=paint(.6,true);
  const diff=(x,y)=>x.reduce((n,v,i)=>n+(v!==y[i]),0);
  // A second animation frame changes the projected silhouette; it is not an ellipse.
  const next=document.createElement('canvas');next.width=40;next.height=60;const n=next.getContext('2d');n.drawImage(actor,0,0);n.clearRect(0,40,40,20);n.fillStyle='#fff';n.fillRect(0,40,12,20);spec.image=next;
  const walk=paint(.6);spec.image=actor;
  function multiple(energy=1,field=spec.field){ctx.fillStyle='#808080';ctx.fillRect(0,0,1280,720);r.characterShadow(ctx,cam,{...spec,field,projections:[[-.6,-.28,.65,1],[.6,-.28,.65,1]],emitters:[[.6,1,5,1],[-.6,1,5,energy]]});return ctx.getImageData(0,0,1280,720).data;}
  function side(p,right){let sum=0;for(let y=370;y<424;y++)for(let x=right?680:500;x<(right?780:600);x++)sum+=128-p[(y*1280+x)*4];return sum;}
  const both=multiple(),weak=multiple(.2);
  const volume={active:true,intensity:4,color:[1,1,1],gain:1,points:[[.05,-.3],[.6,-.3],[.6,0],[.05,0]],bounds:[0,-.35,.65,.05],falloff:.05};
  const filled=multiple(1,LunaCharacterShadows.fillField({x:0,y:0},[volume]));
  const multi={left:side(both,false),right:side(both,true),weakRight:side(weak,true),fillLeft:side(filled,false),fillRight:side(filled,true)};
  return {multi,left:measure(left),right:measure(right),pauseDiff:diff(right,paused),flipDiff:diff(right,flipped),walkDiff:diff(right,walk),gl:r.gl.getError()};
 });
 assert(optics.multi.left>1000&&optics.multi.right>1000,'Opposite lights produce simultaneous distinct shadows');assert(optics.multi.weakRight<optics.multi.right*.6,'Weaker light produces a weaker shadow');assert(optics.multi.fillRight<optics.multi.right*.6,'Local unblocked fill light washes out only the illuminated shadow');assert(Math.abs(optics.multi.fillLeft-optics.multi.left)<10,'Fill must not wash out the unlit side');
 assert(optics.left.weight>1000&&optics.right.weight>1000);assert(optics.left.x<630&&optics.right.x>650,'Light position changes the projection side');
 assert.equal(optics.left.leaks+optics.right.leaks,0,'No shadow outside the receiver or above the feet');assert.equal(optics.left.bright+optics.right.bright,0,'Dark shadows cannot become bright blue cutouts');
 assert.equal(optics.pauseDiff,0);assert(optics.flipDiff>100);assert(optics.walkDiff>100);assert.equal(optics.gl,0);
 await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.shadowTick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();});
 const cases=[{name:'left',x:-11,y:-.7,anim:'idle'},{name:'right',x:-9.7,y:-.7,anim:'walk'},{name:'run',x:-7,y:-.7,anim:'run'},{name:'upper',x:-16,y:9.74,level:1},{name:'lift',x:-12.645,y:4.39,elevatorY:4,level:1}];
 for(const c of cases){await page.evaluate(c=>{const o=outsidePlaytest,m=o.model;Object.assign(m,{level:0,elevatorY:-1.09,anim:'idle',animTime:.2},c);o.snapCamera();for(let i=0;i<25;i++){m.time+=1/60;shadowTick(0);}},c);await page.screenshot({path:`/tmp/character-shadow-${c.name}.png`});const state=await page.evaluate(()=>({receiver:LunaCharacterShadows.inspect(outsidePlaytest.model).receiver?.name,gl:LunaStreetAtmosphere.inspect(outsidePlaytest.model).renderer.gl.getError()}));assert.equal(state.receiver,c.name==='upper'?'2F':c.name==='lift'?'Floor':'1F');assert.equal(state.gl,0);}
 await page.setViewportSize({width:800,height:600});await page.waitForTimeout(100);await page.evaluate(()=>shadowTick(0));assert.deepEqual(errors,[]);
 console.log('CHARACTER_SHADOWS_UI_OK',JSON.stringify(optics),'real idle/walk/run, corridor, moving lift and resize');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

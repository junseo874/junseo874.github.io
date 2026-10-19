const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
const sharp=load('sharp');
(async()=>{
 const root=path.resolve(__dirname,'..'),window={};
 vm.runInNewContext(fs.readFileSync(path.join(root,'data/runtime/outside-scene-data.js'),'utf8'),{window});
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/features/outside/home-art.js'),'utf8'),{window});
 const {layers}=window.LunaHomeArt,dir=path.join(root,window.LunaHomeArt.root);
 for(const file of fs.readdirSync(dir)){
  const source=path.join('/Users/lee/Desktop/크리스집',file);
  if(fs.existsSync(source))assert(fs.readFileSync(source).equals(fs.readFileSync(path.join(dir,file))),'Original bytes: '+file);
 }
 assert.equal(fs.readdirSync(dir).length,12);
 const composed=await sharp({create:{width:643,height:270,channels:4,background:'#000'}})
  .composite(layers.map(l=>({input:path.join(dir,l.file),left:l.x,top:l.y}))).removeAlpha().raw().toBuffer();
 const reference=await sharp(path.join(root,'assets/reference/previews/chris-home-fullshot.png')).removeAlpha().raw().toBuffer();
 let delta=0;
 // Compare the unchanged full shot; the separated fence is deliberately shifted
 // one native pixel left to meet the exterior opening at x=585.
 for(let y=0;y<270;y++)for(let x=0;x<643;x++)for(let c=0;c<3;c++)if(!(x>=585&&y>=198))delta+=Math.abs(composed[(y*643+x)*3+c]-reference[(y*643+x)*3+c]);
 assert(delta/(643*270*3)<.5,'Complete composition differs by less than half an RGB level from the supplied full shot');
 const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();outsidePlaytest.model.x=2.557;outsidePlaytest.model.story.cancel();outsidePlaytest.model.backgroundStory.cancel();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  const depth=await page.evaluate(()=>{
   const calls=[],paint=LunaHomeArt.paintCity;
   LunaHomeArt.paintCity=(...args)=>{calls.push(args[6]);return paint(...args);};
   for(const x of [.5,2.557]){outsidePlaytest.model.x=x;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);}
   LunaHomeArt.paintCity=paint;
   return calls;
  });
  assert(depth.length>=2&&depth.at(-1)>depth[0],'Rendered city responds to camera movement');
  const exterior=await page.evaluate(()=>{
   const bg=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg'),cam=outsidePlaytest.renderCamera;
   const canvas=document.querySelector('.outside-stage canvas'),ctx=canvas.getContext('2d');
   return [[610,175],[610,218],[570,170],[570,237],[610,245],[585,250],[610,250]].map(([u,v])=>{
    const x=640+(bg.x+(u-bg.sprite.w/2)/100-cam.x)*1280/cam.w;
    const y=360-(bg.y+(bg.sprite.h/2-v)/100-cam.y)*1280/cam.w;
    return {x,y,u,v,floor:v===237,black:(u===570&&v===170)||v>=245,pixel:Array.from(ctx.getImageData(Math.floor(x*canvas.width/1280),Math.floor(y*canvas.height/720),1,1).data)};
   });
  });
  for(const sample of exterior){assert(sample.x>=0&&sample.x<1280,'Exterior lies inside the camera');if(sample.floor)assert(Math.min(...sample.pixel.slice(0,3))>60,'Floor joins the room and railing across the pillar');else if(sample.black)for(let c=0;c<3;c++)assert(Math.abs(sample.pixel[c]-(sample.v>=245?[1,1,7][c]:reference[(sample.v*643+sample.u)*3+c]))<=3,'Pillar remains intact and city cannot show below the floor: '+JSON.stringify(sample));else assert(Math.max(...sample.pixel.slice(0,3))>20,'Exterior city and railing stay visible at their authored position');}
  const floorPixels=await page.evaluate(async()=>{
   const cv=document.createElement('canvas');cv.width=643;cv.height=270;
   const ctx=cv.getContext('2d');ctx.fillStyle='#39caff';ctx.fillRect(0,0,643,270);
   const im=new Image();im.src=LunaHomeArt.root+'123.png';await im.decode();
   LunaHomeArt.paintFence(ctx,im,585,198,56,55);
   return {seam:Array.from(ctx.getImageData(585,198,1,4).data),edge:Array.from(ctx.getImageData(558,238,85,1).data),below:Array.from(ctx.getImageData(558,239,85,31).data)};
  });
  assert.deepEqual(floorPixels.seam.slice(0,4),[1,1,4,255],'Fence top rail reaches the exterior opening without a blue one-pixel slit');
  for(let i=0;i<floorPixels.edge.length;i+=4)assert.deepEqual(floorPixels.edge.slice(i,i+4),[108,106,130,255],'Neutral footing without a magnified cyan fringe');
  for(let i=0;i<floorPixels.below.length;i+=4)assert.deepEqual(floorPixels.below.slice(i,i+4),[1,1,7,255],'No city visible below the footing');
  const roomFringe=await page.evaluate(async()=>{
   const im=new Image();im.src=LunaHomeArt.root+'Chrishouse2.png';await im.decode();
   const cv=document.createElement('canvas');cv.width=643;cv.height=270;const ctx=cv.getContext('2d');
   LunaHomeArt.paintRoom(ctx,im,0,0,643,270);
   return [50,320,500].map(x=>[Array.from(ctx.getImageData(x,237,1,1).data),Array.from(ctx.getImageData(x,238,1,1).data)]);
  });
  for(const [floor,edge]of roomFringe)assert.deepEqual(edge,floor,'Room floor extends without the cyan source fringe');
  await page.screenshot({path:'/private/tmp/chris-home-game.png'});
  const audit=await page.evaluate(async()=>{
   const data=LUNA_OUTSIDE_DATA,bg=data.scenes.home.nodes.find(n=>n.name==='main_bg');
   const left=bg.x-bg.sprite.w/200,top=bg.y+bg.sprite.h/200;
   const nodes=LunaHomeArt.layers.map(layer=>{
    const n=data.scenes.home.nodes.find(n=>n.name===layer.name);
    return {name:n.name,src:data.assets[n.sprite.asset].src,x:Math.round((n.x-left)*100-n.sprite.w/2),y:Math.round((top-n.y)*100-n.sprite.h/2)};
   });
   for(const kind of ['opening','sleep','morning']){
    const scene=await lunaCampaign.prepareStudio(kind),house=scene.clips.filter(c=>c.track==='house'||c.track.startsWith('house-'));
    if(house.length!==LunaHomeArt.layers.length)throw Error('Missing room layer in '+kind);
    const base=house.find(c=>c.track==='house');
    for(const clip of house){
     if(clip.start!==base.start||clip.duration!==base.duration)throw Error('Room layer disappears in '+kind);
     if(!StudioMedia.assets.get(clip.assetId).src.includes('/outside/chris-home/'))throw Error('Retired house art in '+kind);
    }
   }
   return nodes;
  });
  for(const [i,l]of layers.entries())assert.deepEqual(audit[i],{name:l.name,src:window.LunaHomeArt.root+l.file,x:l.x,y:l.y});
  assert.deepEqual(errors,[]);
  console.log('PASS 12 original house sheets; full-shot mean RGB difference '+(delta/(643*270*3)).toFixed(4)+'; gameplay placements and opening/sleep/morning use the same complete room');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

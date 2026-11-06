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
 const coverFile=path.basename(window.LUNA_OUTSIDE_DATA.assets[window.LunaHomeArt.book.cover].src);
 assert(fs.existsSync(path.join(dir,coverFile)),'Inspection cover is available alongside the house art');
 assert.equal(layers.length,13);
 assert.equal(new Set(layers.map(l=>window.LunaHomeArt.assetPath(l.file))).size,13);
 const parts=[];
 for(const l of layers){
  const file=path.join(root,window.LunaHomeArt.assetPath(l.file)),meta=await sharp(file).metadata();
  assert.equal(meta.width,l.name==='home-city'?643:l.w);assert.equal(meta.height,l.h);
  parts.push({input:await sharp(file).resize(l.w,l.h).toBuffer(),left:l.x,top:l.y});
 }
 const composed=await sharp({create:{width:631,height:270,channels:4,background:'#000'}}).composite(parts).removeAlpha().raw().toBuffer();
 const reference=await sharp(path.join(root,window.LunaHomeArt.assetPath('Chrishouse_BG_City.png'))).flatten({background:'#000'}).removeAlpha().raw().toBuffer();
 let delta=0,count=0;
 // The skyline moves independently; all other pixels match the current full shot.
 for(let y=0;y<270;y++)for(let x=0;x<615;x++){
  if(x>=307&&x<=436&&y>=130&&y<=185)continue;
  for(let c=0;c<3;c++){delta+=Math.abs(composed[(y*631+x)*3+c]-reference[(y*631+x)*3+c]);count++;}
 }
 assert(delta/count<.5,'Current split room matches the artist full shot');
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
  const roomFringe=await page.evaluate(async()=>{
   const im=new Image();im.src=LunaHomeArt.assetPath('Chrishouse.png');await im.decode();
   const cv=document.createElement('canvas');cv.width=631;cv.height=270;const ctx=cv.getContext('2d');
   LunaHomeArt.paintRoom(ctx,im,0,0,631,270);
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
    if(house.length!==LunaHomeArt.layers.length-1)throw Error('Missing room layer in '+kind);
    if(house.some(c=>c.assetId==='opening-home-home-tv-screen'))throw Error('TV must start off in '+kind);
    const base=house.find(c=>c.track==='house');
    for(const clip of house){
     if(clip.start!==base.start||clip.duration!==base.duration)throw Error('Room layer disappears in '+kind);
     if(!LunaHomeArt.layers.some(l=>StudioMedia.assets.get(clip.assetId).src.endsWith(LunaHomeArt.assetPath(l.file))))throw Error('Retired house art in '+kind);
    }
   }
   return nodes;
  });
  for(const [i,l]of layers.entries())assert.deepEqual(audit[i],{name:l.name,src:window.LunaHomeArt.assetPath(l.file),x:l.x,y:l.y});
  assert.deepEqual(errors,[]);
  console.log('PASS 13 current house layers; full-shot mean RGB difference '+(delta/count).toFixed(4)+'; gameplay placements and opening/sleep/morning use the same complete room');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

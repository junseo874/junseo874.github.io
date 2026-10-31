// Read-only, narrow import of the Fire sprite, split barrel and Shader Graph inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
const game=path.resolve(__dirname,'..'),engine=process.argv.find(a=>a.startsWith('--engine='))?.slice(9)||'/Users/lee/Desktop/project/Human-Bartender/HumanBartender';
const root=path.join(engine,'Assets/01.Game'),content=path.join(root,'03.Content');
const read=f=>fs.readFileSync(f,'utf8'),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sources={};function track(f){sources[path.relative(engine,f)]={sha256:hash(f)};return f;}
const guidFiles=new Map(fs.readdirSync(content,{recursive:true}).filter(f=>f.endsWith('.meta')).map(f=>{const p=path.join(content,f);return [read(p).match(/^guid: (.+)$/m)?.[1],p.slice(0,-5)];}));
const scene=read(track(path.join(root,'01.Scenes/OutSide.unity'))),blocks=new Map([...scene.matchAll(/^--- !u!(\d+) &(\d+)[^\n]*\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)].map(m=>[m[2],{type:+m[1],text:m[3]}]));
const value=(t,k)=>t.match(new RegExp('^\\s*'+k+': (.*)$','m'))?.[1],num=(t,k)=>+value(t,k),ref=s=>s?.match(/fileID: (-?\d+)/)?.[1];
const vec=(t,k)=>Object.fromEntries([...String(value(t,k)).matchAll(/(\w+): ([\d.e+-]+)/g)].map(m=>[m[1],+m[2]]));
const file=s=>guidFiles.get(s?.match(/guid: (\w+)/)?.[1]);
const transforms=new Map([...blocks].filter(([,b])=>b.type===4)),byGo=new Map([...transforms].map(([id,b])=>[ref(value(b.text,'m_GameObject')),id]));
function world(id){if(!id||id==='0')return {x:0,y:0,sx:1,sy:1};const t=transforms.get(id).text,p=vec(t,'m_LocalPosition'),s=vec(t,'m_LocalScale'),q=vec(t,'m_LocalRotation'),parent=world(ref(value(t,'m_Father')));if(q.x||q.y||q.w!==1&&Math.abs(q.z)!==1)throw Error('Review rotated fire transform');const sign=q.w===0?-1:1;return {x:parent.x+p.x*parent.sx,y:parent.y+p.y*parent.sy,sx:s.x*parent.sx*sign,sy:s.y*parent.sy*sign};}
const assets={},dir=path.join(game,'assets/outside/effects/fire');fs.mkdirSync(dir,{recursive:true});
function sprite(rendererId,key,filename){const t=blocks.get(rendererId).text,src=track(file(value(t,'m_Sprite'))),meta=read(track(src+'.meta')),png=fs.readFileSync(src),w=png.readUInt32BE(16),h=png.readUInt32BE(20);if(num(meta,'spriteMode')!==1||num(meta,'alignment')!==7)throw Error('Review barrel pivot');fs.copyFileSync(src,path.join(dir,filename));assets[key]={src:'assets/outside/effects/fire/'+filename,w,h,source:path.relative(engine,src),sha256:hash(src)};return {id:rendererId,go:ref(value(t,'m_GameObject')),...world(byGo.get(ref(value(t,'m_GameObject')))),sprite:{asset:key,x:0,y:0,w,h,pivot:{x:.5,y:0},ppu:num(meta,'spritePixelsToUnits')},sortingLayer:num(t,'m_SortingLayerID'),order:num(t,'m_SortingOrder')};}
function streamJSON(s){let start=0,depth=0,quoted=false,escape=false,out=[];for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='{'){if(!depth)start=i;depth++;}else if(c==='}'&&!--depth)out.push(JSON.parse(s.slice(start,i+1)));}return out;}
(async()=>{
 const project=read(track(path.join(engine,'ProjectSettings/ProjectSettings.asset')));if(num(project,'m_ActiveColorSpace')!==1)throw Error('Review fire color-space conversion');
 const back=sprite('980668472','street-camp-props','camp-props.png'),front=sprite('1985635297','street-barrel-front','barrel-front.png');
 const fireText=blocks.get('419967017').text,materialFile=track(file(fireText.match(/m_Materials:\s*\n\s*- (.*)/)[1])),material=read(materialFile),graphFile=track(file(value(material,'m_Shader')));
 const graph=streamJSON(read(graphFile)),byId=new Map(graph.map(o=>[o.m_ObjectId,o]));track(path.join(path.dirname(graphFile),'HL_FirePixelate.hlsl'));
 const scalar=k=>Number(material.match(new RegExp('- '+k+': ([^\\n]+)'))?.[1]);
 const props=Object.fromEntries(graph[0].m_Properties.map(r=>byId.get(r.m_Id)).filter(o=>typeof o.m_Value==='number').map(o=>[o.m_DefaultReferenceName,scalar(o.m_DefaultReferenceName)]));
 if(Object.values(props).some(v=>!Number.isFinite(v)))throw Error('Unresolved fire material property');
 function constant(prefix,slot){const n=graph.find(o=>o.m_ObjectId.startsWith(prefix)),s=n.m_Slots.map(r=>byId.get(r.m_Id)).find(s=>s.m_Id===slot),v=s.m_Value;return typeof v==='number'?v:v.x??v.e00;}
 const constants={distortion:constant('aa393f',1),distortion2:constant('fa6723',1),auraPower:constant('7f253a',1),hotPower:constant('e5439a',1),warmPower:constant('1b4699',1),hotGain:constant('ab720e',1),warmGain:constant('8a409b',1),basePower:constant('cbfee4',1),bodyPower:constant('3ee0ea',1)};
 const textures={};for(const [k,name] of [['_TX_AuraTile_01','aura'],['_TX_Cloud_01','cloud'],['_TX_DistRG_01','distortion']]){
  const source=track(file(material.match(new RegExp('- '+k+':\\n\\s+m_Texture: (.*)'))[1])),meta=read(track(source+'.meta')),key='street-fire-'+name,dest=path.join(dir,name+'.png');
  if(num(meta,'filterMode')!==1||num(meta,'wrapU')!==0||num(meta,'wrapV')!==0||num(meta,'enableMipMap')!==0)throw Error('Review fire texture sampler');
  if(/\.png$/i.test(source))fs.copyFileSync(source,dest);else{
   // Lossless TGA -> browser PNG, preserving every native RGB sample.
   const b=fs.readFileSync(source),w=b.readUInt16LE(12),h=b.readUInt16LE(14),bytes=b[16]/8;if(b[2]!==2||bytes!==3||b[1])throw Error('Unsupported TGA layout');const rgb=Buffer.alloc(w*h*3),start=18+b[0];
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=start+((b[17]&32?y:h-1-y)*w+x)*3,dst=(y*w+x)*3;rgb[dst]=b[src+2];rgb[dst+1]=b[src+1];rgb[dst+2]=b[src];}await sharp(rgb,{raw:{width:w,height:h,channels:3}}).png().toFile(dest);
  }
  const m=await sharp(dest).metadata();assets[key]={src:'assets/outside/effects/fire/'+name+'.png',w:m.width,h:m.height,source:path.relative(engine,source),sha256:hash(dest)};textures[name]={asset:key,sRGB:!!num(meta,'sRGBTexture'),filter:'bilinear',wrap:'repeat'};
 }
 const squareMeta=fs.readdirSync(path.join(engine,'Library/PackageCache'),{recursive:true}).find(p=>p.endsWith('DefaultAssets/Textures/v2/Square.png.meta'));if(!squareMeta)throw Error('Unity built-in Square metadata required');const square=read(track(path.join(engine,'Library/PackageCache',squareMeta)));if(num(square,'spritePixelsToUnits')!==256)throw Error('Review Square PPU');
 const fire={...world('419967016'),sortingLayer:num(fireText,'m_SortingLayerID'),order:num(fireText,'m_SortingOrder'),spriteWorldSize:1};
 const data={version:1,sources,assets,back,front,fire,props,constants,textures,colors:{base:vec(material,'- _Color'),hot:vec(material,'- _Color_1')}};
 fs.writeFileSync(path.join(game,'data/presentation/barrel-fire.js'),'/* Generated by tools/import-barrel-fire.cjs; engine source remains read-only. */\n(function(W){W.LUNA_BARREL_FIRE='+JSON.stringify(data,null,2)+';})(typeof window===\'undefined\'?globalThis:window);\n');
 console.log('BARREL_FIRE_IMPORTED',JSON.stringify({back,front,fire,props,constants,assets:Object.keys(assets)}));
})().catch(e=>{console.error(e);process.exitCode=1;});

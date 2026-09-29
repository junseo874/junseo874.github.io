// Read-only Unity scene importer; writes only the web simulator's own assets/manifest.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const engine='/Users/lee/Desktop/project/Human-Bartender/HumanBartender';
const dest='/Users/lee/Desktop/project/junseo874.github.io/bar-playtest';
const read=p=>fs.readFileSync(path.join(engine,p),'utf8');
const guids=new Map();
function scan(dir){for(const e of fs.readdirSync(path.join(engine,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(!['Plugins','Hierarchy Designer','TextMesh Pro'].includes(e.name))scan(p);}else if(e.name.endsWith('.meta')){const m=read(p).match(/^guid: (\w+)/m);if(m)guids.set(m[1],p.slice(0,-5));}}}scan('Assets');
const num=(t,key,def=0)=>Number(t.match(new RegExp('^\\s*'+key+': ([^\\n]+)','m'))?.[1]??def);
const vec=(t,key,def={x:0,y:0,z:0})=>{const s=t.match(new RegExp('^\\s*'+key+': \\{([^}]+)','m'))?.[1];return s?Object.fromEntries(s.split(',').map(p=>p.trim().split(': ').map((v,i)=>i?Number(v):v))):def;};
const ref=(t,key)=>t.match(new RegExp('^\\s*'+key+': \\{fileID: (-?\\d+)','m'))?.[1];
const metaCache=new Map(), assets={};
function texture(guid){if(metaCache.has(guid))return metaCache.get(guid);const p=guids.get(guid);if(!p||!p.endsWith('.png'))return null;const b=fs.readFileSync(path.join(engine,p)),m=read(p+'.meta'),w=b.readUInt32BE(16),h=b.readUInt32BE(20),id=crypto.createHash('sha256').update(b).digest('hex').slice(0,14),file='outside_'+id+'.png';
fs.mkdirSync(dest+'/assets/outside',{recursive:true});if(!fs.existsSync(dest+'/assets/outside/'+file))fs.copyFileSync(path.join(engine,p),dest+'/assets/outside/'+file);
const item={src:'assets/outside/'+file,w,h,source:p,ppu:num(m,'spritePixelsToUnits',100),sprites:{}};
function pivot(t,key='pivot'){const a=num(t,'alignment',0),v=vec(t,key,{x:.5,y:.5});return a===9?v:({0:{x:.5,y:.5},1:{x:0,y:1},2:{x:.5,y:1},3:{x:1,y:1},4:{x:0,y:.5},5:{x:1,y:.5},6:{x:0,y:0},7:{x:.5,y:0},8:{x:1,y:0}}[a]||v);}
item.sprites['21300000']={x:0,y:0,w,h,pivot:pivot(m,'spritePivot')};
const sprites=m.split('  spriteSheet:')[1]?.split('    outline:')[0]||'';
// Parse only importer sprite records, before their internal outline data.
for(const s of m.split(/(?=^    - serializedVersion:)/m)){if(!/^    - serializedVersion:/m.test(s)||!/^      name:/m.test(s))continue;const sid=s.match(/^      internalID: (-?\d+)/m)?.[1];if(!sid)continue;const x=num(s,'x'),y=num(s,'y'),sw=num(s,'width'),sh=num(s,'height');if(sw>0&&sh>0)item.sprites[sid]={x,y:h-y-sh,w:sw,h:sh,pivot:pivot(s),name:s.match(/^      name: (.*)/m)?.[1]};}
assets[id]={src:item.src,w,h,source:p};item.id=id;metaCache.set(guid,item);return item;}
function sprite(t){const m=t.match(/m_Sprite: \{fileID: (-?\d+), guid: (\w+)/);if(!m)return null;return spriteRef(m[2],m[1]);}
function spriteRef(guid,fid){const tx=texture(guid);if(!tx)return null;const s=tx.sprites[fid];if(!s)throw Error('Missing sprite '+guids.get(guid)+' '+fid);return{asset:tx.id,...s,ppu:tx.ppu};}
function scene(name){const blocks=read('Assets/00.Scenes/'+name+'.unity').split(/(?=^--- !u!)/m),all=new Map(),objects=new Map(),transforms=new Map();for(const b of blocks){const m=b.match(/^--- !u!(\d+) &(\d+)/);if(!m)continue;all.set(m[2],{type:m[1],text:b});if(m[1]==='1')objects.set(m[2],{name:b.match(/  m_Name: (.*)/)?.[1],active:num(b,'m_IsActive',1)});if(m[1]==='4'){const go=ref(b,'m_GameObject'),v={id:m[2],go,parent:ref(b,'m_Father'),p:vec(b,'m_LocalPosition'),s:vec(b,'m_LocalScale',{x:1,y:1,z:1}),r:vec(b,'m_LocalRotation',{x:0,y:0,z:0,w:1})};transforms.set(m[2],v);if(objects.has(go))objects.get(go).transform=v;}}
function world(t){if(t.world)return t.world;const par=transforms.get(t.parent),p=par?world(par):{x:0,y:0,z:0,sx:1,sy:1,active:true,ancestry:[]};return t.world={x:p.x+t.p.x*p.sx,y:p.y+t.p.y*p.sy,z:p.z+t.p.z,sx:p.sx*t.s.x,sy:p.sy*t.s.y,active:p.active&&objects.get(t.go)?.active!==0,ancestry:[...p.ancestry,objects.get(t.go)?.name]};}
const nodes=[],spots={},colliders=[],components=[];for(const [id,{type,text:t}]of all){const go=ref(t,'m_GameObject'),o=objects.get(go),tr=o?.transform;if(!tr)continue;const w=world(tr);if(type==='212'){const sp=sprite(t);if(!sp)continue;nodes.push({id,go,name:o.name,...w,sprite:sp,layer:num(t,'m_SortingLayer'),order:num(t,'m_SortingOrder'),flip:!!num(t,'m_FlipX'),color:vec(t,'m_Color',{r:1,g:1,b:1,a:1})});}if(type==='61')colliders.push({name:o.name,...w,offset:vec(t,'m_Offset'),size:vec(t,'m_Size'),trigger:!!num(t,'m_IsTrigger')});if(type==='114'){const spot=t.match(/  SpotID: (.*)/)?.[1];if(spot)spots[spot]={...w};const source=t.match(/  souceid: (.*)/)?.[1];if(source)components.push({id,source,name:o.name,...w});}}
const named={};for(const [id,o]of objects)if(o.transform&&/Spawn|Point|Luna|Sofa|Door|Entrance|Floor|Wall|Bounds/.test(o.name))named[o.name]={...world(o.transform)};
return{nodes,spots,colliders,components,named};}
const scenes={street:scene('OutSide'),home:scene('Home')},animations={};
for(const kind of ['Idle','Walk','Run']){const t=read('Assets/02.Animations/CH/Luna_'+kind+'.anim'),curve=t.split('    attribute:')[0];animations[kind.toLowerCase()]={fps:num(t,'m_SampleRate',12),duration:num(t,'m_StopTime'),frames:[...curve.matchAll(/value: \{fileID: (-?\d+), guid: (\w+)/g)].map(m=>spriteRef(m[2],m[1]))};}
const shibaPath='Assets/01.Sprites/Ch/Shiba/shi_Bar-Sheet.png',shibaGuid=read(shibaPath+'.meta').match(/^guid: (\w+)/m)[1],shiba=texture(shibaGuid);
animations.shiba={fps:6,frames:Object.entries(shiba.sprites).filter(([id,s])=>s.name).sort((a,b)=>Number(a[1].name.split('_').pop())-Number(b[1].name.split('_').pop())).map(([id])=>spriteRef(shibaGuid,id))};
const manifest={version:1,scenes,animations,assets};
function patchFile(p,txt){const exists=fs.existsSync(p),old=exists?fs.readFileSync(p,'utf8'):'';const patch='*** Begin Patch\n'+(exists?'*** Update File: '+p+'\n@@\n'+old.split('\n').map(l=>'-'+l).join('\n'):'*** Add File: '+p)+'\n'+txt.split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch\n';const r=cp.spawnSync('apply_patch',[],{input:patch,encoding:'utf8',maxBuffer:16000000});if(r.status)throw Error(r.stdout+r.stderr);}
patchFile(dest+'/outside-data.js','// Generated from Unity OutSide/Home scenes. Rebuild with tools/import_outside.cjs.\nwindow.LUNA_OUTSIDE_DATA='+JSON.stringify(manifest)+';\n');
patchFile(dest+'/tools/import_outside.cjs',fs.readFileSync(__filename,'utf8'));
console.log(JSON.stringify({assets:Object.keys(assets).length,scenes:Object.fromEntries(Object.entries(scenes).map(([k,v])=>[k,{nodes:v.nodes.filter(n=>n.active).map(n=>({name:n.name,x:n.x,y:n.y,sx:n.sx,sy:n.sy,layer:n.layer,order:n.order,w:n.sprite.w/n.sprite.ppu,h:n.sprite.h/n.sprite.ppu,pivot:n.sprite.pivot})),spots:v.spots,named:v.named}]))},null,2));

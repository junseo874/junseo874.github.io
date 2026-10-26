// Narrow read-only snapshot of the engine's player shadow, emitters and receivers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const engine=process.argv.find(a=>a.startsWith('--engine='))?.slice(9)||'/Users/lee/Desktop/project/Human-Bartender/HumanBartender';
const sceneFile='Assets/01.Game/01.Scenes/OutSide.unity',read=f=>fs.readFileSync(path.join(engine,f),'utf8');
const scene=read(sceneFile),blocks=new Map([...scene.matchAll(/^--- !u!(\d+) &(\d+)[^\n]*\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)].map(m=>[m[2],{type:+m[1],text:m[3]}]));
const val=(t,k)=>t.match(new RegExp('^  '+k+': (.*)$','m'))?.[1],num=(t,k)=>Number(val(t,k));
const ref=s=>s?.match(/fileID: (\d+)/)?.[1],vec=(t,k)=>Object.fromEntries([...String(val(t,k)).matchAll(/(\w+): ([\d.e+-]+)/g)].map(m=>[m[1],+m[2]]));
const transforms=new Map([...blocks].filter(([,b])=>b.type===4)),byGo=new Map([...transforms].map(([id,b])=>[ref(val(b.text,'m_GameObject')),id]));
const go=t=>blocks.get(ref(val(t,'m_GameObject')))?.text,name=t=>val(go(t),'m_Name');
function world(id){
 if(!id||id==='0')return {x:0,y:0,sx:1,sy:1,ancestry:[],active:true};
 const t=transforms.get(id)?.text;if(!t||!val(t,'m_LocalPosition'))throw Error('Unresolved transform '+id);
 const p=vec(t,'m_LocalPosition'),s=vec(t,'m_LocalScale'),q=vec(t,'m_LocalRotation');if(q.z!==0)throw Error('Review rotated receiver/light '+name(t));
 const w=world(ref(val(t,'m_Father')));return {x:w.x+p.x*w.sx,y:w.y+p.y*w.sy,sx:w.sx*s.x,sy:w.sy*s.y,ancestry:[...w.ancestry,name(t)],active:w.active&&num(go(t),'m_IsActive')===1};
}
const location=t=>world(byGo.get(ref(val(t,'m_GameObject')))),lights=[];
const snapshot=require('node:vm').runInNewContext(readWeb(),{});
function readWeb(){return fs.readFileSync(path.resolve(__dirname,'../data/presentation/character-shadows.js'),'utf8')+';LUNA_CHARACTER_SHADOWS;';}
const player=snapshot.player;lights.push(...snapshot.lights);
// Audit every Light2D. Existing shadow anchors cast; other player/ground
// freeform volumes supply local fill, and the global light is ambient only.
const illumination=[],globals=[],inventory=[],casters=[];
for(const [id,b]of blocks){const t=b.text;if(!val(t,'m_LightType'))continue;
 const packed=val(t,'m_ApplyToSortingLayers'),layers=[];for(let i=0;i<packed.length;i+=8)layers.push(Buffer.from(packed.slice(i,i+8),'hex').readInt32LE());
 const type=num(t,'m_LightType'),entry={id,name:name(t),type,affectsPlayer:layers.includes(player.sortingLayer),role:lights.some(l=>l.id===id)?'caster':type===4?'ambient':type===1&&layers.includes(player.sortingLayer)?'fill':'cookie/background'};inventory.push(entry);
 if(!entry.affectsPlayer||type!==1&&type!==4)continue;
 const w=location(t),l={id,name:name(t),active:w.active&&num(t,'m_Enabled')===1,ancestry:w.ancestry,intensity:num(t,'m_Intensity'),color:Object.values(vec(t,'m_Color')).slice(0,3)};
 if(type===4){globals.push(l);continue;}
 l.falloff=num(t,'m_ShapeLightFalloffSize');l.points=[...t.split('m_ShapePath:')[1].matchAll(/- \{x: ([\d.e+-]+), y: ([\d.e+-]+)/g)].map(m=>[w.x+(+m[1])*w.sx,w.y+(+m[2])*w.sy]);
 if(entry.role==='caster'){const top=[...l.points].sort((a,b)=>b[1]-a[1]).slice(0,2);casters.push({...l,x:(top[0][0]+top[1][0])/2,y:(top[0][1]+top[1][1])/2});}else illumination.push(l);
}
const data={source:{file:sceneFile,sha256:crypto.createHash('sha256').update(scene).digest('hex')},casters,illumination,globals,inventory};
const output='/* Current engine Light2D inventory; projected-foot settings remain in character-shadows.js. */\n(function(W){W.LUNA_SHADOW_LIGHTING='+JSON.stringify(data,null,2)+';})(typeof window===\'undefined\'?globalThis:window);\n';
const target=path.resolve(__dirname,'../data/presentation/shadow-lighting.js');
if(process.argv.includes('--write'))fs.writeFileSync(target,output);else if(fs.readFileSync(target,'utf8')!==output)throw Error('Shadow lighting snapshot differs from engine');
console.log('SHADOW_LIGHTING_SNAPSHOT_OK',inventory.length,'lights;',casters.length,'casters;',illumination.length,'fill volumes;',globals.length,'ambient');

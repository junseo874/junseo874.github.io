// Read-only inventory. Do not run the legacy importer to inspect current scenes.
const fs=require('node:fs');
const scene='/Users/lee/Desktop/project/Human-Bartender/HumanBartender/Assets/01.Game/01.Scenes/OutSide.unity';
function parse(file=scene){
 const source=fs.readFileSync(file,'utf8'),blocks=[...source.matchAll(/^--- !u!(\d+) &(-?\d+)[^\n]*\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)].map(m=>({type:+m[1],id:m[2],text:m[3]}));
 const value=(t,k,d='')=>t.match(new RegExp('^  '+k+': (.*)$','m'))?.[1]??d;
 const vector=(t,k,d={x:0,y:0,z:0})=>{const s=value(t,k);return s?Object.fromEntries([...s.matchAll(/(\w+): ([\d.e+-]+)/g)].map(m=>[m[1],+m[2]])):d;};
 const ref=(t,k)=>value(t,k).match(/fileID: (-?\d+)/)?.[1];
 const objects=new Map(blocks.filter(b=>b.type===1).map(b=>[b.id,{name:value(b.text,'m_Name'),active:value(b.text,'m_IsActive')==='1'}]));
 const transforms=new Map(blocks.filter(b=>b.type===4).map(b=>[b.id,{id:b.id,go:ref(b.text,'m_GameObject'),parent:ref(b.text,'m_Father'),p:vector(b.text,'m_LocalPosition'),s:vector(b.text,'m_LocalScale',{x:1,y:1}),q:vector(b.text,'m_LocalRotation',{z:0,w:1})}]));
 const byGo=new Map([...transforms.values()].map(t=>[t.go,t]));
 function world(t){if(t.world)return t.world;const p=transforms.get(t.parent),w=p?world(p):{x:0,y:0,a:1,b:0,c:0,d:1,active:true,path:[]},angle=2*Math.atan2(t.q.z,t.q.w),c=Math.cos(angle),s=Math.sin(angle),a=c*t.s.x,b=s*t.s.x,cc=-s*t.s.y,d=c*t.s.y,o=objects.get(t.go);return t.world={x:w.x+w.a*t.p.x+w.c*t.p.y,y:w.y+w.b*t.p.x+w.d*t.p.y,a:w.a*a+w.c*b,b:w.b*a+w.d*b,c:w.a*cc+w.c*d,d:w.b*cc+w.d*d,active:w.active&&o.active,path:[...w.path,o.name]};}
 const layers=hex=>hex?.match(/.{8}/g)?.map(s=>Buffer.from(s,'hex').readUInt32LE())||[];
 const lights=blocks.filter(b=>/^  m_LightType:/m.test(b.text)).map(b=>{const t=b.text,go=ref(t,'m_GameObject'),tr=byGo.get(go),w=world(tr),points=[...(t.split('  m_ShapePath:')[1]||'').matchAll(/- \{x: ([\d.e+-]+), y: ([\d.e+-]+)/g)].map(m=>[w.x+w.a*+m[1]+w.c*+m[2],w.y+w.b*+m[1]+w.d*+m[2]]);return {id:b.id,name:objects.get(go).name,active:w.active&&value(t,'m_Enabled')==='1',type:+value(t,'m_LightType'),blend:+value(t,'m_BlendStyleIndex'),color:vector(t,'m_Color'),intensity:+value(t,'m_Intensity'),falloff:+value(t,'m_ShapeLightFalloffSize'),layers:layers(value(t,'m_ApplyToSortingLayers')),cookie:value(t,'m_LightCookieSprite'),world:w,points};});
 const sprites=blocks.filter(b=>b.type===212).map(b=>{const t=b.text,go=ref(t,'m_GameObject'),tr=byGo.get(go);return {id:b.id,name:objects.get(go).name,...world(tr),layer:+value(t,'m_SortingLayerID'),order:+value(t,'m_SortingOrder'),sprite:value(t,'m_Sprite'),material:t.match(/m_Materials:\s*\n\s*- (.*)/)?.[1]};});
 return {lights,sprites};
}
module.exports={parse,scene};
if(require.main===module){const a=parse();console.log(JSON.stringify({counts:{total:a.lights.length,active:a.lights.filter(l=>l.active).length},lights:a.lights.map(l=>({...l,world:{x:l.world.x,y:l.world.y,path:l.world.path},points:l.points.map(([x,y])=>[+x.toFixed(4),+y.toFixed(4)])})),sprites:a.sprites.filter(s=>s.active&&/Building|Floor|Fence|Object|City.*Light/.test(s.name))},null,2));}

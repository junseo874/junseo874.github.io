"""Import isolated Unity ExportGrade.Run output; original engine stays read-only."""
import json,re,shutil,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];ENGINE=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent.parent/'Human-Bartender/HumanBartender'
SRC=ENGINE/'Assets/01.Game/03.Content/03.Vfx';OUT=ROOT/'assets/01.ArtResources/05.UI/03.Crafting/03.Offer/Engine';OUT.mkdir(parents=True,exist_ok=True)
data=json.load(open('/tmp/grade-engine-samples.json'))
def copy_asset(path):
 p=ENGINE/path;o=OUT/p.name;shutil.copy2(p,o);return str(o.relative_to(ROOT))
def glsl(file):
 s=(SRC/'03.Shaders'/file).read_text();uniform=re.search(r'CBUFFER_START\(UnityPerMaterial\)(.*?)CBUFFER_END',s,re.S)[1]
 uniform=re.sub(r'\b(?:half|float)([234]?)\s+(\w+);',lambda m:'uniform '+('vec'+m[1] if m[1] else 'float')+' '+m[2]+';',uniform)
 body=s[s.index('            float3 PrismTint'):s.index('            ENDHLSL')]
 for pattern in [r'struct Attributes\s*\{.*?\};',r'struct Varyings\s*\{.*?\};']:body=re.sub(pattern,'',body,flags=re.S)
 start=body.index('            Varyings vert');end=body.index('\n            }',start)+len('\n            }');body=body[:start]+body[end:]
 body=body.replace('half4 frag(Varyings input) : SV_Target','vec4 shade()').replace('float4 frag(Varyings input) : SV_Target','vec4 shade()')
 body=re.sub(r'\b(?:float|half)([234])\b',r'vec\1',body);body=re.sub(r'\bhalf\b','float',body)
 for a,b in [('input.uv','vUV'),('input.positionWS','vWS'),('input.color','particleColor'),('ddx(','dFdx('),('ddy(','dFdy('),('lerp(','mix('),('frac(','fract('),('atan2(','atan('),('[unroll]','')]:body=body.replace(a,b)
 body=body.replace('const vec3 keys[4] =\n                {','vec3 keys[4] = vec3[4](').replace('                };','                );')
 body=re.sub(r'\(int\)round\(([^)]+)\)',r'int(round(\1))',body);body=body.replace('(int)floor(x)','int(floor(x))').replace('(float)j','float(j)')
 body=body.replace('SAMPLE_TEXTURE2D_LOD(_MainTex, sampler_MainTex, uv * _MainTex_ST.xy + _MainTex_ST.zw, 0)','texture(tex, uv * _MainTex_ST.xy + _MainTex_ST.zw)')
 body=body.replace('(vec3)PrismTint','PrismTint')
 body=body.replace('clip(t);','if(t<0.0)discard;').replace('clip(3.05 - t);','if(t>3.05)discard;')
 return '#version 300 es\nprecision highp float;\nin vec2 vUV;in vec2 vWS;uniform vec4 particleColor;uniform sampler2D tex;out vec4 outColor;\n#define PI 3.141592653589793\nfloat saturate(float x){return clamp(x,0.0,1.0);}\nvec2 saturate(vec2 x){return clamp(x,0.0,1.0);}\n'+uniform+'\n'+body+'\nvoid main(){outColor=shade();}\n'
data['shaders']={n:glsl(n+'.shader')for n in ['SH_GradeReveal','SH_GradeRevealGlow','SH_GradeWave']}
for g in data['grades']:
 g['image']=copy_asset(g['image']);g['frames']=[dict(t=round(f['t'],6),text=[round(v,7)for v in f['text']],particles=[round(v,6)for v in f['particles']])for f in g['frames']]
 for l in g['layers']:
  if l['texture']:l['texture']=copy_asset(l['texture'])
  l['properties']=dict(zip(l.pop('keys'),l.pop('values')))
  # HDR material colors are already linear; particle vertex colors are converted by the renderer.
 data.setdefault('sourceHashes',{})[g['prefab']]=hashlib.sha256((ENGINE/g['prefab']).read_bytes()).hexdigest()
base=ENGINE/'Assets/01.Game/03.Content/08.Prefabs/05.Vfx/FX_GradeReveal_Excellent.prefab'
data['sourceHashes'][str(base.relative_to(ENGINE))]=hashlib.sha256(base.read_bytes()).hexdigest()
for p in list((SRC/'03.Shaders').glob('*Grade*.shader'))+list((ENGINE/'Assets/01.Game/02.Scripts/05.Presentation/04.Vfx').glob('Grade*Sequence.cs')):
 data['sourceHashes'][str(p.relative_to(ENGINE))]=hashlib.sha256(p.read_bytes()).hexdigest()
ambient=json.load(open('/tmp/grade-engine-ambient.json'))
for ag in ambient['grades']:
 g=next(g for g in data['grades'] if g['id']==ag['id'])
 moving={i for i,l in enumerate(g['layers']) if l['name'] in ['FX_GradeReveal_Twinkle','FX_GradeReveal_Float']}
 def pick(frame,first,last):
  p=frame['particles'];out=[]
  for i in range(0,len(p),13):
   a=p[i:i+13]
   if int(a[0]) in moving and first-1e-4<=a[12]<last-1e-4:out.extend(round(v,6) for v in a[:12])
  return out
 g['ambientEmitters']=ag['layers']
 g['ambient']={'start':3.4,'emissionStart':4,'period':10,'head':[pick(ag['frames'][f],-100,4) for f in range(204,330)],
  'loop':[{'particles':pick(ag['frames'][240+f],4,14),'tail':pick(ag['frames'][840+f],4,14) if f<120 else []}for f in range(600)],
  'glowPeriod':ag['glowPeriod'],'glow':[[round(v,6)for v in f['particles']]for f in ag['glow']]}
 # A fixed conservative upper-screen framebuffer keeps persistent light cheap.
 import math
 low=0
 for f in g['frames']:
  a=f['particles']
  for n in range(0,len(a),12):
   theta=a[n+6]*math.pi/180;radius=(abs(math.sin(theta))*a[n+4]+abs(math.cos(theta))*a[n+5])/2
   low=min(low,a[n+2]-radius)
 g['minWorldY']=min(low,-1.1)
data['textOrder']=20;data['readable']=.42
(ROOT/'data/runtime/serve-grade-reveal.js').write_text('// Generated from Unity 6000.3.14f1: five resolved GradeColorSet prefabs.\nwindow.LUNA_SERVE_GRADE_REVEAL='+json.dumps(data,separators=(',',':'))+';\n')
(ROOT/'data/presentation/grade-reveal-analysis.json').write_text(json.dumps({k:v for k,v in data.items() if k not in ['shaders','grades']}|{'grades':[{k:v for k,v in g.items()if k not in ['frames','ambient']}for g in data['grades']]},ensure_ascii=False,indent=2)+'\n')
p=ROOT/'data/presentation/engine-art-sync.json';m=json.loads(p.read_text())
for asset in OUT.glob('*'):
 rel=str(asset.relative_to(ROOT/'assets/01.ArtResources'));m['records']=[r for r in m['records']if r['path']!=rel];m['records'].append({'path':rel,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'kind':'new','from':rel})
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Unity grade import:',len(data['grades']),'grades',len(list(OUT.glob('*'))),'original textures')

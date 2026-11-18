from pathlib import Path
import re,shutil,json,sys
src=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[3]/'Human-Bartender/HumanBartender';dst=Path('/tmp/luna-grade-engine-export');(dst/'Assets/Editor').mkdir(parents=True,exist_ok=True);(dst/'Packages').mkdir(exist_ok=True);(dst/'ProjectSettings').mkdir(exist_ok=True)
index={}
for p in (src/'Assets').rglob('*.meta'):
 m=re.search(r'^guid: (\w+)',p.read_text(errors='ignore'),re.M)
 if m:index[m[1]]=p.with_suffix('')
queue=list((src/'Assets/01.Game/03.Content/08.Prefabs/05.Vfx/02.GradeColorSet').glob('*.prefab'));seen=set()
while queue:
 p=queue.pop()
 if p in seen or not p.is_file():continue
 seen.add(p);o=dst/p.relative_to(src);o.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,o)
 meta=p.with_name(p.name+'.meta')
 if meta.exists():shutil.copy2(meta,o.with_name(o.name+'.meta'))
 if p.suffix in ['.prefab','.mat','.asset','.controller','.anim']:
  queue.extend(index[g] for g in re.findall(r'guid: (\w+)',p.read_text(errors='ignore')) if g in index)
mods=['animation','imageconversion','imgui','jsonserialize','particlesystem','physics','physics2d','ui','uielements','audio']
json.dump({'dependencies':dict({'com.unity.ugui':'2.0.0','com.unity.render-pipelines.universal':'17.3.0'},**{'com.unity.modules.'+m:'1.0.0' for m in mods})},open(dst/'Packages/manifest.json','w'))
for n in ['ProjectVersion.txt','TagManager.asset','ProjectSettings.asset']:shutil.copy2(src/'ProjectSettings'/n,dst/'ProjectSettings'/n)
print(dst,len(seen))

for filename,dest in [('export-engine-grade.cs','ExportGrade.cs'),('export-engine-grade-ambient.cs','ExportGradeAmbient.cs'),('capture-engine-grade.cs','CaptureGrade.cs')]:shutil.copy2(Path(__file__).with_name(filename),dst/'Assets/Editor'/dest)

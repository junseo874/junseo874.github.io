from pathlib import Path
import zipfile
p=Path(__file__).resolve().parents[1]
target=p.parent/'LUNA-Bar-Playtest.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
 for f in sorted(p.rglob('*')):
  if f.is_file() and f.name!='.DS_Store' and '__pycache__' not in f.parts:
   archive.write(f,Path('LUNA-Bar-Playtest')/f.relative_to(p))
print(target)
print(target.stat().st_size)

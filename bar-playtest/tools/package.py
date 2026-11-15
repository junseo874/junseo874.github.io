"""Package the static site with the Studio/shared assets its game imports."""
from pathlib import Path
import argparse
import os
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true', help='List packaging totals without writing an archive')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
target = root / 'archives' / 'luna-web.zip'
excluded = {'.git', 'node_modules', '__pycache__', 'tests', 'tools', 'docs', 'artifacts', 'archives'}
skip_files = {'.DS_Store', '.rgignore', '.gitignore', '.gitattributes', 'AGENTS.md'}
files = []
for folder, directories, names in os.walk(root):
    # QA captures, Git objects and dialogue backups are not distributable;
    # don't traverse them only to drop every file afterwards.
    directories[:] = [d for d in directories if d not in excluded]
    files.extend(Path(folder) / name for name in names
                 if name not in excluded and name not in skip_files and (Path(folder) / name).is_file())
files.sort()
if not args.check:
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for f in files:
            archive.write(f, Path('LUNA-Web') / f.relative_to(root))
    print(target)
print(f'{len(files)} files; includes bar-playtest, cutscene-studio and shared site assets')

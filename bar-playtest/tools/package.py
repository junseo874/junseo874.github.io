"""Package the static site with the Studio/shared assets its game imports."""
from pathlib import Path
import argparse
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true', help='List packaging totals without writing an archive')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
target = root / 'archives' / 'luna-web.zip'
excluded = {'.git', 'node_modules', '__pycache__', 'tests', 'tools', 'docs', 'artifacts', 'archives'}
files = [f for f in sorted(root.rglob('*')) if f.is_file()
         and not any(part in excluded for part in f.relative_to(root).parts)
         and f.name not in {'.DS_Store', '.rgignore', '.gitignore', '.gitattributes', 'AGENTS.md'}]
if not args.check:
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for f in files:
            archive.write(f, Path('LUNA-Web') / f.relative_to(root))
    print(target)
print(f'{len(files)} files; includes bar-playtest, cutscene-studio and shared site assets')

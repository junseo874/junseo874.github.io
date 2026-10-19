"""Canonical asset destinations for importers; preserves registered IDs and originals."""
from pathlib import Path
import json
import re

APP = Path(__file__).resolve().parents[1]
MIGRATIONS = json.loads((APP.parent / 'docs/architecture/path-migrations.json').read_text())['files']


def destination(key, legacy_name):
    """Return an application-relative URL, reusing an existing relocation if known."""
    previous = 'bar-playtest/assets/' + legacy_name
    if previous in MIGRATIONS:
        return MIGRATIONS[previous].removeprefix('bar-playtest/')
    if key.startswith('char_'):
        group = 'characters/' + key.split('_')[1]
    elif key.startswith('guest_'):
        group = 'characters/guests'
    elif key.startswith('expr_'):
        group = 'characters/expressions'
    elif key.startswith(('item_', 'recipe_item_', 'inventory_item_')):
        group = 'items'
    elif 'cocktail' in key:
        group = 'cocktails/static'
    elif key.startswith(('bar', 'prep_', 'gimmick')):
        group = 'backgrounds/bar'
    elif key == 'font':
        group = 'fonts'
    else:
        group = 'ui/imported'
    slug = re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-')
    return 'assets/' + group + '/' + slug + Path(legacy_name).suffix


def output_path(key, legacy_name):
    url = destination(key, legacy_name)
    target = APP / url
    target.parent.mkdir(parents=True, exist_ok=True)
    return url, target

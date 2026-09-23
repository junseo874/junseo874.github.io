"""Graphics-only refresh. Never reads/reimports CSV or modifies source artwork."""
from pathlib import Path
import json, hashlib, shutil, unicodedata, csv, re
from PIL import Image

APP = Path(__file__).resolve().parents[1]
PROJECT = Path('/Users/lee/Desktop/project')
ART = next(p for p in PROJECT.iterdir() if unicodedata.normalize('NFC', p.name).startswith('9. 그래픽'))
paths = {unicodedata.normalize('NFC', str(p.relative_to(ART))): p for p in ART.rglob('*.png')}
data_file = APP/'data.js'
d = json.loads(data_file.read_text()[len('window.LUNA_DATA = '):].strip().rstrip(';'))
tables_before = json.dumps(d['tables'], sort_keys=True)
inventory = json.loads((APP/'source-inventory.json').read_text())

def add(key, rel, frames=1):
    if rel not in paths:
        return None
    p = paths[rel]
    dest = 'a_'+hashlib.sha256(rel.encode()).hexdigest()[:12]+'.png'
    shutil.copy2(p, APP/'assets'/dest)
    with Image.open(p) as im:
        w, h = im.size
    assert w % frames == 0, rel
    d['assets'][key] = {'src': 'assets/'+dest, 'w': w, 'h': h, 'frames': frames,
                        'frameWidth': w//frames, 'frameHeight': h, 'fps': 12, 'source': rel}
    inventory['graphics']['assets/'+dest] = rel
    return key

# Existing regular sheets use shared, uncropped frame canvases. Unity talk clips: 12 FPS.
for key, info in d['assets'].items():
    if 'frames' in info:
        info.update(frameWidth=info['w']//info['frames'], frameHeight=info['h'], fps=12)

# The source "talk" folder includes shared eye loops, active even during idle.
# Its body is a headless static strip; the view keeps the complete base body.
# Only mouths are speech-gated. Missing parts stay static
# independently, preserving identity without freezing the other available loops.
for gender, folder in [('m', '남'), ('f', '여')]:
    prefix = f'4. 캐릭터 (내부)/NPC/{folder}/talk/'
    add('guest_'+gender+'_talk_body', prefix+('bady.png' if gender=='m' else 'body.png'), 4)
    for n in range(1, 4):
        add(f'guest_{gender}_talk_eyes_{n}', prefix+('eyes_' if gender=='m' else 'face_top_')+str(n)+'.png', 4)
        add(f'guest_{gender}_talk_mouth_{n}', prefix+f'face_bottom_{n}.png', 4)

# Bubi's lower-face filename has no speech suffix, unlike other actors.
for speech in ['default', 'talk']:
    key = add('char_bubi_idle_'+speech+'_face_bottom',
              f'4. 캐릭터 (내부)/부비/idle/{speech}/face_bottom.png', 8)
    if key:
        layers = d['characterLayers']['bubi']['idle_'+speech]
        if key not in layers:
            layers.append(key)

# Full-frame expression images can replace a layered pose without changing the anchor.
for rel in sorted(paths):
    if rel.startswith('4. 캐릭터 (내부)/크리스/') and Path(rel).stem in ['enger', 'fun']:
        state = 'anger' if Path(rel).stem == 'enger' else 'joy'
        key = add('char_chris_'+state+'_full', rel)
        if key:
            for speech in ['default', 'talk']:
                d['characterLayers']['chris'][state+'_'+speech] = [key]

# Use the engine's actual address -> GUID -> texture links for named expressions.
# This prevents guessing that a similarly named illustration is the right pose.
engine = PROJECT/'Human-Bartender/HumanBartender/Assets'
expressions = list(csv.DictReader((engine/'StreamingAssets/csv/characters/expressions.csv').open(encoding='utf-8-sig')))
expressions = [r for r in expressions if r['dataset_id']=='character_anim' and r['mode']=='sprite'
               and r['context'] in d['characterLayers']]
addresses = {}
for group in (engine/'AddressableAssetsData/AssetGroups').glob('*.asset'):
    for guid, address in re.findall(r'- m_GUID: (\w+)\s+m_Address: ([^\n]+)', group.read_text()):
        addresses[address.strip()] = guid
wanted = {addresses.get(r['sprite']) for r in expressions}
textures = {}
for meta in engine.rglob('*.png.meta'):
    guid = re.search(r'^guid: (\w+)', meta.read_text(), re.M)
    if guid and guid[1] in wanted:
        textures[guid[1]] = meta.with_suffix('')
for row in expressions:
    path = textures.get(addresses.get(row['sprite']))
    if not path:
        continue
    with Image.open(path) as im:
        w, h = im.size
    # Multi-sprite sheets need an explicit atlas reference; never show an entire strip.
    if w/h > 2:
        continue
    source_override = {
        'chris_success': '4. 캐릭터 (내부)/크리스/fun.png',
        'chris_fail': '4. 캐릭터 (내부)/크리스/enger.png',
        'aili_success': '4. 캐릭터 (내부)/아일리/drink/success.png',
        'aili_fail': '4. 캐릭터 (내부)/아일리/drink/fail.png',
    }.get(row['sprite'])
    src_rel = source_override or 'engine/'+str(path.relative_to(engine))
    if not source_override:
        paths[src_rel] = path
    key = add('expr_'+row['context']+'_'+row['expression'], src_rel)
    for speech in ['default', 'talk']:
        d['characterLayers'][row['context']][row['expression']+'_'+speech] = [key]

# Samho's drink body already contains the upper head. Adding idle head parts doubles it.
drink = [add('char_samho_drink_'+part, '4. 캐릭터 (내부)/삼호/drink/'+part+'.png', 4)
         for part in ['body', 'face_bottom']]
if all(drink):
    d['characterLayers']['samho']['drink_default'] = drink

# Fixed per-pose alignment for the older cropped Port serious sheets. Use the union
# of ALL frames, not a per-frame crop (which would cause animation jitter).
def pose_bbox(keys):
    merged = Image.new('RGBA', (551, 530))
    for key in keys:
        s = d['assets'][key]
        im = Image.open(APP/s['src']).convert('RGBA')
        fw, fh = s.get('frameWidth', s['w']), s.get('frameHeight', s['h'])
        for frame in range(s.get('frames', 1)):
            merged.alpha_composite(im.crop((frame*fw, 0, (frame+1)*fw, fh)), ((551-fw)//2, 530-fh))
    return merged.getbbox()
d['webPoseOffsets'] = {}
d['webActorBounds'] = {}
for actor, states in d['characterLayers'].items():
    base_state = next(k for k in states if k.endswith('idle_default'))
    base = pose_bbox(states[base_state])
    d['webActorBounds'][actor] = base
    offsets = {}
    for state, keys in states.items():
        if state!='drink_default' and not any(d['assets'][k].get('frameWidth', d['assets'][k]['w'])!=551 or d['assets'][k]['h']!=530 for k in keys):
            continue
        box = pose_bbox(keys)
        offsets[state] = [round((base[0]+base[2]-box[0]-box[2])/2), base[3]-box[3]]
    d['webPoseOffsets'][actor] = offsets

# Use the team's supplied temporary artwork, including separate recipe/inventory art.
dummy = '0. 더미(임시) 리소스/'
names = {'gin':'진','beer':'병맥주','red_wine':'레드와인','champagne':'샴페인',
         'soda_water':'프레스카_탄산수','tequila':'데낄라','vodka':'그레이구스_보드카',
         'rum':'바카디_럼','orange_juice':'오렌지주스','ginger_ale':'진저에일',
         'cola':'콜라','whiskey':'조니워커_위스키','dry_vermouth':'마티니_드라이버무스',
         'grenadine':'그레나딘_시럽','sour_mix':'사워믹스',
         'shaker':'보스턴 쉐이커','mixing_glass':'믹싱 글라스','opener':'병따개',
         'cocktail':'칵테일잔','long_drink':'롱드링크잔','old_fashioned':'올드패션',
         'sour':'사워잔','wine':'와인잔','mug':'맥주잔'}
for ident, name in names.items():
    if 'item_'+ident not in d['assets']:
        add('item_'+ident, dummy+'재료 이미지/'+name+'.png')
    for rel in sorted(paths):
        if not rel.startswith(dummy+'UI 리소스 더미/') or Path(rel).stem not in [name, '쉐이커' if ident=='shaker' else name]:
            continue
        if '/레시피용 도구-재료 이미지/' in rel:
            add('recipe_item_'+ident, rel)
        if '/재료담는화면_인벤토리_재료 이미지/' in rel:
            add('inventory_item_'+ident, rel)
add('item_dummy', dummy+'재료 이미지/진.png')
for c in d['tables']['cocktails']:
    name = c['name.ko'].replace(' ', '').replace('데킬라', '데낄라')
    for rel in sorted(paths):
        stem = Path(rel).stem.replace('_완성본','').replace('_완성','').replace(' ','').replace('데킬라','데낄라')
        if stem != name:
            continue
        if rel.startswith(dummy+'칵테일 대표 이미지/') and 'cocktail_'+c['id'] not in d['assets']:
            add('cocktail_'+c['id'], rel)
        if rel.startswith(dummy+'UI 리소스 더미/레시피용 대표 칵테일 이미지/'):
            add('recipe_cocktail_'+c['id'], rel)
        if '/7. 칵테일 - 바 테이블 위/완성 칵테일/' in rel:
            add('table_cocktail_'+c['id'], rel)
        if '/6. 칵테일 - 제공 컷씬/완성 칵테일/' in rel:
            add('cocktail_'+c['id'], rel)

# Mix screens: actual authored motion, not a CSS shake of an inventory icon.
add('mix_stir_motion', '7. scene/스터 애니메이션/스터-Sheet.png', 6)
add('mix_shake_motion', '7. scene/쉐이킹 애니메이션/shake_nbg.png', 8)
# The supplied new overhead cup is currently embedded in the layout reference.
# Copy the reference intact and clip its cup region in the browser; don't redraw it.
reference_root = next(p for p in Path('/Users/lee/Desktop').iterdir()
                      if unicodedata.normalize('NFC', p.name) == '아트 작업물 2')
reference = next(p for p in reference_root.rglob('10.png')
                 if '배경/1. 바 내부/' in unicodedata.normalize('NFC', str(p)))
paths['reference/bar-interior/10.png'] = reference
add('mix_stir_reference', 'reference/bar-interior/10.png')
d['mixView'] = {'stirCupCrop': [2035, 495, 1030, 1070],
                'referenceFolder': str(reference.parent),
                'stirReferenceSize': [3840,2160], 'shakeReferenceSize': [1920,1080],
                'motionCycleSeconds': 1,
                'note': 'View only. Existing stir and shake scoring is unchanged.'}

# Metadata only: don't rewrite/crop any artwork. Fixed alpha bounds allow baselines
# to align even when one PNG includes seven pixels of transparent bottom padding.
for key, info in d['assets'].items():
    if 'w' not in info:
        continue
    with Image.open(APP/info['src']).convert('RGBA') as im:
        fw = info['w']//info.get('frames',1)
        boxes = [im.crop((i*fw,0,(i+1)*fw,info['h'])).getbbox() for i in range(info.get('frames',1))]
        boxes = [b for b in boxes if b]
        info['alphaBBox'] = [min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)] if boxes else [0,0,fw,info['h']]

assert tables_before == json.dumps(d['tables'], sort_keys=True), 'Gameplay data changed'
d['webArtRules'] = {'actorCanvas': [551, 530], 'sourceFps': 12, 'animationCycleSeconds': 1,
                    'generalTalkVariants': [1, 2, 3], 'missingTalk': 'keep_original_static_parts',
                    'specPage': 'https://app.notion.com/p/3dc1612298dc8056b6a9f9a0e355ab62'}
data_file.write_text('window.LUNA_DATA = '+json.dumps(d, ensure_ascii=False, separators=(',', ':'))+';\n')
(APP/'source-inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2))
print(json.dumps({'assets': len(d['assets']), 'tablesUnchanged': True, 'generalTalkSheets': 14}))

"""Read-only import of the project's CSV and graphics. Outputs only inside this web app."""
from pathlib import Path
import csv, json, hashlib, shutil, unicodedata, datetime
from PIL import Image

APP = Path(__file__).resolve().parents[1]
PROJECT = Path('/Users/lee/Desktop/project')
CSV = PROJECT/'Human-Bartender/HumanBartender/Assets/StreamingAssets/csv'
ART = next(p for p in PROJECT.iterdir() if unicodedata.normalize('NFC',p.name).startswith('9. 그래픽'))
TABLES = ['settings/days','settings/balance_config','settings/score_bands','settings/grade_cuts','settings/settlement_rules','settings/affinity_matrix','settings/ui_strings','settings/text_tags','craft/cocktails','craft/recipes','craft/shelf_items','craft/cocktail_tags','craft/tastes','craft/order_rules','guests/random_waves','guests/regular_slots','guests/barks','guests/bark_situations','guests/personalities','guests/guest_parts','guests/guest_exclusions','guests/guest_personalities','guests/guest_settings','story/scenes','story/steps','story/bar_choices','story/bar_choice_groups','characters/characters','characters/dossier']
SKIP = {'dataset_id','parent_id','parent_field','source_order','template_id'}
def convert(v):
    if v in ('\\N',None): return None
    if v == '\\E': return ''
    if v in ('true','false'): return v=='true'
    return v

tables={}; provenance=[]
for name in TABLES:
    f=CSV/(name+'.csv')
    raw=list(csv.DictReader(f.open(encoding='utf-8-sig',newline='')))
    if name in ('story/scenes','story/steps','story/bar_choices','story/bar_choice_groups'):
        raw=[r for r in raw if '/bar/' in r.get('dataset_id','')]
    tables[name.split('/')[-1]]=[{k:convert(v) for k,v in r.items() if k not in SKIP} for r in raw]
    provenance.append({'file':str(f.relative_to(CSV)), 'rows':len(raw), 'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})

paths={unicodedata.normalize('NFC',str(p.relative_to(ART))):p for p in ART.rglob('*.png')}
assetdir=APP/'assets';assetdir.mkdir(parents=True,exist_ok=True)
assets={}; originals={}
def asset(key,rel):
    p=paths.get(rel)
    if not p: return
    dest='a_'+hashlib.sha256(rel.encode()).hexdigest()[:12]+'.png'
    shutil.copy2(p,assetdir/dest)
    with Image.open(p) as im: w,h=im.size
    info={'src':'assets/'+dest,'w':w,'h':h,'source':rel}
    assets[key]=info; originals[info['src']]=rel
    return info

for key,rel in {
 'bar':'1. 배경 (내부)/1. 대화 화면/대화화면 풀샷.png',
 'bar_far':'1. 배경 (내부)/1. 대화 화면/대화화면 원경.png',
 'bar_mid':'1. 배경 (내부)/1. 대화 화면/대화화면 중경.png',
 'bar_front':'1. 배경 (내부)/1. 대화 화면/대화화면 근경.png',
 'prep_glass':'1. 배경 (내부)/2. 재료 담는 화면/잔 고르기.png',
 'prep_tool':'1. 배경 (내부)/2. 재료 담는 화면/도구 고르기.png',
 'prep_liquor':'1. 배경 (내부)/2. 재료 담는 화면/일반 선반.png',
 'prep_fridge':'1. 배경 (내부)/2. 재료 담는 화면/냉장고 선반.png',
 'gimmick':'1. 배경 (내부)/3. 기믹 플레이 화면/칵테일 제조 기믹.png',
 'gimmick_shake':'1. 배경 (내부)/3. 기믹 플레이 화면/쉐이킹 기믹.png',
 'gimmick_stir':'1. 배경 (내부)/3. 기믹 플레이 화면/스터 기믹.png',
 'coaster':'6. 칵테일-재료 리소스/8. 코스터/코스터.png',
 'dialogue':'8. UI/3. 메인 화면/GRD_textbox.png',
 'dialogue_luna':'8. UI/3. 메인 화면/GRD_textbox_luna.png',
 'choice':'8. UI/3. 메인 화면/IMG_choice_A.png',
 'next':'8. UI/3. 메인 화면/IMG_textbox_Next.png',
 'money':'8. UI/3. 메인 화면/IMG_money.png',
 'logo':'8. UI/1. 로고/IMG_logo_white.png',
}.items():asset(key,rel)

item_names={'gin':'진','whiskey':'조니워커_위스키','vodka':'그레이구스_보드카','rum':'바카디_럼','grenadine':'그레나딘_시럽','sour_mix':'사워믹스','beer':'병맥주','soda_water':'탄산수','cola':'콜라','champagne':'샴페인','dry_vermouth':'마티니_드라이버무스','red_wine':'레드와인','shaker':'쉐이커','mixing_glass':'믹싱 글라스','opener':'병따개','long_drink':'롱드링크잔','cocktail':'칵테일잔','sour':'사워잔','wine':'와인잔','mug':'맥주잔','old_fashioned':'올드패션'}
for item,label in item_names.items():
    candidates=[n for n in paths if n.startswith('6. 칵테일-재료 리소스/') and Path(n).stem==label and any('/'+s in n for s in ['1. 잔','2. 도구','3. 일반','4. 냉장고'])]
    if candidates:asset('item_'+item,sorted(candidates)[0])
for c in tables['cocktails']:
    name=c['name.ko'].replace(' ','');candidates=[n for n in paths if '/완성 칵테일/' in n and Path(n).stem.replace('_완성','').replace(' ','')==name]
    if candidates:asset('cocktail_'+c['id'],sorted(candidates,key=lambda n:0 if '/7. 칵테일' in n else 1)[0])
for gender,folder in [('m','남'),('f','여')]:
    prefix=f'4. 캐릭터 (내부)/NPC/{folder}/'
    for rel in paths:
        if rel.startswith(prefix) and '/' not in rel[len(prefix):]:asset('guest_'+gender+'_'+Path(rel).stem,rel)

characters={}
for ident,folder,states in [('chris','크리스',['Chris_idle']),('port','포트',['port_idle','port_joy','port_anger','port_serious']),('aili','아일리',['idle']),('samho','삼호',['idle']),('bubi','부비',['idle'])]:
    characters[ident]={}
    for state in states:
        for speech in ['default','talk']:
            prefix=f'4. 캐릭터 (내부)/{folder}/{state}/{speech}/'
            layers=[]
            order=['body','face_top','eyes','eyebrow','eyebrows','face_bottom_default','face_bottom_talk','extra','etc']
            for name in order:
                key=f'char_{ident}_{state}_{speech}_{name}'
                info=asset(key,prefix+name+'.png')
                if info:
                    # Sheets have 4 or 8 frames with a shared canvas. CSS samples first frame.
                    info['frames']=round(info['w']/551) if info['h']==530 and info['w']>=551 else (4 if info['w']>1000 else 1)
                    layers.append(key)
            if layers:characters[ident][state+'_'+speech]=layers

# Use the game's actual Korean font where available; do not depend on a Mac-only font.
font_candidates=list((PROJECT/'Human-Bartender/HumanBartender/Assets').glob('06.Fonts/**/*.ttf'))
font_candidates+=list((PROJECT/'Human-Bartender/HumanBartender/Assets').glob('06.Fonts/**/*.otf'))
for p in font_candidates:
    if 'NeoDunggeunmo' in p.name and 'SDF' not in p.name:
        shutil.copy2(p,assetdir/('game-font'+p.suffix));assets['font']={'src':'assets/game-font'+p.suffix};break

payload={'tables':tables,'assets':assets,'characterLayers':characters,'source':{'branch':'2-System-Refactoring','importedAt':datetime.datetime.now().isoformat(timespec='seconds'),'csvRoot':str(CSV),'files':provenance},'webRules':{'repeatOrderCost':0.10,'repeatOrderKey':'KeyE','coasterKey':'Space','dossierThresholds':[0,10,30]}}
(APP/'data.js').write_text('window.LUNA_DATA = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(APP/'source-inventory.json').write_text(json.dumps({'csv':provenance,'graphics':originals},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'csvTables':len(tables),'barSteps':len(tables['steps']),'barks':len(tables['barks']),'cocktails':len(tables['cocktails']),'assets':len(assets),'font':assets.get('font'),'output':str(APP)},ensure_ascii=False))

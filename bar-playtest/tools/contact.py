from pathlib import Path
from PIL import Image,ImageDraw
import json
p=Path(__file__).resolve().parents[1]
d=json.loads((p/'data.js').read_text().removeprefix('window.LUNA_DATA = ').strip().removesuffix(';'))
keys=['bar','bar_far','bar_mid','bar_front','prep_liquor','prep_glass','dialogue','gimmick']
canvas=Image.new('RGB',(800,720),'#1a1a26');draw=ImageDraw.Draw(canvas)
for i,k in enumerate(keys):
 a=d['assets'][k];im=Image.open(p/a['src']).convert('RGBA');im.thumbnail((390,150));x=(i%2)*400;y=(i//2)*180;canvas.paste(im,(x,y+25),im);draw.text((x+5,y+5),k,fill='white')
canvas.save('/private/tmp/bar-contact.jpg',quality=75)

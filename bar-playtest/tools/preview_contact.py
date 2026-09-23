from PIL import Image,ImageDraw
import sys
names=sys.argv[1:] or ['start','story','general','two-guests','prep','pour','result','compact']
canvas=Image.new('RGB',(1200,400*((len(names)+1)//2)),'#1a1a26');draw=ImageDraw.Draw(canvas)
for i,name in enumerate(names):
 im=Image.open('/private/tmp/bar-'+name+'.png').convert('RGB');im.thumbnail((590,370));x=(i%2)*600;y=(i//2)*400;canvas.paste(im,(x,y+25));draw.text((x+5,y+5),name,fill='white')
canvas.save('/private/tmp/bar-ui-review.jpg',quality=82)

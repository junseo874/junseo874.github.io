"""Compose the closed shaker and build directional ice sprites. Run with Pillow."""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parents[1] / 'src/dev/shaking/assets'
OUT = ART / 'poses'
ICE_ANGLES = 72
ICE_SOURCE = Image.open(ART / 'ice-cube.png').convert('RGBA')

def build_shaker():
    parts = Image.open(ART / 'boston-shaker.png').convert('RGBA')
    shell = Image.new('RGBA', (374, 96))
    shell.alpha_composite(parts.crop((0, 105, 195, 192)), (179, 5))
    shell.alpha_composite(parts.crop((0, 0, 218, 96)))
    shell.save(ART / 'boston-shaker-closed.png', optimize=True)

def indexed(palette, opacity):
    image = Image.new('P', (1, 1))
    image.putpalette([v for rgb in palette for v in rgb])
    image.info['transparency'] = bytes(opacity)
    return image

# Contours and chips of the original single-face ice, in design coordinates.
FACE = [(0,8),(2,4),(6,1),(25,0),(32,1),(36,5),(37,9),(37,28),(35,34),(31,37),(7,37),(2,34),(0,30)]
INNER = [(2,9),(5,4),(11,3),(29,2),(34,5),(35,10),(35,29),(30,34),(8,35),(4,32),(2,25)]
GLINT = [(4,8),(7,4),(18,3),(24,3),(20,5),(9,6),(6,10),(4,14)]
CHIP = [(24,29),(29,26),(30,23),(32,24),(31,29),(27,32),(22,32)]

def ice_frame(side, angle, cell):
    image = Image.new('L', (cell, cell))
    draw = ImageDraw.Draw(image)
    c, s = math.cos(angle), math.sin(angle)
    def points(design):
        return [(math.floor(cell/2+side/38*((x-18.5)*c-(y-18.5)*s)),
                 math.floor(cell/2+side/38*((x-18.5)*s+(y-18.5)*c))) for x,y in design]
    draw.polygon(points(FACE), fill=1)
    draw.polygon(points(INNER), fill=2)
    # The chip travels with the cube. The specular edge follows the light as it turns.
    lit = max(0, (1+c)/2)
    draw.polygon(points(GLINT), fill=3 if lit > .64 else 4)
    draw.polygon(points(CHIP), fill=4 if lit > .36 else 3)
    for i, (x, y) in enumerate(INNER):
        nx, ny = INNER[(i+1) % len(INNER)]
        dx, dy = nx-x, ny-y
        light = ((dy*c+dx*s)*-.49 + (dy*s-dx*c)*-.87)/math.hypot(dx, dy)
        if light > .84:
            draw.line(points([(x,y), ((x+2*nx)/3,(y+2*ny)/3)]), fill=3)
    draw.line(points([(11,23),(14,20),(15,20),(17,17)]), fill=5)
    if side >= 13:
        draw.point(points([(11,15)])[0], fill=6)
    return image

def build_ice():
    # All drawn colors, including translucency, come from the neutral source.
    swatches = {rgba for _, rgba in ICE_SOURCE.getcolors()}
    ink = [(171,204,212,226),(156,199,209,192),(233,247,243,246),
           (192,220,222,208),(200,224,225,211),(217,235,233,229)]
    assert set(ink) <= swatches
    colors = [(0,0,0,0)] + ink
    palette = indexed([v[:3] for v in colors], [v[3] for v in colors])
    # Index one row per diameter; each row wraps onto the next line at its own stride.
    width, y, strips, tiles = 2048, 0, [], []
    for side in range(4, 41, 2):
        cell = 2*math.ceil(side*math.sqrt(2)/2+1)
        cols = min(ICE_ANGLES, width//cell)
        strips.append([side, cell, y, cols])
        for i in range(ICE_ANGLES):
            frame = ice_frame(side, i*math.tau/ICE_ANGLES, cell)
            tiles.append((frame, (i%cols*cell, y+i//cols*cell)))
        y += math.ceil(ICE_ANGLES/cols)*cell
    # Trim empty rows and columns with the same stable origin used for lookup.
    sheet = Image.new('P', (width, y))
    assert max(sheet.size) <= 4096
    sheet.putpalette(palette.getpalette())
    for frame, where in tiles:
        sheet.paste(frame, where)
    sheet.save(OUT / 'ice.png', transparency=palette.info['transparency'], optimize=True, bits=4)
    return strips

if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    build_shaker()
    data = {'iceAngles': ICE_ANGLES, 'ice': build_ice()}
    (OUT / 'frames.json').write_text(json.dumps(data, separators=(',', ':'))+'\n')

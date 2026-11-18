"""Draw each stirring ice size directly on its pixel grid, with 72 angle cels."""

import hashlib
import json
import math
import runpy
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DRAW = runpy.run_path(str(Path(__file__).with_name("build-shaker-poses.py")))
RELATIVE = "03.Crafting/04.Minigames/02.Stir/01.Sprites/WebGenerated"
OUTPUT = ROOT / "assets/01.ArtResources" / RELATIVE
# Match the six physical cubes in gimmick-mechanics.js. Each size is rasterized
# independently. Runtime rotation only selects a cel, never resamples the art.
SIZES = [(42, "xl"), (38, "l"), (35, "m"), (27, "xs"), (29, "s"), (24, "xxs")]
ANGLES = 72
COLORS = [(0, 0, 0, 0), (171, 204, 212, 226), (156, 199, 209, 192),
          (233, 247, 243, 246), (192, 220, 222, 208),
          (200, 224, 225, 211), (217, 235, 233, 229)]


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    registry_path = ROOT / "data/presentation/runtime-assets.json"
    manifest_path = ROOT / "data/presentation/generated-art/manifest.json"
    export_path = ROOT / "data/presentation/engine-art-sync.json"
    registry = json.loads(registry_path.read_text())
    manifest = json.loads(manifest_path.read_text())
    export = json.loads(export_path.read_text())
    paths = {f"{RELATIVE}/Web_stir_ice_{name}.png" for _, name in SIZES}
    manifest["records"] = [r for r in manifest["records"] if r["path"] not in paths]
    export["records"] = [r for r in export["records"] if r["path"] not in paths]
    for index, (side, name) in enumerate(SIZES):
        cell = 2 * math.ceil(side * math.sqrt(2) / 2 + 1)
        sheet = Image.new("P", (cell * ANGLES, cell))
        sheet.putpalette([channel for color in COLORS for channel in color[:3]])
        for frame in range(ANGLES):
            cel = DRAW["ice_frame"](side, frame * math.tau / ANGLES, cell)
            sheet.paste(cel, (frame * cell, 0))
        file = OUTPUT / f"Web_stir_ice_{name}.png"
        sheet.save(file, transparency=bytes(c[3] for c in COLORS), optimize=True, bits=4)
        relative = f"{RELATIVE}/{file.name}"
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        registry["assets"][f"stir_ice_{index}"] = {
            "src": "assets/01.ArtResources/" + relative,
            "w": sheet.width, "h": sheet.height,
            "frames": ANGLES, "frameWidth": cell, "frameHeight": cell, "fps": 12,
            "source": "tools/build-stir-ice.py",
        }
        manifest["records"].append({
            "path": relative, "sha256": digest,
            "width": sheet.width, "height": sheet.height, "kind": "artwork",
            "origin": "tools/build-stir-ice.py; size-specific pixel ice and directional cels",
            "reusesExisting": False, "sources": [],
        })
        export["records"].append({
            "from": relative, "path": relative, "sha256": digest, "kind": "new",
        })
        print(f"{file.name}: {side}px ice, {ANGLES} cels, {file.stat().st_size} bytes")
    write_json(registry_path, registry)
    write_json(manifest_path, manifest)
    write_json(export_path, export)


if __name__ == "__main__":
    build()

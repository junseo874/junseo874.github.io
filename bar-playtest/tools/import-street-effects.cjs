// Narrow, read-only Unity import. Never modifies the engine or reimports scene art.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const game = path.resolve(__dirname, '..');
(async function main() {
const engine = process.argv.find(a => a.startsWith('--engine='))?.slice(9) || '/Users/lee/Desktop/project/Human-Bartender/HumanBartender';
const content = path.join(engine, 'Assets/01.Game/03.Content');
const files = fs.readdirSync(content, { recursive: true }).filter(f => f.endsWith('.meta')).map(f => path.join(content, f));
const guids = new Map(files.map(f => [fs.readFileSync(f, 'utf8').match(/^guid: (.+)$/m)?.[1], f.slice(0, -5)]));
const scene = fs.readFileSync(path.join(engine, 'Assets/01.Game/01.Scenes/OutSide.unity'), 'utf8');
const blocks = new Map([...scene.matchAll(/^--- !u!(\d+) &(\d+)[^\n]*\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)].map(m => [m[2], { type: +m[1], text: m[3] }]));
const value = (t, k) => t.match(new RegExp('^\\s*' + k + ': (.*)$', 'm'))?.[1];
const num = (t, k) => Number(value(t, k));
const vec = (t, k) => Object.fromEntries([...String(value(t, k)).matchAll(/(\w+): ([\d.e+-]+)/g)].map(m => [m[1], +m[2]]));
const ref = s => s?.match(/fileID: (\d+)/)?.[1];
const file = s => guids.get(s?.match(/guid: (\w+)/)?.[1]);
const transforms = new Map([...blocks].filter(([, b]) => b.type === 4));
const byGo = new Map([...transforms].filter(([, b]) => value(b.text, 'm_GameObject')).map(([id, b]) => [ref(value(b.text, 'm_GameObject')), id]));
const worldCache = new Map();
function world(id) {
  if (!id || id === '0') return { x: 0, y: 0, a: 1, b: 0, c: 0, d: 1 };
  if (worldCache.has(id)) return worldCache.get(id);
  let t = transforms.get(id)?.text;
  if (!t) throw Error('Missing transform ' + id);
  // CRT planes are children added to the rain prefab. Resolve its explicit
  // scene transform overrides; do not silently treat stripped parents as origin.
  if (!value(t, 'm_LocalPosition')) {
    const instance = blocks.get(ref(value(t, 'm_PrefabInstance')))?.text;
    const source = ref(value(t, 'm_CorrespondingSourceObject'));
    const props = Object.fromEntries([...instance.matchAll(/- target: \{fileID: (\d+),[^\n]*\n\s+propertyPath: ([^\n]+)\n\s+value: ([^\n]+)/g)].filter(m => m[1] === source).map(m => [m[2], +m[3]]));
    if (props['m_LocalPosition.x'] !== 0 || props['m_LocalPosition.y'] !== 0 || props['m_LocalRotation.w'] !== 1) throw Error('Review changed CRT prefab transform');
    const prefab = fs.readFileSync(file(value(t, 'm_CorrespondingSourceObject')), 'utf8');
    const sourceBlock = prefab.match(new RegExp('--- !u!4 &' + source + '\\n([\\s\\S]*?)(?=--- !u!|$)'))?.[1];
    const scale = vec(sourceBlock, 'm_LocalScale');
    if (scale.x !== 1 || scale.y !== 1) throw Error('Review CRT prefab scale');
    return world(ref(value(instance, 'm_TransformParent')));
  }
  const p = vec(t, 'm_LocalPosition'), s = vec(t, 'm_LocalScale'), q = vec(t, 'm_LocalRotation');
  const parent = world(ref(value(t, 'm_Father'))), angle = 2 * Math.atan2(q.z, q.w), co = Math.cos(angle), si = Math.sin(angle);
  const a = co * s.x, b = si * s.x, c = -si * s.y, d = co * s.y;
  const w = { x: parent.x + parent.a * p.x + parent.c * p.y, y: parent.y + parent.b * p.x + parent.d * p.y,
    a: parent.a * a + parent.c * b, b: parent.b * a + parent.d * b, c: parent.a * c + parent.c * d, d: parent.b * c + parent.d * d };
  worldCache.set(id, w); return w;
}
const location = t => world(byGo.get(ref(value(t, 'm_GameObject'))));
const assets = {}, copies = new Map();
function sprite(reference, register = true) {
  const source = file(reference), meta = fs.readFileSync(source + '.meta', 'utf8'), png = fs.readFileSync(source);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), ppu = num(meta, 'spritePixelsToUnits');
  const pivots = [[.5,.5],[0,1],[.5,1],[1,1],[0,.5],[1,.5],[0,0],[.5,0],[1,0]];
  const alignedPivot = (t, key) => { const preset = pivots[num(t, 'alignment')]; return preset ? { x: preset[0], y: preset[1] } : vec(t, key); };
  let x = 0, y = 0, sw = w, sh = h, pivot = alignedPivot(meta, 'spritePivot');
  if (!['21300000', '2800000'].includes(ref(reference))) {
    const slice = meta.split(/(?=^    - serializedVersion:)/m).find(t => value(t, 'internalID') === ref(reference));
    if (!slice) throw Error('Missing sprite slice ' + reference);
    const rect = slice.match(/rect:\n([\s\S]*?)(?=      alignment)/)[1];
    x = num(rect, 'x'); sw = num(rect, 'width'); sh = num(rect, 'height'); y = h - num(rect, 'y') - sh;
    pivot = alignedPivot(slice, 'pivot');
  }
  const key = 'engine-fx-' + path.basename(source, '.png').replace(/^TX_/, '').replaceAll('_', '-').toLowerCase();
  if (register) {
    const src = 'assets/outside/effects/' + path.basename(source).replaceAll('_', '-').toLowerCase();
    assets[key] = { src, w, h, source: path.relative(engine, source), sha256: crypto.createHash('sha256').update(png).digest('hex') };
    copies.set(path.join(game, src), source);
  }
  return { asset: key, x, y, w: sw, h: sh, ppu, pivot };
}
const parentText = blocks.get('1041447592').text, parent = location(parentText), parentSprite = sprite(value(parentText, 'm_Sprite'), false);
const material = fs.readFileSync(file(parentText.match(/m_Materials:\s*\n\s*- (.*)/)[1]), 'utf8');
const matNumber = k => Number(material.match(new RegExp('- ' + k + ': ([^\\n]+)'))[1]);
const matVector = k => Object.values(vec(material, '- ' + k));
const matTexture = k => material.match(new RegExp('- ' + k + ':\\n\\s+m_Texture: (.*)'))[1];
const led = { rect: matVector('_ScrollRect'), blank: matVector('_ScrollBlankPixel').slice(0, 2), speed: matNumber('_ScrollSpeed'), step: matNumber('_ScrollStep'), offset: matNumber('_ScrollOffset'),
  mask: sprite(matTexture('_ScrollMaskTex')), glow: sprite(matTexture('_SignGlowTex')), glowOffset: matVector('_SignGlowOffset').slice(0, 2), glowColor: matVector('_SignGlowColor').slice(0, 3), strength: matNumber('_SignGlowStrength'), volume: matNumber('_SignGlowVolume') };
const fan = { centers: ['_SpinCenter', '_SpinCenter2'].map(k => matVector(k).slice(0, 2)), radius: matNumber('_SpinRadius'), inner: matNumber('_SpinInnerRadius'), speed: matNumber('_SpinSpeed'), steps: Math.round(matNumber('_SpinSteps')) };
const dim = { mask: sprite(matTexture('_NeonDimMask')), floor: matNumber('_NeonDimFloor') };
// RGBA are four independent data channels. A Canvas ImageData decode would
// discard RGB wherever alpha is zero. Preserve the PNG and export lossless
// channel runs separately (not a re-encoded image).
const sharp = require('../../tools/lib/test-runtime.cjs').load('sharp');
const rawDim = await sharp(file(matTexture('_NeonDimMask'))).ensureAlpha().raw().toBuffer();
dim.runs = [0, 1, 2, 3].map(channel => {
  const runs = [];
  for (let y = 0; y < dim.mask.h; y++) for (let x = 0; x < dim.mask.w;) {
    const v = rawDim[(y * dim.mask.w + x) * 4 + channel], start = x++;
    if (!v) continue;
    while (x < dim.mask.w && rawDim[(y * dim.mask.w + x) * 4 + channel] === v) x++;
    runs.push([start, y, x - start, v / 255]);
  }
  return runs;
});
const neon = blocks.get('1031452150').text;
const flicker = Object.fromEntries(['burstsPerMinute', 'intervalRandomness', 'longOffChance', 'offBrightness'].map(k => [k, num(neon, k)]));
for (const k of ['flickersPerBurst', 'flickerOffSeconds', 'flickerOnSeconds', 'longOffSeconds']) flicker[k] = Object.values(vec(neon, k));
const groups = neon.split(/\n  - name: /).slice(1).map(t => ({ name: JSON.parse(t.match(/^"[\s\S]*?"/)[0].replace(/\n\s*/g, ' ')),
  lights: [...t.split('    spillLights:')[0].matchAll(/- \{fileID: (\d+)\}/g)].map(m => m[1]),
  spillLights: [...t.split('    spillLights:')[1].split('    spillAmount:')[0].matchAll(/fileID: (\d+)/g)].map(m => m[1]),
  spillAmount: num(t, 'spillAmount'), channel: num(t, 'dimChannel'), frequencyScale: num(t, 'frequencyScale') }));
// Replace only cookies whose engine source changed, plus the authored flicker
// cookies. Other web signs remain lit; no duplicate full cookie under a cutout.
const replacements = { 'service-cluster': 'TX_NeonFlicker_Cookie_B_Light_3_7_Base.png', 'vertical-left': 'TX_NeonFlicker_Cookie_B_Light_1_7_Base.png', 'restaurant-cluster': 'TX_LedSign_LightCookie_01.png' };
const replacementSprites = Object.fromEntries(Object.entries(replacements).map(([id, name]) => {
  const entry = [...guids].find(([, f]) => path.basename(f) === name);
  return [id, sprite('{fileID: 21300000, guid: ' + entry[0] + '}')];
}));
const lights = groups.flatMap(g => g.lights).map(id => {
  const t = blocks.get(id).text, w = location(t);
  return { id, ...w, intensity: num(t, 'm_Intensity'), color: Object.values(vec(t, 'm_Color')), sprite: sprite(value(t, 'm_LightCookieSprite')) };
});
const spills = [...new Set(groups.flatMap(g => g.spillLights))].map(id => {
  const t = blocks.get(id).text, w = location(t);
  return { id, intensity: num(t, 'm_Intensity'), color: Object.values(vec(t, 'm_Color')), falloff: num(t, 'm_ShapeLightFalloffSize'),
    points: [...t.split('  m_ShapePath:')[1].matchAll(/- \{x: ([\d.e+-]+), y: ([\d.e+-]+)/g)].map(m => [w.x + w.a * +m[1] + w.c * +m[2], w.y + w.b * +m[1] + w.d * +m[2]]) };
});
const scans = [...blocks].filter(([, b]) => b.type === 212 && /guid:/.test(b.text)).flatMap(([id, b]) => {
  const matPath = file(b.text.match(/m_Materials:\s*\n\s*- (.*)/)?.[1]);
  if (!/M_Crt\d+\.mat$/.test(matPath || '')) return [];
  const m = fs.readFileSync(matPath, 'utf8'), n = +matPath.match(/Crt(\d+)/)[1], receiverId = n <= 4 ? '1319968555' : '1041447592';
  const receiverText = blocks.get(receiverId).text, receiver = location(receiverText), sp = sprite(value(receiverText, 'm_Sprite'), false), w = location(b.text);
  const left = receiver.x - sp.w * sp.pivot.x / sp.ppu, top = receiver.y + sp.h * (1 - sp.pivot.y) / sp.ppu;
  // Unity's built-in Square sprite is 256px / 256PPU = 1 world unit.
  return [{ id, receiver: n <= 4 ? 'C_Middle_Building_1' : 'B_Fore_Building_1', x: (w.x - left) * sp.ppu, y: (top - w.y) * sp.ppu,
    a: w.a * sp.ppu, b: -w.b * sp.ppu, c: -w.c * sp.ppu, d: w.d * sp.ppu,
    speed: num(m, '- _ScanLinesSpeed'), opacity: num(m, '- _ScanlineOpacity'), frequency: vec(m, '- _ScanlineSize').g }];
});
if (scans.length !== 10 || groups.length !== 8) throw Error('Unexpected engine effect coverage');
const data = { source: 'OutSide.unity / SH_LedSignScroll / NeonFlicker / Sh_Scanline', parent, parentSprite, assets, led, fan, dim, flicker, groups, lights, spills, replacementSprites, scans };
const output = path.join(game, 'data/presentation/street-effects.js');
const serialized = '// Generated by tools/import-street-effects.cjs; engine is read-only.\nwindow.LUNA_STREET_EFFECTS = ' + JSON.stringify(data, null, 2) + ';\n';
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.join(game, 'assets/outside/effects'), { recursive: true });
  for (const [dest, src] of copies) fs.copyFileSync(src, dest);
  fs.writeFileSync(output, serialized);
} else if (fs.readFileSync(output, 'utf8') !== serialized) throw Error('Street effect snapshot differs from engine');
console.log(`${groups.length} flicker groups, ${scans.length} CRT planes, ${fan.centers.length} fans, ${copies.size} original PNGs verified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(root+'/data/runtime/game-data.js','utf8'),ctx);
const D=ctx.window.LUNA_DATA,{Game}=require(root+'/src/core/core.js'),g=new Game(D);
g.reset(99,'general',1974,true);
assert.equal(g.t.guest_parts.length,43);assert.equal(g.t.guest_exclusions.length,3);
const partIds=new Set(g.t.guest_parts.map(p=>p.id));assert.equal(partIds.size,43);
for(const gender of ['m','f']){
 assert.deepEqual([...g.appearanceParts(gender).filter(k=>k.includes('_mouth_'))], [1,2,3].map(i=>`guest_${gender}_mouth_${i}`));
 for(const i of [1,2,3])assert(D.assets[`guest_${gender}_talk_mouth_${i}`].frames>1);
}
for(const p of g.t.guest_parts)assert.equal(p.sprite,D.assets[p.id].src);
for(const pair of g.t.guest_exclusions){assert(partIds.has(pair.a)&&partIds.has(pair.b));assert(!g.appearanceAllowed(pair.a,pair.b));assert(!g.appearanceAllowed(pair.b,pair.a));}
for(const [field,id]of Object.entries(g.t.guest_settings[0]))if(field.startsWith('defaults.')&&id)assert(partIds.has(id));
// Removing a rule changes the consumer: no hardcoded copy of the CSV restriction.
const exclusions=g.t.guest_exclusions;g.t.guest_exclusions=[];
assert(g.appearanceAllowed('guest_m_Acc_2','guest_m_top_1'));g.t.guest_exclusions=exclusions;
const seen=new Set(),looks=new Set();
for(let i=0;i<12000;i++){
 const a=g.appearance();assert.equal(a.missing.length,0);assert(a.layers.length===6||a.layers.length===7);
 const types=a.layers.map(k=>k.replace('guest_'+a.gender+'_','').replace(/_\d+$/,''));
 assert.deepEqual(types.filter(t=>!['Acc','cyberware'].includes(t)),['body','top','eyebrow','eyes','mouth','hair']);
 if(a.layers.some(k=>['guest_m_Acc_2'].includes(k)))assert(a.layers.includes('guest_m_top_3'));
 for(const k of a.layers){seen.add(k);assert(fs.existsSync(path.join(root,D.assets[k].src)));assert(!k.includes('_talk_'));assert(k.startsWith('guest_'+a.gender+'_'));}
 looks.add(a.layers.join('|'));
}
const expected=Object.keys(D.assets).filter(k=>/^guest_[mf]_(body|top_\d+|Acc_\d+|eyebrow_\d+|eyes_\d+|mouth_[123]|hair_\d+)$/.test(k));
assert.deepEqual([...seen].sort(),expected.sort());assert(looks.size>1000);
g.queue=Array.from({length:20},()=>({personality:'gentle',order:'gin_tonic',max_rounds:1}));g.queueIndex=0;
let last;for(let i=0;i<20;i++){g.seats={L:null,M:null,R:null};g.tableFades={};g.spawn();const guest=Object.values(g.seats).find(Boolean);assert(guest.appearance);assert.notEqual(guest.appearance,last);last=guest.appearance;const before=JSON.stringify(last);g.focusSeat(guest.seat);assert.equal(JSON.stringify(guest.appearance),before);}
console.log('GUEST_RANDOM_APPEARANCE_OK: 12000 draws, all '+seen.size+' shipped parts, correct layers/band exclusion, fresh per arrival and stable on focus.');

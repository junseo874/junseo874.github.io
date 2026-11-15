const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseRows}=require('../src/shared/data/csv-catalog.js');
const fixture=require('./fixtures/notion-daily-dialogue.json');
const root=path.resolve(__dirname,'..');
const rows=parseRows(fs.readFileSync(path.join(root,'data/shared-csv/story/steps.csv'),'utf8'));
const plain=s=>(s||'').replace(/<[^>]+>/g,'');
const promptContexts=new Set(['shiba_allowance','neighborhood_bossIntro','neighborhood_repairGreeting','neighborhood_repairMenu','home_wardrobe','neighborhood_guardMenu','neighborhood_bossRepeat','neighborhood_cat','neighborhood_homeCat']);
for(const context of fixture.contexts){
 const actual=rows.filter(r=>r.context===context.id&&(r.type==='say'||r.type==='choice'&&promptContexts.has(context.id))).sort((a,b)=>Number(a.source_order)-Number(b.source_order)).map(r=>plain(r['text.ko']));
 assert.deepEqual(actual,context.text,context.id+' must match the reviewed latest Notion paragraphs');
}
for(const effect of fixture.effects){
 const row=rows.find(r=>r.row_id===effect.id);assert(row,'Do not drop effect-bearing dialogue: '+effect.id);
 assert.deepEqual(row['text.ko'].match(/<[^>]+>/g),effect.tags,'Keep every nested effect tag: '+effect.id);
}
const kinds=new Set(rows.map(r=>r.type));assert(!kinds.has('expression'));
for(const context of ['campaign_d1_bar','campaign_d2_bar','campaign_d3_bar']){
 const steps=rows.filter(r=>r.context===context).sort((a,b)=>Number(a.source_order)-Number(b.source_order)),seats={};
 for(const r of steps){if(r.type==='enter'){assert(!seats[r.arg],context+': occupied seat '+r.arg);seats[r.arg]=r.actor;}if(r.type==='exit')for(const seat in seats)if(seats[seat]===r.actor)delete seats[seat];}
}
console.log(`NOTION_DAILY_DIALOGUE_OK: ${fixture.contexts.length} flows, ${fixture.effects.length} styled lines, no occupied-seat replacement`);

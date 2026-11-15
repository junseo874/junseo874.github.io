/* Register a new day by instantiating the existing day-3 CSV templates.
   Metadata is append-only: the storage endpoint recomputes the same rows
   independently instead of trusting uploaded catalog/format definitions. */
(function(root){
'use strict';
const paths={days:'settings/days.csv',scenes:'story/scenes.csv',scripts:'story/script_files.csv',sources:'system/data_sets.csv',formats:'system/row_formats.csv'};
const clone=x=>JSON.parse(JSON.stringify(x)),id=d=>'script/bar/day'+d;
const valid=d=>Number.isInteger(d)&&d>=4&&d<=98;
const barDataset=s=>/^script\/bar\/day(?:[0-9]|[1-9][0-9])$/.test(s)&&s!=='script/bar/day99';
function registration(t,d,title){
 if(!valid(d)||!title||title.length>64||title!==title.trim())throw Error('새 일차는 4~98, 이름은 1~64자로 입력하세요. 99일차는 QA 전용입니다.');
 const day=String(d),source=id(day),rootId='script_files_script_bar_day'+d,template='source_script_bar_day'+d;
 const base=t.days.find(r=>r.day==='3'),sourceBase=t.sources.find(r=>r.dataset_id===id(3)),script=t.scripts.find(r=>r.dataset_id===id(3)),format=t.formats.find(r=>r.template_id===sourceBase.template_id);
 return {days:[{...base,day,row_id:'days_'+d,source_order:String(t.days.length),web_row_id:'editor_day_'+d,start_phase:'home',note:'','label.ko':title,'label.en':''}],
  scripts:[{...script,dataset_id:source,row_id:rootId,parent_id:'@'+source}],sources:[{...sourceBase,dataset_id:source,template_id:template,sha256:''}],
  formats:[{...format,template_id:template,row_id:rootId}],
  scenes:['bar_open','bar'].map(phase=>{const ref=t.scenes.find(r=>r.id==='campaign_d3_'+phase),key='campaign_d'+d+'_'+phase;return {...ref,id:key,day,title:title+' · '+(phase==='bar_open'?'개점 전':'단골 영업'),dataset_id:source,row_id:'scenes_'+key,web_row_id:key,parent_id:rootId};})};
}
function addViews(views,reg){
 const d=reg.days[0];const copy=(table,template,row)=>{const source=views.tables[table].rows.find(r=>r.id===template);if(!source)throw Error('일차 표시 템플릿이 없습니다: '+template);
  const copy=clone(source);copy.id=row.web_row_id;if(copy.key.id)copy.key.id=row.id;views.tables[table].rows.push(copy);};
 copy('days','days_4',d);
 for(const s of reg.scenes){copy('scenes','campaign_d3_'+s.phase,s);views.campaign[s.phase==='bar'?'bar':'opening'][d.day]={source:s.dataset_id,scene:s.id,offset:0};}
}
function seed(m,d,title){
 if(m.tables.days.some(s=>Number(s.day)===d)||m.tables.sources.some(s=>s.dataset_id===id(d)))throw Error('이미 등록된 일차입니다.');
 const reg=registration(m.tables,d,title.trim());for(const k of Object.keys(paths))m.tables[k]=m.tables[k].concat(reg[k]);addViews(m.views,reg);
 for(const s of reg.scenes){
  const r=m.add(s.id,0,'say');neutral(m,r,'luna');m.set(r,'arg','default');m.set(r,'text.ko','새 대사');
  if(s.phase==='bar')neutral(m,m.add(s.id,1,'end_part'),'luna');
 }
 return reg.scenes[0].id;
}
function neutral(m,row,actor){
 for(const k of Object.keys(row))if((k.startsWith('web_fields.')&&!['web_fields.type','web_fields.who'].includes(k))||['web_type','arg','entrance','effects','when','web_empty_arg','payment','text.ko','text.en'].includes(k))m.set(row,k,'');
 m.set(row,'sync','wait');m.set(row,'actor',actor);m.set(row,'web_fields.type',row.type);
 return row;
}
function additions(m){return m.tables.days.filter(d=>!m.base.tables.days.some(b=>b.day===d.day));}
function checkRegistry(m,expectedViews){
 const expected={...m.base.tables};
 for(const row of additions(m)){
  if(expected.days.some(d=>d.day===row.day))throw Error('중복 일차입니다.');
  const reg=registration(expected,Number(row.day),row['label.ko']);
  const stored=m.tables.sources.find(s=>s.dataset_id===id(row.day));if(!/^[a-f0-9]{64}$/.test(stored?.sha256||''))throw Error('새 일차 원본 확인값이 없습니다.');
  reg.sources[0].sha256=stored.sha256;
  for(const k of Object.keys(paths))expected[k]=expected[k].concat(reg[k]);addViews(expectedViews,reg);
 }
 for(const k of Object.keys(paths))if(JSON.stringify(expected[k])!==JSON.stringify(m.tables[k]))throw Error('일차 등록 이외에는 기존 목록이나 CSV 형식을 바꿀 수 없습니다: '+k);
}
async function fingerprint(m,catalog){
 const added=additions(m);if(!added.length)return;
 const sums=new Map();for(const d of added){const key=id(d.day),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(catalog.read(key))));sums.set(key,[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''));}
 m.tables.sources=m.tables.sources.map(r=>sums.has(r.dataset_id)?{...r,sha256:sums.get(r.dataset_id)}:r);
}
const api={paths,valid,barDataset,seed,neutral,additions,checkRegistry,fingerprint};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarDays=api;
})(globalThis);

(async function(){
'use strict';
const $=id=>document.getElementById(id),base='data/shared-csv/';let catalog,spec,page=0,filtered=[],headers=[];const size=60;
const structural=new Set(['dataset_id','row_id','parent_id','parent_field','source_order','template_id','context','web_row_id']);
const cell=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
function render(){
 const rows=catalog.rawTables.get(spec.table),query=$('search').value.trim().toLocaleLowerCase(),dataset=$('dataset').value;
 filtered=rows.filter(r=>(!dataset||r.dataset_id===dataset)&&(!query||Object.values(r).some(v=>v.toLocaleLowerCase().includes(query))));
 const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);
 const visible=headers.filter(h=>$('metadata').checked||!structural.has(h)&&!h.startsWith('web_')&&!h.startsWith('web_fields.'));
 $('head').replaceChildren();const head=document.createElement('tr');for(const h of visible)head.append(cell('th',h));$('head').append(head);
 const fragment=document.createDocumentFragment();for(const row of filtered.slice(page*size,(page+1)*size)){const tr=document.createElement('tr');for(const h of visible){const value=row[h],td=cell('td',value==='\\N'?'값 없음':value==='\\E'?'빈 문자열':value);if(value==='\\N')td.className='null';tr.append(td);}fragment.append(tr);}$('rows').replaceChildren(fragment);
 $('status').textContent=`${spec.path} · ${filtered.length} / ${rows.length}행 · 공통 원본 CSV`;
 $('page').textContent=`${page+1} / ${pages}`;$('previous').disabled=page===0;$('next').disabled=page>=pages-1;
}
function select(){
 spec=catalog.tables.find(t=>t.table===$('table').value);page=0;
 headers=catalog.columns.filter(c=>c.table===spec.table).sort((a,b)=>Number(a.column_order)-Number(b.column_order)).map(c=>c.column);
 const previous=$('dataset').value;$('dataset').replaceChildren(new Option('전체',''));
 for(const id of new Set(catalog.rawTables.get(spec.table).map(r=>r.dataset_id)))$('dataset').append(new Option(id,id));
 if([...$('dataset').options].some(o=>o.value===previous))$('dataset').value=previous;
 $('download').href=base+spec.path;$('download').download=spec.path.split('/').pop();$('download').hidden=false;render();
}
try{
 catalog=await LunaCsv.load(async path=>{const response=await fetch(base+path,{cache:'no-store'});if(!response.ok)throw Error(path+' ('+response.status+')');return response.text();});
 for(const t of catalog.tables)$('table').append(new Option(t.path,t.table));
 for(const id of ['table','dataset','search'])$(id).disabled=false;
 $('table').value=catalog.tables.find(t=>t.table==='Steps')?.table||catalog.tables[0].table;
 $('table').addEventListener('change',select);for(const id of ['dataset','metadata'])$(id).addEventListener('change',()=>{page=0;render();});$('search').addEventListener('input',()=>{page=0;render();});
 $('previous').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};select();
}catch(e){$('status').textContent='데이터를 불러오지 못했습니다: '+e.message;console.error(e);}
})();

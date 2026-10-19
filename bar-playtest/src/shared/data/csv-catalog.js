/* Unity CsvContentCatalog contract. No game-state or content overrides. */
(function(root){
'use strict';
const metadata={_Tables:'system/table_index.csv',_Columns:'system/columns.csv',_Sources:'system/data_sets.csv',_Schemas:'system/row_formats.csv'};
const fail=message=>{throw new Error('CSV: '+message);};
const isNull=value=>value==null||value===''||value==='\\N';
const key=(...parts)=>JSON.stringify(parts);
const order=value=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):fail('invalid order: '+value);
function parseCsv(text,file='CSV'){
 const rows=[],row=[];let cell='',quoted=false,closed=false,started=false;
 for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c===','||c==='\r'||c==='\n'){
   row.push(cell);cell='';closed=false;started=false;
   if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row.splice(0));}continue;
  }
  if(closed)fail(file+': unexpected character after closing quote at '+i);
  if(c==='"'){if(started)fail(file+': quote inside unquoted cell at '+i);quoted=true;started=true;}
  else{cell+=c;started=true;}
 }
 if(quoted)fail(file+': unclosed quote');
 if(started||closed||cell.length||row.length){row.push(cell);rows.push(row);}
 return rows;
}
function parseRows(text,file){
 const matrix=parseCsv(text,file),header=matrix[0];
 if(!header||header.some(x=>!x.trim())||new Set(header).size!==header.length)fail(file+': missing/duplicate header');
 return matrix.slice(1).filter(row=>row.some(x=>x!=='')).map((row,i)=>{
  if(row.length!==header.length)fail(file+': wrong column count at record '+(i+2));
  return Object.fromEntries(header.map((name,j)=>[name,row[j]]));
 });
}
function scalar(raw,type){
 if(isNull(raw))return null;
 if(raw==='\\E')return '';
 if(type==='str')return raw.startsWith('\\\\')?raw.slice(1):raw;
 if(type==='bool'){if(!/^(true|false)$/i.test(raw.trim()))fail('invalid boolean: '+raw);return raw.trim().toLowerCase()==='true';}
 if(type==='int'){if(!/^[+-]?\d+$/.test(raw.trim())||!Number.isSafeInteger(Number(raw)))fail('integer outside JavaScript safe range: '+raw);return Number(raw);}
 if(type==='float'){if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())||!Number.isFinite(Number(raw)))fail('invalid finite number: '+raw);return Number(raw);}
 return fail('unknown scalar type: '+type);
}
function safePath(path){
 if(!path||!path.endsWith('.csv')||path.startsWith('/')||/\.\.|:|\\|\/\//.test(path))fail('invalid relative path: '+path);
 return path;
}
class Catalog{
 constructor(files){
  const rows=name=>parseRows(files[name]??fail('missing '+name),name);
  this.tables=rows('_Tables.csv');this.columns=rows('_Columns.csv');this.sources=rows('_Sources.csv');
  this.rawTables=new Map();this.values=new Map();
  const types=new Map(),nodes=new Map(),templates=new Map(),records=new Map(),recordTables=new Map(),children=new Map(),visited=new Set(),active=new Set();
  const add=(map,id,value,label)=>{if(map.has(id))fail('duplicate '+label+': '+id);map.set(id,value);};
  for(const c of this.columns)add(types,key(c.table,c.column),c.types,'column');
  for(const data of rows('_Schemas.csv'))add(nodes,key(data.template_id,data.node_id),{...data,fields:[]},'schema node');
  for(const node of nodes.values()){
   if(node.parent_node==='')add(templates,node.template_id,node,'template');
   else{const parent=nodes.get(key(node.template_id,node.parent_node));if(!parent)fail('missing schema parent');parent.fields.push(node);}
  }
  for(const node of nodes.values())node.fields.sort((a,b)=>order(a.field_order)-order(b.field_order));
  for(const t of this.tables){
   if(this.rawTables.has(t.table))fail('duplicate table: '+t.table);
   const text=files[t.table+'.csv']??fail('missing table '+t.table);
   const expected=this.columns.filter(c=>c.table===t.table).sort((a,b)=>order(a.column_order)-order(b.column_order)).map(c=>c.column);
   if(JSON.stringify(parseCsv(text)[0])!==JSON.stringify(expected))fail('header mismatch: '+t.table);
   const table=rows(t.table+'.csv');this.rawTables.set(t.table,table);
   for(const row of table){
    if(!row.row_id?.trim())fail('missing row_id: '+t.table);
    add(records,row.row_id,row,'row_id');recordTables.set(row.row_id,t.table);
    if(templates.get(row.template_id)?.owner!==t.table)fail('template owner mismatch: '+row.row_id);
    order(row.source_order);
    const id=key(t.table,row.parent_id,isNull(row.parent_field)?'':row.parent_field);
    if(!children.has(id))children.set(id,[]);children.get(id).push(row);
   }
  }
  for(const list of children.values()){
   if(new Set(list.map(r=>order(r.source_order))).size!==list.length)fail('duplicate source_order');
   list.sort((a,b)=>order(a.source_order)-order(b.source_order));
  }
  const buildRecord=(id,source)=>{
   const row=records.get(id);if(!row)fail('missing row '+id);
   if(row.dataset_id!==source)fail('dataset mismatch: '+id);
   if(active.has(id))fail('cyclic record: '+id);active.add(id);
   try{
    const node=templates.get(row.template_id),allowed=new Set(['context','dataset_id','row_id','parent_id','parent_field','source_order','template_id','value_type',node.map_key]);
    const collect=n=>{if(n.kind==='cell')allowed.add(n.column);n.fields.forEach(collect);};collect(node);
    for(const [name,value]of Object.entries(row))if(!allowed.has(name)&&!isNull(value))fail('field outside row format: '+id+'/'+name);
    visited.add(id);return build(node,id,row,source);
   }finally{active.delete(id);}
  };
  const build=(node,parent,row,source)=>{
   if(!node)fail('missing root template: '+source);
   switch(node.kind){
    case 'record':return buildRecord(node.row_id,source);
    case 'empty_array':return [];
    case 'object':{
     const fields=new Map();for(const f of node.fields)add(fields,f.field,build(f,parent,row,source),'object field');return Object.fromEntries(fields);
    }
    case 'cell':{
     let type=node.type;if(type==='NoneType'){const declared=types.get(key(recordTables.get(parent),node.column));type=declared==='bool'?'bool':['int','float','float|int'].includes(declared)?'float':'str';}
     return scalar(row?.[node.column],type);
    }
    case 'children':{
     const matches=children.get(key(node.table,node.parent||parent,node.slot))||[];
     if(node.container==='list')return matches.map(r=>buildRecord(r.row_id,source));
     const result=new Map();for(const r of matches){const k=r[node.key_column];if(isNull(k))fail('missing map key: '+r.row_id);add(result,k,buildRecord(r.row_id,source),'map key');}return Object.fromEntries(result);
    }
    default:return fail('unknown schema kind: '+node.kind);
   }
  };
  for(const source of this.sources)add(this.values,source.dataset_id,build(templates.get(source.template_id),null,null,source.dataset_id),'dataset');
  for(const id of records.keys())if(!visited.has(id))fail('orphan row: '+id);
 }
 read(id){if(!this.values.has(id))fail('unknown dataset: '+id);return this.values.get(id);}
}
// The same resolver accepts fetch() in the browser or fs.readFile() in a build.
async function load(readText){
 const files={};await Promise.all(Object.entries(metadata).map(async([name,path])=>{files[name+'.csv']=await readText(path);}));
 const tables=parseRows(files['_Tables.csv'],'table_index');
 await Promise.all(tables.map(async t=>{files[t.table+'.csv']=await readText(safePath(t.path));}));
 return new Catalog(files);
}
const api={Catalog,load,metadata,parseCsv,parseRows,scalar,safePath};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.LunaCsv=api;
})(typeof window==='undefined'?globalThis:window);

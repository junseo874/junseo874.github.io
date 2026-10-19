/* Inverse of Unity's CSV row-format catalog; emits editable, typed columns. */
const crypto=require('node:crypto');
const {parseRows,parseCsv,Catalog}=require('../../bar-playtest/src/shared/data/csv-catalog.js');
const META=['dataset_id','row_id','parent_id','parent_field','source_order','template_id'];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const encode=v=>v==null?'\\N':v===''?'\\E':typeof v==='string'&&v.startsWith('\\')?'\\'+v:String(v);
const csv=matrix=>'\ufeff'+matrix.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
function serialize(original,values){
 const tables=parseRows(original['_Tables.csv']),oldColumns=parseRows(original['_Columns.csv']),oldSchemas=parseRows(original['_Schemas.csv']),sources=parseRows(original['_Sources.csv']);
 const nodes=new Map(oldSchemas.map(n=>[n.template_id+'|'+n.node_id,n]));
 const roots=new Map(oldSchemas.filter(n=>!n.parent_node).map(n=>[n.template_id,n]));
 const links=new Map(),scalarColumns=new Map();
 for(const n of oldSchemas){
  if(n.kind==='children'){
   let parent=n;const fields=[];while(parent.parent_node){if(parent.field)fields.unshift(parent.field);parent=nodes.get(parent.template_id+'|'+parent.parent_node);}
   if(parent.owner)links.set(parent.owner+'|'+fields.join('.'),{table:n.table,container:n.container,key:n.key_column});
  }
  if(n.kind==='cell'&&!n.parent_node&&n.owner)scalarColumns.set(n.owner,n.column);
 }
 const records=new Map(tables.map(t=>[t.table,[]])),columns=new Map(tables.map(t=>[t.table,oldColumns.filter(c=>c.table===t.table).map(c=>c.column)]));
 const types=new Map(),templates=new Map(),schema=[];
 function column(table,name,type){const list=columns.get(table);if(!list.includes(name))list.push(name);const k=table+'|'+name;if(!types.has(k))types.set(k,new Set());if(type!=='NoneType')types.get(k).add(type);}
 function record(value,table,dataset,parent,slot,index,path,mapKey,mapColumn){
  const id='shared_'+hash([dataset,path]);
  const row={dataset_id:dataset,row_id:id,parent_id:parent,parent_field:slot||'\\N',source_order:String(index)};
  if(mapColumn){row[mapColumn]=mapKey;column(table,mapColumn,'str');}
  const childTasks=[];
  function shape(value,fieldPath=[]){
   const joined=fieldPath.join('.');let link=links.get(table+'|'+joined);
   if(!link&&Array.isArray(value)&&value.length){
    if(!records.has('PresentationValues')){
     tables.push({table:'PresentationValues',book:'Presentation',editable:'True',description:'Shared presentation list values',path:'presentation/values.csv'});
     records.set('PresentationValues',[]);columns.set('PresentationValues',[...META,'value']);
    }
    link={table:'PresentationValues',container:'list',key:''};
   }
   if(link&&value!=null){
    childTasks.push({value,link,slot:joined});return{kind:'children',table:link.table,slot:joined,container:link.container,key_column:link.key};
   }
   if(Array.isArray(value)){if(value.length)throw Error('No CSV child table: '+table+'.'+joined);return{kind:'empty_array'};}
   if(value&&typeof value==='object')return{kind:'object',fields:Object.entries(value).map(([field,v])=>({field,...shape(v,[...fieldPath,field])}))};
   const name=joined||scalarColumns.get(table)||'value';
   const type=value==null?'NoneType':typeof value==='boolean'?'bool':typeof value==='number'?(Number.isInteger(value)?'int':'float'):'str';
   column(table,name,type);row[name]=encode(value);return{kind:'cell',column:name,type};
  }
  const tree=shape(value),template='shared_'+table.toLowerCase()+'_'+hash([tree,mapColumn]);row.template_id=template;
  if(!templates.has(template)){
   templates.set(template,true);
   function emit(node,nodeId,parentNode,field,fieldOrder){
    const {fields,...data}=node;schema.push({template_id:template,node_id:nodeId,parent_node:parentNode,field,field_order:String(fieldOrder),owner:nodeId==='0'?table:'',map_key:nodeId==='0'?(mapColumn||''):'',...data});
    fields?.forEach((f,i)=>emit(f,nodeId+'.'+i,nodeId,f.field,i));
   }emit(tree,'0','','',0);
  }
  records.get(table).push(row);
  for(const child of childTasks){
   const entries=child.link.container==='list'?child.value.map((v,i)=>[String(i),v]):Object.entries(child.value);
   entries.forEach(([key,v],i)=>record(v,child.link.table,dataset,id,child.slot,i,[...path,child.slot,key],key,child.link.key));
  }
  return id;
 }
 const sourceRows=[];
 for(const source of sources){
  if(!values.has(source.dataset_id))throw Error('Missing dataset '+source.dataset_id);
  const value=values.get(source.dataset_id),old=roots.get(source.template_id),template='shared_source_'+hash(source.dataset_id);
  let tree;
  if(old.kind==='children'){
   tree={kind:'children',table:old.table,slot:old.slot,container:old.container,key_column:old.key_column,parent:'@'+source.dataset_id};
   const entries=old.container==='list'?value.map((v,i)=>[String(i),v]):Object.entries(value);
   entries.forEach(([key,v],i)=>record(v,old.table,source.dataset_id,'@'+source.dataset_id,old.slot,i,[key],key,old.key_column));
  }else if(old.kind==='record'){
   const oldRowTable=tables.find(t=>parseRows(original[t.table+'.csv']).some(r=>r.row_id===old.row_id))?.table;
   if(!oldRowTable)throw Error('Missing root record '+old.row_id);
   tree={kind:'record',row_id:record(value,oldRowTable,source.dataset_id,'@'+source.dataset_id,'',0,[],null,null)};
  }else{
   // The current quests dataset has only named empty arrays and no records.
   const empty=v=>Array.isArray(v)&&!v.length?{kind:'empty_array'}:v&&typeof v==='object'?{kind:'object',fields:Object.entries(v).map(([field,value])=>({field,...empty(value)}))}:(()=>{throw Error('Unsupported scalar dataset root');})();
   tree=empty(value);
  }
  function emit(node,id,parent='',field='',index=0){const{fields,...data}=node;schema.push({template_id:template,node_id:id,parent_node:parent,field,field_order:String(index),...data});fields?.forEach((n,i)=>emit(n,id+'.'+i,id,n.field,i));}emit(tree,'0');
  sourceRows.push({...source,template_id:template,sha256:crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')});
 }
 const output={};const write=(name,header,rows)=>{output[name]=csv([header,...rows.map(r=>header.map(k=>r[k]??''))]);};
 write('_Tables.csv',parseCsv(original['_Tables.csv'])[0],tables);
 const newColumns=[];
 for(const t of tables){
  const header=columns.get(t.table);header.forEach((name,i)=>newColumns.push({...oldColumns.find(c=>c.table===t.table&&c.column===name),table:t.table,column:name,column_order:String(i),types:[...(types.get(t.table+'|'+name)||new Set(['str']))].sort().join('|')||'str'}));
  write(t.table+'.csv',header,records.get(t.table));
 }
 write('_Columns.csv',parseCsv(original['_Columns.csv'])[0],newColumns);
 write('_Schemas.csv',parseCsv(original['_Schemas.csv'])[0],schema);
 write('_Sources.csv',parseCsv(original['_Sources.csv'])[0],sourceRows);
 const check=new Catalog(output);
 for(const [id,value]of values)if(JSON.stringify(check.read(id))!==JSON.stringify(value))throw Error('CSV round-trip mismatch: '+id);
 return output;
}
module.exports={serialize,csv};

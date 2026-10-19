const assert=require('node:assert/strict');
const {Catalog,parseCsv,parseRows,scalar,safePath}=require('../src/shared/data/csv-catalog.js');
const csv=rows=>rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
function fixture(){
 const columns=['amount','enabled','text','empty','missing','dataset_id','row_id','parent_id','parent_field','source_order','template_id'];
 const schema=['template_id','node_id','parent_node','field','field_order','kind','column','type','table','slot','container','key_column','parent','row_id','map_key','owner'];
 const node=values=>schema.map(k=>values[k]??'');
 return {
  '_Tables.csv':csv([['table'],['TestRows']]),
  '_Columns.csv':csv([['table','column','column_order','types'],...columns.map((c,i)=>['TestRows',c,String(i),'str'])]),
  '_Sources.csv':csv([['dataset_id','template_id'],['test','root']]),
  '_Schemas.csv':csv([schema,node({template_id:'root',node_id:'0',field_order:'0',kind:'record',row_id:'r1'}),node({template_id:'sample',node_id:'0',field_order:'0',kind:'object',owner:'TestRows'}),...['int','bool','str','str','int'].map((type,i)=>node({template_id:'sample',node_id:'0.'+i,parent_node:'0',field:columns[i],field_order:String(i),kind:'cell',column:columns[i],type}))]),
  'TestRows.csv':csv([columns,['0','false','한글, "대사"\r\n둘째 줄','\\E','\\N','test','r1','@test','','0','sample']])
 };
}
assert.deepEqual(new Catalog(fixture()).read('test'),{amount:0,enabled:false,text:'한글, "대사"\r\n둘째 줄',empty:'',missing:null});
assert.deepEqual(parseCsv('\ufeffid,text,last\r\none,"say ""hi""",\r\n'),[['id','text','last'],['one','say "hi"','']]);
for(const text of ['a\n"unfinished','a\na"b','a\n"a"x'])assert.throws(()=>parseCsv(text));
for(const text of ['a,a\n1,2','a,b\n1','\n',''])assert.throws(()=>parseRows(text));
const duplicate=fixture();duplicate['TestRows.csv']+=csv([parseCsv(duplicate['TestRows.csv'])[1]]);assert.throws(()=>new Catalog(duplicate),/duplicate row_id/);
const orphan=fixture();orphan['TestRows.csv']=orphan['TestRows.csv'].replace('"r1"','"r2"');assert.throws(()=>new Catalog(orphan),/missing row/);
const wrongDataset=fixture();wrongDataset['TestRows.csv']=wrongDataset['TestRows.csv'].replace('"test"','"other"');assert.throws(()=>new Catalog(wrongDataset),/dataset mismatch/);
assert.equal(scalar('\\\\N','str'),'\\N');assert.equal(scalar('0','int'),0);assert.equal(scalar('false','bool'),false);assert.equal(scalar('1e2','float'),100);
for(const [v,t]of [['NaN','float'],['Infinity','float'],['0xff','float'],['9007199254740992','int'],['trueish','bool']])assert.throws(()=>scalar(v,t));
for(const p of ['../x.csv','/x.csv','a\\b.csv','https://x.csv','a//b.csv','a.txt'])assert.throws(()=>safePath(p));
assert.equal(safePath('story/steps.csv'),'story/steps.csv');
console.log('CSV_CATALOG_OK: Unity scalar/quote/header/identity contracts; unsafe data rejected.');

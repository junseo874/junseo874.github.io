/* Read-only comparison against the installed engine. No schema adoption or writes. */
const fs=require('node:fs/promises'),path=require('node:path');
const Csv=require('../bar-playtest/src/shared/data/csv-catalog.js');
const root=path.resolve(__dirname,'..');
const engineRoot=path.resolve(root,'../Human-Bartender/HumanBartender');
async function audit({base=path.join(root,'bar-playtest/data/shared-csv'),engine=engineRoot,read}={}){
 const webRead=read||((p)=>fs.readFile(path.join(base,p),'utf8'));
 const engineRead=p=>fs.readFile(path.join(engine,'Assets/StreamingAssets/csv',p),'utf8');
 const [web,native]=await Promise.all([Csv.load(webRead),Csv.load(engineRead)]);
 const errors=[],gaps=[];
 for(const file of ['system/table_index.csv','system/columns.csv','system/row_formats.csv']){
  const approved=new Set(Csv.parseRows(await engineRead(file)).map(r=>JSON.stringify(r)));
  for(const row of Csv.parseRows(await webRead(file)))if(!approved.has(JSON.stringify(row)))errors.push({file,row:row.template_id||row.table||row.column,reason:'엔진에 없는 구조/타입. 사용자 승인 필요'});
 }
 for(const [id]of web.values)if(!native.values.has(id))errors.push({source:id,reason:'엔진에 없는 데이터셋. 사용자 승인 필요'});
 const scripts=path.join(engine,'Assets/01.Game/02.Scripts');
 const readCode=p=>fs.readFile(path.join(scripts,p),'utf8');
 const [compiler,barRunner,streetRunner,enums]=await Promise.all([
  readCode('03.Data/01.Loading/StoryCsvCompiler.cs'),readCode('04.Features/04.Story/StoryScriptRunner.cs'),
  readCode('04.Features/05.Dialogue/DialogueRunner.cs'),readCode('03.Data/02.Models/NewEnums.cs')]);
 const enumText=enums.match(/enum ENewStepType\s*\{([\s\S]*?)\}/)?.[1];if(!enumText)throw Error('Engine step enum not found');
 const enumNames=new Map([...enumText.matchAll(/EnumMember\(Value = "([^"]+)"\)\]\s*(\w+)/g)].map(m=>[m[1],m[2]]));
 const barTypes=new Set([...enumNames].filter(([,n])=>barRunner.includes('ENewStepType.'+n)).map(([k])=>k));
 const streetTypes=new Set([...streetRunner.matchAll(/case "([^"]+)":/g)].map(m=>m[1]));
 const commands=[...compiler.matchAll(/\("([^"]+)", (_|"[^"]*"), (_|"[^"]*")\) => OutsideStoryCommand/g)].map(m=>[m[1],...m.slice(2).map(x=>x==='_'?null:x.slice(1,-1))]);
 const engineRows=new Map([...native.rawTables.values()].flat().map(r=>[r.row_id,r]));
 const steps=web.rawTables.get('Steps'),choices=web.rawTables.get('StreetChoices');
 for(const row of steps){
  const outside=['script/street','script/home','script/qa/street_day99'].includes(row.dataset_id),kind=clean(row['web_fields.type']);
  if(outside){
   const hasOptions=choices.some(c=>c.parent_id===row.row_id);
   if(kind&&!['say','timeline','effect'].includes(kind)&&!(kind==='choice'&&hasOptions)){
    if(!commands.some(([k,s,a])=>k===kind&&(s===null||s===clean(row['web_fields.stage']))&&(a===null||a===clean(row['web_fields.action']))))errors.push({row:row.row_id,reason:'미지원 외부 명령: '+kind});
   }else if(!streetTypes.has(row.type))errors.push({row:row.row_id,reason:'미지원 외부 type: '+row.type});
  }else if(row.dataset_id.startsWith('script/')&&!barTypes.has(row.type))errors.push({row:row.row_id,reason:'미지원 대본 type: '+row.type});
  if(!outside&&clean(row.web_type)&&row.web_type!==row.type)gaps.push({row:row.row_id,reason:'웹 투영 타입 '+row.web_type+'의 동작은 엔진 '+row.type+' 실행과 별도 확인 필요'});
  if(row.type==='effect'&&['gear_part','machine_church_emblem'].includes(row.arg))gaps.push({row:row.row_id,reason:'플래그 효과는 지원하지만 arg의 아이템 지급·알림은 엔진 effect 처리기가 실행하지 않음'});
 }
 for(const [table,rows]of web.rawTables)for(const row of rows)for(const field of ['effects','when','spawn_when','interact_when']){
  const value=clean(row[field]);if(!value)continue;
  if(field==='effects'?/\breputation\s*[+\-=]|\bgive\s*\(/.test(value):/\b(?:alive|cocktail)\./.test(value))gaps.push({table,row:row.row_id,field,value,sameInEngine:engineRows.get(row.row_id)?.[field]===row[field],reason:'기존 엔진 실행기 지원 확인/승인 필요. 삭제·의미 대체 금지'});
 }
 return {tables:web.tables.length,datasets:web.values.size,steps:steps.length,errors,gaps};
}
function clean(v){return !v||v==='\\N'||v==='\\E'?'':v;}
if(require.main===module)audit().then(r=>{console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={audit};

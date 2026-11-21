/* Exterior authoring is deliberately limited to fields the existing CSV/runtime consumes. */
(function(root){
'use strict';
const browser=typeof module==='undefined';
const Base=browser?root.LunaDialogueEditorModel:require('./editor-model.js');
const Csv=browser?root.LunaCsv:require('../../shared/data/csv-catalog.js');
const Projection=browser?root.LunaRuntimeProjection:require('../../shared/data/runtime-projection.js');
const conditions=(browser?root.LunaRuleParts.conditions:require('../../core/story-conditions.js'))({GRADES:[],n:(v,d=0)=>Number(v)||d,root:{}});
const paths={steps:'story/steps.csv',street_choices:'story/street_choices.csv',scenes:'story/scenes.csv'};
const Nodes=browser?root.LunaOutsideNodes:require('./outside-node-authoring.js');
const Author=browser?root.LunaOutsideAuthoring:require('../../features/outside/events/outside-authoring.js');
const Place=browser?root.LunaNpcPlacement:require('../../features/outside/npc-placement.js');
const decode=Base.decode,clone=x=>JSON.parse(JSON.stringify(x));
const labels={believer:'기신교 신도',newspaper:'신문 읽는 남자',ambient:'거리 배경 대화 / TV',thug:'1일차 복도 불량배',notion:'정보 행인 / 삼호',shop:'개시바 상점',beggar:'노숙자 / 정보 행인',neighborhood:'부비 / 수리공 / 갱단',home:'집 오브젝트',night0:'0일차 테라스',night1:'1일차 테라스',night2:'2일차 테라스',ending:'3일차 테라스',johnny:'조니와 톰의 기억',terraceMemory:'0일차 유나의 기억',terraceMemory3:'3일차 유나의 기억',workshop:'크리스·포트 작업실 (보관)',commute2:'2일차 출근 · 삼호',commute3:'3일차 출근 · 삼호'};
const suffix={intro:'첫 대화',finish:'마무리',repeat:'반복 대화',options:'답변 선택지',wrong:'오답 분기',right:'정답 분기',common:'공통 합류',paid:'지불 후',refused:'거절 후',revisit:'재방문',allowance:'용돈',quizIntro:'퀴즈 도입',lesson:'칵테일 설명',reveal:'부비 발견',feed:'참치캔 / 입양',rest:'부비 입양 후 휴식',homeCat:'집에서 부비',cat:'거리에서 부비',repairGreeting:'수리공 인사',repairIntro:'수리공 첫 대화',repairMenu:'수리 선택',repairPaid:'수리 완료',guardBlocked:'갱단 길막',guardMenu:'갱단 질문',guardPass:'갱단 통과',bossIntro:'갱단 보스 첫 대화',bossWait:'거래 취소',bossRepeat:'보스 재대화',bossRepairFirst:'수리 보상 · 첫 대화',bossPayFirst:'유료 구매 · 첫 대화',bossRepairRepeat:'수리 보상 · 재대화',bossPayRepeat:'유료 구매 · 재대화',bossDone:'거래 후',wardrobe:'옷장',wardrobePressed:'옷장 버튼',bed:'침대',contract:'삼호 계약 종료'};
Object.assign(suffix,{purchased:'비터스 구매 후',quizCorrect:'퀴즈 정답',quizRetry:'퀴즈 오답',noStockPurchase:'구매 거절',noBrowse:'재방문 거래 거절',browse:'상품 둘러보기',allowanceYes:'용돈 수령','warning/unmet':'정보 행인 · 노숙자 만나기 전','warning/met':'정보 행인 · 노숙자 만난 후','warning/paid':'정보 행인 · 돈을 준 후','warning/unpaid-repeat':'정보 행인 · 미지불 반복','warning/paid-repeat':'정보 행인 · 지불 후 반복',questioned:'노숙자에게 따져 묻기','info/gang':'갱 정보','info/coratech':'코라테크 정보','info/chris':'크리스 정보',outside_day0_store_passers:'0일차 · 편의점 앞 행인',outside_day0_building_residents:'0일차 · 상층 주민',outside_day0_port_pair:'0일차 · 바 앞 행인',outside_day1_samho_smuggler:'1일차 · 삼호와 밀수업자',outside_day0_shiba_wanted:'상시 · 시바 수배 전단',outside_day0_tv_news1:'0일차 · TV 뉴스',outside_day1_tv_news2:'1일차 · TV 뉴스',outside_day1_commute_passers2:'1일차 · 출근길 행인',outside_day2_commute_reopening:'2일차 · 바 재개점 소문'});
suffix.book='책 표지 설명';
// Exact links from native StreetChoices to the currently implemented JS handlers.
// The same aliases are consumed by outside-authoring.js, never guessed from labels.
const choiceLinks={
 'thug/intro':{'thug-pay':'thug-pay','thug-refuse':'thug-refuse'},
 'shop/allowance':{'allow-yes':'shop-allowance-yes','allow-no':'shop-allowance-no'},
 'shop/revisit':{'shop-yes':'shop-yes','shop-no-revisit':'shop-no'},
};
const extraChoices=[
 {id:'choices/info',scene:'day2-thug-information',group:'정보 행인 / 삼호',title:'정보 주제 선택',links:{'info-gang':'info-gang','info-coratech':'info-coratech','info-chris':'info-chris','info-cancel':'info-cancel'}},
 ...['gang','coratech','chris'].map(topic=>({id:'choices/pay-'+topic,scene:'day2-thug-information',branch:'info-'+topic,group:'정보 행인 / 삼호',title:({gang:'갱',coratech:'코라테크',chris:'크리스'})[topic]+' · 정보 구매 확인',links:{['pay-'+topic]:'info-pay',['cancel-'+topic]:'info-cancel'}})),
 {id:'choices/stock',scene:'shiba-stock',group:'개시바 상점',title:'물품 구매 선택',links:{'buy-bitters':'shop-buy-bitters','shop-no':'shop-no'}}
];
class Model extends Base.Model{
 constructor(files,presentation){super(files,presentation);this.placement=Place.validate(JSON.parse(files[Place.file]||Place.defaultText));this.tables={};this.headers={};for(const [name,path]of Object.entries(paths)){this.tables[name]=Csv.parseRows(files[path],path);this.headers[name]=Csv.parseCsv(files[path])[0];}this.base=this.snapshot();}
 get rawScenes(){return this.tables.scenes;}
 async init(){this.catalog=await Csv.load(p=>Promise.resolve(this.files[p]));this.projected=Projection.project(this.catalog,this.views,this.presentation);this.flows=[];
  const add=(id,ref,category,onlyChoices=false)=>{const scene=this.rawScenes.find(s=>s.id===ref.scene&&s.dataset_id===ref.source);if(!scene)return;
   let parent=scene.row_id;if(ref.branch){const choices=this.tables.street_choices.filter(c=>c.id===ref.branch&&c.dataset_id===ref.source);const under=(id)=>{let r=this.tables.steps.find(r=>r.row_id===id)||this.tables.street_choices.find(r=>r.row_id===id);return r&&(r.parent_id===scene.row_id||under(r.parent_id));};const c=choices.find(c=>under(c.parent_id));if(!c)return;parent=c.row_id;}
   const [family,...rest]=id.split('/'),title=labels[id]||suffix[rest.join('/')]||rest.join(' / ')||id;
   const flow={id,ref,parent,group:category||labels[family]||'기타 대화',title,offset:ref.offset||0,links:choiceLinks[id]||{},campaign:!!category,onlyChoices};
   if(this.rowsFor(flow).length)this.flows.push(flow);
  };
  for(const [id,ref]of Object.entries(this.views.outside))add(id,ref);
  for(const [id,ref]of Object.entries(this.views.campaign.scenes))add(id,ref,['johnny','terraceMemory','terraceMemory3'].includes(id)?'회상 / 컷씬':'테라스 / 연결 대화');
  for(const extra of extraChoices){add(extra.id,{source:'script/street',scene:extra.scene,branch:extra.branch,offset:0},extra.group,true);const f=this.flow(extra.id);if(f)Object.assign(f,extra,{onlyChoices:true,campaign:false});}
  this.answerParent=this.flow('newspaper/options')?.parent;
  this.refreshChoiceFlows();
  return this;
 }
 snapshot(){return{...super.snapshot(),placement:clone(this.placement||Place.empty())};}
 restore(s){super.restore(s);this.placement=clone(s.placement||Place.empty());}
 dirty(){return super.dirty()||JSON.stringify(this.placement)!==JSON.stringify(this.base.placement);}
 setPlacement(id,x){Place.write(this.placement,id,x);}
 // A chart is a synchronous read transaction. Never retain indexes across an
 // edit/undo, which may replace whole CSV rows or deliberately change a parent.
 withReadIndex(read){
  if(this.readIndex)return read();
  const byParent=new Map(),byId=new Map();
  for(const row of this.tables.steps){
   let bucket=byParent.get(row.parent_id);if(!bucket)byParent.set(row.parent_id,bucket=[]);bucket.push(row);
  }
  for(const f of this.flows)if(!byId.has(f.id))byId.set(f.id,f);
  this.readIndex={byParent,byId,choices:new Set(this.tables.street_choices.map(c=>c.parent_id)),rows:new Map()};
  try{return read();}finally{this.readIndex=null;}
 }
 flow(id){return this.readIndex?this.readIndex.byId.get(id):this.flows.find(f=>f.id===id);}
 rowsFor(f){
  const index=this.readIndex;
  if(index?.rows.has(f))return index.rows.get(f);
  const all=index?(index.byParent.get(f.parent)||[]).slice():this.tables.steps.filter(r=>r.parent_id===f.parent);
  const rows=all.sort((a,b)=>+a.source_order-+b.source_order).slice(f.offset).filter(r=>
   f.onlyChoices?(index?index.choices.has(r.row_id):this.tables.street_choices.some(c=>c.parent_id===r.row_id)):!r.row_id.startsWith('exterior_editor_visit_')&&(!!decode(r['web_fields.type'])||!!decode(r.web_core_keys)||Projection.optionalPresentation(r).type==='shop-allowance-grant'));
  if(index)index.rows.set(f,rows);return rows;
 }
 rows(id){const f=this.flow(id);return f?this.rowsFor(f):[];}
 choices(id){return this.tables.street_choices.filter(c=>c.parent_id===id).sort((a,b)=>+a.source_order-+b.source_order);}
 kind(row){return Projection.optionalPresentation(row).type||decode(row['web_fields.type'])||row.type;}
 canEdit(row,key,flow){if(!row)return false;if(this.tables.street_choices.includes(row))return ['text.ko','text.en','when','lock_reason.ko','lock_reason.en'].includes(key)&&(Object.hasOwn(flow?.links||{},row.id)||Object.values(this.views.outsideChoiceEdits||{}).some(c=>c.active.includes(row.row_id)));
  if(Nodes.shapeOf(flow)&&key==='actor'&&row?.type==='choice')return true;
  if(Nodes.shapeOf(flow)&&this.rows(flow.id).includes(row)&&['text.ko','text.en'].includes(key)&&row.type==='popup')return true;
  if(key==='actor'&&this.projected?.data.outsideAmbient[flow?.ref?.scene]?.sourceId==='home_tv_broadcast')return false;
  if(row.parent_id==='shared_home_book'&&key==='actor')return false;
  if(row.row_id==='shared_home_wardrobe_choice'&&['text.ko','text.en','actor'].includes(key))return false; // The preceding say is the CSV prompt.
  if(key==='text.ko'&&this.flows.some(f=>f.onlyChoices&&this.rows(f.id).includes(row)))return true;
  if(['text.ko','text.en'].includes(key))return (row.web_core_keys||'').split('|').includes(key==='text.ko'?'text':'en')&&['say','timeline'].includes(this.kind(row))||key==='text.ko'&&(row.web_core_keys||'').split('|').includes('text');
  return key==='actor'&&row.parent_id!==this.answerParent&&(row.web_core_keys||'').split('|').includes('actor')&&this.kind(row)==='say';
 }
 set(row,key,value){if(['text.ko','text.en'].includes(key))value=value.replace(/[\u2026\u22ef]/g,'...');super.set(row,key,value);}
 step(row){const extra=this.flows?.find(f=>f.onlyChoices&&this.rows(f.id).some(r=>r.row_id===row.row_id));const type=extra?(extra.id==='choices/stock'?'shop-choice':'notion-choice'):this.kind(row),stage=extra?(extra.id==='choices/stock'?'items':extra.id==='choices/info'?'topic':'payment'):decode(row['web_fields.stage']);return {...super.step(row),...extra&&!this.views.outsideChoiceEdits?.[row.row_id]?{'text.ko':decode(row['text.ko'])||Author.prompt({type,stage})}:null,editorRowId:row.row_id,type,who:this.views.outsideChoiceEdits?.[row.row_id]?.who||decode(row['web_fields.who'])||decode(row.who),actor:Projection.optionalPresentation(row).actor||decode(row.actor),action:Projection.optionalPresentation(row).action||decode(row['web_fields.action']),cinema:decode(row['web_fields.cinemaAfter']),stage,topic:extra?.id.startsWith('choices/pay-')?extra.id.slice(12):undefined};}
 plain(row){return row.parent_id!=='shared_home_book'&&row.parent_id!==this.answerParent&&this.kind(row)==='say'&&!Projection.optionalPresentation(row).action&&!decode(row['web_fields.action'])&&!decode(row['web_fields.cinemaAfter'])&&!decode(row.effects)&&![...this.catalog.rawTables.values()].flat().some(r=>r.parent_id===row.row_id);}
 // Remember the visible six-line breaks before an edit; the game still reads the original CSV sequence.
 forgetTalkCards(removed){
  const all=this.views.outsideEditorBreaks;if(!all)return;
  for(const [parent,heads] of Object.entries(all)){if(removed.has(parent))delete all[parent];else all[parent]=heads.filter(id=>!removed.has(id));}
 }
 talkCardErrors(){
  const all=this.views.outsideEditorBreaks;if(all===undefined)return [];
  if(!all||typeof all!=='object'||Array.isArray(all))return ['외부 대사 노드 경계 형식이 올바르지 않습니다.'];
  const parents=new Set(this.flows.map(f=>f.parent)),rows=new Map(this.tables.steps.map(r=>[r.row_id,r.parent_id]));
  return Object.entries(all).filter(([p,ids])=>!parents.has(p)||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>rows.get(id)!==p)).map(([p])=>'외부 대사 노드가 다른 대본의 줄을 가리킵니다: '+p);
 }
 rememberTalkCards(f){
  const all=this.views.outsideEditorBreaks??={};
  if(!Object.hasOwn(all,f.parent)){
   const map=browser?root.LunaOutsideFlowMap:require('./outside-flow-map.js');
   const g=map.graph(this,map.site(this,f).id);
   all[f.parent]=g.nodes.filter(n=>['talk','join'].includes(n.kind)&&n.rows[0].parent_id===f.parent).map(n=>n.rows[0].row_id);
  }
  return all[f.parent];
 }
 add(flowId,index,duplicate=null){const f=this.flow(flowId);if(f.onlyChoices)throw Error('기존 분기의 문구·조건만 수정할 수 있습니다.');const seq=this.rows(flowId),near=seq[index-1]||seq[index],source=duplicate||(near&&this.plain(near)?near:seq.find(r=>this.plain(r)));if(!source||!this.plain(source))throw Error('연출·하위 데이터가 없는 일반 대사만 추가·복제할 수 있습니다.');
  const breaks=this.rememberTalkCards(f),first=this.rows(flowId)[0]?.row_id;
  const r=clone(source),id='exterior_editor_'+globalThis.crypto.randomUUID().replaceAll('-','');Object.assign(r,{row_id:id,web_row_id:decode(r.web_row_id)?id:'',dialogue_id:'dlg_'+id});if(!duplicate){r['text.ko']='새 대사';r['text.en']='';}
  if(index===0&&breaks.includes(first))breaks[breaks.indexOf(first)]=id;
  const spec=this.views.tables.steps.rows.find(s=>s.id===source.web_row_id);if(spec)this.views.tables.steps.rows.push({...clone(spec),id});
  this.tables.steps.push(r);const ids=this.rows(flowId).filter(x=>x!==r).map(x=>x.row_id);ids.splice(index,0,id);this.reorder(flowId,ids);return r;
 }
 reorder(flowId,ids){const f=this.flow(flowId),visible=this.rows(flowId),all=this.tables.steps.filter(r=>r.parent_id===f.parent).sort((a,b)=>+a.source_order-+b.source_order);if(f.parent===this.answerParent)throw Error('정답·오답에 연결된 답변 순서는 고정입니다.');if(ids.length!==visible.length||new Set(ids).size!==ids.length||ids.some(id=>!visible.some(r=>r.row_id===id)))throw Error('줄 순서가 맞지 않습니다.');let i=0;const ordered=all.map(r=>visible.includes(r)?this.row(ids[i++]):r);ordered.forEach((r,i)=>{r.source_order=String(i);r.seq=String(i+1);});}
 remove(flowId,id){const r=this.row(id);if(!this.plain(r))throw Error('연출·분기 연결 행은 삭제하지 않습니다.');if(this.rows(flowId).length<=1)throw Error('대사를 한 줄 이상 남겨 주세요.');const seq=this.rows(flowId),breaks=this.rememberTalkCards(this.flow(flowId)),at=breaks.indexOf(id),after=seq[seq.indexOf(r)+1]?.row_id;if(at>=0)breaks.splice(at,1,...(after&&!breaks.includes(after)?[after]:[]));this.tables.steps=this.tables.steps.filter(x=>x!==r);this.views.tables.steps.rows=this.views.tables.steps.rows.filter(s=>!r.web_row_id||s.id!==r.web_row_id);this.reorder(flowId,this.rows(flowId).map(r=>r.row_id));}
 output(){const files={};if(JSON.stringify(this.placement)!==JSON.stringify(this.base.placement))files[Place.file]=JSON.stringify(this.placement,null,2)+'\n';for(const [table,path]of Object.entries(paths))if(JSON.stringify(this.tables[table])!==JSON.stringify(this.base.tables[table]))files[path]=(this.files[path].startsWith('\uFEFF')?'\uFEFF':'')+Base.csv(this.headers[table],this.tables[table]);if(JSON.stringify(this.views)!==JSON.stringify(this.base.views))files['web-views.json']=JSON.stringify(this.views,null,2)+'\n';return files;}
 changes(){const changes=[];for(const id of Object.keys(Place.specs)){const s=Place.specs[id],a=this.base.placement.positions[id]||s,b=this.placement.positions[id]||s;if(a.x!==b.x)changes.push({table:'view',id:s.label,key:'씬 배치 X / Y',kind:'위치',before:a.x+' / '+a.y,after:b.x+' / '+b.y});}for(const table of Object.keys(paths)){const before=new Map(this.base.tables[table].map(r=>[r.row_id,r]));for(const r of this.tables[table]){const b=before.get(r.row_id);if(!b)changes.push({table,id:r.row_id,kind:'추가',after:r['text.ko']});else for(const k of Object.keys(r))if(r[k]!==b[k])changes.push({table,id:r.row_id,kind:'수정',key:k,before:decode(b[k]),after:decode(r[k])});before.delete(r.row_id);}for(const r of before.values())changes.push({table,id:r.row_id,kind:'삭제',before:r['text.ko']});}return changes;}
 async validate(){const errors=this.talkCardErrors();let result;try{Place.validate(this.placement);const files={...this.files,...this.output()},cat=await Csv.load(p=>Promise.resolve(files[p]));result=Projection.project(cat,this.views,this.presentation);}catch(e){return{errors:[e.message]};}
  const baseline=new Map([...this.base.tables.steps,...this.base.tables.street_choices].map(r=>[r.row_id,r]));for(const change of this.changes()){if(change.table==='view'||change.table==='scenes')continue;const row=this.tables[change.table].find(r=>r.row_id===change.id)||baseline.get(change.id);const flow=this.flows.find(f=>this.rows(f.id).some(x=>x.row_id===(change.table==='steps'?row.row_id:row.parent_id)));
   const migration=change.table==='steps'&&Object.values(this.views.outsideChoiceEdits||{}).some(c=>c.stepId===row.row_id)&&['template_id','web_fields.who','text'].includes(change.key);
   const jump=change.table==='steps'&&change.key==='scene_id'&&(this.safeJump(row)||Nodes.isLink(row));
   const native=Nodes.isLink(row)&&change.key==='when'||Nodes.shapeOf(flow)&&row.type==='effect'&&['effects','when'].includes(change.key);
   if(change.kind==='수정'&&!jump&&!native&&!migration&&!['source_order','seq','web_fields.who'].includes(change.key)&&(!flow||!this.canEdit(row,change.key,flow)))errors.push('현재 실행기에서 저장할 수 없는 항목: '+change.id+' / '+change.key);
   if(change.key==='when')try{for(const part of decode(row.when).split('&&'))conditions.condition(part,{money:1000,day:1,flags:{},affinity:{}});}catch(e){errors.push(e.message);}
   if(change.kind==='수정'&&row.parent_id===this.answerParent&&['source_order','seq'].includes(change.key))errors.push('정답·오답에 연결된 답변 순서는 고정입니다.');
   if((change.kind==='추가'?['text.ko','text.en']:change.key?.startsWith('text.')?[change.key]:[]).some(key=>/[<>]/.test(decode(row[key]))))errors.push('외부 대사에는 아직 텍스트 효과 태그를 저장할 수 없습니다. 일반 텍스트를 사용하세요.');
  }
  for(const row of [...this.tables.steps,...this.tables.street_choices])errors.push(...Base.engineExpressionErrors(row,baseline.get(row.row_id)));
  for(const row of this.tables.steps)if(row['web_fields.type']==='editor-choice')errors.push('editor-choice는 엔진 미지원 타입입니다. 기존 choice 구조를 사용하세요.');
  errors.push(...Nodes.validate(this),...this.validateMenus());const warnings=errors.length?[]:(browser?root.LunaChoiceParity:require('./choice-parity.js')).compare(this,result);
  // A warning is not permission to publish different branches to the engine.
  for(const warning of warnings)errors.push('엔진과 다른 선택지 연결은 저장할 수 없습니다. 기존 구조로 연결하거나 변경 승인을 요청하세요. '+warning);
  return{errors:[...new Set(errors)],warnings,result};
 }
}
(browser?root.LunaOutsideWiring:require('./outside-wiring.js')).install(Model);
(browser?root.LunaOutsideChoiceModel:require('./outside-choice-model.js')).install(Model);
Nodes.install(Model);
const api={Model,paths,labels,suffix,choiceLinks,extraChoices,condition:conditions.condition};if(browser)root.LunaOutsideEditorModel=api;else module.exports=api;
})(typeof window==='undefined'?globalThis:window);

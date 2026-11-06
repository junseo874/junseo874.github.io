/* Exterior authoring is deliberately limited to fields the existing CSV/runtime consumes. */
(function(root){
'use strict';
const browser=typeof module==='undefined';
const Base=browser?root.LunaDialogueEditorModel:require('./editor-model.js');
const Csv=browser?root.LunaCsv:require('../../shared/data/csv-catalog.js');
const Projection=browser?root.LunaRuntimeProjection:require('../../shared/data/runtime-projection.js');
const conditions=(browser?root.LunaRuleParts.conditions:require('../../core/story-conditions.js'))({GRADES:[],n:(v,d=0)=>Number(v)||d,root:{}});
const paths={steps:'story/steps.csv',street_choices:'story/street_choices.csv'};
const decode=Base.decode,clone=x=>JSON.parse(JSON.stringify(x));
const labels={believer:'기신교 신도',newspaper:'신문 읽는 남자',ambient:'거리 배경 대화 / TV',thug:'1일차 복도 불량배',notion:'정보 행인 / 삼호',shop:'개시바 상점',beggar:'노숙자 / 정보 행인',neighborhood:'부비 / 수리공 / 갱단',home:'집 오브젝트',night0:'0일차 테라스',night1:'1일차 테라스',night2:'2일차 테라스',ending:'3일차 테라스',johnny:'조니와 톰의 기억',terraceMemory:'0일차 유나의 기억',terraceMemory3:'3일차 유나의 기억',workshop:'크리스·포트 작업실 (보관)',commute2:'2일차 출근 · 삼호',commute3:'3일차 출근 · 삼호',prologue:'게임 도입 · 크리스 연락'};
const suffix={intro:'첫 대화',finish:'마무리',repeat:'반복 대화',options:'답변 선택지',wrong:'오답 분기',right:'정답 분기',common:'공통 합류',paid:'지불 후',refused:'거절 후',revisit:'재방문',allowance:'용돈',quizIntro:'퀴즈 도입',lesson:'칵테일 설명',reveal:'부비 발견',feed:'참치캔 / 입양',rest:'부비 입양 후 휴식',homeCat:'집에서 부비',cat:'거리에서 부비',repairGreeting:'수리공 인사',repairIntro:'수리공 첫 대화',repairMenu:'수리 선택',repairPaid:'수리 완료',guardBlocked:'갱단 길막',guardMenu:'갱단 질문',guardPass:'갱단 통과',bossIntro:'갱단 보스 첫 대화',bossWait:'거래 취소',bossRepeat:'보스 재대화',bossRepairFirst:'수리 보상 · 첫 대화',bossPayFirst:'유료 구매 · 첫 대화',bossRepairRepeat:'수리 보상 · 재대화',bossPayRepeat:'유료 구매 · 재대화',bossDone:'거래 후',wardrobe:'옷장',wardrobePressed:'옷장 버튼',bed:'침대',contract:'삼호 계약 종료'};
Object.assign(suffix,{'warning/unmet':'정보 행인 · 노숙자 만나기 전','warning/met':'정보 행인 · 노숙자 만난 후','warning/paid':'정보 행인 · 돈을 준 후','warning/unpaid-repeat':'정보 행인 · 미지불 반복','warning/paid-repeat':'정보 행인 · 지불 후 반복',questioned:'노숙자에게 따져 묻기','info/gang':'갱 정보','info/coratech':'코라테크 정보','info/chris':'크리스 정보',outside_day0_store_passers:'0일차 · 편의점 앞 행인',outside_day0_building_residents:'0일차 · 상층 주민',outside_day0_port_pair:'0일차 · 바 앞 행인',outside_day1_samho_smuggler:'1일차 · 삼호와 밀수업자',outside_day0_shiba_wanted:'0일차 · 시바 수배 전단',outside_day0_tv_news1:'0일차 · TV 뉴스',outside_day1_tv_news2:'1일차 · TV 뉴스',outside_day1_commute_passers2:'1일차 · 출근길 행인',outside_day2_commute_reopening:'2일차 · 바 재개점 소문'});
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
 constructor(files,presentation){super(files,presentation);this.tables={};this.headers={};for(const [name,path]of Object.entries(paths)){this.tables[name]=Csv.parseRows(files[path],path);this.headers[name]=Csv.parseCsv(files[path])[0];}this.rawScenes=Csv.parseRows(files['story/scenes.csv']);this.base=this.snapshot();}
 async init(){this.catalog=await Csv.load(p=>Promise.resolve(this.files[p]));this.projected=Projection.project(this.catalog,this.views,this.presentation);this.flows=[];
  const add=(id,ref,category,onlyChoices=false)=>{const scene=this.rawScenes.find(s=>s.id===ref.scene&&s.dataset_id===ref.source);if(!scene)return;
   let parent=scene.row_id;if(ref.branch){const choices=this.tables.street_choices.filter(c=>c.id===ref.branch&&c.dataset_id===ref.source);const under=(id)=>{let r=this.tables.steps.find(r=>r.row_id===id)||this.tables.street_choices.find(r=>r.row_id===id);return r&&(r.parent_id===scene.row_id||under(r.parent_id));};const c=choices.find(c=>under(c.parent_id));if(!c)return;parent=c.row_id;}
   const [family,...rest]=id.split('/'),title=labels[id]||suffix[rest.join('/')]||rest.join(' / ')||id;
   const flow={id,ref,parent,group:category||labels[family]||'기타 대화',title,offset:ref.offset||0,links:choiceLinks[id]||{},campaign:!!category,onlyChoices};
   if(this.rowsFor(flow).length)this.flows.push(flow);
  };
  for(const [id,ref]of Object.entries(this.views.outside))add(id,ref);
  for(const [id,ref]of Object.entries(this.views.campaign.scenes))add(id,ref,['johnny','terraceMemory','terraceMemory3'].includes(id)?'회상 / 컷씬':'테라스 / 연결 대화');
  add('prologue',this.views.campaign.prologue,'도입 / 연락');
  for(const extra of extraChoices){add(extra.id,{source:'script/street',scene:extra.scene,branch:extra.branch,offset:0},extra.group,true);const f=this.flow(extra.id);if(f)Object.assign(f,extra,{onlyChoices:true,campaign:false});}
  this.answerParent=this.flow('newspaper/options')?.parent;
  return this;
 }
 flow(id){return this.flows.find(f=>f.id===id);}
 rowsFor(f){const all=this.tables.steps.filter(r=>r.parent_id===f.parent).sort((a,b)=>+a.source_order-+b.source_order);return all.slice(f.offset).filter(r=>f.onlyChoices?this.tables.street_choices.some(c=>c.parent_id===r.row_id):!!decode(r['web_fields.type'])||!!decode(r.web_core_keys));}
 rows(id){const f=this.flow(id);return f?this.rowsFor(f):[];}
 choices(id){return this.tables.street_choices.filter(c=>c.parent_id===id).sort((a,b)=>+a.source_order-+b.source_order);}
 kind(row){return Projection.optionalPresentation(row).type||decode(row['web_fields.type'])||row.type;}
 canEdit(row,key,flow){if(!row)return false;if(this.tables.street_choices.includes(row))return ['text.ko','text.en','when','lock_reason.ko','lock_reason.en'].includes(key)&&(Object.hasOwn(flow?.links||{},row.id)||Object.values(this.views.outsideChoiceEdits||{}).some(c=>c.active.includes(row.row_id)));
  if(key==='text.ko'&&this.flows.some(f=>f.onlyChoices&&this.rows(f.id).includes(row)))return true;
  if(['text.ko','text.en'].includes(key))return (row.web_core_keys||'').split('|').includes(key==='text.ko'?'text':'en')&&['say','timeline'].includes(this.kind(row))||key==='text.ko'&&(row.web_core_keys||'').split('|').includes('text');
  return key==='actor'&&row.parent_id!==this.answerParent&&(row.web_core_keys||'').split('|').includes('actor')&&this.kind(row)==='say';
 }
 set(row,key,value){if(['text.ko','text.en'].includes(key))value=value.replace(/[\u2026\u22ef]/g,'...');super.set(row,key,value);}
 step(row){const extra=this.flows?.find(f=>f.onlyChoices&&this.rows(f.id).some(r=>r.row_id===row.row_id));const type=extra?(extra.id==='choices/stock'?'shop-choice':'notion-choice'):this.kind(row),stage=extra?(extra.id==='choices/stock'?'items':extra.id==='choices/info'?'topic':'payment'):decode(row['web_fields.stage']);return {...super.step(row),...extra&&!this.views.outsideChoiceEdits?.[row.row_id]?{'text.ko':decode(row['text.ko'])||(stage==='items'?'전부 다 보여 주긴 싫고, 몇 개만 보여 줄게.':stage==='topic'?'왜, 물어볼 거라도 있어?':'맨입으로는 나도 어렵고. 50원만 줘봐. 아는 만큼 알려주지.')}:null,editorRowId:row.row_id,type,who:this.views.outsideChoiceEdits?.[row.row_id]?.who||decode(row['web_fields.who'])||decode(row.who),action:decode(row['web_fields.action']),cinema:decode(row['web_fields.cinemaAfter']),stage,topic:extra?.id.startsWith('choices/pay-')?extra.id.slice(12):undefined};}
 plain(row){return row.parent_id!==this.answerParent&&this.kind(row)==='say'&&!decode(row['web_fields.cinemaAfter'])&&!decode(row.effects)&&![...this.catalog.rawTables.values()].flat().some(r=>r.parent_id===row.row_id);}
 add(flowId,index,duplicate=null){const f=this.flow(flowId);if(f.onlyChoices)throw Error('기존 분기의 문구·조건만 수정할 수 있습니다.');const source=duplicate||this.rows(flowId).find(r=>this.plain(r));if(!source||!this.plain(source))throw Error('연출·하위 데이터가 없는 일반 대사만 추가·복제할 수 있습니다.');
  const r=clone(source),id='exterior_editor_'+globalThis.crypto.randomUUID().replaceAll('-','');Object.assign(r,{row_id:id,web_row_id:decode(r.web_row_id)?id:'',dialogue_id:'dlg_'+id});if(!duplicate){r['text.ko']='새 대사';r['text.en']='';}
  const spec=this.views.tables.steps.rows.find(s=>s.id===source.web_row_id);if(spec)this.views.tables.steps.rows.push({...clone(spec),id});
  this.tables.steps.push(r);const ids=this.rows(flowId).filter(x=>x!==r).map(x=>x.row_id);ids.splice(index,0,id);this.reorder(flowId,ids);return r;
 }
 reorder(flowId,ids){const f=this.flow(flowId),visible=this.rows(flowId),all=this.tables.steps.filter(r=>r.parent_id===f.parent).sort((a,b)=>+a.source_order-+b.source_order);if(f.parent===this.answerParent)throw Error('정답·오답에 연결된 답변 순서는 고정입니다.');if(ids.length!==visible.length||new Set(ids).size!==ids.length||ids.some(id=>!visible.some(r=>r.row_id===id)))throw Error('줄 순서가 맞지 않습니다.');let i=0;const ordered=all.map(r=>visible.includes(r)?this.row(ids[i++]):r);ordered.forEach((r,i)=>{r.source_order=String(i);r.seq=String(i+1);});}
 remove(flowId,id){const r=this.row(id);if(!this.plain(r))throw Error('연출·분기 연결 행은 삭제하지 않습니다.');if(this.rows(flowId).length<=1)throw Error('대사를 한 줄 이상 남겨 주세요.');this.tables.steps=this.tables.steps.filter(x=>x!==r);this.views.tables.steps.rows=this.views.tables.steps.rows.filter(s=>!r.web_row_id||s.id!==r.web_row_id);this.reorder(flowId,this.rows(flowId).map(r=>r.row_id));}
 output(){const files={};for(const [table,path]of Object.entries(paths))if(JSON.stringify(this.tables[table])!==JSON.stringify(this.base.tables[table]))files[path]=(this.files[path].startsWith('\uFEFF')?'\uFEFF':'')+Base.csv(this.headers[table],this.tables[table]);if(JSON.stringify(this.views)!==JSON.stringify(this.base.views))files['web-views.json']=JSON.stringify(this.views,null,2)+'\n';return files;}
 changes(){const changes=[];for(const table of Object.keys(paths)){const before=new Map(this.base.tables[table].map(r=>[r.row_id,r]));for(const r of this.tables[table]){const b=before.get(r.row_id);if(!b)changes.push({table,id:r.row_id,kind:'추가',after:r['text.ko']});else for(const k of Object.keys(r))if(r[k]!==b[k])changes.push({table,id:r.row_id,kind:'수정',key:k,before:decode(b[k]),after:decode(r[k])});before.delete(r.row_id);}for(const r of before.values())changes.push({table,id:r.row_id,kind:'삭제',before:r['text.ko']});}return changes;}
 async validate(){const errors=[];let result;try{const files={...this.files,...this.output()},cat=await Csv.load(p=>Promise.resolve(files[p]));result=Projection.project(cat,this.views,this.presentation);}catch(e){return{errors:[e.message]};}
  const baseline=new Map([...this.base.tables.steps,...this.base.tables.street_choices].map(r=>[r.row_id,r]));for(const change of this.changes()){if(change.table==='view')continue;const row=this.tables[change.table].find(r=>r.row_id===change.id)||baseline.get(change.id);const flow=this.flows.find(f=>this.rows(f.id).some(x=>x.row_id===(change.table==='steps'?row.row_id:row.parent_id)));
   const migration=change.table==='steps'&&Object.values(this.views.outsideChoiceEdits||{}).some(c=>c.stepId===row.row_id)&&['template_id','web_fields.who','text'].includes(change.key);
   if(change.kind==='수정'&&!migration&&!['source_order','seq','web_fields.who'].includes(change.key)&&(!flow||!this.canEdit(row,change.key,flow)))errors.push('현재 실행기에서 저장할 수 없는 항목: '+change.id+' / '+change.key);
   if(change.key==='when')try{for(const part of decode(row.when).split('&&'))conditions.condition(part,{money:1000,day:1,flags:{},affinity:{}});}catch(e){errors.push(e.message);}
   if(change.kind==='수정'&&row.parent_id===this.answerParent&&['source_order','seq'].includes(change.key))errors.push('정답·오답에 연결된 답변 순서는 고정입니다.');
   if((change.kind==='추가'?['text.ko','text.en']:change.key?.startsWith('text.')?[change.key]:[]).some(key=>/[<>]/.test(decode(row[key]))))errors.push('외부 대사에는 아직 텍스트 효과 태그를 저장할 수 없습니다. 일반 텍스트를 사용하세요.');
  }errors.push(...this.validateMenus());const warnings=errors.length?[]:(browser?root.LunaChoiceParity:require('./choice-parity.js')).compare(this,result);return{errors:[...new Set(errors)],warnings,result};
 }
}
(browser?root.LunaOutsideChoiceModel:require('./outside-choice-model.js')).install(Model);
const api={Model,paths,labels,suffix,choiceLinks,extraChoices,condition:conditions.condition};if(browser)root.LunaOutsideEditorModel=api;else module.exports=api;
})(typeof window==='undefined'?globalThis:window);

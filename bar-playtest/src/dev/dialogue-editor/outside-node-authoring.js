/* Independent nodes are ordinary manual Street/Home scenes. Wires are native
   goto rows; choices own result_steps. Nothing dispatches from canvas positions. */
(function(W){'use strict';
const browser=typeof module==='undefined',MapUI=()=>browser?W.LunaOutsideFlowMap:require('./outside-flow-map.js');
const kinds={talk:['대화','대화','“'],repeat:['반복 대화','상호작용','↻'],choice:['선택지','분기','⑂'],condition:['조건 분기','분기','◇'],join:['공통 합류','대화','↳'],effect:['플래그 변경','사건','⚑'],notice:['알림 표시','사건','▤']};
const shape=/^graph_([a-z][a-z0-9-]*)_(talk|repeat|choice|condition|join|effect|notice)_([a-f0-9]{32})$/;
const id=()=>crypto.randomUUID().replaceAll('-',''),clean=x=>!x||x==='\\N'||x==='\\E'?'':x,world=s=>['script/street','script/home'].includes(s),isLink=r=>/^exterior_editor_link_[a-f0-9]{32}$/.test(r?.row_id||'');
const dedicated={newspaper:['newspaper/repeat'],beggar:['beggar/repeat'],witness:['beggar/warning/unpaid-repeat','beggar/warning/paid-repeat'],shop:['shop/revisit'],boss:['neighborhood/bossRepeat'],repair:['neighborhood/repairMenu']};
const recurring={cat:['neighborhood/cat'],guard:['neighborhood/guardBlocked','neighborhood/guardMenu'],'home-cat':['neighborhood/homeCat'],room:['home/bed','home/wardrobe']};
const register=(m,r)=>m.tables.steps.push(r),all=(m,parent)=>m.tables.steps.filter(r=>r.parent_id===parent).sort((a,b)=>+a.source_order-+b.source_order);
function resequence(rows){rows.forEach((r,i)=>{r.seq=String(i+1);r.source_order=String(i);});}
function blankRow(m,table,fields){return Object.assign(Object.fromEntries(m.headers[table].map(k=>[k,''])),fields);}
function step(m,f,type,fields={}){const uuid='exterior_editor_'+id();return blankRow(m,'steps',{row_id:uuid,dataset_id:f.ref.source,context:f.ref.scene,parent_id:f.parent,parent_field:'steps',source_order:'0',seq:'1',type,template_id:'steps_format_30',actor:'luna',sync:'wait','web_fields.type':type,web_core_keys:'actor|text',...fields});}
function linkRow(m,f,parent,field,target,when=''){return blankRow(m,'steps',{row_id:'exterior_editor_link_'+id(),dataset_id:f.ref.source,context:f.ref.scene,parent_id:parent,parent_field:field,source_order:'0',seq:'1',type:'goto',template_id:'steps_format_60',scene_id:target.ref.scene,when});}
const refKey=scene=>'graph/'+scene;
function shapeOf(f){return !f?.ref?.branch&&shape.exec(f?.ref?.scene||'');}
function scope(m,f){return MapUI().site(m,f).id;}
function repeatEntries(m,f){const site=scope(m,f),source=shapeOf(f)?null:f;return (dedicated[site]||recurring[site]||[]).filter(k=>site!=='room'||!source||source.id===k).map(k=>m.flow(k)).filter(Boolean);}
function graphView(m,f){const n=shapeOf(f);return n&&{site:n[1],kind:n[2]};}
function rebuild(m){
 if(!m.flows)return;m.flows=m.flows.filter(f=>!f.id.startsWith('graph/'));
 for(const r of m.tables.scenes){const k=shape.exec(r.id);if(!k)continue;const key=refKey(r.id),ref=m.views.outside[key];if(!ref)continue;
  m.flows.push({id:key,ref,parent:r.row_id,group:'작성한 노드',title:clean(r.title)||clean(r['title.ko'])||kinds[k[2]][0],offset:0,links:{},campaign:false,onlyChoices:false});}
}
function newNode(m,owner,type,{title,actor,text,condition,effect,day}={}){
 if(!world(owner?.ref.source)||!kinds[type])throw Error('거리·집 상호작용의 NPC를 선택하세요.');const site=scope(m,owner);
 if(owner.campaign||site==='other')throw Error('이 대본은 거리·집의 독립 NPC 대화가 아닙니다.');
 if(type==='repeat'&&!repeatEntries(m,owner).length)throw Error('현재 이 인물은 재대화 진입점이 없습니다. 일회성 사건을 반복해서 보상하지 않습니다.');
 const home=owner.ref.source==='script/home',key='graph_'+site+'_'+type+'_'+id(),label=(title||kinds[type][0]).trim(),parent=m.rawScenes.find(s=>s.id===owner.ref.scene&&s.dataset_id===owner.ref.source);
 if(!parent||!label||label.length>64)throw Error('노드 이름은 1~64자로 입력하세요.');
 const createdDay=day??(browser?W.LunaOutsideFlowDays:require('./outside-flow-days.js')).index(m).days(owner)[0];
 if(!/^[0-3]$/.test(String(createdDay)))throw Error('노드를 만들 0~3일차를 먼저 선택하세요.');
 const siblings=m.tables.scenes.filter(s=>s.dataset_id===owner.ref.source),r=blankRow(m,'scenes',{id:key,row_id:'scenes_'+key,dataset_id:owner.ref.source,parent_id:parent.parent_id,parent_field:'scenes',template_id:home?'scenes_format_09':'scenes_format_19',phase:home?'home':'street',day:String(createdDay),seq:String(Math.max(0,...siblings.map(s=>+s.seq))+1),source_order:String(Math.max(-1,...siblings.map(s=>+s.source_order))+1),start_mode:'manual',[home?'title.ko':'title']:label});
 m.tables.scenes=[...m.tables.scenes,r];m.views.outside[refKey(key)]={source:r.dataset_id,scene:key,offset:0};rebuild(m);const f=m.flow(refKey(key)),a=actor||'luna';
 const line=step(m,f,type==='choice'?'choice':type==='notice'?'popup':['effect','condition'].includes(type)?'effect':'say',{actor:a,'text.ko':text||(['talk','join','repeat'].includes(type)?'새 대사':type==='notice'?'새 알림':''),...type==='choice'?{template_id:'steps_format_62'}:{},...type==='notice'?{arg:'event_occurred',sync:'nowait','web_fields.type':'',web_core_keys:'actor|text|arg'}:{},...type==='condition'?{when:condition||'true'}:{},...type==='effect'?{effects:effect||''}:{}});
 register(m,line);if(type==='choice'){m.addMenuOption(line);m.addMenuOption(line);}return f;
}
function targetOf(m,j){return j&&m.flows.find(f=>!f.ref.branch&&!f.ref.offset&&f.ref.scene===j.scene_id&&f.ref.source===j.dataset_id);}
function nodeLinks(m,f){const q=m.rows(f.id),ids=new Set(q.map(r=>r.row_id)),parents=new Set([f.parent,...m.tables.street_choices.filter(o=>ids.has(o.parent_id)).map(o=>o.row_id)]);return m.tables.steps.filter(r=>isLink(r)&&parents.has(r.parent_id));}
function reachable(m,from,want,seen=new Set()){if(from.id===want.id)return true;if(seen.has(from.id))return false;seen.add(from.id);return nodeLinks(m,from).some(r=>{const to=targetOf(m,r);return to&&reachable(m,to,want,seen);});}
function tailPin(m,n){
 const f=m.flow(n.owner||n.flow),last=n.rows.at(-1);if(!f||f.onlyChoices||f.campaign||!world(f.ref.source)||f.id==='home/book'||!last||m.isMenu(last))return false;
 if(m.rows(f.id).at(-1)!==last)return false;
 if(shapeOf(f))return true;
 if(f.id.startsWith('newspaper/')&&!['newspaper/finish','newspaper/repeat'].includes(f.id))return false; // never bypass the shared reward
 if(m.kind(last)!=='say'||m.step(last).cinema)return false;
 const items=all(m,f.parent).filter(r=>!isLink(r)),i=items.indexOf(last);
 // Append AFTER any hidden native completion flags, never before a transaction,
 // existing goto or a web-owned handoff to another menu.
 return i>=0&&items.slice(i+1).every(r=>r.type==='effect'&&!clean(r['web_fields.type']))&&
  !['notion/intro','shop/quizIntro','shop/quizRetry'].includes(f.id);
}
function writeLink(m,f,slot,to,option){
 let parent=option?.row_id||f.parent,children=all(m,parent),type=shapeOf(f)?.[2],condition=type==='condition'&&slot==='yes'?clean(m.rows(f.id)[0].when)||'true':'';
 const atHead=slot==='revisit',named=slot==='yes',match=j=>isLink(j)&&(slot==='revisit'?+j.source_order===0:slot==='yes'?!!clean(j.when):!clean(j.when)&&!(+j.source_order===0&&dedicated[scope(m,f)]?.includes(f.id)));
 const old=children.find(match);if(old){if(!to){m.tables.steps=m.tables.steps.filter(r=>r!==old);resequence(children.filter(r=>r!==old));return;}old.scene_id=to.ref.scene;old.when=condition;return;}
 if(!to)return;const j=linkRow(m,f,parent,option||f.ref.branch?'result_steps':'steps',to,condition);register(m,j);
 if(atHead)children.unshift(j);else if(named){const no=children.findIndex(r=>isLink(r)&&!clean(r.when));children.splice(no<0?children.length:no,0,j);}else children.push(j);resequence(children);
}
function wire(m,f,slot,to,option){
 if(to){if(!world(f.ref.source)||f.ref.source!==to.ref.source||scope(m,f)!==scope(m,to)||!shapeOf(to)&&!m.routeScene(to))throw Error('같은 NPC·대본의 독립 노드 또는 일반 대화 시작점에 연결하세요.');
  if(reachable(m,to,f))throw Error('같은 대화 안에서 순환하는 연결은 만들 수 없습니다. 재방문은 반복 대화 입력을 사용하세요.');}
 if(slot==='revisit'){
  if(to&&shapeOf(to)?.[2]!=='repeat')throw Error('재대화 시작은 반복 대화 노드에 연결하세요.');
  const entries=repeatEntries(m,f);if(!entries.length)throw Error('이 장면은 다시 말을 거는 상호작용이 아닙니다.');
  for(const entry of entries){if(to&&reachable(m,to,entry))throw Error('반복 진입점으로 되돌아가는 연결입니다.');}
  for(const entry of entries){
   if(dedicated[scope(m,f)]){writeLink(m,entry,'revisit',to);continue;}
   // A repeatable interaction with a single native entrance: conditional goto
   // on later visits, set the same native flag on the first interaction only.
   const flag='flag.graph_seen_'+entry.parent.replace(/[^a-zA-Z0-9_]/g,'_'),rows=all(m,entry.parent),old=rows.find(r=>isLink(r)&&r.when===flag),mark=rows.find(r=>r.row_id.startsWith('exterior_editor_visit_')&&r.effects===flag+' = true');
   if(old&&to){old.scene_id=to.ref.scene;continue;}if(!to){m.tables.steps=m.tables.steps.filter(r=>r!==old&&r!==mark);resequence(all(m,entry.parent));continue;}
   const j=linkRow(m,entry,entry.parent,'steps',to,flag),s=step(m,entry,'effect',{row_id:'exterior_editor_visit_'+id(),effects:flag+' = true',web_core_keys:'actor|effects'});register(m,j);register(m,s);resequence([j,s,...rows]);
  }return;
 }
 if(to&&shapeOf(to)?.[2]==='repeat')throw Error('반복 대화는 「재대화 시작」 핀에서 연결하세요.');
 if(slot==='option'){
  if(!option||!m.removableMenu(m.row(option.parent_id)))throw Error('본편 거래·보상의 선택지는 원래 실행 경로를 사용합니다.');
  const question=m.row(option.parent_id);if(to&&!shapeOf(f)&&all(m,f.parent).filter(r=>!isLink(r)).at(-1)!==question)throw Error('기존 사건 중간의 선택지는 뒤의 동작을 건너뛸 수 없습니다. 자체 후속 대사를 사용하거나 끝에 선택지를 추가하세요.');
  if(all(m,option.row_id).some(r=>!isLink(r)))throw Error('이미 자체 답변이 있습니다. 기존 답변을 먼저 확인하세요.');
  writeLink(m,f,slot,to,option);const q=m.row(option.parent_id);m.ensureMenu(q).routes[option.row_id]=to?'flow:'+to.id:'continue';return;
 }
 if(slot!=='next'&&!(shapeOf(f)?.[2]==='condition'&&['yes','no'].includes(slot)))throw Error('잘못된 출력 핀입니다.');
 if(!shapeOf(f)&&!tailPin(m,{owner:f.id,rows:[m.rows(f.id).at(-1)]}))throw Error('기본 사건의 남은 진행을 건너뛸 수 없습니다.');
 writeLink(m,f,slot,to);
}
function rename(m,f,title){
 const r=m.rawScenes.find(r=>r.row_id===f.parent),v=title.trim();if(!shapeOf(f)||!v||v.length>64)throw Error('이름은 1~64자로 입력하세요.');
 m.tables.scenes=m.tables.scenes.map(sc=>sc!==r?sc:{...r,[r.phase==='home'?'title.ko':'title']:v});rebuild(m);
}
function rule(m,f,flag,value){
 const kind=shapeOf(f)?.[2],r=m.rows(f.id)[0],valid=/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(flag)&&!/^(?:graph_seen_|bp_)/.test(flag);if(!['condition','effect'].includes(kind)||!valid||!['true','false'].includes(value))throw Error('목록에서 플래그와 값을 선택하세요.');
 if(kind==='effect')r.effects='flag.'+flag+' = '+value;else{r.when='flag.'+flag+' == '+value;for(const j of all(m,f.parent).filter(j=>isLink(j)&&j.when))j.when=r.when;}
}
function remove(m,f){
 if(!shapeOf(f))throw Error('직접 만든 독립 노드만 삭제할 수 있습니다.');
 const incoming=m.tables.steps.filter(r=>isLink(r)&&r.scene_id===f.ref.scene);
 for(const j of incoming){const flow=m.flows.find(k=>k.parent===j.parent_id&&!k.onlyChoices),opt=!flow&&m.tables.street_choices.find(o=>o.row_id===j.parent_id),parent=flow||(opt&&m.owner(opt.parent_id));
  if(!m.tables.steps.includes(j))continue;const slot=shapeOf(f)[2]==='repeat'?'revisit':opt?'option':shapeOf(parent)?.[2]==='condition'?(j.when?'yes':'no'):'next';wire(m,parent,slot,null,opt);}
 const ids=new Set([f.parent]);let n=0;while(n!==ids.size){n=ids.size;for(const r of [...m.tables.steps,...m.tables.street_choices])if(ids.has(r.parent_id))ids.add(r.row_id);}
 for(const [k,c] of Object.entries(m.views.outsideChoiceEdits||{}))if(ids.has(c.stepId))delete m.views.outsideChoiceEdits[k];
 for(const k of Object.keys(m.views.outside))if(m.views.outside[k].scene===f.ref.scene)delete m.views.outside[k];
 m.tables.scenes=m.tables.scenes.filter(r=>r.row_id!==f.parent);for(const t of ['steps','street_choices'])m.tables[t]=m.tables[t].filter(r=>!ids.has(r.row_id));m.refreshChoiceFlows();
}
const registered=m=>new Set([...m.base.tables.steps.map(s=>clean(s.actor)), 'luna'].filter(Boolean));
function validate(m){
 const errors=[],old=m.base.tables.scenes,existing=new Set(old.map(r=>r.row_id)),original=old.filter(r=>!shape.test(r.id)),actual=m.tables.scenes.filter(r=>!shape.test(r.id));
 if(JSON.stringify(actual)!==JSON.stringify(original))errors.push('외부 노드 작업에서 기존 장면 등록은 바꿀 수 없습니다.');
 const actors=registered(m),sites=new Set(MapUI().sites.map(s=>s.id)),graphParents=new Map();
 const only=(r,keys)=>Object.entries(r).every(([k,v])=>!clean(v)||keys.includes(k));
 const baseFields=['row_id','dataset_id','context','parent_id','parent_field','seq','source_order','type','template_id'];
 for(const [key,ref] of Object.entries(m.views.outside).filter(([k])=>k.startsWith('graph/')))if(key!==refKey(ref.scene)||!shape.test(ref.scene)||!m.tables.scenes.some(r=>r.id===ref.scene&&r.dataset_id===ref.source))errors.push('독립 노드의 대본 연결이 없습니다: '+key);
 for(const r of m.tables.scenes.filter(r=>shape.test(r.id))){
  const f=m.flow(refKey(r.id)),s=shape.exec(r.id),home=r.dataset_id==='script/home',owner=m.flows.find(o=>!shapeOf(o)&&!o.campaign&&o.ref.source===r.dataset_id&&scope(m,o)===s[1]),ref=m.views.outside[refKey(r.id)];
  if(!f||!owner||!sites.has(s[1])||!world(r.dataset_id)||r.row_id!=='scenes_'+r.id||r.start_mode!=='manual'||r.phase!==(home?'home':'street')||r.template_id!==(home?'scenes_format_09':'scenes_format_19')||r.parent_id!==m.rawScenes.find(sc=>sc.id===owner.ref.scene&&sc.dataset_id===r.dataset_id)?.parent_id||!ref||JSON.stringify(ref)!==JSON.stringify({source:r.dataset_id,scene:r.id,offset:0})||!m.rows(f.id).length||!clean(r.title||r['title.ko']).trim()||!Number.isInteger(+r.day)){
   errors.push('독립 노드 등록이나 대사 원본이 맞지 않습니다: '+r.id);continue;}
  graphParents.set(r.row_id,f);
  if(!only(r,['id','title','title.ko','phase','day','start_mode',...baseFields.filter(k=>!['context','type'].includes(k))]))errors.push('독립 노드에 지원되지 않는 장면 속성이 있습니다.');
  for(const row of all(m,r.row_id).filter(row=>!isLink(row))){
   const kind=s[2],flag=/^flag\.\w+ = (?:true|false)$/,guard=/^(?:true|flag\.\w+ == (?:true|false))$/;
   if(!/^exterior_editor_[a-f0-9]{32}$/.test(row.row_id)||row.parent_field!=='steps'||row.dataset_id!==r.dataset_id||row.context!==r.id||
    !only(row,[...baseFields,'actor','sync','text.ko','text.en','dialogue_id','web_fields.type','web_core_keys',...(row.type==='effect'?(kind==='condition'?['when']:['effects']):row.type==='popup'?['arg']:[])])||
    !['actor|text','actor|text|arg'].includes(row.web_core_keys)||row.sync!==(row.type==='popup'?'nowait':'wait')||row.template_id!==(row.type==='choice'?'steps_format_62':'steps_format_30')||
    (row.type==='effect'&&(kind==='condition'?!guard.test(row.when):kind!=='effect'||!flag.test(row.effects)))||row.type==='popup'&&kind!=='notice')errors.push('독립 노드의 실행 줄 또는 조건이 올바르지 않습니다: '+row.row_id);
  }
  if(!existing.has(r.row_id)&&m.tables.scenes.indexOf(r)<original.length)errors.push('새 장면은 기존 장면 뒤에 등록하세요.');
  for(const row of m.rows(f.id)){if(!actors.has(row.actor)||!['say','choice','effect','popup'].includes(row.type)||clean(row['web_fields.type'])!==(row.type==='popup'?'':row.type)||!['steps_format_30','steps_format_62'].includes(row.template_id)||row.type==='popup'&&(row.arg!=='event_occurred'||!clean(row['text.ko']).trim()))errors.push('잘못된 노드 종류·화자·알림: '+row.row_id);}
 }
 const ls=m.tables.steps.filter(isLink),visits=m.tables.steps.filter(r=>r.row_id.startsWith('exterior_editor_visit_'));
 for(const j of ls){
  if(!only(j,[...baseFields,'scene_id','when']))errors.push('이동 줄에는 대상과 조건만 지정할 수 있습니다.');
  const branch=m.flows.find(f=>f.parent===j.parent_id&&!f.onlyChoices),option=!branch&&m.tables.street_choices.find(o=>o.row_id===j.parent_id),source=branch||(option&&m.owner(option.parent_id)),to=targetOf(m,j);
  if(!source||!to||!world(j.dataset_id)||source.ref.source!==j.dataset_id||to.ref.source!==j.dataset_id||scope(m,source)!==scope(m,to)||(!shapeOf(to)&&!m.routeScene(to))||j.type!=='goto'||j.context!==source.ref.scene||j.template_id!=='steps_format_60'||j.parent_field!==(option||branch?.ref.branch?'result_steps':'steps')||reachable(m,to,source)){errors.push('유효하지 않거나 순환하는 이동: '+j.row_id);continue;}
  const siblings=all(m,j.parent_id),isRepeat=shapeOf(to)?.[2]==='repeat',key=scope(m,source);
  if(isRepeat){const regular=dedicated[key]?.includes(source.id)&&!clean(j.when),tracked=recurring[key]?.includes(source.id)&&clean(j.when)==='flag.graph_seen_'+source.parent.replace(/[^a-zA-Z0-9_]/g,'_')&&visits.some(r=>r.parent_id===j.parent_id&&r.effects===j.when+' = true');if(option||siblings[0]!==j||(!regular&&!tracked))errors.push('반복 대화는 해당 NPC의 재대화 시작에만 연결하세요.');}
  else if(option){const menu=m.row(option.parent_id);if(!m.removableMenu(menu)||siblings.length!==1||clean(j.when)||m.menuConfig(menu)?.routes[option.row_id]!=='flow:'+to.id)errors.push('선택지 결과와 CSV 이동이 일치하지 않습니다.');}
  else if(shapeOf(source)?.[2]==='condition'){
   const routes=siblings.filter(isLink),guard=clean(m.rows(source.id)[0]?.when)||'true';
   if(clean(j.when)&&j.when!==guard||routes.filter(r=>!!clean(r.when)===!!clean(j.when)).length!==1||routes.some((r,i)=>!clean(r.when)&&i<routes.length-1))errors.push('조건 분기는 조건 충족 → 그 외 순서로 한 번씩 연결하세요.');
  }else if(clean(j.when)||siblings.at(-1)!==j||!tailPin(m,{owner:source.id,rows:[m.rows(source.id).at(-1)]}))errors.push('보상이나 이어지는 본편 사건을 건너뛰는 이동입니다.');
 }
 for(const r of visits)if(!only(r,[...baseFields,'actor','sync','web_fields.type','web_core_keys','effects'])||r.type!=='effect'||r.template_id!=='steps_format_30'||!ls.some(j=>j.parent_id===r.parent_id&&j.dataset_id===r.dataset_id&&shapeOf(targetOf(m,j))?.[2]==='repeat'&&j.when&&r.effects===j.when+' = true'&&+r.seq===+j.seq+1))errors.push('재대화 방문 기록과 입구가 맞지 않습니다.');
 if(!errors.length&&ls.length){
  // Unity's DialogueRunner nests once per goto and twice for choice -> result_steps -> goto.
  // Reserve four calls for entering through a native interaction/its shared conclusion.
  const cache=new Map(),depth=f=>{if(cache.has(f.id))return cache.get(f.id);cache.set(f.id,Infinity);
   const n=nodeLinks(m,f).reduce((max,j)=>Math.max(max,(j.parent_field==='result_steps'?2:1)+depth(targetOf(m,j))),0);cache.set(f.id,n);return n;};
  if(m.flows.some(f=>world(f.ref.source)&&depth(f)>60))errors.push('한 번의 외부 대화가 엔진의 연결 깊이 한도에 너무 가깝습니다. 짧은 연속 대사는 한 노드에 묶거나 재대화로 나누세요.');
 }
 return [...new Set(errors)];
}
function install(M){const p=M.prototype,old=p.refreshChoiceFlows,normal=p.wire,plainScene=p.routeScene;p.refreshChoiceFlows=function(){old.call(this);rebuild(this);};
 p.routeScene=function(f){if(plainScene.call(this,f))return true;
  if(!f||shapeOf(f)||f.campaign||f.onlyChoices||f.ref.branch||f.offset||f.id.startsWith('ambient/')||f.id==='home/book')return false;
  const rows=all(this,f.parent).filter(r=>!isLink(r)&&!r.row_id.startsWith('exterior_editor_visit_'));
  return rows.length>0&&rows.every(r=>r.type==='say'&&this.kind(r)==='say'&&!clean(r.when)&&!clean(r.effects)&&!this.step(r).cinema);};
 p.wire=function(r,i,value){const opt=this.menu(r)[i]?.row,target=value.startsWith('flow:')&&this.flow(value.slice(5)),f=this.owner(r.row_id),jump=this.optionJump(opt);
  if(shapeOf(target)||isLink(jump)){if(target||value==='continue')return wire(this,f,'option',target||null,opt);wire(this,f,'option',null,opt);}
  return normal.call(this,r,i,value);};
}
const api={kinds,shape,shapeOf,graphView,world,isLink,all,newNode,rename,rule,remove,install,rebuild,targetOf,nodeLinks,repeatEntries,tailPin,wire,refKey,recurring,dedicated,reachable,validate};
if(browser)W.LunaOutsideNodes=api;else module.exports=api;
})(globalThis);

/* Choice authoring uses existing Steps/StreetChoices formats; web-views owns dispatch adapters. */
(function(root){
'use strict';
const browser=typeof module==='undefined',A=browser?root.LunaOutsideAuthoring:require('../../features/outside/events/outside-authoring.js');
const blank=v=>!v||v==='\\N',uid=()=> 'exterior_editor_'+globalThis.crypto.randomUUID().replaceAll('-','');
function install(Model){
 const p=Model.prototype,oldSet=p.set,oldRestore=p.restore,oldChanges=p.changes,oldRemove=p.remove;
 p.menuKey=function(row){return A.key(this.step(row));};
 p.menuConfig=function(row){return this.views.outsideChoiceEdits?.[this.menuKey(row)];};
 p.menu=function(row){const cfg=this.menuConfig(row);if(cfg)return cfg.active.map(id=>this.tables.street_choices.find(c=>c.row_id===id)).filter(Boolean).map(c=>({id:c.id,label:c['text.ko'],when:c.when,reason:c['lock_reason.ko'],row:c,route:cfg.routes[c.row_id]}));
  const line=this.step(row),native=this.choices(row.row_id);return A.defaults(line,native).map(c=>({...c,route:'native:'+c.dispatch}));
 };
 p.isMenu=function(row){return !!row&&(/choice/.test(this.kind(row))||!!this.menuConfig(row));};
 p.menuOutcomes=function(row){return A.defaults(this.step(row),this.base.tables.street_choices.filter(c=>c.parent_id===row.row_id&&!c.id.startsWith('exterior_editor_'))).map(c=>({...c,route:'native:'+c.dispatch}));};
 p.menuEditable=function(row){return this.isMenu(row)&&['script/street','script/home'].includes(row.dataset_id);};
 p.ensureMenu=function(row){if(!this.menuEditable(row))throw Error('이 장면의 선택지는 외부 편집 대상이 아닙니다.');let cfg=this.menuConfig(row);if(cfg)return cfg;
  const original=this.menu(row),key=this.menuKey(row);cfg={stepId:row.row_id,who:row['web_fields.who']||'',active:[],routes:{}};
  (this.views.outsideChoiceEdits||={})[key]=cfg;
  // Format 62 already carries options + stage. Keep speaker display in the view adapter.
  const allowed=new Set(['context','seq','type','actor','dialogue_id','arg','text.ko','text.en','when','effects','sync','web_fields.type','web_fields.stage','web_core_keys','dataset_id','row_id','parent_id','parent_field','source_order','template_id']);
  for(const k of Object.keys(row))if(!allowed.has(k))row[k]='';row.template_id='steps_format_62';
  if(blank(row['text.ko'])&&this.flows.some(f=>f.onlyChoices&&this.rows(f.id).includes(row)))row['text.ko']=A.prompt(this.step(row));
  for(const c of original){const r=c.row||this.makeChoice(row,c.label,c.id,c.when,c.reason);cfg.active.push(r.row_id);cfg.routes[r.row_id]=c.route;}
  return cfg;
 };
 p.makeChoice=function(row,text='새 선택지',id=uid(),when='',reason='조건이 맞지 않습니다.'){
  const r=Object.fromEntries(this.headers.street_choices.map(k=>[k,'']));Object.assign(r,{context:row.context+'/'+row.seq,id,seq:'1','text.ko':text,'text.en':'',when:blank(when)?'':when,'lock_reason.ko':reason||'',dataset_id:row.dataset_id,row_id:uid(),parent_id:row.row_id,parent_field:'options',source_order:String(Math.max(-1,...this.choices(row.row_id).map(c=>+c.source_order))+1),template_id:'street_choices_format_02'});r.seq=String(+r.source_order+1);this.tables.street_choices.push(r);return r;
 };
 p.addMenuOption=function(row){const cfg=this.ensureMenu(row);if(cfg.active.length>=4)throw Error('선택지는 최대 4개입니다.');const r=this.makeChoice(row);cfg.active.push(r.row_id);cfg.routes[r.row_id]='continue';return r;};
 p.removeMenuOption=function(row,id){const cfg=this.ensureMenu(row);if(cfg.active.length<=1)throw Error('선택지는 한 개 이상 남겨 주세요.');cfg.active=cfg.active.filter(x=>x!==id);delete cfg.routes[id];};
 p.moveMenuOption=function(row,id,delta){const cfg=this.ensureMenu(row),i=cfg.active.indexOf(id),j=i+delta;if(i<0||j<0||j>=cfg.active.length)return;[cfg.active[i],cfg.active[j]]=[cfg.active[j],cfg.active[i]];};
 p.setMenuField=function(row,index,key,value){const cfg=this.ensureMenu(row),r=this.tables.street_choices.find(c=>c.row_id===cfg.active[index]);if(key==='route')cfg.routes[r.row_id]=value;else this.set(r,key,value);};
 p.addMenu=function(flowId,index){const f=this.flow(flowId),anchor=this.rows(flowId)[0];if(f.campaign||flowId.startsWith('ambient/')||!['script/street','script/home'].includes(anchor?.dataset_id))throw Error('선택지 추가는 거리·집의 상호작용 대화에서 지원합니다.');
  const r=Object.fromEntries(this.headers.steps.map(k=>[k,''])),id=uid();Object.assign(r,{context:anchor.context,seq:'1',type:'choice',actor:anchor.actor,'text.ko':'','text.en':'',sync:'wait',dataset_id:anchor.dataset_id,row_id:id,parent_id:f.parent,parent_field:anchor.parent_field,source_order:String(Math.max(-1,...this.tables.steps.filter(s=>s.parent_id===f.parent).map(s=>+s.source_order))+1),template_id:'steps_format_62','web_fields.type':'choice',web_core_keys:'actor|text'});this.tables.steps.push(r);
  const ids=this.rows(flowId).filter(x=>x!==r).map(x=>x.row_id);ids.splice(index,0,id);this.reorder(flowId,ids);this.addMenuOption(r);return r;
 };
 p.removableMenu=function(row){return row?.row_id.startsWith('exterior_editor_')&&row.type==='choice'&&this.kind(row)==='choice';};
 p.remove=function(flowId,id){const row=this.row(id);if(!this.removableMenu(row))return oldRemove.call(this,flowId,id);if(this.rows(flowId).length<=1)throw Error('대사를 한 줄 이상 남겨 주세요.');
  const removed=new Set([id]);let changed=true;while(changed){changed=false;for(const r of [...this.tables.steps,...this.tables.street_choices])if(removed.has(r.parent_id)&&!removed.has(r.row_id)){if(!r.row_id.startsWith('exterior_editor_'))throw Error('기존 분기를 가진 선택지 장면은 삭제할 수 없습니다.');removed.add(r.row_id);changed=true;}}
  const optionIds=new Set(this.tables.street_choices.filter(r=>removed.has(r.row_id)).map(r=>r.id));for(const [key,cfg]of Object.entries(this.views.outsideChoiceEdits||{}))if(removed.has(cfg.stepId))delete this.views.outsideChoiceEdits[key];
  for(const [key,ref]of Object.entries(this.views.outside))if(key.startsWith('editor/')&&optionIds.has(ref.branch))delete this.views.outside[key];for(const table of ['steps','street_choices'])this.tables[table]=this.tables[table].filter(r=>!removed.has(r.row_id));this.refreshChoiceFlows();this.reorder(flowId,this.rows(flowId).map(r=>r.row_id));
 };
 p.addOptionBranch=function(row,index){const cfg=this.ensureMenu(row),option=this.tables.street_choices.find(c=>c.row_id===cfg.active[index]);const owner=this.flows.find(f=>this.rows(f.id).some(r=>r.row_id===row.row_id));if(!owner)throw Error('원본 흐름을 찾을 수 없습니다.');
  const existing=this.flows.find(f=>f.parent===option.row_id);if(existing){cfg.routes[option.row_id]='flow:'+existing.id;return existing;}
  const id=uid(),r=Object.fromEntries(this.headers.steps.map(k=>[k,'']));Object.assign(r,{context:id,seq:'1',type:'say',actor:row.actor,'text.ko':'새 분기 대사','text.en':'',sync:'wait',dataset_id:row.dataset_id,row_id:id,parent_id:option.row_id,parent_field:'result_steps',source_order:'0',template_id:'steps_format_30','web_fields.type':'say',web_core_keys:'actor|text'});this.tables.steps.push(r);
  const flowId='editor/'+option.id;this.views.outside[flowId]={...owner.ref,branch:option.id,offset:0};cfg.routes[option.row_id]='flow:'+flowId;this.refreshChoiceFlows();return this.flow(flowId);
 };
 p.refreshChoiceFlows=function(){this.flows=this.flows.filter(f=>!f.id.startsWith('editor/'));for(const [id,ref]of Object.entries(this.views.outside).filter(([id])=>id.startsWith('editor/'))){const c=this.tables.street_choices.find(c=>c.id===ref.branch);if(c)this.flows.push({id,ref,parent:c.row_id,group:'추가한 선택 분기',title:c['text.ko'],offset:0,links:{},campaign:false,onlyChoices:false});}};
 p.restore=function(s){oldRestore.call(this,s);this.refreshChoiceFlows();};
 p.set=function(row,key,value){if(key==='text.ko'&&this.flows.some(f=>f.onlyChoices&&this.rows(f.id).includes(row)))this.ensureMenu(row);oldSet.call(this,row,key,value);};
 // Hide choice-copy tables. Menus live at their dialogue position, not in separate navigation entries.
 const merged={'notion/intro':['choices/info'],'shop/intro':['choices/stock'],'shop/revisit':['choices/stock'],'believer/intro':['believer/finish'],'shop/quizIntro':['shop/lesson']};
 p.visibleFlows=function(){const hidden=new Set(['newspaper/options',...this.projected.data.newspaperRoutes.join,...Object.values(merged).flat()]);return this.flows.filter(f=>!hidden.has(f.id));};
 p.sequence=function(id){const parent=this.flow(id)?.parent,config=Object.values(this.views.outsideChoiceEdits||{}).find(c=>c.active.includes(parent)),newspaper=config&&this.kind(this.row(config.stepId))==='newspaper-choice';const plan=this.projected.data.newspaperRoutes,path=Object.values(plan.routes).find(keys=>keys[0]===id);return (path||[id,...(merged[id]||(newspaper?plan.join:[]))]).flatMap(k=>this.rows(k));};
 p.owner=function(id){return this.flows.find(f=>this.rows(f.id).some(r=>r.row_id===id));};
 p.validateMenus=function(){const errors=[];for(const [key,cfg]of Object.entries(this.views.outsideChoiceEdits||{})){
  const row=this.row(cfg.stepId);if(!row||row.type!=='choice'||key!==this.menuKey(row)||!this.menuEditable(row)){errors.push('선택지 연결 행이 올바르지 않습니다: '+key);continue;}
  if(!Array.isArray(cfg.active)||cfg.active.length<1||cfg.active.length>4||new Set(cfg.active).size!==cfg.active.length){errors.push('선택지는 중복 없이 1~4개여야 합니다.');continue;}
  const defaults=this.menuOutcomes(row);
  for(const id of cfg.active){const c=this.tables.street_choices.find(c=>c.row_id===id),route=cfg.routes?.[id];if(!c||c.parent_id!==row.row_id||c.dataset_id!==row.dataset_id||!String(c['text.ko']||'').trim()){errors.push('선택지 문구 또는 부모 연결이 없습니다.');continue;}
   if(!['continue','end'].includes(route)&&!defaults.some(o=>route===o.route)&&!(route?.startsWith('flow:')&&this.views.outside[route.slice(5)]))errors.push('선택 후 연결을 지정하세요: '+c['text.ko']);
   try{for(const part of (blank(c.when)?'':c.when).split('&&'))(browser?root.LunaOutsideEditorModel:require('./outside-model.js')).condition(part,{money:0,day:1,flags:{},affinity:{}});}catch(e){errors.push(e.message);}
  }
 }return errors;};
 p.changes=function(){const changes=oldChanges.call(this);if(JSON.stringify(this.base.views.outsideChoiceEdits||{})!==JSON.stringify(this.views.outsideChoiceEdits||{}))changes.push({table:'view',id:'outsideChoiceEdits',kind:'연결 수정',before:'기존 선택지 구성',after:'선택지 개수·순서·후속 분기 변경'});return changes;};
}
if(browser)root.LunaOutsideChoiceModel={install};else module.exports={install};
})(typeof window==='undefined'?globalThis:window);

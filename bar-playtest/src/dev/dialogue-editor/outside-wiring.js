/* Only wire routes that can be serialized as real Unity result_steps/goto.
 * Dynamic purchases, fees and grants stay owned by their event handlers. */
(function(root){
'use strict';
function install(Model){
 const p=Model.prototype,fresh=r=>r?.row_id?.startsWith('exterior_editor_'),generatedMenu=r=>fresh(r)&&r.type==='choice'&&r['web_fields.type']==='choice',blank=v=>!v||v==='\\N'||v==='\\E';
 p.optionJump=function(c){return c&&this.tables.steps.find(r=>r.parent_id===c.row_id&&r.type==='goto');};
 p.newspaperDest=function(r,c){if(r?.row_id!==this.projected?.data.newspaperRoutes.parent||!c?.row)return null;const native=c.route?.replace(/^native:/,''),choice=this.choices(r.row_id).find(o=>o.id===native);const jump=this.optionJump(choice);return jump&&this.flows.find(f=>['newspaper/wrong','newspaper/right'].includes(f.id)&&f.ref.scene===jump.scene_id)?.id;};
 p.routeScene=function(f){if(!f||f.campaign||f.onlyChoices||f.ref.branch||f.offset||f.ref.scene==='home-book'||f.id.startsWith('ambient/'))return false;
  const native=this.tables.steps.filter(r=>r.parent_id===f.parent),visible=this.rows(f.id);return native.length===visible.length&&visible.length>0&&visible.every(r=>this.kind(r)==='say'&&r.type==='say'&&blank(r.when)&&blank(r.effects)&&!this.step(r).cinema);};
 p.safeJump=function(r){
  if(!r||r.type!=='goto'||r.template_id!=='steps_format_60'||r.parent_field!=='result_steps'||!blank(r.when)||!blank(r.effects))return false;
  const c=this.tables.street_choices.find(o=>o.row_id===r.parent_id),q=c&&this.row(c.parent_id);if(!c||!q||r.dataset_id!==q.dataset_id)return false;
  const target=this.flows.find(f=>f.ref.scene===r.scene_id&&!f.ref.branch&&f.ref.source===q.dataset_id);
  const newspaper=q.row_id===this.projected.data.newspaperRoutes.parent&&['newspaper/wrong','newspaper/right'].includes(target?.id);if(newspaper&&!fresh(r))return ['newspaper-wrong','newspaper-right'].includes(c.id)&&this.base.tables.steps.some(b=>b.row_id===r.row_id&&b.parent_id===c.row_id);
  const original=this.base.tables.steps.find(b=>b.template_id==='steps_format_60'&&b.type==='goto'&&b.parent_field==='result_steps'&&blank(b.when)&&blank(b.effects));
  return fresh(c)&&fresh(r)&&(generatedMenu(q)&&this.routeScene(target)||newspaper)&&!!original&&Object.keys(r).every(k=>['row_id','dataset_id','parent_id','context','scene_id','seq','source_order'].includes(k)||r[k]===original[k]);
 };
 p.wire=function(r,i,value){
  const c=this.menu(r)[i];if(!c)throw Error('선택지가 없어졌습니다. 다시 선택하세요.');
  const id=value.startsWith('flow:')?value.slice(5):'',target=this.flow(id);
  if(r.row_id===this.projected.data.newspaperRoutes.parent&&target&&['newspaper/wrong','newspaper/right'].includes(id)){
   let jump=this.optionJump(c.row);if(!jump&&fresh(c.row)){const seed=this.tables.steps.find(s=>this.safeJump(s)&&this.tables.street_choices.some(o=>o.row_id===s.parent_id&&o.parent_id===r.row_id));if(seed){jump={...seed,row_id:'exterior_editor_'+globalThis.crypto.randomUUID().replaceAll('-',''),parent_id:c.row.row_id,context:r.context,seq:'1',source_order:'0'};this.tables.steps.push(jump);}}if(!jump||!this.safeJump(jump))throw Error('원본 답변의 CSV 이동 줄이 없습니다.');
   jump.scene_id=target.ref.scene;const cfg=this.menuConfig(r);if(cfg)cfg.routes[c.row.row_id]='native:'+c.row.id;return;
  }
  if(!generatedMenu(r)){if(c.route===value)return;throw Error('이 선택은 본편의 보상·거래와 연결되어 있습니다. 동작을 바꾸지 않고 대사나 조건을 편집하세요.');}
  const cfg=this.ensureMenu(r),choice=this.tables.street_choices.find(o=>o.row_id===cfg.active[i]),jump=this.optionJump(choice);
  const children=this.tables.steps.filter(s=>s.parent_id===choice.row_id&&s!==jump),end=this.tables.steps.some(s=>s.parent_id===r.parent_id&&+s.seq>+r.seq);
  if(id&&target?.parent===choice.row_id){if(jump)throw Error('기존 이동을 먼저 해제하세요.');}
  else if(children.length)throw Error('자체 대사 분기가 있습니다. 대사를 삭제하지 않고 다른 곳에 덮어 연결할 수 없습니다.');
  else if(id){
   if(!target||!this.routeScene(target)||target.ref.source!==r.dataset_id||target.parent===r.parent_id)throw Error('같은 데이터셋의 독립 대화 시작 노드에 연결하세요. 사건 동작이나 순환은 연결할 수 없습니다.');
   if(end)throw Error('중간 선택에서 원래 사건의 뒷부분을 건너뛰지 않도록, 다른 흐름으로 이동하는 선택은 흐름 끝에 두세요.');
   const seed=this.base.tables.steps.find(s=>s.template_id==='steps_format_60'&&s.parent_field==='result_steps'&&s.type==='goto'&&blank(s.when)&&blank(s.effects));
   if(!seed)throw Error('원본 이동 명령을 찾지 못했습니다.');
   const j=jump||{...seed,row_id:'exterior_editor_'+globalThis.crypto.randomUUID().replaceAll('-',''),parent_id:choice.row_id,dataset_id:r.dataset_id,context:r.context,seq:'1',source_order:'0'};
   j.scene_id=target.ref.scene;if(!jump)this.tables.steps.push(j);
  }else{if(!['continue','end'].includes(value)||value==='end'&&end)throw Error('이어지는 대사가 있어서 여기에서 종료할 수 없습니다.');if(jump)this.tables.steps=this.tables.steps.filter(s=>s!==jump);}
  cfg.routes[choice.row_id]=value;
 };
}
if(typeof module!=='undefined'&&module.exports)module.exports={install};else root.LunaOutsideWiring={install};
})(typeof window==='undefined'?globalThis:window);

/* Structural actions for a single visible bar row. The toolbar, inspector and
   context menu share these guards and use the editor's ordinary undo transaction. */
(function(root){
'use strict';
const req=(web,file)=>typeof module==='undefined'?root[web]:require(file);
const F=req('LunaBarFlow','./flow-model.js'),R=req('LunaBarWiring','./flow-wiring.js'),A=req('LunaFlowAuthoring','./flow-authoring.js'),D=req('LunaBarDays','./flow-days.js');
const clean=F.clean,template=(m,k)=>m.tables.steps.find(s=>s.type===k&&s.template_id==='steps_format_68'&&D.barDataset(s.dataset_id));
const authored=new Set(['say','enter','exit','choice','coaster','order','craft','serve','empty_glass','effect','tutorial','end_part']);
function context(m,scene,r){
 const list=m.rows(scene),at=list.indexOf(r),scan=R.scan(m,scene),before=list[at-1],after=list[at+1];
 const owners=m.views.barEditorCards?.[scene],owner=owners?.[r.row_id];
 const prepend=!!owner&&owner!==r.row_id&&owners[after?.row_id]===owner;
 const locked=at<0||at<m.prefix(scene)?'개점 전 초기 배치는 유지해야 합니다.':scan.hidden.has(r.row_id)||scan.routes.some(e=>e.owner===r||e.source===r.row_id||e.target===r.row_id)?'먼저 플로우 차트에서 이 줄의 연결을 해제하세요.':
  r.sync==='no_wait'||before?.sync==='no_wait'?'동시 입장 두 줄은 함께 유지해야 합니다.':
  r.type==='craft'&&after?.type==='serve'||r.type==='serve'&&before?.type==='craft'?'제조와 제공은 한 쌍입니다.':r.type==='end_part'?'장면 종료 줄은 맨 끝에 유지합니다.':'';
 const removablePrefix=prepend&&scan.routes.some(e=>e.target===r.row_id)&&!scan.routes.some(e=>e.source===r.row_id||e.owner===r)&&at>=m.prefix(scene)&&F.compile(m,scene,F.legacyStarts(m,scene)).nodes.some(n=>n.id===owner&&n.rows[0]===r&&n.rows[1]===after);
 return {list,at,scan,before,after,locked,deleteLock:removablePrefix?'':locked,row:r};
}
function placement(m,scene,c,at){
 const {list,scan}=c,prev=list[at-1],next=list[at];
 if(at<m.prefix(scene))return '고정된 초기 배치 앞에는 추가할 수 없습니다.';
 if(prev?.type==='end_part')return '장면 종료 뒤에는 추가할 수 없습니다.';
 if(prev?.sync==='no_wait'||prev?.type==='craft'&&next?.type==='serve')return '함께 실행되는 두 줄 사이에는 추가할 수 없습니다.';
 if(next&&scan.hidden.has(next.row_id)&&!(prev===c.row&&prev.type==='say'&&scan.routes.some(e=>e.source===prev.row_id&&e.steps[0]===next)))return '분기 연결 내부입니다. 도착 줄 앞에 추가하세요.';
 return '';
}
function typeProblem(m,scene,r,k,c=context(m,scene,r)){
 if(k===r.type)return '';
 if(c.locked)return c.locked;
 if(!authored.has(k)||!template(m,k))return '현재 바 대본에 등록된 진행 종류가 아닙니다.';
 if(['enter','exit','coaster','order','craft','serve','end_part'].includes(k)&&c.scan.routes.some(w=>clean(r.when).split('&&').some(x=>x.trim()==='!'+w.gate)))return '분기가 건너뛰는 구간입니다. 입퇴장이나 주문 절차는 연결 밖에 배치하세요.';
 if(k==='end_part'&&c.after)return '장면 끝에서만 종료할 수 있습니다.';
 if(k==='craft'&&c.after?.type!=='serve'||k==='serve'&&c.before?.type!=='craft')return '제조 바로 다음에 제공이 와야 합니다.';
 const {seats,pending}=A.state(m,scene,c.at);
 if(k==='order'&&pending)return '앞 주문을 먼저 제공해야 합니다.';
 if(k==='enter'&&seats.L&&seats.R)return '빈 좌석이 없습니다.';
 if(['exit','coaster','order','craft','serve','empty_glass'].includes(k)&&!Object.keys(seats).length)return '이 위치에는 앉아 있는 손님이 없습니다.';
 return '';
}
function cleanOptions(m,r){
 const opts=m.choices(r.arg);while(opts.length>2)m.removeChoice(r.arg,opts.pop().row_id);
 if(opts.length===1)opts.push(m.addChoice(r.arg));
 opts.forEach((o,i)=>{for(const k of ['text.en','when','effects','goto','lock_reason.ko','lock_reason.en'])m.set(o,k,'');m.set(o,'text.ko','새 선택지 '+(i+1));});
}
function releaseGroup(m,id){
 if(!id||m.tables.steps.some(r=>r.type==='choice'&&r.arg===id))return;
 const g=m.tables.bar_choice_groups.find(g=>g.choice_group===id);if(!g)return;
 const options=new Set(m.choices(id).map(o=>o.web_row_id));
 m.tables.bar_choices=m.tables.bar_choices.filter(o=>o.parent_id!==g.row_id);
 m.tables.bar_choice_groups=m.tables.bar_choice_groups.filter(o=>o!==g);
 m.views.tables.bar_choices.rows=m.views.tables.bar_choices.rows.filter(v=>!options.has(v.id));
 m.views.tables.bar_choice_groups.rows=m.views.tables.bar_choice_groups.rows.filter(v=>v.key?.choice_group!==id&&v.id!==g.row_id&&(!g.web_row_id||v.id!==g.web_row_id));
}
function changeType(m,scene,r,k){
 if(k===r.type)return r;const c=context(m,scene,r),reason=typeProblem(m,scene,r,k,c);if(reason)throw Error(reason);
 const sample=template(m,k),old={...r},seats=A.state(m,scene,c.at).seats,cast=Object.values(seats);
 const actor=k==='enter'?(old.actor!=='luna'&&m.presentation.characterLayers[old.actor]&&!cast.includes(old.actor)?old.actor:Object.keys(m.presentation.characterLayers).find(id=>id!=='luna'&&!cast.includes(id))):
  ['say','choice','effect','tutorial','end_part'].includes(k)?(k==='say'&&cast.includes(old.actor)?old.actor:'luna'):(cast.includes(old.actor)?old.actor:cast[0]);
 const spec=m.views.tables.steps.rows.find(v=>v.id===sample.web_row_id),myView=m.views.tables.steps.rows.find(v=>v.id===r.web_row_id);
 if(!spec||!myView)throw Error('이 종류의 웹 연결을 찾을 수 없습니다.');
 Object.assign(myView,JSON.parse(JSON.stringify(spec)),{id:r.web_row_id});
 m.set(r,'type',k);D.neutral(m,r,actor);m.set(r,'web_core_keys',sample.web_core_keys);
 m.set(r,'when',old.when);m.set(r,'effects',old.effects);m.set(r,'dialogue_id',k==='say'?(clean(old.dialogue_id)||'dlg_'+r.row_id):'');
 if(k==='say'||k==='order'){m.set(r,'text.ko',clean(old['text.ko'])?old['text.ko']:(k==='say'?'새 대사':''));m.set(r,'text.en',old['text.en']);m.set(r,'arg',k==='order'?'free':'default');}
 if(k==='enter')m.set(r,'arg',!seats.L?'L':'R');if(k==='tutorial')m.set(r,'arg',sample.arg);
 if(k==='choice'){m.cloneChoiceGroup(sample.arg,r);cleanOptions(m,r);}
 if(old.type==='choice')releaseGroup(m,old.arg);
 return r;
}
function insert(m,scene,r,side,type='say',duplicate=false){
 const c=context(m,scene,r),at=c.at+(side==='after'?1:0),issue=placement(m,scene,c,at);if(issue)throw Error(issue);
 if(duplicate&&c.locked)throw Error(c.locked);
 if(!duplicate&&(!authored.has(type)||!template(m,type)))throw Error('현재 바 대본에 등록된 진행 종류가 아닙니다.');
 const inside=r.type==='say'&&type==='say',owners=inside?F.rememberCards(m,scene):null;
 const outgoing=side==='after'?c.scan.routes.filter(e=>e.source===r.row_id):[];
 if(outgoing.length&&!inside)throw Error('분기 출력 앞에는 같은 노드의 대사만 추가할 수 있습니다.');
 const n=m.add(scene,at,duplicate?type:'say',duplicate?r:null);
 if(!duplicate){const seated=Object.values(A.state(m,scene,at).seats);D.neutral(m,n,seated.includes(r.actor)?r.actor:'luna');m.set(n,'arg',r.type==='say'&&n.actor===r.actor?r.arg:'default');m.set(n,'text.ko','새 대사');}
 // Keep all existing destinations stable; inserting immediately before the old
 // target extends the skipped range by one instead of silently stealing its wire.
 const gates=c.scan.routes.filter(e=>c.list.findIndex(x=>x.row_id===e.source)<at&&at<=c.list.findIndex(x=>x.row_id===e.target)&&!outgoing.includes(e)&&!(inside&&side==='before'&&e.target===r.row_id)).map(e=>'!'+e.gate);
 if(inside){
  // Loose blocks use an existing engine-compatible ID convention for activation and joins.
  const block=R.block(r);if(block){
   const used=new Set(c.list.map(x=>x.row_id));let i=1;while(used.has(block+'_'+i)||i===900||i===901)i++;
   const id=block+'_'+i,spec=m.views.tables.steps.rows.find(v=>v.id===n.web_row_id);
   spec.id=id;n.row_id=n.web_row_id=id;n.dialogue_id='dlg_'+id;
  }
  owners[n.row_id]=owners[r.row_id];
  // Leave the existing output armed by its original line. Skipping an optional
  // new last line must not silently cancel the trip to the connected card.
 }
 m.set(n,'when',[...new Set([...gates,...clean(inside?r.when:R.readable(r.when)).split('&&').map(t=>t.trim()).filter(Boolean)])].join(' && '));return !duplicate&&type!=='say'?changeType(m,scene,n,type):n;
}
function editField(m,r,key,value){
 if(r.type==='say'&&['when','effects','actor'].includes(key)&&value!==r[key])F.rememberCards(m,r.context);
 m.set(r,key,value);
}
function remove(m,scene,r){
 const c=context(m,scene,r);if(c.deleteLock||c.list.length<2)throw Error(c.deleteLock||'마지막 한 줄은 남겨 주세요.');
 m.remove(scene,r.row_id);if(r.type==='choice')releaseGroup(m,r.arg);
}
function moveProblem(m,scene,r,delta,visible,filtered=false){
 if(filtered)return '필터를 지운 뒤 순서를 바꿀 수 있습니다.';
 const c=context(m,scene,r),other=c.list[c.at+delta];if(!other||!visible.includes(other.row_id))return '현재 편집 범위의 끝입니다.';
 return c.locked||context(m,scene,other).locked||((clean(r.when)+' '+clean(other.when)).includes('flag.bp_')?'연결된 구간의 경계는 플로우 차트에서 변경하세요.':'');
}
const api={context,placement,typeProblem,changeType,insert,remove,moveProblem,editField};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarLineActions=api;
})(globalThis);

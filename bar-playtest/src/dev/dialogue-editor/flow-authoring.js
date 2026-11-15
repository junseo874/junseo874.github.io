/* Native bar commands only. No synthetic command name is serialized. */
(function(root){
'use strict';
const Days=typeof module==='undefined'?root.LunaBarDays:require('./flow-days.js'),F=typeof module==='undefined'?root.LunaBarFlow:require('./flow-model.js');
const clean=F.clean;
const names={say:'대사',enter:'손님 입장',exit:'손님 퇴장',choice:'선택지',coaster:'코스터 제공',orderSet:'주문 → 제조 → 제공',empty_glass:'빈잔으로 교체',effect:'플래그 / 소지금 / 호감도 변경',tutorial:'튜토리얼',end_part:'영업 종료'};
function state(m,scene,at){
 const seats={},rows=m.rows(scene).slice(0,at);let pending='';
 for(const r of rows){if(r.type==='enter')seats[r.arg]=r.actor;if(r.type==='exit')for(const k of Object.keys(seats))if(seats[k]===r.actor)delete seats[k];if(r.type==='order')pending=r.actor;if(r.type==='serve')pending='';}
 return {seats,pending};
}
function create(m,scene,node,params){
 const {type,actor='luna',arg='',text='',effect='',before=false}=params;
 if(!names[type])throw Error('지원하지 않는 바 명령입니다.');
 const list=m.rows(scene),first=node.rows[0],last=node.rows.at(-1),at=list.indexOf(before?first:last)+(before?0:1);
 if(at<m.prefix(scene)||(!before&&last.type==='end_part')||list[at-1]?.sync==='no_wait')throw Error('고정 초기 배치·동시 입장 사이 또는 영업 종료 뒤에는 추가할 수 없습니다.');
 if(!before&&node.routes.length)throw Error('출력 선이 있는 노드입니다. 도착 노드의 ‘앞에 삽입’을 사용하세요.');
 const context=state(m,scene,at),seated=Object.values(context.seats);
 let when=String(params.when||'').trim();F.checkGuard(when);
 // Inserting within a skipped interval inherits the negative routing gates.
 const inherited=clean((before?first:last).when).split(' && ').filter(s=>s.startsWith('!flag.bp_path_'));
 when=[...new Set([...inherited,...(when?[when]:[])])].join(' && ');
 const knownSeat=seated.includes(actor);
 if(/\b(?:order_match|grade|craft_grade|final_grade)\b/.test(when)){const served=list.slice(0,at).filter(r=>['order','serve'].includes(r.type)).at(-1);if(served?.type!=='serve'||clean(served.when))throw Error('제조 결과는 제공이 확정된 위치에서 사용하세요.');}
 if(type==='enter'&&(!['L','R'].includes(arg)||context.seats[arg]||knownSeat||(!m.presentation.characterLayers[actor]&&actor!=='shiba')))throw Error('입장은 비어 있는 좌석과 아직 앉지 않은 손님을 고르세요.');
 if(['exit','orderSet','coaster','empty_glass'].includes(type)&&!knownSeat)throw Error('이 시점에 앉아 있는 손님을 먼저 선택하세요.');
 if(type==='say'&&actor!=='luna'&&!knownSeat)throw Error('루나 또는 이때 앉아 있는 손님을 선택하세요.');
 if(type==='orderSet'&&(context.pending||!['free',...m.projected.data.tables.cocktails.map(c=>'exact:'+c.id)].includes(arg)))throw Error('앞 주문을 먼저 제공하고, 주문할 술을 목록에서 고르세요.');
 if(type==='orderSet'&&/\b(?:craft_grade|order_match|grade|final_grade)\b/.test(when))throw Error('새 주문이 이전 제조 결과를 초기화합니다. 결과를 먼저 플래그로 기록한 뒤 그 플래그를 조건으로 쓰세요.');
 if(type==='end_part'&&(context.pending||list.slice(at).some(r=>r.type==='end_part')||at<list.length))throw Error('영업 종료는 미처리 주문이 없을 때 장면 맨 끝에 한 번만 추가할 수 있습니다.');
 if(type==='effect'&&(!effect.trim()||effect.includes('flag.bp_')||!effect.split(';').every(x=>/^(?:flag\.\w+\s*=\s*(?:true|false)|affinity\.\w+\s*(?:\+=|-=|=)\s*-?\d+|money\s*(?:\+=|-=)\s*\d+)$/.test(x.trim()))))throw Error('플래그 기록, 호감도 변경, 소지금 변경 중 실행할 효과를 선택하세요.');
 if(type==='tutorial'&&!list.concat(m.tables.steps).some(r=>r.type==='tutorial'&&r.arg===arg))throw Error('등록된 튜토리얼을 고르세요.');
 if(type==='choice'){const fake={rows:[list[at-1]||first],when}; // Also permits inserting before the first line.
  const r=F.insertChoice(m,scene,fake);const ids=m.rows(scene).filter(x=>x!==r).map(x=>x.row_id);ids.splice(at,0,r.row_id);m.reorder(scene,ids);m.set(r,'when',when);return r;
 }
 // Bar service physically requires the guest's coaster. Reuse an earlier authored cue;
 // when none was guaranteed in this visit, insert the ordinary interactive coaster step.
 const visit=list.slice(0,at).filter(r=>r.actor===actor),arrival=visit.findLastIndex(r=>r.type==='enter'||r.type==='exit');
 const hasCoaster=visit.slice(arrival+1).some(r=>r.type==='coaster'&&(!clean(r.when)||clean(r.when)===when));
 const kinds=type==='orderSet'?[...(hasCoaster?[]:['coaster']),'order','craft','serve']:[type],added=[];
 for(const [i,k] of kinds.entries()){
  const r=Days.neutral(m,m.add(scene,at+i,k),actor);m.set(r,'when',when);if(k==='say'){m.set(r,'arg',arg||'default');m.set(r,'text.ko',text||'새 대사');}else if(k==='order'||k==='enter'||k==='tutorial')m.set(r,'arg',arg);else if(k==='effect')m.set(r,'effects',effect);
  added.push(r);
 }return added.find(r=>r.type==='order')||added[0];
}
const api={names,state,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaFlowAuthoring=api;
})(globalThis);

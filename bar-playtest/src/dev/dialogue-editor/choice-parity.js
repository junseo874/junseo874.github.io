/* Static next-dialogue audit, not a Unity simulation. Unknown native actions
 * are reported as unverified, never guessed. Web-only saves remain possible. */
(function(root){'use strict';
const clean=v=>v==='\\N'||v==='\\E'?'':v||'';
function compare(m,result){
 const warnings=[],rows=m.tables.steps,children=new Map();
 for(const r of rows){if(!children.has(r.parent_id))children.set(r.parent_id,[]);children.get(r.parent_id).push(r);}
 for(const siblings of children.values())siblings.sort((a,b)=>+a.seq-+b.seq);
 const plans=result.data.newspaperRoutes,flows=result.data.sharedStory;
 const spoken=lines=>lines.filter(r=>['say','timeline'].includes(r.type)&&r.text).map(r=>r.editorRowId);
 for(const cfg of Object.values(m.views.outsideChoiceEdits||{})){
  const step=m.row(cfg.stepId),all=m.choices(cfg.stepId).slice().sort((a,b)=>+a.seq-+b.seq);
  const native=step['web_fields.type'],label=step.context+' #'+step.seq;
  if(native==='editor-choice'){warnings.push(label+' · 새 선택지 장면: 현재 Unity는 editor-choice 명령을 읽지 못합니다.');continue;}
  if(native!=='choice'&&native!==''){warnings.push(label+' · '+native+'는 엔진의 사건 처리기가 선택지를 구성합니다. 활성 목록·후속 동작의 동일성은 확인되지 않았습니다.');continue;}
  if(all.map(o=>o.row_id).join('|')!==cfg.active.join('|'))warnings.push(label+' · 엔진 CSV의 선택지 목록/순서와 웹 활성 목록이 다릅니다.');
  const tail=(children.get(step.parent_id)||[]).filter(r=>+r.seq>+step.seq);
  function trace(list,visited=new Set()){
   const ids=[];
   for(const r of list){
    if(r.type==='effect'||r.type==='set_state')continue;
    if(clean(r.when))throw Error('조건에 따라 경로가 달라짐: '+r.row_id);
    if(r.type==='say'||r.type==='timeline'){if(clean(r['text.ko']))ids.push(r.row_id);continue;}
    if(r.type==='goto'){const sc=m.rawScenes.find(s=>s.id===r.scene_id&&s.dataset_id===step.dataset_id);
     if(!sc||visited.has(sc.row_id))throw Error('누락 또는 순환 goto: '+r.scene_id);
     visited.add(sc.row_id);return ids.concat(trace(children.get(sc.row_id)||[],visited));}
    throw Error('추가 선택 또는 사건 명령: '+r.row_id);
   }return ids;
  }
  for(const id of cfg.active){
   const o=all.find(r=>r.row_id===id);if(!o)continue;
   const route=cfg.routes[id],tag=label+' / '+o['text.ko'];
   try{
    // DialogueRunner.PlayChoiceAsync exits its parent on a nonempty result_steps.
    const branch=children.get(id)||[],engine=trace(branch.length?branch:tail);
    let web;
    if(route==='end')web=[];
    else if(route==='continue')web=trace(tail);
    else if(route.startsWith('flow:')){
     const path=route.slice(5),extras=step.row_id===plans.parent?plans.join:[];
     web=spoken([path,...extras].flatMap(k=>flows[k]||[]));
     if(step.row_id!==plans.parent)web.push(...trace(tail));
    }else if(route.startsWith('native:')&&step.row_id===plans.parent){
     const path=plans.routes[route.slice(7)];if(!path)throw Error('연결된 기본 답변 없음');
     web=spoken(path.flatMap(k=>flows[k]||[]));
    }else throw Error('엔진 사건 동작은 정적 비교 대상이 아님');
    const i=Array.from({length:Math.max(web.length,engine.length)},(_,i)=>i).find(i=>web[i]!==engine[i]);
    if(i!==undefined)warnings.push(tag+' · '+(i+1)+'번째 대사가 다릅니다. 웹: '+(web[i]||'종료')+' / 엔진: '+(engine[i]||'종료'));
   }catch(e){warnings.push(tag+' · 비교 보류: '+e.message);}
  }
 }
 return warnings;
}
if(typeof module!=='undefined'&&module.exports)module.exports={compare};else root.LunaChoiceParity={compare};
})(typeof window==='undefined'?globalThis:window);

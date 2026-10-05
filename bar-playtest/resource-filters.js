/* Facets describe the actual review rows; animation uses frame data, not pose names. */
(function(W){
'use strict';
const labels={media:{static:'단일 / 정적 이미지',animation:'애니메이션',none:'이미지 없음 / 시점'},motion:{idle:'Idle · 대기',talk:'Talk · 대화',anger:'Anger · 분노',joy:'Joy · 기쁨',success:'Success · 성공',fail:'Fail · 실패',serious:'Serious · 진지',surprise:'Surprise · 놀람',drunk:'Drunk · 취함',drink:'Drink · 마시기',walk:'Walk · 걷기',run:'Run · 달리기',crawl:'Crawl · 기어가기',fall:'Fall · 낙하',shoot:'Shoot · 사격',stand_up:'Stand up · 일어서기',parts:'일반 손님 / 부위',seated:'착석',pov:'시점',other:'기타 동작'},usage:{hero:'완성 / 대표 이미지',recipe:'레시피 UI 이미지',table:'바 테이블 위',shelf:'선반 이미지',inventory:'담은 재료 UI'},kind:{ingredient:'재료',glass:'잔',tool:'도구'},topic:{service:'영업 / 손님 상태',dialogue:'말풍선 / 대화 / 선택지',recipe:'레시피 / 재료 준비',gimmick:'제조 기믹',popup:'팝업 / 설정 / 안내',art:'원본 UI 리소스',event:'런타임 이벤트',interaction:'NPC / 오브젝트 상호작용',space:'거리 / 집 / 이동',transition:'로딩 / 일차 전환'}};
function decorate(r){
 const f={media:!r.layers?.length?'none':r.layers.some(l=>(l.frames||1)>1)?'animation':'static'};
 if(['bar-characters','out-characters'].includes(r.group)){
  f.actor=r.title.startsWith('일반 손님')?r.title:r.title.split(' · ')[0];
  const raw=(r.id+' '+r.usage).toLowerCase();
  f.motion=Object.keys(labels.motion).filter(k=>!['other','parts','seated','pov'].includes(k)&&new RegExp('(^|[_:\\s-])'+k+'($|[_:\\s-])').test(raw));
  if(r.id.startsWith('guest'))f.motion=['parts'];
  else if(r.id.endsWith(':pov'))f.motion=['pov'];
  else if(r.id==='outside:terrace')f.motion=['seated'];
  else if(r.id.startsWith('outside-role:')||/^outside:(M1|M2|W1|samho|shiba)$/.test(r.id))f.motion=['idle'];
  if(!f.motion.length)f.motion=['other'];
 }
 if(r.group==='bar-drinks')f.usage=r.id.split(':').at(-1);
 if(r.group==='bar-items'){f.kind=r.itemKind||'ingredient';f.usage=r.id.split(':').at(-1);}
 if(['bar-ui','out-ui'].includes(r.group)){
  const d=r.launch||{},id=d.id||'';
  if(r.id.startsWith('ui-art:'))f.topic='art';
  else if(d.type==='qa')f.topic=id==='prep'?'recipe':['unlock','income','expense','dossier'].includes(id)?'popup':'service';
  else if(['solo','pair','scene','choices','terrace','johnny-memory'].includes(d.type))f.topic='dialogue';
  else if(['recipes','prep-recipe','prep'].includes(d.type)||d.type==='overlay'&&id==='recipe')f.topic='recipe';
  else if(d.type==='mini')f.topic='gimmick';
  else if(['door','day-transition'].includes(d.type))f.topic='transition';
  else if(d.type==='outside')f.topic=id.startsWith('runtime:')?'event':/^(lift-|home-|sofa|terrace|bar)/.test(id)?'space':'interaction';
  else if(d.type==='exterior')f.topic=['street','home','panorama'].includes(id)?'space':['bd','poor'].includes(id)?'interaction':'popup';
  else f.topic='popup';
 }
 return {...r,facets:f};
}
function schema(group){
 if(['bar-characters','out-characters'].includes(group))return [['actor','캐릭터'],['motion','동작 / 상태'],['media','리소스 형태']];
 if(group==='bar-drinks')return [['usage','이미지 용도']];
 if(group==='bar-items')return [['kind','종류'],['usage','이미지 용도']];
 if(group==='bar-serve')return [['media','리소스 형태']];
 return [['topic','화면 용도']];
}
const values=(r,key)=>Array.isArray(r.facets[key])?r.facets[key]:[r.facets[key]];
const matches=(r,picked,skip)=>Object.entries(picked).every(([key,value])=>key===skip||value==='all'||values(r,key).includes(value));
function options(rows,key){const present=new Set(rows.flatMap(r=>values(r,key)).filter(Boolean));return key==='actor'?[...present].map(v=>[v,v]):Object.entries(labels[key]).filter(([v])=>present.has(v));}
const api={decorate,schema,options,matches,values};W.ResourceFilters=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

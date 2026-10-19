window.StudioTimelineGroups=function(api){'use strict';
 const M=StudioModel,root=document.querySelector('#timeline-content'),esc=api.esc;
 const definitions=[['camera','카메라','▣','#a894ec'],['actors','액터','↗','#78bfc0'],['audio','사운드','♫','#d0aa80'],['dialogue','대사 · 입력','▤','#eac582'],['environment','배경 · 오브젝트','▧','#88b5df'],['fx','화면 · 이펙트','✦','#d69da4']];
 const folded=new Set(),details=new Set();let allProperties=false,query='',selectedOnly=false;
 const controls=document.createElement('div');controls.className='timeline-group-tools';controls.innerHTML='<input id="timeline-search" type="search" aria-label="트랙·클립 검색" placeholder="트랙·클립 검색"><label><input id="timeline-selected-only" type="checkbox">선택 대상만</label><button id="timeline-collapse-all" title="재생에는 영향을 주지 않습니다">모두 접기</button><button id="timeline-expand-all">모두 펼치기</button><label><input id="timeline-all-properties" type="checkbox">빈 속성도 표시</label>';document.querySelector('#timeline-frame').before(controls);
 function category(c,p){
  if(c.type==='camera'||c.type==='state'&&c.target==='camera')return 'camera';
  if(c.type==='audio')return 'audio';if(['dialogue','gate'].includes(c.type))return 'dialogue';if(c.type==='fx')return 'fx';
  const visual=c.type==='state'?p.clips.find(v=>v.type==='visual'&&v.actor===c.actor):c;
  const kind=StudioMedia.assets.get(visual?.assetId)?.kind;
  if(kind==='effect')return 'fx';if(kind==='object')return 'environment';
  return 'actors';
 }
 function buckets(){
  const p=api.project(),groups=definitions.map(([id,name,icon,color])=>({id,name,icon,color,targets:[]}));
  function insert(g,tr,c){
   const target=c?.actor&&['move','visual','state','dialogue'].includes(c.type)?'actor:'+c.actor:c?.type==='camera'||c?.target==='camera'?'camera':tr.id;
   let t=g.targets.find(t=>t.id===target);
   if(!t){t={id:target,name:target.startsWith('actor:')?(p.actors[c.actor]?.name||tr.name):target==='camera'?'메인 카메라':tr.name,tracks:[],clips:[]};g.targets.push(t);}
   let lane=t.tracks.find(l=>l.track.id===tr.id);if(!lane){lane={track:tr,clips:[]};t.tracks.push(lane);}if(c){lane.clips.push(c);t.clips.push(c);}
  }
  for(const tr of p.tracks){const cs=p.clips.filter(c=>c.track===tr.id).sort((a,b)=>a.start-b.start);if(cs.length)for(const c of cs)insert(groups.find(g=>g.id===category(c,p)),tr,c);else insert(groups.find(g=>g.id===category({type:tr.type},p)),tr);}
  return groups;
 }
 const targetKey=(g,t)=>'target:'+g.id+':'+t.id;
 function ranges(clips,width,color){return '<div class="lane-area group-summary" style="width:'+width+'px;--second-width:'+api.scale()+'px">'+clips.map(c=>'<span class="summary-range" title="'+esc(c.title)+' · '+c.start.toFixed(2)+'s" style="left:'+c.start*api.scale()+'px;width:'+Math.max(2,c.duration*api.scale())+'px;background:'+color+'"></span>').join('')+'</div>';}
 function render(width,clipLane,keyLanes){
  let h='';const keys=api.keyView();
  for(const g of buckets()){
   const chosen=api.selected?.();g.targets=g.targets.filter(t=>(!selectedOnly||t.clips.some(c=>c.id===chosen?.id||c.actor&&c.actor===chosen?.actor))&&(!query||[g.name,t.name,...t.clips.map(c=>c.title+' '+(c.text||''))].some(s=>s.toLowerCase().includes(query))));
   if((query||selectedOnly)&&!g.targets.length)continue;
   const closed=folded.has(g.id),clips=g.targets.flatMap(t=>t.clips);
   h+='<section class="timeline-group" data-timeline-group="'+g.id+'" style="--group-color:'+g.color+'"><div class="lane category-heading"><div class="track-label"><button class="group-fold" data-group-fold="'+g.id+'" aria-expanded="'+!closed+'"><span>'+(closed?'▸':'▾')+'</span> '+g.icon+' '+g.name+'</button><small>'+clips.length+'</small></div>'+ranges(clips,width,g.color)+'</div>';
   if(!closed){
    if(g.id==='environment')h+='<div class="lane background-row"><div class="track-label">기본 배경 · '+(api.project().background==='lab'?'연구소':api.project().background==='stage'?'클립으로 구성':'거리')+'</div><div class="lane-area" style="width:'+width+'px"><span class="background-range" style="width:'+api.project().duration*api.scale()+'px"></span></div></div>';
    if(!g.targets.length&&g.id!=='environment')h+='<div class="group-empty">클립 없음</div>';
    for(const t of g.targets){const id=targetKey(g,t),closed=folded.has(id),props=keys||allProperties||details.has(id),compact=!keys&&!closed&&t.tracks.length===1;
     h+='<section class="timeline-target" data-timeline-target="'+esc(id)+'"><div class="lane target-heading"><div class="track-label"><button data-group-fold="'+esc(id)+'" aria-expanded="'+!closed+'" title="'+esc(t.name)+' 접기 / 펼치기">'+(closed?'▸':'▾')+' '+esc(t.name)+'</button>'+(!keys&&t.clips.some(c=>StudioKeyframes.channels(c).length)?'<button data-target-properties="'+esc(id)+'" aria-pressed="'+props+'" title="속성별 키프레임 표시">◆</button>':'')+'</div>'+ranges(t.clips,width,g.color)+'</div>';
     if(compact){const at=h.lastIndexOf('<div class="lane target-heading">');h=h.slice(0,at);}
     if(!closed)for(const lane of t.tracks){
      if(!keys)h+=clipLane(lane.track,lane.clips,compact?{id,name:t.name,props,hasKeys:t.clips.some(c=>StudioKeyframes.channels(c).length)}:null);
      else if(!lane.clips.length||lane.clips.some(c=>!StudioKeyframes.channels(c).length))h+=clipLane(lane.track,lane.clips.filter(c=>!StudioKeyframes.channels(c).length));
      if(props)h+=keyLanes(lane.clips,allProperties);
     }
     h+='</section>';
    }
   }h+='</section>';
  }return h;
 }
 function reveal(id){for(const g of buckets())for(const t of g.targets)if(t.clips.some(c=>c.id===id)){folded.delete(g.id);folded.delete(targetKey(g,t));}}
 root.addEventListener('click',e=>{const f=e.target.closest('[data-group-fold]'),d=e.target.closest('[data-target-properties]');if(!f&&!d)return;const id=f?.dataset.groupFold||d.dataset.targetProperties,set=f?folded:details;set.has(id)?set.delete(id):set.add(id);api.render();const attr=f?'data-group-fold':'data-target-properties';[...root.querySelectorAll('['+attr+']')].find(b=>b.getAttribute(attr)===id)?.focus({preventScroll:true});});
 document.querySelector('#timeline-collapse-all').onclick=()=>{for(const g of definitions)folded.add(g[0]);api.render();};
 document.querySelector('#timeline-expand-all').onclick=()=>{folded.clear();api.render();};
 document.querySelector('#timeline-all-properties').onchange=e=>{allProperties=e.target.checked;api.render();};
 document.querySelector('#timeline-search').oninput=e=>{query=e.target.value.trim().toLowerCase();api.render();};
 document.querySelector('#timeline-selected-only').onchange=e=>{selectedOnly=e.target.checked;api.render();};
 function scrollTo(id){const scroll=document.querySelector('#timeline-scroll');if(scroll.hidden)return;const el=[...root.querySelectorAll(api.keyView()?'[data-key-group]':'[data-clip]')].find(e=>(e.dataset.keyGroup||e.dataset.clip)===id);if(!el)return;const r=el.getBoundingClientRect(),v=scroll.getBoundingClientRect(),label=innerWidth<=580?132:174;if(r.top<v.top+34)scroll.scrollTop+=r.top-v.top-34;else if(r.bottom>v.bottom)scroll.scrollTop+=r.bottom-v.bottom+4;if(!api.keyView()){if(r.left<v.left+label)scroll.scrollLeft+=r.left-v.left-label-8;else if(r.right>v.right)scroll.scrollLeft+=Math.min(r.right-v.right+8,r.left-v.left-label-8);}}
 return{render,reveal,scrollTo};
};

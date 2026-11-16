/* Create/configure an independent scene without mutating the selected encounter. */
(function(W){'use strict';
const N=W.LunaOutsideNodes,G=()=>W.LunaOutsideGates;
const hints={talk:'화자와 대사를 정하고 다음 핀을 연결',repeat:'같은 인물에게 다시 말을 걸었을 때',choice:'1~4개 응답을 서로 다른 흐름에 연결',condition:'조건 충족 / 그 외 두 갈래',join:'여러 출력에서 한 대화로 합류',effect:'등록된 플래그를 참 또는 거짓으로 기록',notice:'사건 알림을 표시한 뒤 계속 진행'};
function attach(api,viewport,getChart,point,place){
 const palette=W.LunaNodePalette.create(),d=document.createElement('dialog');d.className='street-node-config';d.setAttribute('aria-label','외부 노드 설정');
 d.innerHTML='<form><h2></h2><label>노드 이름<input name="title" maxlength="64" required></label><label title="연결 전에는 이 일차에 해당 인물이 등장할 수 있는 시간대에 보입니다. 연결하면 호출하는 대본의 일차와 출퇴근 구간을 따릅니다.">등록 일차<select name="day"></select></label><label>화자<select name="actor"></select></label><label>첫 대사 / 알림<textarea name="line"></textarea></label><label>플래그<select name="flag"></select></label><label hidden>새 플래그 ID<input name="newFlag" maxlength="64" placeholder="예: newspaper_followup"></label><label>값<select name="value"><option value="true">참</option><option value="false">거짓</option></select></label><footer><button type="button">취소</button><button type="submit">생성</button></footer></form>';document.body.append(d);
 const form=d.querySelector('form'),field=k=>form.elements.namedItem(k);let save;
 d.querySelector('button[type=button]').onclick=()=>d.close();form.onsubmit=e=>{e.preventDefault();if(form.reportValidity()&&save())d.close();};
 function configure(kind,pos,f,edit=false){
  const m=api.model(),first=m.rows(f.id)[0],isRule=['condition','effect'].includes(kind),hasLine=['talk','repeat','join','notice'].includes(kind);
  const cast=[...new Set([...m.rows(f.id).map(r=>r.actor),...m.base.tables.steps.map(r=>r.actor)].filter(a=>a&&a!=='\\N'&&a!=='\\E'))];
  const initial=edit?first.actor:cast.find(a=>a!=='luna')||'luna',rule=edit?(kind==='effect'?first.effects:first.when):'',match=/^flag\.(\w+)\s*={1,2}\s*(true|false)$/.exec(rule||'');
  form.reset();field('title').value=edit?f.title:N.kinds[kind][0];field('line').value=edit?first['text.ko']||'':hasLine?(kind==='notice'?'새 알림':'새 대사'):'';
  const select=(key,items,selected,display=x=>x)=>{const el=field(key);el.replaceChildren(...items.map(k=>new Option(display(k),k)));if(items.includes(selected))el.value=selected;};
  const dates=api.day()===W.LunaOutsideFlowDays.all?[...new Set(getChart().flows.flatMap(api.daysFor))].sort():[api.day()];
  select('day',dates.map(String),String(dates[0]),n=>n+'일차');field('day').disabled=edit||dates.length<2;field('day').closest('label').hidden=edit;
  select('flag',G().flags(m),match?.[1]);field('flag').add(new Option('＋ 새 플래그 만들기…','+'));
  const fresh=()=>{const on=isRule&&field('flag').value==='+';field('newFlag').closest('label').hidden=!on;field('newFlag').required=on;field('newFlag').setCustomValidity('');};field('flag').onchange=fresh;fresh();field('newFlag').oninput=()=>field('newFlag').setCustomValidity('');field('value').value=match?.[2]||'true';select('actor',cast,initial,W.LunaOutsideEditorPreview.label);
  for(const [key,show]of Object.entries({line:hasLine,actor:!isRule&&kind!=='notice',flag:isRule,value:isRule}))field(key).closest('label').hidden=!show;
  d.querySelector('h2').textContent=N.kinds[kind][0]+' · '+(edit?'노드 설정':'독립 노드 생성');d.querySelector('[type=submit]').textContent=edit?'변경 적용':'생성';
  save=()=>api.change(()=>{
   const params={day:Number(field('day').value),title:field('title').value.trim(),actor:field('actor').value||'luna',text:field('line').value.trim()};
   if(hasLine&&!params.text)throw Error('대사 또는 알림 내용을 입력하세요.');
   const node=edit?f:N.newNode(m,f,kind,params),r=m.rows(node.id)[0];
   if(edit){N.rename(m,f,params.title);if(hasLine)m.set(r,'text.ko',params.text);if(!isRule&&kind!=='notice')m.set(r,'actor',params.actor);}
   if(isRule){const key=field('flag').value==='+'?field('newFlag').value.trim():field('flag').value;if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)||/^(?:bp_|graph_seen_)/.test(key)){field('newFlag').setCustomValidity('영문자로 시작하고 영문·숫자·밑줄만 사용하세요. 자동 연결용 이름은 사용할 수 없습니다.');field('newFlag').reportValidity();throw Error('플래그 이름을 확인하세요.');}N.rule(m,node,key,field('value').value);}
   if(!edit)place(node,r,pos);return{flowId:node.id,row_id:r.row_id};});
  d.showModal();field('title').focus();field('title').select();
 }
 function open(x,y){
  const m=api.model(),f=m.flow(api.flow()),pos=point(x,y),supported=N.world(f.ref.source)&&!f.campaign;
  palette.open(x,y,Object.entries(N.kinds).sort((a,b)=>a[1][1].localeCompare(b[1][1],'ko')).map(([key,[name,group,icon]])=>({key,name,group,icon,hint:hints[key],disabled:!supported?'이 대본은 자동 방송·컷씬 전용입니다. 거리나 집의 NPC를 선택하세요.':key==='repeat'&&!N.repeatEntries(m,f).length?'재대화 입구가 없는 일회성 사건입니다.':''})),k=>configure(k,pos,f));
 }
 const center=()=>{const b=viewport.getBoundingClientRect();open(b.left+b.width/2,b.top+b.height/2);};
 viewport.addEventListener('contextmenu',e=>{if(e.target.closest('[data-node]'))return;e.preventDefault();open(e.clientX,e.clientY);});
 viewport.addEventListener('keydown',e=>{if((e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')&&!e.target.closest('[data-node]')){e.preventDefault();center();}});document.getElementById('chart-create').onclick=center;
 return{edit(n){const f=api.model().flow(n.owner||n.flow);if(n.authored)configure(n.authored,null,f,true);},
  remove(n){const m=api.model(),f=m.flow(n.owner||n.flow),chart=getChart(),back=chart.flows.find(k=>!N.shapeOf(k));if(!n.authored||!back||!confirm('이 노드와 이 노드에 꽂힌 연결을 삭제할까요? 실행 취소로 복원할 수 있습니다.'))return;
   api.change(()=>{N.remove(m,f);return{flowId:back.id,row_id:m.rows(back.id)[0].row_id};});}};
}
W.LunaOutsideGraphTools={attach};
})(window);

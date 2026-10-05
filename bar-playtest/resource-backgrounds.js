/* Background review reads the runtime manifests, including residence overrides. */
(function(W){
'use strict';
function build(F){
 const A=F.barData.assets,O=F.LUNA_OUTSIDE_DATA,rows=[];
 const add=(id,area,title,screen,kind,layers,extra={})=>rows.push({id:'bg:'+id,group:area+'-backgrounds',title,usage:screen+' · '+kind,backgroundScreen:screen,backgroundKind:kind,status:'registered',layers,note:'현재 시뮬레이터의 배경 리소스입니다. 레이어 체크를 해제해 분리 상태를 확인할 수 있습니다.',...extra});
 const layer=key=>({key,...A[key],frames:1,source:A[key].source||'data.js · '+key});
 const raw=(key,src,source)=>({key,src,source,frames:1});
 add('bar-composite','bar','바 대화 · 레이어 합성','바 대화','합성',[layer('bar_far'),layer('bar_mid'),layer('bar_front')],{launch:{type:'pair'},note:'원경 → 중경 → 근경을 원본 크기로 합성합니다. 손님·UI·카메라 확대는 실제 화면 테스트에서 확인하세요.'});
 for(const [key,title,kind]of [['bar','풀샷 원본','풀샷'],['bar_far','원경','원경'],['bar_mid','중경','중경'],['bar_front','근경 / 카운터','근경']])add(key,'bar','바 대화 · '+title,'바 대화',kind,[layer(key)],{launch:{type:'pair'},note:key==='bar'?'대화 화면 풀샷 참고 원본입니다. 실제 대화는 분리된 원경·중경·근경을 합성합니다.':'바 대화와 조니의 기억에서 공용으로 사용하는 레이어입니다.'});
 for(const [id,title]of [['glass','잔'],['tool','도구'],['liquor','일반 재료'],['fridge','냉장고']])add('prep-'+id,'bar','재료 담기 · '+title+' 선반','재료 담기','풀샷',[layer('prep_'+id)],{launch:{type:'background',id:'shelf',tab:id},note:'선반 배경 원본입니다. 선택 가능한 재료·잔·도구 이미지는 별도 리소스로 배치됩니다.'});
 for(const [id,key,title]of [['open','gimmick','병따기'],['pour','gimmick','따르기'],['fill_up','gimmick','필업'],['shake','gimmick_shake','쉐이킹'],['stir','gimmick_stir','스터']])add('mini-'+id,'bar',title+' · 제조 배경','제조 기믹','풀샷',[layer(key)],{status:key==='gimmick'?'shared':'registered',launch:{type:'mini',id},note:key==='gimmick'?'병따기·따르기·필업이 같은 제조 공간 이미지를 공유합니다.':'좌측 제조 애니메이션 뒤에 사용하는 배경입니다. 노드·판정·캐릭터는 별도 표시됩니다.'});
 add('serve','bar','제공하기 · 공용 배경','제공하기','풀샷',[raw('serve-background','assets/serve-background.png','serve-view.js')],{launch:{type:'serve',id:'cosmopolitan'},note:'제공 애니메이션의 공용 배경입니다. 진토닉 시트에는 배경이 포함되어 있어 이 공용 배경 대신 시트 전체를 재생합니다.'});
 add('title','bar','메인 타이틀 / 시작 선택 배경','타이틀 / 로딩','풀샷',[raw('title-bg','assets/campaign/title-bg.png','campaign.css')],{launch:{type:'background',id:'title'},note:'타이틀과 시작 선택 화면이 공유하는 원본입니다. 로고·버튼·어두운 그라디언트는 별도 UI입니다.'});
 for(const scene of ['street','home']){
  const screen=scene==='street'?'외부 거리':'집 내부';
  const nodes=O.scenes[scene].nodes.filter(n=>n.active&&n.sprite&&!n.ambient&&!n.tradeActor&&!n.resident&&!n.notionEvent&&!/^(Luna|Samho|SAMHO|Bubi|shiba|Square)/.test(n.name)&&(!F.LunaOutsideContent||[0,1,2,3].some(day=>['in','out'].some(flow=>F.LunaOutsideContent.visibleNode({scene,level:0,config:{day,flow}},n)))));
  const category=n=>/City.*Light/.test(n.name)?'조명':/Elevator/.test(n.name)?'엘리베이터':/residence-building/.test(n.name)?'빌딩':/residence-railing|Fore|Fence/.test(n.name)?'근경':/Back|Sky/.test(n.name)?'원경':/Middle/.test(n.name)?'중경':/Floor/.test(n.name)?'바닥':/main_bg/.test(n.name)?'풀샷':'오브젝트';
  const label=n=>({'residence-building':'거주 빌딩 · 루나 없는 버전','residence-railing':'상층 복도 · 앞 난간',main_bg:'집 내부 · 기본 배경',ForeFore_Object:'집 내부 · 앞쪽 가림',IntractObjects:'집 내부 · 가구 / 상호작용 소품',Sky:'하늘',Fence:'거리 울타리','1F Floor':'거리 바닥','Elevator':'엘리베이터 본체','Elevator Fore':'엘리베이터 전면','Elevator Door':'엘리베이터 문','Elevator Line':'엘리베이터 레일','Bar Spawn Point':'바 출입문',Room_Entrance:'집 현관문',Terrace_Entrance:'테라스 출입문',Hanger:'옷걸이'}[n.name]||n.name);
  const nodeLayer=n=>{const a=O.assets[n.sprite.asset];return {key:n.id+' · '+label(n),src:typeof a==='string'?a:a.src,source:(a.source||a.path||'outside-data.js')+' · '+n.ancestry.join(' / '),frames:1,rects:[{...n.sprite}],w:n.sprite.w,h:n.sprite.h};};
  const seen=new Set();
  for(const n of nodes){const key=[n.name,n.sprite.asset,n.sprite.x,n.sprite.y,n.sprite.w,n.sprite.h].join(':');if(seen.has(key))continue;seen.add(key);add(scene+':'+n.id,'out',label(n),screen,category(n),[nodeLayer(n)],{launch:{type:'exterior',id:scene==='home'?'home':'street'},note:'배치: '+n.ancestry.join(' / ')+' · 정렬 레이어 '+n.layer+' / 순서 '+n.order+' · 월드 좌표 '+n.x+', '+n.y+'. 같은 아트가 반복 배치된 경우 원본은 한 항목으로 모았습니다.'});}
  const sorted=scene==='street'?F.LunaOutside.streetDrawOrder(nodes):nodes.slice().sort((a,b)=>a.name==='main_bg'?-1:b.name==='main_bg'?1:a.name==='ForeFore_Object'?1:b.name==='ForeFore_Object'?-1:a.layer-b.layer||a.order-b.order||b.z-a.z);
  const placements=sorted.map(n=>{const s=n.sprite,w=s.w/s.ppu*Math.abs(n.sx)*100,h=s.h/s.ppu*Math.abs(n.sy)*100,flip=(n.sx<0)!==!!n.flip,flipY=n.sy<0;return{n,x:n.x*100-w*(flip?1-s.pivot.x:s.pivot.x),y:-n.y*100-h*(flipY?s.pivot.y:1-s.pivot.y),w,h,flip,flipY};});
  // Light atlases extend well beyond the visible city. Use the backdrop bounds,
  // and mask the home's right-hand atlas swatches just like the runtime does.
  const bounds=placements.find(p=>p.n.name===(scene==='street'?'Sky':'main_bg'));
  const minX=bounds.x,minY=bounds.y,maxX=scene==='home'?Math.min(bounds.x+bounds.w,353.7):bounds.x+bounds.w,maxY=bounds.y+bounds.h;
  add(scene+'-composite','out',screen+' · 전체 레이어 합성',screen,'합성',placements.map(p=>({...nodeLayer(p.n),placement:{...p,n:undefined,x:p.x-minX,y:p.y-minY},alpha:/City.*Light/.test(p.n.name)?.26:1,blend:/City.*Light/.test(p.n.name)?'screen':'source-over'})),{stage:[maxX-minX,maxY-minY],launch:{type:'exterior',id:scene==='home'?'home':'street'},note:'현재 런타임의 교체된 배경·소품을 월드 배치와 정렬 순서대로 합성합니다. 인물·말풍선·화면 가장자리 음영은 제외합니다. 일차별 소품은 한눈에 검수하도록 함께 표시하며 실제 활성 조건과 카메라 크롭은 화면 테스트에서 확인하세요.'});
 }
 add('terrace','out','테라스 대화 · 합성 배경','테라스','풀샷',[raw('terrace-reference',F.LunaTerrace.asset,'terrace-view.js')],{status:'shared',launch:{type:'terrace',id:'night0'},note:'크리스와 루나가 착석한 모습까지 포함된 합성 이미지입니다. 인물과 배경이 분리된 리소스는 아닙니다.'});
 const flat=(id,title,screen,color,launch,note)=>{const c=F.document.createElement('canvas');c.width=480;c.height=270;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,480,270);add(id,'out',title,screen,'코드 배경',[raw(id,c.toDataURL(),'campaign.css / outside-qa.js')],{status:'code',launch,note});};
 flat('workshop','포트 작업장 · 검은 배경','작업장 / 일차 전환','#000',{type:'terrace',id:'workshop'},'검은 단색 화면 위에 대사창만 표시합니다. 별도 작업장 배경 이미지가 누락된 것이 아닙니다.');
 flat('day','일차 전환 · 검은 배경','작업장 / 일차 전환','#000',{type:'day-transition'},'검은 배경과 Day 숫자로 구성되는 코드 연출입니다.');
 add('door','out','바 출퇴근 · 문 로딩 화면','출입 / 로딩','코드 배경',[],{status:'code',launch:{type:'door',id:'in'},preview:'assets/resource-previews/ui_door_in.jpg',previewNote:'관련 실제 로딩 화면 · 문과 주변 소품 포함',note:'검은 배경에 거리 출입문·주변 소품과 따뜻한 빛을 조합합니다. 별도 풀샷 이미지가 아닙니다. 문 원본은 외부 거리의 바 출입문 항목에서 확인하세요.'});
 add('qa','out','99일차 · 가상 QA 무대','QA 무대','코드 배경',[],{status:'code',launch:{type:'outside',id:'outside_day0_store_passers'},preview:'assets/resource-previews/ui_outside_outside_day0_store_passers.jpg',previewNote:'관련 실제 QA 화면 · 테스트 인물 포함',note:'outside-qa.js에서 그리는 가상 바닥·격자 무대입니다. 거리 배경 이미지가 아니며 별도 아트 파일은 없습니다.'});
 const loading=F.document.createElement('canvas');loading.width=1280;loading.height=720;const ctx=loading.getContext('2d');ctx.scale(1,720/1280);const gradient=ctx.createRadialGradient(640,640,0,640,640,Math.hypot(640,640));gradient.addColorStop(0,'#112838');gradient.addColorStop(1,'#070a14');ctx.fillStyle=gradient;ctx.fillRect(0,0,1280,1280);
 add('loading','bar','공통 로딩 / 엔딩 · 어두운 그라디언트','타이틀 / 로딩','코드 배경',[raw('loading-gradient',loading.toDataURL(),'campaign.css · campaign-loading / campaign-ending')],{status:'code',launch:{type:'background',id:'loading'},note:'로고와 진행 표시 뒤에 깔리는 코드 그라디언트입니다. 별도 배경 아트는 사용하지 않습니다.'});
 return rows;
}
function cinema(F){
 const rows=[],s=F.SHEETS?.lobby_background;
 if(s)rows.push({id:'bg:cinema-lobby',group:'out-backgrounds',title:'연구소 로비 · 배경 원본',usage:'컷씬 · 풀샷',backgroundScreen:'컷씬',backgroundKind:'풀샷',status:'registered',layers:[{key:'lobby_background',src:s.png,source:'cinematic/assets.js · lobby_background',frames:1,rects:s.frames.map(f=>({x:f.sx,y:f.sy,w:f.sw,h:f.sh}))}],note:'BD 전투 컷씬의 로비 배경 원본입니다. 하운드·병력 이미지는 포함하지 않습니다.'});
 for(const [key,title,file]of [['StageCorridor','연구소 복도','stage2'],['StageDisposal','폐기물 처리장 / 루나의 꿈·회상','stage3'],['StageShaft','낙하 통로','stage4']]){
  const s=F[key],c=F.document.createElement('canvas');c.width=s.W;c.height=s.H;s.paint(c.getContext('2d'),0,{door:0,chute:0,alarm:0,console:0,button:0});
  rows.push({id:'bg:cinema-'+file,group:'out-backgrounds',title,usage:'컷씬 · 임시 코드 배경',backgroundScreen:'컷씬',backgroundKind:'코드 배경',status:'dummy',layers:[{key,src:c.toDataURL(),source:'cinematic/'+file+'.js · 현재 배경 렌더링',w:s.W,h:s.H,frames:1}],note:'현재 컷씬 배경 코드를 인물 없이 렌더링한 정적 미리보기입니다. 전용 완성 배경 이미지가 아닌 임시 코드 배경입니다. 등록된 배경 목록이며 본편에 새 컷씬을 추가하지 않습니다.'});
 }
 return rows;
}
W.ResourceBackgrounds={build,cinema};
})(window);

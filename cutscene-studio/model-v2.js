(function(W){'use strict';
const M=W.StudioModel,oldTemplate=M.template,oldClip=M.clip,oldSample=M.sample;
M.fonts={system:{name:'기본 고딕',css:'-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'},game:{name:'게임 폰트',css:'"StudioGame", sans-serif'},serif:{name:'명조',css:'"AppleMyungjo", "Batang", serif'},mono:{name:'고정폭',css:'"SFMono-Regular", Consolas, "Apple SD Gothic Neo", monospace'}};
Object.assign(M.kinds,{visual:{name:'에셋 / 오브젝트',icon:'▧',color:'#88b5df'},audio:{name:'사운드',icon:'♫',color:'#d0aa80'}});
M.effects=['fadeIn','fadeOut','flash','shake','noise','letterbox','zoomPunch','vignette','tint','scanline','speedline','door'];
M.clip=function(type,start,extra={}){if(type==='visual')return{id:'clip-'+crypto.randomUUID(),type,track:'visual',title:'이미지 / 애니메이션',start,duration:4,assetId:'',actor:'',from:{x:-3,y:-.7},to:{x:-3,y:-.7},scale:1,rotation:0,opacity:1,layer:0,animSpeed:1,loop:true,facing:'left',ease:'linear',blend:'source-over',...extra};if(type==='audio')return{id:'clip-'+crypto.randomUUID(),type,track:'audio',title:'사운드',start,duration:2,assetId:'',volume:.5,fadeIn:0,fadeOut:.1,offset:0,loop:false,...extra};return oldClip(type,start,type==='dialogue'?{fontFamily:'system',fontScale:100,...extra}:extra);};
M.normalize=p=>{p.assets??=[];p.tracks.forEach(t=>{t.height??=48;});p.clips.forEach(c=>{if(c.type==='dialogue'){c.fontFamily??='system';c.fontScale??=100;}});return p;};
M.template=function(id){const p=M.normalize(oldTemplate(id));if(id!=='lab')return p;
 p.name='연구소 로비';p.duration=42;p.background='lab';p.camera={x:-.3,y:.05,w:6.8};p.visibleActors=[];p.tracks=[];p.clips=[];
 const track=(id,type,name)=>p.tracks.push({id,type,name,muted:false,height:48});
 track('camera','camera','카메라');track('captain','visual','팀장');track('soldiers','visual','대원');track('hound','visual','하운드');track('dialogue','dialogue','대사');track('fx','fx','충격 / 화면');track('fx2','fx','노이즈 / 조명');track('door','fx','로비 문');track('audio','audio','무전 / 충돌');
 const actor=(id,name)=>{p.actors[id]={name,x:0,y:-.7,facing:'left',asset:true};p.visibleActors.push(id);};actor('captain','팀장');actor('soldier','대원');actor('hound','하운드');
 const visual=(actor,assetId,start,duration,x,x2,track,scale=1)=>M.clip('visual',start,{actor,assetId,title:p.actors[actor].name+' · '+assetId.replace('lab-',''),track,duration,from:{x,y:-.7},to:{x:x2,y:-.7},scale,facing:actor==='hound'?'right':'left',loop:!/(punch|charge|up)$/.test(assetId)});
 const line=(start,actor,text,duration=4)=>M.clip('dialogue',start,{actor,text,title:p.actors[actor].name+' · '+W.StudioTags.parse(text).text.slice(0,16),duration,wait:true,offset:.75});
 p.clips=[visual('captain','lab-sol-idle',0,31,.3,.3,'captain'),visual('soldier','lab-sol-idle',0,23,1.2,1.2,'soldiers'),visual('soldier','lab-sol-fire',23,8,1.2,1.2,'soldiers'),visual('hound','lab-hound-punch',20,2,-2.4,-2.4,'hound',1.2),visual('hound','lab-hound-idle',22,6,-2.4,-1.3,'hound',1.2),visual('hound','lab-hound-charge',28,3,-1.3,.1,'hound',1.2),visual('hound','lab-hound-up',31,3,.1,.4,'hound',1.2),
  M.clip('camera',0,{duration:4,from:{...p.camera,w:8.8},to:p.camera,title:'로비 · 접근'}),M.clip('camera',18,{duration:3,from:p.camera,to:{x:-1.1,y:.1,w:5.8},title:'정문 · 이동'}),M.clip('camera',29,{duration:3,from:{x:-1.1,y:.1,w:5.8},to:{x:.2,y:.1,w:4.8},title:'충돌 · 클로즈업'}),
  line(2,'captain','진입조[T:0.35] 상황 보고해라.'),line(6.5,'captain','여기는 진입조.[T:0.35] 현재 지하 3층까지 [c:#ff5566][shake]폐기 프로토콜[/shake][/c] 완료했습니다.',6),line(13,'captain','팀장님!![T:0.6] 정문 쪽에 [shake:2]무언가 접근하고 있습니다![/shake]',5),line(23,'captain','[noise]전파 방해[/noise]…[T:0.4][c:#ffb05c][shake:2]전원 사격![/shake][/c]',5),
  M.clip('fx',0,{effect:'fadeIn',duration:1.5}),M.clip('fx',13,{track:'fx2',effect:'noise',duration:5,strength:.35,title:'무전 간섭'}),M.clip('fx',19,{track:'fx2',effect:'tint',duration:15,strength:.2,color:'#ff3344',title:'경고등'}),M.clip('fx',20,{track:'door',effect:'door',duration:.1,title:'로비 문 파괴'}),M.clip('fx',20,{effect:'shake',duration:1,strength:.8,title:'문 파괴 · 흔들림'}),M.clip('fx',21,{effect:'flash',duration:.35,strength:.65,title:'충격 · 섬광'}),M.clip('fx',28,{effect:'zoomPunch',duration:.7,strength:.65,title:'돌진 · 줌 충격'}),M.clip('fx',31,{effect:'speedline',duration:3,strength:.6,title:'강하 · 속도선'}),M.clip('fx',35,{effect:'fadeOut',duration:7,title:'암전'}),
  M.clip('audio',2,{assetId:'lab-radio',duration:10,loop:true,volume:.3,fadeIn:.2,fadeOut:.5,title:'무전 노이즈'}),M.clip('audio',18.5,{assetId:'lab-beep',title:'경고음'}),M.clip('audio',20,{assetId:'lab-impact',title:'문 충돌'}),M.clip('audio',31,{assetId:'lab-impact',title:'타격'})];
 return p;
};
M.sample=function(p,t){const s=oldSample(p,t);for(const a of Object.values(s.actors))if(a.asset)a.active=false;
 for(const c of p.clips.filter(c=>c.type==='visual'&&t>=c.start&&t<c.start+c.duration&&!p.tracks.find(tr=>tr.id===c.track)?.muted).sort((a,b)=>a.start-b.start)){
  const u=M.ease(M.clamp((t-c.start)/c.duration,0,1),c.ease,c.easeCurve);s.actors[c.actor]={...s.actors[c.actor],...c,x:M.lerp(c.from.x,c.to.x,u),y:M.lerp(c.from.y,c.to.y,u),asset:true,active:true,age:t-c.start};
 }return s;};
M.validate=function(input){const p=M.copy(input),num=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b,id=s=>typeof s==='string'&&/^[\w-]{1,100}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s),str=(s,n)=>typeof s==='string'&&s.length<=n,point=(v,cam=false)=>v&&num(v.x,-100,100)&&num(v.y,-50,100)&&(!cam||num(v.w,2,40));
 if(!p||p.format!=='unknown-cutscene'||p.version!==1||!str(p.name,100)||!num(p.duration,.1,600)||!['street','lab','stage'].includes(p.background)||!point(p.camera,true))throw Error('시퀀스 정보가 올바르지 않습니다.');
 M.normalize(p);if(!Array.isArray(p.tracks)||p.tracks.length>80||!Array.isArray(p.clips)||p.clips.length>2000||!Array.isArray(p.assets)||p.assets.length>100||p.assets.some(a=>!id(a)))throw Error('트랙·클립·에셋 수를 확인하세요.');
 const ids=new Set();for(const t of p.tracks){if(!id(t.id)||ids.has(t.id)||!Object.hasOwn(M.kinds,t.type)||!str(t.name,100)||typeof t.muted!=='boolean'||!num(t.height,32,180))throw Error('트랙 설정이 올바르지 않습니다.');ids.add(t.id);}
 if(!p.actors||Object.keys(p.actors).length>100||!Array.isArray(p.visibleActors))throw Error('액터 정보가 올바르지 않습니다.');for(const [key,a]of Object.entries(p.actors))if(!id(key)||!point(a)||!str(a.name,100)||!['left','right'].includes(a.facing))throw Error('액터 좌표를 확인하세요.');if(p.visibleActors.some(a=>!Object.hasOwn(p.actors,a)))throw Error('액터를 찾을 수 없습니다.');
 ids.clear();for(const c of p.clips){if(!c||!id(c.id)||ids.has(c.id)||!Object.hasOwn(M.kinds,c.type)||!str(c.title,200)||!num(c.start,0,600)||!num(c.duration,.1,600)||!p.tracks.some(t=>t.id===c.track&&t.type===c.type))throw Error('클립과 트랙을 확인하세요.');ids.add(c.id);
  if(['move','visual','dialogue'].includes(c.type)&&!Object.hasOwn(p.actors,c.actor))throw Error('화자·액터 연결이 없습니다.');
  if(['move','visual','camera'].includes(c.type)&&(!point(c.from,c.type==='camera')||!point(c.to,c.type==='camera')||!['linear','smooth','in','out','custom'].includes(c.ease)))throw Error('이동 설정이 올바르지 않습니다.');
  if((c.ease==='custom'||c.easeCurve!==undefined)&&!M.validCurve(c.easeCurve))throw Error('보간 제어점은 0–1 범위의 숫자 4개여야 합니다.');
  if(c.type==='move'&&(!['idle','walk','run'].includes(c.animation)||!num(c.animSpeed,.1,4)||!['left','right','auto'].includes(c.facing)))throw Error('동작 설정을 확인하세요.');
  if(c.type==='dialogue'&&(!str(c.text,4000)||typeof c.wait!=='boolean'||!num(c.cps,1,100)||!num(c.offset,.2,4)||!['typewriter','instant','emphasis','shake'].includes(c.textEffect)))throw Error('대사 설정을 확인하세요.');
  if(c.type==='dialogue'&&(!Object.hasOwn(M.fonts,c.fontFamily)||!num(c.fontScale,50,200)))throw Error('대사 글꼴·크기 설정을 확인하세요.');
  if(c.type==='dialogue'&&(c.bubbleWidth!==undefined&&!num(c.bubbleWidth,.5,12)||c.offsetX!==undefined&&!num(c.offsetX,-10,10)||c.layout!==undefined&&!['bubble','tv','documentary'].includes(c.layout)||c.overlay!==undefined&&typeof c.overlay!=='boolean'))throw Error('대사 배치 설정을 확인하세요.');
  if(c.type==='fx'&&(!M.effects.includes(c.effect)||!num(c.strength,0,1)||(c.color&&!/^#[\da-f]{6}$/i.test(c.color))))throw Error('화면 효과를 확인하세요.');
  if(c.type==='visual'&&(!id(c.assetId)||!num(c.scale,.05,10)||!num(c.rotation,-360,360)||!num(c.opacity,0,1)||!num(c.layer,-10,10)||!num(c.animSpeed,.1,4)||typeof c.loop!=='boolean'||!['left','right'].includes(c.facing)||!['source-over','screen','lighter'].includes(c.blend)))throw Error('에셋 클립 설정을 확인하세요.');
  if(c.type==='audio'&&(!id(c.assetId)||!num(c.volume,0,1)||!num(c.offset,0,600)||!num(c.fadeIn,0,600)||!num(c.fadeOut,0,600)||typeof c.loop!=='boolean'))throw Error('사운드 설정을 확인하세요.');
  if(c.type==='gate'&&c.key!=='E')throw Error('입력 키를 확인하세요.');
 }return p;
};
const priorIssues=M.issues;M.issues=p=>priorIssues(p).filter(i=>{const c=p.clips.find(c=>c.id===i.id);return !(['visual','audio'].includes(c?.type)&&i.text.includes('겹칩니다'));});
})(typeof window==='undefined'?globalThis:window);

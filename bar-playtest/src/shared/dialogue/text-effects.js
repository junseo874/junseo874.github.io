/* Safe, shared text markup for the bar and its editor. Never inject author HTML. */
(function(root){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function compile(raw,tags=[],speed=50){
 const glyphs=[],errors=[],stack=[],style={speed},waits=new Map();let current=style;
 for(const part of String(raw??'').split(/(<[^>]*>)/g)){
  if(!part.startsWith('<')){for(const ch of part.split(''))glyphs.push({ch,...current});continue;}
  const token=part.slice(1,-1),closing=token[0]==='/',body=closing?token.slice(1):token;
  const name=body.split(/[ =]/)[0],alias=tags.find(t=>t.tag===name);
  if(/^\d+$/.test(body)&&!closing){const v=Number(body);if(v<=60000)waits.set(glyphs.length,(waits.get(glyphs.length)||0)+v);else errors.push('대기 태그는 0~60000ms입니다.');continue;}
  if(body==='br'&&!closing){glyphs.push({ch:'\n',...current});continue;}
  if(!alias&&!['shake','wave','pop','color','size','b','i','u'].includes(name)){errors.push('지원하지 않는 태그: '+part);continue;}
  if(closing){if(stack.at(-1)?.name!==name){errors.push('닫는 태그 순서 확인: '+part);continue;}current=stack.pop().previous;continue;}
  const next={...current};
  if(alias){if(alias.kind==='color')next.color=alias.value;if(alias.kind==='size_pct')next.size=Number(alias.value);if(alias.kind==='speed_ms')next.speed=Number(alias.value);}
  if(name==='color'){const value=body.slice(6).replace(/^"|"$/g,'');if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))errors.push('색상은 #RRGGBB로 입력하세요.');else next.color=value;}
  if(name==='size'){const value=Number(body.slice(5).replace('%',''));if(!(value>=10&&value<=400))errors.push('글자 크기는 10~400%입니다.');else next.size=value;}
  if(['b','i','u'].includes(name))next[name]=true;
  if(['shake','wave','pop'].includes(name)){
   const settings={shake:{amp:.7,hz:18},wave:{amp:2,hz:2,phase:.65},pop:{peak:1.2,duration:.12}}[name],seen=new Set();
   for(const attr of body.split(/\s+/).slice(1)){
    const [key,value]=attr.split('='),v=Number(value);
    if(!(key in settings)||seen.has(key)||!Number.isFinite(v)||v<0){errors.push('효과 속성 확인: '+attr);continue;}settings[key]=v;seen.add(key);
   }
   if(name==='pop'?(settings.peak<1||settings.peak>4||settings.duration<=0||settings.duration>10):(settings.amp>100||settings.hz>120||(settings.phase||0)>100))errors.push('효과 값이 엔진 허용 범위를 벗어났습니다.');
   next[name]=settings;
  }
  stack.push({name,previous:current});current=next;
 }
 if(stack.length)errors.push('닫히지 않은 태그: '+stack.map(x=>x.name).join(', '));
 return {text:glyphs.map(x=>x.ch).join(''),glyphs,errors,timings:glyphs.map((x,i)=>x.speed+(waits.get(i)||0))};
}
function html(raw,count,tags){
 const {glyphs}=compile(raw,tags);let output='',buffer='',last='';
 const flush=()=>{if(buffer){output+=last?'<span style="'+last+'">'+buffer+'</span>':buffer;buffer='';}};
 glyphs.slice(0,Math.max(0,Math.floor(count))).forEach((x,i)=>{
  const style=[x.color?'color:'+x.color:'',x.size?'font-size:'+x.size+'%':'',x.b?'font-weight:bold':'',x.i?'font-style:italic':'',x.u?'text-decoration:underline':''].filter(Boolean).join(';');
  if(x.shake||x.wave||x.pop){flush();let char=esc(x.ch);for(const kind of ['pop','wave','shake'])if(x[kind]){
   const v=x[kind];char='<span class="dialogue-fx-'+kind+'" style="--fx-amp:'+v.amp+'px;--fx-time:'+(v.duration??(v.hz?1/v.hz:1))+'s;--fx-play:'+(v.hz===0?'paused':'running')+';--fx-delay:'+(-i*(v.phase||.13))+'s;--fx-peak:'+(v.peak||1.2)+'">'+char+'</span>';
  }output+='<span style="'+style+'">'+char+'</span>';last='';}
  else{if(style!==last){flush();last=style;}buffer+=esc(x.ch);}
 });flush();return output;
}
const api={compile,html};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaTextEffects=api;
})(typeof window==='undefined'?globalThis:window);

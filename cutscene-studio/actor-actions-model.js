(function(W){'use strict';
const M=StudioModel,K=StudioKeyframes;
const native=c=>c.actor==='luna'?['idle','walk','run']:c.actor==='samho'?['idle','run']:c.actor==='bubi'?['idle']:[];
const supported=c=>c&&(c.type==='move'&&native(c).length>0||c.type==='visual'&&(['animation','sprite'].includes(W.StudioMedia?.assets.get(c.assetId)?.kind)||c.actionKeys));
const source=c=>c.type==='move'?'native:'+c.animation:c.assetId;
const base=c=>({id:'base',t:0,source:source(c),speed:c.animSpeed??1,loop:c.type==='move'?true:c.loop});
const entries=c=>c.actionKeys?.length?c.actionKeys:[base(c)];
const current=(c,t)=>entries(c).filter(k=>k.t<=t+1e-8).at(-1)||entries(c)[0];
const name=id=>id.startsWith('native:')?({idle:'Idle',walk:'Walk',run:'Run'}[id.slice(7)]||id):W.StudioMedia?.assets.get(id)?.name||id;
function options(p,c){const list=c.type==='move'?native(c).map(id=>({id:'native:'+id,name:{idle:'Idle · 대기',walk:'Walk · 걷기',run:'Run · 달리기'}[id]})):[];const prefix=c.assetId?.startsWith('lab-')?c.assetId.split('-').slice(0,2).join('-')+'-':'';
 const assets=[...(W.StudioMedia?.assets.values()||[])].filter(a=>['animation','sprite'].includes(a.kind)&&(a.builtin||p.assets.includes(a.id))).sort((a,b)=>Number(!!prefix&&b.id.startsWith(prefix))-Number(!!prefix&&a.id.startsWith(prefix))||a.name.localeCompare(b.name));return list.concat(assets.map(a=>({id:a.id,name:a.name})));}
function init(c){if(!c.actionKeys)c.actionKeys=[{...base(c),id:'action-'+crypto.randomUUID()}];return c.actionKeys;}
function register(p,id){if(id.startsWith('native:'))return;const a=W.StudioMedia?.assets.get(id);if(!a||!['animation','sprite'].includes(a.kind))throw Error('애니메이션 또는 단일 스프라이트를 선택하세요.');if(!a.builtin&&!p.assets.includes(id))p.assets.push(id);}
function add(p,c,t){if(!supported(c))throw Error('액터 클립을 선택하세요.');t=M.round(Math.max(0,Math.min(c.duration-1/30,t)));const keys=init(c),same=keys.find(k=>Math.abs(k.t-t)<1/60);if(same)return same;if(keys.length>=200)throw Error('한 액터 클립에는 동작 전환을 최대 200개까지 넣을 수 있습니다.');const k={...current(c,t),id:'action-'+crypto.randomUUID(),t};keys.push(k);keys.sort((a,b)=>a.t-b.t);return k;}
function move(c,id,t){const keys=init(c),i=keys.findIndex(k=>k.id===id);if(i<=0)return;const lo=keys[i-1].t+1/30,hi=(keys[i+1]?.t??c.duration)-1/30;if(lo>hi)return;keys[i].t=M.round(M.clamp(t,lo,hi));}
function edit(p,c,id,field,value){const keys=init(c),k=id==='base'?keys[0]:keys.find(k=>k.id===id);if(!k)return;
 if(field==='source'){if(value.startsWith('native:')&&(c.type!=='move'||!native(c).includes(value.slice(7))))throw Error('이 액터에 없는 기본 동작입니다.');register(p,value);k.source=value;k.loop=value.startsWith('native:')?true:(W.StudioMedia.assets.get(value)?.loop??true);}
 else if(field==='t'){if(!Number.isFinite(Number(value)))throw Error('시간을 숫자로 입력하세요.');move(c,k.id,Number(value));}
 else if(field==='speed'){if(!Number.isFinite(Number(value)))throw Error('배속을 숫자로 입력하세요.');k.speed=M.clamp(Number(value),.1,4);}
 else if(field==='loop')k.loop=!!value;
}
function remove(c,id){if(!c.actionKeys||c.actionKeys[0].id===id)return;c.actionKeys=c.actionKeys.filter(k=>k.id!==id);}
function preset(p,c){if(c.type!=='move'||!native(c).includes('walk')||!native(c).includes('run'))throw Error('Walk와 Run이 있는 액터에서 사용할 수 있습니다.');if(c.duration<.14)throw Error('클립을 조금 늘린 후 적용하세요.');c.actionKeys=['walk','run','walk','idle'].map((action,i)=>({id:'action-'+crypto.randomUUID(),t:M.round(c.duration*i/4),source:'native:'+action,speed:1,loop:true}));}
const previousSample=M.sample;M.sample=function(p,time){const s=previousSample(p,time),effective=W.StudioAuthoringModel?StudioAuthoringModel.effective(p):p,owners=new Map();
 for(const c of effective.clips.filter(c=>['move','visual'].includes(c.type)&&time>=c.start&&time<c.start+c.duration&&!effective.tracks.find(t=>t.id===c.track)?.muted).sort((a,b)=>a.start-b.start))owners.set(c.actor,c);
 for(const [id,c]of owners){if(!c.actionKeys?.length)continue;const a=s.actors[id];if(!a)continue;const k=current(c,time-c.start),age=Math.max(0,time-c.start-k.t);a.actionKey=k.id;a.actionAge=age;a.animSpeed=k.speed;a.loop=k.loop;
  if(k.source.startsWith('native:')){a.asset=false;a.animation=k.source.slice(7);}else{a.asset=true;a.assetId=k.source;a.active=a.visible>=.5&&(a.active??true);a.age=age;a.scale??=1;a.rotation??=0;a.blend??='source-over';}
 }return s;};
const previousResize=K.resize;K.resize=function(c,oldDuration){previousResize(c,oldDuration);if(oldDuration>0&&oldDuration!==c.duration)for(const k of c.actionKeys||[])k.t=k.t/oldDuration*c.duration;};
const previousValidate=M.validate;M.validate=function(input){const p=previousValidate(input);for(const c of p.clips){if(c.actionKeys===undefined)continue;if(!['move','visual'].includes(c.type)||!Array.isArray(c.actionKeys)||!c.actionKeys.length||c.actionKeys.length>200)throw Error('액터 동작 전환 목록을 확인하세요.');let last=-1;const ids=new Set();for(const k of c.actionKeys){if(!k||!/^action-[\w-]{1,100}$/.test(k.id)||ids.has(k.id)||!Number.isFinite(k.t)||k.t<0||k.t>=c.duration||k.t<=last||last<0&&k.t!==0||typeof k.source!=='string'||!Number.isFinite(k.speed)||k.speed<.1||k.speed>4||typeof k.loop!=='boolean')throw Error('동작 전환의 시간·배속·반복을 확인하세요.');if(k.source.startsWith('native:')){if(c.type!=='move'||!native(c).includes(k.source.slice(7)))throw Error('액터와 기본 동작이 맞지 않습니다.');}else if(!/^[\w-]{1,100}$/.test(k.source)||['__proto__','constructor','prototype'].includes(k.source)||!k.source.startsWith('lab-')&&!p.assets.includes(k.source))throw Error('동작에 연결된 에셋이 없습니다.');ids.add(k.id);last=k.t;}}return p;};
const previousIssues=M.issues;M.issues=p=>{const list=previousIssues(p);for(const c of p.clips)for(const k of c.actionKeys||[]){if(!k.source.startsWith('native:')&&!['sprite','animation'].includes(W.StudioMedia?.assets.get(k.source)?.kind))list.push({id:c.id,text:c.title+' — 동작 리소스를 불러오지 못했습니다: '+k.source});}return list;};
W.StudioActorActions={native,supported,entries,current,name,options,init,add,edit,move,remove,preset};
})(window);

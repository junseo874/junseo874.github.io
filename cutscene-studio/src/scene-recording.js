(function(W){'use strict';
const M=StudioModel,K=StudioKeyframes;
const defaults=a=>({x:a.x??0,y:a.y??0,w:a.w??6,scale:a.scale??1,rotation:a.rotation??0,opacity:a.opacity??1,red:a.red??1,green:a.green??1,blue:a.blue??1,visible:a.asset&&!a.active?0:a.visible??1,flipX:a.flipX??0});
function targetState(p,target,time){const s=M.sample(p,time);return target.kind==='camera'?s.camera:s.actors[target.id];}
function matches(c,target){return target?.kind==='actor'?(['move','visual'].includes(c.type)&&c.actor===target.id||c.type==='state'&&c.target==='actor'&&c.actor===target.id):target?.kind==='camera'?(c.type==='camera'||c.type==='state'&&c.target==='camera'):c.type===target?.kind&&c.id===target.id;}
function resolve(p,target,time){
 if(target?.clipId)return p.clips.find(c=>c.id===target.clipId&&matches(c,target));
 if(['audio','fx'].includes(target?.kind))return p.clips.find(c=>matches(c,target));
 const candidates=p.clips.filter(c=>matches(c,target)&&!p.tracks.find(t=>t.id===c.track)?.muted).sort((a,b)=>a.start-b.start);
 return candidates.filter(c=>c.type!=='state'&&c.start<=time&&time<c.start+c.duration).at(-1)||candidates.filter(c=>c.type==='state'&&c.start<=time).at(-1);
}
function writeClip(c,time,props){
 if(time<c.start-.001||time>c.start+c.duration+.001)throw Error('재생 헤드를 선택한 클립 안으로 옮겨 주세요.');
 const local=M.clamp(time-c.start,0,c.duration),entries=Object.entries(props).filter(([ch,v])=>K.channels(c).includes(ch)&&Number.isFinite(Number(v)));
 for(const [ch]of entries)if((c.keyframes?.[ch]?.length||0)>=200&&!c.keyframes[ch].some(k=>Math.abs(k.t-local)<.0005))throw Error('한 속성에는 최대 200개의 키를 넣을 수 있습니다.');
 c.keyframes??={};
 for(const [ch,raw]of entries){const ease=['visible','flipX'].includes(ch)?'hold':'inherit';
  c.keyframes[ch]??=local>0?[{id:'key-'+crypto.randomUUID(),t:0,value:K.value(c,ch,0),ease}]:[];
  const keys=c.keyframes[ch];let key=keys.find(k=>Math.abs(k.t-local)<.0005);
  if(!key){key={id:'key-'+crypto.randomUUID(),t:local,value:0,ease};keys.push(key);keys.sort((a,b)=>a.t-b.t);}
  key.value=M.clamp(Number(raw),K.fields[ch].min,K.fields[ch].max);K.markEdited(c,ch);
 }
 return c;
}
function write(p,target,time,props){
 time=M.clamp(time,0,600);
 let c=resolve(p,target,time);if(window.StudioAuthoringModel?.locked(p,c))throw Error("잠긴 트랙입니다.");
 if(target.clipId&&!c)throw Error('선택한 클립이 없습니다. 다시 선택해 주세요.');
 if(target.clipId&&(time<c.start-.001||time>c.start+c.duration+.001))throw Error('재생 헤드를 선택한 클립 안으로 옮겨 주세요.');
 if(c&&c.type!=='state')return writeClip(c,time,props);
 if(['audio','fx'].includes(target.kind))throw Error('선택한 클립이 없습니다.');
 if(!c){const a=targetState(p,target,0);if(!a)throw Error('선택한 오브젝트가 없습니다.');const tr={id:'track-'+crypto.randomUUID(),type:'state',name:(target.kind==='camera'?'카메라':p.actors[target.id].name)+' · 키',height:48,muted:false};p.tracks.push(tr);c=M.clip('state',0,{track:tr.id,target:target.kind,actor:target.kind==='actor'?target.id:undefined,title:tr.name,duration:Math.max(.1,p.duration,time),defaults:defaults(a)});p.clips.push(c);}
 if(!target.clipId)c.duration=Math.max(c.duration,p.duration-c.start,time-c.start);c.keyframes??={};const local=M.clamp(time-c.start,0,c.duration);
 for(const [ch,raw]of Object.entries(props)){if(!K.channels(c).includes(ch))continue;const v=M.clamp(Number(raw),K.fields[ch].min,K.fields[ch].max);if(!Number.isFinite(v))continue;let keys=c.keyframes[ch];if(!keys){keys=c.keyframes[ch]=[];if(local>0)keys.push({id:'key-'+crypto.randomUUID(),t:0,value:c.defaults[ch],ease:['visible','flipX'].includes(ch)?'hold':'linear'});}let key=keys.find(k=>Math.abs(k.t-local)<.0005);if(!key){if(keys.length>=200)throw Error('한 속성에는 최대 200개의 키를 넣을 수 있습니다.');key={id:'key-'+crypto.randomUUID(),t:local,value:v,ease:['visible','flipX'].includes(ch)?'hold':'linear'};keys.push(key);keys.sort((a,b)=>a.t-b.t);}key.value=v;}
 return c;
}
const rgb=a=>'#'+['red','green','blue'].map(ch=>Math.round(M.clamp(a[ch]??1,0,1)*255).toString(16).padStart(2,'0')).join('');
const color=hex=>Object.fromEntries(['red','green','blue'].map((ch,i)=>[ch,parseInt(hex.slice(1+i*2,3+i*2),16)/255]));
W.StudioRecording={write,resolve,matches,targetState,defaults,rgb,color};
})(window);

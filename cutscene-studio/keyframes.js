(function(W){'use strict';
const M=W.StudioModel;
M.kinds.state={name:'오브젝트 키',icon:'◆',color:'#db9fb5'};const originalClip=M.clip;M.clip=(type,start,extra={})=>type==='state'?{id:'clip-'+crypto.randomUUID(),type,track:'state',title:'오브젝트 키',start,duration:10,target:'actor',actor:'luna',defaults:{x:0,y:0,w:6,scale:1,rotation:0,opacity:1,red:1,green:1,blue:1,visible:1,flipX:0},ease:'linear',...extra}:originalClip(type,start,extra);
const fields={x:{name:'위치 X',min:-100,max:100},y:{name:'위치 Y',min:-50,max:100},w:{name:'카메라 폭',min:2,max:40},scale:{name:'크기',min:.05,max:10},rotation:{name:'회전',min:-360,max:360},opacity:{name:'불투명도',min:0,max:1},volume:{name:'볼륨',min:0,max:1},strength:{name:'효과 강도',min:0,max:1},red:{name:'색상 R',min:0,max:1},green:{name:'색상 G',min:0,max:1},blue:{name:'색상 B',min:0,max:1},visible:{name:'표시 여부',min:0,max:1},flipX:{name:'좌우 반전',min:0,max:1}};
const actorChannels=['x','y','scale','rotation','opacity','red','green','blue','visible','flipX'];
const types={camera:['x','y','w'],move:actorChannels,visual:actorChannels,audio:['volume'],fx:['strength'],state:actorChannels};
const modes=['inherit','linear','smooth','in','out','custom','hold'];
const channels=c=>c.type==='state'&&c.target==='camera'?['x','y','w']:types[c.type]||[];
function base(c,channel,t){if(c.type==='state')return c.defaults[channel];if(['x','y','w'].includes(channel))return M.lerp(c.from[channel],c.to[channel],M.ease(M.clamp(t/c.duration,0,1),c.ease,c.easeCurve));return c[channel]??(['scale','opacity','red','green','blue','visible'].includes(channel)?1:0);}
function markEdited(c,ch){if(['camera','move','visual'].includes(c.type)){c.localOverrides??={};c.localOverrides[ch]=true;}}
function value(c,channel,t){const keys=c.keyframes?.[channel];if(!keys?.length)return base(c,channel,t);if(t<=keys[0].t)return keys[0].value;
 for(let i=1;i<keys.length;i++){const a=keys[i-1],b=keys[i];if(t<b.t){if(a.ease==='hold'||['visible','flipX'].includes(channel))return a.value;const mode=a.ease==='inherit'?(c.ease||'linear'):a.ease,curve=a.ease==='inherit'?c.easeCurve:a.easeCurve;return M.lerp(a.value,b.value,M.ease((t-a.t)/(b.t-a.t),mode,curve));}}
 return keys.at(-1).value;
}
const values=(c,t)=>Object.fromEntries(channels(c).map(channel=>[channel,value(c,channel,t)]));
const uid=()=> 'key-'+crypto.randomUUID();
// Legacy clips animate from/to without explicit keys. Materialize once after clip
// setup, keeping the same endpoints and inherited easing (including custom curves).
function hydrate(project){for(const c of project.clips){
 if(!['camera','move','visual'].includes(c.type)||c.transformKeysInitialized)continue;
 c.keyframes??={};
 for(const ch of c.type==='camera'?['x','y','w']:['x','y'])if(!c.keyframes[ch]?.length){
  c.keyframes[ch]=[{id:uid(),t:0,value:c.from[ch],ease:'inherit'},{id:uid(),t:c.duration,value:c.to[ch],ease:'inherit'}];
 }
 c.transformKeysInitialized=true;
}}
function remove(c,ch,id){const keys=c.keyframes?.[ch];if(!keys)return;
 markEdited(c,ch);
 const removed=keys.find(k=>k.id===id);c.keyframes[ch]=keys.filter(k=>k.id!==id);
 if(c.keyframes[ch].length)return;
 // Deleting the last key must not resurrect the old from/to movement.
 if(removed&&c.transformKeysInitialized&&['x','y','w'].includes(ch)&&c.from&&c.to){c.from={...c.from,[ch]:removed.value};c.to={...c.to,[ch]:removed.value};}
 delete c.keyframes[ch];
}
function add(c,channel,t){markEdited(c,channel);t=M.clamp(t,0,c.duration);c.keyframes??={};if(!c.keyframes[channel]?.length)c.keyframes[channel]=[{id:uid(),t:0,value:base(c,channel,0),ease:'inherit'},{id:uid(),t:c.duration,value:base(c,channel,c.duration),ease:'inherit'}];const existing=c.keyframes[channel].find(k=>Math.abs(k.t-t)<.001);if(existing)return existing;
 const key={id:uid(),t,value:value(c,channel,t),ease:'inherit'};c.keyframes[channel].push(key);c.keyframes[channel].sort((a,b)=>a.t-b.t);return key;
}
function resize(c,oldDuration){if(oldDuration===c.duration)return;for(const keys of Object.values(c.keyframes||{}))for(const k of keys)k.t=k.t/oldDuration*c.duration;if(c.type==="audio"){c.fadeIn=c.fadeIn/oldDuration*c.duration;c.fadeOut=c.fadeOut/oldDuration*c.duration;}}
function endpoint(c,side,axis,v){c[side]={...c[side],[axis]:v};const keys=c.keyframes?.[axis];if(keys?.length||c.transformKeysInitialized){const key=add(c,axis,side==='from'?0:c.duration);key.value=v;}}
function audioGain(c,t){const fade=Math.min(1,c.fadeIn?t/c.fadeIn:1,c.fadeOut?(c.duration-t)/c.fadeOut:1);return M.clamp(value(c,'volume',t)*fade,0,1);}
const priorSample=M.sample;M.sample=function(project,time){const s=priorSample(project,time),enabled=project.clips.filter(c=>time>=c.start&&!project.tracks.find(tr=>tr.id===c.track)?.muted).sort((a,b)=>a.start-b.start);
 for(const c of enabled){const t=M.clamp(time-c.start,0,c.duration);if(c.type==='camera')Object.assign(s.camera,values(c,t));if(c.type==='move'){const a=s.actors[c.actor];Object.assign(a,values(c,t));if(c.facing==='auto'){const delta=value(c,'x',Math.min(c.duration,t+.01))-value(c,'x',Math.max(0,t-.01));if(Math.abs(delta)>.00001)a.facing=delta>0?'right':'left';}}}
 for(const c of enabled)if(c.type==='visual'&&time<c.start+c.duration)Object.assign(s.actors[c.actor],values(c,time-c.start));
 for(const a of Object.values(s.actors)){a.scale??=1;a.rotation??=0;a.opacity??=1;a.red??=1;a.green??=1;a.blue??=1;a.visible??=1;a.flipX??=0;}
 for(const c of enabled.filter(c=>c.type==='state')){const target=c.target==='camera'?s.camera:s.actors[c.actor];if(!target)continue;const local=M.clamp(time-c.start,0,c.duration);if(c.target==='actor'&&c.keyframes?.visible){const visual=project.clips.filter(v=>v.type==='visual'&&v.actor===c.actor&&!project.tracks.find(t=>t.id===v.track)?.muted).sort((a,b)=>a.start-b.start);const v=visual.filter(v=>v.start<=time).at(-1)||visual[0];if(v&&!target.active){Object.assign(target,{...v,x:value(v,'x',M.clamp(time-v.start,0,v.duration)),y:value(v,'y',M.clamp(time-v.start,0,v.duration)),asset:true,age:Math.max(0,time-v.start),active:true});}target.active=value(c,'visible',local)>=.5;}for(const ch of Object.keys(c.keyframes||{}))target[ch]=value(c,ch,local);}
 // Explicit edits of an existing clip win over legacy full-sequence state tracks
 // for those properties only, and only inside that clip's playback interval.
 for(const c of enabled.filter(c=>c.type!=='state'&&c.localOverrides&&time<c.start+c.duration)){
  const a=c.type==='camera'?s.camera:s.actors[c.actor];if(!a)continue;
  for(const ch of channels(c))if(c.localOverrides[ch])a[ch]=value(c,ch,time-c.start);
  if(c.type==='visual'&&c.localOverrides.visible){a.active=a.visible>=.5;if(a.active){a.assetId=c.assetId;a.age=time-c.start;a.animSpeed=c.animSpeed;a.loop=c.loop;}}
 }
 s.fx=s.fx.map(f=>({...f,strength:value(f,'strength',time-f.start)}));return s;
};
const priorValidate=M.validate;M.validate=function(input){const p=priorValidate(input);for(const c of p.clips){if(c.type==='state'){if(c.defaults)c.defaults.flipX??=0;if(!['actor','camera'].includes(c.target)||c.target==='actor'&&!Object.hasOwn(p.actors,c.actor)||!c.defaults||!channels(c).every(ch=>Number.isFinite(c.defaults[ch])&&c.defaults[ch]>=fields[ch].min&&c.defaults[ch]<=fields[ch].max)||!['linear','smooth','in','out','custom'].includes(c.ease))throw Error('오브젝트 키 트랙을 확인하세요.');}if(c.recordChannels!==undefined&&(!c.recordChannels||typeof c.recordChannels!=='object'||Array.isArray(c.recordChannels)||Object.entries(c.recordChannels).some(([ch,v])=>!channels(c).includes(ch)||typeof v!=='boolean')))throw Error('속성 녹화 상태를 확인하세요.');if(c.keyframes===undefined)continue;if(!c.keyframes||typeof c.keyframes!=='object'||Array.isArray(c.keyframes))throw Error('키프레임 데이터를 확인하세요.');const ids=new Set();for(const [channel,keys]of Object.entries(c.keyframes)){if(!channels(c).includes(channel)||!Array.isArray(keys)||!keys.length||keys.length>200)throw Error('키프레임 속성·개수를 확인하세요.');let previous=-1;for(const k of keys){if(!k||typeof k.id!=='string'||!/^key-[\w-]{1,100}$/.test(k.id)||ids.has(k.id)||!Number.isFinite(k.t)||k.t<0||k.t>c.duration+1e-8||k.t<=previous||!Number.isFinite(k.value)||k.value<fields[channel].min||k.value>fields[channel].max||!modes.includes(k.ease)||(k.ease==='custom'||k.easeCurve!==undefined)&&!M.validCurve(k.easeCurve))throw Error('키프레임 시간·값·보간을 확인하세요.');previous=k.t;ids.add(k.id);}}}return p;};
W.StudioKeyframes={fields,channels,value,values,add,resize,endpoint,audioGain,hydrate,remove,markEdited};
})(typeof window==='undefined'?globalThis:window);

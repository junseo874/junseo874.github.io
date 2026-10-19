(function(W){'use strict';
const events=c=>W.StudioTags.parse(c.text).triggers.map((e,i)=>({...e,key:c.id+':'+i,at:c.textEffect==='instant'?0:e.index/c.cps+e.delay}));
function create(){
 let fired=new Set(),bursts=[],clock=0,previousTime=0;
 function reset(project,time){fired=new Set();bursts=[];clock=0;previousTime=time;for(const c of project.clips)if(c.type==='dialogue')for(const e of events(c))if(c.start+e.at<time-1e-7)fired.add(e.key);}
 function fire(e){if(fired.has(e.key))return;fired.add(e.key);bursts.push({...e,start:clock,seed:fired.size});if(bursts.length>32)bursts.shift();}
 function step(project,time,waitingId,waitAge,dt,running,canEmit=()=>true){
  if(!running)return;clock+=dt;bursts=bursts.filter(e=>clock-e.start<e.duration);
  const muted=new Set(project.tracks.filter(t=>t.muted).map(t=>t.id));
  for(const c of project.clips){if(c.type!=='dialogue'||muted.has(c.track)||time<c.start||previousTime>c.start+c.duration&&waitingId!==c.id)continue;
   const elapsed=waitingId===c.id?time-c.start+waitAge:Math.min(c.duration,time-c.start);
   for(const e of events(c))if(e.at<=elapsed+1e-7&&!fired.has(e.key)){const at=waitingId===c.id?time:c.start+Math.min(e.at,Math.max(0,c.duration-1e-6));if(canEmit(c,at))fire(e);else fired.add(e.key);}
  }previousTime=time;
 }
 function reveal(c){for(const e of events(c))fire(e);}
 function sample(){
  // Simultaneous tags count individually, but never stack into an unbounded shake.
  let dominant=null,amplitude=0;
  for(const e of bursts){const age=clock-e.start,u=age/e.duration,a=e.strength*Math.pow(Math.max(0,1-u),2);if(a>amplitude){amplitude=a;dominant={...e,age};}}
  if(!dominant)return{x:0,y:0,active:0,fired:fired.size};
  const {age,seed}=dominant,sign=seed%2?1:-1;
  return{x:28*amplitude*Math.cos(age*79)*sign,y:18*amplitude*Math.cos(age*103+.6)*-sign,active:bursts.length,fired:fired.size};
 }
 return{reset,step,reveal,sample};
}
W.StudioCameraImpulses={create};
})(typeof window==='undefined'?globalThis:window);

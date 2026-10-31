/* Shared reveal deadlines for exterior dialogue and cinematic players.
   Times are dialogue-clock seconds; callers own speed, pause and full reveal. */
(function(W){'use strict';
const cache=new Map();
function timing(text,rate=55,pauses=[]){
 text=String(text||'');rate=Number(rate)>0?Number(rate):55;
 const key=JSON.stringify([text,rate,pauses]);if(cache.has(key))return cache.get(key);
 const chars=Array.from(text),times=[],waits=new Map();let duration=0;
 for(const p of pauses)waits.set(p.index,(waits.get(p.index)||0)+Math.max(0,Number(p.duration)||0));
 for(let i=0;i<chars.length;i++){
  const previous=chars[i-1];
  duration+=(waits.get(i)||0)+(previous==='.'&&chars[i]==='.'?.3:previous==='.'&&chars[i-2]!=='.'?.35:1/rate);
  times.push(duration);
 }
 if(chars.at(-1)==='.'&&chars.at(-2)!=='.')duration+=.35;
 duration+=waits.get(chars.length)||0;
 const result={chars,times,duration};cache.set(key,result);
 if(cache.size>128)cache.delete(cache.keys().next().value);
 return result;
}
function visible(timing,elapsed){
 let lo=0,hi=timing.times.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(timing.times[mid]<=elapsed+1e-9)lo=mid+1;else hi=mid;}
 return lo;
}
W.LunaDialogueRhythm={timing,visible};
})(typeof window==='undefined'?globalThis:window);

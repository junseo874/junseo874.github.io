/* One durable slot per browsing tab; never erase a different editor's draft. */
(function(W){
'use strict';
W.LunaBarDrafts={open(prefix){
 const sessionKey=prefix+'.tab',fresh=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);let id=fresh(),owned=false;
 try{const prior=sessionStorage.getItem(sessionKey);if(prior&&performance.getEntriesByType('navigation')[0]?.type==='reload')id=prior;sessionStorage.setItem(sessionKey,id);}catch{}
 const key=prefix+'.'+id;
 function candidates(){const all=[];for(const k of Object.keys(localStorage)){if(k!==prefix&&!k.startsWith(prefix+'.'))continue;try{const v=JSON.parse(localStorage.getItem(k));if(v?.files)all.push({k,v});}catch{}}return all.sort((a,b)=>Number(b.k===key)-Number(a.k===key)||(b.v.at||0)-(a.v.at||0));}
 return {candidates,write(value){localStorage.setItem(key,JSON.stringify({...value,at:Date.now()}));owned=true;},clear(explicit=false){if(explicit||owned){localStorage.removeItem(key);owned=false;}},restored(k){owned=k===key;}};
}};
})(window);

/* Scene-only placement: actor art, proximity and speech read the same world coordinates.
 * Defer local hot reload across an active encounter; do not teleport a talking NPC. */
(function(W){
'use strict';
const P=W.LunaNpcPlacement;let current=P.empty(),pending=null,loading=null,version=0;const bound=new WeakSet();
const shift=(id,x)=>x+(P.position(current,id)-P.specs[id].x);
const adjust=(id,p)=>p?{...p,x:shift(id,p.x)}:p;
function bind(obj,id){if(!obj||bound.has(obj)||Object.isFrozen(obj))return;const base=obj.x;if(!Number.isFinite(base))return;Object.defineProperty(obj,'x',{enumerable:true,configurable:true,get:()=>shift(id,base)});bound.add(obj);}
function register(){
 const names={'street-beggar':'beggar','street-beggar-witness':'witness','street-newspaper':'newspaper','street-believer':'believer','resident-left':'residents','resident-right':'residents-partner','trade-samho':'trade','trade-smuggler':'trade-partner'};
 const key=id=>{if(names[id])return names[id];const group=['store-pair','bar-pair','commute-pair','reopening-pair'].find(k=>id===k+'-left'||id===k+'-right');return group&&id.endsWith('-right')?group+'-partner':group;};
 for(const p of [...(W.LunaOutsideBeggar?.people||[]),...(W.LunaOutsideResidents?.people||[]),...(W.LunaOutsideAmbient?.placements||[]),...(W.LunaOutsideEncounters?.trading||[])])if(key(p.id))bind(p,key(p.id));
 const actors=W.LunaOutsideNeighborhood?.places;for(const [role,id]of Object.entries({repair:'repair',guard:'guard',boss:'camp',gangmate:'camp-partner',box:'box',cat:'box',neighbor:'box-partner',sofa:'home-cat',chris:'home-cat-partner'}))bind(actors?.[role],id);
 for(const n of W.LUNA_OUTSIDE_DATA?.scenes.street.nodes||[]){const id=key(n.id.replace(/^(ambient-|building-|optional-)/,''));if(id)bind(n,id);}
}
function receive(value){P.validate(value);version++;pending=value;}
function apply(m){if(!pending||m?.encounter||m?.story?.speech||m?.backgroundStory?.speech||[...(m?.backgroundStory?.channels?.values()||[])].some(s=>s.speech))return false;register();current=pending;pending=null;if(m)m.revision++;return true;}
async function ready(){if(!loading){const revision=version;loading=(async()=>{try{const r=await fetch('data/presentation/'+P.file,{cache:'no-cache'});if(!r.ok)throw Error(r.status);const value=await r.json();if(revision===version)receive(value);}catch(e){console.warn('웹 NPC 배치를 불러오지 못해 기본 위치를 사용합니다.',e);loading=null;}})();}await loading;apply();}
W.LunaNpcScene={shift,adjust,receive,apply,ready};
})(window);

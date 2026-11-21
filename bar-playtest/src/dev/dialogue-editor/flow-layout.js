/* Workspace furniture only: none of this is exported with the script. */
(function(W){
'use strict';
const key='luna.bar.graph-workspace.v2',WIDE=236,BASE=238,STEP=24;
const height=ports=>BASE+Math.max(1,ports.length)*STEP+49;
const coordinate=value=>Math.max(24,value);
function preferences(scene){
 let all;try{all=JSON.parse(localStorage.getItem(key))||{};}catch{all={};}
 const s=all[scene]||{};s.direction=s.direction==='down'?'down':'right';
 s.positions||={};s.drafts||={};s.zoom=Number.isFinite(s.zoom)?Math.max(.25,Math.min(3,s.zoom)):.9;
 return {s,save(){try{const fresh=JSON.parse(localStorage.getItem(key)||'{}');fresh[scene]=s;localStorage.setItem(key,JSON.stringify(fresh));}catch{/* Storage-disabled sessions still work in memory. */}}};
}
// Earlier workspaces keyed unfinished pins by the last line, which can move or disappear.
function migrateDraftPins(s,nodes){
 let changed=false;
 for(const n of nodes)for(const r of n.rows){
  const old=r.row_id;if(old===n.id||!Array.isArray(s.drafts[old]))continue;
  s.drafts[n.id]=[...new Set([...(s.drafts[n.id]||[]),...s.drafts[old]])];
  delete s.drafts[old];changed=true;
 }return changed;
}
function place(items,edges,s){
 const depth=new Map(),lanes=new Map(),layout=new Map(),right=s.direction==='right';
 const incoming=new Map();for(const e of edges){if(!incoming.has(e.to))incoming.set(e.to,[]);incoming.get(e.to).push(e.from);}
 for(const item of items){
  const level=Math.max(0,...(incoming.get(item.id)||[]).filter(id=>depth.has(id)).map(id=>depth.get(id)+1));
  depth.set(item.id,level);const lane=lanes.get(level)||[];lane.push(item);lanes.set(level,lane);
 }
 const manual=s.positions[s.direction]||{};let along=58;
 for(const group of lanes.values()){
  let cross=58,breadth=0;
  for(const item of group){
   const h=height(item.ports),p=manual[item.id],pos={x:right?along:cross,y:right?cross:along,h};
   if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){pos.x=coordinate(p.x);pos.y=coordinate(p.y);}
   layout.set(item.id,pos);cross+=(right?h:WIDE)+66;breadth=Math.max(breadth,right?WIDE:h);
  }along+=breadth+(right?112:92);
 }
 return layout;
}
function pin(p,index,total,right){
 if(index<0)return right?{x:p.x,y:p.y+112}:{x:p.x+WIDE/2,y:p.y};
 return right?{x:p.x+WIDE,y:p.y+BASE+STEP*index+STEP/2}:{x:p.x+WIDE*(index+1)/(total+1),y:p.y+p.h};
}
function curve(a,b,right,endRight=right){
 const span=right?Math.abs(b.x-a.x):Math.abs(b.y-a.y),k=Math.max(48,Math.min(170,span*.52));
 return 'M'+a.x+','+a.y+' C'+(a.x+(right?k:0))+','+(a.y+(right?0:k))+' '+(b.x-(endRight?k:0))+','+(b.y-(endRight?0:k))+' '+b.x+','+b.y;
}
W.LunaBarLayout={preferences,migrateDraftPins,place,pin,curve,coordinate,width:WIDE,base:BASE,step:STEP};
})(window);

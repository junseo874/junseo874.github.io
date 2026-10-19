(function(W){'use strict';
const cache=new Map();
function parse(src){
 if(cache.has(src))return cache.get(src);
 const text=String(src).replace(/\\n/g,'\n'),chars=[],pauses=[],triggers=[],stack={c:[],size:[],shake:[],noise:[],censor:[],wave:[],b:[]};
 const token=/\[(\/)?(c|color|size|camshake|shake|noise|censor|wave|b|T|br)(?::([^\]]+))?\]/gi;
 let last=0,m;
 const append=s=>{for(const ch of s)chars.push({ch,color:stack.c.at(-1)||null,size:(stack.size.at(-1)||100)/100,shake:Number(stack.shake.at(-1)||0),noise:!!stack.noise.length,censor:!!stack.censor.length,wave:!!stack.wave.length,bold:!!stack.b.length});};
 while((m=token.exec(text))){append(text.slice(last,m.index));last=token.lastIndex;let tag=m[2].toLowerCase();if(tag==='color')tag='c';const close=!!m[1],v=m[3];
  if(tag==='camshake'){const args=v===undefined?[1,.4]:v.split(',').map(s=>s.trim()),strength=Number(args[0]),duration=args.length===1?.4:Number(args[1]);if(!close&&args.length<=2&&args.every(s=>String(s).length&&Number.isFinite(Number(s)))&&strength>=.1&&strength<=3&&duration>=.05&&duration<=2)triggers.push({type:'camshake',index:chars.length,delay:pauses.reduce((sum,p)=>sum+p.duration,0),strength,duration});else append(m[0]);}
  else if(tag==='t'){if(!close&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0)pauses.push({index:chars.length,duration:Math.min(30,Number(v))});else append(m[0]);}
  else if(tag==='br'){if(!close)append('\n');else append(m[0]);}
  else if(close){if(stack[tag].length)stack[tag].pop();else append(m[0]);}
  else if(tag==='c'){if(/^#[\da-f]{3}([\da-f]{3})?$/i.test(v||''))stack.c.push(v);else append(m[0]);}
  else if(tag==='size'){const size=parseFloat(v);if(/^\d+(\.\d+)?%$/.test(v||'')&&size>=25&&size<=300)stack.size.push(size);else append(m[0]);}
  else if(tag==='shake'){if(v===undefined||Number.isFinite(Number(v)))stack.shake.push(Math.min(5,Math.max(0,Number(v??1))));else append(m[0]);}
  else stack[tag].push(true);
 }
 append(text.slice(last));const value={chars,text:chars.map(c=>c.ch).join(''),pauses,triggers};cache.set(src,value);if(cache.size>100)cache.delete(cache.keys().next().value);return value;
}
function count(parsed,elapsed,cps){let delay=0;for(const p of parsed.pauses){const when=p.index/cps+delay;if(elapsed<when+p.duration)return Math.max(0,Math.min(p.index,Math.floor((elapsed-delay)*cps)));delay+=p.duration;}return Math.max(0,Math.min(parsed.chars.length,Math.floor((elapsed-delay)*cps)));}
W.StudioTags={parse,count};
})(typeof window==='undefined'?globalThis:window);

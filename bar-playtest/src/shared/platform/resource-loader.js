/* Same-origin, bounded scene preparation. Failed requests are retryable, not cached as success. */
(function(W){'use strict';
 const base=new URL('../../../',document.currentScript.src),jobs=new Map(),groups=new Map();
 let manifest;
 async function request(url,cache='default'){
  for(let attempt=0;attempt<2;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
   try{const response=await fetch(url,{signal:controller.signal,cache});if(!response.ok)throw Error(response.status+' '+url);return await response.blob();}
   catch(error){if(attempt===1)throw Error('리소스 로딩 실패: '+url,{cause:error});}
   finally{clearTimeout(timer);}
  }
 }
 function warm(src){
  const url=new URL(src,base).href;
  if(!jobs.has(url))jobs.set(url,request(url).then(()=>undefined).catch(error=>{jobs.delete(url);throw error;}));
  return jobs.get(url);
 }
 async function batch(urls){
  const queue=[...new Set(urls.filter(Boolean))];let index=0;
  await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{while(index<queue.length)await warm(queue[index++]);}));
 }
 async function catalog(){
  // Revalidate the inventory after deployments so removed assets aren't requested from a stale list.
  if(!manifest)manifest=request(new URL('data/presentation/preload-manifest.json',base).href,'no-cache').then(b=>b.text()).then(JSON.parse).catch(e=>{manifest=null;throw e;});
  return manifest;
 }
 function prepare(group){
  if(!groups.has(group))groups.set(group,(async()=>{
   const data=await catalog();if(!data[group])throw Error('Unknown resource group '+group);
   await batch(data[group]);
   // Decode UI before showing it. Huge serving atlases retain their existing
   // per-drink decode gate; warming their bytes must not pin all RGBA sheets.
   const visuals=data[group].filter(src=>/\.(png|webp|jpe?g|gif|svg)$/i.test(src)&&!src.includes('/serving/atlases/'));let index=0;
   await Promise.all(Array.from({length:Math.min(4,visuals.length)},async()=>{while(index<visuals.length)await image(visuals[index++]);}));
   await Promise.all([400,700].map(weight=>document.fonts.load(weight+' 17px LunaPixel','루나 ABC 123')));
  })().catch(e=>{groups.delete(group);throw e;}));
  return groups.get(group);
 }
 async function image(src){
  const img=new Image();img.src=new URL(src,base).href;
  let timer;try{await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('이미지 준비 시간 초과: '+src)),45000);})]);}finally{clearTimeout(timer);}
  return img;
 }
 W.LunaResources={prepare,batch,image};
})(window);

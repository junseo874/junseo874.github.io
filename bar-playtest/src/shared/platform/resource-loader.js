/* Same-origin, bounded scene preparation. Failed requests are retryable, not cached as success. */
(function(W){'use strict';
 const base=new URL('../../../',document.currentScript.src),jobs=new Map(),groups=new Map();
 const pendingImages=new Map(),preparedImages=new Map(),recovered=new Map();
 const pause=()=>new Promise(resolve=>setTimeout(resolve,200));
 let manifest;
 async function request(url,cache='default'){
  for(let attempt=0;attempt<2;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
   try{const response=await fetch(url,{signal:controller.signal,cache:attempt?'reload':cache});if(!response.ok)throw Error('HTTP '+response.status);return await response.blob();}
   catch(error){if(attempt===1)throw Error('리소스 로딩 실패: '+url+' ('+error.message+')',{cause:error});}
   finally{clearTimeout(timer);}
   await pause();
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
 async function prepareImages(sources){
  const queue=[...new Set(sources.filter(Boolean))];let index=0,stopped=false;
  async function worker(){
   try{while(!stopped&&index<queue.length){
    const src=queue[index++],url=new URL(src,base);
    if(!/\.(png|webp|jpe?g|gif|svg)$/i.test(url.pathname)){await warm(src);continue;}
    if(!preparedImages.has(url.href)){
     const img=await image(src);
     if(img.src!==url.href){recovered.set(src,img.src);recovered.set(url.href,img.src);}
     // Reuse the decoded pose on first paint without pinning every multi-layer sheet in memory.
     preparedImages.set(url.href,{src:img.src,ref:typeof WeakRef==='function'?new WeakRef(img):null});
    }
   }}catch(error){stopped=true;throw error;}
  }
  await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
 }
 function prepare(group){
  if(!groups.has(group))groups.set(group,(async()=>{
   const data=await catalog();if(!data[group])throw Error('Unknown resource group '+group);
   await Promise.all([prepareImages(data[group]),document.fonts.load('17px LunaPixel')]);
  })().catch(e=>{groups.delete(group);throw e;}));
  return groups.get(group);
 }
 function image(src){
  const url=new URL(src,base).href;
  const known=preparedImages.get(url),cached=known?.ref?.deref();
  if(cached)return Promise.resolve(cached);
  if(!pendingImages.has(url))pendingImages.set(url,decode(known?.src||url).finally(()=>pendingImages.delete(url)));
  return pendingImages.get(url);
 }
 async function decode(url){
  for(let attempt=0;attempt<2;attempt++){
   const img=new Image();let timer;
   try{
    // A new request bypasses a cached failed response on retry, not a real missing file.
    const target=new URL(url);if(attempt)target.searchParams.set('lunaRetry',String(Date.now()));
    img.src=target.href;
    await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('이미지 준비 시간 초과')),45000);})]);
    return img;
   }catch(error){
    img.src='';
    if(attempt===1)throw Error('이미지 로딩 실패: '+url+' ('+error.message+')',{cause:error});
   }finally{clearTimeout(timer);}
   await pause();
  }
 }
 // Classic scripts execute in the caller's awaited order. Only retry an actual
 // load error (not a timeout that might still execute the original script).
 async function script(src){
  const url=new URL(src,document.baseURI);
  for(let attempt=0;attempt<2;attempt++){
   if(attempt)url.searchParams.set('lunaRetry',String(Date.now()));
   try{return await new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=url.href;el.onload=()=>resolve();
    el.onerror=()=>{el.remove();reject(Error('스크립트 로딩 실패: '+url.href));};document.head.append(el);
   });}catch(e){if(attempt)throw e;await pause();}
  }
 }
 W.LunaResources={prepare,prepareImages,batch,image,request,script,paintSource:src=>recovered.get(src)||src};
})(window);

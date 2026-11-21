// Read-only deployment audit. Run after publishing; does not download asset bodies.
const {execFileSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://junseo874.github.io/';
const files=execFileSync('git',['ls-files','-z','--','bar-playtest/assets','cutscene-studio','bar-playtest/src','bar-playtest/data','assets/site'],{cwd:root}).toString().split('\0')
 .filter(f=>/\.(?:png|jpe?g|webp|gif|svg|ttf|otf|woff2?|mp3|ogg|wav|m4a|mp4|webm|js|css|csv|json)$/i.test(f));
async function main(){
 const bad=[];let index=0;
 async function check(file){
  const url=new URL(file.split('/').map(encodeURIComponent).join('/'),origin);
  for(let i=0;i<2;i++)try{
   const res=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(15000),cache:i?'reload':'default'});
   if(!res.ok||res.headers.get('content-type')?.includes('text/html')||res.headers.get('content-length')==='0')throw Error(res.status+' '+res.headers.get('content-type'));
   return;
  }catch(e){if(i)bad.push({file,error:e.message});}
 }
 await Promise.all(Array.from({length:6},async()=>{while(index<files.length)await check(files[index++]);}));
 console.log(JSON.stringify({origin,checked:files.length,failed:bad.length,errors:bad},null,2));
 if(bad.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

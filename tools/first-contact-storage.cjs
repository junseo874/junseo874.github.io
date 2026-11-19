// The opening is a timeline, not an exterior CSV scene. Only dialogue strings
// can change here; actors, cue IDs and branch wiring come from the live file.
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
async function saveContact(input,{file=path.resolve(__dirname,'../cutscene-studio/data/first-contact.json'),backups=path.resolve(__dirname,'../artifacts/dialogue-editor-backups')}={}){
 const original=await fs.readFile(file,'utf8');
 if(original!==input.original)throw Error('통화 대본이 변경되었습니다. 현재 편집 내용을 보관하고 다시 열어 주세요.');
 const data=JSON.parse(original),fields=data.clips.flatMap((clip,i)=>[[clip,'text'],...(i?[]:clip.choiceAfter.options.flatMap(opt=>[...['label','response','followup'].map(k=>[opt,k]),...(opt.clips||[]).map(line=>[line,'text'])]))]);
 if(!Array.isArray(input.values)||input.values.length!==fields.length)throw Error('통화 대사의 수가 맞지 않습니다.');
 fields.forEach(([obj,key],i)=>{const v=input.values[i];if(typeof v!=='string'||!v.trim()||v.length>(key==='label'?80:500))throw Error('빈 대사 또는 너무 긴 문구입니다.');obj[key]=v;});
 const saved=JSON.stringify(data,null,2)+'\n',tmp=file+'.'+randomUUID()+'.tmp';
 if(saved!==original){await fs.mkdir(backups,{recursive:true});await fs.writeFile(path.join(backups,'first-contact-'+randomUUID()+'.json'),original,{flag:'wx'});
 try{await fs.writeFile(tmp,saved,{flag:'wx'});if(await fs.readFile(file,'utf8')!==original)throw Error('원본이 변경되어 저장하지 않았습니다.');await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
 return {saved:true,original:saved};
}
module.exports={saveContact};

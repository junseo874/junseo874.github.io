const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function captureOutside(root){
 const W={};W.window=W;
 const backup=path.join(root,'artifacts/shared-data-backup/outside');
 function run(file,extras=''){
  const saved=path.join(backup,path.basename(file)),source=fs.readFileSync(fs.existsSync(saved)?saved:path.join(root,'bar-playtest',file),'utf8');
  vm.runInNewContext(extras?source.replace('})(window);',extras+'\n})(window);'):source,W);
 }
 run('src/features/outside/outside-residence.js');run('data/runtime/outside-dialogues.js');
 Object.assign(W,{LUNA_OUTSIDE_DATA:{scenes:{street:{nodes:[]}}},LunaOutsideAmbient:{placements:[]},LunaOutsideEncounters:{cases:[]},barGame:{progress:{flags:{}}}});
 for(const name of ['outside-events','outside-thug'])run('src/features/outside/events/'+name+'.js');
 run('src/features/outside/events/outside-shop.js','W.__shop={intro,revisit,allowance,quizIntro,lesson};');
 run('src/features/outside/events/outside-beggar.js','W.__beggar={intro,paid,refused,warning};');
 const out={};for(const[id,rows]of Object.entries(W.LUNA_OUTSIDE_DIALOGUES))out['ambient/'+id]=rows;
 for(const key of ['intro','paid','refused'])out['thug/'+key]=W.LunaOutsideThug[key];
 out['notion/intro']=W.LunaOutsideNotion.intro;out['notion/contract']=W.LunaOutsideNotion.contractRows;
 for(const[key,rows]of Object.entries(W.LunaOutsideNotion.infoRows))out['notion/info/'+key]=rows;
 for(const[key,rows]of Object.entries(W.__shop))out['shop/'+key]=rows;
 for(const key of ['intro','paid','refused'])out['beggar/'+key]=W.__beggar[key];
 for(const [name,flags]of [['unmet',{}],['met',{street_beggar_met:true}],['paid',{street_beggar_paid:true}]]){W.barGame.progress.flags=flags;out['beggar/warning/'+name]=W.__beggar.warning();}
 return JSON.parse(JSON.stringify(out));
};

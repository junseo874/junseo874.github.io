// Mechanical import of the supplied standalone prototype; never changes campaign data.
const fs=require('node:fs'),path=require('node:path');
const source=process.argv[2];
if(!source)throw Error('Usage: node tools/import-shaking-prototype.cjs <supplied HTML>');
const out=path.resolve(__dirname,'../bar-playtest/src/dev/shaking');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
let serial=0;
let html=fs.readFileSync(source,'utf8').replace(/data:([^;,]+);base64,([A-Za-z0-9+/=]+)/g,(_,mime,base64)=>{
 const ext=({'image/png':'png','image/webp':'webp','font/woff2':'woff2'})[mime];
 if(!ext)throw Error('Unexpected embedded asset '+mime);
 const name='asset-'+String(++serial).padStart(2,'0')+'.'+ext;
 fs.writeFileSync(path.join(out,'assets',name),Buffer.from(base64,'base64'));
 return 'assets/'+name;
});
html=html.replace(/<link[^>]+https:\/\/fonts\.google[^>]+>\n/g,'');
html=html.replace(/<style>([\s\S]*?)<\/style>/,(_,css)=>{
 fs.writeFileSync(path.join(out,'prototype.css'),css+'\n');return '<link rel="stylesheet" href="prototype.css">\n<link rel="stylesheet" href="session.css">';
});
let index=0;
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(_,js)=>{
 const name=['game','luna','settings'][index++];
 if(!name)throw Error('Unexpected script');
 if(name==='game'){
  js=js.replace(/let AC=null,OUT=null;[\s\S]*?(?=function \$\(id\))/,`// Audio is supplied by session-audio.js, never the prototype synthesizer.\nfunction audio(){ShakeLabAudio.unlock()}\nfunction slide(){}\nfunction clank(){ShakeLabAudio.hit()}\nfunction smack(){ShakeLabAudio.hit()}\nfunction slosh(){}\nfunction rattle(){}\nfunction iceClack(){}\nfunction note(){ShakeLabAudio.hit()}\nfunction buzz(){}\nfunction clink(){ShakeLabAudio.hit()}\n`);
  js=js.replace('function reset(){','function reset(){\n  ShakeLabAudio.stop();labTasks=[];');
  js=js.replaceAll('setTimeout(','labDelay(');
  js=js.replace('function press(k){','function press(k){\n  if(pauseAt!=null||!$(\'settings\').hidden||!$(\'tut\').hidden)return;');
  js=js.replace("if(e.code==='Escape')", "if(e.repeat)return;\n  if(e.code==='Escape')");
  js=js.replace('const dt=frozen?0:dReal;GT+=dt;','const dt=frozen?0:dReal;GT+=dt;labTick(dt);');
 }
 if(name==='settings')js=js.replace("setPause(open);","setPause(open||!$('tut').hidden);if(open)ShakeLabAudio.stop();");
 fs.writeFileSync(path.join(out,name+'.js'),js+'\n');
 return '<script src="'+name+'.js"></script>';
});
// The supplied settings container has no closing div before its scripts.
html=html.replace('<script src="game.js">','</div>\n<script src="session-audio.js"></script>\n<script src="session-clock.js"></script>\n<script src="game.js">');
html+='\n<script src="session.js"></script>\n';
fs.writeFileSync(path.join(out,'version-2.html'),'<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n'+html.replace('<div class="app">','</head><body>\n<div class="app">')+'\n</body></html>\n');
console.log('SHAKING_PROTOTYPE_IMPORTED: '+serial+' assets, isolated HTML/CSS/JS; synthetic audio removed.');

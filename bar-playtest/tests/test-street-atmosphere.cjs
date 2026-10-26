const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const scope={Float32Array,console};scope.LunaOutsideRain={enabled:m=>m.raining};vm.createContext(scope);
for(const file of ['data/presentation/street-atmosphere.js','src/features/outside/effects/street-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);
const fx=scope.LunaStreetAtmosphere,D=scope.LUNA_STREET_ATMOSPHERE,m={scene:'street',time:0,raining:true};
assert.equal(D.puddles.length,9);assert.equal(D.fog.length,3);assert.equal(D.shafts.length,1);
const count=p=>Array.from(p.ripples).filter((v,i)=>i%4===2&&v>=0).length;
fx.begin(m);for(let i=1;i<=1800;i++){m.time=i/60;fx.begin(m);for(const p of fx.inspect(m).pools)assert(count(p)<=7,'5 drops/sec with 1.25 sec lifetime must stay bounded');}
const s=fx.inspect(m),before=s.pools.map(p=>Array.from(p.ripples));assert(s.pools.every(p=>count(p)>0));
for(let i=0;i<100;i++){m.x=i;fx.begin(m);}assert.deepEqual(s.pools.map(p=>Array.from(p.ripples)),before,'Camera/player movement and repeated draws cannot advance water');
m.raining=false;for(let i=0;i<90;i++){m.time+=1/60;fx.begin(m);}assert(s.pools.every(p=>count(p)===0),'Residual ripples expire after rain stops');
m.raining=true;for(let i=0;i<60;i++){m.time+=1/60;fx.begin(m);}assert(s.pools.every(p=>count(p)>0));
m.time=0;fx.begin(m);assert(s.pools.every(p=>count(p)===0),'A fresh scene clock cannot retain future impacts');
console.log('STREET_ATMOSPHERE_OK: bounded impacts, no camera feedback, pause, rain stop/resume, scene restart');

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const calls=[];let failures=0;
class ImageStub{
 set src(value){this.url=value;}get src(){return this.url;}
 decode(){calls.push(this.url);return failures-->0?Promise.reject(Error('The source image cannot be decoded.')):Promise.resolve();}
}
const window={},context={window,URL,Image:ImageStub,setTimeout,clearTimeout,Date,document:{currentScript:{src:'https://game.test/bar-playtest/src/shared/platform/resource-loader.js'}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/shared/platform/resource-loader.js'),'utf8'),context);
(async()=>{
 failures=1;const image=await window.LunaResources.image('assets/test.png?v=old');
 assert.equal(calls.length,2);assert.match(image.src,/v=old&lunaRetry=/);
 failures=2;await assert.rejects(window.LunaResources.image('assets/missing.png'),/이미지 로딩 실패: https:\/\/game.test\/bar-playtest\/assets\/missing.png/);
 assert.equal(calls.length,4,'permanent failures stop after two attempts');
 failures=0;await window.LunaResources.image('assets/missing.png');
 assert.equal(calls.length,5,'manual retry is not poisoned by the previous failure');
 console.log('RESOURCE_IMAGE_RECOVERY_OK: transient recovery, permanent failure URL, fresh manual retry');
})().catch(e=>{console.error(e);process.exitCode=1;});

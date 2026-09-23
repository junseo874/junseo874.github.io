/* One player for the whole app. Never tied to game screens or the game clock. */
(function(){
  'use strict';
  const tracks=[1,2,3,4].map(n=>({title:`LUNA Track 0${n}`,src:`assets/audio/luna-track-0${n}.m4a`}));
  const settingsKey='luna.bar.playtest.bgm.v1';
  class BarBgm{
    constructor(){
      this.enabled=true;this.volume=.3;this.unlocked=false;this.index=-1;this.bag=[];this.failed=new Set();this.attempt=0;
      this.status='waiting';this.tracks=tracks;
      try{
        const saved=JSON.parse(localStorage.getItem(settingsKey)||'null');
        if(typeof saved?.enabled==='boolean')this.enabled=saved.enabled;
        if(typeof saved?.volume==='number'&&Number.isFinite(saved.volume))this.volume=Math.max(0,Math.min(1,saved.volume));
      }catch{}
      if(!this.enabled)this.status='off';
      const audio=this.audio=document.createElement('audio');
      audio.id='bar-bgm';audio.hidden=true;audio.preload='metadata';audio.volume=this.volume;
      document.body.append(audio); // Outside #app: UI redraws never replace it.
      audio.addEventListener('ended',()=>{if(this.enabled&&audio.ended)this.next();});
      audio.addEventListener('error',()=>{if(audio.error)this.fail(this.index);});
      const unlock=e=>{
        if(!e.isTrusted||e.repeat||e.type==='pointerdown'&&e.button!==0)return;
        this.unlocked=true;
        if(this.enabled&&audio.paused&&this.status!=='loading'&&this.status!=='error')this.play();
      };
      // Capture runs before the click/keyboard handler changes a screen.
      window.addEventListener('pointerdown',unlock,true);
      window.addEventListener('keydown',unlock,true);
    }
    save(){try{localStorage.setItem(settingsKey,JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
    setEnabled(value){
      this.enabled=!!value;this.save();
      if(!this.enabled){this.attempt++;this.audio.pause();this.status='off';return;}
      if(this.failed.size===tracks.length){this.failed.clear();this.bag=[];this.index=-1;}
      if(this.failed.has(this.index)){this.next();return;}
      this.play();
    }
    setVolume(value){
      if(!Number.isFinite(value))return;
      this.volume=Math.max(0,Math.min(1,value));this.audio.volume=this.volume;this.save();
    }
    choose(){
      this.bag=this.bag.filter(i=>!this.failed.has(i));
      if(!this.bag.length){
        this.bag=tracks.map((_,i)=>i).filter(i=>!this.failed.has(i));
        for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
        // Do not repeat the previous song at the boundary between shuffled rounds.
        if(this.bag.length>1&&this.bag.at(-1)===this.index){const last=this.bag.length-1;[this.bag[0],this.bag[last]]=[this.bag[last],this.bag[0]];}
      }
      return this.bag.pop();
    }
    next(){
      const index=this.choose();
      if(index===undefined){this.audio.pause();this.status='error';return;}
      this.index=index;this.audio.src=tracks[index].src;this.audio.load();this.play();
    }
    play(){
      if(!this.enabled)return;
      if(!this.unlocked){this.status='waiting';return;}
      if(this.index<0||this.audio.ended){this.next();return;}
      const attempt=++this.attempt,index=this.index;this.status='loading';
      this.audio.play().then(()=>{
        if(attempt!==this.attempt)return;
        if(!this.enabled){this.audio.pause();return;}
        this.status='playing';
      }).catch(error=>{
        if(attempt!==this.attempt||error.name==='AbortError')return;
        if(error.name==='NotAllowedError'){this.unlocked=false;this.status='waiting';}
        else this.fail(index);
      });
    }
    fail(index){
      if(index<0||index!==this.index||this.failed.has(index))return;
      this.failed.add(index);this.attempt++;
      if(this.enabled)this.next();
    }
    get title(){return tracks[this.index]?.title||'';}
  }
  window.LunaBarBgm=BarBgm;
})();

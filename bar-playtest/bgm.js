/* One persistent player; location fades never change the saved volume or cinema gain. */
(function(){
  'use strict';
  const tracks=[1,2,3,4].map(n=>({title:`LUNA Track 0${n}`,src:`assets/audio/luna-track-0${n}.mp3`}));
  const locations={home:{title:'집 · 테라스',tracks:[2],gain:1},street:{title:'외부 거리',tracks:[1],gain:.6},bar:{title:'바 내부',tracks:[0,2,3],gain:1}};
  const settingsKey='luna.bar.playtest.bgm.v1';
  class BarBgm{
    constructor(){
      this.enabled=true;this.volume=.3;this.transitionGain=1;this.sceneGain=1;this.locationGain=0;this.unlocked=false;this.index=-1;
      this.suppressed=new Set();this.gainFades=new Map();this.gainRaf=0;
      this.location='bar';this.playingLocation=null;this.cursor=0;this.failed=new Set();this.attempt=0;this.fade=null;this.raf=0;
      this.status='waiting';this.tracks=tracks;
      try{
        const saved=JSON.parse(localStorage.getItem(settingsKey)||'null');
        if(typeof saved?.enabled==='boolean')this.enabled=saved.enabled;
        if(typeof saved?.volume==='number'&&Number.isFinite(saved.volume))this.volume=Math.max(0,Math.min(1,saved.volume));
      }catch{}
      if(!this.enabled)this.status='off';
      const audio=this.audio=document.createElement('audio');
      audio.id='bar-bgm';audio.hidden=true;audio.preload='metadata';audio.volume=0;
      document.body.append(audio);
      audio.addEventListener('ended',()=>{if(this.enabled&&audio.ended)this.next();});
      // Fade before the actual file boundary, including single-track locations.
      audio.addEventListener('timeupdate',()=>{
        const remaining=audio.duration-audio.currentTime;
        if(this.enabled&&!audio.paused&&Number.isFinite(remaining)&&remaining>0&&remaining<=1.1&&this.fade?.target!==0){
          this.status='fading';this.fadeTo(0,remaining*1000,()=>this.next());
        }
      });
      audio.addEventListener('error',()=>{if(audio.error)this.fail(this.index);});
      const unlock=e=>{
        if(!e.isTrusted||e.repeat||e.type==='pointerdown'&&e.button!==0)return;
        this.unlocked=true;
        if(this.enabled&&audio.paused&&this.status!=='loading'&&this.status!=='error')this.play();
      };
      window.addEventListener('pointerdown',unlock,true);window.addEventListener('keydown',unlock,true);
    }
    save(){try{localStorage.setItem(settingsKey,JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
    setEnabled(value){
      this.enabled=!!value;this.save();
      if(!this.enabled){this.attempt++;this.status='off';this.fadeTo(0,500,()=>this.audio.pause());return;}
      if(locations[this.location].tracks.every(i=>this.failed.has(i))){for(const i of locations[this.location].tracks)this.failed.delete(i);this.cursor=0;this.index=-1;}
      this.play();
    }
    setVolume(value){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));this.applyVolume();this.save();}
    // Keep the outgoing track's mix level until its fade-out finishes.
    applyVolume(){this.audio.volume=this.volume*this.transitionGain*this.sceneGain*this.locationGain*(locations[this.playingLocation]?.gain??1);}
    // Independent envelopes prevent a scene fade from cancelling a location fade.
    // Reversing a transition starts at its current level, never at 0 or 1.
    fadeGain(name,value,duration){
      if(!Number.isFinite(value))return;const target=Math.max(0,Math.min(1,value));
      if(duration<=0){this.gainFades.delete(name);this[name]=target;this.applyVolume();return;}
      if(this.gainFades.get(name)?.target===target||!this.gainFades.has(name)&&this[name]===target)return;
      this.gainFades.set(name,{from:this[name],target,start:performance.now(),duration});
      if(this.gainRaf)return;
      const tick=now=>{
        for(const [key,f]of this.gainFades){const t=Math.max(0,Math.min(1,(now-f.start)/f.duration));this[key]=f.from+(f.target-f.from)*t*t*(3-2*t);if(t>=1)this.gainFades.delete(key);}
        this.applyVolume();this.gainRaf=this.gainFades.size?requestAnimationFrame(tick):0;
      };this.gainRaf=requestAnimationFrame(tick);
    }
    setTransitionGain(value,duration=600){this.fadeGain('transitionGain',value,duration);}
    setSuppressed(reason,value){
      if(value)this.suppressed.add(reason);else this.suppressed.delete(reason);
      this.fadeGain('sceneGain',this.suppressed.size?0:1,this.suppressed.size?800:1100);
    }
    cancelFade(){cancelAnimationFrame(this.raf);this.raf=0;this.fade=null;}
    fadeTo(target,duration,done){
      this.cancelFade();const f=this.fade={from:this.locationGain,target,start:performance.now(),duration,done};
      const tick=now=>{
        if(this.fade!==f)return;
        const t=Math.max(0,Math.min(1,(now-f.start)/f.duration)),smooth=t*t*(3-2*t);
        this.locationGain=f.from+(f.target-f.from)*smooth;this.applyVolume();
        if(t<1)this.raf=requestAnimationFrame(tick);else{this.fade=null;this.raf=0;f.done?.();}
      };
      this.raf=requestAnimationFrame(tick);
    }
    setLocation(location){
      if(!Object.hasOwn(locations,location)||this.location===location)return;
      this.location=location;this.cursor=0;this.attempt++;
      if(!this.enabled)return;
      if(!this.unlocked||this.index<0){this.cancelFade();this.audio.pause();this.locationGain=0;this.applyVolume();this.status='waiting';return;}
      // A quick return during fade-out keeps the existing track and playback position.
      if(this.playingLocation===location&&!this.failed.has(this.index)&&!this.audio.paused){this.status='playing';this.fadeTo(1,900);return;}
      this.status='fading';this.fadeTo(0,800,()=>this.next());
    }
    syncLocation(campaign,outside){
      const view=campaign?.view==='options'?campaign.resumeView:campaign?.view;
      // The entry lobby, title and story selection share the street's quiet loop.
      if(['picker','title'].includes(view)){this.setLocation('street');return;}
      // Outside can preload behind the bar door: switch only when its new view is revealed.
      if(campaign?.doorTransition){if(campaign.doorTransition.revealAt!=null)this.setLocation(campaign.doorTransition.direction==='in'?'bar':'street');return;}
      if(['loading','memory-transition','day-transition','load-error'].includes(view))return;
      const background=view==='scene'?campaign?.dialog?.background:null;
      if(background==='terrace'||background==='home'){this.setLocation('home');return;}
      if(background==='bar'||background==='johnny-memory'){this.setLocation('bar');return;}
      this.setLocation(outside?.active?(outside.model?.scene==='home'?'home':'street'):'bar');
    }
    choose(){
      const list=locations[this.location].tracks;
      for(let n=0;n<list.length;n++){const index=list[this.cursor%list.length];this.cursor=(this.cursor+1)%list.length;if(!this.failed.has(index))return index;}
    }
    next(){
      if(!this.enabled)return;
      if(!this.audio.paused&&!this.audio.ended&&!this.audio.error&&this.locationGain>0){this.attempt++;this.status='fading';this.fadeTo(0,800,()=>this.next());return;}
      this.cancelFade();this.locationGain=0;this.applyVolume();
      const index=this.choose();
      if(index===undefined){this.attempt++;this.audio.pause();this.status='error';return;}
      this.index=index;this.playingLocation=this.location;
      this.audio.loop=false;
      this.audio.src=tracks[index].src;this.audio.load();this.play();
    }
    play(){
      if(!this.enabled)return;
      if(!this.unlocked){this.status='waiting';return;}
      if(this.index<0||this.playingLocation!==this.location||this.failed.has(this.index)||this.audio.ended){this.next();return;}
      this.cancelFade();if(this.audio.paused){this.locationGain=0;this.applyVolume();}
      const attempt=++this.attempt,index=this.index;this.status='loading';
      this.audio.play().then(()=>{
        if(attempt!==this.attempt)return;
        if(!this.enabled){this.audio.pause();return;}
        this.status='playing';this.fadeTo(1,1100);
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
    get locationTitle(){return locations[this.location].title;}
  }
  window.LunaBarBgm=BarBgm;
})();

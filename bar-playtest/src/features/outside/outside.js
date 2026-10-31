(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    mix = (a, b, t) => a + (b - a) * t,
    smooth = t => t * t * (3 - 2 * t);
  const PLACES = {
      bar: '바 문 앞',
      homeDoor: '집 앞',
      home: '집 안'
    },
    FLOWS = {
      in: '출근길',
      out: '퇴근길'
    };
  const R = global.LunaResidence.layout;
  const SOFA = {
    id: 'sofa',
    label: '소파 살펴보기',
    x: 2.557,
    y: -.7
  };
  // HUD verbs describe the action, while target.label remains the object's name
  // for dialogue, developer tools and accessibility context.
  const INTERACTION_LABELS = Object.freeze({
    'wanted-poster': '보기',
    'home-book': '보기',
    bar: '들어가기',
    home: '들어가기',
    exit: '나가기',
    elevator: '작동하기',
    tv: 'TV 보기',
    sofa: '휴식하기'
  });
  const TALK_TARGETS = new Set(['shiba-shop', 'street-beggar', 'street-beggar-witness', 'day2-thug-information', 'story-samho']);
  function interactionLabel(model, target) {
    if (!target) return '상호작용';
    let id = target.id;
    if (id === 'qa-event') {
      const c = global.LunaOutsideQA?.catalog().find(c => c.id === model.qa?.caseId);
      const event = global.LunaOutsideContent?.events.find(e => e.id === c?.source);
      if (event?.kind === 'object') id = event.object;else if (event?.kind === 'broadcast') id = 'tv';else return '대화하기';
    }
    return INTERACTION_LABELS[id] || (TALK_TARGETS.has(id) || target.encounter || target.actor ? '대화하기' : '보기');
  }
  const BOTTOM = R.elevatorBottom,
    TOP = R.elevatorTop,
    EX = R.elevatorX;
  // The fence-side sign is a local lookout, not a full-map camera toggle.
  const VIEWPOINT = {
    x: -8.78,
    y: -.7,
    radius: .55,
    width: 10.4,
    previousWidth: 12,
    rangeScale: 2 / 3 * 1.3,
    easeRate: 2.5
  };
  // Stop beside the scrap pile, leaving the final approach to the bar to the player.
  // Shift the start by the same amount to preserve the visible walk-in duration.
  const FIRST_COMMUTE_ARRIVAL = {
    from: -1.55,
    to: 0
  };
  function streetParallax(n, _camera, model) {
    // Update once before drawing, then reuse the same parent transform for every
    // sprite. Camera zoom/cutscene framing must never feed back into this state.
    return global.LunaStreetParallax?.position(n, model) || { x: n.x, y: n.y };
  }
  // Version A day zero has no lookout interaction (keyboard and click share this guard).
  // Version B keeps its separately managed progression unchanged.
  function atViewpoint(m) {
    return !!m && m.config.day !== 0 && !m.qa && m.scene === 'street' && m.level === 0 && Math.abs(m.x - VIEWPOINT.x) <= VIEWPOINT.radius && !m.ride && !m.transition && !m.encounter && !m.dialog && !m.story.blocking;
  }
  function firstCommuteEntranceCue(m) {
    return !!m && !m.qa && m.scene === 'street' && m.level === 0 && m.config.day === 0 && m.config.flow === 'in';
  }
  function firstHomeward(m) {
    return !!m && !m.qa && m.config.day === 0 && m.config.flow === 'out';
  }
  function syncHomewardGoal(m) {
    const campaign = global.lunaCampaign;
    if (!firstHomeward(m) || !campaign?.active || campaign.blocking || m.transition || global.outsidePlaytest?.model !== m) return;
    const p = global.barGame.progress,
      notices = global.LunaStoryNotices;
    const changed = m.scene === 'street' ? notices.startGoal(p, 'first_homeward', '집으로 가기!') : m.scene === 'home' && notices.completeGoal(p, 'first_homeward');
    if (changed && campaign.session.carry) campaign.session.carry.objectives = structuredClone(p.objectives);
  }
  function homewardCues(m) {
    if (!firstHomeward(m) || m.scene !== 'street' || m.ride && !m.ride.call || m.transition) return [];
    if (global.lunaCampaign?.active && global.barGame?.progress.objectives?.first_homeward?.status === 'completed') return [];
    // Destination state for a fixed HUD; never anchored to the player or scenery.
    const upper = m.level === 1,
      targetX = upper ? R.homeX : EX,
      delta = targetX - m.x,
      arrival = Math.abs(delta) < 1.35;
    return [{
      id: upper ? 'home' : 'lift',
      kind: arrival ? 'arrival' : 'route',
      direction: delta < 0 ? 'left' : 'right',
      label: upper ? '집으로' : '엘리베이터로',
      destination: upper ? '집 입구' : '엘리베이터',
      detail: upper ? '귀가 경로' : '위층으로 이동'
    }];
  }
  // Equal Unity sorting keys must not inherit serialized component/file-ID order.
  // Wall/fence dressing goes on the background, NPCs follow their sorting order,
  // and only genuine foreground art (railings/lift front) covers the player.
  function streetDrawOrder(nodes) {
    const rank = n => n.ancestry?.[0] === 'BG' || n.ancestry?.[0] === 'Residence' ? 0 : 1;
    // The residential facade is foreground art despite sharing layer 5 with
    // distant city displays. Keep those displays behind the facade as a group.
    const depth = n => n.name === 'residence-building' ? 5.5 : n.layer;
    return nodes.slice().sort((a, b) => depth(a) - depth(b) || a.order - b.order || b.z - a.z || rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));
  }
  function interactionAnchor(model, target, data, stable = false) {
    if (model.qa) return {
      x: target.x,
      y: target.y + .75
    };
    // Baked room props share the atlas: never use the whole background's "head".
    if (target.id === 'bed' || target.id === 'wardrobe' || target.id === 'home-book') return {x:target.x,y:target.top};
    const actorHead=global.LunaOutsideNeighborhood?.targetAnchor(model,target,stable)||global.LunaOutsideAmbient.actorHead(model,target.actor||target.nodeName||target.id,target);
    if(actorHead)return actorHead;
    // Idle sheets include transparent padding above the visible head.
    if (target.top != null) return {
      x: target.x,
      y: target.top
    };
    if (target.encounter) {
      const a = global.LunaOutsideEncounters.actor(target.actor);
      return {
        x: a.x,
        y: a.top
      };
    }
    const names = {
      bar: 'Bar Spawn Point',
      exit: 'Room_Entrance'
    };
    const n = data.scenes[model.scene].nodes.find(n => n.name === (target.nodeName || names[target.id]));
    if (n) {
      const sp = n.sprite,
        sx = n.sx * (n.flip ? -1 : 1),
        sy = n.sy;
      return {
        x: n.x + (.5 - sp.pivot.x) * sp.w / sp.ppu * sx,
        y: n.y + Math.max(-sp.pivot.y * sy, (1 - sp.pivot.y) * sy) * sp.h / sp.ppu
      };
    }
    // These targets are embedded in shared art, or mark a lift boarding floor.
    if (target.id === 'elevator') return {
      x: target.x,
      y: target.y + .518
    };
    if (target.id === 'home') return {
      x: target.x,
      y: target.y + .87
    };
    // Keep A's prompt beside the hologram, clear of both its picture and subtitles.
    if (target.id === 'tv') return {
      x: 1.58,
      y: -.48
    };
    if (target.id === 'story-samho') return {
      x: target.x,
      y: target.y + .95
    };
    if (target.id === 'sofa') return {
      x: 2.557,
      y: -.27
    };
    return {
      x: target.x,
      y: target.y + .5
    };
  }
  class OutsideModel {
    constructor(options = {}) {
      this.start(options);
    }
    start({
      place = 'bar',
      flow = 'out',
      day = 0,
      ...qaOptions
    } = {}) {
      this.config = {
        place: Object.hasOwn(PLACES, place) ? place : 'bar',
        flow: Object.hasOwn(FLOWS, flow) ? flow : 'out',
        day: Number(day) === 99 ? 99 : clamp(Math.floor(Number(day) || 0), 0, 3)
      };
      global.LunaLiftDust?.reset(this);
      this.barArrival = null;
      this.commuteBoundarySide = 0;
      this.crateBoundaryNoticed = false;
      this.beggarDeparture = null;
      this.beggarWitnessPaidVisit = null;
      this.liftLogoSeen = false;
      this.thugFlags = {};
      this.samhoCommuteFlags = {};
      this.notionFlags = {};
      this.neighborhood = null;
      this.scene = this.config.place === 'home' ? 'home' : 'street';
      this.level = this.config.place === 'bar' ? 0 : 1;
      this.x = this.config.place === 'bar' ? 1 : this.config.place === 'home' ? -1.28 : R.homeX;
      this.y = this.scene === 'home' || !this.level ? -.7 : R.upperY;
      this.controlsTutorial = false;
      this.controlsInteractUntil = 0;
      this.elevatorY = this.level ? TOP : BOTTOM;
      this.facing = this.config.place === 'bar' ? -1 : 1;
      this.anim = 'idle';
      this.animTime = 0;
      this.time = 0;
      this.paused = false;
      this.ride = null;
      this.transition = null;
      this.encounter = null;
      this.dialog = null;
      this.near = null;
      this.notice = '';
      this.noticeLeft = 0;
      this.arrivals = 0;
      this.revision = 0;
      this.story = new global.LunaOutsideStory.Story(this);
      this.backgroundStory = new global.LunaOutsideStory.BackgroundStories(this);
      this.playedAmbient = new Set();
      this.tvNewsInRange = false;
      this.tvOff = false;
      this.notionCommuteSeen = false;
      global.LunaOutsideQA?.init(this, qaOptions);
      this.updateNear();
    }
    wakeAtSofa() {
      if (this.scene !== 'home' || this.qa) return false;
      const sofa = SOFA;
      this.x = sofa.x;
      this.y = sofa.y;
      this.facing = -1;
      this.anim = 'idle';
      this.animTime = 0;
      this.updateNear();
      return true;
    }
    chooseSofa(id) {
      if (this.dialog?.kind !== 'sofa' || !['sleep', 'save', 'cancel'].includes(id) || this.paused) return false;
      this.dialog = null;
      this.updateNear();
      this.revision++;
      if (id === 'save') {
        // Web preview feedback only: deliberately do not write save data.
        this.notice = '저장 완료!';
        this.noticeLeft = 2;
      } else if (id === 'sleep') {
        const campaign = global.lunaCampaign;
        if (this.qa || !campaign?.interactOutside(this, SOFA)) this.dialog = {
          title: '소파',
          text: '공간 탐색 모드에서는 하루가 바뀌지 않습니다.'
        };
        this.updateNear();
      }
      return true;
    }
    chooseObject(id) {
      const d=this.dialog;
      if(this.paused||!d||!['elevator','tv'].includes(d.kind)||!['confirm','cancel','fast'].includes(id))return false;
      if(id==='fast'&&(d.kind!=='elevator'||!global.LunaOutsideNeighborhood?.repaired()))return false;
      this.dialog=null;this.revision++;this.updateNear();
      if(id==='cancel'){
        if(d.kind==='tv'){this.tvOff=true;this.backgroundStory.cancel();}
        return true;
      }
      if(d.kind==='tv'){this.tvOff=false;global.lunaCampaign?.playDayZeroTV(this);}
      else if(!global.lunaCampaign?.interactOutside(this,{id:'elevator',fast:id==='fast'})){
        if(id==='fast')global.LunaOutsideNeighborhood.fastTravel(this);else this.startLift();
      }
      return true;
    }
    startLift() {
      if(this.ride)return false;
      const local=this.level?TOP:BOTTOM,remote=this.level?BOTTOM:TOP,call=Math.abs(this.elevatorY-local)>.01;
      this.ride={time:0,from:this.elevatorY,to:call?local:remote,call,duration:call?6:12,boardAfterCall:call};
      this.anim='idle';
      global.outsidePlaytest?.clearInput();
      if(!call){this.x=EX;if(!this.qa)global.lunaCampaign?.quietLift(this);}
      this.updateNear();this.revision++;
    }
    tickLift(dt) {
      const r = this.ride;
      if (!r) return false;
      r.time += dt;
      const p = smooth(clamp((r.time - .45) / r.duration, 0, 1));
      this.elevatorY = mix(r.from, r.to, p);
      if (p === 1) global.LunaLiftDust?.land(this, r);
      if (!r.call) {
        this.x = EX;
        this.y = this.elevatorY + R.passengerOffset;
      }
      if (r.time >= r.duration + 1.1) {
        if (!r.call) {
          this.level = r.to === TOP ? 1 : 0;
          this.y = this.level ? R.upperY : -.7;
          this.arrivals++;
        }
        this.elevatorY = r.to;
        this.ride = null;
        global.outsidePlaytest?.clearInput();
        if (r.boardAfterCall && !global.lunaCampaign?.interactOutside(this, {id:'elevator'})) this.startLift();
        this.updateNear();
        this.revision++;
      }
      this.anim = 'idle';
      this.animTime += dt;
      return true;
    }
    firstCommuteDirections() {
      if (this.isFirstCommute()) return false;
      if (this.qa || this.config.day !== 0 || this.config.flow !== 'in' || this.scene !== 'street' || this.story.blocking) return false;
      const campaign = global.lunaCampaign,
        key = 'day0_first_home_exit',
        flags = campaign?.active ? global.barGame.progress.flags ??= {} : this.story.flags;
      if (flags[key]) return false;
      const rows = [{
        type: 'say',
        actor: 'luna',
        text: '바의 위치는 엘리베이터를 타고 내려가서 우측으로 쭉 가면 된다고 했어.'
      }, {
        type: 'say',
        actor: 'luna',
        text: '가게 이름은 언노운...'
      }];
      if (!this.story.beginRows(key, {
        x: this.x,
        y: this.y
      }, rows, false, () => {
        // Register the goal only after the player dismisses the final doorway line.
        if (!campaign?.active || global.outsidePlaytest?.model !== this || this.config.day !== 0 || this.config.flow !== 'in' || this.scene !== 'street') return;
        if (global.LunaStoryNotices.startGoal(global.barGame.progress, 'first_commute', '첫 출근하기!') && campaign.session.carry) campaign.session.carry.objectives = structuredClone(global.barGame.progress.objectives);
      })) return false;
      flags[key] = true;
      if (campaign?.active && campaign.session.carry) (campaign.session.carry.flags ??= {})[key] = true;
      global.outsidePlaytest?.clearInput();
      this.anim = 'idle';
      this.animTime = 0;
      return true;
    }
    isFirstCommute() {
      return !this.qa && this.config.day === 0 && this.config.flow === 'in';
    }
    tickBarArrival(dt) {
      const arrival = this.barArrival;
      if (!arrival) return false;
      this.x = Math.min(arrival.to, this.x + .48 * dt);
      this.facing = 1;
      this.anim = 'walk';
      this.animTime += dt;
      if (this.x >= arrival.to) {
        this.barArrival = null;
        this.anim = 'idle';
        this.animTime = 0;
        global.outsidePlaytest?.clearInput();
        this.story.beginRows('day0_bar_arrival', {
          x: this.x,
          y: this.y
        }, [{
          type: 'say',
          actor: 'luna',
          text: "바 '언노운' 여기인가보네."
        }], false, () => global.outsidePlaytest?.clearInput());
      }
      this.updateNear();
      return true;
    }
    targets() {
      if (this.qa) return global.LunaOutsideQA.targets(this);
      if (this.scene === 'home') return [global.LunaHomeArt.bedTarget(), global.LunaHomeArt.wardrobeTarget(), global.LunaHomeArt.bookTarget(), ...(this.config.day === 0 ? [{
        id: 'tv',
        label: 'TV 다큐 보기',
        x: 1.22,
        y: -.7
      }] : []), {
        id: 'exit',
        label: '밖으로 나가기',
        x: -1.581,
        y: -.7
      }, ...(this.config.flow === 'out' ? [SOFA] : []), ...(global.LunaOutsideNeighborhood?.targets(this) || [])];
      if (this.level) return [...(global.LunaOutsideNeighborhood?.targets(this) || []), ...(global.LunaOutsideNotion?.targets(this) || []), {
        id: 'home',
        label: '집에 들어가기',
        x: R.homeX,
        y: R.upperY
      }, {
        id: 'elevator',
        label: this.elevatorY > 4 ? '엘리베이터 · 내려가기' : '엘리베이터 호출',
        x: EX,
        y: R.upperY
      }];
      return [...(global.LunaOutsideNeighborhood?.targets(this) || []), ...(global.LunaOutsideEncounters?.targets(this) || []), {
        id: 'bar',
        label: '바 입구',
        x: 1.0086,
        y: -.7
      }, {
        id: 'elevator',
        label: this.elevatorY < 4 ? '엘리베이터 · 올라가기' : '엘리베이터 호출',
        x: EX,
        y: -.7
      }, ...(global.LunaOutsideContent?.targets(this) || []), ...(global.LunaOutsideShop?.targets(this) || []), ...(global.LunaOutsideBeggar?.targets(this) || [])];
    }
    updateNear() {
      global.LunaStoryNotices?.forced(this);
      if (this.qa?.runtime || this.barArrival || this.ride || this.transition || this.neighborhood?.action || this.encounter || this.dialog || this.story?.blocking) { this.near = null; return; }
      // targets() already scopes the current room/floor. Retain the current
      // candidate within 2.5 world pixels of a tie to avoid prompt flicker.
      const priority = { elevator: 30, home: 20, exit: 20, bar: 20, sofa: 10 };
      const distance = t => Math.abs(t.x - this.x);
      const candidates = this.targets().filter(t => global.LunaOutsideDiscovery.inRange(this,t))
        .sort((a,b) => distance(a)-distance(b) || (priority[b.id]||0)-(priority[a.id]||0) || a.id.localeCompare(b.id));
      const current = candidates.find(t => t.id === this.near?.id), closest = candidates[0];
      this.near = current && closest && distance(current) <= distance(closest)+.025 ? current : closest || null;
    }
    beginEncounter(target) {
      const e = global.LunaOutsideEncounters.prepare(this, target);
      if (!e) return false;
      this.story.cancel();
      this.encounter = e;
      this.facing = e.facing;
      this.updateNear();
      return true;
    }
    interact() {
      if (this.paused || this.controlsTutorial || this.barArrival || this.transition || this.neighborhood?.action || this.encounter && this.encounter.stage !== 'active') return false;
      if (this.story.blocking) return this.story.advance();
      if (this.ride) return false;
      if (this.dialog) {
        this.dialog = null;
        this.updateNear();
        this.revision++;
        return true;
      }
      this.updateNear();
      const t = this.near;
      if (!t) return false;
      global.LunaOutsideDiscovery.interacted(this,t);
      const inspection = global.LunaOutsideInspection?.forTarget(t);
      if (inspection) {
        global.LunaOutsideDiscovery.remember(this,global.LunaOutsideDiscovery.objectToken(this,t.id));
        this.dialog = inspection;
        this.anim = 'idle';
        this.animTime = 0;
        this.updateNear();
        this.revision++;
        return true;
      }
      if (t.id === 'sofa') {
        this.story.cancel();
        this.dialog = {
          kind: 'sofa',
          key: 'sofa:' + ++this.revision
        };
        this.anim = 'idle';
        this.animTime = 0;
        this.updateNear();
        return true;
      }
      if(t.id==='elevator'){
        global.LunaOutsideDiscovery.remember(this,global.LunaOutsideDiscovery.objectToken(this,t.id));
        this.dialog={kind:'elevator',key:'elevator:'+ ++this.revision};
        this.anim='idle';this.animTime=0;this.updateNear();return true;
      }
      if (this.qa && global.LunaOutsideQA.interact(this, t)) return true;
      if (!this.qa && global.lunaCampaign?.interactOutside(this, t)) {
        if(t.id==='bar'||t.id==='tv'&&global.barGame.progress.flags.day0_tv_seen)global.LunaOutsideDiscovery.remember(this,global.LunaOutsideDiscovery.objectToken(this,t.id));
        return true;
      }
      if (this.story.interact(t)) {
        this.anim = 'idle';
        this.animTime = 0;
        return true;
      }
      if (this.story.speech) this.story.cancel();
      if (t.id === 'home' || t.id === 'exit') {
        this.transition = {
          discoveryToken: global.LunaOutsideDiscovery.objectToken(this,t.id),
          time: 0,
          to: t.id === 'home' ? 'home' : 'street',
          swapped: false,
          barArrival: t.id === 'exit' && this.isFirstCommute()
        };
        global.LunaHomeDoorAudio?.play(() => global.outsidePlaytest?.active && global.outsidePlaytest.model === this && !this.paused);
      } else if (t.id === 'bar') {
        global.LunaOutsideDiscovery.remember(this,global.LunaOutsideDiscovery.objectToken(this,t.id));
        this.dialog = {
          title: '바 입구',
          text: this.config.flow === 'in' ? '출근길의 도착 지점입니다. 이 탭에서는 바 영업으로 넘어가지 않고 외부 공간만 탐색합니다.' : '퇴근길의 출발 지점입니다. 왼쪽 엘리베이터를 타면 집으로 갈 수 있습니다.'
        };
      }
      this.updateNear();
      this.revision++;
      return true;
    }
    tick(dt, input = {}) {
      dt = clamp(Number(dt) || 0, 0, .05);
      if (this.paused) return;
      // Inspecting an image must not start a proximity scene or move the player
      // through scripted/boundary updates behind the modal.
      if (this.dialog?.kind === 'inspection') {
        this.time += dt;
        this.animTime += dt;
        return;
      }
      syncHomewardGoal(this);
      if (this.qa && global.LunaOutsideQA.tick(this, dt)) return;
      this.story.tick(dt);
      global.LunaOutsideStory.tickBackground(this, dt);
      this.time += dt;
      global.LunaOutsideBeggar?.tick(this, dt);
      this.noticeLeft = Math.max(0, this.noticeLeft - dt);
      for (const owner of [global.LunaOutsideThug, global.LunaOutsideNotion, global.LunaOutsideEncounters, global.LunaOutsideSamhoCommute]) owner?.offer?.(this);
      // The cabin owns the passenger transform until landing is complete.
      // Proximity/scripted movement must not preempt this branch either.
      if (this.tickLift(dt)) return;
      if (global.LunaOutsideNeighborhood?.tick(this, dt)) return;
      if (global.LunaOutsideEncounters?.tick(this, dt)) return;
      if (global.LunaOutsideNotion?.tick(this, dt)) return;
      if (global.LunaOutsideThug?.tick(this, dt)) return;
      if (global.LunaOutsideSamhoCommute?.tick(this, dt)) return;
      if (global.LunaOutsideStory.events.pump(this)) return;
      if (this.encounter) {
        const e = this.encounter;
        if (e.stage === 'active' && !this.story.speech) {
          e.stage = 'leaving';
          e.cameraReady = false;
          e.elapsed = 0;
        }
        if (e.stage === 'entering') {
          e.elapsed += dt;
          const p = smooth(clamp(e.elapsed / e.duration, 0, 1)),
            old = this.x;
          this.x = mix(e.from, e.to, p);
          this.anim = Math.abs(this.x - old) > .00001 ? 'walk' : 'idle';
          this.animTime += dt;
          if (e.elapsed >= e.duration && e.cameraReady) {
            this.x = e.to;
            this.anim = 'idle';
            e.stage = 'active';
            this.story.begin(e.id, e.target);
          }
          return;
        }
        if (e.stage === 'leaving') {
          this.anim = 'idle';
          this.animTime += dt;
          if (e.cameraReady) {
            this.encounter = null;
            this.updateNear();
          }
          return;
        }
      }
      if (this.transition) {
        const t = this.transition;
        t.time += dt;
        if (t.time >= .38 && !t.swapped) {
          t.swapped = true;
          this.scene = t.to;
          this.level = t.barArrival ? 0 : 1;
          this.x = t.barArrival ? FIRST_COMMUTE_ARRIVAL.from : this.scene === 'home' ? -1.28 : R.homeX;
          this.y = t.barArrival || this.scene === 'home' ? -.7 : R.upperY;
          this.elevatorY = t.barArrival ? BOTTOM : TOP;
          if (t.barArrival) {
            this.facing = 1;
            this.backgroundStory.cancel();
            global.outsidePlaytest?.clearInput();
          }
          this.revision++;
        }
        if (t.time >= .85) {
          global.LunaOutsideDiscovery.remember(this,t.discoveryToken);
          this.transition = null;
          if (t.barArrival) this.barArrival = {
            to: FIRST_COMMUTE_ARRIVAL.to
          };else if (t.to === 'street') this.firstCommuteDirections();
          this.updateNear();
          this.revision++;
        }
        this.anim = 'idle';
        this.animTime += dt;
        return;
      }
      if (this.tickBarArrival(dt)) return;
      let direction = this.dialog || this.story.blocking ? 0 : clamp(input.move || 0, -1, 1),
        speed = input.run ? 1.2 : .7;
      const restricted = this.isFirstCommute() && this.scene === 'street' && this.level === 0;
      const bounds = restricted ? [-.9, 2.15] : this.qa ? [-12.81, 6.1] : this.scene === 'home' ? [-1.5, 3.4] : this.level ? [R.upperMin, R.upperMax] : [R.lowerMin, 6.1],
        old = this.x,
        desired = this.x + direction * speed * dt;
      this.x = clamp(desired, ...bounds);
      this.x = global.LunaOutsideNeighborhood?.clampBoundary(this, this.x, direction) ?? this.x;
      if (!this.qa && this.scene === 'street' && this.level === 1) {
        // Rearm only after walking away, not when a held key resumes after speech.
        if (this.x > R.upperMin + .12) this.crateBoundaryNoticed = false;
        if (direction < 0 && desired < R.upperMin && !this.crateBoundaryNoticed && !this.story.speech) {
          this.crateBoundaryNoticed = true;
          this.facing = -1;
          direction = 0;
          global.outsidePlaytest?.clearInput();
          this.story.beginRows('upper_crates_blocked', { x: this.x, y: this.y }, [{
            type: 'say', actor: 'luna', text: '물건들로 막혀있네.'
          }], false, () => global.outsidePlaytest?.clearInput());
        }
      }
      if (restricted) {
        if (this.x > bounds[0] + .12 && this.x < bounds[1] - .12) this.commuteBoundarySide = 0;
        const side = desired < bounds[0] ? -1 : desired > bounds[1] ? 1 : 0;
        if (side && side !== this.commuteBoundarySide) {
          this.commuteBoundarySide = side;
          direction = 0;
          global.outsidePlaytest?.clearInput();
          this.story.beginRows('day0_commute_boundary', {
            x: this.x,
            y: this.y
          }, [{
            type: 'say',
            actor: 'luna',
            text: '지금은 언노운 가게로 출근해야해.'
          }], false, () => global.outsidePlaytest?.clearInput());
        }
      }
      if (direction) this.facing = direction > 0 ? 1 : -1;
      const next = !this.story.blocking && Math.abs(this.x - old) > .00001 ? input.run ? 'run' : 'walk' : 'idle';
      if (next !== this.anim) this.animTime = 0;
      this.anim = next;
      this.animTime += dt;
      this.updateNear();
    }
  }
  function create(options) {
    const factory = typeof module === 'undefined' ? global.LunaOutsideParts.view : require('./outside-view.js');
    return factory({ BOTTOM, EX, FLOWS, OutsideModel, PLACES, R, TOP, VIEWPOINT, atViewpoint, clamp, firstCommuteEntranceCue, global, homewardCues, interactionAnchor, interactionLabel, mix, smooth, streetDrawOrder, streetParallax })(options);
  }
  global.LunaOutside = {
    Model: OutsideModel,
    create,
    streetDrawOrder,
    streetParallax,
    interactionAnchor,
    interactionLabel,
    viewpoint: VIEWPOINT,
    atViewpoint,
    firstCommuteEntranceCue,
    homewardCues
  };
})(typeof window === 'undefined' ? globalThis : window);

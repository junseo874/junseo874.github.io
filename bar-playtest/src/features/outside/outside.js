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
  function interactionAnchor(model, target, data) {
    if (model.qa) return {
      x: target.x,
      y: target.y + .75
    };
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
      if(this.paused||!d||!['elevator','tv'].includes(d.kind)||!['confirm','cancel'].includes(id))return false;
      this.dialog=null;this.revision++;this.updateNear();
      if(id==='cancel'){
        if(d.kind==='tv'){this.tvOff=true;this.backgroundStory.cancel();}
        return true;
      }
      if(d.kind==='tv'){this.tvOff=false;global.lunaCampaign?.playDayZeroTV(this);}
      else if(!global.lunaCampaign?.interactOutside(this,{id:'elevator'}))this.startLift();
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
      if (this.scene === 'home') return [...(this.config.day === 0 ? [{
        id: 'tv',
        label: 'TV 다큐 보기',
        x: 1.22,
        y: -.7
      }] : []), {
        id: 'exit',
        label: '밖으로 나가기',
        x: -1.581,
        y: -.7
      }, ...(this.config.flow === 'out' ? [SOFA] : [])];
      if (this.level) return [...(global.LunaOutsideNotion?.targets(this) || []), {
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
      return [...(global.LunaOutsideEncounters?.targets(this) || []), {
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
      this.near = this.qa?.runtime || this.barArrival || this.ride || this.transition || this.encounter || this.dialog || this.story?.blocking ? null : this.targets().filter(t => Math.abs(t.x - this.x) < (t.id === 'elevator' ? .62 : .4)).sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x) || a.id.localeCompare(b.id))[0] || null;
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
      if (this.paused || this.controlsTutorial || this.barArrival || this.transition || this.encounter && this.encounter.stage !== 'active') return false;
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
      const inspection = global.LunaOutsideInspection?.forTarget(t);
      if (inspection) {
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
        this.dialog={kind:'elevator',key:'elevator:'+ ++this.revision};
        this.anim='idle';this.animTime=0;this.updateNear();return true;
      }
      if (this.qa && global.LunaOutsideQA.interact(this, t)) return true;
      if (!this.qa && global.lunaCampaign?.interactOutside(this, t)) return true;
      if (this.story.interact(t)) {
        this.anim = 'idle';
        this.animTime = 0;
        return true;
      }
      if (this.story.speech) this.story.cancel();
      if (t.id === 'home' || t.id === 'exit') {
        this.transition = {
          time: 0,
          to: t.id === 'home' ? 'home' : 'street',
          swapped: false,
          barArrival: t.id === 'exit' && this.isFirstCommute()
        };
        global.LunaHomeDoorAudio?.play(() => global.outsidePlaytest?.active && global.outsidePlaytest.model === this && !this.paused);
      } else if (t.id === 'bar') this.dialog = {
        title: '바 입구',
        text: this.config.flow === 'in' ? '출근길의 도착 지점입니다. 이 탭에서는 바 영업으로 넘어가지 않고 외부 공간만 탐색합니다.' : '퇴근길의 출발 지점입니다. 왼쪽 엘리베이터를 타면 집으로 갈 수 있습니다.'
      };
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
      // The cabin owns the passenger transform until landing is complete.
      // Proximity/scripted movement must not preempt this branch either.
      if (this.tickLift(dt)) return;
      if (global.LunaOutsideEncounters?.tick(this, dt)) return;
      if (global.LunaOutsideNotion?.tick(this, dt)) return;
      if (global.LunaOutsideThug?.tick(this, dt)) return;
      if (global.LunaOutsideSamhoCommute?.tick(this, dt)) return;
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
  function create({
    onExit = () => {},
    currencyView = global.LunaCurrencyView()
  } = {}) {
    const glowRenderer = global.LunaInteractionGlow.create();
    let renderingNode = null,
      choiceUI = null;
    const data = global.LUNA_OUTSIDE_DATA,
      config = {
        place: 'bar',
        flow: 'out',
        day: 0
      },
      images = new Map(),
      keys = new Set();
    let active = false,
      loading = false,
      loadError = '',
      model = null,
      host = null,
      canvas = null,
      ctx = null,
      cam = {
        x: 1,
        y: 0,
        w: 4.8
      },
      generation = 0,
      hudSignature = '',
      lastScene = '',
      panorama = false,
      wakeSpawn = false,
      devOpen = false,
      notices = null,
      hintOpen = false,
      streetLocation = null;
    let surface = global.LunaPixelCamera.surface(1280, 720),
      renderCam = {
        ...cam
      },
      pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
    let panoramaTween = false;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
    const button = (text, action, cls = '') => `<button class="${cls}" data-outside-action="${action}">${text}</button>`;
    function lobbyHTML(tabs) {
      return `<div class="start-screen outside-start">${tabs}<section class="start-card outside-setup outside-entry"><small>OUTSIDE EXPLORATION</small><h2>외부 공간</h2><p>거리와 집을 자유롭게 둘러보세요.<br>설정은 탐색 중 <kbd>P</kbd>를 눌러 변경할 수 있습니다.</p>${button('탐색 시작 →', 'start', 'primary')}<span>0일차 · 퇴근길 · 바 문 앞에서 시작</span></section></div>`;
    }
    async function loadImages() {
      const queue=Object.entries(data.assets).filter(([id])=>!images.has(id));let index=0;
      await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{
        while(index<queue.length){const [id,a]=queue[index++];images.set(id,await global.LunaResources.image(a.src));}
      }));
    }
    function fit() {
      if (!host) return;
      const previous = surface;
      surface = global.LunaPixelCamera.surface(innerWidth, innerHeight, devicePixelRatio);
      if (previous.w !== surface.w || previous.dpr !== surface.dpr) pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
      host.style.setProperty('--outside-scale', surface.cssScale);
      host.style.setProperty('--outside-left', surface.left + 'px');
      host.style.setProperty('--outside-top', surface.top + 'px');
      // Clear any stale focus scroll from a pre-resize layout (including legacy browsers).
      host.scrollLeft = host.scrollTop = 0;
      const stage = host.querySelector('.outside-stage');
      if (stage) stage.scrollLeft = stage.scrollTop = 0;
      if (canvas && (canvas.width !== surface.w || canvas.height !== surface.h)) {
        canvas.width = surface.w;
        canvas.height = surface.h;
      }
    }
    function clearInput() {
      keys.clear();
    }
    function devMoney() {
      return Math.max(0, Number(global.barGame?.progress.money) || 0);
    }
    function devHTML() {
      return '<aside class="outside-dev-console" role="dialog" aria-label="외부 개발자 콘솔" hidden><header><div><small>DEVELOPER</small><h2>외부 개발자 콘솔</h2></div>' + button('P · 닫기', 'dev-close') + '</header><section class="outside-dev-days-section"><h3>일차</h3><div class="outside-dev-days">' + [0, 1, 2, 3, 99].map(day => button(day === 99 ? '99일차 · QA 가상 공간' : day + '일차', 'dev-day-' + day, day === 99 ? 'outside-dev-qa' : '')).join('') + '</div></section><section><h3>이동 상태 <small class="outside-dev-day"></small></h3><div class="outside-dev-flow">' + button('출근길', 'dev-flow-in') + button('퇴근길', 'dev-flow-out') + '</div></section><section><h3>위치 이동</h3>' + button('집 안', 'dev-home') + button('엘리베이터 앞 · 아래층', 'dev-elevator') + button('바 문 앞', 'dev-bar') + '</section><section><h3>현재 소지금</h3><output class="outside-dev-money" aria-live="polite"></output><div class="outside-dev-money-actions">' + button('−1,000원', 'dev-minus') + button('+1,000원', 'dev-plus') + '</div></section><p class="outside-dev-note"></p><p class="outside-dev-feedback" role="status"></p></aside>';
    }
    function paintDev() {
      const panel = host?.querySelector('.outside-dev-console');
      if (!panel) return;
      global.LunaCaptureMode?.mount(panel);
      panel.hidden = !devOpen;
      panel.querySelector('[data-outside-action="dev-day-99"]').hidden = !!global.lunaCampaign?.active;
      panel.querySelector('.outside-dev-day').textContent = model.config.day + '일차';
      for (const day of [0, 1, 2, 3, 99]) panel.querySelector('[data-outside-action="dev-day-' + day + '"]').setAttribute('aria-pressed', String(model.config.day === day));
      for (const flow of ['in', 'out']) panel.querySelector('[data-outside-action="dev-flow-' + flow + '"]').setAttribute('aria-pressed', String(model.config.flow === flow));
      for (const place of ['home', 'elevator', 'bar']) panel.querySelector('[data-outside-action="dev-' + place + '"]').disabled = !!model.qa;
      panel.querySelector('.outside-dev-note').textContent = model.qa ? '99일차는 QA 전용 공간입니다. P 패널을 닫고 Tab으로 테스트할 상황을 고르세요. 0–3일차를 선택하면 거리로 돌아갑니다.' : global.lunaCampaign?.active ? '일차 변경은 본편 진행에도 적용됩니다. 위치·소지금·보유 물품은 유지하고 진행 중인 대화·이벤트는 초기화합니다.' : '일차 변경 시 진행 중인 대화·이벤트는 초기화됩니다. 현재 위치·소지금·보유 물품은 유지됩니다. 99일차는 별도 QA 공간으로 이동합니다.';
      panel.querySelector('output').textContent = devMoney().toLocaleString('ko-KR') + '원';
      panel.querySelector('[data-outside-action="dev-minus"]').disabled = devMoney() === 0;
    }
    function toggleDev(open = !devOpen) {
      if (!active || loading || loadError) return;
      devOpen = open;
      hintOpen = false;
      clearInput();
      paintDev();
      hudSignature = '';
      updateHUD();
      if (open) {
        host.querySelector('.outside-dev-console').scrollTop = 0;
        host.querySelector('[data-capture-ui]')?.focus({preventScroll: true});
      } else host.focus({
        preventScroll: true
      });
    }
    function normalPosition(m) {
      return {
        scene: m.scene,
        level: m.level,
        x: m.ride ? EX : m.x,
        y: m.ride ? m.level ? R.upperY : -.7 : m.y,
        elevatorY: m.ride ? m.level ? TOP : BOTTOM : m.elevatorY,
        facing: m.facing,
        place: m.config.place
      };
    }
    function changeDay(day) {
      if (global.lunaCampaign?.active && day === 99 || ![0, 1, 2, 3, 99].includes(day) || model.config.day === day) return;
      const m = model,
        c = global.lunaCampaign;
      clearInput();
      m.story.cancel();
      m.backgroundStory.cancel();
      if (!m.qa) streetLocation = normalPosition(m);
      const qaCase = m.qa?.caseId || config.qaCase;
      Object.assign(config, {
        day,
        qaCase,
        place: streetLocation?.place || 'bar'
      });
      c?.debugOutsideDay(day, config.flow);
      model = new OutsideModel(config);
      if (day !== 99 && streetLocation) {
        const {
          place,
          ...position
        } = streetLocation;
        Object.assign(model, position);
        model.updateNear();
      }
      if (c) {
        c.outsideSleep = null;
        c.liftLogoPending = false;
        document.querySelector('#campaign-lift-reveal')?.remove();
      }
      wakeSpawn = false;
      panorama = false;
      snapCamera();
      draw();
      global.barGame?.log('debug_outside_day', {
        from: m.config.day,
        to: day,
        flow: config.flow
      });
      host.querySelector('.outside-dev-feedback').textContent = day === 99 ? '99일차 QA 공간으로 이동했습니다. 패널을 닫고 Tab으로 상황을 선택하세요.' : day + '일차 · ' + FLOWS[config.flow] + '로 변경했습니다.';
    }
    function dismissHint() {
      hintOpen = false;
      clearInput();
      hudSignature = '';
      updateHUD();
      host.focus({
        preventScroll: true
      });
    }
    function devAction(action) {
      if (!devOpen || loading || loadError) return;
      if (action === 'dev-close') {
        toggleDev(false);
        return;
      }
      const m = model,
        c = global.lunaCampaign,
        g = global.barGame;
      if (action.startsWith('dev-day-')) changeDay(Number(action.slice(8)));else if (action === 'dev-plus' || action === 'dev-minus') {
        const before = devMoney(),
          after = Math.max(0, before + (action === 'dev-plus' ? 1000 : -1000));
        g.progress.money = after;
        if (c?.session.active && c.session.carry) c.session.carry.money = after;
        g.log('debug_money', {
          before,
          after,
          source: 'outside-console'
        });
        g.changed();
      } else if (action === 'dev-flow-in' || action === 'dev-flow-out') {
        const flow = action === 'dev-flow-in' ? 'in' : 'out';
        if (m.config.flow === flow) return;
        clearInput();
        m.story.cancel();
        m.backgroundStory.cancel();
        m.encounter = null;
        m.dialog = null;
        m.notice = '';
        m.noticeLeft = 0;
        m.playedAmbient.clear();
        m.notionCommuteSeen = false;
        // Preserve the exact location (and any lift trip); only the route and its event state change.
        m.config.flow = flow;
        config.flow = flow;
        if (c?.active) {
          c.session.day = m.config.day;
          c.session.route = flow;
          c.session.carry = JSON.parse(JSON.stringify(g.progress));
          c.session.pendingStep = null;
          c.morningSeen.delete(m.config.day);
          c.nightStarted = false;
        }
        if (c) {
          c.outsideSleep = null;
          c.liftLogoPending = false;
          document.querySelector('#campaign-lift-reveal')?.remove();
        }
        g.log('debug_commute', {
          day: m.config.day,
          flow,
          source: 'outside-console'
        });
        m.updateNear();
        m.revision++;
        host.querySelector('.outside-dev-feedback').textContent = m.config.day + '일차 · ' + FLOWS[flow] + '로 변경했습니다.';
      } else if (['dev-home', 'dev-elevator', 'dev-bar'].includes(action)) {
        if (m.qa) return;
        clearInput();
        m.story.cancel();
        m.backgroundStory.cancel();
        m.ride = null;
        m.transition = null;
        m.encounter = null;
        m.dialog = null;
        m.paused = false;
        m.notice = '';
        m.noticeLeft = 0;
        // Keep QA isolated; select a normal day before teleporting into the city.
        const home = action === 'dev-home';
        m.scene = home ? 'home' : 'street';
        m.level = home ? 1 : 0;
        m.x = home ? -1.28 : action === 'dev-elevator' ? EX : 1.0086;
        m.y = -.7;
        m.elevatorY = home ? TOP : BOTTOM;
        m.facing = home ? 1 : action === 'dev-elevator' ? 1 : -1;
        m.anim = 'idle';
        m.animTime = 0;
        m.config.place = home ? 'home' : 'bar';
        config.place = m.config.place;
        wakeSpawn = false;
        panorama = false;
        if (c) {
          c.liftLogoPending = false;
          document.querySelector('#campaign-lift-reveal')?.remove();
        }
        m.updateNear();
        m.revision++;
        snapCamera();
        draw();
        host.querySelector('.outside-dev-feedback').textContent = home ? '집 안으로 이동했습니다.' : action === 'dev-elevator' ? '아래층 엘리베이터 앞으로 이동했습니다.' : '바 문 앞으로 이동했습니다.';
      }
      hudSignature = '';
      updateHUD();
      paintDev();
    }
    function devKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.code === 'KeyP' && !loading && !loadError && (!model.paused || devOpen || global.LunaCaptureMode?.hidden)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) toggleDev();
        return true;
      }
      if (!devOpen) return false;
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat) toggleDev(false);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        const buttons = [...host.querySelectorAll('.outside-dev-console button:not(:disabled)')].filter(b => b.getClientRects().length),
          i = buttons.indexOf(document.activeElement);
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else if (!['Enter', 'Space'].includes(e.code) || !e.target.closest('.outside-dev-console button') || e.repeat) e.preventDefault();
      return true;
    }
    function snapCamera() {
      global.LunaStreetParallax?.notifyTeleport(model);
      panoramaTween = false;
      const arriving = model.scene === 'street' && (model.barArrival || model.transition?.barArrival);
      cam = {
        x: model.scene === 'home' ? global.LunaHomeArt.cameraX(model.x, 4.8) : arriving ? .65 : model.x,
        y: model.scene === 'home' ? .023 : model.y + .7,
        w: 4.8
      };
      lastScene = model.scene;
      pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
    }
    async function start({
      wakeAtSofa = false,
      showDevHint = false
    } = {}) {
      if (active) return;
      wakeSpawn = wakeAtSofa;
      generation++;
      const token = generation;
      active = true;
      loading = true;
      loadError = '';
      panorama = false;
      devOpen = false;
      hintOpen = false;
      streetLocation = null;
      clearInput();
      model = new OutsideModel(config);
      if (wakeSpawn) model.wakeAtSofa();
      snapCamera();
      host = document.createElement('section');
      host.id = 'outside-root';
      host.setAttribute('aria-label', '외부 공간 탐색');
      host.tabIndex = -1;
      host.innerHTML = '<div class="outside-stage"><canvas width="1280" height="720" aria-label="루나가 이동하는 거리와 집 내부" role="img"></canvas><div class="outside-hud"><div class="outside-dynamic"></div></div><div class="outside-speech" hidden></div><div class="outside-background-speech" hidden></div><div class="outside-overlay"></div>' + devHTML() + '</div>';
      document.body.append(host);
      choiceUI = global.LunaWorldChoices.create(host.querySelector('.outside-stage'), id => {
        clearInput();
        if (['sofa','elevator','tv'].includes(model.dialog?.kind)) {
          if(model.dialog.kind==='sofa')model.chooseSofa(id);else model.chooseObject(id);
          host?.focus({
            preventScroll: true
          });
        } else model.story.choose(id);
        updateHUD();
      });
      notices = global.LunaOutsideNotices.create(host, currencyView);
      notices.update(model);
      document.querySelector('#app').hidden = true;
      canvas = host.querySelector('canvas');
      ctx = canvas.getContext('2d');
      fit();
      hudSignature = '';
      draw();
      updateHUD();
      try {
        await global.LunaResources.prepare('common');
        await loadImages();
        if (token !== generation) return;
        loading = false;
        hintOpen = showDevHint && !global.lunaCampaign?.active;
        host.focus({
          preventScroll: true
        });
      } catch (e) {
        if (token !== generation) return;
        loading = false;
        loadError = '거리 리소스를 불러오지 못했습니다. 다시 시도해 주세요.';
        console.error('Outside asset load:', e.message);
      }
      updateHUD();
    }
    function exit(silent = false) {
      choiceUI?.dispose();
      choiceUI = null;
      global.LunaControlsTutorial.stop();
      global.LunaHomeDoorAudio?.stop();
      notices?.dispose();
      notices = null;
      generation++;
      active = false;
      loading = false;
      devOpen = false;
      hintOpen = false;
      clearInput();
      host?.remove();
      host = null;
      document.querySelector('#app').hidden = false;
      if (!silent) onExit();
    }
    function advanceDay() {
      if (!active || loading || loadError || model.qa || model.config.flow !== 'out' || model.config.day >= 3) return false;
      Object.assign(config, {
        day: model.config.day + 1,
        flow: 'in',
        place: 'home'
      });
      clearInput();
      model = new OutsideModel(config);
      wakeSpawn = true;
      model.wakeAtSofa();
      panorama = false;
      snapCamera();
      hudSignature = '';
      draw();
      updateHUD();
      host.focus({
        preventScroll: true
      });
      return true;
    }
    function menu() {
      if (loading || loadError) return;
      clearInput();
      model.paused = !model.paused;
      hudSignature = '';
      updateHUD();
    }
    function togglePanorama() {
      if (loading || loadError || devOpen || model.paused || !atViewpoint(model)) return false;
      panorama = !panorama;
      panoramaTween = true;
      clearInput();
      updateHUD();
      return true;
    }
    function targetCamera(dt) {
      if (!atViewpoint(model)) panorama = false;
      if (lastScene !== model.scene) snapCamera();
      let w = 4.8,
        x = model.x,
        y = model.scene === 'home' ? .023 : model.y + .7,
        liftWidth = null,
        liftDisplayWidth = null;
      if (model.scene === 'street' && model.ride && !model.ride.call) {
        const r = model.ride,
          p = clamp((r.time - .45) / r.duration, 0, 1),
          zoom = smooth(clamp(r.time / 3, 0, 1)) * (1 - smooth(clamp((p - .73) / .27, 0, 1)));
        w = mix(4.8, 12.8, zoom);
        liftWidth = w;
        liftDisplayWidth = mix(global.LunaPixelCamera.settledWidth(4.8, surface), global.LunaPixelCamera.settledWidth(12.8, surface), zoom);
        // Both directions share the ascent panorama: Luna/lift at 6% of the frame, not
        // a fixed world offset. PPU-calibrated width varies with viewport/DPR.
        // Use the same easing as the zoom so boarding and arrival stay continuous.
        x = model.x + liftDisplayWidth * .44 * zoom;
        y = model.y + .7 + 1.0 * zoom;
      }
      if (model.qa?.camera) {
        ({
          w,
          x,
          y
        } = model.qa.camera);
      }
      if (model.encounter) {
        panorama = false;
        if (model.encounter.stage !== 'leaving') ({
          w,
          x,
          y
        } = model.encounter.camera);
      }
      if (model.scene === 'street' && (model.barArrival || model.transition?.barArrival)) x = .65;
      if (!panorama) ({
        w,
        x,
        y
      } = global.LunaOutsideResidents.frame(model, {
        w,
        x,
        y
      }));
      if (panorama) {
        w = VIEWPOINT.width;
        x = VIEWPOINT.x;
        y = -1.48 + w * 720 / 1280 / 2;
      }
      // Keep endpoint PPU alignment while the zoom follows the original smooth
      // cinematic curve. Quantizing this moving target caused 3x -> 2x -> 1x cuts.
      // Scale the original *visible* panorama, not its quantized logical width.
      // The tighter 2/3 framing is now 1.3x wider, without a PPU snapping jump.
      // Only Y viewing uses this framing; normal/lift PPU endpoints stay intact.
      const pixelGoal = panorama ? global.LunaPixelCamera.settledWidth(VIEWPOINT.previousWidth, surface) * VIEWPOINT.rangeScale : w === liftWidth ? liftDisplayWidth : global.LunaPixelCamera.settledWidth(w, surface);
      if (model.scene !== 'street' || model.ride || model.encounter || model.qa) panoramaTween = false;
      const rate = panorama || panoramaTween ? VIEWPOINT.easeRate : 5;
      pixelWidth = global.LunaPixelCamera.approachWidth(pixelWidth, pixelGoal, dt * rate / 5);
      if (!model.qa) {
        if (model.scene === 'home') x = global.LunaHomeArt.cameraX(x, w);else x = clamp(x, -22.25 + w / 2, 6.55 - w / 2);
      }
      // Constrain the visible bottom, not just the camera center, during zoom.
      const floor = data.scenes.street.nodes.find(n => n.name === '1F Floor').y + .02;
      if (model.scene === 'street') y = Math.max(y, floor + w * 720 / 1280 / 2);
      const t = 1 - Math.exp(-dt * rate);
      cam.x = mix(cam.x, x, t);
      cam.y = mix(cam.y, y, t);
      cam.w = mix(cam.w, w, t);
      if (model.scene === 'street') cam.y = Math.max(cam.y, floor + cam.w * 720 / 1280 / 2);
      if (!panorama && Math.abs(pixelWidth - pixelGoal) < .001 && Math.abs(cam.w - w) < .001 && Math.abs(cam.x - x) < .001 && Math.abs(cam.y - y) < .001) panoramaTween = false;
      if (model.encounter) model.encounter.cameraReady = Math.abs(cam.x - x) < .015 && Math.abs(cam.y - y) < .015 && Math.abs(cam.w - w) < .015;
    }
    function position(x, y) {
      return global.LunaPixelCamera.position(x, y, renderCam);
    }
    function drawSprite(sp, x, y, sx = 1, sy = 1, flip = false, alpha = 1, glow = false) {
      const img = images.get(sp.asset);
      if (!img) return;
      const p = global.LunaPixelCamera.sprite(sp, x, y, sx, sy, flip, renderCam, surface),
        w = p.w,
        h = p.h,
        rayReach = renderingNode?.lightRotation ? Math.abs(h * Math.sin(renderingNode.lightRotation)) : 0;
      if (p.x + w + rayReach < 0 || p.x - w - rayReach > 1280 || p.y + h < 0 || p.y - h > 720) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow) ctx.globalCompositeOperation = 'screen';
      ctx.translate(p.x, p.y);
      if (renderingNode?.lightRotation) ctx.rotate(-renderingNode.lightRotation);
      ctx.scale((sx < 0 ? -1 : 1) * (flip ? -1 : 1), sy < 0 ? -1 : 1);
      if (renderingNode?.name === 'home-city') global.LunaHomeArt.paintCity(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h, renderCam.x - renderingNode.x);
      else if (renderingNode?.name === 'main_bg' && model.scene === 'home') global.LunaHomeArt.paintRoom(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      else if (renderingNode?.name === 'home-fence' && model.scene === 'home') global.LunaHomeArt.paintFence(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      else if (renderingNode?.neon) global.LunaStreetSigns.paint(ctx, img, sp, w, h, renderingNode.engineLightId || renderingNode.id, model.time, global.matchMedia?.("(prefers-reduced-motion: reduce)").matches);else ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      if (model.scene === 'street') global.LunaStreetEngineEffects?.paintSprite(ctx, renderingNode?.name, img, images, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaWallLighting?.paintSprite(ctx, renderingNode?.name, img, sp, w, h);
      if (model.scene === 'street') global.LunaSignScanlines?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaVentSteam?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (renderingNode?.name === 'B_Obects') global.LunaWireSpark?.paint(ctx, img, images.get('street-wire-spark'), sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaBarrelFire?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      global.LunaLiftDust?.paintSprite(ctx, model, renderingNode?.name, sp, w, h, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (!global.LunaCaptureMode?.hidden) glowRenderer.paint(ctx, img, sp, renderingNode, x, y, w, h);
      ctx.restore();
    }
    function renderNode(n) {
      const previous = renderingNode;
      renderingNode = n;
      try {
        renderSceneNode(n);
      } finally {
        renderingNode = previous;
      }
    }
    function renderSceneNode(n) {
      if (global.LunaOutsideBeggar?.drawNode(model, n, drawSprite)) return;
      if (global.LunaOutsideResidents.drawNode(model, n, drawSprite, ctx, position)) return;
      if (global.LunaOutsideEncounters.drawNode(model, n, drawSprite)) return;
      if (!global.LunaOutsideContent.visibleNode(model, n)) return;
      if (n.name === 'shiba') {
        if (global.LunaOutsideShop.visible(model)) {
          const a = data.animations.shiba;
          drawSprite(a.frames[Math.floor(model.time * a.fps) % a.frames.length], n.x, n.y, n.sx, n.sy, n.flip);
        }
        return;
      }
      if (n.name === 'Samho' && [2, 3].includes(model.config.day)) {
        global.LunaOutsideSamhoCommute.draw(model, drawSprite);
        return;
      }
      if (n.name === 'Samho' && global.lunaCampaign?.session.active && model.config.flow === 'in' && model.config.day >= 2) {
        const phase = model.time % 4,
          frame = phase < .3 ? Math.floor(phase * 10) % 3 : 0;
        drawSprite({
          ...n.sprite,
          x: frame * 84
        }, n.x, n.y, n.sx, n.sy, global.LunaOutsideAmbient.faceTarget(n.x, model.x));
        return;
      }
      if (!n.active || n.name === 'Luna' || n.name === 'Square' || /SAMHO|samho|Samho|Bubi/.test(n.name)) return;
      if (n.ambient && !global.LunaOutsideAmbient.visible(model, n)) return;
      let y = n.y;
      if (model.scene === 'street' && n.ancestry.includes('Elevator') && ['Elevator', 'Elevator Connector', 'Elevator Fore', 'Elevator Door'].includes(n.name)) y += model.elevatorY - BOTTOM;
      // Preserve the supplied sprite cutouts and world coordinates, including the exterior.
      const light = n.light || /City.*Light/.test(n.name);
      let sp = n.ambient ? global.LunaOutsideAmbient.frame(n, model.time) : n.sprite;
      const facing = global.LunaOutsideAmbient.facing(n, model),
        art = streetParallax(n, renderCam, model);
      drawSprite(sp, art.x, art.y + (y - n.y), n.sx, n.sy, facing, n.alpha ?? (light ? .26 : 1), light);
    }
    function drawEntranceCue() {
      if (!firstCommuteEntranceCue(model)) return;
      const door = data.scenes.street.nodes.find(n => n.name === 'Bar Spawn Point');
      if (!door) return;
      const k = 1280 / renderCam.w,
        p = position(door.x, -.98);
      if (p.x + .3 * k < 0 || p.x - .3 * k > 1280) return;
      const still = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        t = still ? 0 : model.time;
      const drift = still ? 0 : Math.sin(t * Math.PI * 2 / .9) * .012 * k;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Trace the doorway below the sign, in the entrance sprite's pixel space.
      // Keep the frame fixed to the art (only the arrow nudges), behind Luna.
      const sp = door.sprite,
        outline = [[2, 15], [36, 15], [36, 66], [2, 66], [2, 15]];
      ctx.strokeStyle = '#c9ffff';
      ctx.lineWidth = k * .008;
      ctx.globalAlpha = .96;
      ctx.shadowColor = '#4ae5f4';
      ctx.shadowBlur = 7 * k / 266.667;
      ctx.beginPath();
      outline.forEach(([x, y], i) => {
        const q = position(door.x + (x - sp.w * sp.pivot.x) * door.sx / sp.ppu, door.y + (sp.h * (1 - sp.pivot.y) - y) * door.sy / sp.ppu);
        if (i) ctx.lineTo(q.x, q.y);else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      // Match the bar tutorial's single, round-capped cyan arrow and gentle nudge.
      ctx.translate(p.x, p.y - drift);
      ctx.scale(k / 266.667, k / 266.667);
      ctx.strokeStyle = '#c9ffff';
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = .98;
      ctx.shadowColor = '#4ae5f4';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(0, 0);
      ctx.moveTo(-10, 10);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, 10);
      ctx.stroke();
      ctx.restore();
    }
    function interactionTarget() {
      const m = model;
      return m && !m.paused && !loading && !loadError && !devOpen && !hintOpen && !m.controlsTutorial && !m.dialog && !m.story.blocking && !global.lunaCampaign?.blocking ? m.near : null;
    }
    function draw(advanceParallax = true) {
      if (!ctx || !model) return;
      if (surface.dpr !== devicePixelRatio) fit();
      renderCam = global.LunaPixelCamera.view(cam, surface, {
        scene: model.scene,
        qa: !!model.qa,
        displayWidth: pixelWidth,
        floor: data.scenes.street.nodes.find(n => n.name === '1F Floor').y + .02
      });
      ctx.setTransform(surface.factor, 0, 0, surface.factor, 0, 0);
      glowRenderer.begin(model.qa || global.LunaCaptureMode?.hidden ? null : interactionTarget(), model);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1280, 720);
      if (loading || loadError) return;
      if (advanceParallax) global.LunaStreetParallax.update(model, data.scenes.street.nodes, { x: cam.x, locked: panorama || panoramaTween || !!model.ride });
      if (model.qa) {
        global.LunaOutsideQA.draw({
          m: model,
          ctx,
          position,
          sprite: drawSprite,
          data,
          player: () => {
            const a = data.animations[model.anim];
            drawSprite(a.frames[Math.floor(model.animTime * a.fps) % a.frames.length], model.x, model.y, 1, 1, model.facing > 0);
          }
        });
        if (model.transition) {
          ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, 1 - Math.abs(model.transition.time - .38) / .47) + ')';
          ctx.fillRect(0, 0, 1280, 720);
        }
        return;
      }
      const nodes = data.scenes[model.scene].nodes.slice().sort((a, b) => a.layer - b.layer || a.order - b.order || b.z - a.z);
      if (model.scene === 'home') {
        nodes.filter(n => n.name === 'home-city').forEach(renderNode);
        const bg = nodes.find(n => n.name === 'main_bg');
        global.LunaOutsideRain?.drawHome(ctx, model, renderCam, position, bg, 'rain');
        if (bg) renderNode(bg);
        global.LunaOutsideRain?.drawHome(ctx, model, renderCam, position, bg, 'glass');
        nodes.filter(n => !['home-city', 'main_bg', 'ForeFore_Object', 'home-fence'].includes(n.name)).forEach(renderNode);
      }
      const drawPlayer = () => {
        const anim = data.animations[model.anim],
          frame = anim.frames[Math.floor(model.animTime * anim.fps) % anim.frames.length];
        drawSprite(frame, model.x, model.y, 1, 1, model.facing > 0);
      };
      if (model.scene === 'home') {
        drawPlayer();
        nodes.filter(n => ['ForeFore_Object', 'home-fence'].includes(n.name)).forEach(renderNode);
      } else {
        let farTraffic = false,
          midTraffic = false,
          nearTraffic = false,
          adCarrier = false,
          groundRain = false;
        for (const n of streetDrawOrder(nodes)) {
          // Ground impacts belong to the road, behind the frontmost silhouettes
          // (and elevator front). Falling rain gets a separate foreground pass.
          if (!groundRain && n.layer >= 10) {
            global.LunaOutsideRain?.draw(ctx, model, renderCam, position, 'splashes');
            groundRain = true;
          }
          // Traffic is part of the scene, not an overlay: skyline silhouettes,
          // foreground shops and the residence/lift naturally cover it afterwards.
          if (!farTraffic && n.name === 'C_Back_Building_2') {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'far');
            farTraffic = true;
          }
          if (!midTraffic && n.layer >= 3) {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'mid');
            midTraffic = true;
          }
          if (!nearTraffic && n.layer >= 6) {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'near');
            nearTraffic = true;
          }
          // Middle-city buildings AND their attached display planes (layers
          // 3–5) stay behind the carrier; street/residence foreground stays ahead.
          // The advertising hull is opaque; depth is established by occlusion.
          if (!adCarrier && (n.name === 'residence-building' || n.layer >= 6)) {
            global.LunaOutsideAdCarrier?.draw(ctx, model, renderCam, position, images);
            adCarrier = true;
          }
          if (n.name === 'Luna') {
            drawEntranceCue();
            global.LunaOutsideThug?.draw(model, drawSprite, ctx, position);
            global.LunaOutsideNotion?.draw(model, drawSprite, ctx, position);
            drawPlayer();
          } else renderNode(n);
        }
      }
      global.LunaOutsideRain?.draw(ctx, model, renderCam, position, 'drops');
      const shade = ctx.createLinearGradient(0, 0, 0, 720);
      shade.addColorStop(0, 'rgba(0,0,0,.25)');
      shade.addColorStop(.25, 'rgba(0,0,0,0)');
      shade.addColorStop(.85, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,.3)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, 1280, 720);
      global.LunaRainGlass?.draw(ctx, model, {camera:renderCam});
      if (model.transition) {
        const t = model.transition.time,
          alpha = t < .38 ? t / .38 : 1 - (t - .38) / .47;
        ctx.fillStyle = `rgba(0,0,0,${clamp(alpha, 0, 1)})`;
        ctx.fillRect(0, 0, 1280, 720);
      }
    }
    const controlsDismissKeys = new Set();
    let controlsUnlockAt = 0,
      controlsStep = 0;
    function showControlsTutorial() {
      if (!active || model.scene !== 'home' || model.config.day !== 0 || model.config.flow !== 'in' || model.controlsTutorial) return;
      clearInput();
      controlsStep = 0;
      controlsUnlockAt = performance.now() + 2000;
      model.controlsTutorial = true;
      updateHUD();
      host.querySelector('.outside-controls-tutorial')?.focus({
        preventScroll: true
      });
    }
    function dismissControlsTutorial() {
      if (!model.controlsTutorial || model.paused || loading || loadError || devOpen || performance.now() < controlsUnlockAt) return;
      if (controlsStep === 0) {
        controlsStep = 1;
        controlsUnlockAt = performance.now() + 300;
        clearInput();
        updateHUD();
        host.querySelector('.outside-controls-tutorial')?.focus({
          preventScroll: true
        });
        return;
      }
      global.LunaControlsTutorial.stop();
      model.controlsTutorial = false;
      clearInput();
      const campaign = global.lunaCampaign;
      if (model.isFirstCommute() && campaign?.active && global.LunaStoryNotices.startGoal(global.barGame.progress, 'first_commute', '첫 출근하기!') && campaign.session.carry) campaign.session.carry.objectives = structuredClone(global.barGame.progress.objectives);
      updateHUD();
      host.focus({
        preventScroll: true
      });
    }
    function controlsTutorialKey(e) {
      if (!active) return false;
      // Consume the dismissing key until release, including movement key repeats.
      if (controlsDismissKeys.has(e.code)) return true;
      if (!model.controlsTutorial || model.paused || loading || loadError || devOpen) return false;
      if (!e.repeat) {
        controlsDismissKeys.add(e.code);
        if (e.code === 'KeyE' && !e.metaKey && !e.ctrlKey && !e.altKey && performance.now() >= controlsUnlockAt) dismissControlsTutorial();
      }
      return true;
    }
    function paintControlsTutorial() {
      let panel = host.querySelector('.outside-controls-tutorial');
      if (model.scene !== 'home' || model.config.flow !== 'in' || model.config.day !== 0) model.controlsTutorial = false;
      if (model.controlsTutorial && !panel) {
        panel = document.createElement('section');
        panel.className = 'outside-controls-tutorial';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.tabIndex = -1;
        const shade = document.createElement('div');
        shade.className = 'outside-controls-shade';
        shade.append(panel);
        host.querySelector('.outside-stage').append(shade);
      }
      if (!panel) return;
      const wasVisible = panel.dataset.visible === 'true';
      panel.hidden = !model.controlsTutorial || model.paused || loading || !!loadError || devOpen || !!model.dialog || model.story.blocking;
      panel.parentElement.hidden = panel.hidden;
      panel.dataset.visible = String(!panel.hidden);
      if (panel.hidden) {
        if (wasVisible) global.LunaControlsTutorial.stop();
        if (!model.controlsTutorial) delete panel.dataset.step;
      } else {
        if (panel.dataset.step !== String(controlsStep)) {
          global.LunaControlsTutorial.render(panel, controlsStep, images, data);
          const step = controlsStep,
            owner = model;
          void global.LunaControlsTutorial.play(() => active && model === owner && model.controlsTutorial && controlsStep === step && !panel.hidden);
        }
        const locked = performance.now() < controlsUnlockAt;
        panel.dataset.locked = String(locked);
      }
      host.querySelector('.outside-hud').inert = !panel.hidden || model.paused || devOpen || !!model.dialog;
    }
    function paintHomewardGuide() {
      let el = host.querySelector('.outside-homeward-guide');
      if (!el) {
        el = document.createElement('aside');
        el.className = 'outside-homeward-guide';
        el.setAttribute('aria-label', '귀가 안내');
        el.dataset.visible = 'false';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<div class="homeward-copy"><strong>집으로 가기</strong><small></small></div>';
        host.querySelector('.outside-stage').append(el);
        // Establish the off-screen position before the first entrance transition.
        el.getBoundingClientRect();
      }
      const m = model,
        cue = homewardCues(m)[0];
      // Keep directions visible during conversations; boarding the lift hides them.
      // Do not use hidden/display:none: the exit must finish sliding off-screen.
      const visible = !!cue && !m.paused && !loading && !loadError && !devOpen && !hintOpen && !panorama && !m.controlsTutorial && !global.lunaCampaign?.blocking;
      if (el.dataset.visible !== String(visible)) {
        el.dataset.visible = String(visible);
        el.setAttribute('aria-hidden', String(!visible));
      }
      if (!cue) return;
      const atTarget = m.near?.id === (cue.id === 'lift' ? 'elevator' : 'home');
      const direction = atTarget ? 'up' : cue.direction;
      const detail = atTarget ? cue.id === 'lift' ? 'E · 엘리베이터로 위층 이동' : 'E · 집에 들어가기' : (cue.direction === 'left' ? '왼쪽 ' : '오른쪽 ') + (cue.id === 'lift' ? '엘리베이터로 이동' : '집 입구로 이동');
      if (el.dataset.direction !== direction) el.dataset.direction = direction;
      el.dataset.destination = cue.id;
      const copy = el.querySelector('small');
      if (copy.textContent !== detail) copy.textContent = detail;
    }
    function updateHUD() {
      if (!host) return;
      notices?.update(model);
      const m = model,
        near = m.near,
        actionLabel = interactionLabel(m, near),
        overlay = host.querySelector('.outside-overlay'),
        hud = host.querySelector('.outside-hud'),
        viewpoint = atViewpoint(m) && !panorama && !loading && !loadError && !m.paused && !devOpen;
      // Scripted pauses belong to the campaign/cutscene, not the outside ESC menu.
      const showPauseMenu = m.paused && !global.lunaCampaign?.blocking;
      const signature = JSON.stringify([loading, loadError, m.paused, showPauseMenu, m.dialog, m.scene, m.level, near?.id, near?.label, actionLabel, !!m.ride, m.ride?.call, panorama, viewpoint, m.story.blocking, m.encounter?.stage, devOpen, hintOpen]);
      if (signature !== hudSignature) {
        hudSignature = signature;
        host.querySelector('.outside-dynamic').innerHTML = `<button class="outside-interact" aria-label="${esc(actionLabel + (near?.label ? ' · ' + near.label : ''))}" data-outside-action="interact" ${near && !m.paused ? '' : 'hidden'}><kbd aria-hidden="true">E</kbd><span>${esc(actionLabel)}</span></button><button class="outside-viewpoint" aria-label="${panorama ? '전경 보기에서 돌아오기' : '거리 전경 보기'}" aria-pressed="${panorama}" data-outside-action="panorama" ${viewpoint ? '' : 'hidden'}><kbd aria-hidden="true">Y</kbd></button>`;
        let body = '';
        if (loading) body = '<div class="resource-loading" role="status" aria-label="로딩 중"><span class="resource-loading-copy" aria-hidden="true">로딩 중<span class="resource-loading-dots"></span></span></div>';else if (loadError) body = '<section class="outside-dialog"><h2>불러오기 실패</h2><p>' + loadError + '</p>' + button('다시 시도', 'retry') + button('로비로', 'exit') + '</section>';else if (hintOpen) body = '<section class="outside-dialog outside-entry-hint" role="dialog" aria-modal="true" aria-labelledby="outside-hint-title"><kbd>P</kbd><h2 id="outside-hint-title">탐색 중에 설정을 바꿔 보세요</h2><p>P를 누르면 위치·출근길/퇴근길·일차를 변경할 수 있습니다.<br>99일차를 선택하면 QA 전용 공간으로 이동합니다.</p>' + button('확인', 'hint-close', 'primary') + '</section>';else if (showPauseMenu) body = global.LunaSettings.html({
          context: 'outside',
          onClose: () => {
            menu();
            host.focus({
              preventScroll: true
            });
          },
          exitLabel: '탐색 시작 화면으로',
          onExit: () => exit(),
          onRestart: () => {
            clearInput();
            model.start(config);
            if (wakeSpawn) model.wakeAtSofa();
            panorama = false;
            snapCamera();
            hudSignature = '';
            updateHUD();
            host.focus({
              preventScroll: true
            });
          }
        });else if (m.dialog?.kind === 'inspection') body = global.LunaOutsideInspection.html(m.dialog);else if (m.dialog && !['sofa','elevator','tv'].includes(m.dialog.kind)) body = '<section class="outside-dialog outside-object-dialog" role="dialog" aria-modal="true" aria-label="' + esc(m.dialog.title) + '"><h2>' + esc(m.dialog.title) + '</h2><p>' + esc(m.dialog.text) + '</p>' + button('닫기 · E', 'interact', 'primary') + '</section>';
        overlay.classList.toggle('is-inspection', !showPauseMenu && !hintOpen && m.dialog?.kind === 'inspection');
        overlay.innerHTML = body;
        overlay.hidden = !body;
        hud.inert = !!body || devOpen;
        if (body) overlay.querySelector('button')?.focus({
          preventScroll: true
        });
      }
      const prompt = host.querySelector('.outside-interact');
      if (prompt) prompt.hidden = !interactionTarget();
      const lookout = host.querySelector('.outside-viewpoint');
      if (lookout && viewpoint) {
        const p = position(VIEWPOINT.x, model.y + .26);
        lookout.style.left = clamp(p.x, 24, 1256) + 'px';
        lookout.style.top = clamp(p.y - 12, 42, 696) + 'px';
      }
      paintControlsTutorial();
      updateSpeech();
      paintDev();
      paintHomewardGuide();
      host.querySelector('.outside-speech').inert = devOpen;
      host.querySelectorAll('.outside-background-speech').forEach(el => el.inert = devOpen);
      let saved = host.querySelector('.outside-save-feedback');
      if (!saved) {
        saved = document.createElement('div');
        saved.className = 'outside-save-feedback';
        saved.setAttribute('role', 'status');
        saved.setAttribute('aria-live', 'polite');
        host.querySelector('.outside-stage').append(saved);
      }
      const showSaved = m.notice === '저장 완료!' && m.noticeLeft > 0;
      if (saved.textContent !== (showSaved ? m.notice : '')) saved.textContent = showSaved ? m.notice : '';
      saved.hidden = !showSaved || m.paused || devOpen;
      saved.style.opacity = Math.min(1, m.noticeLeft / .35);
    }
    function updateSpeech() {
      const v = model.story.view();
      renderSpeech(host.querySelector('.outside-speech'), v);
      const objectKind=model.dialog?.kind;
      const choice = ['elevator','tv'].includes(objectKind) ? {
        key:model.dialog.key,label:objectKind==='tv'?'TV':'엘리베이터',
        options:[{id:'confirm',label:objectKind==='tv'?'TV를 본다':model.level?'내려간다':'올라간다'},{id:'cancel',label:objectKind==='tv'?'끈다':'취소'}]
      } : model.dialog?.kind === 'sofa' ? {
        key: model.dialog.key,
        label: '소파 선택지',
        options: [{
          id: 'sleep',
          label: '휴식'
        }, {
          id: 'save',
          label: '저장'
        }, {
          id: 'cancel',
          label: '취소'
        }]
      } : v?.choice && v.purchase ? {
        ...v.purchase,
        key: v.key
      } : null;
      choiceUI?.update(choice && !model.paused && !loading && !loadError && !devOpen && !hintOpen ? {
        ...choice,
        head: position(model.x, model.y + .16),
        facing: model.facing
      } : null);
      const views = model.backgroundStory.views(),
        bubbles = [...host.querySelectorAll('.outside-background-speech')];
      while (bubbles.length < views.length) {
        const el = document.createElement('div');
        el.className = 'outside-background-speech';
        host.querySelector('.outside-stage').insertBefore(el, host.querySelector('.outside-overlay'));
        bubbles.push(el);
      }
      bubbles.forEach((el, i) => {
        if (i >= Math.max(1, views.length)) {
          el.remove();
          return;
        }
        el.dataset.storyId = views[i]?.key.split(':')[0] || '';
        renderSpeech(el, views[i] || null, true);
      });
    }
    function renderSpeech(el, v, background = false) {
      el.hidden = !v || model.paused || loading || !!loadError;
      if (!v) {
        el.dataset.key = '';
        return;
      }
      const key = v.key + ':' + v.canTreat;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.classList.toggle('is-auto', v.auto);
        el.setAttribute('role', v.auto ? 'status' : v.choice ? 'group' : 'button');
        el.tabIndex = !v.auto && !v.choice ? 0 : -1;
        el.setAttribute('aria-label', '대화');
        el.innerHTML = global.LunaExteriorTextbox.html() + '<p></p>';
        global.LunaExteriorTextbox.mountText(el.querySelector('p'), v.full, v.emphasis || [], background);
        if (!v.auto && !v.choice && !devOpen) el.focus({
          preventScroll: true
        });
      }
      el.querySelector('p').hidden = !v.full;
      global.LunaDialogueCue.sync(el, !v.auto && !v.choice && !!v.full && v.text === v.full);
      global.LunaExteriorTextbox.revealText(el.querySelector('p'), Array.from(v.text).length);
      const p = position(v.anchor.x, v.anchor.y);
      global.LunaWorldSpeech.place(el, {
        ...p,
        scale: 4.8 / renderCam.w,
        gap: 22
      });
    }
    function tick(dt) {
      if (!active) return;
      notices?.update(model, loading ? 0 : dt);
      if (!loading && !loadError && !global.LunaFocusSettings.hiddenPaused && !devOpen && !hintOpen && !model.controlsTutorial) {
        const left = keys.has('KeyA') || keys.has('ArrowLeft'),
          right = keys.has('KeyD') || keys.has('ArrowRight');
        model.tick(dt, {
          move: Number(right) - Number(left),
          run: keys.has('ShiftLeft') || keys.has('ShiftRight')
        });
        if (!model.paused) {
          targetCamera(Math.min(dt, .05));
          global.LunaOutsideResidents.tickView(model, cam);
        }
      }
      draw();
      updateHUD();
    }
    document.addEventListener('change', e => {
      const key = e.target.dataset?.outsideSetting;
      if (!key) return;
      const value = e.target.value;
      if (key === 'place' && Object.hasOwn(PLACES, value)) config.place = value;
      if (key === 'flow' && Object.hasOwn(FLOWS, value)) config.flow = value;
      if (key === 'day') config.day = Number(value) === 99 ? 99 : clamp(Number(value) || 0, 0, 3);
    }, true);
    document.addEventListener('click', e => {
      if (active && devOpen) {
        const control = e.target.closest('.outside-dev-console [data-outside-action]');
        if (control && !control.disabled) {
          e.preventDefault();
          devAction(control.dataset.outsideAction);
        }
        return;
      }
      if (active && !model.paused && !loading && !loadError && e.target.closest('.outside-speech') && !e.target.closest('button') && model.story.blocking && !model.story.speech.choice) {
        e.preventDefault();
        clearInput();
        model.story.advance();
        updateHUD();
        return;
      }
      const b = e.target.closest('[data-outside-action]');
      if (!b) return;
      const a = b.dataset.outsideAction;
      e.preventDefault();
      if (a === 'start') {
        Object.assign(config, {
          day: 0,
          flow: 'out',
          place: 'bar'
        });
        start({
          showDevHint: true
        });
        return;
      }
      if (!active) return;
      if (a === 'hint-close') dismissHint();else if (a === 'exit') exit();else if (a === 'retry') {
        exit();
        start();
      } else if (a === 'menu') menu();else if (a === 'restart') {
        clearInput();
        model.start(config);
        if (wakeSpawn) model.wakeAtSofa();
        panorama = false;
        snapCamera();
        hudSignature = '';
      } else if (a === 'bd-choice') {
        if (b.disabled) return;
        clearInput();
        model.story.choose(b.dataset.choice);
      } else if (a === 'panorama') togglePanorama();else if (a === 'interact') {
        clearInput();
        model.interact();
      }
      updateHUD();
    });
    window.addEventListener('keydown', e => {
      if (!active) return;
      if (controlsTutorialKey(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (devKey(e)) return;
      if (hintOpen && e.code !== 'Tab') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat && ['Escape', 'Space', 'Enter', 'KeyE'].includes(e.code)) dismissHint();
        return;
      }
      if (choiceUI?.key(e)) return;
      if (e.code === 'Tab') {
        const scope = host.querySelector('.outside-overlay:not([hidden])') || (model.story.blocking ? host.querySelector('.outside-speech') : host),
          buttons = [...(scope.matches('[tabindex="0"]') ? [scope] : []), ...scope.querySelectorAll('button:not([hidden]):not(:disabled),[tabindex="0"]')].filter(b => !b.closest('[inert]') && b.getClientRects().length),
          i = buttons.indexOf(document.activeElement);
        e.preventDefault();
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        return;
      }
      if (global.lunaQA?.opened) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyY', 'Escape', 'Space'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (e.code === 'Escape' && !e.repeat) {
        if (['inspection', 'sofa', 'elevator', 'tv'].includes(model.dialog?.kind) && !model.paused) {
          clearInput();
          model.interact();
          updateHUD();
          host.focus({
            preventScroll: true
          });
        } else menu();
        return;
      }
      if (loading || loadError || model.paused) return;
      if (model.story.speech?.choice) return;
      if (e.code === 'KeyY') {
        if (!e.repeat) togglePanorama();
        return;
      }
      if ((e.code === 'KeyE' || e.code === 'Space' && model.story.blocking || e.code === 'Enter' && e.target.matches('.outside-speech[role="button"]')) && !e.repeat) {
        e.preventDefault();
        clearInput();
        if (e.code === 'KeyE') model.controlsInteractUntil = performance.now() + 180;
        model.interact();
        updateHUD();
        return;
      }
      // A held key from the ride is not a new walking command on arrival.
      if (!model.ride && !e.repeat && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) keys.add(e.code);
    }, true);
    window.addEventListener('keyup', e => {
      keys.delete(e.code);
      controlsDismissKeys.delete(e.code);
    });
    function loseFocus() {
      controlsDismissKeys.clear();
      if (!active) return;
      if (devOpen) toggleDev(false);
      clearInput();
      if (global.LunaFocusSettings.enabled && !loading && !loadError) {
        model.paused = true;
        updateHUD();
      }
    }
    window.addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) loseFocus();
    });
    window.addEventListener('resize', fit);
    function snapshot(view = null) {
      if (!ctx || loading || loadError) return null;
      const oldCam = cam,
        oldScene = model.scene,
        oldPixelWidth = pixelWidth;
      try {
        if (view) {
          cam = {
            ...view
          };
          pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
          model.scene = 'street';
        }
        draw(false);
        return canvas.toDataURL('image/png');
      } finally {
        cam = oldCam;
        model.scene = oldScene;
        pixelWidth = oldPixelWidth;
        draw(false);
      }
    }
    return {
      get interactionGlow() {
        return glowRenderer.snapshot();
      },
      get active() {
        return active;
      },
      get devConsoleOpen() {
        return devOpen;
      },
      get model() {
        return model;
      },
      get loading() {
        return loading;
      },
      get loadError() {
        return loadError;
      },
      get camera() {
        return {
          ...cam
        };
      },
      get renderCamera() {
        return {
          ...renderCam
        };
      },
      get pixelSurface() {
        return {
          ...surface
        };
      },
      config,
      lobbyHTML,
      start,
      exit,
      advanceDay,
      showControlsTutorial,
      controlsTutorialKey,
      notifyItem: (m, id) => active && m === model && notices?.add(m, id),
      tick,
      clearInput,
      snapshot,
      snapCamera,
      openDev: () => toggleDev(true),
      devAction,
      refreshHUD: updateHUD
    };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJnbG9iYWwiLCJjbGFtcCIsInYiLCJhIiwiYiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJtaXgiLCJ0Iiwic21vb3RoIiwiUExBQ0VTIiwiYmFyIiwiaG9tZURvb3IiLCJob21lIiwiRkxPV1MiLCJpbiIsIm91dCIsIlIiLCJMdW5hUmVzaWRlbmNlIiwibGF5b3V0IiwiU09GQSIsImlkIiwibGFiZWwiLCJ4IiwieSIsIklOVEVSQUNUSU9OX0xBQkVMUyIsIk9iamVjdCIsImZyZWV6ZSIsImV4aXQiLCJlbGV2YXRvciIsInR2Iiwic29mYSIsIlRBTEtfVEFSR0VUUyIsIlNldCIsImludGVyYWN0aW9uTGFiZWwiLCJtb2RlbCIsInRhcmdldCIsImMiLCJMdW5hT3V0c2lkZVFBIiwiY2F0YWxvZyIsImZpbmQiLCJxYSIsImNhc2VJZCIsImV2ZW50IiwiTHVuYU91dHNpZGVDb250ZW50IiwiZXZlbnRzIiwiZSIsInNvdXJjZSIsImtpbmQiLCJvYmplY3QiLCJoYXMiLCJlbmNvdW50ZXIiLCJhY3RvciIsIkJPVFRPTSIsImVsZXZhdG9yQm90dG9tIiwiVE9QIiwiZWxldmF0b3JUb3AiLCJFWCIsImVsZXZhdG9yWCIsIlZJRVdQT0lOVCIsInJhZGl1cyIsIndpZHRoIiwicHJldmlvdXNXaWR0aCIsInJhbmdlU2NhbGUiLCJlYXNlUmF0ZSIsIkZJUlNUX0NPTU1VVEVfQVJSSVZBTCIsImZyb20iLCJ0byIsIlNUUkVFVF9ERVBUSCIsIlNreSIsIkNfQmFja19CdWlsZGluZ18yIiwiQ19CYWNrX0J1aWxkaW5nXzEiLCJDX01pZGRsZV9CdWlsZGluZ18xIiwiQ19NaWRkbGVfQnVpbGRpbmdfMiIsIkNfTWlkZGxlX0J1aWxkaW5nXzMiLCJDX01pZGRsZV9PYmplY3RfMSIsIkNfTWlkZGxlX09iamVjdF8yIiwiQ2l0eUxpZ2h0IiwiQ2l0eVVwTGlnaHQiLCJCX0ZvcmVGb3JlX09iamVjdF8xIiwic3RyZWV0UGFyYWxsYXgiLCJuIiwiY2FtZXJhIiwic3BlZWQiLCJzY2VuZSIsImFtYmllbnQiLCJhbmNlc3RyeSIsIm5hbWUiLCJhdFZpZXdwb2ludCIsIm0iLCJjb25maWciLCJkYXkiLCJsZXZlbCIsImFicyIsInJpZGUiLCJ0cmFuc2l0aW9uIiwiZGlhbG9nIiwic3RvcnkiLCJibG9ja2luZyIsImZpcnN0Q29tbXV0ZUVudHJhbmNlQ3VlIiwiZmxvdyIsImZpcnN0SG9tZXdhcmQiLCJzeW5jSG9tZXdhcmRHb2FsIiwiY2FtcGFpZ24iLCJsdW5hQ2FtcGFpZ24iLCJhY3RpdmUiLCJvdXRzaWRlUGxheXRlc3QiLCJwIiwiYmFyR2FtZSIsInByb2dyZXNzIiwibm90aWNlcyIsIkx1bmFTdG9yeU5vdGljZXMiLCJjaGFuZ2VkIiwic3RhcnRHb2FsIiwiY29tcGxldGVHb2FsIiwic2Vzc2lvbiIsImNhcnJ5Iiwib2JqZWN0aXZlcyIsInN0cnVjdHVyZWRDbG9uZSIsImhvbWV3YXJkQ3VlcyIsImNhbGwiLCJmaXJzdF9ob21ld2FyZCIsInN0YXR1cyIsInVwcGVyIiwidGFyZ2V0WCIsImhvbWVYIiwiZGVsdGEiLCJhcnJpdmFsIiwiZGlyZWN0aW9uIiwiZGVzdGluYXRpb24iLCJkZXRhaWwiLCJzdHJlZXREcmF3T3JkZXIiLCJub2RlcyIsInJhbmsiLCJzbGljZSIsInNvcnQiLCJsYXllciIsIm9yZGVyIiwieiIsIlN0cmluZyIsImxvY2FsZUNvbXBhcmUiLCJpbnRlcmFjdGlvbkFuY2hvciIsImRhdGEiLCJ0b3AiLCJMdW5hT3V0c2lkZUVuY291bnRlcnMiLCJuYW1lcyIsInNjZW5lcyIsIm5vZGVOYW1lIiwic3AiLCJzcHJpdGUiLCJzeCIsImZsaXAiLCJzeSIsInBpdm90IiwidyIsInBwdSIsImgiLCJPdXRzaWRlTW9kZWwiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJzdGFydCIsInBsYWNlIiwicWFPcHRpb25zIiwiaGFzT3duIiwiTnVtYmVyIiwiZmxvb3IiLCJMdW5hTGlmdER1c3QiLCJyZXNldCIsImJhckFycml2YWwiLCJjb21tdXRlQm91bmRhcnlTaWRlIiwiYmVnZ2FyRGVwYXJ0dXJlIiwibGlmdExvZ29TZWVuIiwidGh1Z0ZsYWdzIiwic2FtaG9Db21tdXRlRmxhZ3MiLCJub3Rpb25GbGFncyIsInVwcGVyWSIsImNvbnRyb2xzVHV0b3JpYWwiLCJjb250cm9sc0ludGVyYWN0VW50aWwiLCJlbGV2YXRvclkiLCJmYWNpbmciLCJhbmltIiwiYW5pbVRpbWUiLCJ0aW1lIiwicGF1c2VkIiwibmVhciIsIm5vdGljZSIsIm5vdGljZUxlZnQiLCJhcnJpdmFscyIsInJldmlzaW9uIiwiTHVuYU91dHNpZGVTdG9yeSIsIlN0b3J5IiwiYmFja2dyb3VuZFN0b3J5IiwiQmFja2dyb3VuZFN0b3JpZXMiLCJwbGF5ZWRBbWJpZW50IiwidHZOZXdzSW5SYW5nZSIsIm5vdGlvbkNvbW11dGVTZWVuIiwiaW5pdCIsInVwZGF0ZU5lYXIiLCJ3YWtlQXRTb2ZhIiwiY2hvb3NlU29mYSIsImluY2x1ZGVzIiwiaW50ZXJhY3RPdXRzaWRlIiwidmlldyIsInNsZWVwIiwidGl0bGUiLCJ0ZXh0IiwiZmlyc3RDb21tdXRlRGlyZWN0aW9ucyIsImlzRmlyc3RDb21tdXRlIiwia2V5IiwiZmxhZ3MiLCJyb3dzIiwidHlwZSIsImJlZ2luUm93cyIsImNsZWFySW5wdXQiLCJ0aWNrQmFyQXJyaXZhbCIsImR0IiwidGFyZ2V0cyIsIkx1bmFPdXRzaWRlTm90aW9uIiwiTHVuYU91dHNpZGVTaG9wIiwiTHVuYU91dHNpZGVCZWdnYXIiLCJmb3JjZWQiLCJydW50aW1lIiwiZmlsdGVyIiwiYmVnaW5FbmNvdW50ZXIiLCJwcmVwYXJlIiwiY2FuY2VsIiwiaW50ZXJhY3QiLCJzdGFnZSIsImFkdmFuY2UiLCJpbnNwZWN0aW9uIiwiTHVuYU91dHNpZGVJbnNwZWN0aW9uIiwiZm9yVGFyZ2V0Iiwic3BlZWNoIiwibG9jYWwiLCJyZW1vdGUiLCJkdXJhdGlvbiIsInF1aWV0TGlmdCIsInN3YXBwZWQiLCJMdW5hSG9tZURvb3JBdWRpbyIsInBsYXkiLCJ0aWNrIiwiaW5wdXQiLCJ0aWNrQmFja2dyb3VuZCIsIkx1bmFPdXRzaWRlVGh1ZyIsIkx1bmFPdXRzaWRlU2FtaG9Db21tdXRlIiwiY2FtZXJhUmVhZHkiLCJlbGFwc2VkIiwib2xkIiwiYmVnaW4iLCJyIiwibGFuZCIsInBhc3Nlbmdlck9mZnNldCIsIm1vdmUiLCJydW4iLCJyZXN0cmljdGVkIiwiYm91bmRzIiwidXBwZXJNaW4iLCJ1cHBlck1heCIsImxvd2VyTWluIiwiZGVzaXJlZCIsInNpZGUiLCJuZXh0IiwiY3JlYXRlIiwib25FeGl0IiwiY3VycmVuY3lWaWV3IiwiTHVuYUN1cnJlbmN5VmlldyIsImdsb3dSZW5kZXJlciIsIkx1bmFJbnRlcmFjdGlvbkdsb3ciLCJyZW5kZXJpbmdOb2RlIiwiY2hvaWNlVUkiLCJMVU5BX09VVFNJREVfREFUQSIsImltYWdlcyIsIk1hcCIsImtleXMiLCJsb2FkaW5nIiwibG9hZEVycm9yIiwiaG9zdCIsImNhbnZhcyIsImN0eCIsImNhbSIsImdlbmVyYXRpb24iLCJodWRTaWduYXR1cmUiLCJsYXN0U2NlbmUiLCJwYW5vcmFtYSIsIndha2VTcGF3biIsImRldk9wZW4iLCJoaW50T3BlbiIsInN0cmVldExvY2F0aW9uIiwic3VyZmFjZSIsIkx1bmFQaXhlbENhbWVyYSIsInJlbmRlckNhbSIsInBpeGVsV2lkdGgiLCJzZXR0bGVkV2lkdGgiLCJwYW5vcmFtYVR3ZWVuIiwiZXNjIiwicyIsInJlcGxhY2UiLCJidXR0b24iLCJhY3Rpb24iLCJjbHMiLCJsb2JieUhUTUwiLCJ0YWJzIiwibG9hZEltYWdlcyIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwiYXNzZXRzIiwibWFwIiwicmVzb2x2ZSIsInJlamVjdCIsImltIiwiSW1hZ2UiLCJ0aW1lb3V0Iiwic2V0VGltZW91dCIsIkVycm9yIiwic3JjIiwib25sb2FkIiwiY2xlYXJUaW1lb3V0Iiwic2V0Iiwib25lcnJvciIsImZpdCIsInByZXZpb3VzIiwiaW5uZXJXaWR0aCIsImlubmVySGVpZ2h0IiwiZGV2aWNlUGl4ZWxSYXRpbyIsImRwciIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJjc3NTY2FsZSIsImxlZnQiLCJoZWlnaHQiLCJjbGVhciIsImRldk1vbmV5IiwibW9uZXkiLCJkZXZIVE1MIiwiam9pbiIsInBhaW50RGV2IiwicGFuZWwiLCJxdWVyeVNlbGVjdG9yIiwiaGlkZGVuIiwidGV4dENvbnRlbnQiLCJzZXRBdHRyaWJ1dGUiLCJkaXNhYmxlZCIsInRvTG9jYWxlU3RyaW5nIiwidG9nZ2xlRGV2Iiwib3BlbiIsInVwZGF0ZUhVRCIsImZvY3VzIiwicHJldmVudFNjcm9sbCIsIm5vcm1hbFBvc2l0aW9uIiwiY2hhbmdlRGF5IiwicWFDYXNlIiwiYXNzaWduIiwiZGVidWdPdXRzaWRlRGF5IiwicG9zaXRpb24iLCJvdXRzaWRlU2xlZXAiLCJsaWZ0TG9nb1BlbmRpbmciLCJkb2N1bWVudCIsInJlbW92ZSIsInNuYXBDYW1lcmEiLCJkcmF3IiwibG9nIiwiZGlzbWlzc0hpbnQiLCJkZXZBY3Rpb24iLCJnIiwic3RhcnRzV2l0aCIsImJlZm9yZSIsImFmdGVyIiwicm91dGUiLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJwZW5kaW5nU3RlcCIsIm1vcm5pbmdTZWVuIiwiZGVsZXRlIiwibmlnaHRTdGFydGVkIiwiZGV2S2V5IiwibWV0YUtleSIsImN0cmxLZXkiLCJhbHRLZXkiLCJjb2RlIiwicHJldmVudERlZmF1bHQiLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJyZXBlYXQiLCJidXR0b25zIiwicXVlcnlTZWxlY3RvckFsbCIsImdldENsaWVudFJlY3RzIiwibGVuZ3RoIiwiaSIsImluZGV4T2YiLCJhY3RpdmVFbGVtZW50Iiwic2hpZnRLZXkiLCJjbG9zZXN0IiwiYXJyaXZpbmciLCJzaG93RGV2SGludCIsInRva2VuIiwiY3JlYXRlRWxlbWVudCIsInRhYkluZGV4IiwiaW5uZXJIVE1MIiwiYm9keSIsImFwcGVuZCIsIkx1bmFXb3JsZENob2ljZXMiLCJjaG9vc2UiLCJMdW5hT3V0c2lkZU5vdGljZXMiLCJ1cGRhdGUiLCJnZXRDb250ZXh0IiwiY29uc29sZSIsImVycm9yIiwibWVzc2FnZSIsInNpbGVudCIsImRpc3Bvc2UiLCJMdW5hQ29udHJvbHNUdXRvcmlhbCIsInN0b3AiLCJhZHZhbmNlRGF5IiwibWVudSIsInRvZ2dsZVBhbm9yYW1hIiwidGFyZ2V0Q2FtZXJhIiwibGlmdFdpZHRoIiwibGlmdERpc3BsYXlXaWR0aCIsInpvb20iLCJMdW5hT3V0c2lkZVJlc2lkZW50cyIsImZyYW1lIiwicGl4ZWxHb2FsIiwicmF0ZSIsImFwcHJvYWNoV2lkdGgiLCJzdHJlZXQiLCJleHAiLCJkcmF3U3ByaXRlIiwiYWxwaGEiLCJnbG93IiwiaW1nIiwiZ2V0IiwiYXNzZXQiLCJyYXlSZWFjaCIsImxpZ2h0Um90YXRpb24iLCJzaW4iLCJzYXZlIiwiZ2xvYmFsQWxwaGEiLCJnbG9iYWxDb21wb3NpdGVPcGVyYXRpb24iLCJ0cmFuc2xhdGUiLCJyb3RhdGUiLCJzY2FsZSIsIm5lb24iLCJMdW5hU3RyZWV0U2lnbnMiLCJwYWludCIsIm1hdGNoTWVkaWEiLCJtYXRjaGVzIiwiZHJhd0ltYWdlIiwiTHVuYVdhbGxMaWdodGluZyIsInBhaW50U3ByaXRlIiwiTHVuYVNpZ25TY2FubGluZXMiLCJMdW5hVmVudFN0ZWFtIiwiTHVuYVdpcmVTcGFyayIsIkx1bmFCYXJyZWxGaXJlIiwicmVzdG9yZSIsInJlbmRlck5vZGUiLCJyZW5kZXJTY2VuZU5vZGUiLCJkcmF3Tm9kZSIsInZpc2libGVOb2RlIiwidmlzaWJsZSIsImFuaW1hdGlvbnMiLCJzaGliYSIsImZyYW1lcyIsImZwcyIsInBoYXNlIiwiTHVuYU91dHNpZGVBbWJpZW50IiwiZmFjZVRhcmdldCIsInRlc3QiLCJsaWdodCIsImFydCIsImRyYXdFbnRyYW5jZUN1ZSIsImRvb3IiLCJrIiwic3RpbGwiLCJkcmlmdCIsIlBJIiwibGluZUNhcCIsImxpbmVKb2luIiwib3V0bGluZSIsInN0cm9rZVN0eWxlIiwibGluZVdpZHRoIiwic2hhZG93Q29sb3IiLCJzaGFkb3dCbHVyIiwiYmVnaW5QYXRoIiwiZm9yRWFjaCIsInEiLCJsaW5lVG8iLCJtb3ZlVG8iLCJzdHJva2UiLCJpbnRlcmFjdGlvblRhcmdldCIsImRpc3BsYXlXaWR0aCIsInNldFRyYW5zZm9ybSIsImZhY3RvciIsImltYWdlU21vb3RoaW5nRW5hYmxlZCIsImZpbGxTdHlsZSIsImZpbGxSZWN0IiwicGxheWVyIiwiYmciLCJkcmF3UGxheWVyIiwiZmFyVHJhZmZpYyIsIm1pZFRyYWZmaWMiLCJuZWFyVHJhZmZpYyIsImdyb3VuZFJhaW4iLCJMdW5hT3V0c2lkZVJhaW4iLCJMdW5hT3V0c2lkZVRyYWZmaWMiLCJlZGdlIiwic2hhZGUiLCJjcmVhdGVMaW5lYXJHcmFkaWVudCIsImFkZENvbG9yU3RvcCIsImNvbnRyb2xzRGlzbWlzc0tleXMiLCJjb250cm9sc1VubG9ja0F0IiwiY29udHJvbHNTdGVwIiwic2hvd0NvbnRyb2xzVHV0b3JpYWwiLCJwZXJmb3JtYW5jZSIsIm5vdyIsImRpc21pc3NDb250cm9sc1R1dG9yaWFsIiwiY29udHJvbHNUdXRvcmlhbEtleSIsImFkZCIsInBhaW50Q29udHJvbHNUdXRvcmlhbCIsImNsYXNzTmFtZSIsIndhc1Zpc2libGUiLCJkYXRhc2V0IiwicGFyZW50RWxlbWVudCIsInN0ZXAiLCJyZW5kZXIiLCJvd25lciIsImxvY2tlZCIsImluZXJ0IiwicGFpbnRIb21ld2FyZEd1aWRlIiwiZWwiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJjdWUiLCJhdFRhcmdldCIsImNvcHkiLCJhY3Rpb25MYWJlbCIsIm92ZXJsYXkiLCJodWQiLCJ2aWV3cG9pbnQiLCJzaG93UGF1c2VNZW51Iiwic2lnbmF0dXJlIiwiTHVuYVNldHRpbmdzIiwiaHRtbCIsImNvbnRleHQiLCJvbkNsb3NlIiwiZXhpdExhYmVsIiwib25SZXN0YXJ0IiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwicHJvbXB0IiwibG9va291dCIsInVwZGF0ZVNwZWVjaCIsInNhdmVkIiwic2hvd1NhdmVkIiwib3BhY2l0eSIsInJlbmRlclNwZWVjaCIsImNob2ljZSIsInB1cmNoYXNlIiwiaGVhZCIsInZpZXdzIiwiYnViYmxlcyIsImluc2VydEJlZm9yZSIsInB1c2giLCJzdG9yeUlkIiwic3BsaXQiLCJiYWNrZ3JvdW5kIiwiY2FuVHJlYXQiLCJhdXRvIiwiTHVuYUV4dGVyaW9yVGV4dGJveCIsIm1vdW50VGV4dCIsImZ1bGwiLCJlbXBoYXNpcyIsIkx1bmFEaWFsb2d1ZUN1ZSIsInN5bmMiLCJyZXZlYWxUZXh0IiwiQXJyYXkiLCJhbmNob3IiLCJMdW5hV29ybGRTcGVlY2giLCJnYXAiLCJMdW5hRm9jdXNTZXR0aW5ncyIsImhpZGRlblBhdXNlZCIsInJpZ2h0IiwidGlja1ZpZXciLCJhZGRFdmVudExpc3RlbmVyIiwib3V0c2lkZVNldHRpbmciLCJ2YWx1ZSIsImNvbnRyb2wiLCJvdXRzaWRlQWN0aW9uIiwid2luZG93Iiwic2NvcGUiLCJsdW5hUUEiLCJvcGVuZWQiLCJsb3NlRm9jdXMiLCJlbmFibGVkIiwic25hcHNob3QiLCJvbGRDYW0iLCJvbGRTY2VuZSIsIm9sZFBpeGVsV2lkdGgiLCJ0b0RhdGFVUkwiLCJpbnRlcmFjdGlvbkdsb3ciLCJkZXZDb25zb2xlT3BlbiIsInJlbmRlckNhbWVyYSIsInBpeGVsU3VyZmFjZSIsIm5vdGlmeUl0ZW0iLCJvcGVuRGV2IiwicmVmcmVzaEhVRCIsIkx1bmFPdXRzaWRlIiwiTW9kZWwiLCJnbG9iYWxUaGlzIl0sInNvdXJjZXMiOlsib3V0c2lkZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcbmNvbnN0IGNsYW1wPSh2LGEsYik9Pk1hdGgubWF4KGEsTWF0aC5taW4oYix2KSksbWl4PShhLGIsdCk9PmErKGItYSkqdCxzbW9vdGg9dD0+dCp0KigzLTIqdCk7XG5jb25zdCBQTEFDRVM9e2Jhcjon67CUIOusuCDslZ4nLGhvbWVEb29yOifsp5Eg7JWeJyxob21lOifsp5Eg7JWIJ30sRkxPV1M9e2luOifstpzqt7zquLgnLG91dDon7Ye06re86ri4J307XG5jb25zdCBSPWdsb2JhbC5MdW5hUmVzaWRlbmNlLmxheW91dDtcbmNvbnN0IFNPRkE9e2lkOidzb2ZhJyxsYWJlbDon7IaM7YyMIOyCtO2OtOuztOq4sCcseDoyLjU1Nyx5Oi0uN307XG4vLyBIVUQgdmVyYnMgZGVzY3JpYmUgdGhlIGFjdGlvbiwgd2hpbGUgdGFyZ2V0LmxhYmVsIHJlbWFpbnMgdGhlIG9iamVjdCdzIG5hbWVcbi8vIGZvciBkaWFsb2d1ZSwgZGV2ZWxvcGVyIHRvb2xzIGFuZCBhY2Nlc3NpYmlsaXR5IGNvbnRleHQuXG5jb25zdCBJTlRFUkFDVElPTl9MQUJFTFM9T2JqZWN0LmZyZWV6ZSh7J3dhbnRlZC1wb3N0ZXInOifrs7TquLAnLGJhcjon65Ok7Ja06rCA6riwJyxob21lOifrk6TslrTqsIDquLAnLGV4aXQ6J+uCmOqwgOq4sCcsZWxldmF0b3I6J+yekeuPme2VmOq4sCcsdHY6J1RWIOuztOq4sCcsc29mYTon7Zy07Iud7ZWY6riwJ30pO1xuY29uc3QgVEFMS19UQVJHRVRTPW5ldyBTZXQoWydzaGliYS1zaG9wJywnc3RyZWV0LWJlZ2dhcicsJ3N0cmVldC1iZWdnYXItd2l0bmVzcycsJ2RheTItdGh1Zy1pbmZvcm1hdGlvbicsJ3N0b3J5LXNhbWhvJ10pO1xuZnVuY3Rpb24gaW50ZXJhY3Rpb25MYWJlbChtb2RlbCx0YXJnZXQpe1xuIGlmKCF0YXJnZXQpcmV0dXJuICfsg4HtmLjsnpHsmqknO1xuIGxldCBpZD10YXJnZXQuaWQ7XG4gaWYoaWQ9PT0ncWEtZXZlbnQnKXtcbiAgY29uc3QgYz1nbG9iYWwuTHVuYU91dHNpZGVRQT8uY2F0YWxvZygpLmZpbmQoYz0+Yy5pZD09PW1vZGVsLnFhPy5jYXNlSWQpO1xuICBjb25zdCBldmVudD1nbG9iYWwuTHVuYU91dHNpZGVDb250ZW50Py5ldmVudHMuZmluZChlPT5lLmlkPT09Yz8uc291cmNlKTtcbiAgaWYoZXZlbnQ/LmtpbmQ9PT0nb2JqZWN0JylpZD1ldmVudC5vYmplY3Q7XG4gIGVsc2UgaWYoZXZlbnQ/LmtpbmQ9PT0nYnJvYWRjYXN0JylpZD0ndHYnO1xuICBlbHNlIHJldHVybiAn64yA7ZmU7ZWY6riwJztcbiB9XG4gcmV0dXJuIElOVEVSQUNUSU9OX0xBQkVMU1tpZF18fChUQUxLX1RBUkdFVFMuaGFzKGlkKXx8dGFyZ2V0LmVuY291bnRlcnx8dGFyZ2V0LmFjdG9yPyfrjIDtmZTtlZjquLAnOifrs7TquLAnKTtcbn1cbmNvbnN0IEJPVFRPTT1SLmVsZXZhdG9yQm90dG9tLFRPUD1SLmVsZXZhdG9yVG9wLEVYPVIuZWxldmF0b3JYO1xuLy8gVGhlIGZlbmNlLXNpZGUgc2lnbiBpcyBhIGxvY2FsIGxvb2tvdXQsIG5vdCBhIGZ1bGwtbWFwIGNhbWVyYSB0b2dnbGUuXG5jb25zdCBWSUVXUE9JTlQ9e3g6LTguNzgseTotLjcscmFkaXVzOi41NSx3aWR0aDoxMC40LHByZXZpb3VzV2lkdGg6MTIscmFuZ2VTY2FsZToyLzMqMS4zLGVhc2VSYXRlOjIuNX07XG4vLyBTdG9wIGJlc2lkZSB0aGUgc2NyYXAgcGlsZSwgbGVhdmluZyB0aGUgZmluYWwgYXBwcm9hY2ggdG8gdGhlIGJhciB0byB0aGUgcGxheWVyLlxuLy8gU2hpZnQgdGhlIHN0YXJ0IGJ5IHRoZSBzYW1lIGFtb3VudCB0byBwcmVzZXJ2ZSB0aGUgdmlzaWJsZSB3YWxrLWluIGR1cmF0aW9uLlxuY29uc3QgRklSU1RfQ09NTVVURV9BUlJJVkFMPXtmcm9tOi0xLjU1LHRvOjB9O1xuLy8gU3BlZWRzIHJlbGF0aXZlIHRvIHRoZSBnYW1lcGxheSBwbGFuZSAoMSkuIE9ubHkgaW5kZXBlbmRlbnQgYXJ0IGlzIGxpc3RlZDpcbi8vIGRvb3JzLCBsaWZ0LCByYWlsaW5ncywgc2hvcCBwcm9wcywgYWN0b3JzLCBzcGVlY2ggYW5kIHJhaW4gc3RheSBpbiB3b3JsZCBzcGFjZS5cbmNvbnN0IFNUUkVFVF9ERVBUSD1PYmplY3QuZnJlZXplKHtcbiBTa3k6Wy41NSwuNzhdLENfQmFja19CdWlsZGluZ18yOlsuNzIsLjg2XSxDX0JhY2tfQnVpbGRpbmdfMTpbLjg0LC45MV0sXG4gQ19NaWRkbGVfQnVpbGRpbmdfMTpbLjk0LC45Nl0sQ19NaWRkbGVfQnVpbGRpbmdfMjpbLjk0LC45Nl0sQ19NaWRkbGVfQnVpbGRpbmdfMzpbLjk0LC45Nl0sXG4gQ19NaWRkbGVfT2JqZWN0XzE6Wy45NCwuOTZdLENfTWlkZGxlX09iamVjdF8yOlsuOTQsLjk2XSxcbiBDaXR5TGlnaHQ6Wy45NCwuOTZdLFwiJ0NpdHlMaWdodCAnXCI6Wy45NCwuOTZdLENpdHlVcExpZ2h0OlsuOTQsLjk2XSxcbiBCX0ZvcmVGb3JlX09iamVjdF8xOlsxLjAzNSwxXVxufSk7XG5mdW5jdGlvbiBzdHJlZXRQYXJhbGxheChuLGNhbWVyYSxtb2RlbCl7XG4gY29uc3Qgc3BlZWQ9bW9kZWwuc2NlbmU9PT0nc3RyZWV0JyYmIW1vZGVsLnFhJiYhbi5hbWJpZW50JiZuLmFuY2VzdHJ5Py5bMF09PT0nQkcnP1NUUkVFVF9ERVBUSFtuLm5hbWVdOm51bGw7XG4gaWYoIXNwZWVkKXJldHVybnt4Om4ueCx5Om4ueX07XG4gLy8gRml4ZWQgbWFwLWNlbnRlciBvcmlnaW46IG5vIGFjY3VtdWxhdGVkIGRyaWZ0LCBkYXkvc3Bhd24gcmVzZXRzIG9yIHpvb21cbiAvLyBtdWx0aXBsaWVycy4gQWxsIGJpbGxib2FyZCBwaWVjZXMgc2hhcmUgdGhlaXIgYnVpbGRpbmcncyBleGFjdCBvZmZzZXQuXG4gcmV0dXJue3g6bi54KyhjYW1lcmEueCs3Ljg1KSooMS1zcGVlZFswXSkseTpuLnkrY2FtZXJhLnkqKDEtc3BlZWRbMV0pfTtcbn1cbi8vIFZlcnNpb24gQSBkYXkgemVybyBoYXMgbm8gbG9va291dCBpbnRlcmFjdGlvbiAoa2V5Ym9hcmQgYW5kIGNsaWNrIHNoYXJlIHRoaXMgZ3VhcmQpLlxuLy8gVmVyc2lvbiBCIGtlZXBzIGl0cyBzZXBhcmF0ZWx5IG1hbmFnZWQgcHJvZ3Jlc3Npb24gdW5jaGFuZ2VkLlxuZnVuY3Rpb24gYXRWaWV3cG9pbnQobSl7cmV0dXJuICEhbSYmbS5jb25maWcuZGF5IT09MCYmIW0ucWEmJm0uc2NlbmU9PT0nc3RyZWV0JyYmbS5sZXZlbD09PTAmJk1hdGguYWJzKG0ueC1WSUVXUE9JTlQueCk8PVZJRVdQT0lOVC5yYWRpdXMmJiFtLnJpZGUmJiFtLnRyYW5zaXRpb24mJiFtLmVuY291bnRlciYmIW0uZGlhbG9nJiYhbS5zdG9yeS5ibG9ja2luZzt9XG5mdW5jdGlvbiBmaXJzdENvbW11dGVFbnRyYW5jZUN1ZShtKXtcbiByZXR1cm4gISFtJiYhbS5xYSYmbS5zY2VuZT09PSdzdHJlZXQnJiZtLmxldmVsPT09MCYmbS5jb25maWcuZGF5PT09MCYmbS5jb25maWcuZmxvdz09PSdpbic7XG59XG5mdW5jdGlvbiBmaXJzdEhvbWV3YXJkKG0pe3JldHVybiAhIW0mJiFtLnFhJiZtLmNvbmZpZy5kYXk9PT0wJiZtLmNvbmZpZy5mbG93PT09J291dCc7fVxuZnVuY3Rpb24gc3luY0hvbWV3YXJkR29hbChtKXtcbiBjb25zdCBjYW1wYWlnbj1nbG9iYWwubHVuYUNhbXBhaWduO1xuIGlmKCFmaXJzdEhvbWV3YXJkKG0pfHwhY2FtcGFpZ24/LmFjdGl2ZXx8Y2FtcGFpZ24uYmxvY2tpbmd8fG0udHJhbnNpdGlvbnx8Z2xvYmFsLm91dHNpZGVQbGF5dGVzdD8ubW9kZWwhPT1tKXJldHVybjtcbiBjb25zdCBwPWdsb2JhbC5iYXJHYW1lLnByb2dyZXNzLG5vdGljZXM9Z2xvYmFsLkx1bmFTdG9yeU5vdGljZXM7XG4gY29uc3QgY2hhbmdlZD1tLnNjZW5lPT09J3N0cmVldCc/bm90aWNlcy5zdGFydEdvYWwocCwnZmlyc3RfaG9tZXdhcmQnLCfsp5HsnLzroZwg6rCA6riwIScpOm0uc2NlbmU9PT0naG9tZScmJm5vdGljZXMuY29tcGxldGVHb2FsKHAsJ2ZpcnN0X2hvbWV3YXJkJyk7XG4gaWYoY2hhbmdlZCYmY2FtcGFpZ24uc2Vzc2lvbi5jYXJyeSljYW1wYWlnbi5zZXNzaW9uLmNhcnJ5Lm9iamVjdGl2ZXM9c3RydWN0dXJlZENsb25lKHAub2JqZWN0aXZlcyk7XG59XG5mdW5jdGlvbiBob21ld2FyZEN1ZXMobSl7XG4gaWYoIWZpcnN0SG9tZXdhcmQobSl8fG0uc2NlbmUhPT0nc3RyZWV0J3x8bS5yaWRlJiYhbS5yaWRlLmNhbGx8fG0udHJhbnNpdGlvbilyZXR1cm4gW107XG4gaWYoZ2xvYmFsLmx1bmFDYW1wYWlnbj8uYWN0aXZlJiZnbG9iYWwuYmFyR2FtZT8ucHJvZ3Jlc3Mub2JqZWN0aXZlcz8uZmlyc3RfaG9tZXdhcmQ/LnN0YXR1cz09PSdjb21wbGV0ZWQnKXJldHVybiBbXTtcbiAvLyBEZXN0aW5hdGlvbiBzdGF0ZSBmb3IgYSBmaXhlZCBIVUQ7IG5ldmVyIGFuY2hvcmVkIHRvIHRoZSBwbGF5ZXIgb3Igc2NlbmVyeS5cbiBjb25zdCB1cHBlcj1tLmxldmVsPT09MSx0YXJnZXRYPXVwcGVyP1IuaG9tZVg6RVgsZGVsdGE9dGFyZ2V0WC1tLngsYXJyaXZhbD1NYXRoLmFicyhkZWx0YSk8MS4zNTtcbiByZXR1cm4gW3tpZDp1cHBlcj8naG9tZSc6J2xpZnQnLGtpbmQ6YXJyaXZhbD8nYXJyaXZhbCc6J3JvdXRlJyxkaXJlY3Rpb246ZGVsdGE8MD8nbGVmdCc6J3JpZ2h0JyxcbiAgbGFiZWw6dXBwZXI/J+ynkeycvOuhnCc6J+yXmOumrOuyoOydtO2EsOuhnCcsZGVzdGluYXRpb246dXBwZXI/J+ynkSDsnoXqtawnOifsl5jrpqzrsqDsnbTthLAnLFxuICBkZXRhaWw6dXBwZXI/J+q3gOqwgCDqsr3roZwnOifsnITsuLXsnLzroZwg7J2064+ZJ31dO1xufVxuLy8gRXF1YWwgVW5pdHkgc29ydGluZyBrZXlzIG11c3Qgbm90IGluaGVyaXQgc2VyaWFsaXplZCBjb21wb25lbnQvZmlsZS1JRCBvcmRlci5cbi8vIFdhbGwvZmVuY2UgZHJlc3NpbmcgZ29lcyBvbiB0aGUgYmFja2dyb3VuZCwgTlBDcyBmb2xsb3cgdGhlaXIgc29ydGluZyBvcmRlcixcbi8vIGFuZCBvbmx5IGdlbnVpbmUgZm9yZWdyb3VuZCBhcnQgKHJhaWxpbmdzL2xpZnQgZnJvbnQpIGNvdmVycyB0aGUgcGxheWVyLlxuZnVuY3Rpb24gc3RyZWV0RHJhd09yZGVyKG5vZGVzKXtcbiBjb25zdCByYW5rPW49Pm4uYW5jZXN0cnk/LlswXT09PSdCRyd8fG4uYW5jZXN0cnk/LlswXT09PSdSZXNpZGVuY2UnPzA6MTtcbiByZXR1cm4gbm9kZXMuc2xpY2UoKS5zb3J0KChhLGIpPT5hLmxheWVyLWIubGF5ZXJ8fGEub3JkZXItYi5vcmRlcnx8Yi56LWEuenx8cmFuayhhKS1yYW5rKGIpfHxTdHJpbmcoYS5pZCkubG9jYWxlQ29tcGFyZShTdHJpbmcoYi5pZCkpKTtcbn1cbmZ1bmN0aW9uIGludGVyYWN0aW9uQW5jaG9yKG1vZGVsLHRhcmdldCxkYXRhKXtcbiBpZihtb2RlbC5xYSlyZXR1cm4ge3g6dGFyZ2V0LngseTp0YXJnZXQueSsuNzV9O1xuIC8vIElkbGUgc2hlZXRzIGluY2x1ZGUgdHJhbnNwYXJlbnQgcGFkZGluZyBhYm92ZSB0aGUgdmlzaWJsZSBoZWFkLlxuIGlmKHRhcmdldC50b3AhPW51bGwpcmV0dXJue3g6dGFyZ2V0LngseTp0YXJnZXQudG9wfTtcbiBpZih0YXJnZXQuZW5jb3VudGVyKXtjb25zdCBhPWdsb2JhbC5MdW5hT3V0c2lkZUVuY291bnRlcnMuYWN0b3IodGFyZ2V0LmFjdG9yKTtyZXR1cm57eDphLngseTphLnRvcH07fVxuIGNvbnN0IG5hbWVzPXtiYXI6J0JhciBTcGF3biBQb2ludCcsZXhpdDonUm9vbV9FbnRyYW5jZSd9O1xuIGNvbnN0IG49ZGF0YS5zY2VuZXNbbW9kZWwuc2NlbmVdLm5vZGVzLmZpbmQobj0+bi5uYW1lPT09KHRhcmdldC5ub2RlTmFtZXx8bmFtZXNbdGFyZ2V0LmlkXSkpO1xuIGlmKG4pe2NvbnN0IHNwPW4uc3ByaXRlLHN4PW4uc3gqKG4uZmxpcD8tMToxKSxzeT1uLnN5O1xuICByZXR1cm57eDpuLngrKC41LXNwLnBpdm90LngpKnNwLncvc3AucHB1KnN4LHk6bi55K01hdGgubWF4KC1zcC5waXZvdC55KnN5LCgxLXNwLnBpdm90LnkpKnN5KSpzcC5oL3NwLnBwdX07fVxuIC8vIFRoZXNlIHRhcmdldHMgYXJlIGVtYmVkZGVkIGluIHNoYXJlZCBhcnQsIG9yIG1hcmsgYSBsaWZ0IGJvYXJkaW5nIGZsb29yLlxuIGlmKHRhcmdldC5pZD09PSdlbGV2YXRvcicpcmV0dXJue3g6dGFyZ2V0LngseTp0YXJnZXQueSsuNTE4fTtcbiBpZih0YXJnZXQuaWQ9PT0naG9tZScpcmV0dXJue3g6dGFyZ2V0LngseTp0YXJnZXQueSsuODd9O1xuIC8vIEtlZXAgQSdzIHByb21wdCBiZXNpZGUgdGhlIGhvbG9ncmFtLCBjbGVhciBvZiBib3RoIGl0cyBwaWN0dXJlIGFuZCBzdWJ0aXRsZXMuXG4gaWYodGFyZ2V0LmlkPT09J3R2JylyZXR1cm4ge3g6MS41OCx5Oi0uNDh9O1xuIGlmKHRhcmdldC5pZD09PSdzdG9yeS1zYW1obycpcmV0dXJue3g6dGFyZ2V0LngseTp0YXJnZXQueSsuOTV9O1xuIGlmKHRhcmdldC5pZD09PSdzb2ZhJylyZXR1cm57eDoyLjU1Nyx5Oi0uMjd9O1xuIHJldHVybnt4OnRhcmdldC54LHk6dGFyZ2V0LnkrLjV9O1xufVxuY2xhc3MgT3V0c2lkZU1vZGVse1xuIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pe3RoaXMuc3RhcnQob3B0aW9ucyk7fVxuIHN0YXJ0KHtwbGFjZT0nYmFyJyxmbG93PSdvdXQnLGRheT0wLC4uLnFhT3B0aW9uc309e30pe1xuICB0aGlzLmNvbmZpZz17cGxhY2U6T2JqZWN0Lmhhc093bihQTEFDRVMscGxhY2UpP3BsYWNlOidiYXInLGZsb3c6T2JqZWN0Lmhhc093bihGTE9XUyxmbG93KT9mbG93OidvdXQnLGRheTpOdW1iZXIoZGF5KT09PTk5Pzk5OmNsYW1wKE1hdGguZmxvb3IoTnVtYmVyKGRheSl8fDApLDAsMyl9O1xuICBnbG9iYWwuTHVuYUxpZnREdXN0Py5yZXNldCh0aGlzKTt0aGlzLmJhckFycml2YWw9bnVsbDt0aGlzLmNvbW11dGVCb3VuZGFyeVNpZGU9MDt0aGlzLmJlZ2dhckRlcGFydHVyZT1udWxsO3RoaXMubGlmdExvZ29TZWVuPWZhbHNlO1xuICB0aGlzLnRodWdGbGFncz17fTt0aGlzLnNhbWhvQ29tbXV0ZUZsYWdzPXt9O3RoaXMubm90aW9uRmxhZ3M9e307dGhpcy5zY2VuZT10aGlzLmNvbmZpZy5wbGFjZT09PSdob21lJz8naG9tZSc6J3N0cmVldCc7dGhpcy5sZXZlbD10aGlzLmNvbmZpZy5wbGFjZT09PSdiYXInPzA6MTt0aGlzLng9dGhpcy5jb25maWcucGxhY2U9PT0nYmFyJz8xOnRoaXMuY29uZmlnLnBsYWNlPT09J2hvbWUnPy0xLjI4OlIuaG9tZVg7dGhpcy55PXRoaXMuc2NlbmU9PT0naG9tZSd8fCF0aGlzLmxldmVsPy0uNzpSLnVwcGVyWTtcbiAgdGhpcy5jb250cm9sc1R1dG9yaWFsPWZhbHNlO3RoaXMuY29udHJvbHNJbnRlcmFjdFVudGlsPTA7dGhpcy5lbGV2YXRvclk9dGhpcy5sZXZlbD9UT1A6Qk9UVE9NO3RoaXMuZmFjaW5nPXRoaXMuY29uZmlnLnBsYWNlPT09J2Jhcic/LTE6MTt0aGlzLmFuaW09J2lkbGUnO3RoaXMuYW5pbVRpbWU9MDt0aGlzLnRpbWU9MDt0aGlzLnBhdXNlZD1mYWxzZTt0aGlzLnJpZGU9bnVsbDt0aGlzLnRyYW5zaXRpb249bnVsbDt0aGlzLmVuY291bnRlcj1udWxsO3RoaXMuZGlhbG9nPW51bGw7dGhpcy5uZWFyPW51bGw7dGhpcy5ub3RpY2U9Jyc7dGhpcy5ub3RpY2VMZWZ0PTA7dGhpcy5hcnJpdmFscz0wO3RoaXMucmV2aXNpb249MDt0aGlzLnN0b3J5PW5ldyBnbG9iYWwuTHVuYU91dHNpZGVTdG9yeS5TdG9yeSh0aGlzKTt0aGlzLmJhY2tncm91bmRTdG9yeT1uZXcgZ2xvYmFsLkx1bmFPdXRzaWRlU3RvcnkuQmFja2dyb3VuZFN0b3JpZXModGhpcyk7dGhpcy5wbGF5ZWRBbWJpZW50PW5ldyBTZXQoKTt0aGlzLnR2TmV3c0luUmFuZ2U9ZmFsc2U7dGhpcy5ub3Rpb25Db21tdXRlU2Vlbj1mYWxzZTtnbG9iYWwuTHVuYU91dHNpZGVRQT8uaW5pdCh0aGlzLHFhT3B0aW9ucyk7dGhpcy51cGRhdGVOZWFyKCk7XG4gfVxuIHdha2VBdFNvZmEoKXtcbiAgaWYodGhpcy5zY2VuZSE9PSdob21lJ3x8dGhpcy5xYSlyZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHNvZmE9U09GQTtcbiAgdGhpcy54PXNvZmEueDt0aGlzLnk9c29mYS55O3RoaXMuZmFjaW5nPS0xO3RoaXMuYW5pbT0naWRsZSc7dGhpcy5hbmltVGltZT0wO3RoaXMudXBkYXRlTmVhcigpO3JldHVybiB0cnVlO1xuIH1cbiBjaG9vc2VTb2ZhKGlkKXtcbiAgaWYodGhpcy5kaWFsb2c/LmtpbmQhPT0nc29mYSd8fCFbJ3NsZWVwJywnc2F2ZScsJ2NhbmNlbCddLmluY2x1ZGVzKGlkKXx8dGhpcy5wYXVzZWQpcmV0dXJuIGZhbHNlO1xuICB0aGlzLmRpYWxvZz1udWxsO3RoaXMudXBkYXRlTmVhcigpO3RoaXMucmV2aXNpb24rKztcbiAgaWYoaWQ9PT0nc2F2ZScpe1xuICAgLy8gV2ViIHByZXZpZXcgZmVlZGJhY2sgb25seTogZGVsaWJlcmF0ZWx5IGRvIG5vdCB3cml0ZSBzYXZlIGRhdGEuXG4gICB0aGlzLm5vdGljZT0n7KCA7J6lIOyZhOujjCEnO3RoaXMubm90aWNlTGVmdD0yO1xuICB9ZWxzZSBpZihpZD09PSdzbGVlcCcpe1xuICAgY29uc3QgY2FtcGFpZ249Z2xvYmFsLmx1bmFDYW1wYWlnbjtcbiAgIGlmKCF0aGlzLnFhJiZjYW1wYWlnbj8uaW50ZXJhY3RPdXRzaWRlKHRoaXMsU09GQSkpe1xuICAgIGlmKGNhbXBhaWduLnZpZXc9PT0nc2xlZXAnKWNhbXBhaWduLnNsZWVwKCk7XG4gICB9ZWxzZSB0aGlzLmRpYWxvZz17dGl0bGU6J+yGjO2MjCcsdGV4dDon6rO16rCEIO2DkOyDiSDrqqjrk5zsl5DshJzripQg7ZWY66Oo6rCAIOuwlOuAjOyngCDslYrsirXri4jri6QuJ307XG4gICB0aGlzLnVwZGF0ZU5lYXIoKTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbiB9XG4gZmlyc3RDb21tdXRlRGlyZWN0aW9ucygpe1xuICBpZih0aGlzLmlzRmlyc3RDb21tdXRlKCkpcmV0dXJuIGZhbHNlO1xuICBpZih0aGlzLnFhfHx0aGlzLmNvbmZpZy5kYXkhPT0wfHx0aGlzLmNvbmZpZy5mbG93IT09J2luJ3x8dGhpcy5zY2VuZSE9PSdzdHJlZXQnfHx0aGlzLnN0b3J5LmJsb2NraW5nKXJldHVybiBmYWxzZTtcbiAgY29uc3QgY2FtcGFpZ249Z2xvYmFsLmx1bmFDYW1wYWlnbixrZXk9J2RheTBfZmlyc3RfaG9tZV9leGl0JyxmbGFncz1jYW1wYWlnbj8uYWN0aXZlPyhnbG9iYWwuYmFyR2FtZS5wcm9ncmVzcy5mbGFncz8/PXt9KTp0aGlzLnN0b3J5LmZsYWdzO1xuICBpZihmbGFnc1trZXldKXJldHVybiBmYWxzZTtcbiAgY29uc3Qgcm93cz1bXG4gICB7dHlwZTonc2F5JyxhY3RvcjonbHVuYScsdGV4dDon67CU7J2YIOychOy5mOuKlCDsl5jrpqzrsqDsnbTthLDrpbwg7YOA6rOgIOuCtOugpOqwgOyEnCDsmrDsuKHsnLzroZwg7K2JIOqwgOuptCDrkJzri6Tqs6Ag7ZaI7Ja0Lid9LFxuICAge3R5cGU6J3NheScsYWN0b3I6J2x1bmEnLHRleHQ6J+qwgOqyjCDsnbTrpoTsnYAg7Ja464W47Jq0Li4uJ31cbiAgXTtcbiAgaWYoIXRoaXMuc3RvcnkuYmVnaW5Sb3dzKGtleSx7eDp0aGlzLngseTp0aGlzLnl9LHJvd3MsZmFsc2UsKCk9PntcbiAgIC8vIFJlZ2lzdGVyIHRoZSBnb2FsIG9ubHkgYWZ0ZXIgdGhlIHBsYXllciBkaXNtaXNzZXMgdGhlIGZpbmFsIGRvb3J3YXkgbGluZS5cbiAgIGlmKCFjYW1wYWlnbj8uYWN0aXZlfHxnbG9iYWwub3V0c2lkZVBsYXl0ZXN0Py5tb2RlbCE9PXRoaXN8fHRoaXMuY29uZmlnLmRheSE9PTB8fHRoaXMuY29uZmlnLmZsb3chPT0naW4nfHx0aGlzLnNjZW5lIT09J3N0cmVldCcpcmV0dXJuO1xuICAgaWYoZ2xvYmFsLkx1bmFTdG9yeU5vdGljZXMuc3RhcnRHb2FsKGdsb2JhbC5iYXJHYW1lLnByb2dyZXNzLCdmaXJzdF9jb21tdXRlJywn7LKrIOy2nOq3vO2VmOq4sCEnKSYmY2FtcGFpZ24uc2Vzc2lvbi5jYXJyeSljYW1wYWlnbi5zZXNzaW9uLmNhcnJ5Lm9iamVjdGl2ZXM9c3RydWN0dXJlZENsb25lKGdsb2JhbC5iYXJHYW1lLnByb2dyZXNzLm9iamVjdGl2ZXMpO1xuICB9KSlyZXR1cm4gZmFsc2U7XG4gIGZsYWdzW2tleV09dHJ1ZTtcbiAgaWYoY2FtcGFpZ24/LmFjdGl2ZSYmY2FtcGFpZ24uc2Vzc2lvbi5jYXJyeSkoY2FtcGFpZ24uc2Vzc2lvbi5jYXJyeS5mbGFncz8/PXt9KVtrZXldPXRydWU7XG4gIGdsb2JhbC5vdXRzaWRlUGxheXRlc3Q/LmNsZWFySW5wdXQoKTt0aGlzLmFuaW09J2lkbGUnO3RoaXMuYW5pbVRpbWU9MDtyZXR1cm4gdHJ1ZTtcbiB9XG4gaXNGaXJzdENvbW11dGUoKXtyZXR1cm4gIXRoaXMucWEmJnRoaXMuY29uZmlnLmRheT09PTAmJnRoaXMuY29uZmlnLmZsb3c9PT0naW4nO31cbiB0aWNrQmFyQXJyaXZhbChkdCl7XG4gIGNvbnN0IGFycml2YWw9dGhpcy5iYXJBcnJpdmFsO2lmKCFhcnJpdmFsKXJldHVybiBmYWxzZTtcbiAgdGhpcy54PU1hdGgubWluKGFycml2YWwudG8sdGhpcy54Ky40OCpkdCk7dGhpcy5mYWNpbmc9MTt0aGlzLmFuaW09J3dhbGsnO3RoaXMuYW5pbVRpbWUrPWR0O1xuICBpZih0aGlzLng+PWFycml2YWwudG8pe1xuICAgdGhpcy5iYXJBcnJpdmFsPW51bGw7dGhpcy5hbmltPSdpZGxlJzt0aGlzLmFuaW1UaW1lPTA7Z2xvYmFsLm91dHNpZGVQbGF5dGVzdD8uY2xlYXJJbnB1dCgpO1xuICAgdGhpcy5zdG9yeS5iZWdpblJvd3MoJ2RheTBfYmFyX2Fycml2YWwnLHt4OnRoaXMueCx5OnRoaXMueX0sW3t0eXBlOidzYXknLGFjdG9yOidsdW5hJyx0ZXh0Olwi67CUICfslrjrhbjsmrQnIOyXrOq4sOyduOqwgOuztOuEpC5cIn1dLGZhbHNlLCgpPT5nbG9iYWwub3V0c2lkZVBsYXl0ZXN0Py5jbGVhcklucHV0KCkpO1xuICB9XG4gIHRoaXMudXBkYXRlTmVhcigpO3JldHVybiB0cnVlO1xuIH1cbiB0YXJnZXRzKCl7XG4gIGlmKHRoaXMucWEpcmV0dXJuIGdsb2JhbC5MdW5hT3V0c2lkZVFBLnRhcmdldHModGhpcyk7XG4gIGlmKHRoaXMuc2NlbmU9PT0naG9tZScpcmV0dXJuWy4uLih0aGlzLmNvbmZpZy5kYXk9PT0wP1t7aWQ6J3R2JyxsYWJlbDonVFYg64uk7YGQIOuztOq4sCcseDoxLjIyLHk6LS43fV06W10pLHtpZDonZXhpdCcsbGFiZWw6J+uwluycvOuhnCDrgpjqsIDquLAnLHg6LTEuNTgxLHk6LS43fSwuLi4odGhpcy5jb25maWcuZmxvdz09PSdvdXQnP1tTT0ZBXTpbXSldO1xuICBpZih0aGlzLmxldmVsKXJldHVyblsuLi4oZ2xvYmFsLkx1bmFPdXRzaWRlTm90aW9uPy50YXJnZXRzKHRoaXMpfHxbXSkse2lkOidob21lJyxsYWJlbDon7KeR7JeQIOuTpOyWtOqwgOq4sCcseDpSLmhvbWVYLHk6Ui51cHBlcll9LHtpZDonZWxldmF0b3InLGxhYmVsOnRoaXMuZWxldmF0b3JZPjQ/J+yXmOumrOuyoOydtO2EsCDCtyDrgrTroKTqsIDquLAnOifsl5jrpqzrsqDsnbTthLAg7Zi47LacJyx4OkVYLHk6Ui51cHBlcll9XTtcbiAgcmV0dXJuWy4uLihnbG9iYWwuTHVuYU91dHNpZGVFbmNvdW50ZXJzPy50YXJnZXRzKHRoaXMpfHxbXSkse2lkOidiYXInLGxhYmVsOifrsJQg7J6F6rWsJyx4OjEuMDA4Nix5Oi0uN30se2lkOidlbGV2YXRvcicsbGFiZWw6dGhpcy5lbGV2YXRvclk8ND8n7JeY66as67Kg7J207YSwIMK3IOyYrOudvOqwgOq4sCc6J+yXmOumrOuyoOydtO2EsCDtmLjstpwnLHg6RVgseTotLjd9LC4uLihnbG9iYWwuTHVuYU91dHNpZGVDb250ZW50Py50YXJnZXRzKHRoaXMpfHxbXSksLi4uKGdsb2JhbC5MdW5hT3V0c2lkZVNob3A/LnRhcmdldHModGhpcyl8fFtdKSwuLi4oZ2xvYmFsLkx1bmFPdXRzaWRlQmVnZ2FyPy50YXJnZXRzKHRoaXMpfHxbXSldO1xuIH1cbiB1cGRhdGVOZWFyKCl7Z2xvYmFsLkx1bmFTdG9yeU5vdGljZXM/LmZvcmNlZCh0aGlzKTt0aGlzLm5lYXI9dGhpcy5xYT8ucnVudGltZXx8dGhpcy5iYXJBcnJpdmFsfHx0aGlzLnJpZGV8fHRoaXMudHJhbnNpdGlvbnx8dGhpcy5lbmNvdW50ZXJ8fHRoaXMuZGlhbG9nfHx0aGlzLnN0b3J5Py5ibG9ja2luZz9udWxsOnRoaXMudGFyZ2V0cygpLmZpbHRlcih0PT5NYXRoLmFicyh0LngtdGhpcy54KTwodC5pZD09PSdlbGV2YXRvcic/LjYyOi40KSkuc29ydCgoYSxiKT0+TWF0aC5hYnMoYS54LXRoaXMueCktTWF0aC5hYnMoYi54LXRoaXMueCl8fGEuaWQubG9jYWxlQ29tcGFyZShiLmlkKSlbMF18fG51bGw7fVxuIGJlZ2luRW5jb3VudGVyKHRhcmdldCl7Y29uc3QgZT1nbG9iYWwuTHVuYU91dHNpZGVFbmNvdW50ZXJzLnByZXBhcmUodGhpcyx0YXJnZXQpO2lmKCFlKXJldHVybiBmYWxzZTt0aGlzLnN0b3J5LmNhbmNlbCgpO3RoaXMuZW5jb3VudGVyPWU7dGhpcy5mYWNpbmc9ZS5mYWNpbmc7dGhpcy51cGRhdGVOZWFyKCk7cmV0dXJuIHRydWU7fVxuIGludGVyYWN0KCl7XG4gIGlmKHRoaXMucGF1c2VkfHx0aGlzLmNvbnRyb2xzVHV0b3JpYWx8fHRoaXMuYmFyQXJyaXZhbHx8dGhpcy50cmFuc2l0aW9ufHx0aGlzLmVuY291bnRlciYmdGhpcy5lbmNvdW50ZXIuc3RhZ2UhPT0nYWN0aXZlJylyZXR1cm4gZmFsc2U7XG4gIGlmKHRoaXMuc3RvcnkuYmxvY2tpbmcpcmV0dXJuIHRoaXMuc3RvcnkuYWR2YW5jZSgpO1xuICBpZih0aGlzLnJpZGUpcmV0dXJuIGZhbHNlO1xuICBpZih0aGlzLmRpYWxvZyl7dGhpcy5kaWFsb2c9bnVsbDt0aGlzLnVwZGF0ZU5lYXIoKTt0aGlzLnJldmlzaW9uKys7cmV0dXJuIHRydWU7fVxuICB0aGlzLnVwZGF0ZU5lYXIoKTtjb25zdCB0PXRoaXMubmVhcjtpZighdClyZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGluc3BlY3Rpb249Z2xvYmFsLkx1bmFPdXRzaWRlSW5zcGVjdGlvbj8uZm9yVGFyZ2V0KHQpO1xuICBpZihpbnNwZWN0aW9uKXt0aGlzLmRpYWxvZz1pbnNwZWN0aW9uO3RoaXMuYW5pbT0naWRsZSc7dGhpcy5hbmltVGltZT0wO3RoaXMudXBkYXRlTmVhcigpO3RoaXMucmV2aXNpb24rKztyZXR1cm4gdHJ1ZTt9XG4gIGlmKHQuaWQ9PT0nc29mYScpe3RoaXMuc3RvcnkuY2FuY2VsKCk7dGhpcy5kaWFsb2c9e2tpbmQ6J3NvZmEnLGtleTonc29mYTonKyArK3RoaXMucmV2aXNpb259O3RoaXMuYW5pbT0naWRsZSc7dGhpcy5hbmltVGltZT0wO3RoaXMudXBkYXRlTmVhcigpO3JldHVybiB0cnVlO31cbiAgaWYodGhpcy5xYSYmZ2xvYmFsLkx1bmFPdXRzaWRlUUEuaW50ZXJhY3QodGhpcyx0KSlyZXR1cm4gdHJ1ZTtcbiAgaWYoIXRoaXMucWEmJmdsb2JhbC5sdW5hQ2FtcGFpZ24/LmludGVyYWN0T3V0c2lkZSh0aGlzLHQpKXJldHVybiB0cnVlO1xuICBpZih0aGlzLnN0b3J5LmludGVyYWN0KHQpKXt0aGlzLmFuaW09J2lkbGUnO3RoaXMuYW5pbVRpbWU9MDtyZXR1cm4gdHJ1ZTt9XG4gIGlmKHRoaXMuc3Rvcnkuc3BlZWNoKXRoaXMuc3RvcnkuY2FuY2VsKCk7XG4gIGlmKHQuaWQ9PT0nZWxldmF0b3InKXtcbiAgIGNvbnN0IGxvY2FsPXRoaXMubGV2ZWw/VE9QOkJPVFRPTSxyZW1vdGU9dGhpcy5sZXZlbD9CT1RUT006VE9QLGNhbGw9TWF0aC5hYnModGhpcy5lbGV2YXRvclktbG9jYWwpPi4wMTtcbiAgIHRoaXMucmlkZT17dGltZTowLGZyb206dGhpcy5lbGV2YXRvclksdG86Y2FsbD9sb2NhbDpyZW1vdGUsY2FsbCxkdXJhdGlvbjpjYWxsPzY6MTJ9O3RoaXMuYW5pbT0naWRsZSc7aWYoIWNhbGwpe3RoaXMueD1FWDtpZighdGhpcy5xYSlnbG9iYWwubHVuYUNhbXBhaWduPy5xdWlldExpZnQodGhpcyk7fVxuICB9ZWxzZSBpZih0LmlkPT09J2hvbWUnfHx0LmlkPT09J2V4aXQnKXtcbiAgIHRoaXMudHJhbnNpdGlvbj17dGltZTowLHRvOnQuaWQ9PT0naG9tZSc/J2hvbWUnOidzdHJlZXQnLHN3YXBwZWQ6ZmFsc2UsYmFyQXJyaXZhbDp0LmlkPT09J2V4aXQnJiZ0aGlzLmlzRmlyc3RDb21tdXRlKCl9O1xuICAgZ2xvYmFsLkx1bmFIb21lRG9vckF1ZGlvPy5wbGF5KCgpPT5nbG9iYWwub3V0c2lkZVBsYXl0ZXN0Py5hY3RpdmUmJmdsb2JhbC5vdXRzaWRlUGxheXRlc3QubW9kZWw9PT10aGlzJiYhdGhpcy5wYXVzZWQpO1xuICB9XG4gIGVsc2UgaWYodC5pZD09PSdiYXInKXRoaXMuZGlhbG9nPXt0aXRsZTon67CUIOyeheq1rCcsdGV4dDp0aGlzLmNvbmZpZy5mbG93PT09J2luJz8n7Lac6re86ri47J2YIOuPhOywqSDsp4DsoJDsnoXri4jri6QuIOydtCDtg63sl5DshJzripQg67CUIOyYgeyXheycvOuhnCDrhJjslrTqsIDsp4Ag7JWK6rOgIOyZuOu2gCDqs7XqsITrp4wg7YOQ7IOJ7ZWp64uI64ukLic6J+2HtOq3vOq4uOydmCDstpzrsJwg7KeA7KCQ7J6F64uI64ukLiDsmbzsqr0g7JeY66as67Kg7J207YSw66W8IO2DgOuptCDsp5HsnLzroZwg6rCIIOyImCDsnojsirXri4jri6QuJ307XG5cbiAgdGhpcy51cGRhdGVOZWFyKCk7dGhpcy5yZXZpc2lvbisrO3JldHVybiB0cnVlO1xuIH1cbiB0aWNrKGR0LGlucHV0PXt9KXtcbiAgZHQ9Y2xhbXAoTnVtYmVyKGR0KXx8MCwwLC4wNSk7aWYodGhpcy5wYXVzZWQpcmV0dXJuO1xuICAvLyBJbnNwZWN0aW5nIGFuIGltYWdlIG11c3Qgbm90IHN0YXJ0IGEgcHJveGltaXR5IHNjZW5lIG9yIG1vdmUgdGhlIHBsYXllclxuICAvLyB0aHJvdWdoIHNjcmlwdGVkL2JvdW5kYXJ5IHVwZGF0ZXMgYmVoaW5kIHRoZSBtb2RhbC5cbiAgaWYodGhpcy5kaWFsb2c/LmtpbmQ9PT0naW5zcGVjdGlvbicpe3RoaXMudGltZSs9ZHQ7dGhpcy5hbmltVGltZSs9ZHQ7cmV0dXJuO31cbiAgc3luY0hvbWV3YXJkR29hbCh0aGlzKTtcbiAgaWYodGhpcy5xYSYmZ2xvYmFsLkx1bmFPdXRzaWRlUUEudGljayh0aGlzLGR0KSlyZXR1cm47XG4gIHRoaXMuc3RvcnkudGljayhkdCk7XG4gIGdsb2JhbC5MdW5hT3V0c2lkZVN0b3J5LnRpY2tCYWNrZ3JvdW5kKHRoaXMsZHQpO1xuICB0aGlzLnRpbWUrPWR0O2dsb2JhbC5MdW5hT3V0c2lkZUJlZ2dhcj8udGljayh0aGlzLGR0KTt0aGlzLm5vdGljZUxlZnQ9TWF0aC5tYXgoMCx0aGlzLm5vdGljZUxlZnQtZHQpO1xuICBpZihnbG9iYWwuTHVuYU91dHNpZGVFbmNvdW50ZXJzPy50aWNrKHRoaXMsZHQpKXJldHVybjtcbiAgaWYoZ2xvYmFsLkx1bmFPdXRzaWRlTm90aW9uPy50aWNrKHRoaXMsZHQpKXJldHVybjtcbiAgaWYoZ2xvYmFsLkx1bmFPdXRzaWRlVGh1Zz8udGljayh0aGlzLGR0KSlyZXR1cm47XG4gIGlmKGdsb2JhbC5MdW5hT3V0c2lkZVNhbWhvQ29tbXV0ZT8udGljayh0aGlzLGR0KSlyZXR1cm47XG4gIGlmKHRoaXMuZW5jb3VudGVyKXtjb25zdCBlPXRoaXMuZW5jb3VudGVyO1xuICAgaWYoZS5zdGFnZT09PSdhY3RpdmUnJiYhdGhpcy5zdG9yeS5zcGVlY2gpe2Uuc3RhZ2U9J2xlYXZpbmcnO2UuY2FtZXJhUmVhZHk9ZmFsc2U7ZS5lbGFwc2VkPTA7fVxuICAgaWYoZS5zdGFnZT09PSdlbnRlcmluZycpe2UuZWxhcHNlZCs9ZHQ7Y29uc3QgcD1zbW9vdGgoY2xhbXAoZS5lbGFwc2VkL2UuZHVyYXRpb24sMCwxKSksb2xkPXRoaXMueDt0aGlzLng9bWl4KGUuZnJvbSxlLnRvLHApO3RoaXMuYW5pbT1NYXRoLmFicyh0aGlzLngtb2xkKT4uMDAwMDE/J3dhbGsnOidpZGxlJzt0aGlzLmFuaW1UaW1lKz1kdDtcbiAgICBpZihlLmVsYXBzZWQ+PWUuZHVyYXRpb24mJmUuY2FtZXJhUmVhZHkpe3RoaXMueD1lLnRvO3RoaXMuYW5pbT0naWRsZSc7ZS5zdGFnZT0nYWN0aXZlJzt0aGlzLnN0b3J5LmJlZ2luKGUuaWQsZS50YXJnZXQpO31yZXR1cm47fVxuICAgaWYoZS5zdGFnZT09PSdsZWF2aW5nJyl7dGhpcy5hbmltPSdpZGxlJzt0aGlzLmFuaW1UaW1lKz1kdDtpZihlLmNhbWVyYVJlYWR5KXt0aGlzLmVuY291bnRlcj1udWxsO3RoaXMudXBkYXRlTmVhcigpO31yZXR1cm47fVxuICB9XG4gIGlmKHRoaXMudHJhbnNpdGlvbil7XG4gICBjb25zdCB0PXRoaXMudHJhbnNpdGlvbjt0LnRpbWUrPWR0O1xuICAgaWYodC50aW1lPj0uMzgmJiF0LnN3YXBwZWQpe1xuICAgIHQuc3dhcHBlZD10cnVlO3RoaXMuc2NlbmU9dC50bzt0aGlzLmxldmVsPXQuYmFyQXJyaXZhbD8wOjE7XG4gICAgdGhpcy54PXQuYmFyQXJyaXZhbD9GSVJTVF9DT01NVVRFX0FSUklWQUwuZnJvbTp0aGlzLnNjZW5lPT09J2hvbWUnPy0xLjI4OlIuaG9tZVg7XG4gICAgdGhpcy55PXQuYmFyQXJyaXZhbHx8dGhpcy5zY2VuZT09PSdob21lJz8tLjc6Ui51cHBlclk7dGhpcy5lbGV2YXRvclk9dC5iYXJBcnJpdmFsP0JPVFRPTTpUT1A7XG4gICAgaWYodC5iYXJBcnJpdmFsKXt0aGlzLmZhY2luZz0xO3RoaXMuYmFja2dyb3VuZFN0b3J5LmNhbmNlbCgpO2dsb2JhbC5vdXRzaWRlUGxheXRlc3Q/LmNsZWFySW5wdXQoKTt9XG4gICAgdGhpcy5yZXZpc2lvbisrO1xuICAgfVxuICAgaWYodC50aW1lPj0uODUpe1xuICAgIHRoaXMudHJhbnNpdGlvbj1udWxsO1xuICAgIGlmKHQuYmFyQXJyaXZhbCl0aGlzLmJhckFycml2YWw9e3RvOkZJUlNUX0NPTU1VVEVfQVJSSVZBTC50b307ZWxzZSBpZih0LnRvPT09J3N0cmVldCcpdGhpcy5maXJzdENvbW11dGVEaXJlY3Rpb25zKCk7XG4gICAgdGhpcy51cGRhdGVOZWFyKCk7dGhpcy5yZXZpc2lvbisrO1xuICAgfVxuICAgdGhpcy5hbmltPSdpZGxlJzt0aGlzLmFuaW1UaW1lKz1kdDtyZXR1cm47XG4gIH1cbiAgaWYodGhpcy50aWNrQmFyQXJyaXZhbChkdCkpcmV0dXJuO1xuICBpZih0aGlzLnJpZGUpe2NvbnN0IHI9dGhpcy5yaWRlO3IudGltZSs9ZHQ7Y29uc3QgcD1zbW9vdGgoY2xhbXAoKHIudGltZS0uNDUpL3IuZHVyYXRpb24sMCwxKSk7dGhpcy5lbGV2YXRvclk9bWl4KHIuZnJvbSxyLnRvLHApO2lmKHA9PT0xKWdsb2JhbC5MdW5hTGlmdER1c3Q/LmxhbmQodGhpcyxyKTtpZighci5jYWxsKXt0aGlzLng9RVg7dGhpcy55PXRoaXMuZWxldmF0b3JZK1IucGFzc2VuZ2VyT2Zmc2V0O31pZihyLnRpbWU+PXIuZHVyYXRpb24rMS4xKXtpZighci5jYWxsKXt0aGlzLmxldmVsPXIudG89PT1UT1A/MTowO3RoaXMueT10aGlzLmxldmVsP1IudXBwZXJZOi0uNzt0aGlzLmFycml2YWxzKys7fXRoaXMuZWxldmF0b3JZPXIudG87dGhpcy5yaWRlPW51bGw7dGhpcy51cGRhdGVOZWFyKCk7dGhpcy5yZXZpc2lvbisrO310aGlzLmFuaW09J2lkbGUnO3RoaXMuYW5pbVRpbWUrPWR0O3JldHVybjt9XG4gIGxldCBkaXJlY3Rpb249dGhpcy5kaWFsb2d8fHRoaXMuc3RvcnkuYmxvY2tpbmc/MDpjbGFtcChpbnB1dC5tb3ZlfHwwLC0xLDEpLHNwZWVkPWlucHV0LnJ1bj8xLjI6Ljc7XG4gIGNvbnN0IHJlc3RyaWN0ZWQ9dGhpcy5pc0ZpcnN0Q29tbXV0ZSgpJiZ0aGlzLnNjZW5lPT09J3N0cmVldCcmJnRoaXMubGV2ZWw9PT0wO1xuICBjb25zdCBib3VuZHM9cmVzdHJpY3RlZD9bLS45LDIuMTVdOnRoaXMucWE/Wy0xMi44MSw2LjFdOnRoaXMuc2NlbmU9PT0naG9tZSc/Wy0xLjUsMy40XTp0aGlzLmxldmVsP1tSLnVwcGVyTWluLFIudXBwZXJNYXhdOltSLmxvd2VyTWluLDYuMV0sb2xkPXRoaXMueCxkZXNpcmVkPXRoaXMueCtkaXJlY3Rpb24qc3BlZWQqZHQ7XG4gIHRoaXMueD1jbGFtcChkZXNpcmVkLC4uLmJvdW5kcyk7XG4gIGlmKHJlc3RyaWN0ZWQpe1xuICAgaWYodGhpcy54PmJvdW5kc1swXSsuMTImJnRoaXMueDxib3VuZHNbMV0tLjEyKXRoaXMuY29tbXV0ZUJvdW5kYXJ5U2lkZT0wO1xuICAgY29uc3Qgc2lkZT1kZXNpcmVkPGJvdW5kc1swXT8tMTpkZXNpcmVkPmJvdW5kc1sxXT8xOjA7XG4gICBpZihzaWRlJiZzaWRlIT09dGhpcy5jb21tdXRlQm91bmRhcnlTaWRlKXtcbiAgICB0aGlzLmNvbW11dGVCb3VuZGFyeVNpZGU9c2lkZTtkaXJlY3Rpb249MDtnbG9iYWwub3V0c2lkZVBsYXl0ZXN0Py5jbGVhcklucHV0KCk7XG4gICAgdGhpcy5zdG9yeS5iZWdpblJvd3MoJ2RheTBfY29tbXV0ZV9ib3VuZGFyeScse3g6dGhpcy54LHk6dGhpcy55fSxbe3R5cGU6J3NheScsYWN0b3I6J2x1bmEnLHRleHQ6J+yngOq4iOydgCDslrjrhbjsmrQg6rCA6rKM66GcIOy2nOq3vO2VtOyVvO2VtC4nfV0sZmFsc2UsKCk9Pmdsb2JhbC5vdXRzaWRlUGxheXRlc3Q/LmNsZWFySW5wdXQoKSk7XG4gICB9XG4gIH1cbiAgaWYoZGlyZWN0aW9uKXRoaXMuZmFjaW5nPWRpcmVjdGlvbj4wPzE6LTE7Y29uc3QgbmV4dD0hdGhpcy5zdG9yeS5ibG9ja2luZyYmTWF0aC5hYnModGhpcy54LW9sZCk+LjAwMDAxPyhpbnB1dC5ydW4/J3J1bic6J3dhbGsnKTonaWRsZSc7aWYobmV4dCE9PXRoaXMuYW5pbSl0aGlzLmFuaW1UaW1lPTA7dGhpcy5hbmltPW5leHQ7dGhpcy5hbmltVGltZSs9ZHQ7dGhpcy51cGRhdGVOZWFyKCk7XG4gfVxufVxuZnVuY3Rpb24gY3JlYXRlKHtvbkV4aXQ9KCk9Pnt9LGN1cnJlbmN5Vmlldz1nbG9iYWwuTHVuYUN1cnJlbmN5VmlldygpfT17fSl7XG4gY29uc3QgZ2xvd1JlbmRlcmVyPWdsb2JhbC5MdW5hSW50ZXJhY3Rpb25HbG93LmNyZWF0ZSgpO2xldCByZW5kZXJpbmdOb2RlPW51bGwsY2hvaWNlVUk9bnVsbDtcbiBjb25zdCBkYXRhPWdsb2JhbC5MVU5BX09VVFNJREVfREFUQSxjb25maWc9e3BsYWNlOidiYXInLGZsb3c6J291dCcsZGF5OjB9LGltYWdlcz1uZXcgTWFwKCksa2V5cz1uZXcgU2V0KCk7XG4gbGV0IGFjdGl2ZT1mYWxzZSxsb2FkaW5nPWZhbHNlLGxvYWRFcnJvcj0nJyxtb2RlbD1udWxsLGhvc3Q9bnVsbCxjYW52YXM9bnVsbCxjdHg9bnVsbCxjYW09e3g6MSx5OjAsdzo0Ljh9LGdlbmVyYXRpb249MCxodWRTaWduYXR1cmU9JycsbGFzdFNjZW5lPScnLHBhbm9yYW1hPWZhbHNlLHdha2VTcGF3bj1mYWxzZSxkZXZPcGVuPWZhbHNlLG5vdGljZXM9bnVsbCxoaW50T3Blbj1mYWxzZSxzdHJlZXRMb2NhdGlvbj1udWxsO1xuIGxldCBzdXJmYWNlPWdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEuc3VyZmFjZSgxMjgwLDcyMCkscmVuZGVyQ2FtPXsuLi5jYW19LHBpeGVsV2lkdGg9Z2xvYmFsLkx1bmFQaXhlbENhbWVyYS5zZXR0bGVkV2lkdGgoY2FtLncsc3VyZmFjZSk7XG4gbGV0IHBhbm9yYW1hVHdlZW49ZmFsc2U7XG4gY29uc3QgZXNjPXM9PlN0cmluZyhzKS5yZXBsYWNlKC9bJjw+XCInXS9nLGM9Pih7JyYnOicmYW1wOycsJzwnOicmbHQ7JywnPic6JyZndDsnLCdcIic6JyZxdW90OycsXCInXCI6JyYjMzk7J31bY10pKTtcbiBjb25zdCBidXR0b249KHRleHQsYWN0aW9uLGNscz0nJyk9PmA8YnV0dG9uIGNsYXNzPVwiJHtjbHN9XCIgZGF0YS1vdXRzaWRlLWFjdGlvbj1cIiR7YWN0aW9ufVwiPiR7dGV4dH08L2J1dHRvbj5gO1xuIGZ1bmN0aW9uIGxvYmJ5SFRNTCh0YWJzKXtyZXR1cm4gYDxkaXYgY2xhc3M9XCJzdGFydC1zY3JlZW4gb3V0c2lkZS1zdGFydFwiPiR7dGFic308c2VjdGlvbiBjbGFzcz1cInN0YXJ0LWNhcmQgb3V0c2lkZS1zZXR1cCBvdXRzaWRlLWVudHJ5XCI+PHNtYWxsPk9VVFNJREUgRVhQTE9SQVRJT048L3NtYWxsPjxoMj7smbjrtoAg6rO16rCEPC9oMj48cD7qsbDrpqzsmYAg7KeR7J2EIOyekOycoOuhreqyjCDrkZjrn6zrs7TshLjsmpQuPGJyPuyEpOygleydgCDtg5Dsg4kg7KSRIDxrYmQ+UDwva2JkPuulvCDriIzrn6wg67OA6rK97ZWgIOyImCDsnojsirXri4jri6QuPC9wPiR7YnV0dG9uKCftg5Dsg4kg7Iuc7J6RIOKGkicsJ3N0YXJ0JywncHJpbWFyeScpfTxzcGFuPjDsnbzssKggwrcg7Ye06re86ri4IMK3IOuwlCDrrLgg7JWe7JeQ7IScIOyLnOyekTwvc3Bhbj48L3NlY3Rpb24+PC9kaXY+YDt9XG4gYXN5bmMgZnVuY3Rpb24gbG9hZEltYWdlcygpe2F3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGRhdGEuYXNzZXRzKS5tYXAoKFtpZCxhXSk9PntpZihpbWFnZXMuaGFzKGlkKSlyZXR1cm47cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCk9Pntjb25zdCBpbT1uZXcgSW1hZ2UoKSx0aW1lb3V0PXNldFRpbWVvdXQoKCk9PnJlamVjdChFcnJvcihhLnNyYykpLDE1MDAwKTtpbS5vbmxvYWQ9KCk9PntjbGVhclRpbWVvdXQodGltZW91dCk7aW1hZ2VzLnNldChpZCxpbSk7cmVzb2x2ZSgpO307aW0ub25lcnJvcj0oKT0+e2NsZWFyVGltZW91dCh0aW1lb3V0KTtyZWplY3QoRXJyb3IoYS5zcmMpKTt9O2ltLnNyYz1hLnNyYzt9KTt9KSk7fVxuIGZ1bmN0aW9uIGZpdCgpe2lmKCFob3N0KXJldHVybjtjb25zdCBwcmV2aW91cz1zdXJmYWNlO3N1cmZhY2U9Z2xvYmFsLkx1bmFQaXhlbENhbWVyYS5zdXJmYWNlKGlubmVyV2lkdGgsaW5uZXJIZWlnaHQsZGV2aWNlUGl4ZWxSYXRpbyk7aWYocHJldmlvdXMudyE9PXN1cmZhY2Uud3x8cHJldmlvdXMuZHByIT09c3VyZmFjZS5kcHIpcGl4ZWxXaWR0aD1nbG9iYWwuTHVuYVBpeGVsQ2FtZXJhLnNldHRsZWRXaWR0aChjYW0udyxzdXJmYWNlKTtob3N0LnN0eWxlLnNldFByb3BlcnR5KCctLW91dHNpZGUtc2NhbGUnLHN1cmZhY2UuY3NzU2NhbGUpO2hvc3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tb3V0c2lkZS1sZWZ0JyxzdXJmYWNlLmxlZnQrJ3B4Jyk7aG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1vdXRzaWRlLXRvcCcsc3VyZmFjZS50b3ArJ3B4Jyk7aWYoY2FudmFzJiYoY2FudmFzLndpZHRoIT09c3VyZmFjZS53fHxjYW52YXMuaGVpZ2h0IT09c3VyZmFjZS5oKSl7Y2FudmFzLndpZHRoPXN1cmZhY2UudztjYW52YXMuaGVpZ2h0PXN1cmZhY2UuaDt9fVxuIGZ1bmN0aW9uIGNsZWFySW5wdXQoKXtrZXlzLmNsZWFyKCk7fVxuIGZ1bmN0aW9uIGRldk1vbmV5KCl7cmV0dXJuIE1hdGgubWF4KDAsTnVtYmVyKGdsb2JhbC5iYXJHYW1lPy5wcm9ncmVzcy5tb25leSl8fDApO31cbiBmdW5jdGlvbiBkZXZIVE1MKCl7cmV0dXJuICc8YXNpZGUgY2xhc3M9XCJvdXRzaWRlLWRldi1jb25zb2xlXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbGFiZWw9XCLsmbjrtoAg6rCc67Cc7J6QIOy9mOyGlFwiIGhpZGRlbj48aGVhZGVyPjxkaXY+PHNtYWxsPkRFVkVMT1BFUjwvc21hbGw+PGgyPuyZuOu2gCDqsJzrsJzsnpAg7L2Y7IaUPC9oMj48L2Rpdj4nK2J1dHRvbignUCDCtyDri6vquLAnLCdkZXYtY2xvc2UnKSsnPC9oZWFkZXI+PHNlY3Rpb24gY2xhc3M9XCJvdXRzaWRlLWRldi1kYXlzLXNlY3Rpb25cIj48aDM+7J287LCoPC9oMz48ZGl2IGNsYXNzPVwib3V0c2lkZS1kZXYtZGF5c1wiPicrWzAsMSwyLDMsOTldLm1hcChkYXk9PmJ1dHRvbihkYXk9PT05OT8nOTnsnbzssKggwrcgUUEg6rCA7IOBIOqzteqwhCc6ZGF5KyfsnbzssKgnLCdkZXYtZGF5LScrZGF5LGRheT09PTk5PydvdXRzaWRlLWRldi1xYSc6JycpKS5qb2luKCcnKSsnPC9kaXY+PC9zZWN0aW9uPjxzZWN0aW9uPjxoMz7snbTrj5kg7IOB7YOcIDxzbWFsbCBjbGFzcz1cIm91dHNpZGUtZGV2LWRheVwiPjwvc21hbGw+PC9oMz48ZGl2IGNsYXNzPVwib3V0c2lkZS1kZXYtZmxvd1wiPicrYnV0dG9uKCfstpzqt7zquLgnLCdkZXYtZmxvdy1pbicpK2J1dHRvbign7Ye06re86ri4JywnZGV2LWZsb3ctb3V0JykrJzwvZGl2Pjwvc2VjdGlvbj48c2VjdGlvbj48aDM+7JyE7LmYIOydtOuPmTwvaDM+JytidXR0b24oJ+ynkSDslYgnLCdkZXYtaG9tZScpK2J1dHRvbign7JeY66as67Kg7J207YSwIOyVniDCtyDslYTrnpjsuLUnLCdkZXYtZWxldmF0b3InKStidXR0b24oJ+uwlCDrrLgg7JWeJywnZGV2LWJhcicpKyc8L3NlY3Rpb24+PHNlY3Rpb24+PGgzPu2YhOyerCDshozsp4DquIg8L2gzPjxvdXRwdXQgY2xhc3M9XCJvdXRzaWRlLWRldi1tb25leVwiIGFyaWEtbGl2ZT1cInBvbGl0ZVwiPjwvb3V0cHV0PjxkaXYgY2xhc3M9XCJvdXRzaWRlLWRldi1tb25leS1hY3Rpb25zXCI+JytidXR0b24oJ+KIkjEsMDAw7JuQJywnZGV2LW1pbnVzJykrYnV0dG9uKCcrMSwwMDDsm5AnLCdkZXYtcGx1cycpKyc8L2Rpdj48L3NlY3Rpb24+PHAgY2xhc3M9XCJvdXRzaWRlLWRldi1ub3RlXCI+PC9wPjxwIGNsYXNzPVwib3V0c2lkZS1kZXYtZmVlZGJhY2tcIiByb2xlPVwic3RhdHVzXCI+PC9wPjwvYXNpZGU+Jzt9XG4gZnVuY3Rpb24gcGFpbnREZXYoKXtjb25zdCBwYW5lbD1ob3N0Py5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1kZXYtY29uc29sZScpO2lmKCFwYW5lbClyZXR1cm47cGFuZWwuaGlkZGVuPSFkZXZPcGVuO3BhbmVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLW91dHNpZGUtYWN0aW9uPVwiZGV2LWRheS05OVwiXScpLmhpZGRlbj0hIWdsb2JhbC5sdW5hQ2FtcGFpZ24/LmFjdGl2ZTtwYW5lbC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1kZXYtZGF5JykudGV4dENvbnRlbnQ9bW9kZWwuY29uZmlnLmRheSsn7J287LCoJztmb3IoY29uc3QgZGF5IG9mIFswLDEsMiwzLDk5XSlwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1vdXRzaWRlLWFjdGlvbj1cImRldi1kYXktJytkYXkrJ1wiXScpLnNldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyxTdHJpbmcobW9kZWwuY29uZmlnLmRheT09PWRheSkpO2Zvcihjb25zdCBmbG93IG9mIFsnaW4nLCdvdXQnXSlwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1vdXRzaWRlLWFjdGlvbj1cImRldi1mbG93LScrZmxvdysnXCJdJykuc2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnLFN0cmluZyhtb2RlbC5jb25maWcuZmxvdz09PWZsb3cpKTtmb3IoY29uc3QgcGxhY2Ugb2YgWydob21lJywnZWxldmF0b3InLCdiYXInXSlwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1vdXRzaWRlLWFjdGlvbj1cImRldi0nK3BsYWNlKydcIl0nKS5kaXNhYmxlZD0hIW1vZGVsLnFhO3BhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWRldi1ub3RlJykudGV4dENvbnRlbnQ9bW9kZWwucWE/Jzk57J287LCo64qUIFFBIOyghOyaqSDqs7XqsITsnoXri4jri6QuIFAg7Yyo64SQ7J2EIOuLq+qzoCBUYWLsnLzroZwg7YWM7Iqk7Yq47ZWgIOyDge2ZqeydhCDqs6DrpbTshLjsmpQuIDDigJMz7J287LCo66W8IOyEoO2Dne2VmOuptCDqsbDrpqzroZwg64+M7JWE6rCR64uI64ukLic6Z2xvYmFsLmx1bmFDYW1wYWlnbj8uYWN0aXZlPyfsnbzssKgg67OA6rK97J2AIOuzuO2OuCDsp4Ttlonsl5Drj4Qg7KCB7Jqp65Cp64uI64ukLiDsnITsuZjCt+yGjOyngOq4iMK367O07JygIOusvO2SiOydgCDsnKDsp4DtlZjqs6Ag7KeE7ZaJIOykkeyduCDrjIDtmZTCt+ydtOuypO2KuOuKlCDstIjquLDtmZTtlanri4jri6QuJzon7J287LCoIOuzgOqyvSDsi5wg7KeE7ZaJIOykkeyduCDrjIDtmZTCt+ydtOuypO2KuOuKlCDstIjquLDtmZTrkKnri4jri6QuIO2YhOyerCDsnITsuZjCt+yGjOyngOq4iMK367O07JygIOusvO2SiOydgCDsnKDsp4DrkKnri4jri6QuIDk57J287LCo64qUIOuzhOuPhCBRQSDqs7XqsITsnLzroZwg7J2064+Z7ZWp64uI64ukLic7cGFuZWwucXVlcnlTZWxlY3Rvcignb3V0cHV0JykudGV4dENvbnRlbnQ9ZGV2TW9uZXkoKS50b0xvY2FsZVN0cmluZygna28tS1InKSsn7JuQJztwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1vdXRzaWRlLWFjdGlvbj1cImRldi1taW51c1wiXScpLmRpc2FibGVkPWRldk1vbmV5KCk9PT0wO31cbiBmdW5jdGlvbiB0b2dnbGVEZXYob3Blbj0hZGV2T3Blbil7aWYoIWFjdGl2ZXx8bG9hZGluZ3x8bG9hZEVycm9yKXJldHVybjtkZXZPcGVuPW9wZW47aGludE9wZW49ZmFsc2U7Y2xlYXJJbnB1dCgpO3BhaW50RGV2KCk7aHVkU2lnbmF0dXJlPScnO3VwZGF0ZUhVRCgpO2lmKG9wZW4paG9zdC5xdWVyeVNlbGVjdG9yKG1vZGVsLnFhPydbZGF0YS1vdXRzaWRlLWFjdGlvbj1cImRldi1kYXktMFwiXSc6J1tkYXRhLW91dHNpZGUtYWN0aW9uPVwiZGV2LWhvbWVcIl0nKT8uZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO2Vsc2UgaG9zdC5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fVxuIGZ1bmN0aW9uIG5vcm1hbFBvc2l0aW9uKG0pe3JldHVybiB7c2NlbmU6bS5zY2VuZSxsZXZlbDptLmxldmVsLHg6bS5yaWRlP0VYOm0ueCx5Om0ucmlkZT8obS5sZXZlbD9SLnVwcGVyWTotLjcpOm0ueSxlbGV2YXRvclk6bS5yaWRlPyhtLmxldmVsP1RPUDpCT1RUT00pOm0uZWxldmF0b3JZLGZhY2luZzptLmZhY2luZyxwbGFjZTptLmNvbmZpZy5wbGFjZX07fVxuIGZ1bmN0aW9uIGNoYW5nZURheShkYXkpe1xuICBpZigoZ2xvYmFsLmx1bmFDYW1wYWlnbj8uYWN0aXZlJiZkYXk9PT05OSl8fCFbMCwxLDIsMyw5OV0uaW5jbHVkZXMoZGF5KXx8bW9kZWwuY29uZmlnLmRheT09PWRheSlyZXR1cm47XG4gIGNvbnN0IG09bW9kZWwsYz1nbG9iYWwubHVuYUNhbXBhaWduO2NsZWFySW5wdXQoKTttLnN0b3J5LmNhbmNlbCgpO20uYmFja2dyb3VuZFN0b3J5LmNhbmNlbCgpO1xuICBpZighbS5xYSlzdHJlZXRMb2NhdGlvbj1ub3JtYWxQb3NpdGlvbihtKTtcbiAgY29uc3QgcWFDYXNlPW0ucWE/LmNhc2VJZHx8Y29uZmlnLnFhQ2FzZTtPYmplY3QuYXNzaWduKGNvbmZpZyx7ZGF5LHFhQ2FzZSxwbGFjZTpzdHJlZXRMb2NhdGlvbj8ucGxhY2V8fCdiYXInfSk7XG4gIGM/LmRlYnVnT3V0c2lkZURheShkYXksY29uZmlnLmZsb3cpO1xuICBtb2RlbD1uZXcgT3V0c2lkZU1vZGVsKGNvbmZpZyk7XG4gIGlmKGRheSE9PTk5JiZzdHJlZXRMb2NhdGlvbil7Y29uc3Qge3BsYWNlLC4uLnBvc2l0aW9ufT1zdHJlZXRMb2NhdGlvbjtPYmplY3QuYXNzaWduKG1vZGVsLHBvc2l0aW9uKTttb2RlbC51cGRhdGVOZWFyKCk7fVxuICBpZihjKXtjLm91dHNpZGVTbGVlcD1udWxsO2MubGlmdExvZ29QZW5kaW5nPWZhbHNlO2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjYW1wYWlnbi1saWZ0LXJldmVhbCcpPy5yZW1vdmUoKTt9XG4gIHdha2VTcGF3bj1mYWxzZTtwYW5vcmFtYT1mYWxzZTtzbmFwQ2FtZXJhKCk7ZHJhdygpO1xuICBnbG9iYWwuYmFyR2FtZT8ubG9nKCdkZWJ1Z19vdXRzaWRlX2RheScse2Zyb206bS5jb25maWcuZGF5LHRvOmRheSxmbG93OmNvbmZpZy5mbG93fSk7XG4gIGhvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtZGV2LWZlZWRiYWNrJykudGV4dENvbnRlbnQ9ZGF5PT09OTk/Jzk57J287LCoIFFBIOqzteqwhOycvOuhnCDsnbTrj5ntlojsirXri4jri6QuIO2MqOuEkOydhCDri6vqs6AgVGFi7Jy866GcIOyDge2ZqeydhCDshKDtg53tlZjshLjsmpQuJzpkYXkrJ+ydvOywqCDCtyAnK0ZMT1dTW2NvbmZpZy5mbG93XSsn66GcIOuzgOqyve2WiOyKteuLiOuLpC4nO1xuIH1cbiBmdW5jdGlvbiBkaXNtaXNzSGludCgpe2hpbnRPcGVuPWZhbHNlO2NsZWFySW5wdXQoKTtodWRTaWduYXR1cmU9Jyc7dXBkYXRlSFVEKCk7aG9zdC5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fVxuIGZ1bmN0aW9uIGRldkFjdGlvbihhY3Rpb24pe2lmKCFkZXZPcGVufHxsb2FkaW5nfHxsb2FkRXJyb3IpcmV0dXJuO1xuICBpZihhY3Rpb249PT0nZGV2LWNsb3NlJyl7dG9nZ2xlRGV2KGZhbHNlKTtyZXR1cm47fVxuICBjb25zdCBtPW1vZGVsLGM9Z2xvYmFsLmx1bmFDYW1wYWlnbixnPWdsb2JhbC5iYXJHYW1lO1xuICBpZihhY3Rpb24uc3RhcnRzV2l0aCgnZGV2LWRheS0nKSljaGFuZ2VEYXkoTnVtYmVyKGFjdGlvbi5zbGljZSg4KSkpO1xuICBlbHNlIGlmKGFjdGlvbj09PSdkZXYtcGx1cyd8fGFjdGlvbj09PSdkZXYtbWludXMnKXtjb25zdCBiZWZvcmU9ZGV2TW9uZXkoKSxhZnRlcj1NYXRoLm1heCgwLGJlZm9yZSsoYWN0aW9uPT09J2Rldi1wbHVzJz8xMDAwOi0xMDAwKSk7Zy5wcm9ncmVzcy5tb25leT1hZnRlcjtpZihjPy5zZXNzaW9uLmFjdGl2ZSYmYy5zZXNzaW9uLmNhcnJ5KWMuc2Vzc2lvbi5jYXJyeS5tb25leT1hZnRlcjtnLmxvZygnZGVidWdfbW9uZXknLHtiZWZvcmUsYWZ0ZXIsc291cmNlOidvdXRzaWRlLWNvbnNvbGUnfSk7Zy5jaGFuZ2VkKCk7fVxuICBlbHNlIGlmKGFjdGlvbj09PSdkZXYtZmxvdy1pbid8fGFjdGlvbj09PSdkZXYtZmxvdy1vdXQnKXtcbiAgIGNvbnN0IGZsb3c9YWN0aW9uPT09J2Rldi1mbG93LWluJz8naW4nOidvdXQnO2lmKG0uY29uZmlnLmZsb3c9PT1mbG93KXJldHVybjtcbiAgIGNsZWFySW5wdXQoKTttLnN0b3J5LmNhbmNlbCgpO20uYmFja2dyb3VuZFN0b3J5LmNhbmNlbCgpO20uZW5jb3VudGVyPW51bGw7bS5kaWFsb2c9bnVsbDttLm5vdGljZT0nJzttLm5vdGljZUxlZnQ9MDttLnBsYXllZEFtYmllbnQuY2xlYXIoKTttLm5vdGlvbkNvbW11dGVTZWVuPWZhbHNlO1xuICAgLy8gUHJlc2VydmUgdGhlIGV4YWN0IGxvY2F0aW9uIChhbmQgYW55IGxpZnQgdHJpcCk7IG9ubHkgdGhlIHJvdXRlIGFuZCBpdHMgZXZlbnQgc3RhdGUgY2hhbmdlLlxuICAgbS5jb25maWcuZmxvdz1mbG93O2NvbmZpZy5mbG93PWZsb3c7XG4gICBpZihjPy5hY3RpdmUpe2Muc2Vzc2lvbi5kYXk9bS5jb25maWcuZGF5O2Muc2Vzc2lvbi5yb3V0ZT1mbG93O2Muc2Vzc2lvbi5jYXJyeT1KU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGcucHJvZ3Jlc3MpKTtjLnNlc3Npb24ucGVuZGluZ1N0ZXA9bnVsbDtjLm1vcm5pbmdTZWVuLmRlbGV0ZShtLmNvbmZpZy5kYXkpO2MubmlnaHRTdGFydGVkPWZhbHNlO31cbiAgIGlmKGMpe2Mub3V0c2lkZVNsZWVwPW51bGw7Yy5saWZ0TG9nb1BlbmRpbmc9ZmFsc2U7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NhbXBhaWduLWxpZnQtcmV2ZWFsJyk/LnJlbW92ZSgpO31cbiAgIGcubG9nKCdkZWJ1Z19jb21tdXRlJyx7ZGF5Om0uY29uZmlnLmRheSxmbG93LHNvdXJjZTonb3V0c2lkZS1jb25zb2xlJ30pO20udXBkYXRlTmVhcigpO20ucmV2aXNpb24rKztcbiAgIGhvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtZGV2LWZlZWRiYWNrJykudGV4dENvbnRlbnQ9bS5jb25maWcuZGF5KyfsnbzssKggwrcgJytGTE9XU1tmbG93XSsn66GcIOuzgOqyve2WiOyKteuLiOuLpC4nO1xuICB9XG4gIGVsc2UgaWYoWydkZXYtaG9tZScsJ2Rldi1lbGV2YXRvcicsJ2Rldi1iYXInXS5pbmNsdWRlcyhhY3Rpb24pKXtcbiAgIGlmKG0ucWEpcmV0dXJuO1xuXG4gICBjbGVhcklucHV0KCk7bS5zdG9yeS5jYW5jZWwoKTttLmJhY2tncm91bmRTdG9yeS5jYW5jZWwoKTttLnJpZGU9bnVsbDttLnRyYW5zaXRpb249bnVsbDttLmVuY291bnRlcj1udWxsO20uZGlhbG9nPW51bGw7bS5wYXVzZWQ9ZmFsc2U7bS5ub3RpY2U9Jyc7bS5ub3RpY2VMZWZ0PTA7XG4gICAvLyBLZWVwIFFBIGlzb2xhdGVkOyBzZWxlY3QgYSBub3JtYWwgZGF5IGJlZm9yZSB0ZWxlcG9ydGluZyBpbnRvIHRoZSBjaXR5LlxuICAgY29uc3QgaG9tZT1hY3Rpb249PT0nZGV2LWhvbWUnO20uc2NlbmU9aG9tZT8naG9tZSc6J3N0cmVldCc7bS5sZXZlbD1ob21lPzE6MDttLng9aG9tZT8tMS4yODphY3Rpb249PT0nZGV2LWVsZXZhdG9yJz9FWDoxLjAwODY7bS55PS0uNzttLmVsZXZhdG9yWT1ob21lP1RPUDpCT1RUT007bS5mYWNpbmc9aG9tZT8xOmFjdGlvbj09PSdkZXYtZWxldmF0b3InPzE6LTE7bS5hbmltPSdpZGxlJzttLmFuaW1UaW1lPTA7bS5jb25maWcucGxhY2U9aG9tZT8naG9tZSc6J2Jhcic7Y29uZmlnLnBsYWNlPW0uY29uZmlnLnBsYWNlO3dha2VTcGF3bj1mYWxzZTtwYW5vcmFtYT1mYWxzZTtcbiAgIGlmKGMpe2MubGlmdExvZ29QZW5kaW5nPWZhbHNlO2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjYW1wYWlnbi1saWZ0LXJldmVhbCcpPy5yZW1vdmUoKTt9XG4gICBtLnVwZGF0ZU5lYXIoKTttLnJldmlzaW9uKys7c25hcENhbWVyYSgpO2RyYXcoKTtob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWRldi1mZWVkYmFjaycpLnRleHRDb250ZW50PWhvbWU/J+ynkSDslYjsnLzroZwg7J2064+Z7ZaI7Iq164uI64ukLic6YWN0aW9uPT09J2Rldi1lbGV2YXRvcic/J+yVhOuemOy4tSDsl5jrpqzrsqDsnbTthLAg7JWe7Jy866GcIOydtOuPme2WiOyKteuLiOuLpC4nOifrsJQg66y4IOyVnuycvOuhnCDsnbTrj5ntlojsirXri4jri6QuJztcbiAgfVxuICBodWRTaWduYXR1cmU9Jyc7dXBkYXRlSFVEKCk7cGFpbnREZXYoKTtcbiB9XG4gZnVuY3Rpb24gZGV2S2V5KGUpe2lmKGUubWV0YUtleXx8ZS5jdHJsS2V5fHxlLmFsdEtleSlyZXR1cm4gZmFsc2U7XG4gIGlmKGUuY29kZT09PSdLZXlQJyYmIWxvYWRpbmcmJiFsb2FkRXJyb3ImJighbW9kZWwucGF1c2VkfHxkZXZPcGVuKSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2Uuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7aWYoIWUucmVwZWF0KXRvZ2dsZURldigpO3JldHVybiB0cnVlO31cbiAgaWYoIWRldk9wZW4pcmV0dXJuIGZhbHNlO2Uuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gIGlmKGUuY29kZT09PSdFc2NhcGUnKXtlLnByZXZlbnREZWZhdWx0KCk7aWYoIWUucmVwZWF0KXRvZ2dsZURldihmYWxzZSk7fVxuICBlbHNlIGlmKGUuY29kZT09PSdUYWInKXtlLnByZXZlbnREZWZhdWx0KCk7Y29uc3QgYnV0dG9ucz1bLi4uaG9zdC5xdWVyeVNlbGVjdG9yQWxsKCcub3V0c2lkZS1kZXYtY29uc29sZSBidXR0b246bm90KDpkaXNhYmxlZCknKV0uZmlsdGVyKGI9PmIuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGgpLGk9YnV0dG9ucy5pbmRleE9mKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO2J1dHRvbnNbKGkrKGUuc2hpZnRLZXk/LTE6MSkrYnV0dG9ucy5sZW5ndGgpJWJ1dHRvbnMubGVuZ3RoXT8uZm9jdXMoKTt9XG4gIGVsc2UgaWYoIVsnRW50ZXInLCdTcGFjZSddLmluY2x1ZGVzKGUuY29kZSl8fCFlLnRhcmdldC5jbG9zZXN0KCcub3V0c2lkZS1kZXYtY29uc29sZSBidXR0b24nKXx8ZS5yZXBlYXQpZS5wcmV2ZW50RGVmYXVsdCgpO1xuICByZXR1cm4gdHJ1ZTtcbiB9XG4gZnVuY3Rpb24gc25hcENhbWVyYSgpe1xuICBwYW5vcmFtYVR3ZWVuPWZhbHNlO1xuICBjb25zdCBhcnJpdmluZz1tb2RlbC5zY2VuZT09PSdzdHJlZXQnJiYobW9kZWwuYmFyQXJyaXZhbHx8bW9kZWwudHJhbnNpdGlvbj8uYmFyQXJyaXZhbCk7XG4gIGNhbT17eDptb2RlbC5zY2VuZT09PSdob21lJz9jbGFtcChtb2RlbC54LC4zNCwxLjE0KTphcnJpdmluZz8uNjU6bW9kZWwueCx5Om1vZGVsLnNjZW5lPT09J2hvbWUnPy4wMjM6bW9kZWwueSsuNyx3OjQuOH07bGFzdFNjZW5lPW1vZGVsLnNjZW5lO1xuICBwaXhlbFdpZHRoPWdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEuc2V0dGxlZFdpZHRoKGNhbS53LHN1cmZhY2UpO1xuIH1cbiBhc3luYyBmdW5jdGlvbiBzdGFydCh7d2FrZUF0U29mYT1mYWxzZSxzaG93RGV2SGludD1mYWxzZX09e30pe2lmKGFjdGl2ZSlyZXR1cm47d2FrZVNwYXduPXdha2VBdFNvZmE7Z2VuZXJhdGlvbisrO2NvbnN0IHRva2VuPWdlbmVyYXRpb247YWN0aXZlPXRydWU7bG9hZGluZz10cnVlO2xvYWRFcnJvcj0nJztwYW5vcmFtYT1mYWxzZTtkZXZPcGVuPWZhbHNlO2hpbnRPcGVuPWZhbHNlO3N0cmVldExvY2F0aW9uPW51bGw7Y2xlYXJJbnB1dCgpO21vZGVsPW5ldyBPdXRzaWRlTW9kZWwoY29uZmlnKTtpZih3YWtlU3Bhd24pbW9kZWwud2FrZUF0U29mYSgpO3NuYXBDYW1lcmEoKTtob3N0PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlY3Rpb24nKTtob3N0LmlkPSdvdXRzaWRlLXJvb3QnO2hvc3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywn7Jm467aAIOqzteqwhCDtg5Dsg4knKTtob3N0LnRhYkluZGV4PS0xO2hvc3QuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPVwib3V0c2lkZS1zdGFnZVwiPjxjYW52YXMgd2lkdGg9XCIxMjgwXCIgaGVpZ2h0PVwiNzIwXCIgYXJpYS1sYWJlbD1cIuujqOuCmOqwgCDsnbTrj5ntlZjripQg6rGw66as7JmAIOynkSDrgrTrtoBcIiByb2xlPVwiaW1nXCI+PC9jYW52YXM+PGRpdiBjbGFzcz1cIm91dHNpZGUtaHVkXCI+PGRpdiBjbGFzcz1cIm91dHNpZGUtZHluYW1pY1wiPjwvZGl2PjwvZGl2PjxkaXYgY2xhc3M9XCJvdXRzaWRlLXNwZWVjaFwiIGhpZGRlbj48L2Rpdj48ZGl2IGNsYXNzPVwib3V0c2lkZS1iYWNrZ3JvdW5kLXNwZWVjaFwiIGhpZGRlbj48L2Rpdj48ZGl2IGNsYXNzPVwib3V0c2lkZS1vdmVybGF5XCI+PC9kaXY+JytkZXZIVE1MKCkrJzwvZGl2Pic7ZG9jdW1lbnQuYm9keS5hcHBlbmQoaG9zdCk7Y2hvaWNlVUk9Z2xvYmFsLkx1bmFXb3JsZENob2ljZXMuY3JlYXRlKGhvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtc3RhZ2UnKSxpZD0+e2NsZWFySW5wdXQoKTtpZihtb2RlbC5kaWFsb2c/LmtpbmQ9PT0nc29mYScpe21vZGVsLmNob29zZVNvZmEoaWQpO2hvc3Q/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9ZWxzZSBtb2RlbC5zdG9yeS5jaG9vc2UoaWQpO3VwZGF0ZUhVRCgpO30pO25vdGljZXM9Z2xvYmFsLkx1bmFPdXRzaWRlTm90aWNlcy5jcmVhdGUoaG9zdCxjdXJyZW5jeVZpZXcpO25vdGljZXMudXBkYXRlKG1vZGVsKTtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXBwJykuaGlkZGVuPXRydWU7Y2FudmFzPWhvc3QucXVlcnlTZWxlY3RvcignY2FudmFzJyk7Y3R4PWNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO2ZpdCgpO2h1ZFNpZ25hdHVyZT0nJztkcmF3KCk7dXBkYXRlSFVEKCk7dHJ5e2F3YWl0IGxvYWRJbWFnZXMoKTtpZih0b2tlbiE9PWdlbmVyYXRpb24pcmV0dXJuO2xvYWRpbmc9ZmFsc2U7aGludE9wZW49c2hvd0RldkhpbnQmJiFnbG9iYWwubHVuYUNhbXBhaWduPy5hY3RpdmU7aG9zdC5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fWNhdGNoKGUpe2lmKHRva2VuIT09Z2VuZXJhdGlvbilyZXR1cm47bG9hZGluZz1mYWxzZTtsb2FkRXJyb3I9J+qxsOumrCDrpqzshozsiqTrpbwg67aI65+s7Jik7KeAIOuqu+2WiOyKteuLiOuLpC4g64uk7IucIOyLnOuPhO2VtCDso7zshLjsmpQuJztjb25zb2xlLmVycm9yKCdPdXRzaWRlIGFzc2V0IGxvYWQ6JyxlLm1lc3NhZ2UpO311cGRhdGVIVUQoKTt9XG4gZnVuY3Rpb24gZXhpdChzaWxlbnQ9ZmFsc2Upe2Nob2ljZVVJPy5kaXNwb3NlKCk7Y2hvaWNlVUk9bnVsbDtnbG9iYWwuTHVuYUNvbnRyb2xzVHV0b3JpYWwuc3RvcCgpO2dsb2JhbC5MdW5hSG9tZURvb3JBdWRpbz8uc3RvcCgpO25vdGljZXM/LmRpc3Bvc2UoKTtub3RpY2VzPW51bGw7Z2VuZXJhdGlvbisrO2FjdGl2ZT1mYWxzZTtsb2FkaW5nPWZhbHNlO2Rldk9wZW49ZmFsc2U7aGludE9wZW49ZmFsc2U7Y2xlYXJJbnB1dCgpO2hvc3Q/LnJlbW92ZSgpO2hvc3Q9bnVsbDtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXBwJykuaGlkZGVuPWZhbHNlO2lmKCFzaWxlbnQpb25FeGl0KCk7fVxuIGZ1bmN0aW9uIGFkdmFuY2VEYXkoKXtcbiAgaWYoIWFjdGl2ZXx8bG9hZGluZ3x8bG9hZEVycm9yfHxtb2RlbC5xYXx8bW9kZWwuY29uZmlnLmZsb3chPT0nb3V0J3x8bW9kZWwuY29uZmlnLmRheT49MylyZXR1cm4gZmFsc2U7XG4gIE9iamVjdC5hc3NpZ24oY29uZmlnLHtkYXk6bW9kZWwuY29uZmlnLmRheSsxLGZsb3c6J2luJyxwbGFjZTonaG9tZSd9KTtcbiAgY2xlYXJJbnB1dCgpO21vZGVsPW5ldyBPdXRzaWRlTW9kZWwoY29uZmlnKTt3YWtlU3Bhd249dHJ1ZTttb2RlbC53YWtlQXRTb2ZhKCk7cGFub3JhbWE9ZmFsc2U7c25hcENhbWVyYSgpO2h1ZFNpZ25hdHVyZT0nJztkcmF3KCk7dXBkYXRlSFVEKCk7aG9zdC5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7cmV0dXJuIHRydWU7XG4gfVxuIGZ1bmN0aW9uIG1lbnUoKXtpZihsb2FkaW5nfHxsb2FkRXJyb3IpcmV0dXJuO2NsZWFySW5wdXQoKTttb2RlbC5wYXVzZWQ9IW1vZGVsLnBhdXNlZDtodWRTaWduYXR1cmU9Jyc7dXBkYXRlSFVEKCk7fVxuIGZ1bmN0aW9uIHRvZ2dsZVBhbm9yYW1hKCl7XG4gIGlmKGxvYWRpbmd8fGxvYWRFcnJvcnx8ZGV2T3Blbnx8bW9kZWwucGF1c2VkfHwhYXRWaWV3cG9pbnQobW9kZWwpKXJldHVybiBmYWxzZTtcbiAgcGFub3JhbWE9IXBhbm9yYW1hO3Bhbm9yYW1hVHdlZW49dHJ1ZTtjbGVhcklucHV0KCk7dXBkYXRlSFVEKCk7cmV0dXJuIHRydWU7XG4gfVxuIGZ1bmN0aW9uIHRhcmdldENhbWVyYShkdCl7XG4gIGlmKCFhdFZpZXdwb2ludChtb2RlbCkpcGFub3JhbWE9ZmFsc2U7XG4gIGlmKGxhc3RTY2VuZSE9PW1vZGVsLnNjZW5lKXNuYXBDYW1lcmEoKTtsZXQgdz00LjgseD1tb2RlbC54LHk9bW9kZWwuc2NlbmU9PT0naG9tZSc/LjAyMzptb2RlbC55Ky43LGxpZnRXaWR0aD1udWxsLGxpZnREaXNwbGF5V2lkdGg9bnVsbDtcbiAgaWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0JyYmbW9kZWwucmlkZSYmIW1vZGVsLnJpZGUuY2FsbCl7XG4gICBjb25zdCByPW1vZGVsLnJpZGUscD1jbGFtcCgoci50aW1lLS40NSkvci5kdXJhdGlvbiwwLDEpLHpvb209c21vb3RoKGNsYW1wKHIudGltZS8zLDAsMSkpKigxLXNtb290aChjbGFtcCgocC0uNzMpLy4yNywwLDEpKSk7XG4gICB3PW1peCg0LjgsMTIuOCx6b29tKTtsaWZ0V2lkdGg9dztcbiAgIGxpZnREaXNwbGF5V2lkdGg9bWl4KGdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEuc2V0dGxlZFdpZHRoKDQuOCxzdXJmYWNlKSxnbG9iYWwuTHVuYVBpeGVsQ2FtZXJhLnNldHRsZWRXaWR0aCgxMi44LHN1cmZhY2UpLHpvb20pO1xuICAgLy8gQm90aCBkaXJlY3Rpb25zIHNoYXJlIHRoZSBhc2NlbnQgcGFub3JhbWE6IEx1bmEvbGlmdCBhdCA2JSBvZiB0aGUgZnJhbWUsIG5vdFxuICAgLy8gYSBmaXhlZCB3b3JsZCBvZmZzZXQuIFBQVS1jYWxpYnJhdGVkIHdpZHRoIHZhcmllcyB3aXRoIHZpZXdwb3J0L0RQUi5cbiAgIC8vIFVzZSB0aGUgc2FtZSBlYXNpbmcgYXMgdGhlIHpvb20gc28gYm9hcmRpbmcgYW5kIGFycml2YWwgc3RheSBjb250aW51b3VzLlxuICAgeD1tb2RlbC54K2xpZnREaXNwbGF5V2lkdGgqLjQ0Knpvb207XG4gICB5PW1vZGVsLnkrLjcrMS4wKnpvb207XG4gIH1cbiAgaWYobW9kZWwucWE/LmNhbWVyYSl7KHt3LHgseX09bW9kZWwucWEuY2FtZXJhKTt9XG4gIGlmKG1vZGVsLmVuY291bnRlcil7cGFub3JhbWE9ZmFsc2U7aWYobW9kZWwuZW5jb3VudGVyLnN0YWdlIT09J2xlYXZpbmcnKSh7dyx4LHl9PW1vZGVsLmVuY291bnRlci5jYW1lcmEpO31cbiAgaWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0JyYmKG1vZGVsLmJhckFycml2YWx8fG1vZGVsLnRyYW5zaXRpb24/LmJhckFycml2YWwpKXg9LjY1O1xuICBpZighcGFub3JhbWEpKHt3LHgseX09Z2xvYmFsLkx1bmFPdXRzaWRlUmVzaWRlbnRzLmZyYW1lKG1vZGVsLHt3LHgseX0pKTtcbiAgaWYocGFub3JhbWEpe3c9VklFV1BPSU5ULndpZHRoO3g9VklFV1BPSU5ULng7eT0tMS40OCt3KjcyMC8xMjgwLzI7fVxuICAvLyBLZWVwIGVuZHBvaW50IFBQVSBhbGlnbm1lbnQgd2hpbGUgdGhlIHpvb20gZm9sbG93cyB0aGUgb3JpZ2luYWwgc21vb3RoXG4gIC8vIGNpbmVtYXRpYyBjdXJ2ZS4gUXVhbnRpemluZyB0aGlzIG1vdmluZyB0YXJnZXQgY2F1c2VkIDN4IC0+IDJ4IC0+IDF4IGN1dHMuXG4gIC8vIFNjYWxlIHRoZSBvcmlnaW5hbCAqdmlzaWJsZSogcGFub3JhbWEsIG5vdCBpdHMgcXVhbnRpemVkIGxvZ2ljYWwgd2lkdGguXG4gIC8vIFRoZSB0aWdodGVyIDIvMyBmcmFtaW5nIGlzIG5vdyAxLjN4IHdpZGVyLCB3aXRob3V0IGEgUFBVIHNuYXBwaW5nIGp1bXAuXG4gIC8vIE9ubHkgWSB2aWV3aW5nIHVzZXMgdGhpcyBmcmFtaW5nOyBub3JtYWwvbGlmdCBQUFUgZW5kcG9pbnRzIHN0YXkgaW50YWN0LlxuICBjb25zdCBwaXhlbEdvYWw9cGFub3JhbWE/Z2xvYmFsLkx1bmFQaXhlbENhbWVyYS5zZXR0bGVkV2lkdGgoVklFV1BPSU5ULnByZXZpb3VzV2lkdGgsc3VyZmFjZSkqVklFV1BPSU5ULnJhbmdlU2NhbGU6dz09PWxpZnRXaWR0aD9saWZ0RGlzcGxheVdpZHRoOmdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEuc2V0dGxlZFdpZHRoKHcsc3VyZmFjZSk7XG4gIGlmKG1vZGVsLnNjZW5lIT09J3N0cmVldCd8fG1vZGVsLnJpZGV8fG1vZGVsLmVuY291bnRlcnx8bW9kZWwucWEpcGFub3JhbWFUd2Vlbj1mYWxzZTtcbiAgY29uc3QgcmF0ZT1wYW5vcmFtYXx8cGFub3JhbWFUd2Vlbj9WSUVXUE9JTlQuZWFzZVJhdGU6NTtcbiAgcGl4ZWxXaWR0aD1nbG9iYWwuTHVuYVBpeGVsQ2FtZXJhLmFwcHJvYWNoV2lkdGgocGl4ZWxXaWR0aCxwaXhlbEdvYWwsZHQqcmF0ZS81KTtcbiAgaWYoIW1vZGVsLnFhKXtpZihtb2RlbC5zY2VuZT09PSdob21lJyl4PWNsYW1wKHgsLjM0LDEuMTQpO2Vsc2UgeD1jbGFtcCh4LC0yMi4yNSt3LzIsNi41NS13LzIpO31cbiAgLy8gQ29uc3RyYWluIHRoZSB2aXNpYmxlIGJvdHRvbSwgbm90IGp1c3QgdGhlIGNhbWVyYSBjZW50ZXIsIGR1cmluZyB6b29tLlxuICBjb25zdCBmbG9vcj1kYXRhLnNjZW5lcy5zdHJlZXQubm9kZXMuZmluZChuPT5uLm5hbWU9PT0nMUYgRmxvb3InKS55Ky4wMjtcbiAgaWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0Jyl5PU1hdGgubWF4KHksZmxvb3Irdyo3MjAvMTI4MC8yKTtcbiAgY29uc3QgdD0xLU1hdGguZXhwKC1kdCpyYXRlKTtjYW0ueD1taXgoY2FtLngseCx0KTtjYW0ueT1taXgoY2FtLnkseSx0KTtjYW0udz1taXgoY2FtLncsdyx0KTtcbiAgaWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0JyljYW0ueT1NYXRoLm1heChjYW0ueSxmbG9vcitjYW0udyo3MjAvMTI4MC8yKTtcbiAgaWYoIXBhbm9yYW1hJiZNYXRoLmFicyhwaXhlbFdpZHRoLXBpeGVsR29hbCk8LjAwMSYmTWF0aC5hYnMoY2FtLnctdyk8LjAwMSYmTWF0aC5hYnMoY2FtLngteCk8LjAwMSYmTWF0aC5hYnMoY2FtLnkteSk8LjAwMSlwYW5vcmFtYVR3ZWVuPWZhbHNlO1xuICBpZihtb2RlbC5lbmNvdW50ZXIpbW9kZWwuZW5jb3VudGVyLmNhbWVyYVJlYWR5PU1hdGguYWJzKGNhbS54LXgpPC4wMTUmJk1hdGguYWJzKGNhbS55LXkpPC4wMTUmJk1hdGguYWJzKGNhbS53LXcpPC4wMTU7XG4gfVxuIGZ1bmN0aW9uIHBvc2l0aW9uKHgseSl7cmV0dXJuIGdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEucG9zaXRpb24oeCx5LHJlbmRlckNhbSk7fVxuIGZ1bmN0aW9uIGRyYXdTcHJpdGUoc3AseCx5LHN4PTEsc3k9MSxmbGlwPWZhbHNlLGFscGhhPTEsZ2xvdz1mYWxzZSl7Y29uc3QgaW1nPWltYWdlcy5nZXQoc3AuYXNzZXQpO2lmKCFpbWcpcmV0dXJuO2NvbnN0IHA9Z2xvYmFsLkx1bmFQaXhlbENhbWVyYS5zcHJpdGUoc3AseCx5LHN4LHN5LGZsaXAscmVuZGVyQ2FtLHN1cmZhY2UpLHc9cC53LGg9cC5oLHJheVJlYWNoPXJlbmRlcmluZ05vZGU/LmxpZ2h0Um90YXRpb24/TWF0aC5hYnMoaCpNYXRoLnNpbihyZW5kZXJpbmdOb2RlLmxpZ2h0Um90YXRpb24pKTowO2lmKHAueCt3K3JheVJlYWNoPDB8fHAueC13LXJheVJlYWNoPjEyODB8fHAueStoPDB8fHAueS1oPjcyMClyZXR1cm47Y3R4LnNhdmUoKTtjdHguZ2xvYmFsQWxwaGE9YWxwaGE7aWYoZ2xvdyljdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uPSdzY3JlZW4nO2N0eC50cmFuc2xhdGUocC54LHAueSk7aWYocmVuZGVyaW5nTm9kZT8ubGlnaHRSb3RhdGlvbiljdHgucm90YXRlKC1yZW5kZXJpbmdOb2RlLmxpZ2h0Um90YXRpb24pO2N0eC5zY2FsZSgoc3g8MD8tMToxKSooZmxpcD8tMToxKSxzeTwwPy0xOjEpO2lmKHJlbmRlcmluZ05vZGU/Lm5lb24pZ2xvYmFsLkx1bmFTdHJlZXRTaWducy5wYWludChjdHgsaW1nLHNwLHcsaCxyZW5kZXJpbmdOb2RlLmlkLG1vZGVsLnRpbWUsZ2xvYmFsLm1hdGNoTWVkaWE/LihcIihwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpXCIpLm1hdGNoZXMpO2Vsc2UgY3R4LmRyYXdJbWFnZShpbWcsc3AueCxzcC55LHNwLncsc3AuaCwtdypzcC5waXZvdC54LC1oKigxLXNwLnBpdm90LnkpLHcsaCk7aWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0JyYmIW1vZGVsLnFhKWdsb2JhbC5MdW5hV2FsbExpZ2h0aW5nPy5wYWludFNwcml0ZShjdHgscmVuZGVyaW5nTm9kZT8ubmFtZSxpbWcsc3AsdyxoKTtpZihtb2RlbC5zY2VuZT09PSdzdHJlZXQnKWdsb2JhbC5MdW5hU2lnblNjYW5saW5lcz8ucGFpbnRTcHJpdGUoY3R4LHJlbmRlcmluZ05vZGU/Lm5hbWUsc3AsdyxoLG1vZGVsLnRpbWUsZ2xvYmFsLm1hdGNoTWVkaWE/LignKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSknKS5tYXRjaGVzKTtpZihtb2RlbC5zY2VuZT09PSdzdHJlZXQnJiYhbW9kZWwucWEpZ2xvYmFsLkx1bmFWZW50U3RlYW0/LnBhaW50U3ByaXRlKGN0eCxyZW5kZXJpbmdOb2RlPy5uYW1lLHNwLHcsaCxtb2RlbC50aW1lLGdsb2JhbC5tYXRjaE1lZGlhPy4oJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJykubWF0Y2hlcyk7aWYocmVuZGVyaW5nTm9kZT8ubmFtZT09PSdCX09iZWN0cycpZ2xvYmFsLkx1bmFXaXJlU3Bhcms/LnBhaW50KGN0eCxpbWcsaW1hZ2VzLmdldCgnc3RyZWV0LXdpcmUtc3BhcmsnKSxzcCx3LGgsbW9kZWwudGltZSxnbG9iYWwubWF0Y2hNZWRpYT8uKCcocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKScpLm1hdGNoZXMpO2lmKG1vZGVsLnNjZW5lPT09J3N0cmVldCcmJiFtb2RlbC5xYSlnbG9iYWwuTHVuYUJhcnJlbEZpcmU/LnBhaW50U3ByaXRlKGN0eCxyZW5kZXJpbmdOb2RlPy5uYW1lLHNwLHcsaCxtb2RlbC50aW1lLGdsb2JhbC5tYXRjaE1lZGlhPy4oJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJykubWF0Y2hlcyk7Z2xvYmFsLkx1bmFMaWZ0RHVzdD8ucGFpbnRTcHJpdGUoY3R4LG1vZGVsLHJlbmRlcmluZ05vZGU/Lm5hbWUsc3AsdyxoLGdsb2JhbC5tYXRjaE1lZGlhPy4oJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJykubWF0Y2hlcyk7Z2xvd1JlbmRlcmVyLnBhaW50KGN0eCxpbWcsc3AscmVuZGVyaW5nTm9kZSx4LHksdyxoKTtjdHgucmVzdG9yZSgpO31cbiBmdW5jdGlvbiByZW5kZXJOb2RlKG4pe2NvbnN0IHByZXZpb3VzPXJlbmRlcmluZ05vZGU7cmVuZGVyaW5nTm9kZT1uO3RyeXtyZW5kZXJTY2VuZU5vZGUobik7fWZpbmFsbHl7cmVuZGVyaW5nTm9kZT1wcmV2aW91czt9fVxuIGZ1bmN0aW9uIHJlbmRlclNjZW5lTm9kZShuKXtpZihnbG9iYWwuTHVuYU91dHNpZGVCZWdnYXI/LmRyYXdOb2RlKG1vZGVsLG4sZHJhd1Nwcml0ZSkpcmV0dXJuO2lmKGdsb2JhbC5MdW5hT3V0c2lkZVJlc2lkZW50cy5kcmF3Tm9kZShtb2RlbCxuLGRyYXdTcHJpdGUsY3R4LHBvc2l0aW9uKSlyZXR1cm47aWYoZ2xvYmFsLkx1bmFPdXRzaWRlRW5jb3VudGVycy5kcmF3Tm9kZShtb2RlbCxuLGRyYXdTcHJpdGUpKXJldHVybjtpZighZ2xvYmFsLkx1bmFPdXRzaWRlQ29udGVudC52aXNpYmxlTm9kZShtb2RlbCxuKSlyZXR1cm47aWYobi5uYW1lPT09J3NoaWJhJyl7aWYoZ2xvYmFsLkx1bmFPdXRzaWRlU2hvcC52aXNpYmxlKG1vZGVsKSl7Y29uc3QgYT1kYXRhLmFuaW1hdGlvbnMuc2hpYmE7ZHJhd1Nwcml0ZShhLmZyYW1lc1tNYXRoLmZsb29yKG1vZGVsLnRpbWUqYS5mcHMpJWEuZnJhbWVzLmxlbmd0aF0sbi54LG4ueSxuLnN4LG4uc3ksbi5mbGlwKTt9cmV0dXJuO31pZihuLm5hbWU9PT0nU2FtaG8nJiZbMiwzXS5pbmNsdWRlcyhtb2RlbC5jb25maWcuZGF5KSl7Z2xvYmFsLkx1bmFPdXRzaWRlU2FtaG9Db21tdXRlLmRyYXcobW9kZWwsZHJhd1Nwcml0ZSk7cmV0dXJuO31pZihuLm5hbWU9PT0nU2FtaG8nJiZnbG9iYWwubHVuYUNhbXBhaWduPy5zZXNzaW9uLmFjdGl2ZSYmbW9kZWwuY29uZmlnLmZsb3c9PT0naW4nJiZtb2RlbC5jb25maWcuZGF5Pj0yKXtjb25zdCBwaGFzZT1tb2RlbC50aW1lJTQsZnJhbWU9cGhhc2U8LjM/TWF0aC5mbG9vcihwaGFzZSoxMCklMzowO2RyYXdTcHJpdGUoey4uLm4uc3ByaXRlLHg6ZnJhbWUqODR9LG4ueCxuLnksbi5zeCxuLnN5LGdsb2JhbC5MdW5hT3V0c2lkZUFtYmllbnQuZmFjZVRhcmdldChuLngsbW9kZWwueCkpO3JldHVybjt9aWYoIW4uYWN0aXZlfHxuLm5hbWU9PT0nTHVuYSd8fG4ubmFtZT09PSdTcXVhcmUnfHwvU0FNSE98c2FtaG98U2FtaG98QnViaS8udGVzdChuLm5hbWUpKXJldHVybjtpZihuLmFtYmllbnQmJiFnbG9iYWwuTHVuYU91dHNpZGVBbWJpZW50LnZpc2libGUobW9kZWwsbikpcmV0dXJuO1xuICBsZXQgeT1uLnk7aWYobW9kZWwuc2NlbmU9PT0nc3RyZWV0JyYmbi5hbmNlc3RyeS5pbmNsdWRlcygnRWxldmF0b3InKSYmWydFbGV2YXRvcicsJ0VsZXZhdG9yIEZvcmUnLCdFbGV2YXRvciBEb29yJ10uaW5jbHVkZXMobi5uYW1lKSl5Kz1tb2RlbC5lbGV2YXRvclktQk9UVE9NO1xuICAvLyBLZWVwIHRoZSBpbXBvcnRlZCBzcHJpdGUgY3V0b3V0cyBhbmQgd29ybGQgY29vcmRpbmF0ZXM7IG9ubHkgdGhlIGRlYnVnIHN3YXRjaGVzIGF0IHRoZSByaWdodCBvZiB0aGUgaG91c2UgYXRsYXMgYXJlIG1hc2tlZCBieSByb29tIGJvdW5kcy5cbiAgY29uc3QgbGlnaHQ9bi5saWdodHx8L0NpdHkuKkxpZ2h0Ly50ZXN0KG4ubmFtZSk7bGV0IHNwPW4uYW1iaWVudD9nbG9iYWwuTHVuYU91dHNpZGVBbWJpZW50LmZyYW1lKG4sbW9kZWwudGltZSk6bi5zcHJpdGU7Y29uc3QgZmFjaW5nPWdsb2JhbC5MdW5hT3V0c2lkZUFtYmllbnQuZmFjaW5nKG4sbW9kZWwpLGFydD1zdHJlZXRQYXJhbGxheChuLHJlbmRlckNhbSxtb2RlbCk7ZHJhd1Nwcml0ZShzcCxhcnQueCxhcnQueSsoeS1uLnkpLG4uc3gsbi5zeSxmYWNpbmcsbi5hbHBoYT8/KGxpZ2h0Py4yNjoxKSxsaWdodCk7XG4gfVxuIGZ1bmN0aW9uIGRyYXdFbnRyYW5jZUN1ZSgpe1xuICBpZighZmlyc3RDb21tdXRlRW50cmFuY2VDdWUobW9kZWwpKXJldHVybjtcbiAgY29uc3QgZG9vcj1kYXRhLnNjZW5lcy5zdHJlZXQubm9kZXMuZmluZChuPT5uLm5hbWU9PT0nQmFyIFNwYXduIFBvaW50Jyk7aWYoIWRvb3IpcmV0dXJuO1xuICBjb25zdCBrPTEyODAvcmVuZGVyQ2FtLncscD1wb3NpdGlvbihkb29yLngsLS45OCk7aWYocC54Ky4zKms8MHx8cC54LS4zKms+MTI4MClyZXR1cm47XG4gIGNvbnN0IHN0aWxsPWdsb2JhbC5tYXRjaE1lZGlhPy4oJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJykubWF0Y2hlcyx0PXN0aWxsPzA6bW9kZWwudGltZTtcbiAgY29uc3QgZHJpZnQ9c3RpbGw/MDpNYXRoLnNpbih0Kk1hdGguUEkqMi8uOSkqLjAxMiprO1xuICBjdHguc2F2ZSgpO2N0eC5saW5lQ2FwPSdyb3VuZCc7Y3R4LmxpbmVKb2luPSdyb3VuZCc7XG4gIC8vIFRyYWNlIHRoZSBkb29yd2F5IGJlbG93IHRoZSBzaWduLCBpbiB0aGUgZW50cmFuY2Ugc3ByaXRlJ3MgcGl4ZWwgc3BhY2UuXG4gIC8vIEtlZXAgdGhlIGZyYW1lIGZpeGVkIHRvIHRoZSBhcnQgKG9ubHkgdGhlIGFycm93IG51ZGdlcyksIGJlaGluZCBMdW5hLlxuICBjb25zdCBzcD1kb29yLnNwcml0ZSxvdXRsaW5lPVtbMiwxNV0sWzM2LDE1XSxbMzYsNjZdLFsyLDY2XSxbMiwxNV1dO1xuICBjdHguc3Ryb2tlU3R5bGU9JyNjOWZmZmYnO2N0eC5saW5lV2lkdGg9ayouMDA4O2N0eC5nbG9iYWxBbHBoYT0uOTY7XG4gIGN0eC5zaGFkb3dDb2xvcj0nIzRhZTVmNCc7Y3R4LnNoYWRvd0JsdXI9NyprLzI2Ni42Njc7XG4gIGN0eC5iZWdpblBhdGgoKTtvdXRsaW5lLmZvckVhY2goKFt4LHldLGkpPT57XG4gICBjb25zdCBxPXBvc2l0aW9uKGRvb3IueCsoeC1zcC53KnNwLnBpdm90LngpKmRvb3Iuc3gvc3AucHB1LGRvb3IueSsoc3AuaCooMS1zcC5waXZvdC55KS15KSpkb29yLnN5L3NwLnBwdSk7XG4gICBpZihpKWN0eC5saW5lVG8ocS54LHEueSk7ZWxzZSBjdHgubW92ZVRvKHEueCxxLnkpO1xuICB9KTtjdHguc3Ryb2tlKCk7XG4gIC8vIE1hdGNoIHRoZSBiYXIgdHV0b3JpYWwncyBzaW5nbGUsIHJvdW5kLWNhcHBlZCBjeWFuIGFycm93IGFuZCBnZW50bGUgbnVkZ2UuXG4gIGN0eC50cmFuc2xhdGUocC54LHAueS1kcmlmdCk7Y3R4LnNjYWxlKGsvMjY2LjY2NyxrLzI2Ni42NjcpO1xuICBjdHguc3Ryb2tlU3R5bGU9JyNjOWZmZmYnO2N0eC5saW5lV2lkdGg9My41O2N0eC5nbG9iYWxBbHBoYT0uOTg7XG4gIGN0eC5zaGFkb3dDb2xvcj0nIzRhZTVmNCc7Y3R4LnNoYWRvd0JsdXI9NjtcbiAgY3R4LmJlZ2luUGF0aCgpO2N0eC5tb3ZlVG8oMCwyOCk7Y3R4LmxpbmVUbygwLDApO2N0eC5tb3ZlVG8oLTEwLDEwKTtjdHgubGluZVRvKDAsMCk7Y3R4LmxpbmVUbygxMCwxMCk7Y3R4LnN0cm9rZSgpO1xuICBjdHgucmVzdG9yZSgpO1xuIH1cbiBmdW5jdGlvbiBpbnRlcmFjdGlvblRhcmdldCgpe2NvbnN0IG09bW9kZWw7cmV0dXJuIG0mJiFtLnBhdXNlZCYmIWxvYWRpbmcmJiFsb2FkRXJyb3ImJiFkZXZPcGVuJiYhaGludE9wZW4mJiFtLmNvbnRyb2xzVHV0b3JpYWwmJiFtLmRpYWxvZyYmIW0uc3RvcnkuYmxvY2tpbmcmJiFnbG9iYWwubHVuYUNhbXBhaWduPy5ibG9ja2luZz9tLm5lYXI6bnVsbDt9XG4gZnVuY3Rpb24gZHJhdygpe2lmKCFjdHh8fCFtb2RlbClyZXR1cm47aWYoc3VyZmFjZS5kcHIhPT1kZXZpY2VQaXhlbFJhdGlvKWZpdCgpO3JlbmRlckNhbT1nbG9iYWwuTHVuYVBpeGVsQ2FtZXJhLnZpZXcoY2FtLHN1cmZhY2Use3NjZW5lOm1vZGVsLnNjZW5lLHFhOiEhbW9kZWwucWEsZGlzcGxheVdpZHRoOnBpeGVsV2lkdGgsZmxvb3I6ZGF0YS5zY2VuZXMuc3RyZWV0Lm5vZGVzLmZpbmQobj0+bi5uYW1lPT09JzFGIEZsb29yJykueSsuMDJ9KTtjdHguc2V0VHJhbnNmb3JtKHN1cmZhY2UuZmFjdG9yLDAsMCxzdXJmYWNlLmZhY3RvciwwLDApO2dsb3dSZW5kZXJlci5iZWdpbihtb2RlbC5xYT9udWxsOmludGVyYWN0aW9uVGFyZ2V0KCksbW9kZWwpO2N0eC5pbWFnZVNtb290aGluZ0VuYWJsZWQ9ZmFsc2U7Y3R4LmZpbGxTdHlsZT0nIzA5MGQxOSc7Y3R4LmZpbGxSZWN0KDAsMCwxMjgwLDcyMCk7aWYobG9hZGluZ3x8bG9hZEVycm9yKXJldHVybjtcbiAgaWYobW9kZWwucWEpe2dsb2JhbC5MdW5hT3V0c2lkZVFBLmRyYXcoe206bW9kZWwsY3R4LHBvc2l0aW9uLHNwcml0ZTpkcmF3U3ByaXRlLGRhdGEscGxheWVyOigpPT57Y29uc3QgYT1kYXRhLmFuaW1hdGlvbnNbbW9kZWwuYW5pbV07ZHJhd1Nwcml0ZShhLmZyYW1lc1tNYXRoLmZsb29yKG1vZGVsLmFuaW1UaW1lKmEuZnBzKSVhLmZyYW1lcy5sZW5ndGhdLG1vZGVsLngsbW9kZWwueSwxLDEsbW9kZWwuZmFjaW5nPjApO319KTtpZihtb2RlbC50cmFuc2l0aW9uKXtjdHguZmlsbFN0eWxlPSdyZ2JhKDYsMTAsMTgsJytNYXRoLm1heCgwLDEtTWF0aC5hYnMobW9kZWwudHJhbnNpdGlvbi50aW1lLS4zOCkvLjQ3KSsnKSc7Y3R4LmZpbGxSZWN0KDAsMCwxMjgwLDcyMCk7fXJldHVybjt9XG4gIGNvbnN0IG5vZGVzPWRhdGEuc2NlbmVzW21vZGVsLnNjZW5lXS5ub2Rlcy5zbGljZSgpLnNvcnQoKGEsYik9PmEubGF5ZXItYi5sYXllcnx8YS5vcmRlci1iLm9yZGVyfHxiLnotYS56KTtcbiAgaWYobW9kZWwuc2NlbmU9PT0naG9tZScpe2NvbnN0IGJnPW5vZGVzLmZpbmQobj0+bi5uYW1lPT09J21haW5fYmcnKTtpZihiZylyZW5kZXJOb2RlKGJnKTtub2Rlcy5maWx0ZXIobj0+bi5uYW1lIT09J21haW5fYmcnJiZuLm5hbWUhPT0nRm9yZUZvcmVfT2JqZWN0JykuZm9yRWFjaChyZW5kZXJOb2RlKTt9XG4gIGNvbnN0IGRyYXdQbGF5ZXI9KCk9Pntjb25zdCBhbmltPWRhdGEuYW5pbWF0aW9uc1ttb2RlbC5hbmltXSxmcmFtZT1hbmltLmZyYW1lc1tNYXRoLmZsb29yKG1vZGVsLmFuaW1UaW1lKmFuaW0uZnBzKSVhbmltLmZyYW1lcy5sZW5ndGhdO2RyYXdTcHJpdGUoZnJhbWUsbW9kZWwueCxtb2RlbC55LDEsMSxtb2RlbC5mYWNpbmc+MCk7fTtcbiAgaWYobW9kZWwuc2NlbmU9PT0naG9tZScpe2RyYXdQbGF5ZXIoKTtub2Rlcy5maWx0ZXIobj0+bi5uYW1lPT09J0ZvcmVGb3JlX09iamVjdCcpLmZvckVhY2gocmVuZGVyTm9kZSk7fVxuICBlbHNlIHtcbiAgIGxldCBmYXJUcmFmZmljPWZhbHNlLG1pZFRyYWZmaWM9ZmFsc2UsbmVhclRyYWZmaWM9ZmFsc2UsZ3JvdW5kUmFpbj1mYWxzZTtcbiAgIGZvcihjb25zdCBuIG9mIHN0cmVldERyYXdPcmRlcihub2Rlcykpe1xuICAgIC8vIEdyb3VuZCBpbXBhY3RzIGJlbG9uZyB0byB0aGUgcm9hZCwgYmVoaW5kIHRoZSBmcm9udG1vc3Qgc2lsaG91ZXR0ZXNcbiAgICAvLyAoYW5kIGVsZXZhdG9yIGZyb250KS4gRmFsbGluZyByYWluIGdldHMgYSBzZXBhcmF0ZSBmb3JlZ3JvdW5kIHBhc3MuXG4gICAgaWYoIWdyb3VuZFJhaW4mJm4ubGF5ZXI+PTEwKXtnbG9iYWwuTHVuYU91dHNpZGVSYWluPy5kcmF3KGN0eCxtb2RlbCxyZW5kZXJDYW0scG9zaXRpb24sJ3NwbGFzaGVzJyk7Z3JvdW5kUmFpbj10cnVlO31cbiAgICAvLyBUcmFmZmljIGlzIHBhcnQgb2YgdGhlIHNjZW5lLCBub3QgYW4gb3ZlcmxheTogc2t5bGluZSBzaWxob3VldHRlcyxcbiAgICAvLyBmb3JlZ3JvdW5kIHNob3BzIGFuZCB0aGUgcmVzaWRlbmNlL2xpZnQgbmF0dXJhbGx5IGNvdmVyIGl0IGFmdGVyd2FyZHMuXG4gICAgaWYoIWZhclRyYWZmaWMmJm4ubmFtZT09PSdDX0JhY2tfQnVpbGRpbmdfMicpe2dsb2JhbC5MdW5hT3V0c2lkZVRyYWZmaWM/LmRyYXcoY3R4LG1vZGVsLHJlbmRlckNhbSxwb3NpdGlvbiwnZmFyJyk7ZmFyVHJhZmZpYz10cnVlO31cbiAgICBpZighbWlkVHJhZmZpYyYmbi5sYXllcj49Myl7Z2xvYmFsLkx1bmFPdXRzaWRlVHJhZmZpYz8uZHJhdyhjdHgsbW9kZWwscmVuZGVyQ2FtLHBvc2l0aW9uLCdtaWQnKTttaWRUcmFmZmljPXRydWU7fVxuICAgIGlmKCFuZWFyVHJhZmZpYyYmbi5sYXllcj49Nil7Z2xvYmFsLkx1bmFPdXRzaWRlVHJhZmZpYz8uZHJhdyhjdHgsbW9kZWwscmVuZGVyQ2FtLHBvc2l0aW9uLCduZWFyJyk7bmVhclRyYWZmaWM9dHJ1ZTt9XG4gICAgaWYobi5uYW1lPT09J0x1bmEnKXtkcmF3RW50cmFuY2VDdWUoKTtnbG9iYWwuTHVuYU91dHNpZGVUaHVnPy5kcmF3KG1vZGVsLGRyYXdTcHJpdGUsY3R4LHBvc2l0aW9uKTtnbG9iYWwuTHVuYU91dHNpZGVOb3Rpb24/LmRyYXcobW9kZWwsZHJhd1Nwcml0ZSxjdHgscG9zaXRpb24pO2RyYXdQbGF5ZXIoKTt9ZWxzZSByZW5kZXJOb2RlKG4pO1xuICAgfVxuICB9XG4gIGlmKG1vZGVsLnNjZW5lPT09J2hvbWUnKXtjb25zdCBlZGdlPXBvc2l0aW9uKDMuNTM3LDApLng7Y3R4LmZpbGxTdHlsZT0nIzA5MGQxOSc7Y3R4LmZpbGxSZWN0KGVkZ2UsMCxNYXRoLm1heCgwLDEyODAtZWRnZSksNzIwKTt9XG4gIGdsb2JhbC5MdW5hT3V0c2lkZVJhaW4/LmRyYXcoY3R4LG1vZGVsLHJlbmRlckNhbSxwb3NpdGlvbiwnZHJvcHMnKTtcbiAgY29uc3Qgc2hhZGU9Y3R4LmNyZWF0ZUxpbmVhckdyYWRpZW50KDAsMCwwLDcyMCk7c2hhZGUuYWRkQ29sb3JTdG9wKDAsJ3JnYmEoNCw4LDE2LC4yNSknKTtzaGFkZS5hZGRDb2xvclN0b3AoLjI1LCdyZ2JhKDQsOCwxNiwwKScpO3NoYWRlLmFkZENvbG9yU3RvcCguODUsJ3JnYmEoNCw4LDE2LDApJyk7c2hhZGUuYWRkQ29sb3JTdG9wKDEsJ3JnYmEoNCw4LDE2LC4zKScpO2N0eC5maWxsU3R5bGU9c2hhZGU7Y3R4LmZpbGxSZWN0KDAsMCwxMjgwLDcyMCk7XG4gIGlmKG1vZGVsLnRyYW5zaXRpb24pe2NvbnN0IHQ9bW9kZWwudHJhbnNpdGlvbi50aW1lLGFscGhhPXQ8LjM4P3QvLjM4OjEtKHQtLjM4KS8uNDc7Y3R4LmZpbGxTdHlsZT1gcmdiYSg2LDEwLDE4LCR7Y2xhbXAoYWxwaGEsMCwxKX0pYDtjdHguZmlsbFJlY3QoMCwwLDEyODAsNzIwKTt9XG4gfVxuIGNvbnN0IGNvbnRyb2xzRGlzbWlzc0tleXM9bmV3IFNldCgpO1xuIGxldCBjb250cm9sc1VubG9ja0F0PTAsY29udHJvbHNTdGVwPTA7XG4gZnVuY3Rpb24gc2hvd0NvbnRyb2xzVHV0b3JpYWwoKXtpZighYWN0aXZlfHxtb2RlbC5zY2VuZSE9PSdob21lJ3x8bW9kZWwuY29uZmlnLmRheSE9PTB8fG1vZGVsLmNvbmZpZy5mbG93IT09J2luJ3x8bW9kZWwuY29udHJvbHNUdXRvcmlhbClyZXR1cm47Y2xlYXJJbnB1dCgpO2NvbnRyb2xzU3RlcD0wO2NvbnRyb2xzVW5sb2NrQXQ9cGVyZm9ybWFuY2Uubm93KCkrMjAwMDttb2RlbC5jb250cm9sc1R1dG9yaWFsPXRydWU7dXBkYXRlSFVEKCk7aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1jb250cm9scy10dXRvcmlhbCcpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fVxuIGZ1bmN0aW9uIGRpc21pc3NDb250cm9sc1R1dG9yaWFsKCl7XG4gIGlmKCFtb2RlbC5jb250cm9sc1R1dG9yaWFsfHxtb2RlbC5wYXVzZWR8fGxvYWRpbmd8fGxvYWRFcnJvcnx8ZGV2T3Blbnx8cGVyZm9ybWFuY2Uubm93KCk8Y29udHJvbHNVbmxvY2tBdClyZXR1cm47XG4gIGlmKGNvbnRyb2xzU3RlcD09PTApe2NvbnRyb2xzU3RlcD0xO2NvbnRyb2xzVW5sb2NrQXQ9cGVyZm9ybWFuY2Uubm93KCkrMzAwO2NsZWFySW5wdXQoKTt1cGRhdGVIVUQoKTtob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWNvbnRyb2xzLXR1dG9yaWFsJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtyZXR1cm47fVxuICBnbG9iYWwuTHVuYUNvbnRyb2xzVHV0b3JpYWwuc3RvcCgpO1xuICBtb2RlbC5jb250cm9sc1R1dG9yaWFsPWZhbHNlO2NsZWFySW5wdXQoKTtcbiAgY29uc3QgY2FtcGFpZ249Z2xvYmFsLmx1bmFDYW1wYWlnbjtcbiAgaWYobW9kZWwuaXNGaXJzdENvbW11dGUoKSYmY2FtcGFpZ24/LmFjdGl2ZSYmZ2xvYmFsLkx1bmFTdG9yeU5vdGljZXMuc3RhcnRHb2FsKGdsb2JhbC5iYXJHYW1lLnByb2dyZXNzLCdmaXJzdF9jb21tdXRlJywn7LKrIOy2nOq3vO2VmOq4sCEnKSYmY2FtcGFpZ24uc2Vzc2lvbi5jYXJyeSljYW1wYWlnbi5zZXNzaW9uLmNhcnJ5Lm9iamVjdGl2ZXM9c3RydWN0dXJlZENsb25lKGdsb2JhbC5iYXJHYW1lLnByb2dyZXNzLm9iamVjdGl2ZXMpO1xuICB1cGRhdGVIVUQoKTtob3N0LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtcbiB9XG4gZnVuY3Rpb24gY29udHJvbHNUdXRvcmlhbEtleShlKXtcbiAgaWYoIWFjdGl2ZSlyZXR1cm4gZmFsc2U7XG4gIC8vIENvbnN1bWUgdGhlIGRpc21pc3Npbmcga2V5IHVudGlsIHJlbGVhc2UsIGluY2x1ZGluZyBtb3ZlbWVudCBrZXkgcmVwZWF0cy5cbiAgaWYoY29udHJvbHNEaXNtaXNzS2V5cy5oYXMoZS5jb2RlKSlyZXR1cm4gdHJ1ZTtcbiAgaWYoIW1vZGVsLmNvbnRyb2xzVHV0b3JpYWx8fG1vZGVsLnBhdXNlZHx8bG9hZGluZ3x8bG9hZEVycm9yfHxkZXZPcGVuKXJldHVybiBmYWxzZTtcbiAgaWYoIWUucmVwZWF0KXtjb250cm9sc0Rpc21pc3NLZXlzLmFkZChlLmNvZGUpO2lmKGUuY29kZT09PSdLZXlFJyYmIWUubWV0YUtleSYmIWUuY3RybEtleSYmIWUuYWx0S2V5JiZwZXJmb3JtYW5jZS5ub3coKT49Y29udHJvbHNVbmxvY2tBdClkaXNtaXNzQ29udHJvbHNUdXRvcmlhbCgpO31cbiAgcmV0dXJuIHRydWU7XG4gfVxuIGZ1bmN0aW9uIHBhaW50Q29udHJvbHNUdXRvcmlhbCgpe1xuICBsZXQgcGFuZWw9aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1jb250cm9scy10dXRvcmlhbCcpO1xuICBpZihtb2RlbC5zY2VuZSE9PSdob21lJ3x8bW9kZWwuY29uZmlnLmZsb3chPT0naW4nfHxtb2RlbC5jb25maWcuZGF5IT09MCltb2RlbC5jb250cm9sc1R1dG9yaWFsPWZhbHNlO1xuICBpZihtb2RlbC5jb250cm9sc1R1dG9yaWFsJiYhcGFuZWwpe1xuICAgcGFuZWw9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VjdGlvbicpO3BhbmVsLmNsYXNzTmFtZT0nb3V0c2lkZS1jb250cm9scy10dXRvcmlhbCc7cGFuZWwuc2V0QXR0cmlidXRlKCdyb2xlJywnZGlhbG9nJyk7cGFuZWwuc2V0QXR0cmlidXRlKCdhcmlhLW1vZGFsJywndHJ1ZScpO3BhbmVsLnRhYkluZGV4PS0xO1xuICAgY29uc3Qgc2hhZGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7c2hhZGUuY2xhc3NOYW1lPSdvdXRzaWRlLWNvbnRyb2xzLXNoYWRlJztzaGFkZS5hcHBlbmQocGFuZWwpO2hvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtc3RhZ2UnKS5hcHBlbmQoc2hhZGUpO1xuICB9XG4gIGlmKCFwYW5lbClyZXR1cm47XG4gIGNvbnN0IHdhc1Zpc2libGU9cGFuZWwuZGF0YXNldC52aXNpYmxlPT09J3RydWUnO1xuICBwYW5lbC5oaWRkZW49IW1vZGVsLmNvbnRyb2xzVHV0b3JpYWx8fG1vZGVsLnBhdXNlZHx8bG9hZGluZ3x8ISFsb2FkRXJyb3J8fGRldk9wZW58fCEhbW9kZWwuZGlhbG9nfHxtb2RlbC5zdG9yeS5ibG9ja2luZztcbiAgcGFuZWwucGFyZW50RWxlbWVudC5oaWRkZW49cGFuZWwuaGlkZGVuO3BhbmVsLmRhdGFzZXQudmlzaWJsZT1TdHJpbmcoIXBhbmVsLmhpZGRlbik7XG4gIGlmKHBhbmVsLmhpZGRlbil7XG4gICBpZih3YXNWaXNpYmxlKWdsb2JhbC5MdW5hQ29udHJvbHNUdXRvcmlhbC5zdG9wKCk7XG4gICBpZighbW9kZWwuY29udHJvbHNUdXRvcmlhbClkZWxldGUgcGFuZWwuZGF0YXNldC5zdGVwO1xuICB9ZWxzZXtcbiAgIGlmKHBhbmVsLmRhdGFzZXQuc3RlcCE9PVN0cmluZyhjb250cm9sc1N0ZXApKXtcbiAgICBnbG9iYWwuTHVuYUNvbnRyb2xzVHV0b3JpYWwucmVuZGVyKHBhbmVsLGNvbnRyb2xzU3RlcCxpbWFnZXMsZGF0YSk7XG4gICAgY29uc3Qgc3RlcD1jb250cm9sc1N0ZXAsb3duZXI9bW9kZWw7XG4gICAgdm9pZCBnbG9iYWwuTHVuYUNvbnRyb2xzVHV0b3JpYWwucGxheSgoKT0+YWN0aXZlJiZtb2RlbD09PW93bmVyJiZtb2RlbC5jb250cm9sc1R1dG9yaWFsJiZjb250cm9sc1N0ZXA9PT1zdGVwJiYhcGFuZWwuaGlkZGVuKTtcbiAgIH1cbiAgIGNvbnN0IGxvY2tlZD1wZXJmb3JtYW5jZS5ub3coKTxjb250cm9sc1VubG9ja0F0O1xuICAgcGFuZWwuZGF0YXNldC5sb2NrZWQ9U3RyaW5nKGxvY2tlZCk7XG4gIH1cbiAgaG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1odWQnKS5pbmVydD0hcGFuZWwuaGlkZGVufHxtb2RlbC5wYXVzZWR8fGRldk9wZW58fCEhbW9kZWwuZGlhbG9nO1xuIH1cbiBmdW5jdGlvbiBwYWludEhvbWV3YXJkR3VpZGUoKXtcbiAgbGV0IGVsPWhvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtaG9tZXdhcmQtZ3VpZGUnKTtcbiAgaWYoIWVsKXtcbiAgIGVsPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2FzaWRlJyk7ZWwuY2xhc3NOYW1lPSdvdXRzaWRlLWhvbWV3YXJkLWd1aWRlJztlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCfqt4DqsIAg7JWI64K0Jyk7ZWwuZGF0YXNldC52aXNpYmxlPSdmYWxzZSc7ZWwuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsJ3RydWUnKTtcbiAgIGVsLmlubmVySFRNTD0nPGRpdiBjbGFzcz1cImhvbWV3YXJkLWNvcHlcIj48c3Ryb25nPuynkeycvOuhnCDqsIDquLA8L3N0cm9uZz48c21hbGw+PC9zbWFsbD48L2Rpdj48c3BhbiBjbGFzcz1cImhvbWV3YXJkLWRpcmVjdGlvblwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiPjxwYXRoIGQ9XCJNMTggMTJINk0xMSA3TDYgMTJMMTEgMTdcIi8+PC9zdmc+PC9zcGFuPic7XG4gICBob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLXN0YWdlJykuYXBwZW5kKGVsKTtcbiAgIC8vIEVzdGFibGlzaCB0aGUgb2ZmLXNjcmVlbiBwb3NpdGlvbiBiZWZvcmUgdGhlIGZpcnN0IGVudHJhbmNlIHRyYW5zaXRpb24uXG4gICBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgfVxuICBjb25zdCBtPW1vZGVsLGN1ZT1ob21ld2FyZEN1ZXMobSlbMF07XG4gIC8vIEtlZXAgZGlyZWN0aW9ucyB2aXNpYmxlIGR1cmluZyBjb252ZXJzYXRpb25zOyBib2FyZGluZyB0aGUgbGlmdCBoaWRlcyB0aGVtLlxuICAvLyBEbyBub3QgdXNlIGhpZGRlbi9kaXNwbGF5Om5vbmU6IHRoZSBleGl0IG11c3QgZmluaXNoIHNsaWRpbmcgb2ZmLXNjcmVlbi5cbiAgY29uc3QgdmlzaWJsZT0hIWN1ZSYmIW0ucGF1c2VkJiYhbG9hZGluZyYmIWxvYWRFcnJvciYmIWRldk9wZW4mJiFoaW50T3BlbiYmIXBhbm9yYW1hJiYhbS5jb250cm9sc1R1dG9yaWFsJiYhZ2xvYmFsLmx1bmFDYW1wYWlnbj8uYmxvY2tpbmc7XG4gIGlmKGVsLmRhdGFzZXQudmlzaWJsZSE9PVN0cmluZyh2aXNpYmxlKSl7ZWwuZGF0YXNldC52aXNpYmxlPVN0cmluZyh2aXNpYmxlKTtlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJyxTdHJpbmcoIXZpc2libGUpKTt9XG4gIGlmKCFjdWUpcmV0dXJuO1xuICBjb25zdCBhdFRhcmdldD1tLm5lYXI/LmlkPT09KGN1ZS5pZD09PSdsaWZ0Jz8nZWxldmF0b3InOidob21lJyk7XG4gIGNvbnN0IGRpcmVjdGlvbj1hdFRhcmdldD8ndXAnOmN1ZS5kaXJlY3Rpb247XG4gIGNvbnN0IGRldGFpbD1hdFRhcmdldD8oY3VlLmlkPT09J2xpZnQnPydFIMK3IOyXmOumrOuyoOydtO2EsOuhnCDsnITsuLUg7J2064+ZJzonRSDCtyDsp5Hsl5Ag65Ok7Ja06rCA6riwJyk6KGN1ZS5kaXJlY3Rpb249PT0nbGVmdCc/J+yZvOyqvSAnOifsmKTrpbjsqr0gJykrKGN1ZS5pZD09PSdsaWZ0Jz8n7JeY66as67Kg7J207YSw66GcIOydtOuPmSc6J+ynkSDsnoXqtazroZwg7J2064+ZJyk7XG4gIGlmKGVsLmRhdGFzZXQuZGlyZWN0aW9uIT09ZGlyZWN0aW9uKWVsLmRhdGFzZXQuZGlyZWN0aW9uPWRpcmVjdGlvbjtcbiAgZWwuZGF0YXNldC5kZXN0aW5hdGlvbj1jdWUuaWQ7XG4gIGNvbnN0IGNvcHk9ZWwucXVlcnlTZWxlY3Rvcignc21hbGwnKTtpZihjb3B5LnRleHRDb250ZW50IT09ZGV0YWlsKWNvcHkudGV4dENvbnRlbnQ9ZGV0YWlsO1xuIH1cbiBmdW5jdGlvbiB1cGRhdGVIVUQoKXtpZighaG9zdClyZXR1cm47bm90aWNlcz8udXBkYXRlKG1vZGVsKTtjb25zdCBtPW1vZGVsLG5lYXI9bS5uZWFyLGFjdGlvbkxhYmVsPWludGVyYWN0aW9uTGFiZWwobSxuZWFyKSxvdmVybGF5PWhvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtb3ZlcmxheScpLGh1ZD1ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWh1ZCcpLHZpZXdwb2ludD1hdFZpZXdwb2ludChtKSYmIXBhbm9yYW1hJiYhbG9hZGluZyYmIWxvYWRFcnJvciYmIW0ucGF1c2VkJiYhZGV2T3BlbjtcbiAgLy8gU2NyaXB0ZWQgcGF1c2VzIGJlbG9uZyB0byB0aGUgY2FtcGFpZ24vY3V0c2NlbmUsIG5vdCB0aGUgb3V0c2lkZSBFU0MgbWVudS5cbiAgY29uc3Qgc2hvd1BhdXNlTWVudT1tLnBhdXNlZCYmIWdsb2JhbC5sdW5hQ2FtcGFpZ24/LmJsb2NraW5nO1xuICBjb25zdCBzaWduYXR1cmU9SlNPTi5zdHJpbmdpZnkoW2xvYWRpbmcsbG9hZEVycm9yLG0ucGF1c2VkLHNob3dQYXVzZU1lbnUsbS5kaWFsb2csbS5zY2VuZSxtLmxldmVsLG5lYXI/LmlkLG5lYXI/LmxhYmVsLGFjdGlvbkxhYmVsLCEhbS5yaWRlLG0ucmlkZT8uY2FsbCxwYW5vcmFtYSx2aWV3cG9pbnQsbS5zdG9yeS5ibG9ja2luZyxtLmVuY291bnRlcj8uc3RhZ2UsZGV2T3BlbixoaW50T3Blbl0pO1xuICBpZihzaWduYXR1cmUhPT1odWRTaWduYXR1cmUpe2h1ZFNpZ25hdHVyZT1zaWduYXR1cmU7XG4gICBob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWR5bmFtaWMnKS5pbm5lckhUTUw9YDxidXR0b24gY2xhc3M9XCJvdXRzaWRlLWludGVyYWN0XCIgYXJpYS1sYWJlbD1cIiR7ZXNjKGFjdGlvbkxhYmVsKyhuZWFyPy5sYWJlbD8nIMK3ICcrbmVhci5sYWJlbDonJykpfVwiIGRhdGEtb3V0c2lkZS1hY3Rpb249XCJpbnRlcmFjdFwiICR7bmVhciYmIW0ucGF1c2VkPycnOidoaWRkZW4nfT48a2JkIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPkU8L2tiZD48c3Bhbj4ke2VzYyhhY3Rpb25MYWJlbCl9PC9zcGFuPjwvYnV0dG9uPjxidXR0b24gY2xhc3M9XCJvdXRzaWRlLXZpZXdwb2ludFwiIGFyaWEtbGFiZWw9XCIke3Bhbm9yYW1hPyfsoITqsr0g67O06riw7JeQ7IScIOuPjOyVhOyYpOq4sCc6J+qxsOumrCDsoITqsr0g67O06riwJ31cIiBhcmlhLXByZXNzZWQ9XCIke3Bhbm9yYW1hfVwiIGRhdGEtb3V0c2lkZS1hY3Rpb249XCJwYW5vcmFtYVwiICR7dmlld3BvaW50PycnOidoaWRkZW4nfT48a2JkIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPlk8L2tiZD48L2J1dHRvbj5gO1xuICAgbGV0IGJvZHk9Jyc7aWYobG9hZGluZylib2R5PSc8ZGl2IGNsYXNzPVwicmVzb3VyY2UtbG9hZGluZ1wiIHJvbGU9XCJzdGF0dXNcIiBhcmlhLWxhYmVsPVwi66Gc65SpIOykkVwiPjxzcGFuIGNsYXNzPVwicmVzb3VyY2UtbG9hZGluZy1jb3B5XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+66Gc65SpIOykkTxzcGFuIGNsYXNzPVwicmVzb3VyY2UtbG9hZGluZy1kb3RzXCI+PC9zcGFuPjwvc3Bhbj48L2Rpdj4nO1xuICAgZWxzZSBpZihsb2FkRXJyb3IpYm9keT0nPHNlY3Rpb24gY2xhc3M9XCJvdXRzaWRlLWRpYWxvZ1wiPjxoMj7rtojrn6zsmKTquLAg7Iuk7YyoPC9oMj48cD4nK2xvYWRFcnJvcisnPC9wPicrYnV0dG9uKCfri6Tsi5wg7Iuc64+EJywncmV0cnknKStidXR0b24oJ+uhnOu5hOuhnCcsJ2V4aXQnKSsnPC9zZWN0aW9uPic7XG4gICBlbHNlIGlmKGhpbnRPcGVuKWJvZHk9JzxzZWN0aW9uIGNsYXNzPVwib3V0c2lkZS1kaWFsb2cgb3V0c2lkZS1lbnRyeS1oaW50XCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbGxlZGJ5PVwib3V0c2lkZS1oaW50LXRpdGxlXCI+PGtiZD5QPC9rYmQ+PGgyIGlkPVwib3V0c2lkZS1oaW50LXRpdGxlXCI+7YOQ7IOJIOykkeyXkCDshKTsoJXsnYQg67CU6r+UIOuztOyEuOyalDwvaDI+PHA+UOulvCDriITrpbTrqbQg7JyE7LmYwrfstpzqt7zquLgv7Ye06re86ri4wrfsnbzssKjrpbwg67OA6rK97ZWgIOyImCDsnojsirXri4jri6QuPGJyPjk57J287LCo66W8IOyEoO2Dne2VmOuptCBRQSDsoITsmqkg6rO16rCE7Jy866GcIOydtOuPme2VqeuLiOuLpC48L3A+JytidXR0b24oJ+2ZleyduCcsJ2hpbnQtY2xvc2UnLCdwcmltYXJ5JykrJzwvc2VjdGlvbj4nO1xuICAgZWxzZSBpZihzaG93UGF1c2VNZW51KWJvZHk9Z2xvYmFsLkx1bmFTZXR0aW5ncy5odG1sKHtjb250ZXh0OidvdXRzaWRlJyxvbkNsb3NlOigpPT57bWVudSgpO2hvc3QuZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO30sZXhpdExhYmVsOiftg5Dsg4kg7Iuc7J6RIO2ZlOuptOycvOuhnCcsb25FeGl0OigpPT5leGl0KCksb25SZXN0YXJ0OigpPT57Y2xlYXJJbnB1dCgpO21vZGVsLnN0YXJ0KGNvbmZpZyk7aWYod2FrZVNwYXduKW1vZGVsLndha2VBdFNvZmEoKTtwYW5vcmFtYT1mYWxzZTtzbmFwQ2FtZXJhKCk7aHVkU2lnbmF0dXJlPScnO3VwZGF0ZUhVRCgpO2hvc3QuZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO319KTtcbiAgIGVsc2UgaWYobS5kaWFsb2c/LmtpbmQ9PT0naW5zcGVjdGlvbicpYm9keT1nbG9iYWwuTHVuYU91dHNpZGVJbnNwZWN0aW9uLmh0bWwobS5kaWFsb2cpO1xuICAgZWxzZSBpZihtLmRpYWxvZyYmbS5kaWFsb2cua2luZCE9PSdzb2ZhJylib2R5PSc8c2VjdGlvbiBjbGFzcz1cIm91dHNpZGUtZGlhbG9nIG91dHNpZGUtb2JqZWN0LWRpYWxvZ1wiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCInK2VzYyhtLmRpYWxvZy50aXRsZSkrJ1wiPjxoMj4nK2VzYyhtLmRpYWxvZy50aXRsZSkrJzwvaDI+PHA+Jytlc2MobS5kaWFsb2cudGV4dCkrJzwvcD4nK2J1dHRvbign64ur6riwIMK3IEUnLCdpbnRlcmFjdCcsJ3ByaW1hcnknKSsnPC9zZWN0aW9uPic7XG4gICBvdmVybGF5LmNsYXNzTGlzdC50b2dnbGUoJ2lzLWluc3BlY3Rpb24nLCFzaG93UGF1c2VNZW51JiYhaGludE9wZW4mJm0uZGlhbG9nPy5raW5kPT09J2luc3BlY3Rpb24nKTtcbiAgIG92ZXJsYXkuaW5uZXJIVE1MPWJvZHk7b3ZlcmxheS5oaWRkZW49IWJvZHk7aHVkLmluZXJ0PSEhYm9keXx8ZGV2T3BlbjtcbiAgIGlmKGJvZHkpb3ZlcmxheS5xdWVyeVNlbGVjdG9yKCdidXR0b24nKT8uZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO1xuICB9XG4gIGNvbnN0IHByb21wdD1ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLWludGVyYWN0Jyk7aWYocHJvbXB0KXByb21wdC5oaWRkZW49IWludGVyYWN0aW9uVGFyZ2V0KCk7XG4gIGNvbnN0IGxvb2tvdXQ9aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS12aWV3cG9pbnQnKTtpZihsb29rb3V0JiZ2aWV3cG9pbnQpe2NvbnN0IHA9cG9zaXRpb24oVklFV1BPSU5ULngsbW9kZWwueSsuMjYpO2xvb2tvdXQuc3R5bGUubGVmdD1jbGFtcChwLngsMjQsMTI1NikrJ3B4Jztsb29rb3V0LnN0eWxlLnRvcD1jbGFtcChwLnktMTIsNDIsNjk2KSsncHgnO31cbiAgcGFpbnRDb250cm9sc1R1dG9yaWFsKCk7dXBkYXRlU3BlZWNoKCk7cGFpbnREZXYoKTtwYWludEhvbWV3YXJkR3VpZGUoKTtob3N0LnF1ZXJ5U2VsZWN0b3IoJy5vdXRzaWRlLXNwZWVjaCcpLmluZXJ0PWRldk9wZW47aG9zdC5xdWVyeVNlbGVjdG9yQWxsKCcub3V0c2lkZS1iYWNrZ3JvdW5kLXNwZWVjaCcpLmZvckVhY2goZWw9PmVsLmluZXJ0PWRldk9wZW4pO1xuICBsZXQgc2F2ZWQ9aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1zYXZlLWZlZWRiYWNrJyk7XG4gIGlmKCFzYXZlZCl7c2F2ZWQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7c2F2ZWQuY2xhc3NOYW1lPSdvdXRzaWRlLXNhdmUtZmVlZGJhY2snO3NhdmVkLnNldEF0dHJpYnV0ZSgncm9sZScsJ3N0YXR1cycpO3NhdmVkLnNldEF0dHJpYnV0ZSgnYXJpYS1saXZlJywncG9saXRlJyk7aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1zdGFnZScpLmFwcGVuZChzYXZlZCk7fVxuICBjb25zdCBzaG93U2F2ZWQ9bS5ub3RpY2U9PT0n7KCA7J6lIOyZhOujjCEnJiZtLm5vdGljZUxlZnQ+MDtcbiAgaWYoc2F2ZWQudGV4dENvbnRlbnQhPT0oc2hvd1NhdmVkP20ubm90aWNlOicnKSlzYXZlZC50ZXh0Q29udGVudD1zaG93U2F2ZWQ/bS5ub3RpY2U6Jyc7XG4gIHNhdmVkLmhpZGRlbj0hc2hvd1NhdmVkfHxtLnBhdXNlZHx8ZGV2T3Blbjsgc2F2ZWQuc3R5bGUub3BhY2l0eT1NYXRoLm1pbigxLG0ubm90aWNlTGVmdC8uMzUpO1xuXG4gfVxuIGZ1bmN0aW9uIHVwZGF0ZVNwZWVjaCgpe1xuICBjb25zdCB2PW1vZGVsLnN0b3J5LnZpZXcoKTtyZW5kZXJTcGVlY2goaG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1zcGVlY2gnKSx2KTtcbiAgY29uc3QgY2hvaWNlPW1vZGVsLmRpYWxvZz8ua2luZD09PSdzb2ZhJz97a2V5Om1vZGVsLmRpYWxvZy5rZXksbGFiZWw6J+yGjO2MjCDshKDtg53sp4AnLG9wdGlvbnM6W3tpZDonc2xlZXAnLGxhYmVsOifsiJjrqbQnfSx7aWQ6J3NhdmUnLGxhYmVsOifsoIDsnqUnfSx7aWQ6J2NhbmNlbCcsbGFiZWw6J+y3qOyGjCd9XX06dj8uY2hvaWNlJiZ2LnB1cmNoYXNlP3suLi52LnB1cmNoYXNlLGtleTp2LmtleX06bnVsbDtcbiAgY2hvaWNlVUk/LnVwZGF0ZShjaG9pY2UmJiFtb2RlbC5wYXVzZWQmJiFsb2FkaW5nJiYhbG9hZEVycm9yJiYhZGV2T3BlbiYmIWhpbnRPcGVuP3suLi5jaG9pY2UsaGVhZDpwb3NpdGlvbihtb2RlbC54LG1vZGVsLnkrLjE2KSxmYWNpbmc6bW9kZWwuZmFjaW5nfTpudWxsKTtcbiAgY29uc3Qgdmlld3M9bW9kZWwuYmFja2dyb3VuZFN0b3J5LnZpZXdzKCksYnViYmxlcz1bLi4uaG9zdC5xdWVyeVNlbGVjdG9yQWxsKCcub3V0c2lkZS1iYWNrZ3JvdW5kLXNwZWVjaCcpXTtcbiAgd2hpbGUoYnViYmxlcy5sZW5ndGg8dmlld3MubGVuZ3RoKXtjb25zdCBlbD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtlbC5jbGFzc05hbWU9J291dHNpZGUtYmFja2dyb3VuZC1zcGVlY2gnO2hvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtc3RhZ2UnKS5pbnNlcnRCZWZvcmUoZWwsaG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1vdmVybGF5JykpO2J1YmJsZXMucHVzaChlbCk7fVxuICBidWJibGVzLmZvckVhY2goKGVsLGkpPT57aWYoaT49TWF0aC5tYXgoMSx2aWV3cy5sZW5ndGgpKXtlbC5yZW1vdmUoKTtyZXR1cm47fWVsLmRhdGFzZXQuc3RvcnlJZD12aWV3c1tpXT8ua2V5LnNwbGl0KCc6JylbMF18fCcnO3JlbmRlclNwZWVjaChlbCx2aWV3c1tpXXx8bnVsbCx0cnVlKTt9KTtcbiB9XG4gZnVuY3Rpb24gcmVuZGVyU3BlZWNoKGVsLHYsYmFja2dyb3VuZD1mYWxzZSl7ZWwuaGlkZGVuPSF2fHxtb2RlbC5wYXVzZWR8fGxvYWRpbmd8fCEhbG9hZEVycm9yO2lmKCF2KXtlbC5kYXRhc2V0LmtleT0nJztyZXR1cm47fVxuICBjb25zdCBrZXk9di5rZXkrJzonK3YuY2FuVHJlYXQ7XG4gIGlmKGVsLmRhdGFzZXQua2V5IT09a2V5KXtlbC5kYXRhc2V0LmtleT1rZXk7ZWwuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtYXV0bycsdi5hdXRvKTtlbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLHYuYXV0bz8nc3RhdHVzJzp2LmNob2ljZT8nZ3JvdXAnOididXR0b24nKTtlbC50YWJJbmRleD0hdi5hdXRvJiYhdi5jaG9pY2U/MDotMTtlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCfrjIDtmZQnKTtlbC5pbm5lckhUTUw9Z2xvYmFsLkx1bmFFeHRlcmlvclRleHRib3guaHRtbCgpKyc8cD48L3A+JztnbG9iYWwuTHVuYUV4dGVyaW9yVGV4dGJveC5tb3VudFRleHQoZWwucXVlcnlTZWxlY3RvcigncCcpLHYuZnVsbCx2LmVtcGhhc2lzfHxbXSxiYWNrZ3JvdW5kKTtpZighdi5hdXRvJiYhdi5jaG9pY2UmJiFkZXZPcGVuKWVsLmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG5cbiAgZWwucXVlcnlTZWxlY3RvcigncCcpLmhpZGRlbj0hdi5mdWxsO1xuICBnbG9iYWwuTHVuYURpYWxvZ3VlQ3VlLnN5bmMoZWwsIXYuYXV0byYmIXYuY2hvaWNlJiYhIXYuZnVsbCYmdi50ZXh0PT09di5mdWxsKTtcbiAgZ2xvYmFsLkx1bmFFeHRlcmlvclRleHRib3gucmV2ZWFsVGV4dChlbC5xdWVyeVNlbGVjdG9yKCdwJyksQXJyYXkuZnJvbSh2LnRleHQpLmxlbmd0aCk7XG4gIGNvbnN0IHA9cG9zaXRpb24odi5hbmNob3IueCx2LmFuY2hvci55KTtnbG9iYWwuTHVuYVdvcmxkU3BlZWNoLnBsYWNlKGVsLHsuLi5wLHNjYWxlOjQuOC9yZW5kZXJDYW0udyxnYXA6MjJ9KTtcbiB9XG4gZnVuY3Rpb24gdGljayhkdCl7aWYoIWFjdGl2ZSlyZXR1cm47bm90aWNlcz8udXBkYXRlKG1vZGVsLGxvYWRpbmc/MDpkdCk7aWYoIWxvYWRpbmcmJiFsb2FkRXJyb3ImJiFnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuaGlkZGVuUGF1c2VkJiYhZGV2T3BlbiYmIWhpbnRPcGVuJiYhbW9kZWwuY29udHJvbHNUdXRvcmlhbCl7Y29uc3QgbGVmdD1rZXlzLmhhcygnS2V5QScpfHxrZXlzLmhhcygnQXJyb3dMZWZ0JykscmlnaHQ9a2V5cy5oYXMoJ0tleUQnKXx8a2V5cy5oYXMoJ0Fycm93UmlnaHQnKTttb2RlbC50aWNrKGR0LHttb3ZlOk51bWJlcihyaWdodCktTnVtYmVyKGxlZnQpLHJ1bjprZXlzLmhhcygnU2hpZnRMZWZ0Jyl8fGtleXMuaGFzKCdTaGlmdFJpZ2h0Jyl9KTtpZighbW9kZWwucGF1c2VkKXt0YXJnZXRDYW1lcmEoTWF0aC5taW4oZHQsLjA1KSk7Z2xvYmFsLkx1bmFPdXRzaWRlUmVzaWRlbnRzLnRpY2tWaWV3KG1vZGVsLGNhbSk7fX1kcmF3KCk7dXBkYXRlSFVEKCk7fVxuIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsZT0+e2NvbnN0IGtleT1lLnRhcmdldC5kYXRhc2V0Py5vdXRzaWRlU2V0dGluZztpZigha2V5KXJldHVybjtjb25zdCB2YWx1ZT1lLnRhcmdldC52YWx1ZTtpZihrZXk9PT0ncGxhY2UnJiZPYmplY3QuaGFzT3duKFBMQUNFUyx2YWx1ZSkpY29uZmlnLnBsYWNlPXZhbHVlO2lmKGtleT09PSdmbG93JyYmT2JqZWN0Lmhhc093bihGTE9XUyx2YWx1ZSkpY29uZmlnLmZsb3c9dmFsdWU7aWYoa2V5PT09J2RheScpY29uZmlnLmRheT1OdW1iZXIodmFsdWUpPT09OTk/OTk6Y2xhbXAoTnVtYmVyKHZhbHVlKXx8MCwwLDMpO30sdHJ1ZSk7XG4gZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLGU9PntpZihhY3RpdmUmJmRldk9wZW4pe2NvbnN0IGNvbnRyb2w9ZS50YXJnZXQuY2xvc2VzdCgnLm91dHNpZGUtZGV2LWNvbnNvbGUgW2RhdGEtb3V0c2lkZS1hY3Rpb25dJyk7aWYoY29udHJvbCYmIWNvbnRyb2wuZGlzYWJsZWQpe2UucHJldmVudERlZmF1bHQoKTtkZXZBY3Rpb24oY29udHJvbC5kYXRhc2V0Lm91dHNpZGVBY3Rpb24pO31yZXR1cm47fWlmKGFjdGl2ZSYmIW1vZGVsLnBhdXNlZCYmIWxvYWRpbmcmJiFsb2FkRXJyb3ImJmUudGFyZ2V0LmNsb3Nlc3QoJy5vdXRzaWRlLXNwZWVjaCcpJiYhZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uJykmJm1vZGVsLnN0b3J5LmJsb2NraW5nJiYhbW9kZWwuc3Rvcnkuc3BlZWNoLmNob2ljZSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2NsZWFySW5wdXQoKTttb2RlbC5zdG9yeS5hZHZhbmNlKCk7dXBkYXRlSFVEKCk7cmV0dXJuO31jb25zdCBiPWUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLW91dHNpZGUtYWN0aW9uXScpO2lmKCFiKXJldHVybjtjb25zdCBhPWIuZGF0YXNldC5vdXRzaWRlQWN0aW9uO2UucHJldmVudERlZmF1bHQoKTtpZihhPT09J3N0YXJ0Jyl7T2JqZWN0LmFzc2lnbihjb25maWcse2RheTowLGZsb3c6J291dCcscGxhY2U6J2Jhcid9KTtzdGFydCh7c2hvd0RldkhpbnQ6dHJ1ZX0pO3JldHVybjt9aWYoIWFjdGl2ZSlyZXR1cm47aWYoYT09PSdoaW50LWNsb3NlJylkaXNtaXNzSGludCgpO2Vsc2UgaWYoYT09PSdleGl0JylleGl0KCk7ZWxzZSBpZihhPT09J3JldHJ5Jyl7ZXhpdCgpO3N0YXJ0KCk7fWVsc2UgaWYoYT09PSdtZW51JyltZW51KCk7ZWxzZSBpZihhPT09J3Jlc3RhcnQnKXtjbGVhcklucHV0KCk7bW9kZWwuc3RhcnQoY29uZmlnKTtpZih3YWtlU3Bhd24pbW9kZWwud2FrZUF0U29mYSgpO3Bhbm9yYW1hPWZhbHNlO3NuYXBDYW1lcmEoKTtodWRTaWduYXR1cmU9Jyc7fWVsc2UgaWYoYT09PSdiZC1jaG9pY2UnKXtpZihiLmRpc2FibGVkKXJldHVybjtjbGVhcklucHV0KCk7bW9kZWwuc3RvcnkuY2hvb3NlKGIuZGF0YXNldC5jaG9pY2UpO31lbHNlIGlmKGE9PT0ncGFub3JhbWEnKXRvZ2dsZVBhbm9yYW1hKCk7ZWxzZSBpZihhPT09J2ludGVyYWN0Jyl7Y2xlYXJJbnB1dCgpO21vZGVsLmludGVyYWN0KCk7fXVwZGF0ZUhVRCgpO30pO1xuIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxlPT57aWYoIWFjdGl2ZSlyZXR1cm47aWYoY29udHJvbHNUdXRvcmlhbEtleShlKSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2Uuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7cmV0dXJuO31pZihkZXZLZXkoZSkpcmV0dXJuO1xuICBpZihoaW50T3BlbiYmZS5jb2RlIT09J1RhYicpe2lmKGUubWV0YUtleXx8ZS5jdHJsS2V5fHxlLmFsdEtleSlyZXR1cm47ZS5wcmV2ZW50RGVmYXVsdCgpO2Uuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7aWYoIWUucmVwZWF0JiZbJ0VzY2FwZScsJ1NwYWNlJywnRW50ZXInLCdLZXlFJ10uaW5jbHVkZXMoZS5jb2RlKSlkaXNtaXNzSGludCgpO3JldHVybjt9XG4gIGlmKGNob2ljZVVJPy5rZXkoZSkpcmV0dXJuO1xuICBpZihlLmNvZGU9PT0nVGFiJyl7Y29uc3Qgc2NvcGU9aG9zdC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1vdmVybGF5Om5vdChbaGlkZGVuXSknKXx8KG1vZGVsLnN0b3J5LmJsb2NraW5nP2hvc3QucXVlcnlTZWxlY3RvcignLm91dHNpZGUtc3BlZWNoJyk6aG9zdCksYnV0dG9ucz1bLi4uKHNjb3BlLm1hdGNoZXMoJ1t0YWJpbmRleD1cIjBcIl0nKT9bc2NvcGVdOltdKSwuLi5zY29wZS5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b246bm90KFtoaWRkZW5dKTpub3QoOmRpc2FibGVkKSxbdGFiaW5kZXg9XCIwXCJdJyldLmZpbHRlcihiPT4hYi5jbG9zZXN0KCdbaW5lcnRdJykmJmIuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGgpLGk9YnV0dG9ucy5pbmRleE9mKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO2UucHJldmVudERlZmF1bHQoKTtidXR0b25zWyhpKyhlLnNoaWZ0S2V5Py0xOjEpK2J1dHRvbnMubGVuZ3RoKSVidXR0b25zLmxlbmd0aF0/LmZvY3VzKCk7cmV0dXJuO31cbiAgaWYoZ2xvYmFsLmx1bmFRQT8ub3BlbmVkKXJldHVybjtcbiAgaWYoZS5tZXRhS2V5fHxlLmN0cmxLZXl8fGUuYWx0S2V5KXJldHVybjtcbiAgaWYoWydLZXlBJywnS2V5RCcsJ0Fycm93TGVmdCcsJ0Fycm93UmlnaHQnLCdTaGlmdExlZnQnLCdTaGlmdFJpZ2h0JywnS2V5RScsJ0tleVknLCdFc2NhcGUnLCdTcGFjZSddLmluY2x1ZGVzKGUuY29kZSkpe2UucHJldmVudERlZmF1bHQoKTtlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO31cbiAgaWYoZS5jb2RlPT09J0VzY2FwZScmJiFlLnJlcGVhdCl7aWYoWydpbnNwZWN0aW9uJywnc29mYSddLmluY2x1ZGVzKG1vZGVsLmRpYWxvZz8ua2luZCkmJiFtb2RlbC5wYXVzZWQpe2NsZWFySW5wdXQoKTttb2RlbC5pbnRlcmFjdCgpO3VwZGF0ZUhVRCgpO2hvc3QuZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO31lbHNlIG1lbnUoKTtyZXR1cm47fVxuICBpZihsb2FkaW5nfHxsb2FkRXJyb3J8fG1vZGVsLnBhdXNlZClyZXR1cm47XG4gIGlmKG1vZGVsLnN0b3J5LnNwZWVjaD8uY2hvaWNlKXJldHVybjtcbiAgaWYoZS5jb2RlPT09J0tleVknKXtpZighZS5yZXBlYXQpdG9nZ2xlUGFub3JhbWEoKTtyZXR1cm47fVxuICBpZigoZS5jb2RlPT09J0tleUUnfHxlLmNvZGU9PT0nU3BhY2UnJiZtb2RlbC5zdG9yeS5ibG9ja2luZ3x8ZS5jb2RlPT09J0VudGVyJyYmZS50YXJnZXQubWF0Y2hlcygnLm91dHNpZGUtc3BlZWNoW3JvbGU9XCJidXR0b25cIl0nKSkmJiFlLnJlcGVhdCl7ZS5wcmV2ZW50RGVmYXVsdCgpO2NsZWFySW5wdXQoKTtpZihlLmNvZGU9PT0nS2V5RScpbW9kZWwuY29udHJvbHNJbnRlcmFjdFVudGlsPXBlcmZvcm1hbmNlLm5vdygpKzE4MDttb2RlbC5pbnRlcmFjdCgpO3VwZGF0ZUhVRCgpO3JldHVybjt9XG4gIGlmKFsnS2V5QScsJ0tleUQnLCdBcnJvd0xlZnQnLCdBcnJvd1JpZ2h0JywnU2hpZnRMZWZ0JywnU2hpZnRSaWdodCddLmluY2x1ZGVzKGUuY29kZSkpa2V5cy5hZGQoZS5jb2RlKTtcbiB9LHRydWUpO1xuIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsZT0+e2tleXMuZGVsZXRlKGUuY29kZSk7Y29udHJvbHNEaXNtaXNzS2V5cy5kZWxldGUoZS5jb2RlKTt9KTtcbiBmdW5jdGlvbiBsb3NlRm9jdXMoKXtjb250cm9sc0Rpc21pc3NLZXlzLmNsZWFyKCk7aWYoIWFjdGl2ZSlyZXR1cm47aWYoZGV2T3Blbil0b2dnbGVEZXYoZmFsc2UpO2NsZWFySW5wdXQoKTtpZihnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuZW5hYmxlZCYmIWxvYWRpbmcmJiFsb2FkRXJyb3Ipe21vZGVsLnBhdXNlZD10cnVlO3VwZGF0ZUhVRCgpO319XG4gd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLGxvc2VGb2N1cyk7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsKCk9PntpZihkb2N1bWVudC5oaWRkZW4pbG9zZUZvY3VzKCk7fSk7d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsZml0KTtcbiBmdW5jdGlvbiBzbmFwc2hvdCh2aWV3PW51bGwpe2lmKCFjdHh8fGxvYWRpbmd8fGxvYWRFcnJvcilyZXR1cm4gbnVsbDtjb25zdCBvbGRDYW09Y2FtLG9sZFNjZW5lPW1vZGVsLnNjZW5lLG9sZFBpeGVsV2lkdGg9cGl4ZWxXaWR0aDt0cnl7aWYodmlldyl7Y2FtPXsuLi52aWV3fTtwaXhlbFdpZHRoPWdsb2JhbC5MdW5hUGl4ZWxDYW1lcmEuc2V0dGxlZFdpZHRoKGNhbS53LHN1cmZhY2UpO21vZGVsLnNjZW5lPSdzdHJlZXQnO31kcmF3KCk7cmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpO31maW5hbGx5e2NhbT1vbGRDYW07bW9kZWwuc2NlbmU9b2xkU2NlbmU7cGl4ZWxXaWR0aD1vbGRQaXhlbFdpZHRoO2RyYXcoKTt9fVxuIHJldHVybntnZXQgaW50ZXJhY3Rpb25HbG93KCl7cmV0dXJuIGdsb3dSZW5kZXJlci5zbmFwc2hvdCgpO30sZ2V0IGFjdGl2ZSgpe3JldHVybiBhY3RpdmU7fSxnZXQgZGV2Q29uc29sZU9wZW4oKXtyZXR1cm4gZGV2T3Blbjt9LGdldCBtb2RlbCgpe3JldHVybiBtb2RlbDt9LGdldCBsb2FkaW5nKCl7cmV0dXJuIGxvYWRpbmc7fSxnZXQgbG9hZEVycm9yKCl7cmV0dXJuIGxvYWRFcnJvcjt9LGdldCBjYW1lcmEoKXtyZXR1cm57Li4uY2FtfTt9LGdldCByZW5kZXJDYW1lcmEoKXtyZXR1cm57Li4ucmVuZGVyQ2FtfTt9LGdldCBwaXhlbFN1cmZhY2UoKXtyZXR1cm57Li4uc3VyZmFjZX07fSxjb25maWcsbG9iYnlIVE1MLHN0YXJ0LGV4aXQsYWR2YW5jZURheSxzaG93Q29udHJvbHNUdXRvcmlhbCxjb250cm9sc1R1dG9yaWFsS2V5LG5vdGlmeUl0ZW06KG0saWQpPT5hY3RpdmUmJm09PT1tb2RlbCYmbm90aWNlcz8uYWRkKG0saWQpLHRpY2ssY2xlYXJJbnB1dCxzbmFwc2hvdCxzbmFwQ2FtZXJhLG9wZW5EZXY6KCk9PnRvZ2dsZURldih0cnVlKSxkZXZBY3Rpb24scmVmcmVzaEhVRDp1cGRhdGVIVUR9O1xufVxuZ2xvYmFsLkx1bmFPdXRzaWRlPXtNb2RlbDpPdXRzaWRlTW9kZWwsY3JlYXRlLHN0cmVldERyYXdPcmRlcixzdHJlZXRQYXJhbGxheCxpbnRlcmFjdGlvbkFuY2hvcixpbnRlcmFjdGlvbkxhYmVsLHZpZXdwb2ludDpWSUVXUE9JTlQsYXRWaWV3cG9pbnQsZmlyc3RDb21tdXRlRW50cmFuY2VDdWUsaG9tZXdhcmRDdWVzfTtcbn0pKHR5cGVvZiB3aW5kb3c9PT0ndW5kZWZpbmVkJz9nbG9iYWxUaGlzOndpbmRvdyk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUEsQ0FBQyxVQUFTQSxNQUFNLEVBQUM7RUFDakIsWUFBWTs7RUFDWixNQUFNQyxLQUFLLEdBQUNBLENBQUNDLENBQUMsRUFBQ0MsQ0FBQyxFQUFDQyxDQUFDLEtBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDSCxDQUFDLEVBQUNFLElBQUksQ0FBQ0UsR0FBRyxDQUFDSCxDQUFDLEVBQUNGLENBQUMsQ0FBQyxDQUFDO0lBQUNNLEdBQUcsR0FBQ0EsQ0FBQ0wsQ0FBQyxFQUFDQyxDQUFDLEVBQUNLLENBQUMsS0FBR04sQ0FBQyxHQUFDLENBQUNDLENBQUMsR0FBQ0QsQ0FBQyxJQUFFTSxDQUFDO0lBQUNDLE1BQU0sR0FBQ0QsQ0FBQyxJQUFFQSxDQUFDLEdBQUNBLENBQUMsSUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDQSxDQUFDLENBQUM7RUFDM0YsTUFBTUUsTUFBTSxHQUFDO01BQUNDLEdBQUcsRUFBQyxPQUFPO01BQUNDLFFBQVEsRUFBQyxLQUFLO01BQUNDLElBQUksRUFBQztJQUFLLENBQUM7SUFBQ0MsS0FBSyxHQUFDO01BQUNDLEVBQUUsRUFBQyxLQUFLO01BQUNDLEdBQUcsRUFBQztJQUFLLENBQUM7RUFDL0UsTUFBTUMsQ0FBQyxHQUFDbEIsTUFBTSxDQUFDbUIsYUFBYSxDQUFDQyxNQUFNO0VBQ25DLE1BQU1DLElBQUksR0FBQztJQUFDQyxFQUFFLEVBQUMsTUFBTTtJQUFDQyxLQUFLLEVBQUMsU0FBUztJQUFDQyxDQUFDLEVBQUMsS0FBSztJQUFDQyxDQUFD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QUFDLENBQUM7TUFBQyxJQUFJOGUsY0FBY0EsQ0FBQSxFQUFFO1FBQUMsT0FBTzFULE9BQU87TUFBQyxDQUFDO01BQUMsSUFBSTFQLEtBQUtBLENBQUEsRUFBRTtRQUFDLE9BQU9BLEtBQUs7TUFBQyxDQUFDO01BQUMsSUFBSStPLE9BQU9BLENBQUEsRUFBRTtRQUFDLE9BQU9BLE9BQU87TUFBQyxDQUFDO01BQUMsSUFBSUMsU0FBU0EsQ0FBQSxFQUFFO1FBQUMsT0FBT0EsU0FBUztNQUFDLENBQUM7TUFBQyxJQUFJak0sTUFBTUEsQ0FBQSxFQUFFO1FBQUMsT0FBTTtVQUFDLEdBQUdxTTtRQUFHLENBQUM7TUFBQyxDQUFDO01BQUMsSUFBSWlVLFlBQVlBLENBQUEsRUFBRTtRQUFDLE9BQU07VUFBQyxHQUFHdFQ7UUFBUyxDQUFDO01BQUMsQ0FBQztNQUFDLElBQUl1VCxZQUFZQSxDQUFBLEVBQUU7UUFBQyxPQUFNO1VBQUMsR0FBR3pUO1FBQU8sQ0FBQztNQUFDLENBQUM7TUFBQ3RNLE1BQU07TUFBQ2tOLFNBQVM7TUFBQzVJLEtBQUs7TUFBQ3BJLElBQUk7TUFBQ2lZLFVBQVU7TUFBQ21HLG9CQUFvQjtNQUFDSSxtQkFBbUI7TUFBQ3NGLFVBQVUsRUFBQ0EsQ0FBQ2pnQixDQUFDLEVBQUNwRSxFQUFFLEtBQUdvRixNQUFNLElBQUVoQixDQUFDLEtBQUd0RCxLQUFLLElBQUUyRSxPQUFPLEVBQUV1WixHQUFHLENBQUM1YSxDQUFDLEVBQUNwRSxFQUFFLENBQUM7TUFBQzJOLElBQUk7TUFBQzNCLFVBQVU7TUFBQzRYLFFBQVE7TUFBQzFPLFVBQVU7TUFBQ29QLE9BQU8sRUFBQ0EsQ0FBQSxLQUFJblEsU0FBUyxDQUFDLElBQUksQ0FBQztNQUFDbUIsU0FBUztNQUFDaVAsVUFBVSxFQUFDbFE7SUFBUyxDQUFDO0VBQ3ZqQjtFQUNBM1YsTUFBTSxDQUFDOGxCLFdBQVcsR0FBQztJQUFDQyxLQUFLLEVBQUNqYyxZQUFZO0lBQUN5RyxNQUFNO0lBQUNuSSxlQUFlO0lBQUNuRCxjQUFjO0lBQUM2RCxpQkFBaUI7SUFBQzNHLGdCQUFnQjtJQUFDdWYsU0FBUyxFQUFDOWQsU0FBUztJQUFDNkIsV0FBVztJQUFDVyx1QkFBdUI7SUFBQ29CO0VBQVksQ0FBQztBQUNyTCxDQUFDLEVBQUUsT0FBT29kLE1BQU0sS0FBRyxXQUFXLEdBQUNvQixVQUFVLEdBQUNwQixNQUFNLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=

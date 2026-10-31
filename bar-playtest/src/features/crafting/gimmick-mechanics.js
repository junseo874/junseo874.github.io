/* Bottle opening, shaking and stirring mechanics. No UI or per-session state. */
(function (root) {
  'use strict';
  function create({ clamp, root }) {
  const OPEN = {
    init(s) {
      if (s.type !== 'open') return;
      Object.assign(s, {
        openPhase: 'ready',
        powerPos: 0,
        powerDirection: 1,
        powerPerfect: false,
        roundMisses: 0,
        openDelay: 0
      });
    },
    fail(s, offset = 0) {
      s.failures++;
      s.roundMisses++;
      s.beatTime = 0;
      this.hit(s, false, offset);
      s.message = '다시 타이밍을 맞춰 주세요';
      if (s.roundMisses >= 3) {
        s.openPhase = 'broken';
        s.openDelay = 1.2;
        s.message = '병이 깨졌어요 · 다시 시도';
      } else if (s.openPhase === 'power') s.powerPos = 0;
    },
    press(s) {
      if (s.completed || ['broken', 'power-done'].includes(s.openPhase)) return false;
      if (!s.started || s.openPhase === 'ready') {
        s.started = true;
        s.openPhase = 'power';
        s.powerPos = 0;
        s.message = '초록 구간에서 힘을 맞춰 주세요';
        return true;
      }
      if (s.openPhase === 'power') {
        const d = Math.abs(s.powerPos - .78);
        if (d <= .152) {
          s.powerPerfect = d <= .08;
          s.openPhase = 'power-done';
          s.openDelay = .45;
          s.message = '힘 조절 성공 · 다음은 링 타이밍';
        } else this.fail(s, s.powerPos - .78);
        return true;
      }
      const error = s.beatTime - 1.1;
      if (Math.abs(error) <= .14) {
        s.completed = true;
        s.openPhase = 'pop';
        s.message = 'OPEN';
        this.hit(s, true, error, .2167);
        s.openFx.perfect = s.powerPerfect && Math.abs(error) <= .065;
      } else this.fail(s, error);
      return true;
    },
    tick(s, dt) {
      if (s.openPhase === 'power') {
        s.powerPos += s.powerDirection * 1.1 * dt;
        if (s.powerPos >= 1) {
          s.powerPos = 1;
          s.powerDirection = -1;
        }
        if (s.powerPos <= 0) {
          s.powerPos = 0;
          s.powerDirection = 1;
        }
      } else if (s.openPhase === 'power-done' || s.openPhase === 'broken') {
        s.openDelay -= dt;
        if (s.openDelay <= 0) {
          if (s.openPhase === 'broken') {
            s.roundMisses = 0;
            s.openPhase = 'power';
            s.powerPos = 0;
            s.message = '초록 구간에서 다시 시작';
          } else {
            s.openPhase = 'rhythm';
            s.beatTime = 0;
            s.message = '원이 링에 겹칠 때 누르세요';
          }
        }
      } else if (s.openPhase === 'rhythm') {
        s.beatTime += dt;
        if (s.beatTime > 1.24) this.fail(s, s.beatTime - 1.1);
      }
    },
    minigameHoldSec: 4.1,
    // Allow 450ms delay + 3.5s fizz and a small render margin.
    carbonationSec: 2.05,
    // Let the rising bottle bubble cluster finish before the next step.
    hit(s, ok, offset = 0, window = 10) {
      s.openFx = {
        kind: ok ? 'success' : 'miss',
        perfect: ok && Math.abs(offset) <= window * .3 + 1e-8,
        offset,
        age: 0,
        serial: (s.openFx?.serial || 0) + 1
      };
    },
    visual(s, dt) {
      if (s.type === 'open' && s.openFx) s.openFx.age = Math.min(OPEN.minigameHoldSec, s.openFx.age + dt);
    }
  };
  const MIX = {
    shakeTargetStacks: 20,
    completionHoldSec: .9,
    // Web playtest tuning; source CSV and stir counts remain unchanged.
    points: [[0, 0], [2.61, 1.206875], [0, 2.56], [2.61, 3.766875]],
    route: [0, 1, 2, 3, 2, 1],
    patterns: [[[0, .37], [2, .47]], [[0, .28], [0, .38], [1, .38], [2, .49], [2, .56]], [[0, .39], [0, .57], [1, .32], [1, .48], [2, .55], [2, .82]], [[0, .28], [1, .32], [2, .55]]],
    radius: .25,
    delay: .1,
    frameSeconds: .125,
    stirFrameSeconds: 1 / 12,
    shakeClips: [[1, 2, 3, 0], [5, 6, 7, 4]],
    init(s) {
      if (!['shake', 'stir'].includes(s.type)) return;
      s.shakeEffects = [];
      s.motionFrame = 0;
      s.motionAge = null;
      s.motionClip = 0;
      s.nextMotionClip = 0;
      s.feedbackLeft = 0;
      s.hitEffect = null;
      s.beatIndex = -1;
      s.pathPoint = [...this.points[0]];
      s.patternIndex = -1;
      s.patternTurn = -1;
      s.nodes = [];
      s.pathFixedHits = [];
      s.attemptStartPos = 0;
      s.spoonAngle = 0;
      s.spoonTarget = 0;
      s.swirlSpeed = 0;
      s.stirMotionPending = 0;
      s.stirMotionClock = 0;
      const layout = [[-28.49, 22.33, 41.58, .9], [30.03, 19.25, 38.2536, -.75], [-.77, -31.57, 34.9272, .65], [-30.03, -20.79, 27.442802, -.85], [31.57, -26.95, 29.106, .6], [3.85, 37.73, 24.1164, -.62]];
      s.ice = layout.map(([x, y, size, factor], i) => ({
        x,
        y,
        size,
        factor,
        spin: 0,
        sideSpin: 0,
        rest: Math.min(Math.hypot(x, y), 72.5 - size * .5),
        sideY: [28.2, 29.208, 30.216, 32.484, 31.98, 33.492][i]
      }));
      s.iceAverage = s.ice.reduce((n, c) => n + Math.hypot(c.x, c.y), 0) / s.ice.length;
      s.iceRadius = Math.max(...s.ice.map(c => Math.hypot(c.x, c.y)));
      this.resolveIce(s, 0);
    },
    resolveIce(s, dt) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < s.ice.length; i++) for (let j = i + 1; j < s.ice.length; j++) {
          const a = s.ice[i],
            b = s.ice[j],
            dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy),
            min = (a.size + b.size) * .5;
          if (d >= min) continue;
          const nx = d > .0001 ? dx / d : 1,
            ny = d > .0001 ? dy / d : 0,
            push = (min - d) * .5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
        for (const c of s.ice) {
          const r = Math.hypot(c.x, c.y),
            limit = 72.5 - c.size * .5;
          if (r > limit) {
            c.x *= limit / r;
            c.y *= limit / r;
          }
        }
      }
      if (dt > 0) for (const c of s.ice) {
        const r = Math.hypot(c.x, c.y);
        if (r > .0001) {
          const f = (r + (c.rest - r) * (1 - Math.exp(-4 * dt))) / r;
          c.x *= f;
          c.y *= f;
        }
      }
    },
    visual(s, dt) {
      if (!['shake', 'stir'].includes(s.type)) return;
      s.feedbackLeft = Math.max(0, s.feedbackLeft - dt);
      if (s.hitEffect) {
        s.hitEffect.age += dt;
        if (s.hitEffect.age >= .5) s.hitEffect = null;
      }
      if (s.type === 'shake') {
        s.shakeEffects = s.shakeEffects.filter(e => (e.age += dt) < .55);
        if (s.rhythm) {
          root.LunaShakeRhythm.visual(s, dt);
          return;
        }
        if (s.motionAge !== null) {
          s.motionAge += dt;
          s.motionFrame = this.shakeClips[s.motionClip][Math.min(3, Math.floor(s.motionAge / this.frameSeconds))];
        }
        return;
      }
      s.spoonAngle += (s.spoonTarget - s.spoonAngle) * (1 - Math.exp(-10 * dt));
      if (Math.abs(s.spoonTarget - s.spoonAngle) < .01) s.spoonAngle = s.spoonTarget;
      // Correct inputs fund a short 12 FPS hand gesture. Preserve its phase across inputs;
      // never quantize the exponentially eased spoon angle or accumulate a long autoplay tail.
      if (s.stirMotionPending) {
        s.stirMotionClock += dt;
        while (s.stirMotionPending && s.stirMotionClock + 1e-9 >= this.stirFrameSeconds) {
          s.stirMotionClock = Math.max(0, s.stirMotionClock - this.stirFrameSeconds);
          s.motionFrame = (s.motionFrame + 1) % 6;
          s.stirMotionPending--;
        }
        if (!s.stirMotionPending) s.stirMotionClock = 0;
      }
      s.swirlSpeed *= Math.exp(-1.2 * dt);
      if (s.swirlSpeed < .05) s.swirlSpeed = 0;
      if (!s.swirlSpeed) return;
      for (const c of s.ice) {
        const radius = Math.hypot(c.x, c.y),
          factor = radius <= .01 ? 1.35 : clamp((s.iceAverage / radius) ** .8, 1 / 1.35, 1.35),
          rad = -s.swirlSpeed * factor * dt * Math.PI / 180;
        const x = c.x * Math.cos(rad) - c.y * Math.sin(rad);
        c.y = c.x * Math.sin(rad) + c.y * Math.cos(rad);
        c.x = x;
        c.spin -= s.swirlSpeed * c.factor * dt;
        c.sideSpin -= s.swirlSpeed * c.factor * dt;
      }
      this.resolveIce(s, dt);
    },
    updatePath(s, rng) {
      const beats = Math.max(0, s.elapsed - this.delay),
        index = Math.floor(beats),
        t = beats - index;
      s.beatTime = t;
      s.beatIndex = index;
      const turn = Math.floor(index / 3);
      if (s.elapsed >= this.delay && turn !== s.patternTurn) {
        s.patternTurn = turn;
        if (turn % 2 === 0 || s.patternIndex < 0) s.patternIndex = Math.floor(rng() * this.patterns.length);
        const down = turn % 2 === 0;
        s.nodes = this.patterns[s.patternIndex].map(([line, f], i) => {
          const from = down ? line : 3 - line,
            to = down ? from + 1 : from - 1,
            a = this.points[from],
            b = this.points[to];
          return {
            id: turn + ':' + i,
            x: a[0] + (b[0] - a[0]) * f,
            y: a[1] + (b[1] - a[1]) * f,
            born: s.elapsed
          };
        });
      }
      s.nodes = s.nodes.filter(n => s.elapsed - n.born < 10);
      const a = this.points[this.route[index % 6]],
        b = this.points[this.route[(index + 1) % 6]];
      // Serialized ease=1 (Linear), not the C# field's default InOutQuad.
      s.pathPoint = s.elapsed < this.delay ? [...this.points[0]] : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      // A fixed node rearms only after the marker has left its hit area.
      s.pathFixedHits = (s.pathFixedHits || []).filter(id => {
        const [x, y] = this.points[Number(id.split(':')[1])];
        return Math.hypot(x - s.pathPoint[0], y - s.pathPoint[1]) <= this.radius;
      });
    },
    nearest(s) {
      const candidates = [...s.nodes, ...this.points.map(([x, y], i) => ({
        id: 'fixed:' + i,
        x,
        y,
        fixed: true
      }))];
      return candidates.filter(n => !n.fixed || !(s.pathFixedHits || []).includes(n.id)).map(n => ({
        ...n,
        distance: Math.hypot(n.x - s.pathPoint[0], n.y - s.pathPoint[1])
      })).filter(n => n.distance <= this.radius).sort((a, b) => a.distance - b.distance)[0] || null;
    },
    consumePathNode(s, node) {
      if (!node) return;
      if (node.fixed) {
        s.pathFixedHits ||= [];
        if (!s.pathFixedHits.includes(node.id)) s.pathFixedHits.push(node.id);
      } else s.nodes = s.nodes.filter(n => n.id !== node.id);
    },
    shakeHit(s) {
      const node = this.nearest(s),
        ok = !!node;
      this.consumePathNode(s, node);
      s.attempts++;
      s.success += ok ? 1 : 0;
      s.failures += ok ? 0 : 1;
      s.outcomes.push(ok);
      s.hit = true;
      s.beatSuccess = ok;
      s.message = ok ? 'GOOD' : 'MISS';
      s.feedbackLeft = .35;
      s.hitEffect = {
        x: node?.x ?? s.pathPoint[0],
        y: node?.y ?? s.pathPoint[1],
        ok,
        age: 0
      };
      if (ok) {
        s.motionClip = s.nextMotionClip;
        s.nextMotionClip = 1 - s.nextMotionClip;
        s.motionAge = 0;
        s.motionFrame = this.shakeClips[s.motionClip][0];
      }
      s.shakeEffects.push({
        ...s.hitEffect,
        id: s.attempts
      });
      if (s.shakeEffects.length > 12) s.shakeEffects.shift();
      if (s.attempts >= s.targetStacks) s.completed = true;
      return ok;
    }
  };
    return { OPEN, MIX };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaRuleParts ||= {}).mechanics = create;
})(typeof window === 'undefined' ? globalThis : window);

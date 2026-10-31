/* Payment, affinity, upkeep and daily settlement. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ condition, n, root, sortSeq }) {
    return class GameSettlement {
    settle(result, guest = null) {
      if (this.transactionIds.has(result.orderId)) return;
      const c = this.cocktail(result.served),
        rule = this.t.settlement_rules.find(r => r.setting === result.grade);
      if (!rule) throw Error('정산 규칙 누락');
      const price = result.payment === 'none' ? 0 : n(c.price),
        sale = Math.round(price * n(rule.sale_rate)),
        tip = Math.round(price * n(rule.tip_rate) * n(guest?.personality?.tip_mult, 1)),
        refund = Math.round(price * n(rule.refund_rate));
      const trx = {
        ...result,
        sale,
        tip,
        refund,
        net: sale + tip - refund,
        phase: this.phase
      };
      this.transactions.push(trx);
      this.transactionIds.add(result.orderId);
      this.progress.money += trx.net;
      this.served++;
      this.log('settlement', trx);
      return trx;
    }
    applyAffinity(actor, result) {
      const c = this.t.characters.find(c => c.id === actor);
      if (!c?.affinity) return;
      const taste = sortSeq(this.t.tastes.filter(t => t.character_id === actor)).find(t => condition(t.when, this.ctx()));
      const tier = !result.match ? 'miss' : taste?.tier || 'ok';
      const row = this.t.affinity_matrix.find(r => r.taste_tier === tier);
      const delta = n(row?.[result.grade]);
      this.progress.affinity[actor] = n(this.progress.affinity[actor]) + delta;
      this.log('affinity', {
        actor,
        tier,
        delta
      });
      root.LunaStoryNotices?.affinity(this.progress, actor, delta);
    }
    parseUpkeepOverride(value) {
      if (value == null || String(value).trim() === '') return null;
      const amount = Number(value);
      if (!Number.isSafeInteger(amount) || amount < 0) throw Error('유지비는 0 이상의 정수 G로 입력해 주세요.');
      return amount;
    }
    upkeepInfo() {
      if (this.upkeepOverride != null) return {
        amount: this.upkeepOverride,
        source: 'web_test'
      };
      const row = this.t.days.find(d => n(d.day) === this.day);
      if (!row && this.day === 99) return {
        amount: 0,
        source: 'qa_default'
      };
      if (!row || row.upkeep_gold == null || String(row.upkeep_gold).trim() === '') throw Error('일차 유지비 데이터 누락: Day ' + this.day);
      const amount = this.parseUpkeepOverride(row.upkeep_gold);
      return {
        amount,
        source: 'days.csv'
      };
    }
    setUpkeepOverride(value) {
      if (this.finished) return false;
      const amount = this.parseUpkeepOverride(value);
      this.upkeepOverride = amount;
      this.log('debug_upkeep_override', {
        amount,
        restoredDataDefault: amount == null
      });
      this.changed();
      return true;
    }
    finishDay() {
      if (this.finished) return false;
      const upkeep = this.upkeepInfo(),
        totals = this.totals(),
        before = this.progress.money;
      // Order revenue is already committed. Never add the displayed totals again.
      this.dailySettlement = {
        id: 'day_' + this.day + '_settlement',
        day: this.day,
        status: 'pending',
        totals: {
          ...totals
        },
        openingBalance: this.openingBalance,
        otherChanges: before - this.openingBalance - totals.net,
        balanceBefore: before,
        upkeep: upkeep.amount,
        source: upkeep.source,
        projectedBalance: before - upkeep.amount,
        shortfall: Math.max(0, upkeep.amount - before),
        balanceAfter: null
      };
      this.tutorial = null;
      this.phase = 'complete';
      this.screen = 'settlement';
      this.dialogue = null;
      this.choice = null;
      this.story = null;
      this.currentOrder = null;
      this.drink = null;
      this.prep = null;
      this.gimmick = null;
      this.overlay = null;
      this.paused = false;
      this.transition = 0;
      this.pendingTransition = null;
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.tableFades = {};
      this.finished = true;
      this.log('day_complete', {
        day: this.day,
        orders: this.transactions.length,
        upkeep: upkeep.amount,
        upkeepSource: upkeep.source
      });
      this.changed();
      return true;
    }
    confirmDailySettlement() {
      const s = this.dailySettlement;
      if (!s || s.status !== 'pending' || this.screen !== 'settlement' || this.error) return false;
      if (s.balanceBefore < s.upkeep) {
        s.status = 'failed';
        s.balanceAfter = s.balanceBefore;
        this.phase = 'gameover';
        this.screen = 'gameover';
        this.log('daily_upkeep_failed', {
          settlementId: s.id,
          available: s.balanceBefore,
          required: s.upkeep,
          shortfall: s.shortfall
        });
        this.log('game_over', {
          reason: 'upkeep_unpaid',
          day: this.day
        });
      } else {
        this.progress.money = s.balanceBefore - s.upkeep;
        s.balanceAfter = this.progress.money;
        s.status = 'paid';
        this.log('daily_upkeep_paid', {
          settlementId: s.id,
          before: s.balanceBefore,
          amount: s.upkeep,
          after: s.balanceAfter
        });
      }
      this.changed();
      return true;
    }
    totals() {
      return this.transactions.reduce((a, t) => ({
        sale: a.sale + t.sale,
        tip: a.tip + t.tip,
        refund: a.refund + t.refund,
        net: a.net + t.net
      }), {
        sale: 0,
        tip: 0,
        refund: 0,
        net: 0
      });
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaGameParts ||= {}).settlement = create;
})(typeof window === 'undefined' ? globalThis : window);

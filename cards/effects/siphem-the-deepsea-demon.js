// ═══════════════════════════════════════════
//  CARD EFFECT: "Siphem, the Deepsea Demon"
//  Hero (400 HP, 100 ATK, Decay Magic + Leadership)
//
//  Passives + activated:
//   • Whenever you return 1+ cards from your
//     side of the board to your hand, place 1
//     Deepsea Counter on this Hero.
//   • Once per turn, remove any number of
//     Deepsea Counters to choose a target and
//     deal 50 × N damage to it.
//
//  Counter storage: hero.deepseaCounters (int).
//  UI renders a badge next to the hero when > 0.
//  Counters persist across turns — there is no
//  automatic end-of-turn wipe.
// ═══════════════════════════════════════════

const { addDeepseaCounters } = require('./_deepsea-shared');

const CARD_NAME = 'Siphem, the Deepsea Demon';

module.exports = {
  // H1-Vertrag (Vergleichsanalyse): solange dieser Held lebt, sind
  // Bounce-Platzierungen Wert-Aktionen — jeder Bounce einer Deepsea-Kreatur erzeugt einen Siphem-Counter.
  // Konsumiert von pickCreatureZoneSlot (_cpu.js).
  cpuValuesBounces: true,


  // Zündungs-Mulligan der Deepsea-Linie (Begründung in _deepsea-shared).
  // SM-Ausbau-Floor gegen Lern-Drift (Begründung in _deepsea-shared).
  cpuAbilityPriorFloor(abilityName, targetLevel) {
    const { deepseaAbilityPriorFloor } = require('./_deepsea-shared');
    return deepseaAbilityPriorFloor(abilityName, targetLevel);
  },

  cpuMulliganAdvice(engine, pi, hand) {
    const { deepseaIgnitionMulliganAdvice } = require('./_deepsea-shared');
    return deepseaIgnitionMulliganAdvice(engine, pi, hand);
  },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Counter-Wahl der CPU (Als Auftrag "schau genau auf Siphem"): Der
   * generische Options-Default nimmt die ERSTE Option — bei aufsteigender
   * Liste also immer 1 Counter = 50-Schaden-Tröpfchen, egal wie hoch der
   * Stapel ist. Gemessen: Siphem-Nutzung korreliert mit 31% WR (vs 14%
   * ohne), wurde aber so systematisch verschenkt. Politik hier:
   *   1. Kill verfügbar → minimales n, das das wertvollste tötbare Ziel
   *      tötet (Held vor Kreatur, bei Helden das mit den meisten HP).
   *   2. Kein Kill, Stapel ≥ 2 → alles auf den dicksten Gegner-Helden.
   *      Als Ruling: Siphem soll jede Runde feuern KÖNNEN — Horten ist
   *      nur bei exakt 1 Counter erlaubt (eine Runde warten, damit aus
   *      50 Tröpfchen 100+ Druck wird), nie länger.
   *   3. Genau 1 Counter ohne Kill → abbrechen und eine Runde sparen.
   * Nur der optionPicker dieses Helden wird beantwortet — die
   * anschließende Zielwahl läuft über den normalen Target-Chooser samt
   * targetPriors.
   */
  cpuResponse(engine, kind, promptData) {
    try {
      if (promptData?.type !== 'optionPicker' || promptData?.title !== CARD_NAME) return undefined;
      const m = String(promptData.description || '').match(/(\d+) Deepsea Counter/);
      const count = m ? parseInt(m[1]) : (promptData.options || []).length;
      if (!(count > 0)) return undefined;
      const gs = engine.gs;
      let pi = engine._cpuPlayerIdx;
      for (let i = 0; i < 2; i++) {
        if ((gs.players[i]?.heroes || []).some(h => h?.name === CARD_NAME)) { pi = i; break; }
      }
      const opp = 1 - pi;
      const DB = engine._getCardDB();
      const targets = [];
      for (const h of (gs.players[opp]?.heroes || [])) {
        if (h && h.hp > 0) targets.push({ kind: 'hero', hp: h.hp });
      }
      for (const inst of (engine.cardInstances || [])) {
        if (inst.controller !== opp || inst.zone !== 'support' || inst.faceDown) continue;
        const cd = DB[inst.name];
        if (!cd || !String(cd.cardType || '').includes('Creature')) continue;
        const hp = inst.counters?.hp ?? cd.hp ?? 0;
        if (hp > 0) targets.push({ kind: 'creature', hp });
      }
      const killable = targets.filter(t => Math.ceil(t.hp / 50) <= count);
      if (killable.length) {
        killable.sort((a, b) =>
          (a.kind === 'hero' ? 0 : 1) - (b.kind === 'hero' ? 0 : 1) || b.hp - a.hp);
        const n = Math.ceil(killable[0].hp / 50);
        return { optionId: 'n-' + n };
      }
      if (count >= 2) return { optionId: 'n-' + count };
      return { cancelled: true };
    } catch { return undefined; }
  },


  // CPU threat assessment (damage supporter). 50 damage × accumulated
  // Deepsea Counters per activation. Counters persist across turns so the
  // current count is a reasonable proxy for "accumulated this game thus far".
  supportYield(ctx) {
    const hero = ctx.engine.gs.players[ctx.pi]?.heroes?.[ctx.hi];
    const counters = hero?.deepseaCounters || 0;
    return { damagePerTurn: 50 * counters };
  },

  // Counter-gated activation.
  canActivateHeroEffect(ctx) {
    const hero = ctx.attachedHero;
    return !!(hero && (hero.deepseaCounters || 0) > 0);
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    const count = hero.deepseaCounters || 0;
    if (count <= 0) return false;

    // Prompt: how many counters? The list can get long when the Hero has
    // stacked many counters across turns — one row-button per choice eats
    // a lot of vertical space, so we opt into the dropdown variant of
    // optionPicker here via `renderAs: 'dropdown'`.
    const options = [];
    for (let n = 1; n <= count; n++) {
      options.push({ id: `n-${n}`, label: `${n} counter${n > 1 ? 's' : ''} → ${50 * n} damage` });
    }
    const optRes = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      renderAs: 'dropdown',
      title: CARD_NAME,
      description: `You have ${count} Deepsea Counter${count > 1 ? 's' : ''}. Spend how many?`,
      confirmLabel: 'Confirm',
      options,
      cancellable: true,
    });
    if (!optRes || optRes.cancelled || !optRes.optionId) return false;
    const match = optRes.optionId.match(/^n-(\d+)$/);
    if (!match) return false;
    const n = parseInt(match[1]);
    if (n <= 0 || n > count) return false;
    const damage = 50 * n;

    const target = await ctx.promptDamageTarget({
      side: 'any', types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage to a target.`,
      confirmLabel: `☠️ ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    hero.deepseaCounters = count - n;
    if (hero.deepseaCounters <= 0) delete hero.deepseaCounters;

    // Orbital laser strike — red beam lances down from the top of the
    // screen onto the chosen target, flashes on impact, then damage
    // resolves. Delay matches the beam's charge (~260ms) + travel
    // (~520ms) + impact flash (~580ms) so damage numbers land on the
    // post-impact frame.
    engine._broadcastEvent('play_zone_animation', {
      type: 'orbital_laser_red', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(900);

    if (target.type === 'hero') {
      const tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tHero?.name && tHero.hp > 0) {
        await ctx.dealDamage(tHero, damage, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        ctx.card, target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
    engine.log('siphem_damage', {
      player: gs.players[pi]?.username, countersRemoved: n, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Add a counter whenever OUR cards return to hand.
    onCardsReturnedToHand: async (ctx) => {
      if (ctx.ownerIdx !== ctx.cardOriginalOwner) return;
      const engine = ctx._engine;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      addDeepseaCounters(hero, 1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'pollution_place', owner: ctx.cardOriginalOwner,
        heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
      });
      engine.log('siphem_counter_add', {
        player: engine.gs.players[ctx.cardOriginalOwner]?.username,
        counters: hero.deepseaCounters,
      });
      engine.sync();
    },

  },
};

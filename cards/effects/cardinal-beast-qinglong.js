// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Qinglong"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Opponent chooses 3 of their
//  targets. 120/80/40 chain lightning damage.
// ═══════════════════════════════════════════

const { kettenblitz } = require('./_kettenblitz-shared');   // v1333
const { _checkCardinalWin, _setCardinalImmune } = require('./_cardinal-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  creatureEffect: true,

  // Always commit the active. See cardinal-beast-zhuque.js for full
  // rationale — Cardinal Beast actives are always worth firing when
  // available, and the +3 commit threshold can underweight them.
  cpuMeta: { alwaysCommit: true },

  hooks: {
    onPlay: async (ctx) => { _setCardinalImmune(ctx); },
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.name?.startsWith('Cardinal Beast')) await _checkCardinalWin(ctx);
    },
  },

  canActivateCreatureEffect(ctx) { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ctx.cardZoneSlot;
    const cardDB = engine._getCardDB();
    const damages = [120, 80, 40];

    // Stream card image to opponent
    const oppSid = gs.players[oppIdx]?.socketId;
    if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: 'Cardinal Beast Qinglong' });
    await engine._delay(200);

    // Build all opponent targets
    const targets = [];
    const ops = gs.players[oppIdx];
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({ id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: oppIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
    }
    if (targets.length === 0) return false;

    const selectedTargets = await engine.promptChainTargets(oppIdx, targets, damages, {
      title: 'Cardinal Beast Qinglong',
    });
    if (selectedTargets.length === 0) return false;

    // Pre-damage post-target hand-reaction window.
    await engine.preDamageMultiTargetWindow(
      { name: 'Cardinal Beast Qinglong', owner: pi, heroIdx },
      selectedTargets,
    );

    // ★ v1333: Trefferschleife im geteilten Modul (`_kettenblitz-shared`)
    // — Flaechenklammer (v1185), und jeder einzelne Blitz gilt als Wahl
    // seines Ziels durch diesen Creature-Effekt (Umleiter sehen ihn).
    await kettenblitz(engine, {
      quelle: { name: 'Cardinal Beast Qinglong', owner: pi, heroIdx }, zone: 'support',
      ziele: selectedTargets, alleZiele: targets, schaden: damages, typ: 'creature',
      start: { owner: pi, heroIdx, zoneSlot },
    });

    return true;
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Chain Lightning"
//  Spell (Destruction Magic Lv3) — Opponent
//  must choose 3 targets (heroes first).
//  200/150/100 chain lightning damage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { kettenblitz } = require('./_kettenblitz-shared');   // v1333

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  // Turn-1 shielded opponent makes every bolt fizzle (opponent picks the
  // targets and they're all immune). The CPU has no `getValidTargets` to
  // reason about, so flag it explicitly here.
  firstTurnSafe: false,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx = pi === 0 ? 1 : 0;
      const cardDB = engine._getCardDB();
      const damages = [200, 150, 100];

      // Stream card to opponent
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: 'Chain Lightning' });
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
      if (targets.length === 0) return;

      // ── Ida single-target override ──
      // Flag belongs to the Hero PERFORMING the cast — use
      // cardHeroOwner (board side), not cardOwner (the caster).
      // Under Love Shot the caster casts through an opp-side Hero;
      // we must read the opp-side flag, not the caster's same-slot
      // Hero. cardHeroOwner falls back to cardOwner for normal
      // casts, so this stays correct outside Love Shot too.
      const heroFlags = gs.heroFlags?.[`${ctx.cardHeroOwner}-${heroIdx}`];
      if (heroFlags?.forcesSingleTarget) {
        // Opponent picks only 1 target, only the first hit (200) applies
        const selected = await engine.promptEffectTarget(oppIdx, targets, {
          maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
          title: 'Chain Lightning (Single Target)',
          description: 'Choose 1 target to take 200 damage.',
          confirmLabel: '⚡ Accept (200)',
          confirmClass: 'btn-danger',
          cancellable: false,
          exclusiveTypes: true,
          maxPerType: { hero: 1, equip: 1 },
        });
        if (!selected || selected.length === 0) return;

        const tgt = targets.find(t => t.id === selected[0]);
        if (!tgt) return;
        // v1333: auch der Einzelblitz gilt als Wahl dieses Ziels (Umleitung).
        await kettenblitz(engine, {
          quelle: { name: 'Chain Lightning', owner: pi, heroIdx }, zone: 'hand',
          ziele: [tgt], alleZiele: targets, schaden: [200], typ: 'destruction_spell',
          start: { owner: pi, heroIdx, zoneSlot: -1 },
        });
        engine.sync();
        return;
      }

      // Prompt opponent to pick targets (heroes first)
      const selectedTargets = await engine.promptChainTargets(oppIdx, targets, damages, {
        title: 'Chain Lightning',
        heroesFirst: true,
      });

      if (selectedTargets.length === 0) return;

      // Pre-damage post-target hand-reaction window — single
      // consolidated prompt for Sculpture Guards / Spectral Armor.
      // A full-negate reaction (Storm Ring / Invisibility Cloak) bails
      // the whole Spell here — no bolts, no damage, no side effects.
      const _negR = await engine.preDamageMultiTargetWindow(
        { name: 'Chain Lightning', owner: pi, heroIdx: ctx.cardHeroIdx },
        selectedTargets,
      );
      if (_negR?.effectNegated) return;

      // ★ v1333: Trefferschleife im geteilten Modul (`_kettenblitz-shared`):
      // Flaechenklammer (Interference, Deepsea Idol), Abbruch bei Negation
      // (Frost Rune, v1324/v1325) — und NEU: jeder einzelne Blitz gilt als
      // Wahl seines Ziels, Umleiter (Empty Armor & Co.) sehen ihn.
      await kettenblitz(engine, {
        quelle: { name: 'Chain Lightning', owner: pi, heroIdx: ctx.cardHeroIdx }, zone: 'hand',
        ziele: selectedTargets, alleZiele: targets, schaden: damages, typ: 'destruction_spell',
        start: { owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1 },
      });
    },
  },
};

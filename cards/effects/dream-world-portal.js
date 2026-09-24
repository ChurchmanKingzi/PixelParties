'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Dream World Portal"  (v1368) — Dream Landers
//  Spell (Normal) — Magic Arts Lv1
//
//  "Choose a Creature you control that can attach a Hero to itself and
//   attach an appropriate Hero from your hand or deck to it. This counts
//   as an additional Action."
//
//  · „can attach a Hero to itself": das Skript der Creature nennt
//    `attachableHeroes`, sie traegt noch keinen, und einer der passenden
//    Helden liegt in Hand oder Deck (`portalKandidaten`).
//  · Anlegen ueber `engine.actionAttachHeroToCreature` — derselbe Weg wie
//    der eigene Effekt der Creature (Flug, Boni ueber `onAttachHero`).
//    Hand oder Deck waehlt der Helfer selbst, wenn beides geht. Der eigene
//    Einmal-pro-Zug-Effekt der Creature bleibt unberuehrt.
//  · Zusatzaktion: `inherentAction: true`. Abbrechbar bis zur Creature-
//    Wahl (`gs._spellCancelled`).
// ═══════════════════════════════════════════
const { loadCardEffect } = require('./_loader');
const { portalKandidaten, zielVon } = require('./_dream-lander-shared');

const CARD_NAME = 'Dream World Portal';

module.exports = {
  inherentAction: true,
  spellVisual: { impact: { type: 'gold_sparkle' }, impactMs: 260 },

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return portalKandidaten(engine, pi, loadCardEffect).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const kandidaten = portalKandidaten(engine, pi, loadCardEffect);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }

      let wahl = kandidaten[0];
      if (kandidaten.length > 1) {
        const ziele = kandidaten.map(k => zielVon(k.inst));
        const r = await engine.promptEffectTarget(pi, ziele, {
          title: CARD_NAME, description: 'Choose a Creature you control to attach a Hero to.',
          confirmLabel: '🌀 Open the Portal!', cancellable: true, maxTotal: 1, maxPerType: { equip: 1 },
          sourceCard: ctx.card, _skipPostTargetReactions: true, _skipSurpriseCheck: true, _callerHandlesSurprise: true,
        });
        if (!r || r.length === 0) { gs._spellCancelled = true; return; }
        wahl = kandidaten.find(k => zielVon(k.inst).id === r[0]) || null;
        if (!wahl) { gs._spellCancelled = true; return; }
      }

      // Mehrere passende Helden → welcher?
      let held = wahl.helden[0];
      if (wahl.helden.length > 1) {
        const r = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
          description: `Which Hero should ${wahl.inst.name} carry?`,
          cards: wahl.helden.map(n => ({ name: n, source: 'hand' })), cancellable: false,
        });
        if (r?.cardName && wahl.helden.includes(r.cardName)) held = r.cardName;
      }

      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: wahl.inst.owner, heroIdx: wahl.inst.heroIdx, zoneSlot: wahl.inst.zoneSlot,
      });
      const ok = await engine.actionAttachHeroToCreature(pi, held, wahl.inst, { source: CARD_NAME });
      if (!ok) {
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'attach_failed' });
        return;
      }
      engine.log('dream_world_portal', { player: gs.players[pi]?.username, card: CARD_NAME, creature: wahl.inst.name, hero: held });
      engine.sync();
    },
  },
};

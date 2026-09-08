// ═══════════════════════════════════════════
//  CARD EFFECT: "Meteor Crash"
//  Spell (Destruction Magic Lv1 — seit v622, vorher Lv2)
//
//  „Choose a target and deal 100 damage to it. If you have not dealt
//   any damage yet this game, deal 300 damage instead."
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · „dealt any damage yet this game" liest den neuen Spielzaehler
//    `engine.damageDealtThisGame(pi)` (v622): Summe alles tatsaechlich
//    gefallenen Schadens mit einer Quelle dieses Spielers — jeder
//    Zieltyp, jede Seite (auch Rueckstoss auf eigene Helden zaehlt),
//    nie zurueckgesetzt. Der Betrag wird VOR der Zielwahl festgelegt
//    und im Prompt angezeigt.
//  · Beliebiges Ziel (beide Seiten, Held oder Kreatur), Typ
//    'destruction_spell' ueber die normalen Schadenspfade — Idas
//    Verstaerkung, Reduktionen, Reaktionen greifen wie ueblich.
//  · Auftritt `meteor_crash` (v623, eigene Klasse): ein gluehender
//    Brocken faellt von schraeg oben rechts ins Bild und crasht auf
//    das Ziel — Aufschlagblitz, Truemmer, Klang `heavy_impact`; beim
//    300er-Fall groesser (`intensity` 3).
// ═══════════════════════════════════════════

const CARD_NAME = 'Meteor Crash';
const DAMAGE_NORMAL = 100;
const DAMAGE_FIRST = 300;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      const firstBlood = engine.damageDealtThisGame(pi) === 0;
      const damage = firstBlood ? DAMAGE_FIRST : DAMAGE_NORMAL;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: damage,
        title: CARD_NAME,
        description: firstBlood
          ? `You have not dealt any damage this game — the meteor hits for ${DAMAGE_FIRST}! Choose a target.`
          : `Choose a target and deal ${DAMAGE_NORMAL} damage to it.`,
        confirmLabel: `☄️ ${damage} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!target) return;

      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'meteor_crash', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot,
        intensity: firstBlood ? 3 : 1, duration: 1700,
      });
      await engine._delay(560); // Aufschlag bei ~520 ms

      const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, controller: pi };
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'destruction_spell');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(source, target.cardInstance, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('meteor_crash', {
        player: gs.players[pi]?.username, target: target.cardName, damage, firstBlood,
      });
      engine.sync();
    },
  },
};

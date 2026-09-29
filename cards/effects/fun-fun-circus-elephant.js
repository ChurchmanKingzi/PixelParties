// ═══════════════════════════════════════════
//  CARD EFFECT: "Fun-Fun Circus Elephant"
//  Creature (Magic Arts / Summoning Magic Lv2, Normal, 120 HP) — PP MBS
//
//  „When you draw this card or add it to your hand, reveal it
//   permanently. While this card is revealed in your hand, put an
//   Applause Counter onto it whenever an Applause Counter is placed onto
//   any Creature on the board. When you summon this Creature, deal
//   damage to any target on the board equal to 10 times the number of
//   Applause Counters on this Creature when it is summoned."
//
//  ── UMSETZUNG ───────────────────────────────────────────────────────
//  • Aufdecken: `revealOnEnterHand: true` (Engine deckt bei Ziehen,
//    Tutor, Transfer und Todes-Anspruch auf).
//  • Mitzaehlen in der Hand: `collectsApplauseInHand: true` — der EINE
//    Platzier-Weg `placeApplause` (`_applause-shared`) erhoeht dann
//    `ps._handApplause[handIdx]` PRO platziertem Counter (auch fuer den
//    Elephant in der GEGNERISCHEN Hand). Das Hand-Index-Feld folgt der
//    physischen Kopie und wandert beim Beschwoeren als
//    `inst.counters.applause` aufs Brett (Engine-Registrierung).
//  • Beschwoerung: der Schaden liest die Zaehler der frischen Instanz —
//    „Counters on this Creature when it is summoned". Bei 0 passiert
//    nichts. Die Zielwahl ist NICHT abbrechbar: die Beschwoerung ist
//    schon geschehen (Zusagepunkt), der Text sagt „deal damage" ohne
//    „may". Die Zaehler bleiben danach auf der Creature.
// ═══════════════════════════════════════════

const CARD_NAME = 'Fun-Fun Circus Elephant';
const SCHADEN_PRO_COUNTER = 10;

module.exports = {
  activeIn: ['support'],
  revealOnEnterHand: true,
  collectsApplauseInHand: true,
  requiresTarget: true,


  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const n = ctx.card.counters?.applause || 0;
      if (n <= 0) return;
      const schaden = SCHADEN_PRO_COUNTER * n;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'normal',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Deal ${schaden} damage (10 × ${n} Applause Counters) to a target.`,
        confirmLabel: `🐘 ${schaden} Damage!`,
        confirmClass: 'btn-danger',
        // pflichtwahl: die Beschwoerung ist schon geschehen (Zusagepunkt), der Text sagt „deal damage" ohne „may"
        cancellable: false,
      });
      if (!ziel) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `elephant:${ctx.card.id}` });
      // Elefantenfuss zertritt das Ziel (Pixelanimation `elephant_stomp`,
      // 1000 ms, Aufprall bei 33 %): der Schaden faellt in den Aufprall
      // (100 ms Mount-Verzoegerung + 330 ms), der Rest der Animation laeuft aus.
      const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'elephant_stomp', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot, duration: 1100,
      });
      await engine._delay(440);

      if (ziel.type === 'hero') {
        const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, schaden, 'creature');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
          ziel.cardInstance, schaden, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      await engine._delay(560);   // Fuss hebt sich wieder, Ziel federt zurueck
      engine.sync();
    },
  },
};

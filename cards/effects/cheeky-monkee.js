// ═══════════════════════════════════════════
//  CARD EFFECT: "Cheeky Monkee"
//  Creature (Normal, Lv1, 20 HP, Summoning Magic)
//
//  "Once per turn, when you gain 4 or more Gold through an effect, you
//   may immediately pay that Gold to choose a target and deal 80 damage
//   to it."
//
//  ── Ausloeser ──
//  `afterResourceGain` — NACH der Buchung, damit das gerade gewonnene
//  Gold wirklich bezahlbar ist und die Anzeige beim Prompt schon den
//  neuen Stand zeigt (Als Vorgabe 8.8.). Was als Ausloeser zaehlt, steht
//  in `_monkee-shared.js` (eigener Gewinn, kein Rundeneinkommen, >= 4).
//
//  ── "pay that Gold" ──
//  Als Ruling: der GESAMTE gerade gewonnene Betrag, nicht zwingend 4.
//  Wer 12 auf einmal bekommt, zahlt 12.
//
//  ── "Once per turn" ──
//  SOFT, pro INSTANZ (Unterscheidung aus v249: der Wortlaut "Once per
//  turn" ohne "you can only ... per turn" ist die weiche Form). Zwei
//  Cheeky Monkees duerfen also je einmal feuern. Gezaehlt wird ueber
//  einen Rundenstempel auf der Instanz, NICHT ueber `onTurnStart` —
//  ein eingefrorener oder gestunter Monkee wuerde den sonst nie
//  zuruecksetzen (Als Regel 4.8.).
//
//  "a target" = jedes beliebige Ziel, Freund wie Feind, Held wie
//  Kreatur (Als Ruling 4.8.).
// ═══════════════════════════════════════════

const { monkeeGoldTrigger, goldSourceVerbraucht, verbraucheGoldSource } = require('./_monkee-shared');

const CARD_NAME = 'Cheeky Monkee';
const DAMAGE = 80;

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Gating, siehe cards/effects/_hooks.js.
  activeIn: ['support'],

  hooks: {
    afterResourceGain: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (ctx.card?.zone !== 'support') return;

      const betrag = monkeeGoldTrigger(ctx, pi);
      if (!betrag) return;
      // Hat schon ein anderer Monkee diese Goldquelle genommen? Dann ist
      // sie weg (Als Ruling 8.8.).
      if (goldSourceVerbraucht(ctx)) return;

      const inst = ctx.card;
      const counters = inst.counters || (inst.counters = {});
      if (counters._cheekyMonkeeTurn === gs.turn) return;

      // "pay that Gold" — ohne Deckung gar nicht erst fragen.
      if ((ps.gold || 0) < betrag) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `You gained ${betrag} Gold. Pay ${betrag} Gold to deal ${DAMAGE} damage to a target?`,
        showCard: CARD_NAME,
        confirmLabel: `🐒 Pay ${betrag} Gold!`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!bestaetigt || bestaetigt.cancelled) return;

      // Stempel VOR der Zahlung: das Bezahlen feuert `afterResourceSpend`,
      // was weitere Monkee-Effekte anstossen kann — ohne den Stempel
      // koennte dieser Monkee dabei erneut hereinlaufen.
      counters._cheekyMonkeeTurn = gs.turn;

      const bezahlt = await engine.actionSpendGold(pi, betrag);
      if (!bezahlt) return;
      // Die Quelle ist jetzt verbraucht — kein weiterer Monkee reagiert
      // auf dieses Gewinn-Ereignis.
      verbraucheGoldSource(ctx);

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target.`,
        confirmLabel: `💥 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!target) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(300);

      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h?.name && h.hp > 0) await ctx.dealDamage(h, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          ctx.card, target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('cheeky_monkee', {
        player: ps.username, goldPaid: betrag, damage: DAMAGE,
        target: target.cardName || target.type,
      });
      engine.sync();
    },
  },
};

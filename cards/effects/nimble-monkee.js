// ═══════════════════════════════════════════
//  CARD EFFECT: "Nimble Monkee"
//  Creature (Normal, Lv1, 20 HP, Summoning Magic)
//
//  "When you gain 4 or more Gold through an effect, you may immediately
//   summon this Creature from your hand as an additional Action by
//   paying that Gold. You can only summon 1 'Nimble Monkee' per turn."
//
//  Ausloeser und Zahlungsregel: siehe `_monkee-shared.js`.
//
//  ── "You can only summon 1 ... per turn" ──
//  HART, pro SPIELER (Unterscheidung aus v249: dieser Wortlaut ist die
//  harte Form — anders als Cheekys blosses "Once per turn"). Zwei
//  Nimble Monkees auf der Hand ergeben also trotzdem nur EINE
//  Beschwoerung je Zug. Gefuehrt ueber `gs.hoptUsed` mit einem Schluessel
//  je Spieler; die Sperre wird ERST beim tatsaechlichen Vollzug gesetzt,
//  ein Ablehnen kostet sie nicht.
//
//  ── "as an additional Action" ──
//  `summonCreatureWithHooks` verbraucht von sich aus keinen Aktionsplatz
//  (Vorbild Green Dragoneer, gleiche Bauart) — es wird also nichts
//  gebucht und nichts zurueckgegeben.
// ═══════════════════════════════════════════

const { monkeeGoldTrigger, eligibleSummonZones, goldSourceVerbraucht, verbraucheGoldSource } = require('./_monkee-shared');

const CARD_NAME = 'Nimble Monkee';
const HOPT_KEY = (pi) => `monkee-summon:${CARD_NAME}:${pi}`;
const RESOLVING = '_nimbleMonkeeResolving';

module.exports = {
  activeIn: ['hand'],

  hooks: {
    afterResourceGain: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (ctx.card?.zone !== 'hand') return;      // nur die Handkopie reagiert

      const betrag = monkeeGoldTrigger(ctx, pi);
      if (!betrag) return;
      // Hat schon ein anderer Monkee diese Goldquelle genommen? Dann ist
      // sie weg (Als Ruling 8.8.).
      if (goldSourceVerbraucht(ctx)) return;

      // Harte Sperre je Spieler und Zug.
      if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return;
      // Wiedereintritts-Riegel: mehrere Handkopien sind je eigene
      // Listener und wuerden sonst nacheinander fragen, obwohl nur eine
      // Beschwoerung erlaubt ist.
      if (gs[RESOLVING]?.[pi]) return;
      if (!(ps.hand || []).includes(CARD_NAME)) return;
      if ((ps.gold || 0) < betrag) return;

      if (eligibleSummonZones(engine, pi, CARD_NAME).length === 0) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `You gained ${betrag} Gold. Pay ${betrag} Gold to summon ${CARD_NAME} from your hand as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: `🐒 Pay ${betrag} Gold!`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!bestaetigt || bestaetigt.cancelled) return;

      const handIdx = (ps.hand || []).indexOf(CARD_NAME);
      if (handIdx < 0) return;                    // zwischenzeitlich weg

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[HOPT_KEY(pi)] = gs.turn;
      if (!gs[RESOLVING]) gs[RESOLVING] = {};
      gs[RESOLVING][pi] = true;
      try {
        const bezahlt = await engine.actionSpendGold(pi, betrag);
        if (!bezahlt) {
          delete gs.hoptUsed[HOPT_KEY(pi)];
          return;
        }
        // Die Quelle ist jetzt verbraucht — kein weiterer Monkee reagiert
        // auf dieses Gewinn-Ereignis.
        verbraucheGoldSource(ctx);
        // Zielplatz nach der Zahlung neu bestimmen und den Spieler
        // waehlen lassen, wenn es mehrere Moeglichkeiten gibt — wie bei
        // einer normalen Beschwoerung (Als Vorgabe 8.8.). Nicht
        // abbrechbar: bestaetigt und bezahlt ist bereits verbindlich.
        const zonen = eligibleSummonZones(engine, pi, CARD_NAME);
        if (zonen.length === 0) {
          engine.log('nimble_monkee_fizzle', { player: ps.username, reason: 'no_eligible_caster' });
          return;
        }
        let ziel = zonen[0];
        if (zonen.length > 1) {
          const wahl = await ctx.promptZonePick(zonen, {
            title: CARD_NAME,
            description: `Choose where to summon ${CARD_NAME}.`,
            cancellable: false,
          });
          const gewaehlt = wahl && zonen.find(z =>
            z.heroIdx === wahl.heroIdx && z.slotIdx === (wahl.slotIdx ?? wahl.zoneSlot));
          if (gewaehlt) ziel = gewaehlt;
        }
        const i = (ps.hand || []).indexOf(CARD_NAME);
        if (i < 0) return;
        ps.hand.splice(i, 1);
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

        const res = await engine.summonCreatureWithHooks(
          CARD_NAME, pi, ziel.heroIdx, ziel.slotIdx,
          { source: `${CARD_NAME} trigger` },
        );
        if (!res) {
          ps.hand.push(CARD_NAME);                // zurueck auf die Hand
          engine.log('nimble_monkee_fizzle', { player: ps.username, reason: 'place_refused' });
          return;
        }
        engine.log('nimble_monkee_summoned', {
          player: ps.username, goldPaid: betrag, hero: ziel.heroIdx, slot: ziel.slotIdx,
        });
        engine.sync();
      } finally {
        gs[RESOLVING][pi] = false;
      }
    },
  },
};

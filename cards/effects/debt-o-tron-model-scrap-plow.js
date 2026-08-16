// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Model Scrap Plow"
//  Artifact / Creature — Cost 0, 50 HP. Archetyp: Debt-O-Tron.
//
//  "You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. Once per turn, when you have negative Gold after spending Gold, you may choose any card on the board that is not a Hero and send it to the discard pile. Creatures sent this way count as being defeated. You can only control 1 "Debt-O-Tron Model Scrap Plow" at a time."
//
//  Gemeinsames Geruest in `_debt-o-tron-shared.modelBase`: spielbar nur
//  bei negativem Gold, Kosten sind 1 geloeschte Handkarte, und man kontrolliert hoechstens EINEN gleichzeitig (statt einer Zug-Sperre).
//
//  ── DER AUSLOESER ─────────────────────────────────────────────
//  „when you have negative Gold after spending Gold" haengt an
//  `afterResourceSpend`. Das traegt erst seit v405/v406: davor feuerten
//  KARTENKOSTEN diesen Hook gar nicht, der Ausloeser haette also
//  ausgerechnet bei „Debt-O-Tron Damage Fees" geschwiegen — der Karte,
//  die den Archetyp ueberhaupt ins Minus bringt.
//  Die Zaehlung „for every 10 Gold you spent in excess of your current
//  Gold" macht `debtTriggerCheck` an EINER Stelle fuer alle drei
//  Modelle, nach Als Formel `Betrag − max(0, GoldVorher)`.
//
//  „Creatures sent this way count as being defeated" — deshalb
//  `actionDestroyCard` mit Abwurf-Ziel statt eines stillen Verschiebens:
//  nur so feuern ON_CREATURE_DEATH und alles, was daran haengt.
// ═══════════════════════════════════════════

'use strict';

const { modelBase, debtTriggerCheck, debtChargesLeft } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Debt-O-Tron Model Scrap Plow';
const MAX_PER_TURN = 1;

const base = modelBase(CARD_NAME, { oncePerTurn: false, onlyOneAtATime: true });

module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): weiss, solange
  // Ladungen uebrig sind, rot bei 0. `remainingCharges` ist der
  // allgemeine Vertrag — jede Permanent-Karte mit „up to X times per
  // turn" kann ihn mit dieser einen Zeile bedienen.
  chargesPerTurn: MAX_PER_TURN,
  remainingCharges: (inst, gs) => debtChargesLeft(inst, gs, MAX_PER_TURN),
  ...base,
  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => { await base.payHandCost(ctx); },

    afterResourceSpend: async (ctx) => {
      const treffer = debtTriggerCheck(ctx, MAX_PER_TURN, CARD_NAME);
      if (!treffer) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // „any card on the board that is not a Hero" — beide Seiten,
      // Support- und Ability-Zonen, aber keine Helden.
      const ziele = [];
      for (const inst of (engine.cardInstances || [])) {
        if (inst.zone !== 'support' && inst.zone !== 'ability') continue;
        if (inst.faceDown) continue;
        ziele.push({
          id: `${inst.zone}-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
        });
      }
      if (ziele.length === 0) return;

      const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: `You overspent by ${treffer.excess} Gold. Send any non-Hero card on the board to the discard pile.`,
        confirmLabel: '🚜 Scrap it!',
        cancellable: true,
        selectCount: 1,
        minSelect: 1,
        gerrymanderEligible: true,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      if (!id) return;
      const ziel = ziele.find(t => t.id === id);
      if (!ziel?.cardInstance) return;

      // Erst JETZT verbuchen — der Spieler hat ein Ziel bestaetigt.
      // Vorher zog die Pruefung die Ladung sofort ab, ein Abbruch
      // kostete sie trotzdem (Als Report 16.8.).
      treffer.verbuche();

      engine.announceActiveEffect();
      // Signatur ist `(source, targetCard, opts)`. `fireCreatureDeath`
      // ist die Option, die „Creatures sent this way count as being
      // defeated" umsetzt — ohne sie wanderte die Karte still in den
      // Abwurf und ON_CREATURE_DEATH bliebe aus (Muster: „500 Piranhas
      // in a Monster Suit"). Der Abwurfstapel ist ohnehin das
      // Standardziel; Karten, die den Zerstoerungsversuch abfangen
      // (Cool Rescuer Monia & Co.), duerfen das weiterhin.
      const quelle = { name: CARD_NAME, owner: pi, heroIdx: ctx.card?.heroIdx ?? -1 };
      await engine.actionDestroyCard(quelle, ziel.cardInstance, {
        fireCreatureDeath: true,
      });
      engine.log('debt_scrap_plow', {
        player: ps.username, card: ziel.cardName, excess: treffer.excess,
      });
      engine.sync();
    },
  },
};

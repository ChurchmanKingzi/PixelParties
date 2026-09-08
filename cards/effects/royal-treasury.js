// ═══════════════════════════════════════════
//  CARD EFFECT: "Royal Treasury"
//  Spell / Attachment (Magic Arts Lv1)
//
//  „Up to 3 times per turn, when you gain Gold through another effect,
//   gain an additional 4/6/8 Gold, depending on the equipped Hero's
//   current Magic Arts level."
//
//  · Anlegen ueber `_attachment-shared.attachToOwnHero` (v649: EIN
//    Anlege-Vorgang fuer alle Attachments — Drop-Hinweise, Prompt,
//    Anti-Magic, Zone, Instanz, `_spellPlacedOnBoard`). Danach liegt die
//    Karte in der Support Zone des Wirts (`ctx.attachedHero`).
//  · Hook `afterResourceGain` NACH der Buchung (Monkee-Muster): nur
//    eigener Gewinn, kein Rundeneinkommen (`_isResourceGain`), Betrag > 0,
//    und NICHT der eigene Bonus (Marker `gs._royalTreasuryGain`) — „through
//    ANOTHER effect". Die Goldquelle wird nicht verbraucht (Monkees
//    duerfen weiter darauf reagieren; der Bonus ist eine eigene Quelle).
//  · Betrag nach AKTUELLEM Magic-Arts-Level des Wirts: 1 → 4, 2 → 6,
//    3 → 8 (Level 0 zaehlt wie 1 — die Karte lag schon, als der Level
//    fiel). Bis zu 3 Mal je Zug (`_charges`, mit Ladungsanzeige).
// ═══════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');

const CARD_NAME = 'Royal Treasury';
const USE_KEY = 'royal_treasury_uses';
const MAX_USES_PER_TURN = 3;
const BONUS = { 1: 4, 2: 6, 3: 8 };

module.exports = {
  activeIn: ['hand', 'support'],
  chargesPerTurn: MAX_USES_PER_TURN,
  chargeKey: USE_KEY,

  /** Spielbar, sobald ein eigener lebender Held eine freie Zone hat. */
  spellPlayCondition(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine).length > 0;
  },
  /** Empfaenger-Zonen fuers Ziehen (Engine-Vertrag). */
  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine);
  },

  hooks: {
    /** Anlegen (v649, ueber den geteilten Anlege-Vorgang). */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await attachToHero(ctx, CARD_NAME, {
        description: 'Attach Royal Treasury to a Hero you control. Up to 3 times per turn, Gold you gain through another effect brings 4/6/8 extra Gold (Magic Arts level of that Hero).',
        confirmLabel: '💰 Attach!', animationType: 'gold_sparkle', preferCaster: true,
      });
    },

    afterResourceGain: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const pi = inst.controller ?? inst.owner;
      if (ctx.playerIdx !== pi) return;
      if (ctx._isResourceGain) return;
      if (gs._royalTreasuryGain) return;               // eigener Bonus loest nicht erneut aus
      if (!((ctx.amount || 0) > 0)) return;
      const hero = ctx.attachedHero || gs.players[pi]?.heroes?.[inst.heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN }) <= 0) return;
      const ma = engine.countAbilitiesForSchool('Magic Arts', gs.players[pi]?.abilityZones?.[inst.heroIdx] || []);
      const bonus = BONUS[Math.min(3, Math.max(1, ma))];
      spendUse(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN });
      await engine.announceHookActivation(CARD_NAME, pi, { source: ctx._goldSource });
      gs._royalTreasuryGain = true;
      try {
        await engine.actionGainGold(pi, bonus, { source: CARD_NAME });
      } finally {
        delete gs._royalTreasuryGain;
      }
      engine.log('royal_treasury', {
        player: gs.players[pi]?.username, hero: hero.name, magicArts: ma, bonus,
        uses: MAX_USES_PER_TURN - usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN }),
      });
    },
  },
};

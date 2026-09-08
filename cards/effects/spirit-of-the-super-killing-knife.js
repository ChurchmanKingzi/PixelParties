// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Super-Killing Knife"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Super-Killing Knife, the Tool of Liquidation\". When you summon
//   this Creature, you may choose any other Creature on the board and
//   defeat it. While this Creature remains on the board, any Hero or
//   Creature that is defeated is deleted. When a Hero is deleted by
//   this effect, delete all cards in its Ability Zones.\"
//
//  Drei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE ueber `canPlayWithHero`.
//
//  ② BEIM BESCHWOEREN: eine beliebige ANDERE Creature auf dem Brett
//    faellt — beide Seiten, „you may\", also mit Abbruch.
//
//  ③ SOLANGE ER STEHT, wird jeder Tod zur Loeschung:
//    • Creatures: ueber die vorhandene Umleitung `_redirectToDeleted`
//      im `onCardLeaveZone` (Vorbild The Bonegrinder, Grave Worm) —
//      die Karte geht in den Deleted Pile statt in die Ablage.
//    • Helden: ein gefallener Held bleibt in seiner Spalte stehen, es
//      gibt fuer ihn keinen Stapel. „Geloescht\" heisst hier deshalb:
//      er traegt die Marke `_deletedByKnife` (fuer Wiederbelebungen und
//      spaetere Leser), und ALLE Karten in seinen Ability Zones werden
//      geloescht — das ist der sichtbare Teil, den der Kartentext
//      ausdruecklich nennt.
//
//  Die Aura greift auch fuer die eigene Seite: der Text sagt „any Hero
//  or Creature\", nicht „your opponent's\". Auch der Spirit selbst wird
//  geloescht, wenn er faellt — solange er noch steht, gilt seine Aura.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Spirit of the Super-Killing Knife';
const KNIFE = 'Super-Killing Knife, the Tool of Liquidation';

/** Traegt dieser Held das Messer? (Nach EFFEKTIVER Identitaet.) */
function hatMesser(engine, pi, heroIdx) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && c.owner === pi && c.heroIdx === heroIdx
    && !c.faceDown && (c.counters?._effectOverride || c.name) === KNIFE);
}

/** Steht irgendwo ein wirksamer Spirit? (Beide Seiten — „any\".) */
function spiritSteht(engine) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && !c.faceDown && c.name === CARD_NAME
    && !c.counters?.negated && !c.counters?.nulled);
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: { dealsDamage: true },

  /** ① „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hatMesser(engine, pi, heroIdx);
  },

  hooks: {
    /** ② Beim Beschwoeren: eine andere Creature faellt. */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const spirit = ctx.card;
      if (!spirit || ctx.playedCard?.id !== spirit.id) return;
      if (spirit.zone !== 'support') return;
      const pi = spirit.controller ?? spirit.owner;

      const ziele = [];
      for (const inst of (engine.cardInstances || [])) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        if (inst.id === spirit.id) continue;              // „any OTHER Creature\"
        const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (engine.isOmniImmune(inst)) continue;
        ziele.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
        });
      }
      if (ziele.length === 0) return;

      const wahl = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: 'You may defeat any other Creature on the board.',
        confirmLabel: '🔪 Liquidate',
        confirmClass: 'btn-danger',
        cancellable: true,                                // „you MAY\"
        previewCardName: CARD_NAME,
        maxTotal: 1, minRequired: 1,
      });
      if (!wahl || wahl.length === 0) return;
      const opfer = ziele.find(z => z.id === wahl[0])?.cardInstance;
      if (!opfer || opfer.zone !== 'support') return;

      await engine.actionDestroyCard(spirit, opfer, { sourceName: CARD_NAME });
      engine.sync();
    },

    /** ③a Creatures: Tod wird zur Loeschung. */
    onCardLeaveZone: (ctx) => {
      const engine = ctx._engine;
      const weg = ctx.leavingCard;
      if (!weg) return;
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone !== 'discard') return;               // nur der Weg in die Ablage
      if (!spiritSteht(engine)) return;
      const cd = engine.getEffectiveCardData(weg) || engine._getCardDB()[weg.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      weg._redirectToDeleted = true;
    },

    /** ③b Helden: restlos loeschen, Platz wird leer. */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const held = ctx.hero;
      if (!held?.name) return;
      if (!spiritSteht(engine)) return;
      if (held._deletedByKnife) return;                   // nur einmal

      let owner = -1, heroIdx = -1;
      for (let p = 0; p < (gs.players || []).length && heroIdx < 0; p++) {
        const hi = (gs.players[p]?.heroes || []).indexOf(held);
        if (hi >= 0) { owner = p; heroIdx = hi; }
      }
      if (heroIdx < 0) return;

      held._deletedByKnife = true;
      // `deleteHero` (v762) raeumt Ability Zones, Support Zones und den
      // Helden selbst ab — der Platz in der Spalte wird LEER (Als
      // Vorgabe 5.9.). Ein bloss gefallener Held bliebe stehen und
      // liesse sich wiederbeleben; „geloescht" heisst mehr als das.
      await engine.deleteHero(owner, heroIdx, CARD_NAME);
    },
  },
};

'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Junshi, the Tactical Genius"  (v1301)
//  Hero — 400 HP, 30 ATK — Leadership / Learning — PP MSCH
//
//  "Magic Arts Spells in your hand have their levels reduced by the
//   number of Creatures you control. Once per turn, during your
//   opponent's turn, when a Creature you control is defeated, you may
//   immediately perform a Magic Arts Spell from your hand as an
//   additional Action with this Hero."
//
//  ① Levelsenkung: `reduceCardLevel` — gilt fuer JEDE Magic-Arts-Karte
//     auf deiner Hand, egal welcher deiner Helden sie wirkt; nicht fuer
//     Deck-/Ablage-Pruefungen (`evalOpts.pileSide`). Ein negierter oder
//     besiegter Junshi senkt nichts.
//  ② Gegenschlag: Brett-Hook `onCreaturesDefeated` (v1301) — EIN Aufruf
//     je Vorgang, also auch bei einem Flaechenschlag nur ein Angebot.
//     „Once per turn" ist bei Heldeneffekten hart und pro Spieler
//     (Als Ruling 22.9., `_hero-hopt-shared`). Abgelehnt oder ohne
//     gespielten Spell bleibt der Ausloeser frei.
//  ③ Als Vorgabe 23.9.: Junshi muss den Spell auch WIRKEN koennen —
//     lebend, nicht Frozen/Stunned/Bound/Negated, passende Abilities.
//     Angeboten wird nur, wenn es mindestens einen solchen Spell gibt;
//     die Auswahl selbst laeuft ueber `performImmediateAction` (auf
//     Junshi gesperrt, nur Magic-Arts-Spells, mit Cancel). Sein Bild geht
//     zum Gegner, sobald der gewaehlte Spell ANFAENGT aufzuloesen
//     (`zusageAuftritt`, Als Vorgabe 23.9.).
// ═══════════════════════════════════════════
const { hasCardType, hasSpellSchool } = require('./_hooks');
const { heldenSperreFrei, heldenSperreSetzen, heldenSperreFreigeben } = require('./_hero-hopt-shared');

const CARD_NAME = 'Junshi, the Tactical Genius';
const SPERRE = 'junshi_gegenschlag';
const SCHULE = 'Magic Arts';

function istMagicArtsSpell(engine, name) {
  const cd = engine._getCardDB()[name];
  return !!cd && cd.cardType === 'Spell' && hasSpellSchool(cd, SCHULE);
}

function eigeneKreaturen(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
}

/** Der Held hinter dieser Instanz, sofern sein Effekt gerade wirkt. */
function heldWirkt(engine, inst) {
  const pi = inst?.controller ?? inst?.owner;
  const hero = engine.gs.players[pi]?.heroes?.[inst?.heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  return !hero.statuses?.negated;   // jede Form der Negation legt den Effekt still
}

module.exports = {
  activeIn: ['hero'],

  // ① „Magic Arts Spells in your hand have their levels reduced …"
  reduceCardLevel(cardData, engine, ownerIdx, inst, _heroIdx, evalOpts) {
    if (!cardData || cardData.cardType !== 'Spell' || !hasSpellSchool(cardData, SCHULE)) return 0;
    if (evalOpts?.pileSide) return 0;
    if (!inst || inst.zone !== 'hero' || !heldWirkt(engine, inst)) return 0;
    return eigeneKreaturen(engine, ownerIdx);
  },

  hooks: {
    // ② „Once per turn, during your opponent's turn, when a Creature you
    //    control is defeated, you may immediately perform …"
    onCreaturesDefeated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const hi = inst?.heroIdx;
      if (typeof hi !== 'number' || hi < 0) return;
      if (gs.activePlayer === pi) return;                                   // nur im gegnerischen Zug
      if (!(ctx.defeated || []).some(d => (d.controller ?? d.owner) === pi)) return;
      if (!heldenSperreFrei(gs, SPERRE, pi)) return;
      // ③ Junshi muss handeln und den Spell wirken koennen.
      if (!engine._heroCanAct(pi, hi)) return;
      const spells = engine.getHeroEligibleActionCards(pi, hi).filter(n => istMagicArtsSpell(engine, n));
      if (spells.length === 0) return;

      const hero = gs.players[pi].heroes[hi];
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `A Creature you control was defeated! Perform a Magic Arts Spell from your hand with ${hero.name} as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🧠 Counter!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ja) return;

      heldenSperreSetzen(gs, SPERRE, pi);
      // v1302 (Als Regel 23.9.): KEIN Auftritt hier — bis der Spell
      // verbindlich ist, kann noch abgebrochen werden. `zusageAuftritt`
      // zeigt Junshi erst in dem Moment, in dem der Spell feststeht.
      const res = await engine.performImmediateAction(pi, hi, {
        title: CARD_NAME,
        description: `Perform a Magic Arts Spell from your hand with ${hero.name}!`,
        allowedCardTypes: ['Spell'],
        cardNameFilter: (name) => istMagicArtsSpell(engine, name),
        zusageAuftritt: CARD_NAME,
      });
      if (!res?.played) heldenSperreFreigeben(gs, SPERRE, pi);   // nichts gespielt → Ausloeser bleibt frei
      engine.log('junshi_counter', { player: gs.players[pi]?.username, card: res?.cardName || null, played: !!res?.played });
      engine.sync();
    },
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },

  _test: { eigeneKreaturen, istMagicArtsSpell },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Model Missing Parts"
//  Artifact / Creature — Cost 0, 50 HP. Archetyp: Debt-O-Tron.
//
//  "You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. You may once per turn choose a target and deal damage equal to 10 times the amount of negative Gold you have to it."
//
//  Gemeinsames Gerüst in `_debt-o-tron-shared.modelBase`: spielbar nur
//  bei negativem Gold, Kosten sind 1 geloeschte Handkarte, hart einmal je Zug beschwoerbar.
//  Hier steht nur der eigene Effekt.
//
//  Die Schadensquelle des Archetyps. „10 times the amount of negative
//  Gold" — bei −7 also 70. `debt()` liefert den Betrag als POSITIVE
//  Zahl, damit die Multiplikation nicht versehentlich Heilung wird.
//  Steht man nicht im Minus, gibt es nichts zu schiessen.
// ═══════════════════════════════════════════

'use strict';

const { modelBase, debt } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Debt-O-Tron Model Missing Parts';
const HOPT_KEY = (pi) => `debt-missing-parts:${pi}`;
const PER_GOLD = 10;

/** Alle Ziele auf dem Brett — Helden und Kreaturen, beide Seiten.
 *  Gleiche Form wie in `logan-the-investment-monkee.js`; der Ziel-
 *  Sammler ist kein Familienwissen, deshalb bewusst NICHT im geteilten
 *  Debt-O-Tron-Modul. */
function alleZiele(engine) {
  const ziele = [];
  const gs = engine.gs;
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      ziele.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name });
    }
  }
  const cardDB = engine._getCardDB ? engine._getCardDB() : {};
  const { hasCardType } = require('./_hooks');
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    const cd = engine.getEffectiveCardData ? (engine.getEffectiveCardData(inst) || cardDB[inst.name]) : cardDB[inst.name];
    if (!hasCardType(cd, 'Creature')) continue;
    ziele.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    });
  }
  return ziele;
}

const base = modelBase(CARD_NAME);

module.exports = {
  ...base,
  requiresTarget: true,   // fuer die Blinded-Sperre, siehe _hooks.js

  hooks: {
    onPlay: async (ctx) => { await base.payHandCost(ctx); },
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return false;
    return debt(gs.players[pi]) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return;
    if (gs.hoptUsed?.[HOPT_KEY(pi)] === gs.turn) return false;

    const schaden = debt(ps) * PER_GOLD;
    if (schaden <= 0) return false;

    const ziele = alleZiele(engine);
    if (ziele.length === 0) return false;

    const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      description: `Deal ${schaden} damage to any target. (${debt(ps)} debt × ${PER_GOLD})`,
      confirmLabel: `💥 ${schaden} Damage!`,
      cancellable: true,
      // `selectCount`, nicht `maxSelect` — der Client faellt sonst auf
      // seinen Standard von DREI zurueck (v338, Als Befund an Logan).
      selectCount: 1,
      minSelect: 1,
      gerrymanderEligible: true,
    });
    const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
    // `return false` ist PFLICHT beim Abbruch: `doActivateCreatureEffect`
    // liest den Rueckgabewert und behandelt ALLES ausser `false` als
    // „hat aufgeloest" — es stempelt dann das Einmal-pro-Zug und zieht
    // ggf. die Aktion ein. Mit `return` (undefined) galt ein Abbruch als
    // Aufloesung fuer 0 Schaden (Als Report 16.8.).
    if (!id) return false;
    const ziel = ziele.find(t => t.id === id);
    if (!ziel) return false;

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[HOPT_KEY(pi)] = gs.turn;

    // Auftritt erst NACH bestaetigtem Ziel (Muster Book of Doom / Logan).
    engine.announceActiveEffect();
    const quelle = { name: CARD_NAME, owner: pi, heroIdx: ctx.card?.heroIdx };
    // FLAMMEN, deren Anzahl und Groesse mit dem SCHADEN skalieren (Als
    // Vorgabe 16.8.). Vorher lief hier `debt_incurred` mit der Zahl der
    // Schulden als `count` — das war der Muenz-Effekt und passte weder
    // bildlich noch in der Skalierung.
    engine._broadcastEvent('play_zone_animation', {
      type: 'debt_flames',
      owner: ziel.owner, heroIdx: ziel.heroIdx,
      zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
      damage: schaden,
    });
    await engine._delay(350);

    if (ziel.type === 'hero') {
      const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await engine.actionDealDamage(quelle, held, schaden, 'creature');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, schaden, 'creature',
        { sourceOwner: pi, canBeNegated: true });
    }
    engine.log('debt_missing_parts', {
      player: ps.username, damage: schaden, debt: debt(ps),
    });
    engine.sync();
  },
};

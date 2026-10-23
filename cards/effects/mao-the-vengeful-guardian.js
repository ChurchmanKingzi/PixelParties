// ═══════════════════════════════════════════
//  CARD EFFECT: "Mao, the Vengeful Guardian"
//  Hero — Cannibalism / Fighting
//  Archetype: Guardian Beasts.
//
//  PASSIVE: Once per turn, choose a Guardian Beast
//    Creature you control that was summoned this
//    turn. Delete 5 cards from EITHER discard pile
//    (player picks each card via the standard
//    Guardian Beast picker) to immediately re-
//    trigger that Creature's active effect (its
//    `onCreatureEffect` hook). After the effect
//    resolves, that Creature is Mao-negated until
//    the beginning of your next turn.
//
//  Restricted to Guardian Beast Creatures only —
//  Mao re-fires HIS archetype, not arbitrary
//  Creatures the player happens to control.
//
//  This is a HERO ACTIVE — exposed via the hero-
//  effect activation slot (the engine's "use Hero
//  effect" button). The activation costs a Main-
//  phase Action by default, like other hero
//  actives. HOPT keyed per (player, hero) so
//  Cannibalism / Performance copies can't
//  duplicate it.
// ═══════════════════════════════════════════

const {
  promptAndDeleteFromBothDiscards,
  isGuardianBeastCreature,
} = require('./_guardian-beasts-shared');
const { ablageLoeschKostenMoeglich } = require('./_guardian-beasts-shared');   // v1398

const CARD_NAME = 'Mao, the Vengeful Guardian';
const DELETE_COST = 5;

/** Returns true if `inst` qualifies for Mao's re-fire: own-controlled,
 *  face-up, in a support zone, IS a Guardian Beast Creature, summoned
 *  this turn, not negated/nulled, and has a re-fireable
 *  `onCreatureEffect` script. */
function isRefirable(engine, pi, inst) {
  const turn = engine.gs.turn || 0;
  if (inst.controller !== pi) return false;
  if (inst.zone !== 'support') return false;
  if (inst.faceDown) return false;
  if (!isGuardianBeastCreature(inst.name)) return false;
  if (inst.turnPlayed !== turn) return false;
  if (inst.counters?.negated || inst.counters?.nulled) return false;
  const script = inst.loadScript ? inst.loadScript() : null;
  if (!script?.creatureEffect || typeof script.onCreatureEffect !== 'function') return false;
  // W7b (A07-18, Al 14.10./15.10.): nur Bestien, deren Effekt auch NACH Maos bezahlten Kosten noch aktivierbar ist (dasselbe
  // Karten-Gate wie bei der normalen Aktivierung, `canActivateCreatureEffect`, gegen den Zustand mit 5 Karten weniger in den
  // Ablagen) - sonst zahlte Mao 5 Karten und negierte eine Bestie, die gar nicht feuern kann.
  if (!bestieNachZahlungAktivierbar(engine, inst, null)) return false;
  return true;
}

/**
 * Karten-Gate der Bestie gegen den Zustand NACH der Zahlung. `entfernen` = [{owner, idx}] (die gewaehlten Karten) oder
 * `null` = es genuegt EINE moegliche Zahlung (Bestcase: je Aufteilung auf die beiden Ablagen zuerst Nicht-Guardian-Beast-Karten
 * entfernen - die Gates der Bestien sind monoton, weniger Karten helfen nie). Die Ablagen werden nur fuer die synchrone Pruefung
 * durch gefilterte Kopien ersetzt und sofort zurueckgesetzt.
 */
function bestieNachZahlungAktivierbar(engine, inst, entfernen) {
  const spieler = [];
  for (let i = 0; i < engine.playerCount(); i++) spieler.push(engine.gs.players[i]);
  const mitEntfernt = (rm) => {
    const alt = spieler.map(p => p && p.discardPile);
    try {
      spieler.forEach((p, i) => {
        if (!p) return;
        const weg = new Set(rm.filter(r => r.owner === i).map(r => r.idx));
        p.discardPile = (alt[i] || []).filter((_, k) => !weg.has(k));
      });
      return engine.creatureEffectScriptAllows(inst);
    } finally { spieler.forEach((p, i) => { if (p) p.discardPile = alt[i]; }); }
  };
  if (entfernen) return mitEntfernt(entfernen);
  // je Ablage die Entfernungs-Reihenfolge: Nicht-Guardian-Beast-Karten zuerst
  const reihenfolge = spieler.map(p => ((p && p.discardPile) || []).map((n, k) => ({ n, k }))
    .sort((a, b) => Number(isGuardianBeastCreature(a.n)) - Number(isGuardianBeastCreature(b.n))));
  // alle Verteilungen der DELETE_COST Karten auf die Ablagen durchprobieren
  const probiere = (pile, rest, rm) => {
    if (pile === spieler.length) return rest === 0 && mitEntfernt(rm);
    for (let k = Math.min(rest, reihenfolge[pile].length); k >= 0; k--) {
      const mehr = reihenfolge[pile].slice(0, k).map(x => ({ owner: pile, idx: x.k }));
      if (probiere(pile + 1, rest - k, rm.concat(mehr))) return true;
    }
    return false;
  };
  return probiere(0, DELETE_COST, []);
}

/** All re-fireable Creatures for `pi`. Used by canActivate / runtime. */
function getRefirable(engine, pi) {
  return engine.cardInstances.filter(c => isRefirable(engine, pi, c));
}

/** All own face-up support-zone Creatures (eligible OR not). The picker
 *  surfaces these so the player can SEE everything they control, with
 *  ineligible ones grayed out via `ineligible: true`. */
function getOwnVisibleCreatures(engine, pi) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.controller !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    // v1398 (Als Ruling 25.9.): Löschkosten aus der Ablage unter Knight-[B]-Lockdown → nicht aktivierbar.
    if (!ablageLoeschKostenMoeglich(ctx)) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    // Cost may be paid out of EITHER discard pile, so the combined
    // total is what matters — same gate as the Guardian Beast Creatures.
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < DELETE_COST) return false;
    if (getRefirable(engine, pi).length === 0) return false;
    return true;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const refirable = getRefirable(engine, pi);
    if (refirable.length === 0) return false;
    const totalDiscards = (gs.players[0]?.discardPile?.length || 0)
      + (gs.players[1]?.discardPile?.length || 0);
    if (totalDiscards < DELETE_COST) return false;

    // Step 1: pick which Creature to re-fire. Surface ALL own face-up
    // support-zone Creatures so the player can see what they control;
    // mark anything that doesn't pass the refirable filter (wrong
    // turn, negated/nulled, no onCreatureEffect) as `ineligible: true`
    // so the picker dims it and rejects clicks. Same pattern as Shu.
    const visible = getOwnVisibleCreatures(engine, pi);
    const targets = visible.map(inst => ({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner: pi, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
      ineligible: !isRefirable(engine, pi, inst),
    }));
    const pickedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Choose a Guardian Beast Creature you summoned this turn. Delete ${DELETE_COST} cards from the discard piles to re-fire its active effect (Creature is then Mao-negated until your next turn).`,
      confirmLabel: 'Activate',
      cancellable: true,
      maxTotal: 1, minSelect: 1,
      exclusiveTypes: false,
    });
    if (!pickedIds || pickedIds.length === 0) return false;
    const pickedTarget = targets.find(t => t.id === pickedIds[0]);
    if (!pickedTarget?.cardInstance) return false;
    const inst = pickedTarget.cardInstance;

    // Step 2: pay the deletion cost — exactly 5 cards picked from
    // EITHER discard pile via the standard Guardian Beast picker. The
    // player chooses each card individually; the picker grays out
    // confirm at any count != 5. Cancelling here aborts the activation
    // BEFORE the chosen Creature is touched.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: [DELETE_COST],
      title: CARD_NAME,
      description: `Pick exactly ${DELETE_COST} cards from the discard piles to delete and re-fire ${inst.name}'s effect.`,
      sourceName: CARD_NAME,
      cancellable: true,
      // W7b (A07-18, Al 15.10.): nur eine Zahlung, nach der die Bestie noch feuern kann (Neu-Abfrage sonst).
      validatePicks: (picks) => bestieNachZahlungAktivierbar(engine, inst, picks.map(p => ({ owner: p.owner, idx: p.idx }))),
    });
    if (!deleted || deleted.length < DELETE_COST) {
      engine.log('mao_fizzle', {
        player: ps.username, reason: 'partial_delete_or_cancel',
        deleted: deleted ? deleted.length : 0,
      });
      return false;
    }

    // Step 3: fire the chosen Creature's active effect. We call the
    // script's onCreatureEffect with a fresh context anchored to the
    // creature inst — same shape the engine uses for normal creature
    // effects (server.js doActivateCreatureEffect).
    const script = inst.loadScript();
    if (typeof script?.onCreatureEffect !== 'function') return false;
    const fireCtx = engine._createContext(inst, { event: 'maoRefire' });
    // W7b (A07-18, Al 15.10.): Zahlung geleistet, Bestie gewaehlt → der Effekt ist UNABBRECHBAR (Pflichtwahl wie Cold Coffin/Cataclysm):
    // Zielwahlen und Abfragen in der Bestie haben keinen Abbruch-Knopf (`_forceNonCancellable`, v741), die 5 Karten werden nie zurueckgegeben.
    engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;
    try {
      await script.onCreatureEffect(fireCtx);
    } catch (err) {
      console.error(`[Mao] re-fire of ${inst.name} threw:`, err.message);
    } finally {
      engine._forceNonCancellable--;
    }

    // Step 4: negate the Creature until the activator's next turn.
    // The buffKey is `mao_negated` so the status badge / hover-tooltip
    // surfaces as "Mao-Negated" (matches the BUFF_ICONS entry in
    // app-shared.jsx).
    // `gs.turn` zaehlt pro Spielerwechsel: naechste eigene Runde = +2 (A07-28).
    await engine.actionNegateCreature(inst, CARD_NAME, {
      gwSourceOwner: pi,   // W17b: eigene Kosten – Golden Wings schützt nur gegen den Gegner
      expiresAtTurn: gs.activePlayer === pi ? gs.turn + 2 : gs.turn + 1,
      expiresForPlayer: pi,
      fristBeginn: true,   // W68a: „until the beginning of your next turn"
      buffKey: 'mao_negated',
      removeAnim: 'negate_release',
    });

    engine.log('mao_refire', {
      player: ps.username, target: inst.name, deleted: deleted.length,
    });
    engine.sync();
    return true;
  },
};

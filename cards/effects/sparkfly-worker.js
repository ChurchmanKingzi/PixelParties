// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparkfly Worker"
//  Creature (Summoning Magic, Lv 1, Sparkfly) — 50 HP
//
//  • On summon — only if you currently control a "Sparkfly Queen" —
//    you may pick any non-Hero card on the board (either side, scope
//    matches "The Yeeting") and add it to your hand. Hard once per
//    turn so re-summons (Reincarnation, Necromancy, etc.) can't
//    re-fire the steal.
//  • When sacrificed to summon Sparkfly Queen (via Hive's Crown), the
//    Queen permanently gains a once-per-turn ability: the OPPONENT
//    picks any non-Hero card on their side of the board and adds it
//    to your hand. The Queen-side gift is stamped by Hive's Crown's
//    resolve; this file owns the live on-summon trigger only.
//
//  Stolen cards are pinned to their original owner via
//  `inst.originalOwner` so when they leave the thief's hand later
//  they route to the original owner's discard / deleted / deck pile,
//  matching the Magic Lamp gifted-card convention.
// ═══════════════════════════════════════════

const {
  findControlledQueen,
  collectNonHeroBoardTargets,
  stealBoardCardToHand,
} = require('./_sparkfly-shared');

const CARD_NAME = 'Sparkfly Worker';

module.exports = {
  // BORIS-EINSCHRAENKUNG (Klausel 1, Als Praezisierung 5.8.): nimmt eine beliebige Nicht-Held-Karte vom Brett auf die eigene Hand.
  // Trifft jede Nicht-Held-Karte auf dem GESAMTEN Brett — deshalb NICHT sperren, sondern bei
  // wirksamem Boris beim Gegner nur dessen Seite ausblenden. Solange
  // es eigene legale Ziele gibt, bleibt der Effekt nutzbar.
  stealsFromEitherSide: true,

  requiresTarget: true,
  activeIn: ['support'],
  blockedByHandLock: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;
      if (ps.handLocked) return;

      // Gate: only fires while a Queen is controlled.
      if (!findControlledQueen(engine, pi)) return;

      // HARD once-per-turn (player-level) — only one Worker steal per
      // turn total, even with multiple Workers in play. Pre-check
      // without claiming so cancelling the picker doesn't burn the
      // slot. Stored at `gs.hoptUsed[key:pi]` per the engine's
      // canonical HOPT registry.
      if (engine.gs.hoptUsed?.[`sparkfly-worker-steal:${pi}`] === engine.gs.turn) return;

      const targets = collectNonHeroBoardTargets(gs, engine);
      // Don't offer the just-summoned Worker as a steal target — it would
      // self-bounce and silently break the summon-resolution flow.
      // BORIS-EINSCHRAENKUNG (Als Praezisierung 5.8.): hat der Gegner
      // einen wirksamen Boris, faellt SEINE Brettseite weg — die eigene
      // bleibt waehlbar. Bleibt nichts uebrig, greift der
      // "keine Ziele"-Ausstieg direkt darunter.
      const nurEigene = engine.borisHidesOpponentSide?.(pi) === true;
      const filteredTargets = targets
        .filter(t => t._cardInstance?.id !== ctx.card?.id)
        .filter(t => !nurEigene || (t.owner ?? t._cardInstance?.owner) === pi);
      if (filteredTargets.length === 0) return;

      const picked = await engine.promptEffectTarget(pi, filteredTargets, {
        title: CARD_NAME,
        description: 'Pick any non-Hero card on the board and add it to your hand.',
        confirmLabel: '🪲 Steal!',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1, ability: 1, perm: 1, area: 1, surprise: 1 },
      });
      if (!picked || picked.length === 0) return;

      const sel = filteredTargets.find(t => t.id === picked[0]);
      if (!sel?._cardInstance) return;

      // Commit — claim the player-level HOPT now and resolve.
      ctx.hardOncePerTurn('sparkfly-worker-steal');
      await stealBoardCardToHand(engine, pi, sel._cardInstance, CARD_NAME);
    },
  },
};

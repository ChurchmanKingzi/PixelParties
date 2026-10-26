// ═══════════════════════════════════════════
//  CARD EFFECT: "Hydra Blood Arrow"
//  Artifact (Reaction, cost 5)
//
//  Play in reaction to an Attack by a Hero you
//  control. Reduce that Attack's damage to 0 and
//  apply 1 Poison Stack to the target for every
//  30 full damage the Attack would have dealt
//  instead.
//
//  Als Ruling (Al 26.10.): „bei Hydra Blood Arrow passt es so, dass JEDER
//  Hero es triggern kann" — der Kartentext sagt „when a Hero hits …" (ohne
//  „you control"): der Pfeil darf auch auf die Attack eines GEGNERISCHEN
//  Helden ausgelöst werden (`anyHero`; Schaden 0, Gift am Ziel der Attack,
//  Quelle des Gifts = Spieler des Pfeils).
//
//  Als Ruling (Al 26.10.): „Eine andere Regel, die dann für ALLE True-Damage-
//  Sources gelten soll: Diese können Hydra Blood Arrow schlicht nicht aktivieren."
//  Der Pfeil wird NICHT angeboten (auch nicht der CPU), wenn der Schaden der
//  Attack unreduzierbar ist („cannot be reduced"): Surefire Shot, ein mit Elixir
//  of Strength verstärkter Treffer, Club of Gobbo am Angreifer — EIN Prädikat,
//  `engine._attackSchadenUnreduzierbar` (Option `blockUnreducible` der Bedingung).
//  Das Fenster öffnet VOR der Zielwahl; was erst das Ziel unreduzierbar macht
//  (Tempeste, Gigantisaur Brachion …), fängt `applyArrowsBeforeDamage` je Treffer ab:
//  ein unreduzierbarer Treffer wird nie auf 0 gesenkt (der Pfeil ist dann verbraucht).
//
//  Implementation detail: the "would have dealt"
//  amount is the post-flat-bump but pre-zero
//  value — so if an Angelfeather Arrow chained
//  first (+60), Hydra Blood sees the boosted
//  total and its poison-stacks count scales
//  accordingly. `_arrows-shared.js` stashes that
//  value on each armed arrow as
//  `_preZeroDamage`; the afterDamage pass reads
//  it and floor-divides by 30 for the stack
//  count.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Hydra Blood Arrow';

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx, { anyHero: true, blockUnreducible: true }),

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    armAttackerWithArrow(engine, pi, chain, {
      setAmount0: true,
      poisonStacksPer: 30,
      anyHero: true,
      sourceCard: CARD_NAME,
    });
    engine.log('arrow_armed', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME });
    engine.sync();
  },
};

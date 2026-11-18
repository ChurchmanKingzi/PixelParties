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
//  Ruling (Al 26.10.): „Eine andere Regel, die dann für ALLE True-Damage-
//  Sources gelten soll: Diese können Hydra Blood Arrow schlicht nicht aktivieren."
//  ★ ÜBERHOLT durch die Spielgestalter-Entscheidung 16.11.2026 („Nutzlose Aktivierungen
//  müssen möglich sein"): Der Pfeil wird auch gegen Attacks angeboten, deren Schaden
//  QUELLEN-seitig unreduzierbar ist („cannot be reduced": Club of Gobbo am Angreifer, ein
//  Elixir-Treffer, True-Damage-Attacks) — mit Hinweis in der Frage (`reactionUselessHint`);
//  die CPU wählt es nicht. Gespielt/bezahlt/verbraucht wird wie immer, der Pfeil wirkt dann
//  aber nicht (`resolve`: weder Null noch Gift; der Schaden geht durch). Ausnahmen, die
//  bleiben: Surefire Shot („cannot be reacted to": kein Reaktionsfenster überhaupt) und ein
//  bereitstehender Elixir of Strength des Angreifers (Option `blockUnreducible` der Bedingung:
//  „die müssen sich ausschließen", Ruling Al 26.10.). Das Fenster öffnet VOR der Zielwahl.
//
//  Als Ruling (Al 26.10.): „Hydra Arrow *darf nicht* zusammen mit Elixir of Strength an
//  irgendwas angekettet werden, die müssen sich ausschließen." Ein bereitstehender
//  Elixir of Strength (Buff `empowered_strike`) des angreifenden Helden sperrt die Hydra
//  bei JEDER Attack — auch bei Mehrziel-Attacks (Ricochet, Whirlwind Strike) und
//  virtuellen Attack-Ketten (Bamboo Staff & Co.); umgekehrt nimmt der Elixir keinen
//  Helden mit scharfer Hydra als Ziel (`elixir-of-strength.js`).
//
//  Als Ruling (Al 26.10.): ZIEL-seitiges „cannot be reduced" (Tempeste, Prophecy of
//  Tempeste, Gigantisaur Brachion, Monia Bot, Test Dummy …) hält Hydra NICHT auf:
//  „in dem Fall wird der Schaden ganz normal zu 0 und in Gift konvertiert. Der Pfeil
//  macht den Schaden zu 0, *bevor* er trifft, das umgeht Effekte am Ziel."
//
//  Als Ruling (Al 26.10.): „Immer Hydra Blood Arrow nach ALLEN anderen
//  Schadens-Modifikatoren!" — die Null (`applyArrowsZero`, Stufe 2) setzt erst, wenn
//  der Betrag feststeht (Elixir, andere Pfeile, Darge, Unreasonable Anger, Disruption
//  Ray, Warhorse, Buffs/Boni am Angreifer und am Ziel); die Giftstapel kommen aus
//  diesem ENDBETRAG (1 je volle 30). Schilde und Reaktionen am Ziel sehen schon die 0.
//
//  Implementation detail: the "would have dealt" amount is the FINAL amount of
//  the hit (all modifiers applied) — so if an Angelfeather Arrow chained
//  first (+60), Hydra Blood sees the boosted total and its poison-stacks
//  count scales accordingly. `_arrows-shared.js` stashes that value per target
//  on each armed arrow (`_preZeroByTarget`, `_preZeroDamage`); the afterDamage
//  pass reads it and floor-divides by 30 for the stack count.
// ═══════════════════════════════════════════

const { arrowTriggerCondition, armAttackerWithArrow } = require('./_arrows-shared');

const CARD_NAME = 'Hydra Blood Arrow';

module.exports = {
  isReaction: true,
  isArrow: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) =>
    arrowTriggerCondition(gs, pi, engine, chainCtx, { anyHero: true, blockUnreducible: true }),

  /** Quellen-seitig unreduzierbarer Attack-Schaden: die Aktivierung bleibt erlaubt, wirkt aber nicht (Hinweis fuer die Frage; die Engine laesst die CPU sie nicht waehlen). */
  reactionUselessHint: (gs, pi, engine, chainCtx) => {
    const initial = chainCtx?.chain?.find(l => l.isInitialCard);
    return (initial && engine?._attackSchadenUnreduzierbar?.({ link: initial })) ? 'This Attack\'s damage cannot be reduced.' : null;
  },

  resolve: async (engine, pi, _sel, _val, chain, _idx) => {
    // Spielgestalter-Entscheidung 16.11.2026: gegen unreduzierbaren Schaden bezahlt, aber wirkungslos (keine Null, kein Gift).
    const _initial = chain?.find?.(l => l.isInitialCard);
    if (_initial && engine._attackSchadenUnreduzierbar?.({ link: _initial })) {
      engine.log('arrow_useless', { player: engine.gs.players[pi]?.username, arrow: CARD_NAME, reason: 'damage_cannot_be_reduced' });
      engine.sync();
      return;
    }
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

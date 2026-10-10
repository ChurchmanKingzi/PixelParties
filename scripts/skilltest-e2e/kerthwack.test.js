'use strict';
// Kerthwack, the Reality Breaker: reine Deckbau-Karte („your Potion Deck may contain any card, but only up to 2 copies of each card …").
// Im Spiel tut sie nichts — insbesondere gilt die Zieh-Sperre der STRENGEN Potion-Deck-Helden (Chaos-Diamond, Pinta) fuer sie NICHT:
// mit Kerthwack im Team zieht man aus dem Potion Deck (Alchemy & Co.), und jede Karte darin kommt wie ein Potion auf die Hand.
// Die Deckbau-Regeln selbst pruefen `scripts/check-potion-deck-clauses.js` und `ui-deck-rules.js`.
//   node scripts/skilltest-e2e/kerthwack.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
const { GameEngine } = require('../../cards/effects/_engine');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const KERTH = 'Kerthwack, the Reality Breaker';
const CHAOS = 'Chaos-Diamond, the Cracked Keeper';

/** Ein Spiel mit `heroes[0]` auf BEIDEN Sitzen; getestet wird am Sitz am Zug. */
async function fresh({ heroes = [KERTH], potion = [] } = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try {
    out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11,
      mutatePrep: (prep) => { for (const p of prep.players) heroes.forEach((h, i) => { p.heroes[i] = h; }); } });
  } finally { console.log = oL; console.error = oE; }
  const { engine, gs } = out;
  const seat = gs.activePlayer, ps = gs.players[seat];
  gs.turn = 5; gs.currentPhase = 2;
  ps.potionDeck = potion.slice();
  ps.hand = [];
  return { engine, gs, seat, ps };
}

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(KERTH);
    check('es gibt ein Heldenskript (Karte gilt als umgesetzt)', !!s && Array.isArray(s.activeIn) && s.activeIn.includes('hero'), s && Object.keys(s));
    check('…ohne Spiellauf-Effekt: kein Heldeneffekt, kein Stempel-Hook', !!s && !s.heroEffect && !(s.hooks && s.hooks.onGameStart), s && Object.keys(s));
  }

  console.log('Im Spiel: Ziehen aus dem Potion Deck bleibt möglich');
  {
    const t = await fresh({ heroes: [KERTH], potion: ['Barkeeper', 'Planet in a Bottle', 'Fire Bolts'] });
    check('Kerthwack steht als Held auf dem Brett', t.ps.heroes[0]?.name === KERTH, t.ps.heroes.map(h => h && h.name));
    check('KEINE Zieh-Sperre (anders als Chaos-Diamond/Pinta) und kein Starthelden-Stempel', !t.ps.potionDrawBanned && t.ps.heroes[0]._startingHeroOf === undefined, [t.ps.potionDrawBanned, t.ps.heroes[0]._startingHeroOf]);
    const gezogen = await GameEngine.prototype.actionDrawFromPotionDeck.call(t.engine, t.seat, 3);
    check('alle drei Karten werden gezogen — auch die Nicht-Potions (Creature, Spell)', JSON.stringify(gezogen) === JSON.stringify(['Barkeeper', 'Planet in a Bottle', 'Fire Bolts']), gezogen);
    check('…und liegen auf der Hand, das Potion Deck ist leer', t.ps.hand.length === 3 && t.ps.potionDeck.length === 0, { hand: t.ps.hand, deck: t.ps.potionDeck });
  }

  console.log('Gegenprobe: mit einem strengen Klausel-Helden daneben bleibt dessen Sperre bestehen');
  {
    const t = await fresh({ heroes: [CHAOS, KERTH], potion: ['Fire Bolts', 'Cure'] });
    check('Chaos-Diamond + Kerthwack: das Ziehen aus dem Potion Deck bleibt gesperrt (die strenge Klausel gewinnt)', t.ps.potionDrawBanned === true);
    const gezogen = await GameEngine.prototype.actionDrawFromPotionDeck.call(t.engine, t.seat, 1);
    check('…es kommt nichts auf die Hand', gezogen.length === 0 && t.ps.potionDeck.length === 2, gezogen);
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Kerthwack grün');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

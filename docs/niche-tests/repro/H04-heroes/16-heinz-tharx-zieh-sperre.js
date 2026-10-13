'use strict';
// H04-16 · Visionary Genius Heinz / Tharx: unter Zieh-Sperre (`drawLocked`) bzw. Handsperre wird die Kostenseite bezahlt, gezogen wird nichts
//
// Heinz: „You may once per turn discard up to 4 copies of the same card to draw that many cards."
// Tharx: „You may once per turn draw as many cards as you control Creatures that were not summoned this turn."
// Erwartung: Wenn Ziehen gesperrt ist (The Sacred Jewel / Prayer setzen `ps.drawLocked`), ist die Aktivierung nicht möglich (Heinz prüft
//   `handLocked` schon in `canActivateHeroEffect` – dieselbe Absicht: kein Abwurf ohne Nachziehen) bzw. verbrennt zumindest nicht die Karten.
// Beobachtet: Heinz wirft die gewählten Kopien ab, `actionDrawCards` liefert [] (drawLocked), die Einmal-pro-Zug-Sperre ist verbraucht.
//   Tharx (unter `handLocked`): Bestätigung "Draw N cards?", 0 Karten, Einmal-Sperre verbraucht.
// Ursache: visionary-genius-heinz.js `canActivateHeroEffect` prüft nur `ps.handLocked`, nicht `ps.drawLocked`;
//   tharx-the-never-losing-general.js prüft keine der beiden Sperren.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const HZ = 'Visionary Genius Heinz', TX = 'Tharx, the Never-Losing General';
  const heroes = [[HZ, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
  const mk = async (hs, hand) => { const t = await H.fresh({ heroes: hs, hand: [hand, []] }); await t.run(() => t.engine.runHooks('onGameStart', {})); return t; };

  // Heinz unter Zieh-Sperre
  let t = await mk(heroes, ['Fireball', 'Fireball', 'Fireball', 'Icebolt']);
  t.gs.players[0].drawLocked = true;
  t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [0, 1, 2].map(i => ({ cardName: 'Fireball', handIndex: i })) }), once: true });
  const r = await t.activateHero(0, 0, { effect: HZ });
  R.note('Heinz drawLocked', JSON.stringify({ r, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') }));
  R.check('Heinz: unter Zieh-Sperre werden keine Karten abgeworfen', t.pile(0, 'discardPile').length === 0, { disc: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });

  // Tharx unter Handsperre
  t = await mk([['Tharx, the Never-Losing General', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], []);
  const c = t.put(0, 1, 0, H.INERT.creature); c.turnPlayed = 1;
  t.gs.players[0].handLocked = true;
  const h0 = t.pile(0, 'hand').length;
  const r2 = await t.activateHero(0, 0, { effect: TX });
  const verbraucht = Object.keys(t.gs.hoptUsed || {}).some(k => k.includes('Tharx'));
  R.note('Tharx handLocked', JSON.stringify({ r2, gezogen: t.pile(0, 'hand').length - h0, verbraucht }));
  R.check('Tharx: unter Handsperre wird die Einmal-Sperre nicht für nichts verbraucht', !verbraucht, { r2, verbraucht });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

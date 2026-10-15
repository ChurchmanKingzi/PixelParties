'use strict';
// C03-creatures-13 · Inconspicuous Lawn Gnome: „once per turn" gilt getrennt für Hand und Brett – im selben Zug zweimal umstellbar
// Kartentext: „You may once per turn change this card's level in your hand or on your side of the board to any level from 0 to 3."
// Aufbau: Sitz 0: Held 0 mit Summoning Magic 3, Gnom auf der Hand. Zug: (1) in der Hand auf Stufe 2 stellen (`doHandActivate`), (2) Gnom spielen, (3) auf dem Brett
//   auf Stufe 3 stellen (`doActivateCreatureEffect`).
// ENTSCHIEDEN (Al, Welle 11, Q79): „Nur einmal pro Runde insgesamt!" = Lesart A (Repro prüft sie; ✓ seit W11c). Kartentext in `data/cards.json` angepasst.
// Lesart A (eine Nutzung je Zug und Karte): Schritt (3) ist gesperrt. Lesart B (je Zone): zulässig. Der Text sagt „once per turn … in your hand OR on your side" – ein Ein-Zug-Kontingent.
// Beobachtet: Schritt (3) wird angenommen (zwei Stufenänderungen im selben Zug); die Hand-Stufe (2) geht beim Spielen verloren (Brettstufe zurück auf Basis 0).
// Ursache: Hand-Sperre `_revealedThisTurn` (`_engine.js` `doHandActivate`) und Brett-Sperre `creature-effect:<instId>` sind getrennte Stempel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const G = 'Inconspicuous Lawn Gnome';
  const t = await H.fresh({ hand: [[G], []] });
  t.setAbilities(0, 0, [Array(3).fill('Summoning Magic'), [], []]);
  t.script.push({ match: d => d.title === G, answer: () => ({ optionId: 'lvl2' }) });
  t.gs.activePlayer = 0; t.phase(2);
  const r1 = await t.run(() => t.engine.doHandActivate(0, G, 0));
  const p = await t.play(0, G, { hero: 0, slot: 0, noGrant: true });
  const g = t.inst(c => c.name === G && c.zone === 'support')[0];
  g.turnPlayed = 1;
  t.script.length = 0;
  t.script.push({ match: d => d.title === G, answer: () => ({ optionId: 'lvl3' }) });
  t.gs.activePlayer = 0; t.phase(2);
  const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  R.note('Hand-Aktivierung / Spielen / Brett-Aktivierung', [r1, p, r2]);
  R.note('effektive Stufe auf dem Brett', t.engine.getEffectiveCardData(g)?.level);
  R.check('zweite Stufenänderung im selben Zug wird NICHT angenommen (eine Nutzung je Zug)', r2 === false, { r1, p, r2 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

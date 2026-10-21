'use strict';
// W39a · a-06 · Duel: jeder Duellant "performs a normal Attack" und trifft genau EIN Ziel — Attack-Leser beider Duellanten
// Auftrag (Al, 22.10.2026): "Es gibt viele Karten, die triggern, wenn eine Attack ausgeführt wird … Reagieren die auch ALLE schon auf Broghan und co?" — Regel (W32a/W34a/W35a): Effekte, die als Attack eines
// Helden zählen, lösen JEDEN Attack-Leser genauso aus wie eine echte Attack. Matrix: Leser × Quellen (Referenz "Echte Attack"; Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle,
// Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light, Duel) × beide Sitze × Heldenziel/Kreaturenziel (`_helfer.js`, `_leser.js`, `_pruefe.js`).
// Ursache: Duel wählt keine Ziele (Schadensprotokoll leer) und meldete nur für den Spieler der Karte `afterSpellResolved` (ohne getroffenes Ziel); der zweite Duellant fehlte ganz. Leser wie Frostbringer, Nieht, Reiza,
// Vinepire, Warhorse, The Master's Sword, Zsos'Ssar, Heart of Ice sahen den Schlag nicht.
// Fix: `duell(…, { meldeAttacken })`: der Gegner von A steht im Schadensprotokoll der Karte (A: die Karte meldet selbst); für B zählt und meldet das Duell einmal eine Attack (Zähler + `afterSpellResolved`).
// Bewusst nicht: Fenster/Schutz, die an das WAEHLEN eines Ziels hängen ("is chosen": Flooding, Challenge, Anti-Magnet, Test Flight … — Duel wählt keine Ziele, Kopfkommentar `_hero-duel-shared.js`).
// Beobachtung Basis: Frostbringer, Nieht, Reiza, Vinepire, Warhorse, Master's Sword, Zsos'Ssar, Heart of Ice lösen bei Duel nicht aus.
// Aufruf: node docs/niche-tests/repro/W39/a-06-duel-beide-duellanten-lesen-und-melden.js   (Exit 0 = korrekt; auf der Basis 72ed5383 Exit 1)
const H = require('./_helfer.js').H;
const P = require('./_pruefe.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
(async () => {
  const R = H.runner();
  await P.pruefe(R, { leser: ["Blade of the Frostbringer", "Nieht, the Blitz Blade", "Reiza, the Chief Tormentor", "Vinepire", "Warhorse", "The Master's Sword", "Zsos'Ssar, the Serpent Warlord", "Heart of Ice (Träger wird getroffen)", "Santa Klaus", "Legendary Sword of a Barbarian King"], treiber: ['Duel', 'Echte Attack'] });
  // Zähler: der Duellant B (Gegner) zählt EINE Attack, der Spieler der Karte eine (die Karte selbst); Gegenprobe Echte Attack: der Gegner zählt nichts
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Duel · Attack-Zähler beider Duellanten`);
    const L = require('./_helfer.js');
    const r = await L.szene('Duel', me, op, { ziel: 'hero' });
    const pm = r.t.gs.players[me], po = r.t.gs.players[op];
    R.check('der Spieler der Karte zählt genau eine Attack (die Karte)', (pm.attacksPlayedThisTurn || 0) === 1, pm.attacksPlayedThisTurn);
    R.check('der Gegner-Duellant zählt genau eine Attack (sein Schlag), sein Held steht in heroesAttackedThisTurn', (po.attacksPlayedThisTurn || 0) === 1 && (po.heroesAttackedThisTurn || []).includes(0), { n: po.attacksPlayedThisTurn, l: po.heroesAttackedThisTurn });
    R.check('sauber', L.sauber(r.t), { e: r.t.errors, a: r.t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });

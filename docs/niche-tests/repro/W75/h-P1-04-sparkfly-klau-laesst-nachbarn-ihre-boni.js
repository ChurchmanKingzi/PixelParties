'use strict';
// W75 · Darion (Audit P1) — Eine Karte per Sparkfly-Weg (Mine! Mine! Mine!, Capture Net, Kidnapping, Sparkfly Queen/Worker) vom Brett auf die Hand nehmen: `stealBoardCardToHand`.
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: Wird eine Karte des Stapels (Club +30 / Blade +10 / Crown) geholt, verliert Darion NUR deren Bonus; die Stapelnachbarn bleiben unberuehrt (bisher hoerten alle den Abgang und nahmen ihre ATK zurueck).
// Aufruf: node docs/niche-tests/repro/W75/h-P1-04-sparkfly-klau-laesst-nachbarn-ihre-boni.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const SF = require('../../../../cards/effects/_sparkfly-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const darion of [true, false]) for (const wahl of [0, 1]) {
    R.section(`${darion ? 'Darion-Stapel' : 'Kontrolle (getrennt)'} · ${NAMEN[wahl]} wird geholt`);
    const t = await H.fresh({ active: 1, heroes: [[darion ? D : T, null, null], [T, null, null]], hand: [[...NAMEN, F], [F]], gold: 900, deckSize: 30 });
    const h = t.hero(0, 0); h.atk = h.baseAtk = 50;
    for (const [i, n] of NAMEN.entries()) await t.play(0, n, { hero: 0, slot: darion ? 1 : i, active: 0 });
    const vor = h.atk;
    const bonus = { 'Club of Gobbo': 30, 'Blade of the Frostbringer': 10 }[NAMEN[wahl]];
    const inst = t.inst(c => c.name === NAMEN[wahl] && c.zone === 'support')[0];
    await t.run(() => SF.stealBoardCardToHand(t.engine, 1, inst, 'Test'));
    R.check(`ATK sinkt nur um ${bonus} (${vor} -> ${vor - bonus})`, h.atk === vor - bonus, { vor, nach: h.atk });
    R.check('Karte auf der Hand von Sitz 1', t.pile(1, 'hand').includes(NAMEN[wahl]), t.pile(1, 'hand'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();

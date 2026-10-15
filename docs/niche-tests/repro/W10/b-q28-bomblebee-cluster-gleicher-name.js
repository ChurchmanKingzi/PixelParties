'use strict';
// W10b · Q28 (A05-06) · Bomblebee Cluster: „with different names" gilt nur zwischen den bis zu 2 gewählten Bomblebees
//
// Kartentext: „Play this card immediately when you summon a "Bomblebee" Creature. Summon up to 2 "Bomblebee" Creatures with different names
//   from your hand with the same Hero as additional Actions. You cannot summon Creatures for the rest of the turn afterwards."
// ENTSCHIEDEN (Al, Welle 10, Q28): „Wenn nichts von 'different name' im Text steht, ja." → Ein Name gleich dem der auslösenden Karte ist erlaubt;
//   die zwei gewählten Bomblebees müssen untereinander verschiedene Namen haben.
// Geprüft: Hand Bomblebee ×3 + Dive Bomblebee + Cluster, ausgelöst durch Bomblebee: (a) die erste Galerie bietet „Bomblebee" (Name der Auslöserin) und
//   „Dive Bomblebee"; (b) nach „Bomblebee" bietet die zweite Galerie NUR „Dive Bomblebee" (kein zweites „Bomblebee"); (c) beide landen auf dem Brett.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Bomblebee', 'Bomblebee', 'Bomblebee', 'Bomblebee Cluster', 'Dive Bomblebee'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
  const galerien = [];
  t.script.push({ match: d => d.type === 'confirm' && /Bomblebee Cluster/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && /Bomblebee Cluster/.test(d.title || ''), answer: (d) => {
    galerien.push(d.cards.map(c => c.name));
    return { cardName: galerien.length === 1 ? 'Bomblebee' : d.cards[0].name };
  } });
  await t.play(0, 'Bomblebee', { hero: 0, noGrant: true });
  R.note('Galerien', galerien);
  R.check('(a) erste Galerie bietet „Bomblebee" (Name der Auslöserin) und „Dive Bomblebee"', !!galerien[0] && galerien[0].includes('Bomblebee') && galerien[0].includes('Dive Bomblebee'), galerien[0]);
  R.check('(b) zweite Galerie: nur „Dive Bomblebee" (die zwei Gewählten heißen verschieden)', !!galerien[1] && galerien[1].length === 1 && galerien[1][0] === 'Dive Bomblebee', galerien[1]);
  const auf = t.inst(c => c.zone === 'support' && c.owner === 0).map(c => c.name).sort();
  R.check('(c) Auslöserin + 2 Re-Summons liegen auf dem Brett', auf.length === 3 && auf.filter(n => n === 'Bomblebee').length === 2 && auf.includes('Dive Bomblebee'), auf);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });

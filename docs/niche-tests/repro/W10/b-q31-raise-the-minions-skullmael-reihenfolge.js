'use strict';
// W10b · Q31 (A05-14) · Raise the Minions! + Skeleton King Skullmael: der Bonus hängt von der Platzierungsreihenfolge ab (gewollt, Absicherung)
//
// Kartentext (Skullmael): „While you control this Creature that was summoned from the discard pile, "Skeleton" Creatures that are summoned from the
//   discard pile may use their active effects the turn they are summoned …"
// ENTSCHIEDEN (Al, Welle 10, Q31): „Jedes Skelett, das beschworen wird, solange Skullmael schon auf dem Feld ist, bekommt den Bonus." → Ein Skelett
//   bekommt den Bonus genau dann, wenn Skullmael beim Beschwören/Platzieren schon (aus der Ablage beschworen) auf dem Feld ist. Ist Skullmael selbst
//   Teil der Gruppe, entscheidet die Reihenfolge – kein Fehler.
// Geprüft: Ablage Skeleton Archer + Skullmael, Raise the Minions!: (a) Archer zuerst → Archer OHNE Eile, Skullmael selbst ohne Eile;
//   (b) Skullmael zuerst → Archer MIT Eile.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ergebnis = {};
  for (const order of [['Skeleton Archer', 'Skeleton King Skullmael'], ['Skeleton King Skullmael', 'Skeleton Archer']]) {
    const t = await H.fresh({ hand: [['Raise the Minions!'], []], discard: [['Skeleton Archer', 'Skeleton King Skullmael'], []] });
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: order }) });
    await t.play(0, 'Raise the Minions!', { hero: 0 });
    const arch = t.engine.cardInstances.find(c => c.name === 'Skeleton Archer' && c.zone === 'support');
    const skull = t.engine.cardInstances.find(c => c.name === 'Skeleton King Skullmael' && c.zone === 'support');
    ergebnis[order[0]] = { archer: !!(arch && arch.counters._hasHaste), skull: !!(skull && skull.counters._hasHaste) };
    R.check('keine Engine-Fehler (' + order[0] + ' zuerst)', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.note('Eile je Reihenfolge', ergebnis);
  R.check('(a) Archer zuerst: Archer ohne Eile (Skullmael war noch nicht auf dem Feld)', ergebnis['Skeleton Archer'].archer === false, ergebnis);
  R.check('(a) Skullmael selbst bekommt keine Eile (er war beim eigenen Platzieren noch nicht auf dem Feld)', ergebnis['Skeleton Archer'].skull === false && ergebnis['Skeleton King Skullmael'].skull === false, ergebnis);
  R.check('(b) Skullmael zuerst: Archer mit Eile', ergebnis['Skeleton King Skullmael'].archer === true, ergebnis);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });

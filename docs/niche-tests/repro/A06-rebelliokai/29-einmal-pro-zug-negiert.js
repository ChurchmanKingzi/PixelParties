'use strict';
// A06-rebelliokai-29 · Negierter Pawn Sacrifice / negierte Mischief Invasion zählen nicht gegen „You can only play 1 … per turn"
// Kartentexte: Pawn Sacrifice „You can only play 1 "Pawn Sacrifice" per turn." · Mischief Invasion „You can only play 1 "Mischief Invasion" per turn."
// Präzedenz (gleiche Klasse): S01-02 (Big Oopsie/Butterfly Cloud), A01-pollution-04/-14, F01-19, F02, M02; Ruling CARD_API.md ~Z. 11433
//   „Der Stempel sitzt dort, wo die Karte die Hand verlässt – ab da IST sie aktiviert, unabhängig davon, ob ein Gegenzug sie später negiert."
// Beobachtung: pawn-sacrifice.js:136 (`gs.hoptUsed`) und mischief-invasion.js:287 (`ps._mischiefInvasionUsedTurn`) stempeln erst im `onPlay`;
//   wird der Zauber von Silence negiert, läuft `onPlay` nie. Die zweite Kopie im selben Zug ist spielbar und wirkt.
// Erwartung (Lesart A „gespielt = gezählt"): die zweite Kopie ist nach der Negierung nicht spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const mk = async (name, setup) => {
    const t = await H.fresh({ hand: [[name], ['Silence']], deck: [Array(20).fill(D), Array(20).fill(D)] });
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic']]);     // Silence braucht Decay Magic Lv2
    setup(t);
    t.targetFn = (valid) => { const x = valid.find(v => v.owner === 1) || valid[0]; return x ? [x.id] : []; };
    // Invasion: die Handwahl nimmt die erste wählbare Karte (nur relevant für die zweite Kopie)
    t.script.push({ match: d => d.type === 'handPick' && d.title === 'Mischief Invasion', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    return t;
  };
  const cases = {
    'Pawn Sacrifice': (t) => { t.put(0, 0, 0, 'Pawn of Kings [W]').turnPlayed = 1; t.addHand(0, 'Pawn Sacrifice'); },
    'Mischief Invasion': (t) => { t.put(1, 0, 0, D).counters.frozen = 1; t.addHand(0, 'Mischief Militia - Heli Troopers'); t.addHand(0, 'Mischief Invasion'); },
  };
  for (const [name, setup] of Object.entries(cases)) {
    R.section(name);
    const t = await mk(name, (tt) => { setup(tt); tt.setHand(0, tt.pile(0, 'hand').filter((n, i, a) => a.indexOf(n) === i)); });
    // Zweite Kopie bereitstellen (zwei Kopien auf der Hand)
    t.addHand(0, name);
    const r = await t.play(0, name, { hero: 0 });
    const reacted = t.prompts.some(p => /Silence/.test(p.d.title || ''));
    R.check(name + ': erste Kopie wurde von Silence negiert (Aufbau)', r === true && reacted && t.pile(0, 'discardPile').includes(name), { r, reacted, disc: t.pile(0, 'discardPile') });
    t.reset();
    t.gs.activePlayer = 0; t.gs.currentPhase = 3; t.resetActions(0);
    const handBefore = t.pile(0, 'hand').length;
    const r2 = await t.play(0, name, { hero: 0 });
    const wirkt = name === 'Pawn Sacrifice' ? t.pile(0, 'hand').length > handBefore - 1 + 1   // Karte raus, ≥2 gezogen
                                            : t.zone(0, 0, 1) === 'Mischief Militia - Heli Troopers' || [0, 1, 2].some(hi => [0, 1, 2].some(z => t.zone(0, hi, z) === 'Mischief Militia - Heli Troopers'));
    R.check(name + ': zweite Kopie im selben Zug NICHT spielbar / ohne Wirkung (Lesart A)', r2 === false || !wirkt, { r2, wirkt, hand: t.pile(0, 'hand').length - handBefore, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
    R.check(name + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();

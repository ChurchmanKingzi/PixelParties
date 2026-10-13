'use strict';
// S01-12 · Call for Help bietet Zauber an, die nicht spielbar sind – die Wahl ist nicht abbrechbar, Call for Help verpufft
// Kartentext: „Choose a level 2 or lower Spell from your deck or hand and play it immediately as an additional Action, regardless of its level."
// Vorbild im Code: der normale Immediate-Pick (`_resolveImmediateActionPick`, _engine.js ~Z. 19700-19740) filtert Zauber mit `spellPlayCondition`, `canPlayWithHero`, `oncePerGame` heraus.
//   Call for Help (`call-for-help.js`, `eligible`) filtert nur Level ≤ 2, Subtyp Normal und die HOPT je Name; `spellPlayCondition` wird erst NACH der Wahl geprüft (stilles `return`).
// Aufbau: eine eigene Kreatur wurde diesen Zug besiegt; Deck: Detection (Text: „You can only play this card while your opponent controls 1+ Surprises."), Gegner hat keine Surprise.
// Erwartet: Detection wird nicht angeboten (oder Call for Help bleibt erhalten, wenn nichts Spielbares da ist).
// Beobachtet: Detection wird angeboten; die Galerie ist nicht abbrechbar (`cancellable: false`); nach der Wahl geschieht nichts, Call for Help liegt in der Ablage, Detection bleibt im Deck.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Call for Help'], []], deck: [['Detection'], []] });
  t.put(0, 0, 0, H.INERT.frail);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, t.find(H.INERT.frail, 'support')));
  let angeboten = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Call for Help', answer: (d) => { angeboten = d.cards.map(c => c.name); return { cardName: 'Detection', source: 'deck' }; } });
  await t.play(0, 'Call for Help', { hero: 0 });
  R.check('der unspielbare Zauber (Detection) wird nicht angeboten', !(angeboten || []).includes('Detection'), { angeboten, ablage: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

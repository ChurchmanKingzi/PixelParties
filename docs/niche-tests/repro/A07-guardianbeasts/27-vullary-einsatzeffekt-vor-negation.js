'use strict';
// A07-27 · Vullary: der Einsatz-Effekt der beschworenen Kreatur feuert, BEVOR die Negation greift
//
// Kartentext Vullary: „… You may once per turn summon a level 3 or lower Creature regardless of its level as an additional Action with the
//   corresponding Hero, but negate its effects until the beginning of your next turn."
// Vergleich: The Master's Key („place … but negate its effects for the rest of the turn") übergibt `negateEffects: true` an `actionPlaceCreature` –
//   die Negation steht vor dem onPlay/onCardEnterZone-Hook, der Einsatz-Effekt unterbleibt. Vullary setzt `negated` erst NACH der Platzierung
//   (unsettling-opportunist-vullary.js ~156-161), obwohl der Kommentar dort selbst auf `negateEffects: true` verweist. A01 erwartet für
//   Necromancy-artige Negation dasselbe („Einsatz-Effekt unterbleibt").
// Erwartung: Die per Vullary beschworene Ballad Harpyformer ist negiert; ihr Einsatz-Effekt („search your deck for a Support Magic Ability") feuert nicht.
// Beobachtet: Die Karte ist danach negiert, aber das Einsatz-Fenster („Search your deck for a „Support Magic" Ability …?") wurde schon angeboten;
//   „Support Magic" liegt auf der Hand.
const H = require('../../lib/h.js');
const D = H.INERT.creature;

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cute Princess Mary', 'Ballad Harpyformer'], []], deck: [['Support Magic', ...Array(10).fill(D)], []] });
  const v = t.put(0, 0, 0, 'Unsettling Opportunist Vullary'); v.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);                                       // Mary anlegen
  R.check('Vorbedingung: Mary liegt unter Vullary', v.counters.attachedHero === 'Cute Princess Mary', v.counters.attachedHero);
  t.script.push({ match: d => d && d.type === 'cardGallery' && /Vullary/.test(d.title || ''), answer: () => ({ cardName: 'Ballad Harpyformer' }) });
  t.script.push({ match: d => d && d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.phase(2);
  const r = await t.activateCreature(0, 0, 0);                             // Modus B: beschwören
  const ballad = t.find('Ballad Harpyformer', 'support');
  R.check('Vorbedingung: Ballad liegt negiert auf dem Brett', !!ballad && !!ballad.counters.negated, { r, negated: ballad && ballad.counters.negated });
  R.check('Einsatz-Effekt der negierten Kreatur feuert nicht (kein Such-Fenster)', !t.prompts.some(p => p.d.type === 'confirm' && p.d.title === 'Ballad Harpyformer'), t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
  R.check('„Support Magic" bleibt im Deck', !t.pile(0, 'hand').includes('Support Magic'), t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

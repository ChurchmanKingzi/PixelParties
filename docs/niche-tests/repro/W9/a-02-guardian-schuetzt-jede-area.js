'use strict';
// W9a · Q2 (A01-pollution-10) · Al, 15.10.2026: „Entsprechend seinem Text“ – der Guardian-Text sagt „an Area“ → JEDE Area ist schützbar (auch die gegnerische);
//   der Besitzer des Guardians entscheidet.
// Erwartet: (1) Sitz 0 mit Guardian auf der Hand: Reality Crack (Sitz 0) – Angebot für Sitz 1s Area; Ja → Area bleibt, Guardian in der Ablage von Sitz 0.
//           (2) Guardian auf dem BRETT von Sitz 1 schützt Sitz 0s Area vor einem Effekt von Sitz 0 (Sitz 1 entscheidet).
//           (3) Nein → Area wird entfernt, Guardian bleibt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // (1) Ja für die Gegner-Area
  {
    const t = await H.fresh({ hand: [['Reality Crack', 'Guardian of Teocuilatl'], []] });
    t.putArea(1, 'Cosmic Depths');
    t.script.push({ match: d => d && d.type === 'confirm' && d.title === 'Guardian of Teocuilatl' && /Cosmic Depths/.test(d.message || ''), answer: () => ({ confirmed: true }), once: false });
    await t.play(0, 'Reality Crack', { hero: 0 });
    const angebote = t.prompts.filter(p => p.d.title === 'Guardian of Teocuilatl');
    R.check('(1) Guardian bietet sich für die GEGNER-Area an', angebote.length >= 1 && angebote.every(p => p.pi === 0), angebote.map(p => p.pi));
    R.check('(1) Gegner-Area bleibt nach „Ja“ liegen', !!t.find('Cosmic Depths', 'area'), 'area');
    R.check('(1) Guardian in der Ablage seines Besitzers (Sitz 0)', t.pile(0, 'discardPile').includes('Guardian of Teocuilatl'), t.pile(0, 'discardPile'));
    R.check('(1) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (2) Guardian auf dem Brett von Sitz 1 schützt Sitz 0s Area; Sitz 1 wird gefragt
  {
    const t = await H.fresh({ hand: [['Reality Crack'], []] });
    t.putArea(0, 'Acid Rain');
    t.put(1, 0, 0, 'Guardian of Teocuilatl');
    t.script.push({ match: d => d && d.type === 'confirm' && d.title === 'Guardian of Teocuilatl', answer: () => ({ confirmed: true }), once: false });
    await t.play(0, 'Reality Crack', { hero: 0 });
    const angebote = t.prompts.filter(p => p.d.title === 'Guardian of Teocuilatl');
    R.check('(2) Sitz 1 (Guardian-Besitzer) wird für Sitz 0s Area gefragt', angebote.length === 1 && angebote[0].pi === 1, angebote.map(p => p.pi));
    R.check('(2) Acid Rain bleibt liegen', !!t.find('Acid Rain', 'area'), 'area');
    R.check('(2) Guardian geopfert (Ablage Sitz 1)', t.pile(1, 'discardPile').includes('Guardian of Teocuilatl'), t.pile(1, 'discardPile'));
  }
  // (3) Nein
  {
    const t = await H.fresh({ hand: [['Reality Crack', 'Guardian of Teocuilatl'], []] });
    t.putArea(1, 'Cosmic Depths');
    t.script.push({ match: d => d && d.type === 'confirm' && d.title === 'Guardian of Teocuilatl', answer: () => null, once: false });
    await t.play(0, 'Reality Crack', { hero: 0 });
    R.check('(3) Nein: Gegner-Area wird entfernt', !t.find('Cosmic Depths', 'area'), 'area');
    R.check('(3) Nein: Guardian bleibt in der Hand', t.pile(0, 'hand').includes('Guardian of Teocuilatl'), t.pile(0, 'hand'));
  }
  R.finish();
})();

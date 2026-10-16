'use strict';
// W14b · Q151 (R01-07, Divine Gift of the Guardian) · Al, 16.10.2026: „Es soll alle schützen. Ändere dazu den Kartentext etwas zu 'Negate any damage Creatures you control would take....'"
// Erwartet: (a) data/cards.json trägt „Negate any damage Creatures you control would take until the beginning of your next turn." (kein „those Creatures");
//   (b) die Reaktion schützt ALLE eigenen Kreaturen (auch die nicht getroffenen) bis zum Beginn des nächsten eigenen Zuges; (c) nach dem Zugwechsel hat sie keine Wirkung mehr.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cards = require('../../../../data/cards.json');
  const card = (Array.isArray(cards) ? cards : Object.values(cards)).find(x => x.name === 'Divine Gift of the Guardian');
  R.check('(a) Kartentext: „Negate any damage Creatures you control would take until the beginning of your next turn."',
    card.effect.includes('Negate any damage Creatures you control would take until the beginning of your next turn.') && !/those Creatures/.test(card.effect), card.effect);
  R.check('(a) Rest des Textes unverändert (Gift-Zeile + Auslöser)', card.effect.startsWith('You can only activate 1 "Divine Gift" card per game.\nPlay this card immediately when 1 or more Creatures you control would take damage. '), card.effect);

  const t = await H.fresh({ hand: [['Fireball', 'Fireball'], ['Divine Gift of the Guardian']] });
  t.grantFor(1, 0, 'Divine Gift of the Guardian');
  const a = t.put(1, 0, 0, H.INERT.creature), b = t.put(1, 1, 0, H.INERT.creature), c = t.put(1, 2, 0, H.INERT.creature);
  t.targetFn = (valid) => [valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(b) die Reaktion hat gespielt (Karte in der Ablage), getroffene Kreatur unversehrt', a.counters.currentHp === 200 && t.pile(1, 'discardPile').includes('Divine Gift of the Guardian'), a.counters.currentHp);
  R.check('(b) alle drei Kreaturen sind geschützt', [a, b, c].every(x => !!x.counters._guardianImmune), [a, b, c].map(x => !!x.counters._guardianImmune));
  t.targetFn = (valid) => [valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 2).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('(b) eine NICHT getroffene Kreatur (Held 2) prallt ab: HP 200', c.counters.currentHp === 200, c.counters.currentHp);
  await t.endTurn(); await t.endTurn();
  R.check('(c) nach dem nächsten Zugbeginn des Besitzers ist die Immunität weg', ![a, b, c].some(x => x.counters._guardianImmune), [a, b, c].map(x => !!x.counters._guardianImmune));
  R.check('keine Engine-Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})();

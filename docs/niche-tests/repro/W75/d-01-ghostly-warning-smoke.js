'use strict';
// W75 · Ghostly Warning — Smoke: Negieren + Loeschen, Wirken am Ende des eigenen naechsten Zuges.
// Kartentext: „Play this card immediately when an opponent's Hero uses a Spell. Negate that Spell and delete it. At the end of your next turn, if that Hero is not defeated and that Spell is still deleted, that Hero immediately performs that Spell as an additional Action, regardless of its level and in spite of any negative status effects."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/d-01-ghostly-warning-smoke.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, GW = 'Ghostly Warning';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 1, hand: [[GW, F, F], ['Fireball', F, F]], deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.grantFor(0, 0, GW); t.grantFor(1, 0, 'Fireball');
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
  await t.play(1, 'Fireball', { hero: 0 });
  R.note('after cast', JSON.stringify({ del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile'), hp0: t.hp(0, 0), dis0: t.pile(0, 'discardPile'), armed: t.gs._verzoegerteZauber }));
  R.check('Fireball negiert+geloescht, kein Schaden', t.hp(0, 0) === 800 && t.pile(1, 'deletedPile').includes('Fireball'), [t.hp(0, 0), t.pile(1, 'deletedPile')]);
  R.check('Vormerkung da', (t.gs._verzoegerteZauber || []).length === 1);
  await t.endTurn();   // Ende Zug 5 (Gegner) -> noch nicht faellig
  R.check('Ende des gegnerischen Zuges: noch nichts passiert', t.hp(0, 0) === 800 && t.pile(1, 'deletedPile').includes('Fireball'), t.hp(0, 0));
  R.note('active', t.gs.activePlayer + ' turn ' + t.gs.turn);
  await t.endTurn();   // Ende Zug 6 (Ghostly-Besitzer) -> faellig
  R.note('after fire', JSON.stringify({ del1: t.pile(1, 'deletedPile'), dis1: t.pile(1, 'discardPile'), hp0: t.hp(0, 0), prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) }));
  R.check('Fireball wurde am Zugende gewirkt (150 Schaden)', t.hp(0, 0) === 650, t.hp(0, 0));
  R.check('Fireball danach in der Ablage (nicht mehr gelöscht)', t.pile(1, 'discardPile').includes('Fireball') && !t.pile(1, 'deletedPile').includes('Fireball'));
  R.check('Vormerkung verbraucht', (t.gs._verzoegerteZauber || []).length === 0);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();

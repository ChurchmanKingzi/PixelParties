'use strict';
// A05-skeletons-24 · Hammer Skeleton kann ein an einen Helden angehängtes Crimson Web nicht wählen
// Kartentext (Hammer Skeleton): „You may once per turn choose a Spell attached to a Hero or an Area in play and send it to the discard pile."
// Kartentext (Crimson Web): „… attach this card to the attacker, if possible. While this card is attached to a Hero, that Hero cannot act …" (cardType Spell, Subtype Surprise)
// Erwartung: Das angehängte Crimson Web ist „a Spell attached to a Hero" → Hammer Skeleton bietet es an (Web fällt in die Ablage, Held ist frei).
// Beobachtet: Hammer Skeleton ist nicht aktivierbar (keine Ziele): `collectTargets` lässt nur Spells mit Subtyp „Attachment" in Support Zonen zu; Crimson Web hat Subtyp „Surprise".
// Ursache: hammer-skeleton.js `collectTargets()` (`sub === 'attachment'`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fire Bolts'], []] });
  t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
  t.putSurprise(1, 0, 'Crimson Web'); t.grantFor(1, 0, 'Crimson Web');
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Fire Bolts', { hero: 0, noGrant: true });
  const web = t.engine.cardInstances.find(c => c.name === 'Crimson Web' && c.zone === 'support');
  R.check('Aufbau: Crimson Web hängt an Held 0 der Seite 0 (webbed)', !!web && !!t.gs.players[0].heroes[0].statuses.webbed, { web: !!web });
  const hammer = t.put(1, 0, 0, 'Hammer Skeleton'); hammer.turnPlayed = 1;
  t.gs.activePlayer = 1; t.phase(2);
  const kann = H.loadCardEffect('Hammer Skeleton').canActivateCreatureEffect(t.engine._createContext(hammer, {}));
  R.check('Hammer Skeleton bietet das angehängte Crimson Web als Ziel an', kann === true, { kann });
  R.finish();
})();

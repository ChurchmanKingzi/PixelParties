'use strict';
// A05-skeletons-25 · Crimson Web hängt an den WIRTSHELDEN, wenn ein Skeleton Priest den Zauber wirkt
// Kartentext (Crimson Web): „Activate this Surprise when the user is chosen by an Attack or Spell. Negate that Attack/Spell. Then, attach this card to the attacker, if possible.
//   While this card is attached to a Hero, that Hero cannot act …"
// Skript-Kopf: „Source must be an opponent Hero" (Kreatureneffekte lösen nicht aus). Engine-Konvention beim Kreatur-Wurf (Demon's Gate/Priest/Wizard, `_spellCasterCreature`): der Angreifer
//   ist die wirkende KREATUR (Rückschlag/Vergeltung wie Booby Trap trifft sie, nicht den Helden).
// Aufbau: Skeleton Priest (Seite 0, Held 0) wirkt Fire Bolts aus der Ablage auf Held 0 der Seite 1, der ein Crimson Web verdeckt hat.
// Erwartung: Der Zauber wird negiert; „attach … to the attacker, if possible": Angreifer ist eine Kreatur → Anhängen nicht möglich (Held bleibt frei), Web geht in die Ablage.
// Beobachtet: Web wird negiert-wirkend an den Wirtsheld (Held 0, Seite 0) gehängt, `webbed` – ein Held, der gar nicht gehandelt hat, ist gelähmt.
// Ursache: crimson-web.js `surpriseTrigger`/`onSurpriseActivate` lesen `sourceInfo.owner/heroIdx` (Wirtsheld) und beachten `_creatureCasterForSource` nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ discard: [['Fire Bolts'], []] });
  const p = t.put(0, 0, 0, 'Skeleton Priest'); p.turnPlayed = 1;
  t.putSurprise(1, 0, 'Crimson Web'); t.grantFor(1, 0, 'Crimson Web');
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fire Bolts', source: 'discard' }) });
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Kontrolle: Zauber negiert (Held 1 unversehrt)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('Wirtsheld des Priesters (Seite 0, Held 0) ist NICHT „webbed"', !t.gs.players[0].heroes[0].statuses.webbed, t.gs.players[0].heroes[0].statuses);
  R.finish();
})();

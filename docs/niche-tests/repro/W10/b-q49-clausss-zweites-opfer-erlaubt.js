'use strict';
// W10b · Q49 (A07-17) · Zwei Clausss im selben Zug: das zweite Opfer ist erlaubt und bringt nichts (Absicherung, keine Codeänderung)
//
// Kartentext Clausss: „… You may once per turn sacrifice a Creature you control that was not summoned this turn. If you do, you can perform a second
//   Action during this turn's Action Phase." (Der Text enthält KEIN „You can only control 1".)
// ENTSCHIEDEN (Al, Welle 10, Q49): „Erlaubt und bringt nichts ist fine." → keine Sperre der zweiten Clausss; `_bonusMainActions` bleibt 1.
// Geprüft: (a) beide Clausss lassen sich auf den Tisch bringen (keine Kontrollgrenze, die der Text nicht hergibt); (b) das zweite Opfer ist erlaubt;
//   (c) die zweite Zusatzaktion wird nicht erhöht (bleibt 1).
const H = require('../../lib/h.js');
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Klaus, the Cult Leader', 'Klaus, the Cult Leader'], []], deckSize: 10 });
  const c1 = t.put(0, 0, 0, 'Clausss, the No-Nonsense Cultist'); c1.turnPlayed = 1;
  const c2 = t.put(0, 0, 1, 'Clausss, the No-Nonsense Cultist'); c2.turnPlayed = 1;
  R.check('(a) zwei Clausss gleichzeitig auf dem Brett', t.inst(c => c.zone === 'support' && c.owner === 0 && /^Clausss/.test(c.name)).length === 2);
  for (let z = 0; z < 3; z++) t.put(0, 1, z, D).turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0); t.phase(2); await t.activateCreature(0, 0, 1);
  t.targetFn = (v) => [v.find(y => y.cardName === D).id];
  t.phase(2); await t.activateCreature(0, 0, 0);
  const nach1 = t.gs.players[0]._bonusMainActions;
  const vor = t.inst(c => c.zone === 'support' && c.owner === 0).length;
  t.phase(2); const r2 = await t.activateCreature(0, 0, 1);
  const nach = t.inst(c => c.zone === 'support' && c.owner === 0).length;
  R.check('(b) zweites Opfer durch die zweite Clausss ist erlaubt', r2 === true && nach === vor - 1, { r2, kreaturen: [vor, nach] });
  R.check('(c) die Zusatzaktion bleibt bei 1 (bringt nichts)', nach1 === 1 && t.gs.players[0]._bonusMainActions === 1, { nach1, jetzt: t.gs.players[0]._bonusMainActions });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });

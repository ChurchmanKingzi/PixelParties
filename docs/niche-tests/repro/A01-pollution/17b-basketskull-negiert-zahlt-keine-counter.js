'use strict';
// A01-pollution-17 (Nachtrag) · Basketskull: in der Kette negiert → die „Remove … Doom Counters to play this card“-Kosten werden nie bezahlt
// Kartentext: „Remove any number of Doom Counters from a „Doom Clock“ on the board to play this card. …“ (Kosten, wörtlich gleiche Form wie „Place N Pollution Tokens … to use this Spell“).
// CARD_API.md, Hook-Tabelle `payActivationCost`: Kosten, die bei der Aktivierung zu zahlen sind und bei Negation NICHT erstattet werden (Cold-Coffin-Muster).
// Aufbau: Doom Clock (5 Counter) bei Sitz 0; Basketskull auf der Hand; Sitz 1 hat Silence (Reaktion) und sagt „Ja“.
// Erwartung: wie bei Cold Coffin / Eraser Beam bleibt die Zahlung bestehen; da die Menge der Counter aber erst in `onPlay` (nach der Kette) gewählt wird, gäbe es keine bezahlte Menge – d. h. die
//   Karte kostet bei Negation nichts (Gegenstück zu den Token-Karten aus -17).
// Beobachtet: Silence negiert Basketskull; die Uhr behält alle 5 Counter, Basketskull liegt in der Ablage. Der Spieler hat die Karte „umsonst“ gespielt; ein Gegner kann Basketskull so risikolos negieren.
// Ursache: cards/effects/basketskull.js – kein `payActivationCost`; Counter-Abzug und -Wahl stehen komplett in `onPlay`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/17b-basketskull-negiert-zahlt-keine-counter.js   (✗ = wie im Kartentext zu erwarten wäre, tritt nicht ein)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Basketskull'], ['Silence']] });
  const clock = t.putArea(0, 'Doom Clock'); clock.counters.doom = 5;
  t.grantFor(1, 0, 'Silence');
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Basketskull', answer: () => ({ optionId: 'n-3' }) });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.policy.confirm = true;
  await t.play(0, 'Basketskull', { hero: 0 });
  R.check('Basketskull wurde von Silence negiert (Gegner-Held unverletzt, Karte in der Ablage)', t.hp(1, 0) === 800 && t.pile(0, 'discardPile').includes('Basketskull'), { hp: t.hp(1, 0), ablage: t.pile(0, 'discardPile') });
  R.check('die Uhr hat für die gespielte Karte Counter eingebüßt (Kosten bezahlt)', clock.counters.doom < 5, clock.counters.doom);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

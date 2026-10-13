'use strict';
// A01-pollution-23 · Basketskull: Abbruch der Counter-Mengenwahl verbraucht die Karte (Regel 23.9: „Abbruch heißt: nichts ist passiert“)
// Kartentext: „Remove any number of Doom Counters from a „Doom Clock“ on the board to play this card. Choose a target and deal damage equal to 70 times the number of removed counters to it.“
// Regel 23.9 (CARD_API.md, „Zielende Karten sind immer abbrechbar“): Abbruch = die Karte bleibt auf der Hand, die Aktion wird erstattet; im Code geschieht das nur über
//   `gs._spellCancelled = true` (CARD_API.md Z. 3104: „Spell returns to hand“).
// Aufbau: Doom Clock mit 5 Countern in der Area von Sitz 0, Basketskull auf der Hand. Im Mengen-Dialog („Remove how many?“, `cancellable: true`) wird der Abbrechen-Knopf gedrückt.
// Erwartung: Basketskull bleibt auf der Hand, die Uhr behält 5 Counter, die Aktion ist nicht verbraucht.
// Beobachtet: die Uhr behält 5 Counter (nichts bezahlt), aber die Karte liegt in der ABLAGE: der Zug ist weg, nichts ist passiert (Aktion verbraucht, Karte verloren).
// Ursache: cards/effects/basketskull.js (`onPlay`): `if (!uhr) return false;` / `if (!wahl || wahl.cancelled || !wahl.optionId) return false;` – der Rückgabewert `false` wird von doPlaySpell nicht
//   als Abbruch gelesen; es fehlt `gs._spellCancelled = true`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/23-basketskull-abbruch-verbraucht-karte.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Basketskull'], []] });
  const clock = t.putArea(0, 'Doom Clock'); clock.counters.doom = 5;
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Basketskull', answer: () => ({ cancelled: true }) });
  const r = await t.play(0, 'Basketskull', { hero: 0 });
  R.check('Dialog wurde angeboten und abgebrochen', t.prompts.some(p => p.d && p.d.type === 'optionPicker' && p.d.title === 'Basketskull'), t.prompts.map(p => p.d && p.d.type));
  R.check('die Uhr behält ihre 5 Counter', clock.counters.doom === 5, clock.counters.doom);
  R.check('Abbruch: Basketskull bleibt auf der Hand', t.pile(0, 'hand').includes('Basketskull'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

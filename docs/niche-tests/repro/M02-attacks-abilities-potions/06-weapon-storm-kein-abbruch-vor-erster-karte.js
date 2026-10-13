'use strict';
// M02-06 · Weapon Storm lässt sich vor der ersten gesendeten Karte nicht abbrechen (Schwesterkarte Breaking Strike schon)
// Regel (CARD_API.md „Zielende Karten sind immer abbrechbar / Abbruch = nichts ist passiert", Regel 23.9; „cancelAtZero" Z. ~10838, Breaking Strike v1009):
//   „der ERSTE Wähler bekommt einen ✕ CANCEL-Knopf … die Karte löst dann gar nicht auf (gs._spellCancelled) und bleibt auf der Hand."
// Kartentext Weapon Storm: „Send any number of Artifacts equipped and Abilities attached to the user to the discard pile. Then, choose a target …"
// Erwartung: Weapon Storm verhält sich wie Breaking Strike: vor der ersten abgelegten Karte gibt es einen Abbruch, die Karte bleibt auf der Hand, die Aktion bleibt.
// Beobachtet: `weapon-storm.js` ruft `sendCardsLoop` ohne `cancelAtZero: true`; die erste Wahl ist `cancellable: false` (Knopf „✓ Done", unwirksam bei sent = 0).
//   Ein Mensch kann nicht zurück (muss mindestens eine Karte ablegen). Bei einer null-Antwort (Abbruch-Knopf der Harness) fragt die Schleife 40-mal nach,
//   gibt dann auf, und die Karte geht OHNE Wirkung in die Ablage (Aktion verbraucht, Phase 4) – das ist die Vorrunden-Auffälligkeit.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(karte) {
    const t = await H.fresh({ hand: [[], []], hp: 800 });
    t.setAbilities(0, 1, [['Fighting', 'Fighting'], ['Toughness'], []]);
    t.put(0, 1, 0, 'Blade of the Swamp Witch');
    t.policy.cancelTargets = true;                         // Abbruch-Knopf (null)
    const r = await t.play(0, karte, { hero: 1 });
    const cfg = t.targets[0] && t.targets[0].config;
    return { r, prompts: t.targets.length, ersteWahlAbbrechbar: !!(cfg && cfg.cancellable), hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), phase: t.gs.currentPhase, ausruestung: t.zone(0, 1, 0) };
  }
  const bs = await lauf('Breaking Strike');
  R.check('Kontrolle Breaking Strike: erste Wahl abbrechbar, Karte bleibt auf der Hand', bs.ersteWahlAbbrechbar && bs.hand.includes('Breaking Strike') && bs.prompts === 1, bs);
  const ws = await lauf('Weapon Storm');
  R.check('Weapon Storm: erste Wahl ist abbrechbar', ws.ersteWahlAbbrechbar, ws);
  R.check('Weapon Storm: nach Abbruch bleibt die Karte auf der Hand, Aktion nicht verbraucht', ws.hand.includes('Weapon Storm') && ws.phase === 3, ws);
  R.finish();
})();

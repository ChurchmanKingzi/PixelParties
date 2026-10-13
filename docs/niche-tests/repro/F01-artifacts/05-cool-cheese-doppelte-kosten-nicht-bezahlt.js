'use strict';
// F01-artifacts-05 · Cool Cheese: „Unless you double this Artifact's Cost" – mit 4 bis 7 Gold wird das Verdoppeln angeboten und die Sperre umgangen, ohne 8 Gold zu zahlen
// Kartentext: „Choose an Attack from your deck, reveal it and add it to your hand. Unless you double this Artifact's Cost, you cannot use Attacks with that name for the rest of this turn." (Kosten 4 → verdoppelt 8)
// Aufbau: Sitz 0 spielt Cool Cheese mit 4 / 5 / 7 / 8 / 9 Gold; Deck [Attack, ZZ Dummy]; Angebot „Pay 4 more" wird angenommen.
// Erwartung: Das Angebot gibt es nur, wenn die Gesamtkosten 8 bezahlbar sind (Gold >= 8). Bei 4–7 Gold gilt die Sperre (Attack nicht spielbar).
// Beobachtet: Angebot erscheint schon ab 4 Gold; wird es angenommen, ist das Gold danach 0 und der Name NICHT gesperrt – gezahlt wurden nur 4–7 statt 8 Gold.
// Ursache: `cards/effects/cool-cheese.js` (Z. 111: `if ((ps.gold || 0) >= EXTRA_COST)`): Das Skript prüft das Gold, BEVOR die Grundkosten abgebucht sind –
//   `server.js doConfirmPotion` (Z. ~11376) bucht die Kosten eines Artefakts ohne `manualGoldCost` erst NACH `resolve`; `_payCardCost` klemmt bei 0. Prüfung müsste `gold >= 2 * Kosten` sein
//   (bzw. Grundkosten vorher abziehen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const gold of [4, 5, 7, 8, 9]) {
    const t = await H.fresh({ hand: [['Cool Cheese'], []], deck: [['Attack', 'ZZ Dummy'], undefined], gold: [gold, 100] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Attack' }) });
    t.policy.confirm = true;     // „Pay 4 more" annehmen
    await t.play(0, 'Cool Cheese', { hero: 0 });
    const gezahlt = gold - t.gs.players[0].gold;
    const gesperrt = [...(t.gs.players[0]._creationLockedNames || [])].length > 0;
    const bezahlbar = gold >= 8;
    R.check('Gold ' + gold + ': Sperre umgangen nur, wenn wirklich 8 Gold gezahlt wurden', gesperrt === !bezahlbar || gezahlt === 8, { gezahlt, gesperrt });
    R.check('Gold ' + gold + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();

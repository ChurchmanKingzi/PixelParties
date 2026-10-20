'use strict';
// N3-08 · Drill Sergeant legt „Elusive Hind" / „Plant Golem" in die EIGENE Zone, wenn der Gegner keine freie Zone hat (Stufe C)
// Kartentext (Hind): „Summon this card into the free Support Zone of a Hero your opponent controls." (Plant Golem identisch: „… into a free Support Zone of a Hero your opponent controls.")
// Kartentext (Drill Sergeant): „You may once per turn choose a level 1 or lower Creature from your hand and place it into a free Support Zone of the corresponding Hero."
// Konvention: Wer Kreaturen aus der Hand beschwört/platziert, fragt `engine.isCreatureSummonable` → `canSummon` der Karte (Hind/Golem: freie Gegnerzone nötig). Psychic Scout und Slave Trader tun das
//   (Hind/Golem bleiben bei vollem Gegnerbrett auf der Hand bzw. im Deck, Gegenprobe unten); der Drill Sergeant filtert nur Stufe/Kartenart (`eligibleHandCards`).
// Aufbau: Gegner-Brett komplett voll. Sitz 0 hat Drill Sergeant (Held 0) und Hind/Golem auf der Hand.
// Erwartet: die Karte wird nicht angeboten bzw. nicht gelegt (bleibt auf der Hand) – oder sie läge beim Gegner. Beobachtet: sie liegt auf der EIGENEN Seite (Kontrolle Sitz 0) wie eine gewöhnliche Kreatur
//   (Hind: der eigene Kontrolleur wäre dann „its controller" der Negation, Golem: der eigene Wirtsheld wäre blockiert).
// Unklar (daher C): Q9 (Welle 9) sagt, „place" sei eine Unterform von „summon" nur für Trigger/Reaktionen; Voraussetzungen, die „summon" sagen, gelten beim Platzieren nicht. Dann dürfte der Sergeant die Karte
//   wörtlich in die EIGENE Zone legen (Lesart c) – heute verlegt die Karte sich aber bei freiem Gegnerplatz selbst (`onPlay`) und bleibt nur bei vollem Gegnerbrett liegen: inkonsistent in beide Richtungen.
// Ursache: cards/effects/drill-sergeant.js `eligibleHandCards` (Z. ~56): `isSummonablePileCreature` + Stufe, aber kein `canSummon`/`isCreatureSummonable`; `hind.onPlay`/`golem.onPlay` (`free.length === 0 → return`) verlegen dann nichts.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const karte of ['Elusive Hind', 'Plant Golem']) {
    // Gegenprobe 1: Gegnerzonen frei → die Karte landet beim Gegner (Kontrolle Sitz 1)
    {
      const t = await H.fresh({ hand: [[karte], []] });
      t.put(0, 0, 0, 'Drill Sergeant').turnPlayed = 1;
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: karte }) });
      t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
      t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
      await t.activateCreature(0, 0, 0);
      const i = t.find(karte, 'support');
      R.check(`${karte}: Gegenprobe – Gegnerzonen frei → liegt beim Gegner`, !!i && i.controller === 1, i && { controller: i.controller });
    }
    // Gegenprobe 2: Psychic Scout (nur Stufe 0 – für die Hind) lässt die Karte bei vollem Gegnerbrett auf der Hand
    if (karte === 'Elusive Hind') {
      const t = await H.fresh({ hand: [[karte], []] });
      for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) t.put(1, hi, si, H.INERT.creature);
      t.put(0, 0, 0, 'Psychic Scout').turnPlayed = 1;
      t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
      const r = await t.activateCreature(0, 0, 0);
      R.check('Hind: Gegenprobe – Psychic Scout legt die Hind bei vollem Gegnerbrett nicht', !t.find(karte, 'support') && t.pile(0, 'hand').includes(karte), r);
    }
    // Befund: Gegnerbrett voll
    {
      const t = await H.fresh({ hand: [[karte], []] });
      for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) t.put(1, hi, si, H.INERT.creature);
      t.put(0, 0, 0, 'Drill Sergeant').turnPlayed = 1;
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: karte }) });
      t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
      t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
      await t.activateCreature(0, 0, 0);
      const i = t.find(karte, 'support');
      R.check(`${karte}: Gegnerbrett voll → liegt NICHT als gewöhnliche Kreatur auf der eigenen Seite`, !i || (i.controller ?? i.owner) === 1, i && { owner: i.owner, controller: i.controller, zone: [i.heroIdx, i.zoneSlot] });
      R.check(`${karte}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();

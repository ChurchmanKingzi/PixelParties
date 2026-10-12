'use strict';
// A02-deepsea-04 · Life-Searcher, per Deepsea Succubus geliehen und aktiviert: Geister-Karte, doppelte Karte
//
// Kartentext (Life-Searcher): „Once per turn, if there are 3 or more Change Counters on cards you control, you may shuffle this
// Creature you control back into your deck to search your deck for a "Cosmic Depths" Creature 1 level higher … and place it into
// the same Support Zone this Creature occupied."
// Kartentext (Succubus): „… take control of it until the end of the turn …" – geliehene Kreaturen dürfen ihren aktiven Effekt benutzen
//   (`doActivateCreatureEffect`, Zweig `stolenBy`).
// Erwartung: Entweder verlässt die Kreatur ihren (gegnerischen) Platz sauber und der gleiche Platz wird belegt, oder der Effekt ist
//   nicht ausführbar; Zonen und Instanzen bleiben konsistent, keine Karte entsteht aus dem Nichts.
// Beobachtet: `onCreatureEffect` rechnet mit `ps = gs.players[controller]` (MEINE Seite) – `supportZones[heroIdx][slot]` ist aber die Zone
//   des Gegners. Der Name bleibt als Geister-Eintrag beim Gegner stehen (0 Instanzen), die Karte wird zusätzlich in MEIN Deck gemischt
//   (Kartenbilanz +1 Life-Searcher), und der Invader landet auf MEINEM Brett an den Koordinaten des gegnerischen Platzes.
// Ursache: `life-searcher-from-the-cosmic-depths.js` onCreatureEffect (`slotArr = ps.supportZones[sameHero][sameSlot]`, `returnToPile(ps,…)`,
//   `summonCreatureWithHooks(chosen, pi, sameHero, sameSlot)`) – kein Bezug auf `physicalSide(inst)`/`inst.owner` und `originalOwner`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const INV = 'Invader from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', AN = 'Analyzer from the Cosmic Depths';
  const t = await H.fresh({ hand: [['Deepsea Succubus'], []], deck: [[INV, H.INERT.creature, H.INERT.creature], [H.INERT.creature, H.INERT.creature]] });
  const ls = t.put(1, 0, 0, LS); ls.turnPlayed = 1;
  t.put(0, 2, 0, AN, { counters: { changeCounter: 3 } });
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.cardName === LS).id];
  const r = await t.play(0, 'Deepsea Succubus', { hero: 0 });
  R.check('Vorbedingung: Succubus gespielt, Life-Searcher geliehen', r === true && ls.stolenBy === 0, { r, stolenBy: ls.stolenBy });
  t.targetFn = null;
  const before = t.census();
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: INV }) });
  t.phase(4); t.gs.activePlayer = 0;
  await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0, charmedOwner: 1 }));
  const aud = t.audit();
  R.check('Zustand sauber (keine Geister-Instanz bei der Gegenseite)', aud.length === 0, aud);
  const diff = t.censusDiff(before, t.census());
  R.check('Kartenbilanz: keine Karte aus dem Nichts (Life-Searcher +1) / keine verschwundene', diff.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

'use strict';
// A09-05 · Cecilia: unter Hand-/Such-Sperre zahlt sie ihr ganzes Gold und löscht das Artifact, bekommt aber keine Kopie
// Kartentext: „You may once per turn spend all your Gold (at least 1) to delete an Artifact from your discard pile and add a copy of it from your deck to your hand."
// Kopfkommentar des Skripts: Es werden nur Artifacts angeboten, die auch WIRKLICH eine Kopie im Deck haben – „ohne diese Einschränkung wäre die Auswahl eine Falle: das gesamte Gold wäre weg, die Karte
// gelöscht, und die zweite Hälfte liefe ins Leere." Dieselbe Falle entsteht bei ps.handLocked (z. B. nach Smuggler's Pier, Crystal Well) und ps.searchLocked (Cats of the Pharaoh):
// actionAddCardFromDeckToHand liefert dort nichts, aber canActivateHeroEffect/onHeroEffect prüfen die Sperren nicht.
// Aufbau: Seed 1234. Seite 0: Held 0 Cecilia, 100 Gold; Ablage [Idej Blade - Hakai], Deck enthält 1x Hakai.
// Schritte: Sperre setzen (handLocked | searchLocked), Heldeneffekt aktivieren, Hakai wählen.
// Erwartet: Effekt ist nicht aktivierbar (oder bricht vor der Zahlung ab) – Gold, Ablage und Einmal-pro-Zug bleiben unberührt.
// Beobachtet: Gold 100 -> 0, Hakai aus Ablage gelöscht, keine Karte auf der Hand, Einmal-pro-Zug verbraucht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const sperre of ['handLocked', 'searchLocked']) {
    R.section(sperre);
    const t = await H.fresh({ hand: [[], []], gold: [100, 100],
      heroes: [['Cecilia, the Harrowing Crusader', 'Zwei, the Lucky Thief', 'Rick, the Trigger Happy Undertaker'], null],
      discard: [['Idej Blade - Hakai'], []], deck: [['Idej Blade - Hakai', ...Array(6).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] });
    t.gs.players[0][sperre] = true;
    t.script.push({ match: d => d.type === 'cardGallery' && /Cecilia/.test(d.title || ''), answer: () => ({ cardName: 'Idej Blade - Hakai' }) });
    await t.activateHero(0, 0, {});
    const verloren = t.gs.players[0].gold === 0 && !t.pile(0, 'hand').includes('Idej Blade - Hakai') && t.pile(0, 'deletedPile').includes('Idej Blade - Hakai');
    R.check(sperre + ': Cecilia zahlt nicht und löscht nichts, wenn die Kopie nicht auf die Hand darf', !verloren && t.gs.players[0].gold === 100,
      { gold: t.gs.players[0].gold, hand: t.pile(0, 'hand'), deleted: t.pile(0, 'deletedPile'), discard: t.pile(0, 'discardPile') });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });

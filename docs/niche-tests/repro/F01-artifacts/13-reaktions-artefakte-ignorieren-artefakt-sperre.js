'use strict';
// F01-artifacts-13 · Bamboo Shield / Boots of Hermes werden trotz Artefakt-Sperre „Boomerang" gespielt
// Kartentext Boomerang: „Choose an Artifact from your discard pile and add it to your hand. You cannot play any Artifacts for the rest of this turn."
//   (Blood-Soaked Coin: „You cannot play other Artifacts for the rest of the turn afterwards." – gleiche Sperre `ps._artifactLockTurn`)
// Aufbau: Sitz 0 spielt Boomerang (Beer aus der Ablage) und danach Pyroblast auf Held 0 von Sitz 1, der eine Magic Mirror (Surprise) trägt.
//   Magic Mirror negiert den Zauber (Boots-Fenster: Surprise des Gegners wird aktiviert) und führt eine Kopie gegen Held 0 von Sitz 0 aus (Schaden / Zielwahl auf einen Helden von Sitz 0
//   → Bamboo-Shield-Fenster in MEINEM Zug). In der Hand von Sitz 0 liegt jeweils genau eine der beiden Reaktionskarten.
// Gegenprobe (ohne Boomerang): die Karte wird angeboten und gespielt.
// Erwartung: Nach Boomerang wird keine der beiden Karten angeboten (Artefakt spielen = verboten; Deepsea Idol und Cute Camera respektieren die Sperre: `_engine.js` Z. 34523 / 37807).
// Beobachtet: siehe Ausgabe – ✗ bei jeder Karte, die trotz Sperre gespielt wird.
// Ursache: `bamboo-shield.js` (Schadensfenster) und der Hook `boots-of-hermes.js` `onSurpriseActivated` prüfen `ps._artifactLockTurn` nirgends.
const H = require('../../lib/h.js');
async function lauf(karte, mitSperre) {
  const t = await H.fresh({ hand: [['Boomerang', 'Pyroblast', karte], []], discard: [['Beer'], []], gold: [100, 100] });
  t.putSurprise(1, 0, 'Magic Mirror'); t.grantFor(1, 0, 'Magic Mirror');
  t.policy.confirm = true;
  if (mitSperre) {
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }), once: true });
    t.targetFn = (v) => [v[0].id];
    await t.play(0, 'Boomerang', { hero: 0 });
    t.reset();
  }
  let n = 0;
  t.targetFn = (v) => { n++; const w = v.find(x => x.type === 'hero' && x.owner === (n === 1 ? 1 : 0) && x.heroIdx === 0); return [(w || v[0]).id]; };   // 1. Wahl: Spiegel-Träger; 2. Wahl (Kopie): Angreifer
  const hp0 = t.hp(0, 0);
  await t.play(0, 'Pyroblast', { hero: 0 });
  const gespielt = t.pile(0, 'discardPile').includes(karte);
  return { gespielt, errors: t.errors, prompts: t.prompts.map(p => (p.d.title || p.d.type)), schaden: hp0 - t.hp(0, 0) };
}
(async () => {
  const R = H.runner();
  for (const karte of ['Boots of Hermes', 'Bamboo Shield']) {
    const ohne = await lauf(karte, false);
    R.check(karte + ' (Gegenprobe ohne Boomerang): wird gespielt', ohne.gespielt, { prompts: ohne.prompts, schaden: ohne.schaden });
    const mit = await lauf(karte, true);
    R.check(karte + ': nach Boomerang NICHT spielbar (Artefakt-Sperre)', !mit.gespielt, { prompts: mit.prompts, schaden: mit.schaden });
    R.check(karte + ': keine Engine-Fehler', mit.errors.length === 0, mit.errors);
  }
  R.finish();
})();

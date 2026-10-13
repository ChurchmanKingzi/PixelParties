'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-17 · Lolek (Shard Knight / Mender): „Future Tech Control Device" ist wählbar und landet auf dem EIGENEN Helden – der Gegner darf ihn dann übernehmen
//
//  Karten: Lolek, the Shard Knight (`lolek-the-shard-knight.js`), Lolek, Mender of the Shattered Trident (`lolek-mender-of-the-shattered-trident.js`),
//          Hilfsmodule `_lolek-shared.js` (`equippableEntries`, `hasDestination`, `chooseAndEquip`) und `_orchestra-shared.js` (`isEquipArtifact`, `equipDestinations`);
//          Future Tech Control Device (`future-tech-control-device.js`: `placesOnOpponentBoard: true`)
//  Kartentexte: Lolek: „… choose an equippable Artifact from your discard pile and equip it to a Hero **you control** …".
//               Control Device: „Equip this card to a Hero **your opponent** controls. Your opponent may once per turn, during their turn, take control of this Hero …"
//  Beide Vorgaben zugleich sind unerfüllbar: die Karte ist für Lolek keine zulässige Wahl. (Der normale Spielweg führt sie über `_isCrossSideArtifact`
//  auf die Gegenseite, server.js ~7540; `crossSidePlacement`.)
//  Erwartung: Die Control Device wird in der Galerie nicht angeboten (oder Lolek legt sie auf einen Gegnerhelden) – jedenfalls liegt sie nicht auf einem eigenen Helden.
//  Beobachtung (✗): `equipDestinations(…, { sides: [pi] })` kennt `placesOnOpponentBoard` nicht → 9 freie eigene Plätze; Lolek legt die Karte auf den EIGENEN Helden 0.
//  Der Besitzer der Karte wird dort als `opponentOf(inst.owner)` gelesen (`besitzer` in future-tech-control-device.js) – also der GEGNER: Sitz 1 aktiviert die Equip-Wirkung
//  und übernimmt Lolek (`charmedBy = 1`).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/17-lolek-control-device-auf-eigenen-helden.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const FTCD = 'Future Tech Control Device';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Lolek, the Shard Knight', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 600, discard: [[FTCD], []], gold: [100, 100] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const angeboten = [];
  t.script.push({ match: d => d.type === 'cardGallery' && /Lolek/.test(d.title || ''), answer: (d) => { angeboten.push(...d.cards.map(c => c.name)); return { cardName: FTCD, source: 'discard' }; } });
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'equip' }) });
  const r = await t.activateHero(0, 0, { effect: 'Lolek, the Shard Knight' });
  const eigene = [];
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) if (t.zone(0, hi, z) === FTCD) eigene.push(`hero${hi}/slot${z}`);
  R.note('Lolek-Effekt', { r, angeboten, eigene });
  R.check('Control Device wird Lolek nicht als Wahl angeboten', !angeboten.includes(FTCD), angeboten);
  R.check('Control Device liegt nicht auf einem eigenen Helden', eigene.length === 0, eigene);
  if (eigene.length) {
    const r2 = await t.activateEquip(1, 0, 0);       // der Gegner nutzt „take control of this Hero"
    R.note('Gegner aktiviert', { r2, charmedBy: t.hero(0, 0).charmedBy });
    R.check('der Gegner kann Lolek nicht übernehmen', t.hero(0, 0).charmedBy == null, t.hero(0, 0).charmedBy);
  }
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();

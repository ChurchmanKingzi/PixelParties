'use strict';
// A03-futuretech-20 · Gunslinger Riffel rüstet die Future Tech Control Device an sich selbst aus – der Gegner kann Riffel dann übernehmen (Prüfauftrag H03-17, hier für Riffel gemessen)
//
// Kartentexte: Riffel „… choose an equippable Artifact in your discard pile that this Hero has no copies of equipped to it yet. Search your deck for a copy of that Artifact and
//   equip it to **this Hero** without paying its Cost.“ · Control Device „Equip this card to a Hero **your opponent** controls. Your opponent may once per turn, during their turn,
//   take control of this Hero for the rest of the turn. …“
// Erwartung: beide Vorgaben zugleich sind unerfüllbar; die Control Device ist keine zulässige Wahl für Riffel (der normale Spielweg legt sie über `placesOnOpponentBoard` ausschließlich
//   auf die Gegenseite). Jedenfalls darf sie nicht an Riffels eigenem Helden hängen und dem Gegner die Übernahme erlauben.
// Beobachtet: Die Control Device wird angeboten, liegt danach an Riffel (Sitz 0, Held 0), und Sitz 1 übernimmt Riffel im eigenen Zug (`charmedBy` = 1, Heldseite = 1).
// Ursache: `future-tech-gunslinger-riffel.js` `kandidaten()` (Z. ~63-80) filtert nur Typ Equipment / Kopie im Deck / `istAusruestTraeger`; das Cross-Side-Flag `placesOnOpponentBoard` der Control Device wird nicht beachtet.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const CD = 'Future Tech Control Device';
  const t = await H.fresh({ heroes: [['Future Tech Gunslinger Riffel', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], []], discard: [[CD], [CD]], deck: [[CD, H.INERT.creature], []], gold: [100, 100] });
  t.phase(2);
  let angebot = [];
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { angebot = d.cards.map(c => c.name); return { cardName: CD }; } });
  await t.activateHero(0, 0, {});
  const eigene = [0, 1, 2].map(s => t.zone(0, 0, s)).includes(CD);
  R.check('Control Device wird Riffel nicht als Wahl angeboten', !angebot.includes(CD), angebot);
  R.check('Control Device liegt nicht an Riffels eigenem Helden', !eigene, [0, 1, 2].map(s => t.zone(0, 0, s)));
  await t.endTurn();                  // Sitz 1 am Zug
  t.gs.activePlayer = 1; t.phase(2);
  const ok = await t.run(() => t.host.doActivateEquipEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
  R.check('der Gegner kann Riffel nicht übernehmen', !(ok === true && t.hero(0, 0).charmedBy === 1), { ok, charmedBy: t.hero(0, 0).charmedBy });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });

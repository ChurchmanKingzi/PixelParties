'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „play it immediately without paying its Cost" für ein Artifact, das gerade aus dem Deck kommt (Als Vorgabe 10.10.)
//
//  Sky Archeologist deckt die oberste Deckkarte auf; ist sie ein Artifact, darf er es sofort kostenlos spielen. Wie ein fremder Effekt ein
//  Artifact „spielt", ist je nach Unterart schon entschieden (Deepsea Treasure, Misfire, Als Ruling 9.10.) — hier steht es EINMAL:
//
//    • EQUIPMENT   → wird sofort an einen gewählten Helden gelegt (`equipArtifactToHero`, mit `onPlay`/`onCardEnterZone`). Ohne freien
//                    Platz bei einem tauglichen Helden ist das Artifact NICHT spielbar.
//    • ALLES ANDERE (Normal/Reaction/Area/Surprise, auch Artifact Creatures: Powder Keg, Debt-O-Trons … haben feste Beschwörungsbedingungen,
//      die ein fremder Effekt nicht umgehen darf) → die Karte kommt auf die HAND und bekommt den Nullpreis-Vermerk
//      (`ps._freeArtifactNames[name]`, verfällt am Zugende): der Spieler spielt sie über ihren EIGENEN Weg (Kettenfenster, Zielwahl,
//      Zahlstellen im Server), aber KOSTENLOS. Das ist die Näherung an „immediately" — ein Skript kann den Server-Spielweg nicht nachbauen.
//      Wer sie nicht mehr spielt, behält sie auf der Hand (wie bei Deepsea Treasure).
//
//    spielweg(engine, pi, name)   → 'equip' | 'hand' | null   (null = nicht spielbar: kein Artifact, Artifact-Sperre, Hand gesperrt,
//                                                              Equipment ohne Platz)
//    spieleKostenlos(engine, pi, name, { source }) → 'equip' | 'hand' | null    (die Karte liegt dafür OBEN im Deck)
// ═══════════════════════════════════════════

const { isEquipArtifact, equipDestinations, equipArtifactToHero } = require('./_orchestra-shared');
const { hasCardType } = require('./_hooks');
const { decke } = require('./_deck-top-shared');

function spielweg(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const cd = engine._getCardDB()[name];
  if (!ps || !cd || !hasCardType(cd, 'Artifact')) return null;
  // Boomerangs „no Artifacts for the rest of this turn" sperrt jedes Spielen eines Artifacts.
  if (ps._artifactLockTurn === engine.gs.turn) return null;
  if (isEquipArtifact(cd)) return equipDestinations(engine, pi, name).length > 0 ? 'equip' : null;
  // Alles andere läuft über die Hand: „add to hand" ist unter einer Hand-Sperre nicht möglich.
  if (engine.handZugangGesperrt(pi)) return null;
  return 'hand';
}

async function spieleKostenlos(engine, pi, name, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const source = opts.source || null;
  const weg = spielweg(engine, pi, name);
  if (!weg || !ps || (ps.mainDeck || [])[0] !== name) return null;

  if (weg === 'equip') {
    const ziele = equipDestinations(engine, pi, name);
    let platz = ziele[0];
    if (ziele.length > 1) {
      const zonen = ziele.map(z => ({
        heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.side,
        label: `${gs.players[z.side]?.heroes?.[z.heroIdx]?.name || 'Hero'} · Slot ${z.slotIdx + 1}`,
      }));
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: source || name,
        description: `Equip ${name} to which Hero? (without paying its Cost)`,
        previewCardName: name,
        zones: zonen, cancellable: false, heroShortcut: false,
      });
      platz = ziele.find(z => z.heroIdx === wahl?.heroIdx && z.slotIdx === wahl?.slotIdx && (z.side ?? pi) === (wahl?.owner ?? pi)) || ziele[0];
    }
    // Aufdecken: Deck → Mitte → auf den Platz; umgebucht wird genau zur Landung.
    await decke(engine, pi, name, { source, dest: 'support', destHeroIdx: platz.heroIdx, destSlotIdx: platz.slotIdx });
    const inst = await equipArtifactToHero(engine, pi, name, platz.side ?? pi, platz.heroIdx, platz.slotIdx, {
      from: 'deck', source, animDelay: 120,
    });
    if (!inst) return null;
    engine.log('free_artifact_played', { player: ps.username, card: name, as: 'equipment', by: source });
    return 'equip';
  }

  // Hand + Nullpreis-Vermerk
  await decke(engine, pi, name, { source, dest: 'hand' });
  if (!(await engine.takeFromPile(pi, "deck", 0, { source }))) return null;
  await engine.handZugang(pi, name, { von: "deck", source });
  ps._freeArtifactNames = ps._freeArtifactNames || {};
  ps._freeArtifactNames[name] = true;
  engine.log('free_artifact_played', { player: ps.username, card: name, as: 'free_in_hand', by: source });
  engine.sync();
  return 'hand';
}

module.exports = { spielweg, spieleKostenlos };

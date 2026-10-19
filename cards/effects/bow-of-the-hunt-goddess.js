// ═══════════════════════════════════════════
//  CARD EFFECT: „Bow of the Hunt Goddess"
//  Artifact (Equipment, Cost 15)
//
//  „Equip this card to a Hero you control. Once per turn, when the
//  equipped Hero performs an Attack, you may search your deck for an
//  "Arrow" Artifact and play it directly from your deck in reaction to
//  the Attack. You still need to pay its Cost."
//
//  Seitenbindung: `equipOwnSideOnly` (Al, 5.9.: der Kartentext ist
//  bindend, siehe CARD_API.md).
//
//  ★ W17c (F01-17): der Effekt läuft über die Ausrüstungs-Reaktion der
//  Reaktionskette (`isEquipReaction`, `_promptReactionsForChain` in
//  `_engine.js`) — die Ausrüstung selbst wird nie ein Kettenglied, sie
//  SPIELT den Pfeil: dieser wird (nach Wahl in einer Galerie) aus dem
//  Deck genommen, bezahlt und als gewöhnliches Reaktionsglied auf den
//  Angriff gesetzt (`link.fromDeck`: nach der Auflösung Ablage statt
//  Handflug). Der Pfeil wirkt wie ein aus der Hand gespielter (Darge
//  zählt ihn, Arrow Slit kann ihn wiederholen).
//
//  Auslegung (siehe CARD_API.md „Welle 17 / W17c"):
//   • „Arrow" Artifact = Artifact mit „Arrow" im Namen und Reaktions-
//     Skript (Namensregel; deckt sich mit dem Archetyp „Arrows").
//     Magic Topaz ist kein „Arrow".
//   • Angeboten wird der Bow nur, wenn mindestens ein Pfeil im Deck
//     jetzt wirklich spielbar ist (Auslöser passt, Kosten zahlbar,
//     keine Artefakt-/Item-/Such-/Stapelsperre); sonst bleibt er stumm.
//   • „Once per turn" gilt je Bow (Kopie), Stempel beim tatsächlichen
//     Einsatz; bricht der Spieler die Pfeilwahl ab, bleibt er frei. Wird
//     der gespielte Pfeil danach NEGIERT (oder fizzelt), geht der Stempel
//     zurück (W19c, Al): der Bow darf im selben Zug erneut; die Kosten des
//     Pfeils bleiben bezahlt, der Pfeil geht in die Ablage.
//   • Nach der Suche wird das Deck gemischt (Such-Konvention).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Bow of the Hunt Goddess';

const stempelKey = (inst) => `bowHuntGoddess#${inst.id}`;

/** Spielbare Pfeile im Deck: [{ name, cost, count }] (je Name einmal, in Deckreihenfolge). */
function kandidaten(engine, pi, chainCtx) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  // Boomerang („no Artifacts …"), Item Lock (Handkarte als Kosten), Such-/Stapel-Sperren: das Spielen eines Artifacts aus dem Deck
  // unterliegt denselben Sperren wie das aus der Hand (die Hand-Spielsperre „aus der Hand" gilt nicht).
  if (ps._artifactLockTurn === gs.turn) return [];
  if (ps.itemLocked && engine._handOhneAufloesendeKarte(ps).length < 1) return [];
  if (engine._isSearchBlocked(pi, {}, 'deck')) return [];
  if (!engine.pileOutAllowed(pi, 'deck', { sourceOwner: pi })) return [];
  const db = engine._getCardDB();
  const out = new Map();
  for (const name of (ps.mainDeck || [])) {
    if (out.has(name)) { out.get(name).count++; continue; }
    if (!/Arrow/.test(name)) continue;
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Artifact') || hasCardType(cd, 'Creature')) continue;
    const sc = loadCardEffect(name);
    if (!sc?.isReaction || sc.isSurprise) continue;
    if (sc.reactionCondition && !sc.reactionCondition(gs, pi, engine, chainCtx)) continue;
    if (sc.oncePerGame || sc.oncePerGameKey) {
      if (ps._oncePerGameUsed?.has(sc.oncePerGameKey || name)) continue;
    }
    const cost = sc.dynamicCost ? sc.dynamicCost(gs, pi, engine, chainCtx) : (cd.cost || 0);
    if (!engine._rxCanAfford(ps, cost, name)) continue;
    out.set(name, { name, cost, count: 1 });
  }
  return [...out.values()];
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,

  // ── Ausrüstungs-Reaktion (Vertrag: siehe `_promptReactionsForChain`, Block „Ausruestungs-Reaktionen") ──
  isEquipReaction: true,

  /** Der Träger greift mit einer Attack an (Initialkarte der Kette), der Bow ist frisch und ein Pfeil ist spielbar. */
  equipReactionCondition(gs, pi, engine, chainCtx, inst) {
    const initial = (chainCtx?.chain || []).find(l => l.isInitialCard);
    if (!initial || initial.cardType !== 'Attack' || initial.owner !== pi) return false;
    // Der Angreifer ist der Held, an dem der Bow liegt (Brettseite + Index; geliehene Helden: `casterOwner`).
    if ((initial.casterOwner ?? initial.owner) !== engine.physicalSide(inst) || initial.heroIdx !== inst.heroIdx) return false;
    const hero = gs.players[engine.physicalSide(inst)]?.heroes?.[inst.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (gs.hoptUsed?.[`${stempelKey(inst)}:${pi}`] === gs.turn) return false;
    return kandidaten(engine, pi, chainCtx).length > 0;
  },

  /** Pfeilwahl aus dem Deck (abbrechbar). Rückgabe `{ cardName, cost, pile }` oder null. */
  async equipReactionPick(engine, pi, chainCtx, inst) {
    const liste = kandidaten(engine, pi, chainCtx);
    if (liste.length === 0) return null;
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: liste.map(k => ({ name: k.name, source: 'deck', count: k.count })),
      title: CARD_NAME,
      description: 'Search your deck for an "Arrow" Artifact and play it in reaction to the Attack. You still pay its Cost.',
      showCard: chainCtx?.chain?.[0]?.cardName || null,
      cancelLabel: 'No Arrow',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return null;
    const k = liste.find(x => x.name === picked.cardName);   // Server prüft nach: nur angebotene Pfeile
    if (!k) return null;
    return { cardName: k.name, cost: k.cost, pile: 'deck' };
  },

  /** Der Einsatz ist verbindlich (Karte genommen, Kosten gezahlt): „once per turn" für diesen Bow stempeln. */
  equipReactionCommit(engine, pi, inst) {
    if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
    engine.gs.hoptUsed[`${stempelKey(inst)}:${pi}`] = engine.gs.turn;
  },

  /** W19c (Al): der gespielte Pfeil wurde negiert (oder fizzelt) -> der Einsatz zählt nicht, „once per turn" ist wieder frei. */
  equipReactionRefund(engine, pi, inst) {
    const h = engine.gs.hoptUsed;
    if (h && h[`${stempelKey(inst)}:${pi}`] === engine.gs.turn) delete h[`${stempelKey(inst)}:${pi}`];
  },
};

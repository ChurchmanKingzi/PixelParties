// ═══════════════════════════════════════════
//  CARD EFFECT: „Mass Routing"
//  Spell (Decay Magic Lv 1, PP SOD) — steht auf der Bannliste
//
//  „Shuffle all Creatures on the board up to level 1/2/3 back into
//   their original owners' decks. Then, both players draw 1 card for
//   each of their Creatures shuffled back by this effect."
//
//  (Zug je Kreatur von 2 auf 1 gesenkt — Als Vorgabe 12.9.)
//
//  BAUART
//  ──────
//  • ★ „1/2/3" IST DAS DECAY-MAGIC-LEVEL DES NUTZERS — dieselbe Lesart
//    wie bei Create Illusion und Iceage. Gelesen mit
//    `effectiveSchoolLevelForCaster`, das Ability-Stapel in Support
//    Zones mitzaehlt, und auf 1..3 begrenzt.
//
//  • ★ GEPRUEFT WIRD DAS WIRKSAME LEVEL (`getEffectiveCardData`), nicht
//    der Datenbankwert — sonst greift jede Stufensetzung ins Leere
//    (Lawn Gnome, Shapeshift). Der Waechter `check-level-source` sieht
//    genau darauf.
//
//  • ★ ZIEL IST DAS DECK DES URSPRUENGLICHEN BESITZERS
//    (`originalOwner`), nicht des Kontrolleurs: eine uebernommene
//    Kreatur geht nach Hause. Genau daran haengt auch das Ziehen —
//    „their Creatures" meint die eigenen, egal wer sie zuletzt
//    kontrollierte.
//
//  • Gemischt wird EINMAL je betroffenem Deck, nachdem alle Karten
//    drin sind — nicht nach jeder einzelnen.
//
//  • Omni-immune Kreaturen (Cardinal Beasts, Golden Wings, geliehene
//    unter „Cute Conversion") bleiben stehen; sie zaehlen dann auch
//    nicht fuer das Ziehen.
// ═══════════════════════════════════════════

const { isCardinalBeastByName } = require('./_cardinal-shared');

const CARD_NAME = 'Mass Routing';
const SCHULE = 'Decay Magic';

/** Wirksames Level einer Brettkreatur. */
function level(engine, inst) {
  const cd = engine.getEffectiveCardData(inst);
  return cd ? (cd.level || 0) : null;
}

/** Alle Kreaturen auf dem Brett bis einschliesslich `maxLevel`. */
function betroffene(engine, maxLevel) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (engine.isEquipInZone(inst.name, inst)) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || cd.cardType !== 'Creature') continue;
    if ((cd.level || 0) > maxLevel) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Eine Brettkreatur ins Deck ihres urspruenglichen Besitzers legen.
 * Bauform `returnSupportCreatureToHand` (_deepsea-shared), nur mit dem
 * Deck als Ziel. Gemischt wird NICHT hier — s. Kopf.
 */
async function insDeck(engine, inst, maxLevel) {
  if (!inst || inst.zone !== 'support') return null;
  const gs = engine.gs;
  const kontrolleur = inst.controller ?? inst.owner;
  const heim = inst.originalOwner ?? inst.owner;      // ★ „original owners"
  const hps = gs.players[heim];
  const kps = gs.players[kontrolleur];
  if (!hps || !kps) return null;
  const heroIdx = inst.heroIdx;
  const slotIdx = inst.zoneSlot;
  const cardName = inst.name;

  // Der Versuch ist sichtbar, auch wenn er gleich abprallt.
  engine._broadcastEvent('play_zone_animation', {
    type: 'deep_sea_bubbles', owner: kontrolleur, heroIdx, zoneSlot: slotIdx,
  });

  if (inst.counters?._cardinalImmune || isCardinalBeastByName(inst.name)) {
    engine.log('cardinal_immune_block', { card: cardName, by: CARD_NAME, action: 'shuffle_into_deck' });
    return null;
  }

  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: kontrolleur, toOwner: heim,
    cardName, from: 'support', to: 'deck',
    fromHeroIdx: heroIdx, fromSlotIdx: slotIdx,
  });

  const slotArr = kps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }
  if (!hps.mainDeck) hps.mainDeck = [];
  hps.mainDeck.push(cardName);

  await engine.runHooks('onCardLeaveZone', {
    card: inst, fromZone: 'support',
    fromOwner: kontrolleur, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'deck', toOwner: heim,
    _skipReactionCheck: true,
  });
  engine._untrackCard(inst.id);
  engine.sync();
  await engine._delay(180);
  return heim;
}

module.exports = {
  // ★★ v1186 (Als Regel 18.9.): AoE OHNE SCHADEN. Die
  // Autoerkennung des Loaders haengt an der Schadensklammer —
  // diese Karte teilt keinen Schaden aus (mischt ALLE passenden Kreaturen zurueck), waere
  // also fuer Engine und CPU-Pilot keine AoE-Karte gewesen.
  // Deshalb von Hand deklariert (Waechter `check-aoe-text`).
  hitsMultipleTargets: true,

  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'deep_sea_bubbles' }, impactMs: 260 },

  requiresTarget: false,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      let lvl = 0;
      try { lvl = engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { lvl = 0; }
      const maxLevel = Math.max(1, Math.min(3, lvl));

      const ziele = betroffene(engine, maxLevel);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── ① Alles ins Deck ────────────────────────────────────────
      const proSpieler = [0, 0];
      for (const inst of ziele) {
        const heim = await insDeck(engine, inst, maxLevel);
        if (heim != null) proSpieler[heim] = (proSpieler[heim] || 0) + 1;
      }

      // ── ② Einmal je betroffenem Deck mischen (s. Kopf) ──────────
      for (let p = 0; p < 2; p++) {
        if (proSpieler[p] > 0) engine.shuffleDeck(p);
      }
      engine.log('mass_routing', {
        player: ps.username, maxLevel,
        shuffled: proSpieler[0] + proSpieler[1],
        mine: proSpieler[pi], theirs: proSpieler[pi === 0 ? 1 : 0],
      });
      engine.sync();

      // ── ③ Je zurueckgemischter EIGENER Kreatur eine Karte ───────
      // Reihenfolge: erst der Spieler dieser Karte, dann der Gegner.
      const reihenfolge = [pi, pi === 0 ? 1 : 0];
      for (const p of reihenfolge) {
        if (proSpieler[p] > 0) await engine.actionDrawCards(p, proSpieler[p]);
      }
      engine.sync();
    },
  },
};

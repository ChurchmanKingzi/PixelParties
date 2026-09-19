// ═══════════════════════════════════════════
//  CARD EFFECT: „Pink Sky"
//  Artifact · Cute · PP MOE · Kosten 4
//
//  „Negate the effects of all Creatures both players currently control
//   until the end of your opponent's next turn, except 'Cute'
//   Creatures. This counts as a negative status effect."
//
//  ── SCHABLONE: „Anti Magic Zone" ──────────────────────────────────
//  Dieselbe Bauform, dieselbe Dauer, dieselbe Ausnahmelogik-Stelle:
//    · `actionNegateCreature` je Kreatur statt eines eigenen Status —
//      die Engine erledigt damit Cardinal-Beasts-Immunitaet, die
//      Ablauf-Sweeps und den `clearCountersOnExpire`-Vertrag.
//    · „until the end of your opponent's next turn" =
//      `expiresAtTurn = gs.turn + 2`, `expiresForPlayer = Wirker`.
//      Aufgeraeumt wird zu Beginn des UEBERNAECHSTEN eigenen Zuges,
//      und das IST das Ende des gegnerischen naechsten Zuges.
//    · `selfInflicted: true` — die Karte ist ein globaler Effekt, kein
//      gezieltes Eingreifen auf dem Gegnerbrett; „Defending the Gate"
//      soll deshalb nicht ausloesen (gleiche Begruendung wie dort).
//
//  ── „EXCEPT 'CUTE' CREATURES" ─────────────────────────────────────
//  Geprueft ueber `isCuteCreatureInst` (_cute-shared), NICHT ueber den
//  gedruckten Archetyp allein: eine Kreatur im Support einer Heldin mit
//  „Cute Wings" ZAEHLT als Cute und muss deshalb ebenfalls verschont
//  bleiben. Der Kartentext setzt Cute in Anfuehrungszeichen — genau die
//  Schreibweise, die im Spiel „zaehlt als" bedeutet.
//
//  ── „THIS COUNTS AS A NEGATIVE STATUS EFFECT" ─────────────────────
//  Kommt aus `actionNegateCreature`: `negated` steht in STATUS_EFFECTS
//  als negativ, damit greifen Immunitaeten (`negative_status_immune`,
//  Karian, Johanna) und die Gegenmittel von selbst. Hier ist nichts
//  eigenes zu tun — die Zeile im Kartentext beschreibt, was der
//  Standardweg ohnehin tut.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isCuteCreatureInst } = require('./_cute-shared');

const CARD_NAME = 'Pink Sky';

/** Alle offen liegenden Kreaturen beider Seiten, in Brettreihenfolge. */
function alleKreaturen(engine) {
  const raus = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    raus.push(inst);
  }
  return raus;
}

module.exports = {
  // ── ARTEFAKT-VERTRAG, nicht `hooks.onPlay` ────────────────────────
  // ★★ v1224 (Als Befund 18.9.: „Ich kann Pink Sky nicht aktivieren —
  // in der Hand nicht ausgegraut, aber auf Klick und Drag passiert
  // nichts"). Ursache war der falsche Vertrag: ein ARTEFAKT wird ueber
  // `canActivate` / `resolve` gespielt (Muster „Blueprints"), nicht
  // ueber den `onPlay`-Haken der Zauber. Der Haken wurde schlicht nie
  // gerufen — deshalb blieb die Karte spielbar und tat nichts.
  isTargetingArtifact: false,

  // ★★ Wie „Anti Magic Zone": die Autoerkennung des Loaders haengt an
  // der Schadensklammer, diese Karte teilt aber keinen Schaden aus.
  // Ohne die Handdeklaration waere sie fuer Engine und CPU-Pilot keine
  // Flaechenkarte (Waechter `check-aoe-text`).
  hitsMultipleTargets: true,

  // ★★ v1182 — ENTKOPPELTE BILDER: wird die Karte NEGIERT, laeuft ihr
  // Rumpf nie; dann spielt die Engine diese Bilder.
  spellVisual: {
    impact: { type: 'pink_sky_puff' }, impactMs: 260,
  },

  /**
   * Spielbar, sobald mindestens EINE Kreatur da ist, die die Karte
   * ueberhaupt treffen kann. Stehen nur „Cute"-Kreaturen (oder gar
   * keine) auf dem Brett, waeren die 4 Gold verloren.
   */
  canActivate(gs, pi, engine) {
    if (!engine) return true;
    return alleKreaturen(engine).some(inst => !isCuteCreatureInst(engine, inst));
  },

  async resolve(engine, pi /*, selectedIds, validTargets */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // „until the end of your opponent's next turn"
    const expiresAtTurn = (gs.turn || 0) + 2;
    const expiresForPlayer = pi;

    // ── DER HIMMEL ────────────────────────────────────────────────
    // Brettweit, auf der Hintergrund-Ebene und UEBER den
    // Area-Hintergruenden (Als Vorgabe) — siehe `layer: 'overAreas'`
    // in CARD_API. Er geht VOR den Negierungen raus, damit das Bild
    // die ganze Abfolge traegt statt hinterherzulaufen.
    engine._broadcastEvent('play_zone_animation', {
      type: 'pink_sky', zoneType: 'board', layer: 'overAreas',
      duration: 2000, owner: pi, heroIdx: -1, zoneSlot: -1,
    });
    await engine._delay(260);

    let getroffen = 0;
    let verschont = 0;
    for (const inst of alleKreaturen(engine)) {
      if (isCuteCreatureInst(engine, inst)) {
        verschont++;
        // Die verschonten Kreaturen bekommen ein eigenes kleines Bild —
        // sonst sieht es aus, als haette die Karte sie uebersehen statt
        // sie auszunehmen.
        engine._broadcastEvent('play_zone_animation', {
          type: 'pink_sky_puff', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        continue;
      }
      await engine.actionNegateCreature(inst, CARD_NAME, {
        selfInflicted: true,
        expiresAtTurn,
        expiresForPlayer,
        buffKey: '_pink_sky_negated',
      });
      getroffen++;
    }

    engine.log('pink_sky', {
      player: ps.username, negated: getroffen, spared: verschont,
    });
    engine.sync();
    return { ok: true };
  },
};

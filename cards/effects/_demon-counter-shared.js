// ═══════════════════════════════════════════
//  GETEILT: Demon Counter und der Namensbezug „Horned Demon"
//
//  EINE Auslegungsstelle fuer alles, was mit Demon Countern arbeitet
//  (Als Konvention: je Familie EIN geteiltes Modul). Heute nutzen es
//  Baaliel, the Demon General und Horned Demon; Great Vanguard Demon
//  („place a Demon Counter on all Creatures you control" / „50 times
//  the combined number of Demon Counters on all cards on the board")
//  rastet spaeter ohne Umbau hier ein.
//
//  ── Der Zaehler ────────────────────────────────────────────────
//  Liegt auf der Karteninstanz als `inst.counters.demonCounter`,
//  waechst monoton und wird NIE je Runde zurueckgesetzt. Das Brett
//  zeigt ihn als Abzeichen (app-board.jsx, Schluessel `demonCounter`),
//  der Puzzle-Editor kann ihn setzen (app-puzzle.jsx + Puzzle-Loader
//  in server.js, Als Regel 16.8.).
//
//  ── Was zaehlt ──────────────────────────────────────────────────
//  Horned Demons Schaden rechnet nach Als Ruling (29.8.) AUSSCHLIESSLICH
//  mit Demon Countern — auch wenn der Kartentext nur „counters" sagt.
//  Deshalb gibt es hier bewusst KEINE Summe ueber andere Zaehlerarten.
//
//  ── Der Namensbezug ────────────────────────────────────────────
//  „a \"Horned Demon\" Creature" ist nach Als Regel ein TEILSTRING-
//  Treffer im ganzen Kartennamen, Gross-/Kleinschreibung zaehlt —
//  ein kuenftiger „Horned Demon Elder" zaehlt also mit, „horned demon"
//  kleingeschrieben nicht.
//
//  ── Auftritt ───────────────────────────────────────────────────
//  Das Setzen eines Zaehlers zeigt `soul_shard_dark_grant` (dunkler
//  Motenstoss mit Runen, Klang `elem_dark`) — eine BESTEHENDE
//  Animation mit Klang, bewusst keine neue (Als Regel 19.8.: jede
//  neue Animation braucht einen Klang; hier gibt es nichts Neues).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const COUNTER_KEY = 'demonCounter';
const HORNED_DEMON_NEEDLE = 'Horned Demon';
const ANIM_PLACE = 'soul_shard_dark_grant';

/** Traegt der Kartenname den Bezug „Horned Demon"? (Teilstring, Gross-/Kleinschreibung zaehlt.) */
function isHornedDemonName(name) {
  return typeof name === 'string' && name.includes(HORNED_DEMON_NEEDLE);
}

/** Demon Counter auf einer Instanz. */
function demonCountersOn(inst) {
  return inst?.counters?.[COUNTER_KEY] || 0;
}

/**
 * Alle „Horned Demon"-Creatures, die gerade auf dem Brett liegen —
 * BEIDE Seiten („all \"Horned Demon\" Creatures on the board"). Nur
 * Instanzen in einer Support Zone; verdeckte Surprises zaehlen nicht,
 * und eine Instanz, die gerade stirbt (`_deathResolved`), auch nicht.
 */
function hornedDemonsOnBoard(engine) {
  const out = [];
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.faceDown || inst._deathResolved) continue;
    if (!isHornedDemonName(inst.name)) continue;
    const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/**
 * `n` Demon Counter auf jede der Instanzen legen — mit Auftritt und
 * Log. Gibt die Zahl der bestueckten Instanzen zurueck. `sourceName`
 * ist die Karte, die die Zaehler verteilt (fuer das Log).
 */
function placeDemonCounters(engine, insts, n, sourceName) {
  let placed = 0;
  for (const inst of insts) {
    if (!inst) continue;
    const counters = inst.counters || (inst.counters = {});
    counters[COUNTER_KEY] = (counters[COUNTER_KEY] || 0) + n;
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_PLACE,
      owner: inst.controller ?? inst.owner,
      heroIdx: inst.heroIdx,
      zoneSlot: inst.zoneSlot,
    });
    engine.log('demon_counter_placed', {
      source: sourceName,
      card: inst.name,
      player: engine.gs.players[inst.controller ?? inst.owner]?.username,
      added: n,
      total: counters[COUNTER_KEY],
    });
    placed++;
  }
  if (placed > 0) engine.sync();
  return placed;
}

module.exports = {
  COUNTER_KEY,
  HORNED_DEMON_NEEDLE,
  ANIM_PLACE,
  isHornedDemonName,
  demonCountersOn,
  hornedDemonsOnBoard,
  placeDemonCounters,
};

// ═══════════════════════════════════════════
//  SHARED: "Doom Clock" archetype
//
//  Gemeinsame Mechanik aller Doom-Clock-Karten:
//  Doom Counter auf einer oder ZWEI Doom Clocks.
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Es koennen ZWEI Doom Clocks gleichzeitig liegen
//    (Doom Prophecy kann sie in die GEGNERISCHE
//    Area-Zone legen).
//  • Am Rundenende legt der Zugspieler je einen
//    Counter auf JEDE offene Doom Clock.
//  • Jede Uhr zaehlt EINZELN. Zwei Uhren auf je 15
//    sind zusammen 30 Counter — das Spiel endet
//    trotzdem nicht. Erst der 20. Counter AUF EINER
//    UHR laesst den Spieler verlieren, der ihn legt.
//  • Effekte, die "a Doom Clock" ohne Spezifikation
//    sagen, lassen den Spieler WAEHLEN (Picker) oder
//    loesen automatisch fuer beide aus. Welche
//    Variante gilt, entscheidet die jeweilige Karte:
//      – Ferocious Jaguar Warrior -> Picker
//      – Archer of Teocuilatl     -> beide
//  • Die Besiegungs-Ausloesung ("first 4 times every
//    turn") zaehlt PRO ZUG INSGESAMT, ueber beide
//    Spieler, und ist je Ereignis EINE Ausloesung —
//    also ein Counter. Liegen zwei Uhren, bekommt
//    JEDE so viele Counter.
// ═══════════════════════════════════════════

const CLOCK_NAME = 'Doom Clock';
const DOOM_LIMIT = 20;
const DEFEAT_TRIGGERS_PER_TURN = 4;

/** Alle Doom Clocks auf dem Brett (beide Seiten). */
function getDoomClocks(engine) {
  return engine.cardInstances.filter(inst =>
    inst.zone === 'area' && inst.name === CLOCK_NAME,
  );
}

/** Zaehlerstand einer Uhr. */
function counterCount(inst) {
  return inst?.counters?.doom || 0;
}

/**
 * Stand in den SPIELZUSTAND spiegeln, damit der Client ihn anzeigen
 * kann. `gs.areaZones` ist nur eine Namensliste — die Zaehler leben auf
 * der Karten-INSTANZ, und die wird nicht mitgeschickt. Ohne diesen
 * Spiegel blieb die Uhr im Brett stumm (Als Befund 5.8.: "Doom Clock
 * zeigt noch keine Counter an").
 */
function syncDisplay(engine) {
  const stand = {};
  for (const c of getDoomClocks(engine)) {
    stand[c.owner] = (stand[c.owner] || 0) + counterCount(c);
  }
  engine.gs.doomCounters = stand;
}

/** Uhren, von denen sich mindestens ein Counter nehmen laesst. */
function clocksWithCounters(engine) {
  return getDoomClocks(engine).filter(c => counterCount(c) > 0);
}

/**
 * Einen Doom Counter auf EINE Uhr legen.
 *
 * @param {object} engine
 * @param {object} clock  Area-Instanz der Uhr
 * @param {number} byPi   Wer legt ihn? Entscheidet ueber die Niederlage
 * @param {object} [opts] { sourceName }
 * @returns {Promise<boolean>} true, wenn dadurch das Spiel endete
 */
async function placeCounter(engine, clock, byPi, opts = {}) {
  if (!clock) return false;
  if (!clock.counters) clock.counters = {};
  clock.counters.doom = counterCount(clock) + 1;
  syncDisplay(engine);

  engine.log('doom_counter_placed', {
    player: engine.gs.players[byPi]?.username,
    count: clock.counters.doom,
    limit: DOOM_LIMIT,
    source: opts.sourceName || undefined,
    clockOwner: engine.gs.players[clock.owner]?.username,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: clock.owner, heroIdx: -1, zoneSlot: -1,
  });
  engine.sync();

  // Zuhoerer (Archer of Teocuilatl, Swift Eagle Warrior) NACH dem
  // Setzen, damit sie den neuen Stand sehen.
  await engine.runHooks('onDoomCounterPlaced', {
    clock, byPi, count: clock.counters.doom, sourceName: opts.sourceName || null,
  });

  // Der 20. Counter AUF DIESER UHR beendet das Spiel.
  if (clock.counters.doom >= DOOM_LIMIT) {
    const winnerIdx = byPi === 0 ? 1 : 0;
    engine.log('doom_clock_loss', {
      loser: engine.gs.players[byPi]?.username,
      winner: engine.gs.players[winnerIdx]?.username,
    });
    if (engine._fastMode || engine._inMctsSim) {
      engine.gs.result = { winnerIdx, reason: 'doom_clock' };
    } else if (engine.onGameOver) {
      engine.onGameOver(engine.room, winnerIdx, 'doom_clock');
    }
    return true;
  }
  return false;
}

/**
 * Counter von einer Uhr entfernen.
 * @returns {number} tatsaechlich entfernte Anzahl
 */
function removeCounters(engine, clock, amount) {
  if (!clock) return 0;
  const vorhanden = counterCount(clock);
  const weg = Math.max(0, Math.min(amount, vorhanden));
  if (weg === 0) return 0;
  clock.counters.doom = vorhanden - weg;
  syncDisplay(engine);
  engine.log('doom_counter_removed', {
    amount: weg, remaining: clock.counters.doom,
    clockOwner: engine.gs.players[clock.owner]?.username,
  });
  engine.sync();
  return weg;
}

/**
 * Uhr auswaehlen lassen, wenn mehrere in Frage kommen.
 * Bei genau einer wird sie ohne Rueckfrage genommen, bei keiner `null`.
 *
 * @param {Array} kandidaten Uhren, die in Frage kommen
 */
async function pickClock(engine, pi, kandidaten, opts = {}) {
  if (!kandidaten || kandidaten.length === 0) return null;
  if (kandidaten.length === 1) return kandidaten[0];

  // VERTRAG: optionPicker nimmt `{ id, label, description, color }`
  // und liefert `{ optionId }` zurueck — NICHT `{ value }`. Mit dem
  // falschen Feld kam `undefined` heraus und pflanzte sich als NaN
  // durch die Zaehler fort (Als Befund 5.8.: "NAN Schaden").
  const optionen = kandidaten.map((c, i) => ({
    id: String(i),
    label: `${CLOCK_NAME} (${engine.gs.players[c.owner]?.username})`,
    description: `${counterCount(c)} Doom Counters`,
    color: '#e04040',
  }));
  const wahl = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: opts.title || CLOCK_NAME,
    message: opts.message || 'Which Doom Clock?',
    options: optionen,
    cancellable: !!opts.cancellable,
  });
  if (wahl?.optionId == null) return null;
  const idx = Number(wahl.optionId);
  return Number.isInteger(idx) ? (kandidaten[idx] ?? null) : null;
}

module.exports = {
  syncDisplay,
  CLOCK_NAME,
  DOOM_LIMIT,
  DEFEAT_TRIGGERS_PER_TURN,
  getDoomClocks,
  clocksWithCounters,
  counterCount,
  placeCounter,
  removeCounters,
  pickClock,
};

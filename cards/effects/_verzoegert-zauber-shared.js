'use strict';
// ═══════════════════════════════════════════════════════════════════
//  VERZOEGERTE ZAUBER — gemeinsamer Baustein fuer Ghostly Warning und Atta, Speaker of Desires
//
//  „At the end of your next turn, if that Hero is not defeated and that Spell is still deleted, that Hero immediately performs that Spell as an
//   additional Action, regardless of its level and in spite of any negative status effects."  (Ghostly Warning)
//  „At the end of your opponent's next turn, if this Hero is not defeated and that Spell is still deleted, this Hero immediately uses it as an
//   additional Action, regardless of its level and in spite of any negative status effects."  (Atta)
//
//  Ein Zauber wird gelöscht und kommt am Ende eines kuenftigen Zuges zurueck — Ghostly Warning / Atta VERZOEGERN den Zauber nur.
//
//  ── Modell (Hand of Death) ─────────────────────────────────────────
//  • Die Vormerkung ist ein reiner DATENSATZ in `gs._verzoegerteZauber` (kein Closure, ueberlebt snapshot/restore, haengt an keiner Karteninstanz:
//    Ghostly Warning liegt dann laengst in der Ablage, Atta kann gefroren/negiert sein).
//  • Faellig am ENDE eines TATSAECHLICH gespielten Zuges des Spielers `zugspieler`, sobald `gs.turn > armedOnTurn` („next turn": der Zug, in dem die
//    Vormerkung entstand, zaehlt nicht). Ein uebersprungener Zug hat kein Ende (W68a, `_zug-fristen.js`): `_switchTurnInner` ruft uns dort nicht auf.
//    Der Eintrag wird VOR dem Wirken verbraucht.
//  • Bedingungen werden erst JETZT geprueft („if that Hero is not defeated and that Spell is still deleted"): der Held lebt (derselbe Held im selben Slot),
//    der Zauber liegt in diesem Moment im Geloescht-Stapel seines Besitzers — gleich, ob er dazwischen den Stapel verlassen hat und wieder dort liegt.
//  • Wirken: der Zauber wird still aus dem Geloescht-Stapel genommen und ueber `_castSpellImmediately` gewirkt (Wegwerf-Pool, `alsZusatzaktion`,
//    OHNE Stufen-/Status-/Phasenpruefung, OHNE Wisdom-Abwuerfe). Das Wirken ist PFLICHT: `_forceNonCancellable` macht jede Zielwahl und
//    Abfrage des Zaubers unabbrechbar. Gelingt der Guss nicht (kein legales Ziel), geht die Karte still zurueck in den Geloescht-Stapel.
// ═══════════════════════════════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { ausGeloeschtEntnehmen, inGeloeschtZurueck } = require('./_hell-circles-shared');

const KEY = '_verzoegerteZauber';

/**
 * Einen verzoegerten Zauber vormerken.
 * @param {object} engine
 * @param {object} e  { kind, quelle, zugspieler, spellName, pileOwnerPi, castPi, wirkerSeite, heroIdx }
 */
function vormerken(engine, e) {
  const gs = engine.gs;
  if (!Array.isArray(gs[KEY])) gs[KEY] = [];
  const hero = gs.players[e.wirkerSeite]?.heroes?.[e.heroIdx];
  gs[KEY].push({
    kind: e.kind, quelle: e.quelle || null,
    zugspieler: e.zugspieler, armedOnTurn: gs.turn,
    spellName: e.spellName, pileOwnerPi: e.pileOwnerPi ?? e.castPi,
    castPi: e.castPi, wirkerSeite: e.wirkerSeite, heroIdx: e.heroIdx, heroName: hero?.name || null,
  });
  engine.log('spell_delayed', { kind: e.kind, spell: e.spellName, hero: hero?.name || null, firesAtEndOfTurnOf: e.zugspieler, armedOnTurn: gs.turn });
}

/** Eintraege, die jetzt (Ende des laufenden Zuges) faellig sind. */
function faellige(gs) {
  const liste = gs[KEY];
  if (!Array.isArray(liste) || !liste.length) return [];
  return liste.filter(e => e.zugspieler === gs.activePlayer && gs.turn > e.armedOnTurn);
}

/** Am Zugende aufrufen (`_switchTurnInner`, nur bei einem echten Zug). */
async function faelligAbarbeiten(engine) {
  const gs = engine.gs;
  if (gs.result) return;
  const dran = faellige(gs);
  if (!dran.length) return;
  gs[KEY] = gs[KEY].filter(e => !dran.includes(e));   // verbrauchen, bevor etwas passiert
  for (const e of dran) {
    if (gs.result) return;
    try { await ausfuehren(engine, e); }
    catch (err) {
      console.error(`[Verzoegerter Zauber] ${e.spellName}:`, err.message);
      engine.log('delayed_spell_error', { spell: e.spellName, reason: String(err.message || '').slice(0, 200) });
    }
  }
}

async function ausfuehren(engine, e) {
  const gs = engine.gs;
  const castPs = gs.players[e.castPi];
  const hero = gs.players[e.wirkerSeite]?.heroes?.[e.heroIdx];
  const log = (grund) => engine.log('delayed_spell_skipped', { kind: e.kind, spell: e.spellName, reason: grund });
  // „if that Hero is not defeated" — W85b: ein Aufstieg/Abstieg aendert den NAMEN der Heldenstelle, der Held ist aber derselbe und nicht besiegt (vorher: Zauber verfiel mit `hero_gone`).
  // Ein ANDERER Held in der Stelle (Quetzahuitl ersetzt den sterbenden Helden) ist dagegen nicht „that Hero": gleicher Name, oder einer der beiden Namen ist ein Ascended Hero.
  const db = engine._getCardDB();
  const gleicherHeld = !e.heroName || hero?.name === e.heroName || db[hero?.name]?.cardType === 'Ascended Hero' || db[e.heroName]?.cardType === 'Ascended Hero';
  if (!castPs || !hero?.name || hero.hp <= 0 || !gleicherHeld) return log('hero_gone');
  // „and that Spell is still deleted" — jetzt, im Geloescht-Stapel des Besitzers
  // (Besitzer des Stapels: der eingetragene, sonst der Zaubernde — eine gestohlene Karte landet im Stapel ihres BESITZERS.)
  const pileOwnerPi = [e.pileOwnerPi, e.castPi].find(i => i != null && (gs.players[i]?.deletedPile || []).includes(e.spellName));
  if (pileOwnerPi == null) return log('not_deleted_anymore');
  const pileOwnerPs = gs.players[pileOwnerPi];
  const script = loadCardEffect(e.spellName);
  if (!script?.hooks?.onPlay) return log('not_performable');   // Reaktionen/Surprises haben keinen Wirkungsrumpf — der Zauber bleibt gelöscht
  if (!(await ausGeloeschtEntnehmen(engine, pileOwnerPi, e.spellName, e.quelle))) return log('take_failed');

  // Bild: der verzoegerte Zauber kehrt zurueck — Ghostly Warning: der Geist gibt ihn frei; Atta: die Buecher schlagen auf (`play_zone_animation`, Hero als Anker).
  engine._broadcastEvent('play_zone_animation', { type: e.kind === 'atta' ? 'atta_books' : 'ghostly_warning', owner: e.wirkerSeite, heroIdx: e.heroIdx, zoneSlot: -1, phase: 'return' });
  engine.sync();
  await engine._delay(700);
  engine.log('delayed_spell_cast', { kind: e.kind, player: castPs.username, hero: hero.name, spell: e.spellName });

  let res = null;
  engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;   // Pflicht: kein Abbrechen
  const _verzVorher = gs._verzoegertWirkt;
  gs._verzoegertWirkt = e.castPi;   // W85c: Sofort-Güsse INNERHALB (Chaos Magic) prüfen weder „am Zug" noch die Phase des Wirkers
  try {
    res = await engine._castSpellImmediately(e.castPi, e.heroIdx, e.spellName, {
      fromZone: 'hand', pool: [e.spellName], poolIndex: 0, by: e.quelle || e.spellName,
      alsZusatzaktion: true, heroOwner: e.wirkerSeite, ohneWisdom: true,
    });
  } finally { engine._forceNonCancellable--; if (_verzVorher === undefined) delete gs._verzoegertWirkt; else gs._verzoegertWirkt = _verzVorher; }
  const gewirkt = !!res && !res.cancelled;
  if (!gewirkt) {
    // Der Guss kam nicht zustande (kein legales Ziel, Fehler): die Karte geht still zurueck in den Geloescht-Stapel, sofern sie nirgendwo sonst liegt.
    const zuletzt = pileOwnerPs;
    if (!(zuletzt.deletedPile || []).includes(e.spellName) && !(zuletzt.discardPile || []).includes(e.spellName)) inGeloeschtZurueck(engine, pileOwnerPi, e.spellName);
    log('cast_failed');
  }
  engine.sync();
}

module.exports = { vormerken, faelligAbarbeiten, faellige, KEY };

// ═══════════════════════════════════════════
//  DAS SUCH-TEMPLATE  (v1121)
//
//  Al 15.9.: „Idealerweise haben alle Such-Effekte ein aehnliches
//  Template/eine aehnliche Bauweise, auf der kuenftige Karten ganz
//  automatisch aufbauen."
//
//  Hier steht diese Bauweise. Wer eine neue Such-Karte baut, braucht
//  nur dieses Modul — und bekommt das Verhalten unter der Such-Sperre
//  geschenkt.
//
//  ══ DIE VIER BAUFORMEN (Als Vorgabe) ═══════════════════════════════
//
//  ① NUR SUCHEN, oder: die Suche ist SCHRITT 1 und notwendig.
//     Beispiele: „Brilliant Idea", „Brainstorming", die Cheeses.
//     → Die Karte ist unter der Sperre GAR NICHT SPIELBAR.
//     Bauweise:   `blockedBySearchLock: true` am Kartenskript
//                 (bzw. `blockedBySearchLockDiscard` fuer die Ablage).
//
//  ② AKTIVIERBARER EFFEKT, dessen Schritt 1 die Suche ist.
//     Beispiel: „Cute Annoyance Mini".
//     → Der Effekt wird unter der Sperre NICHT ANGEBOTEN.
//     Bauweise:   `if (searchBlocked(engine, pi)) return false;`
//                 im `canActivate…`-Tor UND ganz oben im Effekt.
//
//  ③ SUCHE ALS EINE VON MEHREREN OPTIONEN.
//     Beispiel: „Soul Shard Ren" (Hand ODER Ablage).
//     → Nur DIESE OPTION faellt weg, der Rest bleibt.
//     Bauweise:   Optionsliste mit `filterSearchOption(...)` bauen.
//
//  ④ SUCHE PASSIERT NEBENBEI, als Teil eines groesseren Effekts.
//     → Der Such-SCHRITT wird uebersprungen, der Rest laeuft.
//     Bauweise:   `if (searchBlocked(...)) { … ueberspringen … }`
//
//  ══ WAS DER MOTOR VON SELBST TUT ═══════════════════════════════════
//
//  Zwei Netze fangen alles ab, was eine Karte vergisst:
//    • `promptGeneric` unterdrueckt jede Abfrage, die sich als
//      Hand-Suche ausweist (`searchToHand: true`) — Galerie WIE
//      Ja/Nein-Angebot (v1117/v1121);
//    • der Hand-Add selbst ist gesperrt (v1068), ganz am Ende.
//
//  ★ Die Netze ersetzen das Template NICHT. Wer sich nur auf sie
//  verlaesst, laesst den Spieler eine Wahl treffen, die dann ins Leere
//  laeuft — genau die Beschwerde, mit der das alles anfing.
// ═══════════════════════════════════════════

/**
 * Ist die Suche fuer diesen Spieler gerade gesperrt?
 *
 * @param {object} engine
 * @param {number} pi
 * @param {'deck'|'discard'} [pile='deck']
 */
function searchBlocked(engine, pi, pile = 'deck') {
  if (!engine || typeof engine._isSearchBlocked !== 'function') return false;
  return engine._isSearchBlocked(pi, {}, pile);
}

/**
 * BAUFORM ② — den ganzen Effekt ueberspringen.
 *
 * Gibt true zurueck, wenn der Aufrufer sofort aussteigen soll, und
 * schreibt einen Logeintrag, damit im Spielverlauf sichtbar bleibt,
 * WARUM nichts passiert ist.
 */
function skipIfSearchBlocked(engine, pi, cardName, pile = 'deck') {
  if (!searchBlocked(engine, pi, pile)) return false;
  engine.log('search_offer_skipped', {
    player: engine.gs.players[pi]?.username, card: cardName, pile,
  });
  return true;
}

/**
 * BAUFORM ③ — eine Optionsliste um die Such-Optionen kuerzen.
 *
 * Jede Option, die `search: true` traegt (oder deren `id` in
 * `suchIds` steht), faellt unter der Sperre weg. Der Rest bleibt.
 *
 * @param {Array} optionen  [{ id, label, search? }]
 * @returns {Array} die verbleibenden Optionen
 */
function filterSearchOption(engine, pi, optionen, { pile = 'deck', suchIds = [] } = {}) {
  if (!Array.isArray(optionen)) return optionen;
  if (!searchBlocked(engine, pi, pile)) return optionen;
  return optionen.filter(o => !(o?.search === true || suchIds.includes(o?.id)));
}

/**
 * Die Kennzeichnung fuer eine Such-Abfrage — Galerie ODER Angebot.
 *
 * ★ In die Prompt-Daten streuen, damit `promptGeneric` die Abfrage als
 * Hand-Suche erkennt. Ohne sie passiert die Abfrage und die Sperre
 * greift erst am Hand-Add.
 *
 *   await ctx.promptCardGallery(karten, { ...suchAbfrage('deck'), … })
 */
function suchAbfrage(pile = 'deck') {
  return { searchToHand: true, searchPile: pile };
}

module.exports = {
  searchBlocked,
  skipIfSearchBlocked,
  filterSearchOption,
  suchAbfrage,
};

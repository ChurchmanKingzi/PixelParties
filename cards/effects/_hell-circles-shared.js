// ═══════════════════════════════════════════
//  GETEILT: Hell Circles (The Second … The Eighth Circle of Hell)
//
//  Gemeinsame Bausteine der Area-Zauber „Circle of Hell":
//
//    loeschenUndSpielen(engine, pi, name, opts)
//                                  Die Klausel „When this card is deleted by an effect and you
//                                  have not played a deleted Area yet this turn, you may
//                                  immediately delete all Areas you control and play this deleted
//                                  Spell as an additional Action."
//    alleEigenenAreasLoeschen(engine, pi, quelle)
//    verlaesstBrett(ctx)           true, wenn DIESE Karte gerade ihre Area-Zone verlaesst; liefert
//                                  { nachZone: 'discard' | 'deleted', source }.
//    cpuBejahen                    cpuResponse: Confirm-Prompts bejahen.
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „Deleted" greift fuer JEDEN Loeschweg, ob die Karte aus Hand, Deck, Ablage oder vom Brett
//    kommt: die Engine meldet jeden Eintrag in den Geloescht-Stapel (`_geloeschtMeldung`) an das
//    Kartenskript (`onDeletedFromAnywhere`), und zwar als Nach-Ketten-Aktion, sobald das Brett
//    ruhig ist (am Zugbeginn/-ende sofort). „By an effect" ist keine Einschraenkung auf bestimmte
//    Quellen — alles ausser der eigenen Rueckholung der Klausel.
//  • „Have not played a deleted Area yet this turn": `ps._deletedAreaPlayedTurn`. Der Stempel
//    wird gesetzt, sobald es kein Zurueck mehr gibt (nach dem unumkehrbaren Loeschen der Areas, vor
//    dem abbrechbaren Spiel-Dialog) und bei Abbruch des Dialogs wieder aufgehoben. Durch das Loeschen
//    ausgeloeste Angebote anderer Kreise laufen erst danach (Warteschlange) und sehen den Endstand.
//  • „Play as an additional Action": die Karte wird DIREKT aus dem Geloescht-Stapel gewirkt (nie ueber die
//    Hand): ohne moeglichen Wirker entfaellt das Angebot still; nach „Ja" fragt die Engine bei mehreren
//    Wirkern sofort „Which Hero casts …?" (mit Abbrechen — dann bleibt alles unberuehrt, auch die Sperre),
//    bei genau einem wirkt dieser ohne Rueckfrage. Das Wirken laeuft ueber `_castSpellImmediately`
//    (Schulpruefung, Kette, Zusatzaktion) mit einem Wegwerf-Pool statt der Hand.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const HELL_AREA_COMMON = 'delete_play';

/** Verlaesst GENAU DIESE Karte gerade ihre Area-Zone? */
function verlaesstBrett(ctx) {
  if (ctx.fromZone !== 'area') return null;
  if (ctx.leavingCard && ctx.leavingCard.id !== ctx.card.id) return null;
  if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return null;
  return { nachZone: ctx.toZone === 'deleted' ? 'deleted' : 'discard', source: ctx.source || null };
}

/** Alle Areas unter `pi`s Kontrolle loeschen (eigene Klausel — ohne Schutzfenster). */
async function alleEigenenAreasLoeschen(engine, pi, quelle) {
  const insts = engine.getAreas(pi).slice();
  for (const inst of insts) {
    await engine.deleteArea(inst, quelle, { skipProtection: true, _skipLimitEnforce: true });
  }
  return insts.length;
}

/** Alle eigenen lebenden Helden, die `name` als Zusatzaktion wirken koennen (als Ziel-Eintraege fuer
 *  `promptEffectTarget`). Reine Probe: die Karte liegt nur fuer die Dauer der Abfrage hinten in der Hand
 *  (kein Zustandsversand, keine Instanz). */
function moeglicheWirker(engine, pi, name) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const alteLaenge = ps.hand.length;
  ps.hand[alteLaenge] = name;
  const out = [];
  try {
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (engine.getHeroEligibleActionCards(pi, hi).includes(name)) {
        out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
      }
    }
  } finally {
    ps.hand.length = alteLaenge;
  }
  return out;
}

/** Karte still (ohne „wenn geloescht"-Meldung) aus dem Geloescht-Stapel nehmen. */
async function ausGeloeschtEntnehmen(engine, pi, name, quelle) {
  engine._geloeschtStumm = (engine._geloeschtStumm || 0) + 1;
  try { return !!(await engine.takeFromPile(pi, 'deleted', name, { source: quelle })); }
  finally { engine._geloeschtStumm--; }
}

/** Nicht gewirkte Karte still zurueck in den Geloescht-Stapel. */
function inGeloeschtZurueck(engine, pi, name) {
  const ps = engine.gs.players[pi];
  engine._geloeschtStumm = (engine._geloeschtStumm || 0) + 1;
  try {
    engine._geloeschtVerfolgen(pi);
    ps.deletedPile.push(name);
  } finally { engine._geloeschtStumm--; }
  engine.sync();
}

/**
 * Die gemeinsame Klausel (2.–8. Kreis). `opts.verbotenWennQuelleSelbst` ist unbenutzt; die Karten
 * unterscheiden sich im Wortlaut („by an effect" / „by another card's effect"), nicht im Ablauf.
 *
 * Ablauf: ohne moeglichen Wirker kein Angebot → Ja/Nein → bei mehreren Wirkern DIREKTE Wirker-Wahl
 * (mit Abbrechen, noch vor jeder Aenderung am Brett), bei einem Wirker sofort → alle eigenen Areas
 * loeschen → Karte direkt aus dem Geloescht-Stapel wirken (NICHT ueber die Hand).
 */
async function loeschenUndSpielen(engine, pi, name, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps._deletedAreaPlayedTurn === gs.turn) return false;
  if (!(ps.deletedPile || []).includes(name)) return false;          // inzwischen weg (z. B. zurueckgeholt)
  let wirker = moeglicheWirker(engine, pi, name);
  if (wirker.length === 0) return false;                             // kein Wirker → Angebot entfaellt still

  await engine.showTriggeredEffect?.(name, { playerIdx: pi });
  const antwort = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: name,
    message: `"${name}" was deleted! Delete all Areas you control and play it as an additional Action?`,
    showCard: name,
    confirmLabel: '🔥 Play it!',
    cancelLabel: 'No',
    cancellable: true,
    gerrymanderEligible: true,
  });
  if (!engine._confirmSaidYes(antwort)) return false;

  // Wirker-Wahl (mit Abbrechen) — VOR dem unumkehrbaren Loeschen der Areas.
  wirker = moeglicheWirker(engine, pi, name);                        // das Brett kann sich waehrend der Abfrage geaendert haben
  if (wirker.length === 0 || !(ps.deletedPile || []).includes(name)) return false;
  let held = wirker[0];
  if (wirker.length > 1) {
    const pick = await engine.promptEffectTarget(pi, wirker, {
      title: name,
      description: `Which Hero casts ${name}? (Cancel leaves it in the deleted pile.)`,
      confirmLabel: '🔥 Cast!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1 },
      maxTotal: 1,
    });
    if (!pick || pick.length === 0) return false;                    // Abbruch: nichts geschieht, keine Sperre
    held = wirker.find(w => w.id === pick[0]) || wirker[0];
  }

  const sperreVorher = ps._deletedAreaPlayedTurn;
  await alleEigenenAreasLoeschen(engine, pi, name);

  if (!(ps.deletedPile || []).includes(name)) return false;
  if (!(await ausGeloeschtEntnehmen(engine, pi, name, name))) return false;
  ps._deletedAreaPlayedTurn = gs.turn;   // ab hier gibt es kein Zurueck mehr (die Areas sind weg)

  // Die Karte wird direkt aus dem Geloescht-Stapel gewirkt: ein Wegwerf-Pool ersetzt die Hand.
  const pool = [name];
  let res = null;
  try {
    res = await engine._castSpellImmediately(pi, held.heroIdx, name, {
      fromZone: 'hand', pool, poolIndex: 0, by: name, alsZusatzaktion: true,
    });
  } catch (err) {
    console.error(`[${name}] Wirken aus dem Geloescht-Stapel:`, err.message);
  }
  const gewirkt = !!res && !res.cancelled;
  if (!gewirkt) {
    // Der Guss kam nicht zustande (Abbruch in der Karte, Fehler): Karte zurueck, Sperre wieder auf.
    if (!(ps.deletedPile || []).includes(name) && !(ps.discardPile || []).includes(name)
        && !engine.getAreas(pi).some(i => i.name === name)) inGeloeschtZurueck(engine, pi, name);
    ps._deletedAreaPlayedTurn = sperreVorher;
  }
  engine.log('hell_circle_replayed', { player: ps.username, card: name, played: gewirkt, hero: held.cardName });
  engine.sync();
  return gewirkt;
}

const cpuBejahen = {
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
};

module.exports = {
  HELL_AREA_COMMON, verlaesstBrett, alleEigenenAreasLoeschen,
  loeschenUndSpielen, moeglicheWirker, ausGeloeschtEntnehmen, inGeloeschtZurueck, cpuBejahen, hasCardType,
};

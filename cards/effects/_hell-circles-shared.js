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
//  • „Play as an additional Action": die Karte geht kurz aus dem Geloescht-Stapel auf die Hand
//    und wird ueber die ECHTE Zusatzaktions-Abfrage (`performImmediateActionAnyHero`, nur dieser
//    Zauber) gespielt — mit Wirker-Wahl, Schulpruefung, Kette. Wird die Abfrage abgebrochen oder
//    ist kein Wirker faehig, geht sie unveraendert in den Geloescht-Stapel zurueck. Das Angebot
//    entfaellt still, wenn kein eigener Held den Zauber wirken kann.
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

/** Kann irgendein lebender eigener Held `name` als Zusatzaktion wirken? Reine Probe: die Karte liegt
 *  nur fuer die Dauer der Abfrage hinten in der Hand (kein Zustandsversand, keine Instanz). */
function heldKannWirken(engine, pi, name) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const alteLaenge = ps.hand.length;
  ps.hand[alteLaenge] = name;
  try {
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (engine.getHeroEligibleActionCards(pi, hi).includes(name)) return true;
    }
    return false;
  } finally {
    ps.hand.length = alteLaenge;
  }
}

/** Karte vom Stapel (`pile`) fuer die Zusatzaktion kurz auf die Hand legen. */
async function aufHandLegen(engine, pi, pile, name, quelle) {
  engine._geloeschtStumm = (engine._geloeschtStumm || 0) + 1;
  let taken = null;
  try { taken = await engine.takeFromPile(pi, pile, name, { source: quelle }); }
  finally { engine._geloeschtStumm--; }
  if (!taken) return false;
  const inst = engine.handZugangSync(pi, taken.name, { source: quelle, von: pile });
  if (inst === false) return false;
  const ps = engine.gs.players[pi];
  engine._pileFlight(pi, taken.name, pile, 'hand', { toHandIdx: ps.hand.length - 1, finalHandSize: ps.hand.length });
  return true;
}

/** Nicht gespielte Karte aus der Hand zurueck in den Geloescht-Stapel (ohne neue Meldung). */
function zurueckInGeloescht(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const idx = (ps.hand || []).lastIndexOf(name);
  if (idx < 0) return;
  const inst = [...engine.cardInstances].reverse().find(c => c.name === name && c.zone === 'hand' && c.owner === pi);
  engine._geloeschtStumm = (engine._geloeschtStumm || 0) + 1;
  try {
    engine.takeFromPileSync(pi, 'hand', idx, { source: 'Circle of Hell' });
    if (inst) engine._untrackCard(inst.id);
    engine._geloeschtVerfolgen(pi);
    ps.deletedPile.push(name);
  } finally { engine._geloeschtStumm--; }
  engine._pileFlight(pi, name, 'hand', 'deleted');
  engine.sync();
}

/**
 * Die gemeinsame Klausel (2.–8. Kreis). `opts.verbotenWennQuelleSelbst` ist unbenutzt; die Karten
 * unterscheiden sich im Wortlaut („by an effect" / „by another card's effect"), nicht im Ablauf.
 */
async function loeschenUndSpielen(engine, pi, name, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps._deletedAreaPlayedTurn === gs.turn) return false;
  if (!(ps.deletedPile || []).includes(name)) return false;          // inzwischen weg (z. B. zurueckgeholt)
  if (!heldKannWirken(engine, pi, name)) return false;               // kein Wirker → Angebot entfaellt still

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

  // Die Sperre wird erst gesetzt, wenn es kein Zurueck mehr gibt, und bei Abbruch wieder aufgehoben:
  // die Areas sind danach geloescht (nicht rueckgaengig), das Spielen selbst aber abbrechbar. Die durch
  // die Loeschung ausgeloesten Angebote anderer Kreise laufen erst NACH dieser Funktion (Warteschlange)
  // und sehen daher den endgueltigen Stand der Sperre.
  const sperreVorher = ps._deletedAreaPlayedTurn;
  await alleEigenenAreasLoeschen(engine, pi, name);

  if (!(ps.deletedPile || []).includes(name)) return false;
  if (!(await aufHandLegen(engine, pi, 'deleted', name, name))) return false;
  ps._deletedAreaPlayedTurn = gs.turn;   // ab hier nur noch der abbrechbare Spiel-Dialog

  const res = await engine.performImmediateActionAnyHero(pi, {
    title: name,
    description: `Play "${name}" as an additional Action — or cancel to leave it in the deleted pile.`,
    allowedCardTypes: ['Spell'],
    cardNameFilter: (n) => n === name,
    skipAbilities: true, skipHeroEffects: true,
    cancellable: true,
  });
  if (!res?.played) {
    zurueckInGeloescht(engine, pi, name);
    ps._deletedAreaPlayedTurn = sperreVorher;   // abgebrochen: Sperre wieder aufheben
  }
  engine.log('hell_circle_replayed', { player: ps.username, card: name, played: !!res?.played });
  engine.sync();
  return !!res?.played;
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
  loeschenUndSpielen, aufHandLegen, zurueckInGeloescht, heldKannWirken, cpuBejahen, hasCardType,
};

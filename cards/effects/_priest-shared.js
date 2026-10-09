// ═══════════════════════════════════════════
//  GETEILTER KERN: Archetyp „Priests" (Priest of Luna, Priest of Tempeste)
//
//  Beide Karten teilen zwei Bausteine:
//   1. ZUSATZBESCHWOERUNG: „You may shuffle 5 Creatures with different names from
//      your discard pile back into your deck to summon this Creature as an
//      additional Action." → Archer-/Doctor-Fester-Muster: `inherentAction` (nur
//      wenn bezahlbar UND der Weg ueber die normale Aktion nicht offen ist) +
//      `beforeSummon` (Kosten, Abbruch laesst die Karte in der Hand).
//   2. KOSTEN DER PASSIVEN: „shuffle 2 Creatures with different names from your
//      discard pile back into your deck" — beide ueber `waehleUndMischen`.
// ═══════════════════════════════════════════

const { isSummonablePileCreature } = require('./_hooks');

/** Creatures der Ablage, entdoppelt nach Namen (Galerie-Form). */
function ablageKreaturen(engine, pi, ausser = []) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const zaehler = new Map();
  for (const n of (ps?.discardPile || [])) {
    if (ausser.includes(n)) continue;
    const cd = db[n];
    if (!cd || !isSummonablePileCreature(cd)) continue;
    zaehler.set(n, (zaehler.get(n) || 0) + 1);
  }
  return [...zaehler.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'discard', count }));
}

/** Gibt es `n` Creatures mit verschiedenen Namen in der Ablage? */
function kannBezahlen(engine, pi, n) {
  return ablageKreaturen(engine, pi).length >= n;
}

/**
 * `n` Creatures mit verschiedenen Namen aus der Ablage waehlen (abbrechbar, nichts wird
 * vor dem Ende bewegt) — gibt die Namen zurueck oder null bei Abbruch.
 */
async function waehleKosten(engine, pi, n, titel) {
  const gewaehlt = [];
  while (gewaehlt.length < n) {
    const karten = ablageKreaturen(engine, pi, gewaehlt);
    if (karten.length === 0) return null;
    const w = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards: karten, title: titel, source: titel,
      description: `Choose ${n} Creatures with different names from your discard pile to shuffle back into your deck (${gewaehlt.length + 1}/${n}).`,
      confirmLabel: '🔀 Shuffle back', confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!w || w.cancelled || !w.cardName || !karten.some(k => k.name === w.cardName)) return null;
    gewaehlt.push(w.cardName);
  }
  return gewaehlt;
}

/** Die gewaehlten Creatures ins Deck mischen (Kosten bezahlen). true bei Erfolg. */
async function mischeZurueck(engine, pi, namen, titel) {
  if (!(await engine._discardOutAllowed(pi, { source: titel }))) return false;
  const bewegt = await engine.actionRecycleCards(pi, namen, { source: titel });
  return bewegt.length === namen.length;
}

/**
 * Vertrag der Zusatzbeschwoerung: Heldenaktion offen? Dann bleibt der normale Summon (die Aktion), sonst
 * (Main Phase oder Aktion schon verbraucht) ist der Zusatzweg die einzige Moeglichkeit.
 */
function zusatzWegGilt(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return false;
  if (gs.currentPhase !== 3) return true;                       // Main Phase: nur als Zusatzaktion moeglich
  return (ps.heroesActedThisTurn?.length || 0) > 0;             // Action Phase: erst nach der ersten Aktion
}

/**
 * Bausteine fuer ein Priester-Skript: `inherentAction` + `beforeSummon`.
 */
function zusatzBeschwoerung(CARD_NAME) {
  return {
    inherentAction(gs, pi, heroIdx, engine) {
      if (!engine) return false;
      if (!zusatzWegGilt(gs, pi)) return false;
      return kannBezahlen(engine, pi, 5);
    },
    async beforeSummon(ctx) {
      if (!ctx.isInherentAction) return true;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const namen = await waehleKosten(engine, pi, 5, CARD_NAME);
      if (!namen) return false;                                  // Abbruch: Karte bleibt in der Hand
      if (!(await mischeZurueck(engine, pi, namen, CARD_NAME))) return false;
      engine.log('priest_summon_cost', { player: engine.gs.players[pi]?.username, card: CARD_NAME, shuffled: namen });
      return true;
    },
  };
}

module.exports = { ablageKreaturen, kannBezahlen, waehleKosten, mischeZurueck, zusatzWegGilt, zusatzBeschwoerung };

// ═══════════════════════════════════════════
//  GETEILT: die "Monkee"-Regeln
//
//  Die EINZIGE Stelle, an der festgelegt ist, was eine "Monkee"-Kreatur
//  ist und wann ein Goldgewinn den Archetyp ausloest. Aendert sich die
//  Auslegung, aendert sie sich hier fuer alle Karten gleichzeitig.
//  Vorbild und gleiche Bauart: `_drago-shared.js`.
//
//  ── Namensregel ──
//  Geprueft wird der GANZE Kartenname auf den Teilstring "Monkee"
//  (Gross-/Kleinschreibung zaehlt, wie bei allen Namensbezuegen im
//  Spiel). Bestand: Cheeky / Nimble / Resilient / Criminal Monkee sowie
//  Non-Fungible Monkee — Letzteres ist ein ARTEFAKT und damit keine
//  "Monkee"-Kreatur; die Kreatur-Pruefung filtert es heraus.
//
//  ── Gold-Ausloeser (Als Rulings 8.8.) ──
//  "when you gain 4 or more Gold through an effect":
//    • EIGENER Gewinn (der Gegner loest nichts aus),
//    • NICHT das automatische Rundeneinkommen der Resource Phase —
//      das traegt `_isResourceGain` (siehe actionGainGold),
//    • mindestens 4 Gold in EINEM Ereignis,
//    • ausgewertet NACH der Buchung (`afterResourceGain`), damit
//      "immediately pay that Gold" wirklich bezahlbar ist und die
//      Goldanzeige beim Prompt schon den neuen Stand zeigt.
//  "paying that Gold" bezahlt den GESAMTEN gerade gewonnenen Betrag,
//  nicht zwingend genau 4.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const MONKEE = 'Monkee';
const MIN_GOLD = 4;

/** Traegt der Kartenname "Monkee"? */
function isMonkeeName(cardName) {
  return String(cardName || '').includes(MONKEE);
}

/** "Monkee"-Karte UND Kreatur? (Non-Fungible Monkee ist ein Artefakt.) */
function isMonkeeCreature(engine, inst) {
  if (!inst || !isMonkeeName(inst.name)) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

/**
 * Betrag, den dieser Goldgewinn fuer den Archetyp bedeutet — 0, wenn er
 * nicht ausloest. `ctx` ist der `afterResourceGain`-Kontext.
 */
function monkeeGoldTrigger(ctx, ownerIdx) {
  if (!ctx) return 0;
  if (ctx.playerIdx !== ownerIdx) return 0;   // nur eigener Gewinn
  if (ctx._isResourceGain) return 0;          // kein Rundeneinkommen
  const betrag = ctx.amount || 0;
  return betrag >= MIN_GOLD ? betrag : 0;
}

/**
 * Ist die Goldquelle dieses Ereignisses schon verbraucht? (Als Ruling
 * 8.8.) Nimmt ein Monkee das Gold fuer seinen Effekt, ist die Quelle
 * weg — kein weiterer Monkee darf auf DASSELBE Gewinn-Ereignis
 * reagieren. Verschachtelte Gewinne, die waehrend der Aufloesung
 * entstehen (etwa durch Non-Fungible Monkee), sind eigene Quellen und
 * bleiben verfuegbar.
 */
function goldSourceVerbraucht(ctx) {
  return !!ctx?._goldSource?.consumed;
}

/** Die Quelle als verbraucht markieren — erst NACH der Zahlung. */
function verbraucheGoldSource(ctx) {
  if (ctx?._goldSource) ctx._goldSource.consumed = true;
}

/**
 * Darf dieser Held die Kreatur NORMAL beschwoeren? (Als Ruling 8.8.:
 * "summon as an additional Action" ist eine ganz normale Beschwoerung —
 * sie kostet nur keine Aktion und laeuft reaktiv. Ein tauglicher Caster
 * ist also weiterhin Pflicht.)
 *
 * Geprueft wird: lebendig, nicht Frozen / Stunned / Webbed / Bound /
 * Negated, und die Level- bzw. Schulanforderung der Karte
 * (`heroMeetsLevelReq` deckt Abilities, Ascension-Bypaesse und Wisdom mit ab).
 *
 * ANMERKUNG: `the-cosmic-depths.js` fuehrt dieselbe Pruefung als eigene
 * lokale Kopie (dort ohne `negated`/`webbed`). Zusammenlegen waere
 * sinnvoll, ist aber eine Aenderung an fremder Karte — Al gemeldet.
 */
function canHeroSummon(engine, pi, heroIdx, cd) {
  const hero = engine.gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const st = hero.statuses || {};
  if (st.frozen || st.stunned || st.webbed || st.bound || st.negated) return false;
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Alle Plaetze, auf die diese Kreatur regulaer beschworen werden
 * koennte — je EIN Eintrag pro freier Zone eines tauglichen Helden,
 * damit der Spieler wie bei einer normalen Beschwoerung waehlen kann
 * (Als Vorgabe 8.8.), nicht nur den ersten freien Slot bekommt.
 */
function eligibleSummonZones(engine, pi, cardName) {
  const ps = engine.gs?.players?.[pi];
  const cd = engine._getCardDB()[cardName];
  if (!ps || !cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!canHeroSummon(engine, pi, hi, cd)) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let zi = 0; zi < Math.min(zones.length, 3); zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({
          heroIdx: hi, slotIdx: zi,
          label: `${ps.heroes[hi].name} — Slot ${zi + 1}`,
        });
      }
    }
  }
  return out;
}

/** Erster freier Support-Slot eines Helden, sonst -1. */
function freeSlotOn(ps, heroIdx) {
  const zones = ps?.supportZones?.[heroIdx] || [];
  for (let z = 0; z < Math.min(zones.length, 3); z++) {
    if ((zones[z] || []).length === 0) return z;
  }
  return -1;
}

/** Irgendein Held mit freiem Platz — liefert {heroIdx, slot} oder null. */
function anyFreeZone(ps) {
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!ps.heroes[hi]?.name) continue;
    const slot = freeSlotOn(ps, hi);
    if (slot >= 0) return { heroIdx: hi, slot };
  }
  return null;
}

module.exports = {
  MONKEE, MIN_GOLD,
  isMonkeeName, isMonkeeCreature, monkeeGoldTrigger,
  goldSourceVerbraucht, verbraucheGoldSource,
  canHeroSummon, eligibleSummonZones,
  freeSlotOn, anyFreeZone,
};

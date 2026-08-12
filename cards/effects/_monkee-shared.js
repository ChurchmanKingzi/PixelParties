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

// Caster-Eignung und waehlbare Plaetze liegen in `_summon-eligibility.js`
// — dieselbe Auslegung nutzt auch green-dragoneer.js. Hier nur
// weitergereicht, damit die Monkee-Karten eine einzige Bezugsquelle
// haben.
const { canHeroSummon, eligibleSummonZones } = require('./_summon-eligibility');

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

/**
 * ══ INVEST COUNTER ALS KOSTEN (v342) ══
 *
 * Alle vier Monkee-Kreaturen haben ab v342 eine zweite Faehigkeit der
 * gleichen Bauart: „You may once per turn remove N Invest Counters from
 * a Hero you control to …". Die Zaehler kommen von Logan, the
 * Investment Monkee (`hero._investCounters`) — das ist die Klammer, die
 * ihn in den Archetyp einbindet.
 *
 * Alles Gemeinsame steht deshalb hier: welcher Held zahlen kann, die
 * Auswahl bei mehreren Kandidaten, das Abbuchen und die
 * Einmal-pro-Zug-Sperre. Die Karten bringen nur noch ihren Preis und
 * ihre Wirkung mit.
 */
const INVEST_KEY = '_investCounters';

function investCountersOn(hero) {
  return (hero && typeof hero[INVEST_KEY] === 'number') ? hero[INVEST_KEY] : 0;
}

/**
 * Eigene Helden, die mindestens `n` Invest Counter tragen.
 *
 * „A Hero you control" schliesst BEZAUBERTE Helden aus — die werden
 * technisch vom Gegner kontrolliert und sind daher keine legalen Ziele
 * fuer Effekte, die nur eigene Ziele waehlen duerfen (Als Ruling 11.8.).
 */
function heroesWithInvest(ps, n) {
  const out = [];
  const heroes = ps?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const hero = heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.charmed) continue;
    if (investCountersOn(hero) < n) continue;
    out.push({ hero, heroIdx: hi, counters: investCountersOn(hero) });
  }
  return out;
}

/** Einmal-pro-Zug-Schluessel der Invest-Faehigkeit — pro INSTANZ. */
function investHoptKey(inst) {
  return `monkee-invest:${inst?.id}`;
}

function investHoptUsed(gs, inst) {
  return gs?.hoptUsed?.[investHoptKey(inst)] === gs?.turn;
}

function markInvestHopt(gs, inst) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[investHoptKey(inst)] = gs.turn;
}

/**
 * Die Kosten bezahlen: `n` Invest Counter von EINEM eigenen Helden
 * entfernen. Gibt es mehrere Kandidaten, waehlt der Spieler; bei genau
 * einem wird ohne Rueckfrage abgebucht.
 *
 * @returns {Promise<boolean>} true, wenn bezahlt wurde
 */
async function payInvestCounters(engine, pi, n, cardName) {
  const ps = engine.gs.players[pi];
  const kandidaten = heroesWithInvest(ps, n);
  if (kandidaten.length === 0) return false;

  let gewaehlt = kandidaten[0];
  if (kandidaten.length > 1) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: cardName,
      description: `Remove ${n} Invest Counters from which Hero?`,
      cancellable: true,
      options: kandidaten.map(k => ({
        id: String(k.heroIdx),
        label: k.hero.name,
        description: `${k.counters} Invest Counter${k.counters === 1 ? '' : 's'} → ${k.counters - n} left`,
      })),
    });
    if (!wahl?.optionId) return false;
    gewaehlt = kandidaten.find(k => String(k.heroIdx) === String(wahl.optionId));
    if (!gewaehlt) return false;
  }

  const rest = investCountersOn(gewaehlt.hero) - n;
  if (rest <= 0) delete gewaehlt.hero[INVEST_KEY];
  else gewaehlt.hero[INVEST_KEY] = rest;
  engine.log('monkee_invest_spent', {
    player: ps.username, card: cardName,
    hero: gewaehlt.hero.name, removed: n, left: Math.max(0, rest),
  });
  return true;
}

module.exports = {
  MONKEE, MIN_GOLD,
  isMonkeeName, isMonkeeCreature, monkeeGoldTrigger,
  goldSourceVerbraucht, verbraucheGoldSource,
  canHeroSummon, eligibleSummonZones,
  freeSlotOn, anyFreeZone,
  INVEST_KEY, investCountersOn, heroesWithInvest,
  investHoptUsed, markInvestHopt, payInvestCounters,
};

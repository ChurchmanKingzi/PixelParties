// ═══════════════════════════════════════════
//  GETEILT: wer darf beschwoeren?
//
//  ALS RULING (8.8.), spielweit: **„summon as an additional Action" ist
//  eine ganz normale Beschwoerung** — sie kostet nur keine Aktion und
//  laeuft reaktiv. Ein tauglicher Caster ist also weiterhin Pflicht.
//
//  Geprueft wird: lebendig, nicht Frozen / Stunned / Webbed / Bound /
//  Negated, und die Level- bzw. Schulanforderung der Karte.
//  `heroMeetsLevelReq` deckt Abilities, Ascension-Bypaesse und Wisdom
//  bereits mit ab.
//
//  Eine Auslegung, EINE Stelle: benutzt von `_monkee-shared.js`
//  (Nimble / Resilient / Criminal Monkee), `green-dragoneer.js`,
//  `_double-shared.js` (Albrecht, Ellie), `_of-kings-shared.js` und
//  `golden-ladybug.js`.
//
//  ANMERKUNG: `the-cosmic-depths.js` haelt eine eigene lokale Kopie
//  dieser Pruefung (dort ohne `negated`/`webbed`). Zusammenlegen waere
//  sinnvoll, ist aber eine Aenderung an fremder Karte — Al gemeldet,
//  bislang nicht beauftragt.
// ═══════════════════════════════════════════

// ── SPERREN (v1344, Lueckenfix) ──────────────────────────────────
// Bis v1343 prueften weder `canHeroSummon` noch `eligibleSummonZones`
// die Beschwoerungssperre (`summonLocked`) oder eine Aktionssperre.
// Folge: Albrecht, Ellie, die Monkees und Green Dragoneer konnten
// „as an additional Action" beschwoeren, obwohl der Spieler oder der
// Held gerade keine Aktion ausfuehren durfte.
//
//  • `summonLocked` sperrt JEDE echte Beschwoerung — immer geprueft.
//  • Die Aktionssperren (Als Ruling 28.8.: gesperrt ist JEDER Effekt,
//    der eine Aktion kostet, auch Zusatzaktionen) nur mit
//    `{ alsAktion: true }`. Geprueft wird dasselbe wie in
//    `getHeroEligibleActionCards`, der Liste hinter jeder geschenkten
//    Aktion: Divine Gift of Skill (`isHeroSkillLocked`), Aktionslimit
//    je Held (Sol Rym), Rundenstempel (`_actionLockedTurn`) und die
//    spielerweite Sperre (`areActionsBlocked` — Kent, Chalice).
//    „Placed" ist keine Aktion und laeuft ohnehin nicht hierueber.

/** Ist eine Aktion dieses Helden gerade gesperrt? */
function heroActionLocked(engine, pi, heroIdx) {
  const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero) return true;
  if (engine.isHeroSkillLocked?.(pi, heroIdx)) return true;
  if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) return true;
  if (hero._actionLockedTurn === engine.gs.turn) return true;
  if (engine.areActionsBlocked?.(pi)) return true;
  return false;
}

/**
 * Darf dieser Held die Kreatur regulaer beschwoeren?
 * @param {object} [opts]  `{ alsAktion }` — die Beschwoerung ist eine
 *   (Zusatz-)Aktion, also greifen auch die Aktionssperren.
 */
function canHeroSummon(engine, pi, heroIdx, cd, opts = {}) {
  const ps = engine?.gs?.players?.[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (ps.summonLocked) return false;
  const st = hero.statuses || {};
  if (st.frozen || st.stunned || st.webbed || st.bound || st.negated) return false;
  if (!cd) return false;
  if (opts.alsAktion && heroActionLocked(engine, pi, heroIdx)) return false;
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Alle Plaetze, auf die diese Kreatur regulaer beschworen werden
 * koennte — je EIN Eintrag pro freier Zone eines tauglichen Helden,
 * damit der Spieler waehlen kann wie bei einer normalen Beschwoerung.
 * Nur die Basiszonen 0-2: genau dort sucht `safePlaceInSupport` einen
 * Ersatzplatz, wenn der Wunschplatz besetzt ist.
 *
 * Standard ist `alsAktion: true` — jeder Aufrufer (Albrecht, Ellie,
 * Nimble/Resilient/Criminal Monkee, Golden Ladybug) beschwoert „as an
 * additional Action". Wer eine Beschwoerung OHNE Aktionskosten baut,
 * uebergibt `{ alsAktion: false }`.
 */
function eligibleSummonZones(engine, pi, cardName, opts = {}) {
  const ps = engine?.gs?.players?.[pi];
  const cd = engine?._getCardDB()?.[cardName];
  if (!ps || !cd) return [];
  const pruef = { alsAktion: opts.alsAktion !== false };
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!canHeroSummon(engine, pi, hi, cd, pruef)) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let zi = 0; zi < Math.min(zones.length, 3); zi++) {
      // v1349: versiegelte Plaetze (Madame Guillotine) zaehlen als belegt.
      if (!engine.supportSlotBelegt(pi, hi, zi)) {
        out.push({
          heroIdx: hi, slotIdx: zi,
          label: `${ps.heroes[hi].name} — Slot ${zi + 1}`,
        });
      }
    }
  }
  return out;
}

/**
 * „…you may immediately summon this Creature from your hand as an
 * additional Action": eine GANZ NORMALE Beschwoerung (Als Ruling 8.8.),
 * also tauglicher Caster Pflicht, Zone waehlbar, Entnahme ueber die
 * Stapel-Schicht. (v1344 aus `_double-shared.js` hierher verlegt — der
 * Helfer ist nicht Double-spezifisch; `_double-shared` exportiert ihn
 * weiter.)
 *
 * @param {object} [opts]
 *   `source`       — Quellname fuer Log/Prompt
 *   `zonenFilter`  — (zone) → bool, schraenkt die Zonen weiter ein
 *   `nachZonenwahl`— async () → void, laeuft NACH der bindenden Wahl und
 *                    VOR der Beschwoerung (Platz fuer den Auftritt)
 * @returns {Promise<boolean>} beschworen? Abbruch in der Zonenwahl → false.
 */
async function sofortAusHandBeschwoeren(engine, pi, name, opts = {}) {
  const { source, zonenFilter, nachZonenwahl } = opts;
  const ps = engine.gs.players[pi];
  if (!ps || !(ps.hand || []).includes(name)) return false;
  let zonen = eligibleSummonZones(engine, pi, name);
  if (typeof zonenFilter === 'function') zonen = zonen.filter(zonenFilter);
  if (zonen.length === 0) return false;
  let ziel = zonen[0];
  if (zonen.length > 1) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'zonePick', title: source || name,
      description: `Summon ${name} into which Support Zone?`,
      zones: zonen, cancellable: true,
    });
    if (!wahl || wahl.cancelled) return false;
    ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx) || null;
    if (!ziel) return false;
  }
  if (typeof nachZonenwahl === 'function') await nachZonenwahl(ziel);
  const inst = await engine.summonFromPile(pi, 'hand', name, ziel.heroIdx, ziel.slotIdx, {
    source: source || name, hookExtras: { _isNormalSummon: false },
    alsZusatzaktion: true,   // v1349: „as an additional Action" ist eine Aktion
  });
  return !!inst;
}

module.exports = { canHeroSummon, eligibleSummonZones, heroActionLocked, sofortAusHandBeschwoeren };

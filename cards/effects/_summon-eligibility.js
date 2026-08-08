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
//  (Nimble / Resilient / Criminal Monkee) und `green-dragoneer.js`.
//
//  ANMERKUNG: `the-cosmic-depths.js` haelt eine eigene lokale Kopie
//  dieser Pruefung (dort ohne `negated`/`webbed`). Zusammenlegen waere
//  sinnvoll, ist aber eine Aenderung an fremder Karte — Al gemeldet,
//  bislang nicht beauftragt.
// ═══════════════════════════════════════════

/** Darf dieser Held die Kreatur regulaer beschwoeren? */
function canHeroSummon(engine, pi, heroIdx, cd) {
  const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const st = hero.statuses || {};
  if (st.frozen || st.stunned || st.webbed || st.bound || st.negated) return false;
  if (!cd) return false;
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Alle Plaetze, auf die diese Kreatur regulaer beschworen werden
 * koennte — je EIN Eintrag pro freier Zone eines tauglichen Helden,
 * damit der Spieler waehlen kann wie bei einer normalen Beschwoerung.
 * Nur die Basiszonen 0-2: genau dort sucht `safePlaceInSupport` einen
 * Ersatzplatz, wenn der Wunschplatz besetzt ist.
 */
function eligibleSummonZones(engine, pi, cardName) {
  const ps = engine?.gs?.players?.[pi];
  const cd = engine?._getCardDB()?.[cardName];
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

module.exports = { canHeroSummon, eligibleSummonZones };

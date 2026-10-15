// ═══════════════════════════════════════════
//  GETEILT: wer darf beschwoeren?
//
//  ALS RULING (8.8.), spielweit: **„summon as an additional Action" ist
//  eine ganz normale Beschwoerung** — sie kostet nur keine Aktion und
//  laeuft reaktiv. Ein tauglicher Caster ist also weiterhin Pflicht.
//
//  Geprueft wird: lebendig, nicht Frozen / Stunned / Webbed / Bound, und
//  die Level- bzw. Schulanforderung der Karte. Welle 12 (Al): ein bloss
//  „Effekt negierter" Held beschwoert normal; sind seine Abilities
//  negiert (harte Form), bleiben nur Stufe-0-Kreaturen (Summoning Magic weg).
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
function heroActionLocked(engine, pi, heroIdx, physOwner = pi) {
  const hero = engine?.gs?.players?.[physOwner]?.heroes?.[heroIdx];
  if (!hero) return true;
  if (engine.isHeroSkillLocked?.(physOwner, heroIdx)) return true;
  if (engine.heroActionCapReached?.(physOwner, heroIdx)) return true;   // W8: ruht bei Frost/Betäubung/Negation
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
  // Kontrolle statt Seite (Styx 28.9.): `opts.physOwner` = Spalte des
  // Helden (Standard: die eigene). Beschwoeren darf `pi` nur mit einem
  // Helden, den er KONTROLLIERT — ein an den Gegner abgegebener eigener
  // Held faellt heraus, ein uebernommener der Gegenspalte zaehlt.
  const physOwner = opts.physOwner ?? pi;
  const ps = engine?.gs?.players?.[pi];
  const hero = engine?.gs?.players?.[physOwner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine.heroSideOf && engine.heroSideOf(physOwner, hero) !== pi) return false;
  // Als Vorgabe 29.9.: die Uebernahme muss das Beschwoeren erlauben
  // (Charme sperrt „its Support Zones").
  if (engine.kontrollRechte && !engine.kontrollRechte(physOwner, heroIdx).beschwoeren) return false;
  if (ps?.summonLocked) return false;
  const st = hero.statuses || {};
  // Welle 12 (Al, Rueckfrage 2): ein NEGIERTER Held kann „ganz normal Aktionen ausfuehren und also beschwoeren" — `negated` sperrt hier nicht mehr.
  // Sind seine ABILITIES negiert (harte Form), faellt die Summoning Magic weg: `heroMeetsLevelReq` laesst dann nur noch Stufe-0-Kreaturen zu.
  if (st.frozen || st.stunned || st.webbed || st.bound) return false;
  if (!cd) return false;
  if (opts.alsAktion && heroActionLocked(engine, pi, heroIdx, physOwner)) return false;
  return engine.heroMeetsLevelReq(physOwner, heroIdx, cd);
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
  // Kontrolle statt Seite (Styx 28.9.): mit `opts.nachKontrolle` zaehlen
  // alle Helden, die `pi` kontrolliert — die Eintraege tragen dann
  // `owner` (physische Seite), und der Aufrufer beschwoert mit
  // `heldSeite: z.owner`. Ohne die Option bleibt es bei der eigenen
  // Spalte (Aufrufer, die `owner` noch nicht weitergeben).
  const helden = opts.nachKontrolle && engine.heroesControlledBy
    ? engine.heroesControlledBy(pi)
    : (ps.heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
  for (const { physOwner, heroIdx: hi, hero } of helden) {
    if (!canHeroSummon(engine, pi, hi, cd, { ...pruef, physOwner })) continue;
    const zones = engine.gs.players[physOwner]?.supportZones?.[hi] || [];
    for (let zi = 0; zi < Math.min(zones.length, 3); zi++) {
      // v1349: versiegelte Plaetze (Madame Guillotine) zaehlen als belegt.
      if (!engine.supportSlotBelegt(physOwner, hi, zi)) {
        out.push({
          heroIdx: hi, slotIdx: zi,
          label: `${hero.name} — Slot ${zi + 1}`,
          ...(opts.nachKontrolle ? { owner: physOwner } : {}),
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
  // Kontrolle statt Seite (Styx 28.9.): auch ueber uebernommene Helden.
  let zonen = eligibleSummonZones(engine, pi, name, { nachKontrolle: true });
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
    ziel = zonen.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx
      && (z.owner ?? pi) === (wahl.owner ?? pi)) || null;
    if (!ziel) return false;
  }
  if (typeof nachZonenwahl === 'function') await nachZonenwahl(ziel);
  const inst = await engine.summonFromPile(pi, 'hand', name, ziel.heroIdx, ziel.slotIdx, {
    source: source || name, hookExtras: { _isNormalSummon: false },
    alsZusatzaktion: true,   // v1349: „as an additional Action" ist eine Aktion
    ...((ziel.owner ?? pi) !== pi ? { heldSeite: ziel.owner } : {}),
  });
  return !!inst;
}

/**
 * ★ Welle 11 (Al, R5): „… Reaction-Creatures können, sofern sie nichts anderes spezifizieren (der Term 'place' beinhaltet z.B., dass kein
 * aktionsfähiger Hero notwendig ist) NUR von Heroes beschworen werden, die aktionsfähig sind, dasselbe für Effekte, die spezifisch 'summon' sagen."
 * EINE Statusfrage für jedes „summon" eines Helden-Beschwörers: nicht Frozen / Stunned / Webbed / Bound (seit Welle 12 ohne Negated) — gleiche Menge wie
 * `canHeroSummon`, für Skripte mit eigener Zonen-/Helden-Auswahl. Bei „place" (Monster Nest, Garius, Steam Dwarf Engineer …) NICHT benutzen.
 */
function heroAgiert(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  const st = hero.statuses || {};
  // Welle 12 (Al, Rueckfrage 2): „Nein, ein effekt-negierter Held kann ganz normal Aktionen ausführen und also beschwören." — `negated` gehoert nicht
  // mehr zu den sperrenden Status (Frozen / Stunned / Webbed / Bound bleiben). Die harte Form („Abilities negiert") begrenzt nur die STUFE
  // (`beschwoerStufeOk` bzw. `heroMeetsLevelReq`).
  return !(st.frozen || st.stunned || st.webbed || st.bound);
}

/**
 * ★ Welle 12 (Al, Rueckfrage 2): „Anders sieht es aus, wenn seine *Abilities* negiert sind - dann kann er nur noch Lv-0-Creatures beschwören, weil ja
 * seine Summoning Magic weg ist." Fuer Skripte mit eigener Held-/Zonenwahl, die KEIN `heroMeetsLevelReq` rufen (Elven Rider, Bomblebee Cluster):
 * ist der Held in der harten Form negiert (`heroAbilityLevelsBlanked`: Standard-`negated`, Stowaway), geht nur Stufe 0.
 * @param {number} physOwner Brettseite des Helden · @param {object} cd Kartendaten der Kreatur
 */
function beschwoerStufeOk(engine, physOwner, heroIdx, cd) {
  if (!cd || (cd.level || 0) <= 0) return true;
  return !engine.heroAbilityLevelsBlanked(physOwner, heroIdx);
}

/**
 * ★ Welle 12 (Al, Rueckfrage 1 / Sandy Blob): „Nein, nur explizit On-Summon-Effekte triggern Blob." Hat der KARTENTEXT einer Kreatur einen
 * On-Summon-Effekt? Wortlaut: „When you summon/play this Creature …", „When this Creature is summoned/played …" (auch „… from your discard pile",
 * „… via an effect", „… with the effect of X"). Ein technischer `onPlay`-/`beforeSummon`-Haken im Skript ohne solchen Text (Kosten, Zusatzaktion,
 * Aktiv-Effekt, Surprise-Aktivierung) ist KEIN On-Summon-Effekt. Der Text ist die Quelle: `engine._getCardDB()[name].effect`.
 */
const ON_SUMMON_TEXT = /\b(?:when|whenever)\b[^.:]*\b(?:you (?:summon|play) this (?:creature|card)|this (?:creature|card) (?:is|gets|was) (?:summoned|played))/i;
function hatOnSummonText(cd) {
  return !!(cd && typeof cd.effect === 'string' && ON_SUMMON_TEXT.test(cd.effect.replace(/\s+/g, ' ')));
}

module.exports = { hatOnSummonText, canHeroSummon, eligibleSummonZones, heroActionLocked, sofortAusHandBeschwoeren, heroAgiert, beschwoerStufeOk };

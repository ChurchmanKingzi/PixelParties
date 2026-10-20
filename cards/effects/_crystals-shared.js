// ═══════════════════════════════════════════
//  ARCHETYPE HELPER: "Crystals"
//
//  Centralized helpers for the Crystal archetype.
//
//  Big Gwen Guard's passive — "While you control
//  this Creature, ignore the effects of all cards
//  that are revealed in your hand by their own
//  effects." — needs to be queried from many
//  unrelated code paths (the cost-doubling check
//  for Rusting Crystal, the summon-lock for
//  Grinning Cat, the hero-effect-negation for
//  Weakening Crystal, the shuffle-into-deck lock
//  for Distracting Crystal, the +1-Spell-level
//  for Mana Absorbing Crystal, the
//  control-handoff for Treacherous Crystal, …).
//
//  Each call site consults `selfRevealEffectsSuppressed(pi)`
//  and short-circuits if it returns true. That keeps
//  the "ignore" rule in one place and lets new self-
//  reveal Crystals plug into the same gate without
//  re-deriving the suppression list.
// ═══════════════════════════════════════════

const BIG_GWEN_GUARD = 'Big Gwen Guard';

// Crystal names referenced by hand-passive gates. Every hand-passive
// helper below resolves through `selfRevealEffectsSuppressed` so the
// Big Gwen Guard aura turns them off uniformly.
const WEAKENING_CRYSTAL = 'Weakening Crystal';
const DISTRACTING_CRYSTAL = 'Distracting Crystal';
const TREACHEROUS_CRYSTAL = 'Treacherous Crystal';
const RUSTING_CRYSTAL = 'Rusting Crystal';
const MANA_ABSORBING_CRYSTAL = 'Mana Absorbing Crystal';

/**
 * Does `pi` control a non-negated, non-nulled Big Gwen Guard in a
 * Support Zone? If yes, every "while in hand" effect from auto-
 * revealing Crystals on `pi`'s side is suppressed for the lifetime
 * of that BGG instance.
 *
 * Negation / nullification are honored — a negated BGG provides no
 * suppression aura (matches the engine-wide convention that negated
 * Creatures stop firing their hooks AND don't project passive auras).
 *
 * Returns true if the suppression is active for `pi`.
 */
function controlsBigGwenGuard(engine, pi) {
  if (!engine?.cardInstances) return false;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== BIG_GWEN_GUARD) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.counters?.negated) continue;
    if (inst.counters?.nulled) continue;
    return true;
  }
  return false;
}

/**
 * Alias surfacing the intent at the call site — most readers see
 * "self-reveal effects suppressed" and immediately know to bypass
 * their gate. Same semantics as `controlsBigGwenGuard`.
 */
function selfRevealEffectsSuppressed(engine, pi) {
  return controlsBigGwenGuard(engine, pi);
}

/**
 * Weakening Crystal hand-passive: while a copy sits in a player's
 * hand, every alive Hero on that player's side is afflicted with
 * `negated` for the duration. The status is stamped with
 * `_byWeakeningCrystal: true` so REMOVAL only takes our auras off
 * — independently-applied negation (Crash Course / Cute Yokai / …)
 * keeps its own marker.
 *
 * Called from `engine.sync()` so every state push is consistent:
 *   • Crystal added or revealed → next sync applies the negated
 *     status to all the controller's heroes.
 *   • Crystal discarded / played / transferred away → next sync
 *     clears the marker-tagged negation; non-Crystal-sourced
 *     negations stay put.
 *
 * Big Gwen Guard's suppression aura turns this off. Idempotent —
 * safe to call repeatedly.
 */
/**
 * ★ v1103 (Als Ruling 15.9.): „Den Status zu cleansen, entfernt ihn
 * TEMPORAER von einem Ziel. Solange Crystal auf der Hand ist, wird der
 * Effekt zu Beginn jeder Runde neu appliziert."
 *
 * Damit wechselt die Karte ihre Bauart grundlegend:
 *
 *   FRUEHER  jeder `sync()` schrieb den Status neu. Eine Heilung war
 *            dadurch wirkungslos — der naechste Zustandspush machte sie
 *            im selben Augenblick rueckgaengig. Genau deshalb stand die
 *            Karte im Sweep als „behauptet Status, ist aber keiner".
 *
 *   JETZT    angelegt wird nur an DREI Zeitpunkten (`reapply: true`):
 *            beim Eintritt in die Hand, zu Beginn der Runde des
 *            Betroffenen, und beim Laden eines Spielstands. Dazwischen
 *            raeumt der Sync nur noch AUF — er nimmt den Status weg,
 *            wenn die Karte die Hand verlassen hat.
 *
 * @param {object} engine
 * @param {object} [opts]
 * @param {boolean} [opts.reapply]  false = nur aufraeumen (Standard)
 * @param {number}  [opts.onlyFor]  nur diese Seite anfassen
 */
function refreshWeakeningCrystalNegation(engine, opts = {}) {
  const players = engine?.gs?.players;
  if (!Array.isArray(players)) return;
  // ★ W33a (Al, 22.10.2026: „Weakening Crystal noch nachziehen!"): „the effects of all YOUR Heroes are negated" = die Helden, die der Halter des Kristalls
  // GERADE KONTROLLIERT (`heroSideOf`: Charme-Marke > dauerhafte Übernahme > Spalte) – nicht die Spalte der Hand. Der Status `negated` (Marke `_byWeakeningCrystal`)
  // trägt jetzt `_wcFor` = den Kristall-Halter, für den er gilt, und FOLGT dem Helden:
  //   • Kontrollwechsel (Charme, Diebstahl, dauerhafte Übernahme, Rückgabe, Zugende-Rückfall): die Negierung des bisherigen Kontrolleurs fällt SOFORT, die des neuen
  //     (liegt bei ihm ein Kristall in der Hand) wird SOFORT angelegt – erkannt am Vergleich mit dem beim letzten Abgleich gemerkten Kontrolleur (`_wcKontrolle`,
  //     nicht aufzählbar am Heldenobjekt, ein neues Heldenobjekt startet bei seiner Spalte). Ohne Kontrollwechsel bleibt alles wie in v1103 (Anlage nur beim Eintritt in
  //     die Hand, zu Rundenbeginn, bei Neuanlage nach Fremd-Negation; Heilung gilt bis zum nächsten Rundenbeginn).
  //   • Ausnahmen wie bisher (Karian, Zustandsimmunität, Big Gwen Guard) plus: ein übernommener Held, der durch die Kontrolle ausdrücklich gegen die EIGENEN Karten des
  //     Kontrolleurs immun ist (Charme Lv3, Golden Apple/The Sixth Circle; `heroImmunGegenEigene`, W31a), bekommt die Negierung nicht – sie zählt als negativer Status.
  // `opts.onlyFor` ohne `onlyHero` = nur Helden dieses KONTROLLEURS; mit `onlyHero` (Aufrufer: Statusablauf/Heilung eines einzelnen Helden) = Brettseite `onlyFor`.
  const hatKristall = players.map((ps, pi) => !!ps?.hand && ps.hand.includes(WEAKENING_CRYSTAL) && !selfRevealEffectsSuppressed(engine, pi));
  const neuAngelegt = players.map(() => 0);
  for (let seite = 0; seite < players.length; seite++) {
    const ps = players[seite];
    if (!ps?.heroes) continue;
    for (let hi = 0; hi < ps.heroes.length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      const kontrolleur = engine.heroSideOf(seite, hero);
      // Kontrollwechsel erkennen (Merker unsichtbar am Heldenobjekt; fehlt er, gilt die Spalte als bisheriger Kontrolleur).
      const vorher = Object.prototype.hasOwnProperty.call(hero, '_wcKontrolle') ? hero._wcKontrolle : seite;
      if (vorher !== kontrolleur || !Object.prototype.hasOwnProperty.call(hero, '_wcKontrolle')) {
        Object.defineProperty(hero, '_wcKontrolle', { value: kontrolleur, writable: true, configurable: true, enumerable: false });
      }
      const gewechselt = vorher !== kontrolleur;
      const cur = hero.statuses?.negated;
      const meins = cur?._byWeakeningCrystal === true;
      // Aufräumen: der Kristall des bisherigen Halters gilt nicht mehr (Karte weg ODER der Held wird nicht mehr von ihm kontrolliert).
      if (meins) {
        const eigner = cur._wcFor ?? seite;   // ältere Marke ohne `_wcFor` = Halter in der Spalte
        if (eigner !== kontrolleur || !hatKristall[eigner]) { delete hero.statuses.negated; }
      }
      if (!hatKristall[kontrolleur]) continue;
      // Anlegen nur, wenn gefordert: Kontrollwechsel (sofort) oder `reapply` (Eintritt in die Hand / Rundenbeginn / Laden / Ablauf einer Fremd-Negation).
      let anlegen = gewechselt;
      if (!anlegen && opts.reapply) {
        if (typeof opts.onlyHero === 'number') anlegen = opts.onlyFor === seite && opts.onlyHero === hi;
        else if (typeof opts.onlyFor === 'number') anlegen = opts.onlyFor === kontrolleur;
        else anlegen = true;
      }
      if (!anlegen) continue;
      if (engine.heroIgnoresHaltStatuses?.(seite, hi)) continue;   // W12 (Al, Q114): Karian wird nie durch Negation gehindert
      // ★ Welle 14 (Al, Q11 aus W13c / A08-28): „Immunität gegen jeden Status negiert auch Crystal." — „This counts as a negative status effect":
      // ein Held mit ZUSTANDS-Immunität gegen negative Status (Petrification Break am Träger, `negative_status_immune`-Buff [Divine Gift of
      // Coolness], Light Ball, Einzel-Immunität `negate_immune`) bekommt die Negation gar nicht erst.
      // Karian ist weiterhin über `heroIgnoresHaltStatuses` oben ausgenommen. Bewusst NICHT geprüft: Anfangsschutz (`shielded`, gilt gegen den
      // Gegner), CC-`immune` (kurzlebig), Submerged und Johannas Schutz (ihr laufendes Passiv ruht, sobald derselbe Kristall sie negiert —
      // die Prüfung hinge von der Heldenreihenfolge ab).
      if (engine.heroHasStatusImmunityAttachment?.(seite, hi)
          || hero.buffs?.negative_status_immune
          || hero.statuses?.negate_immune
          || engine._lightBallProtects?.(seite, 'hero', hi)) continue;
      if (kontrolleur !== seite && engine.heroImmunGegenEigene?.(seite, hi, kontrolleur)) continue;   // W33a: Charme-Schutz gegen eigene Karten
      const aktuell = hero.statuses?.negated;
      // Ein FREMDES `negated` nicht überschreiben; liegt unser Kristall-`negated` schon, bleibt es.
      if (aktuell) continue;
      if (!hero.statuses) hero.statuses = {};
      hero.statuses.negated = {
        _byWeakeningCrystal: true,
        _wcFor: kontrolleur,
        // ★ v1169: PASSIV — die Karte auf der Hand haelt den Status
        // aufrecht. Heilen wirkt nur bis zum naechsten Rundenbeginn,
        // uebertragen (Tea) geht gar nicht.
        sourceBound: true,
        appliedTurn: engine.gs?.turn ?? 0,
      };
      engine._heldenStatusVerursacher(hero.statuses.negated, { appliedBy: kontrolleur, source: 'Weakening Crystal' });   // v1399: eigene Hand → selbst verursacht
      neuAngelegt[kontrolleur]++;
    }
  }
  // Kleine Animation, wenn wirklich neu angelegt wurde (Als Vorgabe).
  if (typeof engine._broadcastEvent === 'function') {
    for (let pi = 0; pi < players.length; pi++) {
      if (neuAngelegt[pi] <= 0) continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'crystal_drain', zoneType: 'board', layer: 'background',
        owner: pi, heroIdx: -1, zoneSlot: -1, duration: 1200,
      });
    }
  }
}

/**
 * Distracting Crystal hand-passive: while a copy sits in `pi`'s hand,
 * any of their cards/abilities whose script declares `shufflesFromHandOrDiscardIntoDeck:
 * true` (Leadership, Elana the Rocky Rebel, …) cannot be activated.
 * Consulted by the activatable-ability and hero-effect gates, and by
 * the server-side play handler. Big Gwen Guard's suppression turns
 * this off.
 */
function shuffleIntoDeckBlocked(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return false;
  if (!(ps.hand || []).includes(DISTRACTING_CRYSTAL)) return false;
  if (selfRevealEffectsSuppressed(engine, pi)) return false;
  return true;
}

/**
 * Rusting Crystal hand-passive: while a copy sits in `pi`'s hand, the
 * Cost of every OTHER card they play is doubled — applied BEFORE any
 * reductions, so discounts bite on the already-doubled price.
 * Idempotent: several Rusting Crystals still yield a single ×2
 * ("does not stack with itself").
 *
 * ★ Diese Funktion stand bis v573 in `server.js` und war damit von
 * einer KARTE aus nicht erreichbar. Future Tech Copy Device bezahlt
 * die Kosten der Karte, deren Identität sie annimmt — ohne diesen
 * Helfer hätte sie die Verdopplung entweder ignoriert oder
 * nachgebaut, und ein zweiter Ort für dieselbe Regel ist genau das,
 * was hier sonst überall vermieden wird. Jetzt lesen alle drei
 * Aufrufer (beide Kostenrechnungen des Servers und Copy Device)
 * dieselbe Fassung.
 *
 * @param {object} gs        Spielzustand
 * @param {number} pi        Spieler, der zahlt
 * @param {string} cardName  Karte, deren Preis gefragt ist
 * @param {number} baseCost  Grundpreis vor Rabatten
 * @param {object} [engine]  Für die Big-Gwen-Guard-Unterdrückung
 * @returns {number}
 */
function applyRustingCrystalCostMultiplier(gs, pi, cardName, baseCost, engine, opts) {
  if (!cardName) return baseCost;
  const ps = gs?.players?.[pi];
  if (!ps) return baseCost;
  // Welle 11 (Q58, Al: „2 Kopien machen einander teurer"): ein Rusting Crystal ist fuer
  // jede ANDERE Kopie auf der Hand ein „anderes Artefakt" — bei zwei Kopien kosten beide
  // das Doppelte (30). Die Karte selbst zaehlt nie auf sich (Kopie in der Hand = Anzahl >= 2);
  // `opts.fremdeKarte` (Copy Device nimmt die Identitaet an, liegt aber nicht als Kristall in der Hand)
  // zaehlt jede Kopie auf der Hand. „Does not stack with itself" bleibt: immer nur ×2.
  const kopien = (ps.hand || []).filter(n => n === RUSTING_CRYSTAL).length;
  const noetig = (cardName === RUSTING_CRYSTAL && !opts?.fremdeKarte) ? 2 : 1;
  if (kopien < noetig) return baseCost;
  if (engine && selfRevealEffectsSuppressed(engine, pi)) return baseCost;
  return baseCost * 2;
}

/**
 * Treacherous Crystal eligibility gate. True iff `victimPi` currently
 * holds a Treacherous Crystal in hand AND Big Gwen Guard isn't
 * suppressing self-reveal Crystal effects on the victim's side. Used
 * by the client-side pulse + click affordance and by the server-side
 * trigger handler to validate the click.
 */
function isTreacherousLent(engine, activatorPi, victimPi) {
  if (activatorPi === victimPi) return false;
  const ps = engine?.gs?.players?.[victimPi];
  if (!ps) return false;
  if (!(ps.hand || []).includes(TREACHEROUS_CRYSTAL)) return false;
  if (selfRevealEffectsSuppressed(engine, victimPi)) return false;
  return true;
}

/**
 * Mana Absorbing Crystal hand-passive: while a copy sits in `pi`'s
 * hand, every Spell in their hand has its effective level raised by
 * +1. Returns the offset to add to a Spell's level for `pi`
 * (+1 when active, 0 otherwise). Big Gwen Guard's suppression turns
 * this off. Caller is responsible for checking `cardData.cardType ===
 * 'Spell'` — Spell-only is the rule of this Crystal, not the helper.
 */
function manaAbsorbingHandSpellLevelOffset(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return 0;
  if (!(ps.hand || []).includes(MANA_ABSORBING_CRYSTAL)) return 0;
  if (selfRevealEffectsSuppressed(engine, pi)) return 0;
  return 1;
}

module.exports = {
  BIG_GWEN_GUARD,
  WEAKENING_CRYSTAL,
  DISTRACTING_CRYSTAL,
  TREACHEROUS_CRYSTAL,
  MANA_ABSORBING_CRYSTAL,
  RUSTING_CRYSTAL,
  controlsBigGwenGuard,
  selfRevealEffectsSuppressed,
  refreshWeakeningCrystalNegation,
  shuffleIntoDeckBlocked,
  applyRustingCrystalCostMultiplier,
  isTreacherousLent,
  manaAbsorbingHandSpellLevelOffset,
};

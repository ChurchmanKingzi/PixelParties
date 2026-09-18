// ═══════════════════════════════════════════
//  „FAIRY" — EINE AUSLEGUNGSSTELLE FÜR DIE FAMILIE (v1187)
//
//  Bauform wie `_drago-shared.js` / `_monkee-shared.js`: der
//  Namensbezug und die Aufstiegsbedingung von „Tempeluna, the
//  Convergence Fairy" stehen an EINER Stelle, und Luna, Tempeste und
//  Tempeluna lesen sie von hier.
//
//  ── DER FEHLER, DEN DAS BEHEBT (Als Befund 18.9.) ─────────────────
//  Tempeluna liess sich nicht aufsteigen, obwohl Luna UND Tempeste
//  auf dem Brett standen. Ursache war nicht die Bedingung — die lag
//  richtig auf der Ascended-Karte —, sondern die BEREITSCHAFT:
//
//  Der Client bietet einen Aufstieg nur an, wenn der Basis-Held
//  `ascensionReady` traegt und `ascensionTarget(s)` die Zielkarte
//  nennt (`heroCanAscendTo` in app-board.jsx). Diese Felder pflegt
//  IMMER der Basis-Held ueber `refreshAscensionReadiness`, das die
//  Engine bei jedem `sync()` durchlaeuft. Luna und Tempeste hatten
//  die Methode nicht — also blieb der Drag folgenlos, ohne jede
//  Meldung. `ascensionCondition` auf der Ascended-Karte ist der
//  ZWEITE Riegel (Server-Seite) und ersetzt den ersten nicht.
//
//  LEHRE (in CARD_API): eine neue Ascended-Karte mit eigener
//  Bedingung braucht BEIDES — die Bedingung auf sich selbst und die
//  Bereitschaft auf jedem Helden, der zu ihr aufsteigen kann.
// ═══════════════════════════════════════════

const TEMPELUNA = 'Tempeluna, the Convergence Fairy';
const LUNA = 'Luna, the Flame Fairy';
const TEMPESTE = 'Tempeste, the Weather Fairy';
const GRUNDFEEN = [LUNA, TEMPESTE];

/**
 * ★ „Fairy" Hero — Teilstring im GANZEN Kartennamen, Gross-/
 * Kleinschreibung zaehlt (Namensbezugs-Regel), und NUR gedruckte
 * Helden (Als Ruling 18.9., wie bei „???, the Shapeshifter").
 */
function istFeenHeld(cd) {
  if (!cd) return false;
  if (cd.cardType !== 'Hero') return false;          // kein Ascended Hero
  return String(cd.name || '').includes('Fairy');
}

/**
 * Index der ANDEREN Grundfee in einer anderen Spalte, oder -1.
 *
 * ★ Als Ruling 18.9.: die andere Fee darf TOT sein — sie wird ohnehin
 * geloescht. Nur der aufsteigende Held selbst muss leben, und das
 * setzt `performAscension` von sich aus durch.
 */
function andereGrundfee(gs, pi, heroIdx) {
  const ps = gs?.players?.[pi];
  const hier = ps?.heroes?.[heroIdx]?.name;
  const gesucht = (hier === LUNA) ? TEMPESTE : (hier === TEMPESTE ? LUNA : null);
  if (!gesucht) return -1;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (hi === heroIdx) continue;
    if (ps.heroes[hi]?.name === gesucht) return hi;   // hp bewusst NICHT geprueft
  }
  return -1;
}

/** Die gedruckte Bedingung von Tempeluna, an EINER Stelle. */
function tempelunaBedingung(gs, pi, heroIdx) {
  const hero = gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (!GRUNDFEEN.includes(hero.name)) return false;
  if (hero.hp <= 0) return false;                     // der Aufsteiger muss leben
  return andereGrundfee(gs, pi, heroIdx) >= 0;
}

/**
 * Bereitschaftsfelder am Basis-Helden pflegen. Muster wie
 * `checkMoniaAscension` in `_monia-shared.js`.
 */
function checkTempelunaAscension(engine, pi, heroIdx) {
  const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return;
  if (tempelunaBedingung(engine.gs, pi, heroIdx)) {
    if (hero.ascensionReady && (hero.ascensionTargets || []).includes(TEMPELUNA)) return;
    hero.ascensionReady = true;
    hero.ascensionTarget = TEMPELUNA;
    hero.ascensionTargets = [TEMPELUNA];
  } else if (hero.ascensionReady && hero.ascensionTarget === TEMPELUNA) {
    // Nur die EIGENE Bereitschaft zuruecknehmen — ein anderer Weg, der
    // denselben Helden bereitgemacht hat, bleibt unangetastet.
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = {
  TEMPELUNA, LUNA, TEMPESTE, GRUNDFEEN,
  istFeenHeld, andereGrundfee, tempelunaBedingung, checkTempelunaAscension,
};

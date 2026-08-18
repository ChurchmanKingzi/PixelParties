// ═══════════════════════════════════════════
//  SHARED HELPER: geteilte Support-Zonen
//  („Alice, the Transfer Student")
//
//  „Creatures with identical names in the Support Zones of a Hero you
//   control share 1 Support Zone. This effect persists even when this
//   Hero is defeated and cannot be negated."
//
//  ── DAS MODELL (Als Vorgabe 18.8.: „ein echtes Array an Creatures") ──
//  Ein Support-Platz ist im Spielstand ohnehin ein ARRAY:
//  `ps.supportZones[heldIdx][platzIdx] = [Kartenname, …Anhaengsel]`.
//  Ein Stapel legt schlicht MEHRERE Eintraege desselben Namens hinein:
//      ['Infinitely Reproducing Slime', 'Infinitely Reproducing Slime']
//  Dazu je eine eigene Instanz in `engine.cardInstances` mit demselben
//  `(heroIdx, zoneSlot)`. Die Instanz traegt HP, Counter und Status —
//  jede Kopie ist also ein vollwertiges eigenes Wesen.
//
//  ★ WARUM DAS SO WENIG KAPUTT MACHT (nachgemessen am 18.8.):
//   • Alle Leser fragen `slot[0]` nach dem NAMEN. Da alle Eintraege
//     denselben Namen tragen, bleibt jede dieser 131 Fundstellen in
//     Engine, Server und Brett-Oberflaeche richtig.
//   • Der Todespfad raeumt bereits EINE Namensnennung heraus
//     (`supSlot.indexOf(name)` + `splice(idx, 1)`, _engine.js ~28647) —
//     stirbt eine Kopie, bleibt der Stapel korrekt stehen. Es musste
//     dafuer NICHTS geaendert werden.
//   • „Freier Platz?" fragt `slot.length === 0`. Ein Stapel gilt damit
//     als BELEGT — genau richtig, er teilt sich ja EINEN Platz.
//  Was bleibt, ist die Frage „WELCHE der Kopien ist gemeint?" — und
//  genau dafuer gibt es die Instanz-Abfrage in `promptEffectTarget`.
//
//  ── WER TEILT MIT WEM ──
//  Nur IDENTISCHE Namen, nur innerhalb DESSELBEN Helden, nur auf der
//  Seite, die Alice kontrolliert (oder kontrolliert HAT).
//
//  ── „persists even when this Hero is defeated" ──
//  Ein Spielerschalter, kein Brettzustand: `ps._aliceShareActive` wird
//  gesetzt, sobald Alice ins Spiel kommt, und NIE wieder geloescht.
//  Damit uebersteht die Wirkung ihren Tod, ihre Entfernung und jede
//  Form von Negation — „cannot be negated" ist damit woertlich erfuellt,
//  ohne dass irgendein Negationspfad eine Ausnahme braeuchte.
// ═══════════════════════════════════════════

const ALICE_NAME = 'Alice, the Transfer Student';

/**
 * Teilt `pi` seine Support-Zonen?
 *
 * ★ 18.8., Als Testbefund: „Transfer-Alices Effekt persistiert noch
 * nicht, wenn sie tot ist." Ursache war NICHT der Schalter, sondern
 * dass er nie gesetzt wurde: `armSharing` haengt an Hooks, und
 * `runHooks` verwirft Helden-Hooks, sobald `hero.hp <= 0`
 * (_engine.js ~2578). Eine Alice, die bereits tot ins Spiel kommt —
 * im Puzzle-Editor der Normalfall — bekommt ihr `onGameStart` also
 * nie zu sehen.
 *
 * Konsequenz: die Frage wird jetzt LIVE beantwortet statt sich auf
 * einen Hook zu verlassen. Steht Alice im Team, ist geteilt — egal ob
 * lebend, gefallen, eingefroren oder negiert. Genau das verlangt ihr
 * Text („persists even when this Hero is defeated and cannot be
 * negated"), und es kommt ohne jeden Ausloeser aus.
 *
 * Der Schalter bleibt trotzdem: einmal gesetzt, ueberlebt er auch,
 * wenn Alice das Brett ganz VERLAESST (nicht nur stirbt). Deshalb
 * merkt sich die Funktion das Ergebnis beim ersten Mal.
 */
function sharingActive(gs, pi) {
  const ps = gs?.players?.[pi];
  if (!ps) return false;
  if (ps._aliceShareActive) return true;
  const imTeam = (ps.heroes || []).some(h => h?.name === ALICE_NAME);
  if (imTeam) { ps._aliceShareActive = true; return true; }
  return false;
}

/**
 * Schaltet die Wirkung frei. Wird von Alices eigenem Modul gerufen —
 * beim Spielstart (sie ist eine Startheldin) und beim Ins-Spiel-Kommen.
 * Bewusst ohne Gegenstueck: es gibt kein Abschalten.
 */
function armSharing(gs, pi) {
  const ps = gs?.players?.[pi];
  if (ps) ps._aliceShareActive = true;
}

/**
 * Alle Kreatur-Instanzen auf einem Platz, in Stapelreihenfolge
 * (unterste zuerst — dieselbe Reihenfolge, in der sie gelegt wurden).
 * Anhaengsel (Equipment, Attachment-Spells) sind KEINE Kreaturen und
 * bleiben draussen: sie werden ueber ihren eigenen Kartentyp erkannt.
 */
function stackAt(engine, pi, heroIdx, slotIdx) {
  const { hasCardType } = require('./_hooks');
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.heroIdx !== heroIdx || inst.zoneSlot !== slotIdx) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/** Wie viele Kreaturen teilen sich diesen Platz? (0 = leer, 1 = normal) */
function stackDepth(engine, pi, heroIdx, slotIdx) {
  return stackAt(engine, pi, heroIdx, slotIdx).length;
}

/** Liegt hier ein echter Stapel (mehr als eine Kreatur)? */
function isStacked(engine, pi, heroIdx, slotIdx) {
  return stackDepth(engine, pi, heroIdx, slotIdx) > 1;
}

/**
 * Darf `cardName` zu diesem BELEGTEN Platz dazu? Nur wenn Alice wirkt
 * und dort bereits mindestens eine Kreatur GLEICHEN Namens liegt.
 */
function canShareInto(engine, pi, heroIdx, slotIdx, cardName) {
  if (!cardName) return false;
  if (!sharingActive(engine.gs, pi)) return false;
  const stack = stackAt(engine, pi, heroIdx, slotIdx);
  if (stack.length === 0) return false;
  return stack.every(i => i.name === cardName);
}

/**
 * Plaetze, auf denen `cardName` zu einer Namensgleichen dazustossen
 * darf. Ergaenzt `engine.getFreeSupportZones` um die geteilten Plaetze;
 * gleiche Form `{ heroIdx, slotIdx, label }`, dazu `shared: true` und
 * die aktuelle Stapeltiefe.
 */
function shareableSupportZones(engine, pi, cardName, opts = {}) {
  const ps = engine.gs?.players?.[pi];
  if (!ps || !sharingActive(engine.gs, pi) || !cardName) return [];
  const livingOnly = !!opts.livingHeroesOnly;
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (livingOnly && (!hero?.name || hero.hp <= 0)) continue;
    for (let si = 0; si < 3; si++) {
      if (!canShareInto(engine, pi, hi, si, cardName)) continue;
      const depth = stackDepth(engine, pi, hi, si);
      const heroLabel = hero?.name
        ? (hero.hp <= 0 ? `${hero.name} (KO)` : hero.name)
        : `Column ${hi + 1}`;
      zones.push({
        heroIdx: hi, slotIdx: si, shared: true, stackDepth: depth,
        label: `${heroLabel} — Slot ${si + 1} (×${depth})`,
      });
    }
  }
  return zones;
}

/**
 * Beschreibt eine Instanz fuer die Auswahl-Abfrage. Genau die Angaben,
 * die Al verlangt hat: aktuelle und maximale HP, Counter, Status.
 * Reine Lesefunktion — kein Zustand wird angefasst.
 */
/**
 * Beschreibt eine Instanz fuer die Auswahl-Abfrage und fuer das Brett.
 *
 * ★ 18.8., nach Als Test: hier wird NICHTS mehr gedeutet. Frueher hat
 * diese Funktion die Counter selbst gefiltert und als rohe
 * Schluessel-Wert-Paare ausgeliefert — der Spieler sah dann „isPlacement"
 * (interne Buchhaltung) und „buffs ×[object Object]" (ein Objekt, das
 * als Zahl gerendert wurde). Beides war fuer niemanden lesbar.
 *
 * Jetzt gehen `counters` und `statuses` ROH raus, und der Client
 * zeichnet sie mit **denselben Bausteinen wie das Brett**:
 * `StatusBadges` und `BuffColumn` aus `app-shared.jsx`. Die kennen fuer
 * jeden Status und jeden Buff Symbol und ausformulierte Erklaerung,
 * blenden Buchhaltung von sich aus nicht ein und wachsen automatisch
 * mit, wenn eine neue Karte einen neuen Status einfuehrt.
 *
 * Kein Mehr an Information: dieselben rohen Counter schickt der Server
 * dem Brett laengst als `creatureCounters`.
 */
function describeInstance(engine, inst) {
  const cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name];
  // ★ HP einer Kreatur liegt in den COUNTERN, nicht als Feld auf der
  // Instanz: `counters.currentHp` und `counters.maxHp`, jeweils mit
  // dem gedruckten Wert als Rueckfall (so rechnet auch die Engine,
  // z.B. _engine.js ~28606). Ein `inst.hp` gibt es nicht — beim
  // Bauen dieser Funktion zuerst genau danach gegriffen und im Repro
  // als `undefined` aufgefallen.
  const maxHp = inst.counters?.maxHp ?? cd?.hp ?? null;
  const hp = inst.counters?.currentHp ?? maxHp;
  return {
    instId: inst.id,
    name: inst.name,
    hp,
    maxHp,
    counters: { ...(inst.counters || {}) },
    statuses: { ...(inst.statuses || {}) },
    summonedThisTurn: inst.turnPlayed === engine.gs.turn,
  };
}

module.exports = {
  ALICE_NAME,
  sharingActive,
  armSharing,
  stackAt,
  stackDepth,
  isStacked,
  canShareInto,
  shareableSupportZones,
  describeInstance,
};

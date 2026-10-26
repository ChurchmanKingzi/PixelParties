'use strict';
// ═══════════════════════════════════════════
//  GETEILTER BAUSTEIN: „Infallible Oracle Pythia" — der vorgemerkte Tod („Death Foreseen by Pythia")
//
//  Kartentext: „When you summon this Creature, choose any target on the board. Place 1 Pythia Counter onto this card at the beginning of each of your turns.
//  When the third Pythia Counter is placed on this card, immediately defeat the chosen target. When this Creature would be defeated, you may sacrifice another
//  target you control to fully heal its HP instead."
//
//  ZUSTAND (alles an der PYTHIA-Instanz, `inst.counters`):
//    • `pythiaCounters` — Zahl der Pythia Counter (wird nie zurückgesetzt, auch nicht durch die Selbstheilung: Pythia „stirbt" dabei nicht wirklich).
//    • `pythiaPlan`     — das gewählte Ziel: `{ kind: 'hero', owner, heroIdx, cardName }` (physische Spalte) bzw. `{ kind: 'creature', instId, cardName }`.
//
//  ANZEIGE-MARKE AM ZIEL („Death Foreseen by Pythia", KEIN Status — Heilen/Cleanse kennen sie nicht):
//    • Held: `hero._pythiaMark`, Kreatur: `inst.counters._pythiaMark` = `{ n, counters }` (n = Zahl der Pythias, die dieses Ziel vorgemerkt haben,
//      counters = höchster Pythia-Zählerstand unter ihnen). Sie wird NIE von Hand gesetzt, sondern bei jedem `engine.sync()` aus den Plänen der lebenden
//      Pythias NEU ABGELEITET (`abgleichen`): verlässt Pythia das Brett (Tod, Hand, Deck, Löschen …), fällt die Marke von selbst; ebenso, wenn das Ziel das Brett verlässt
//      (Held: bleibt der Plan über Tod und Wiederbelebung bestehen — Al: Helden behalten den Effekt und die Marke; Kreaturen: eine wiederbelebte Kreatur ist eine neue Instanz, der Plan entfällt).
//    • Ist der Plan verfallen, zählt Pythia weiter und nichts passiert beim dritten Zähler.
//
//  Die Wirkung der Karte liegt in `infallible-oracle-pythia.js`; hier nur, was die Engine selbst braucht (sync-Abgleich, Heldentod).
// ═══════════════════════════════════════════

const CARD_NAME = 'Infallible Oracle Pythia';
const PLAN = 'pythiaPlan';
const ZAEHLER = 'pythiaCounters';
const MARKE = '_pythiaMark';

/**
 * Ziel des Plans als lebendes Objekt: `{ kind:'hero', hero, owner, heroIdx }`, `{ kind:'creature', inst }` oder `null` (verfallen).
 * Ein HELD behält den Plan über Tod und Wiederbelebung (`opts.auchTot` = auch den gerade toten Helden liefern, mit `tot: true`); ohne `auchTot` zählt nur ein lebender.
 */
function zielVon(engine, plan, opts = {}) {
  if (!plan) return null;
  if (plan.kind === 'hero') {
    const hero = engine.gs.players?.[plan.owner]?.heroes?.[plan.heroIdx];
    if (!hero?.name || hero.name !== plan.cardName) return null;
    if (!(hero.hp > 0)) return opts.auchTot ? { kind: 'hero', hero, owner: plan.owner, heroIdx: plan.heroIdx, tot: true } : null;
    return { kind: 'hero', hero, owner: plan.owner, heroIdx: plan.heroIdx };
  }
  if (plan.kind === 'creature') {
    const inst = (engine.cardInstances || []).find(c => c.id === plan.instId);
    if (!inst || inst.zone !== 'support' || inst.faceDown) return null;
    return { kind: 'creature', inst };
  }
  return null;
}

/** Ist diese Instanz eine Pythia auf dem Brett? */
function istPythia(inst) {
  return !!inst && inst.name === CARD_NAME && inst.zone === 'support' && !inst.faceDown;
}

/**
 * Marken und Pläne mit dem Brett abgleichen (läuft bei jedem `engine.sync()`): verfallene Pläne löschen, die Anzeige-Marken aus den gültigen Plänen neu ableiten.
 * Billig, solange keine Pythia im Spiel ist (ein Durchlauf über die Instanzen).
 */
function abgleichen(engine) {
  const gs = engine?.gs;
  const insts = engine?.cardInstances;
  if (!gs || !Array.isArray(insts)) return;
  let etwasZuTun = false;   // gibt es überhaupt etwas zu tun?
  for (const c of insts) {
    if (c.name === CARD_NAME || (c.counters && c.counters[MARKE])) { etwasZuTun = true; break; }
  }
  if (!etwasZuTun) {
    for (const p of gs.players || []) for (const h of p?.heroes || []) if (h && h[MARKE]) { etwasZuTun = true; break; }
    if (!etwasZuTun) return;
  }
  // 1. gültige Pläne einsammeln
  const wunsch = new Map();   // Schlüssel → { n, counters }
  for (const p of insts) {
    if (p.name !== CARD_NAME || !p.counters || !p.counters[PLAN]) continue;
    const ziel = istPythia(p) ? zielVon(engine, p.counters[PLAN], { auchTot: true }) : null;
    if (!ziel) { delete p.counters[PLAN]; continue; }   // Pythia weg bzw. Ziel weg: der Plan verfällt (Pythia zählt weiter)
    const key = ziel.kind === 'hero' ? `h:${ziel.owner}:${ziel.heroIdx}` : `c:${ziel.inst.id}`;
    const e = wunsch.get(key) || { n: 0, counters: 0 };
    e.n += 1;
    e.counters = Math.max(e.counters, p.counters[ZAEHLER] || 0);
    wunsch.set(key, e);
  }
  // 2. Marken anwenden (nur schreiben, wenn sich etwas ändert)
  const setze = (halter, key) => {
    const w = wunsch.get(key);
    const alt = halter[MARKE];
    if (!w) { if (alt) delete halter[MARKE]; return; }
    if (!alt || alt.n !== w.n || alt.counters !== w.counters) halter[MARKE] = { n: w.n, counters: w.counters };
  };
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (heroes[hi]) setze(heroes[hi], `h:${pi}:${hi}`);
  }
  for (const c of insts) {
    if (!c.counters) continue;
    if (!c.counters[MARKE] && !wunsch.has(`c:${c.id}`)) continue;
    setze(c.counters, `c:${c.id}`);
  }
}

module.exports = { CARD_NAME, PLAN, ZAEHLER, MARKE, zielVon, istPythia, abgleichen };

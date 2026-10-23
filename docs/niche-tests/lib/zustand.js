'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W66b — ZUSTANDS-DIFFERENZ (Al, 23.10.2026): „Kosten UND Limits erst nach dem Commit"
//  Ein Abbruch an JEDER abbrechbaren Stelle muss den Spielzustand EXAKT wie vor dem Beginn hinterlassen:
//  Gold, Hand/Ablage/Deck/Löschstapel/Potion Deck (Reihenfolge!), Brett, Marken/Stempel (hoptUsed, _spellLockTurn, Zähler …),
//  Aktionspunkte, Helden-/Kreaturen-Zustände, Pollution Tokens, Hook-Zustände. Ignoriert werden nur Anzeige-/Protokoll-/Zeitfelder.
// ═══════════════════════════════════════════════════════════════════════════
const ZUSTAND_IGNORIERT = new Set([
  'effectPrompt', 'potionTargeting', '_pendingCardReveal', '_holdCardReveal', '_gameStartTime', '_playerIPs', 'rematchRequests', 'result',
  'socketId', 'script', 'room', 'engine', 'currentPhase', 'activePlayer', '_resolvingCard', 'resolvingCard', 'lastActivity', '_lastActivity',
  'timer', 'turnTimer', '_turnStartedAt', '_turnDeadline', 'turnDeadline', 'turnStartTime', '_scTracking', 'id', 'uid', 'log', 'actionLog', '_log',
  'deckSkins', 'board', 'battleTrack', 'victoryMsg', 'defeatMsg', 'heroKilledMsg', 'middleHeroKilledMsg', 'greetingMsg', 'barkBounce', 'avatar', 'cardback', 'color',
  '_deletedStamps', 'activatedThisChain', '_cpuPlayFailReason', '_resolvingPlayStack', '_resolvingSpellStack', '_spellResolutionDepth', '_handResolving', '_spellCancelled', '_batchDiscardOp',
  '_ablageStamps',         // Lethe-Stempel der Ablage: wird beim ersten Lesen mit -1 (= kein Stempel) angelegt
  '_handOriginsRemoved',   // Buchführung der Hand-Spleiß-Abfangvorrichtung (Herkunft entfernter Handkarten)
]);
let _Z = 0;   // Zähler der geschriebenen Einträge (erkennt Objekte, deren Felder alle „leer" sind: { heroOwner: 0 } ist eine Spur und darf nicht verschwinden)
const _set = (out, k, v) => { out[k] = v; _Z++; };
function zustandFlach(v, pfad, out, seen, tiefe) {
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return;
  if (v === null || typeof v !== 'object') { if (v !== null && v !== 0 && v !== false && v !== '') _set(out, pfad, JSON.stringify(v)); return; }   // leere Werte (0, false, '', null) = 'nicht gesetzt'
  if (seen.has(v)) { _set(out, pfad, '"<zyklus>"'); return; }
  if (tiefe > 9) { _set(out, pfad, '"<tief>"'); return; }
  seen.add(v);
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) { if (v.length) _set(out, pfad, JSON.stringify(v)); seen.delete(v); return; }   // flache Listen (Hand, Ablage, Deck …) als Ganzes → Reihenfolge zählt
    v.forEach((x, i) => zustandFlach(x, pfad + '[' + i + ']', out, seen, tiefe + 1));
    seen.delete(v); return;
  }
  const ks = Object.keys(v).filter(k => !ZUSTAND_IGNORIERT.has(k)).sort();
  const z0 = _Z;
  for (const k of ks) zustandFlach(v[k], pfad + '.' + k, out, seen, tiefe + 1);
  if (ks.length && _Z === z0) _set(out, pfad, '"{leer}"');   // Objekt mit nur leeren Feldern: die Existenz zählt (z. B. `_requestedNormalSummonSlot = { heroIdx: 0, zoneSlot: 0 }`)
  seen.delete(v);
}
/** Flacher, kanonischer Schnappschuss des gesamten Spielzustands: { pfad: json }. */
function zustand(gs, engine) {
  const out = {};
  zustandFlach(gs, 'gs', out, new WeakSet(), 0);
  // Instanzen (ohne Kennung) in kanonischer Reihenfolge; Zählkopf je Schlüssel
  const insts = (engine.cardInstances || []).map(c => {
    const o = {}; for (const k of Object.keys(c)) { if (ZUSTAND_IGNORIERT.has(k) || k === 'id' || typeof c[k] === 'function') continue; o[k] = c[k]; }
    return o;
  });
  const schl = (o) => [o.zone, o.owner, o.heroIdx, o.zoneSlot, o.name].join('|');
  insts.sort((a, b) => schl(a) < schl(b) ? -1 : schl(a) > schl(b) ? 1 : 0);
  const zaehl = {};
  for (const o of insts) { const k = schl(o); zaehl[k] = (zaehl[k] || 0) + 1; zustandFlach(o, 'inst{' + k + '}#' + zaehl[k], out, new WeakSet(), 0); }
  return out;
}
/** Unterschiede zweier Schnappschüsse als Liste lesbarer Zeilen (leer = identisch). */
function zustandDiff(a, b) {
  const d = [];
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of [...ks].sort()) if ((a || {})[k] !== (b || {})[k]) d.push(`${k}: ${(a || {})[k] === undefined ? '∅' : String((a || {})[k]).slice(0, 120)} → ${(b || {})[k] === undefined ? '∅' : String((b || {})[k]).slice(0, 120)}`);
  return d;
}


/** Pfade, an denen BEZAHLTE Kosten sichtbar werden (nicht: Reservierungen wie Hand/Deck-Entnahme oder Einmal-Stempel). */
const BEZAHLT_PFADE = /^(gs\.players\[\d\]\.(gold|discardPile|deletedPile)|gs\.players\[\d\]\.heroes\[\d\]\.(hp|statuses|buffs)|gs\.players\[\d\]\.supportZones|inst\{support)/;
/** Rohe Differenz mit vollen Werten (nur für Pfade, die `filter` annimmt): [{ pfad, vorher, nachher }] — `vorher`/`nachher` sind die geparsten Werte (oder undefined). */
function zustandDiffRoh(a, b, filter = BEZAHLT_PFADE) {
  const out = [];
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) {
    if (!filter.test(k) || (a || {})[k] === (b || {})[k]) continue;
    const parse = (x) => { if (x === undefined) return undefined; try { return JSON.parse(x); } catch { return x; } };
    out.push({ pfad: k, vorher: parse((a || {})[k]), nachher: parse((b || {})[k]) });
  }
  return out;
}
/** Buchführung der LAUFENDEN Aktion — wird bei Abbruch zurückgenommen (die Nach-Abbruch-Differenz prüft das) und gilt nicht als „bezahlt". */
const BUCHFUEHRUNG = /^(gs\._spellCasterCreature|gs\._heroEffectInProgress|gs\._batchDiscardDepth|gs\._gewirkteStufe|gs\._pendingPlayLog|gs\.players\[\d\]\._actionsPlayedThisPhase|gs\.players\[\d\]\._requestedNormalSummonSlot|gs\.players\[\d\]\._requestedBouncePlaceSlot|gs\._spellConsumedMainAction|gs\._spellWasInherent)/;
/** Zeigt ein Eintrag der Rohdifferenz (`zustandDiffRoh`) BEZAHLTE Kosten? Listen (Ablage/Löschstapel): ein Eintrag ist dazugekommen (Opfer/Abwurf/Löschung); die bloße ENTNAHME der gespielten Karte
 *  (Reservierung) zählt nicht. Gold/HP: weniger. Status/Buffs/Brett: jede Änderung. */
function istBezahlt(d) {
  const p = d.pfad;
  if (BUCHFUEHRUNG.test(p)) return false;
  if (/\.(discardPile|deletedPile)$/.test(p)) {
    const vor = Array.isArray(d.vorher) ? d.vorher.slice() : [];
    for (const n of (Array.isArray(d.nachher) ? d.nachher : [])) { const i = vor.indexOf(n); if (i < 0) return true; vor.splice(i, 1); }
    return false;
  }
  if (/\.gold$/.test(p)) return Number(d.nachher || 0) < Number(d.vorher || 0);
  if (/\.hp$/.test(p)) return Number(d.nachher || 0) < Number(d.vorher || 0);
  return true;
}
module.exports = { zustand, zustandDiff, zustandDiffRoh, istBezahlt, BUCHFUEHRUNG, BEZAHLT_PFADE, ZUSTAND_IGNORIERT };

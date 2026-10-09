'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GESEHENE HELDENEFFEKTE — was die CPU im Spiel vom Gegner erlebt hat
//
//  Auslöser (Al, Deck-Regel zu Pseudonia): „Kopiere mit Pseudonia einen
//  Gegner-Hero im Verlauf des Spiels; welchen, soll von der im Laufe des
//  Spiels gesehenen Wertigkeit seines Effekts abhängen." Pseudonia darf
//  nur den Effekt eines Helden aufnehmen, der gerade GESTORBEN ist — die
//  CPU kann ihn nicht aus dem ganzen Aufgebot aussuchen, sondern muss bei
//  jedem fallenden Gegner-Helden entscheiden: nehmen oder auf einen
//  besseren warten. Dafür braucht sie eine Zahl je Effekt.
//
//  ── DIE ZAHL ──────────────────────────────────────────────────────
//      wert(Effekt) = vorgabe(Effekt) + AKTIVIERUNG × gesehene Aktivierungen
//
//  • Gesehene Aktivierungen: jede Aktivierung eines AKTIVEN Heldeneffekts
//    (`hero_effect_activated`, also nur, was wirklich aufgelöst wurde —
//    ein negierter Effekt zählt nicht), gezählt in `engine.log` wie die
//    Ability-Nutzung (`_ability-worth-shared.noteUsage`): VOR dem Fast-
//    Mode-Ausstieg, damit das Self-Play zählt; Rollouts zählen nicht.
//    Der Gegner benutzt einen Effekt, den er für gut hält — wie bei der
//    Ability-Wertigkeit ist Nutzung ein BEWEIS für den Wert.
//  • Vorgabe: das Kartenskript darf sie mit `cpuMeta.effectWorth` (Zahl)
//    setzen. Ohne Angabe: aktiver Effekt 6, passiver 3.
//
//  ── GRENZEN (ehrlich) ─────────────────────────────────────────────
//  Passive Heldeneffekte (Schadensschutz, Kostensenkung …) feuern nicht
//  als Aktivierung und bleiben deshalb bei ihrer Vorgabe; die Zahl misst
//  gesehene NUTZUNG, nicht Wirkung. AKTIVIERUNG (10) und die Vorgaben sind
//  Setzungen, nicht gelernt — Naht für spätere Werte:
//  `profile.ruleParams["pseudonia.aktivierungsWert"]`.
// ═══════════════════════════════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const AKTIVIERUNG = 10;          // Punkte je gesehener Aktivierung
const VORGABE_AKTIV = 6;         // Effekt mit `onHeroEffect`, noch nie gesehen
const VORGABE_PASSIV = 3;        // alles andere

/**
 * Verbucht eine Aktivierung. Aufruf aus `engine.log` (nur Typ
 * `hero_effect_activated`); `data.pi` = der Aktivierende, `data.effect` =
 * die Karte, deren Effekt aufgelöst wurde (bei einem gewonnenen Effekt
 * also das Original, nicht der Träger).
 */
function note(engine, type, data) {
  try {
    if (type !== 'hero_effect_activated' || !data || engine._inMctsSim) return;
    if (!Number.isInteger(data.pi) || !data.effect) return;
    if (!engine._heroEffectSeen) engine._heroEffectSeen = Object.create(null);
    const je = engine._heroEffectSeen[data.pi] || (engine._heroEffectSeen[data.pi] = Object.create(null));
    je[data.effect] = (je[data.effect] || 0) + 1;
  } catch { /* Zähler darf nie stören */ }
}

/** Wie oft hat `beobachter` den Effekt `effekt` bei ANDEREN Seiten aufgelöst gesehen? */
function gesehen(engine, beobachter, effekt) {
  const alle = engine._heroEffectSeen;
  if (!alle) return 0;
  let n = 0;
  for (const seite of Object.keys(alle)) {
    if (Number(seite) === beobachter) continue;
    n += alle[seite][effekt] || 0;
  }
  return n;
}

/** Wert des Effekts `effekt` aus Sicht von `beobachter` (siehe Kopf). */
function seenValue(engine, beobachter, effekt) {
  const sc = loadCardEffect(effekt);
  const vorgabe = Number.isFinite(sc?.cpuMeta?.effectWorth) ? sc.cpuMeta.effectWorth
    : (sc?.heroEffect && typeof sc.onHeroEffect === 'function' ? VORGABE_AKTIV : VORGABE_PASSIV);
  let je = AKTIVIERUNG;
  try { je = require('./_deck-profile').ruleParam(engine, beobachter, 'pseudonia.aktivierungsWert', AKTIVIERUNG); }
  catch { /* Profil optional */ }
  return vorgabe + je * gesehen(engine, beobachter, effekt);
}

module.exports = { note, gesehen, seenValue, AKTIVIERUNG, VORGABE_AKTIV, VORGABE_PASSIV };

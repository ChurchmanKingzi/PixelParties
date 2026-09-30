// ═══════════════════════════════════════════════════════════════════
//  FREISCHALTUNGEN DURCH CPU-SIEGE (Sammelstelle für den Victory-Screen)
//
//  Wer eine CPU besiegt, kann dadurch etwas freischalten — heute deren
//  Battle-Track (battle-tracks.js) und ihre Gegner-Sleeve (cpu-sleeves.js).
//  Der Victory-Screen zeigt jede Freischaltung als Meldung. Damit er nicht
//  jedes System einzeln kennen muss, meldet sich jede Quelle hier an:
//
//      registerCpuUnlockSource(async (ctx) => ({ kind: 'sleeve', id, name, image }))
//
//  `ctx` = { userId, opponentDeckId, wins, preWins, isGuest }
//    wins    Siege gegen DIESE CPU NACH der Partie (npc_stats ist schon hochgezählt)
//    preWins Siege davor
//  Die Quelle liefert null, ein Objekt oder eine Liste. Ein Objekt:
//    kind   'music' | 'sleeve' | …  (bestimmt Symbol und Text im Client)
//    id     technische ID (optional)
//    name   Anzeigename, z. B. „Zi's Theme“ oder der Sleeve-Titel
//    image  Bild-URL (optional, z. B. Sleeve-Vorschau)
//    hero   voller Heldenname (optional; der Client kürzt ihn zu „Zi“ und baut „Zi's Theme“)
//  Fehler einer Quelle werden gemeldet, blockieren aber weder die anderen
//  Quellen noch die Partie.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const sources = [];

function registerCpuUnlockSource(fn) {
  if (typeof fn === 'function') sources.push(fn);
}

/** Alle Quellen befragen; Ergebnis: Liste sauberer Einträge { kind, id, name, image }. */
async function collectCpuUnlocks(ctx) {
  const out = [];
  for (const fn of sources) {
    try {
      const r = await fn(ctx);
      for (const e of [].concat(r || [])) {
        if (e && e.name) out.push({ kind: String(e.kind || 'unlock'), id: e.id || null, name: String(e.name), image: e.image || null, hero: e.hero || null });
      }
    } catch (err) {
      console.error('[cpu-unlocks] Quelle fehlgeschlagen:', err.message);
    }
  }
  return out;
}

module.exports = { registerCpuUnlockSource, collectCpuUnlocks };

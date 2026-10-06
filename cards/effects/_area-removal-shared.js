'use strict';
// ═══════════════════════════════════════════════════════════════════
//  AREA-ABRÄUMUNG — GEMEINSAMES VOKABULAR (Lernkanal, Als Auftrag 6.10.)
//
//  „Es gibt Situationen/Karten/ganze Decks, bei denen es sinnvoll ist,
//   EIGENE Areas zu zerstören."
//
//  Drei Gründe nannte der Auftrag, und sie sind der Grund für dieses
//  Modul:
//    (a) die Area hilft dem GEGNER auch / mehr           → `fit:*`
//    (b) man will eine ANDERE Area ausspielen             → `hand:other` / `hand:none`
//    (c) eigene Effekte triggern/skalieren, wenn eigene
//        (Area-)Karten abgeräumt werden                   → `board:<Name>`, `dpa:*`
//  Dazu die IDENTITÄT: Areas, die generell weg sollen (`Name@own` /
//  `Name@opp`) — das Profil gehört einem Deck, dort ist Identität
//  lernbar (anders als bei den offenen Pools).
//
//  ── WARUM EIN GEMEINSAMES MODUL ───────────────────────────────────
//  Die Tags müssen im TRAINER (aus dem rohen Kontext einer
//  aufgezeichneten Entscheidung) und zur LAUFZEIT (aus dem lebenden
//  Spiel) BIT-GLEICH entstehen. Zwei Ableitungen driften auseinander —
//  das ist die Fehlerklasse, die das Projekt an mehreren Lernkanälen
//  schon gekostet hat. Deshalb: ein Modul, zwei Aufrufer.
//
//    rohKontext(engine, pi)                 → was der Recorder mitschreibt
//    areaTags(roh, areaName, seite, cardDB) → die Tags EINER angebotenen Area
//
//  Der Recorder schreibt ROH (Aufzeichnen ist gratis, nicht
//  nachholbar); abgeleitet wird erst hier, damit Schwellen ohne neuen
//  Sammellauf änderbar bleiben.
//
//  Reines Datenmodul: keine Engine-Abhängigkeit außer dem übergebenen
//  Objekt, nie ein Wurf.
// ═══════════════════════════════════════════════════════════════════

const MAX_NAMEN = 30;

const lc = (s) => String(s || '').toLowerCase();
const istAreaKarte = (cd) => !!cd && lc(cd.subtype) === 'area';
const eindeutig = (arr) => [...new Set(arr.filter(Boolean))];

/** Ein Spieler: Namen auf dem eigenen Brett (Helden, Support-Zonen, Ability-Zonen). */
function brettNamen(ps) {
  const out = [];
  try {
    for (const h of (ps?.heroes || [])) {
      const n = h?.baseName || h?.name;
      if (n) out.push(n);
    }
    for (const hz of (ps?.supportZones || [])) for (const slot of (hz || [])) for (const n of (slot || [])) out.push(n);
    for (const hz of (ps?.abilityZones || [])) for (const slot of (hz || [])) for (const n of (slot || [])) out.push(n);
  } catch { /* Beiwerk */ }
  return eindeutig(out).sort().slice(0, MAX_NAMEN);
}

/**
 * Schul-Stärke eines Spielers: { Schule: [Helden mit der Schule, Summe der Stufen] }.
 * Eine Ability der Stufe N liegt als N gleichnamige Karten im selben Slot.
 */
function schulStaerke(ps) {
  const out = Object.create(null);
  try {
    const heroes = ps?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const h = heroes[hi];
      if (!h?.name || (h.hp || 0) <= 0) continue;
      const proHeld = Object.create(null);
      for (const slot of ((ps.abilityZones || [])[hi] || [])) {
        for (const n of (slot || [])) proHeld[n] = (proHeld[n] || 0) + 1;
      }
      for (const [schule, stufe] of Object.entries(proHeld)) {
        const e = (out[schule] = out[schule] || [0, 0]);
        e[0] += 1; e[1] += stufe;
      }
    }
  } catch { /* Beiwerk */ }
  return out;
}

/**
 * Roher Kontext einer Area-Entscheidung aus Sicht von `pi`.
 *   ao  eigene Areas (Stapelreihenfolge)      ap  gegnerische Areas
 *   hA  Area-Karten auf der eigenen Hand      bd  eigenes Brett (Namen)
 *   sc  Schul-Stärke { o: eigen, p: Gegner }  dA  Area-Karten in der eigenen Ablage
 */
function rohKontext(engine, pi) {
  const k = { ao: [], ap: [], hA: [], bd: [], sc: { o: {}, p: {} }, dA: 0 };
  try {
    const gs = engine?.gs;
    const ps = gs?.players?.[pi];
    const os = gs?.players?.[pi === 0 ? 1 : 0];
    const db = engine?._getCardDB ? engine._getCardDB() : {};
    k.ao = [...(gs?.areaZones?.[pi] || [])];
    k.ap = [...(gs?.areaZones?.[pi === 0 ? 1 : 0] || [])];
    k.hA = (ps?.hand || []).filter(n => istAreaKarte(db[n]));
    k.bd = brettNamen(ps);
    k.sc = { o: schulStaerke(ps), p: schulStaerke(os) };
    k.dA = (ps?.discardPile || []).filter(n => istAreaKarte(db[n])).length;
  } catch { /* Beiwerk */ }
  return k;
}

/** Offene Tag-Räume — brauchen im Trainer die strengere Schwelle (viele Vergleiche). */
const OFFEN = ['board:'];
const istOffen = (tag) => OFFEN.some(p => tag.startsWith(p));

/**
 * Tags EINER angebotenen Area. `seite` = 'own' | 'opp' (relativ zum Wähler).
 * `roh` = Ergebnis von rohKontext (live oder aus der Aufzeichnung).
 */
function areaTags(roh, areaName, seite, cardDB) {
  const tags = [];
  try {
    const r = roh || {};
    const cd = (cardDB || {})[areaName];

    // (a) Wem nützt sie mehr? Passung = Summe der Stufen der Schulen, die die Area nennt.
    const schulen = [cd?.spellSchool1, cd?.spellSchool2].filter(Boolean);
    if (schulen.length) {
      let eigen = 0, fremd = 0;
      for (const s of schulen) {
        eigen += (r.sc?.o?.[s]?.[1]) || 0;
        fremd += (r.sc?.p?.[s]?.[1]) || 0;
      }
      tags.push('fit:' + (fremd > eigen ? 'opp>own' : fremd < eigen ? 'own>opp' : 'eq'));
    }

    // (b) Will ich eine ANDERE Area ausspielen? `hand:other` / `hand:none` schließen
    // einander aus — beide dürfen gelernt werden, ohne dass die Summe doppelt zählt.
    // (Bewusst KEIN `plans:<Name>`: es wäre zu `hand:other` kollinear, und der Prior
    // SUMMIERT die Tag-Gewichte.)
    const andere = eindeutig((r.hA || []).filter(n => n !== areaName));
    tags.push(andere.length ? 'hand:other' : 'hand:none');
    tags.push('areas:own:' + Math.min((r.ao || []).length, 3));
    tags.push('areas:opp:' + Math.min((r.ap || []).length, 3));

    // (c) Trigger / Skalierung durch Abräumen eigener Karten.
    const dA = r.dA || 0;
    tags.push('dpa:' + (dA === 0 ? '0' : dA <= 2 ? '1-2' : '3+'));
    for (const n of (r.bd || [])) tags.push('board:' + n);
  } catch { /* Beiwerk */ }
  return tags;
}

module.exports = { rohKontext, areaTags, istOffen, istAreaKarte, OFFEN };

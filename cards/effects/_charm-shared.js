// ═══════════════════════════════════════════
//  TEMPORÄRE KONTROLLE — EINE AUSLEGUNGSSTELLE (v1196)
//
//  „Take control of a Hero your opponent controls for the rest of the
//   turn" gibt es im Bestand dreimal: „Charme" Lv3, „Love Shot" und
//  jetzt „Golden Apple". Das Verfahren ist identisch, die Kartentexte
//  unterscheiden sich nur im SCHUTZ — deshalb ein Modul mit einem
//  Schalter, statt drei Kopien derselben zwölf Schritte.
//
//  ── WAS DAZUGEHOERT ───────────────────────────────────────────────
//  Die Reihenfolge ist nicht beliebig; jeder Schritt hat einen Grund:
//    ① Erst-Zug-Schutz — Spieler 1 darf im ersten Zug kein gegnerisches
//      Ziel wählen (Regelwerk).
//    ② `beforeHeroEffect` mit `effectType: 'charm'` — sonst läuft die
//      Übernahme an „Resistance" vorbei, und der Held bliebe halb
//      verzaubert (`charmedBy` gesetzt, Status wieder entfernt).
//    ③ Effekt-Immunität (`hasEffectImmunity`) — `charmed` ist kein
//      Katalogstatus und läuft nicht durch `addHeroStatus`, der Riegel
//      steht deshalb von Hand (Als Vorgabe 21.8.).
//    ④ Marken setzen: `charmedBy` / `charmedFromOwner` /
//      `charmedHeroIdx` plus `statuses.charmed`.
//    ⑤ Support-Zonen-Sperre — NUR, wenn der Kartentext sie nennt.
//
//  Die RUECKNAHME am Zugende ist generisch (`charmedBy` wird dort
//  gelöscht) — eine Karte muss dafür nichts tun.
//  `fortsetzung` (nur The Master's Orders): dieselbe Übernahme setzt sich im
//  selben Zug fort, nachdem eine Status-Immunität sie unterbrochen hat — ①–③
//  entfallen, sie liefen beim Beginn schon (Resistance wird nicht ein zweites
//  Mal verbraucht und nicht umgangen).
//
//  ── DER SCHUTZ-SCHALTER ───────────────────────────────────────────
//  `statuses.charmed` trägt die Ausprägung, `engine._charmBlocksFrom`
//  beantwortet sie an beiden Toren (Schaden, negativer Status):
//
//    Charme Lv3    → keine Marke: alles prallt ab.
//    Love Shot     → `_loveShot`: nur Kontrolle, kein Schadensschutz.
//    Golden Apple  → `onlyFromController`: nur die Karten des
//                    Kontrolleurs prallen ab.
// ═══════════════════════════════════════════

/**
 * Einen gegnerischen Helden für den Rest des Zuges übernehmen.
 *
 * @returns {Promise<{ok: boolean, grund?: string}>}
 *   `ok: false` mit `grund` heißt: der Versuch lief, prallte aber ab
 *   (Erst-Zug-Schutz, Resistance, Effekt-Immunität). Die Kosten der
 *   Karte sind dann trotzdem bezahlt — wie bei Charme Lv3, wo der HOPT
 *   ebenfalls verbraucht bleibt.
 */
const { KONTROLL_RECHTE } = require('./_hooks');

async function temporaereKontrolle(engine, {
  controllerPi,
  ownerPi,
  heroIdx,
  sourceName = 'Control',
  marker = null,              // '_loveShot' | 'onlyFromController' | null
  supportZonesLocked = false, // nur, wenn der Kartentext sie nennt
  fortsetzung = false,        // The Master's Orders: dieselbe Übernahme setzt sich im selben Zug fort (nach einer Status-Immunität) — ①–③ liefen beim Beginn schon, nicht erneut (Resistance nie ein zweites Mal)
}) {
  const gs = engine.gs;
  const ops = gs.players[ownerPi];
  const hero = ops?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return { ok: false, grund: 'kein Ziel' };
  if (hero.charmedBy != null) return { ok: false, grund: 'bereits uebernommen' };

  // ① Erst-Zug-Schutz
  if (!fortsetzung && gs.firstTurnProtectedPlayer === ownerPi) {
    engine.log('charm_fizzle', {
      by: sourceName, target: hero.name, reason: 'turn-1 protection',
    });
    engine.sync();
    return { ok: false, grund: 'erstZug' };
  }

  // ② Resistance & Co.
  const effectCtx = {
    playerIdx: ownerPi, heroIdx, hero,
    effectType: 'charm', cancelled: false, _skipReactionCheck: true,
  };
  if (!fortsetzung) await engine.runHooks('beforeHeroEffect', effectCtx);
  if (effectCtx.cancelled) {
    engine.log('charm_blocked', { by: sourceName, target: hero.name });
    engine.sync();
    return { ok: false, grund: 'geblockt' };
  }

  // ③ Effekt-Immunitaet (Escape Device, Invisibility Cloak)
  if (!fortsetzung && engine.hasEffectImmunity?.(ownerPi, heroIdx, null)) {
    engine.log('effect_immunity', { hero: hero.name, status: 'charmed' });
    engine.sync();
    return { ok: false, grund: 'immun' };
  }

  // ④ Uebernehmen
  hero.charmedBy = controllerPi;
  hero.charmedFromOwner = ownerPi;
  hero.charmedHeroIdx = heroIdx;
  if (!hero.statuses) hero.statuses = {};
  hero.statuses.charmed = { controller: controllerPi, appliedTurn: gs.turn };
  engine._heldenStatusVerursacher(hero.statuses.charmed, { appliedBy: controllerPi });   // v1399
  if (marker) hero.statuses.charmed[marker] = true;
  // Als Vorgabe 29.9.: Charme („It and its Support Zones are unaffected")
  // gibt dem Kontrolleur nichts; ohne Sperre im Kartentext (Golden Apple)
  // darf er beschwoeren und ausruesten.
  hero._kontrollRechte = { ...(supportZonesLocked ? KONTROLL_RECHTE.nichts : KONTROLL_RECHTE.brett) };

  // ⑤ Support-Zonen nur auf Ansage
  if (supportZonesLocked) {
    if (!gs._charmedSupportLocked) gs._charmedSupportLocked = [];
    gs._charmedSupportLocked.push({ owner: ownerPi, heroIdx });
    // „It and its Support Zones are unaffected by other cards and effects": Marke fuer `engine.heroZonenGeschuetzt` — Anhaengsel werden dort weder angelegt (`placeAttachment`)
    // noch entfernt (Exorcism). (Die Liste `_charmedSupportLocked` oben fuehrt auch dauerhafte Uebernahmen und wird nirgends gelesen.)
    hero.statuses.charmed.zonenGeschuetzt = true;
  }

  engine.log('charm_control', {
    by: sourceName, player: gs.players[controllerPi]?.username,
    target: hero.name, targetOwner: ops.username,
  });
  engine.sync();
  return { ok: true };
}

/** Gegnerische Helden, die sich gerade uebernehmen lassen. */
function uebernehmbareHelden(gs, ownerPi) {
  const ops = gs.players[ownerPi];
  const raus = [];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0 || h.charmedBy != null) continue;
    raus.push({ heroIdx: hi, heroName: h.name });
  }
  return raus;
}

module.exports = { temporaereKontrolle, uebernehmbareHelden };

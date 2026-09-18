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
async function temporaereKontrolle(engine, {
  controllerPi,
  ownerPi,
  heroIdx,
  sourceName = 'Control',
  marker = null,              // '_loveShot' | 'onlyFromController' | null
  supportZonesLocked = false, // nur, wenn der Kartentext sie nennt
}) {
  const gs = engine.gs;
  const ops = gs.players[ownerPi];
  const hero = ops?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return { ok: false, grund: 'kein Ziel' };
  if (hero.charmedBy != null) return { ok: false, grund: 'bereits uebernommen' };

  // ① Erst-Zug-Schutz
  if (gs.firstTurnProtectedPlayer === ownerPi) {
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
  await engine.runHooks('beforeHeroEffect', effectCtx);
  if (effectCtx.cancelled) {
    engine.log('charm_blocked', { by: sourceName, target: hero.name });
    engine.sync();
    return { ok: false, grund: 'geblockt' };
  }

  // ③ Effekt-Immunitaet (Escape Device, Invisibility Cloak)
  if (engine.hasEffectImmunity?.(ownerPi, heroIdx, null)) {
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
  if (marker) hero.statuses.charmed[marker] = true;

  // ⑤ Support-Zonen nur auf Ansage
  if (supportZonesLocked) {
    if (!gs._charmedSupportLocked) gs._charmedSupportLocked = [];
    gs._charmedSupportLocked.push({ owner: ownerPi, heroIdx });
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

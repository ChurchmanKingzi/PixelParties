// ═══════════════════════════════════════════
//  SHARED: ZEITWEILIGE KONTROLLE ÜBER EIN ZIEL DES GEGNERS (W79: Tree of Golden Apples, Little Lyta)
//
//  „Take control of a target your opponent controls until the end of your turn" — Held ODER Kreatur, die Ziele BLEIBEN IN IHREN ZONEN (nur der Kontrolleur wechselt):
//    • Held: `temporaereKontrolle` (`_charm-shared.js`, die Rückgabe am Zugwechsel ist generisch). Schutz je Karte über den `marker` am `charmed`-Status:
//      null = „unaffected by ALL other cards and effects" (Tree), 'nurSchaden' = nur Schaden prallt ab (Lyta: „takes no damage from any sources").
//    • Kreatur: `actionStealCreatureGefragt` (Schutzfenster, Rückgabe zu Beginn des nächsten Zuges über `_revertStolenCreatures`), `omniImmune` für „unaffected by all …" (Tree).
//    • Boris, the Guardian of Blackport: „cannot activate effects that would take control of any targets you control" — der Effekt läuft ins Leere (`borisBlockt`).
// ═══════════════════════════════════════════

const { temporaereKontrolle } = require('./_charm-shared');

/** Sperrt ein wirksamer gegnerischer Boris jede Kontrollübernahme von `pi`? */
function borisBlockt(engine, pi) {
  return engine.isBorisBlocked({ takesControlOfTargets: true }, pi);
}

/** Lässt sich diese gegnerische Kreatur jetzt zeitweilig übernehmen (ohne Logzeilen der Vorprüfung)? */
function kreaturUebernehmbar(engine, pi, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.counters?._heldKreatur || inst.stolenBy != null) return false;
  if ((inst.controller ?? inst.owner) === pi) return false;
  if (engine.isOmniImmune(inst, pi, {}) || engine.controlIsLocked(inst)) return false;
  if (engine.uebernahmeUnzulaessig(inst, pi)) return false;
  return true;
}

/** Lässt sich dieser Held (Brettseite `owner`) jetzt zeitweilig übernehmen? */
function heldUebernehmbar(engine, pi, owner, heroIdx) {
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || hero.charmedBy != null) return false;
  return engine.heroSideOf(owner, hero) !== pi;
}

/**
 * Ziele für `promptEffectTarget`: Helden (`heroIdxs` = Einschränkung auf bestimmte Brettplätze { owner, heroIdx }, sonst alle des Gegners) und/oder Kreaturen,
 * die der Gegner von `pi` kontrolliert.
 */
function ziele(engine, pi, { helden = true, kreaturen = true, nurHeld = null } = {}) {
  const gegner = engine.opponentOf(pi);
  const out = [];
  if (helden) {
    for (const t of engine.getControlledHeroTargets(gegner)) {
      if (nurHeld && !(t.owner === nurHeld.owner && t.heroIdx === nurHeld.heroIdx)) continue;
      if (!heldUebernehmbar(engine, pi, t.owner, t.heroIdx)) continue;
      out.push(t);
    }
  }
  if (kreaturen) {
    for (const t of engine.getCreatureTargets(gegner)) {
      if (!kreaturUebernehmbar(engine, pi, t.cardInstance)) continue;
      out.push(t);
    }
  }
  return out;
}

/**
 * Das gewählte Ziel für den Rest des Zuges übernehmen.
 * @param {object} cfg  { sourceName, heroMarker: null|'nurSchaden', kreaturImmun: bool, anim: 'golden_apple_burst'|…, animMs, trefferMs }
 * @returns {Promise<{ok: boolean}>}
 */
async function uebernehmen(engine, pi, ziel, cfg) {
  const { sourceName, heroMarker = null, kreaturImmun = false, anim = null, animMs = 1200, trefferMs = 650 } = cfg;
  const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
  if (anim) {
    engine._broadcastEvent('play_zone_animation', { type: anim, owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot, duration: animMs });
    await engine._delay(trefferMs);
  }
  if (ziel.type === 'hero') {
    if (!heldUebernehmbar(engine, pi, ziel.owner, ziel.heroIdx)) return { ok: false };
    const erg = await temporaereKontrolle(engine, {
      controllerPi: pi, ownerPi: ziel.owner, heroIdx: ziel.heroIdx, sourceName,
      marker: heroMarker, supportZonesLocked: false,
    });
    return { ok: !!erg.ok };
  }
  const inst = ziel.cardInstance && engine.cardInstances.find(c => c.id === ziel.cardInstance.id);
  if (!inst || !kreaturUebernehmbar(engine, pi, inst)) return { ok: false };
  const ok = await engine.actionStealCreatureGefragt(pi, inst, {
    sourceName, sourceOwner: pi,
    ...(kreaturImmun ? { damageImmune: true, omniImmune: true } : {}),
  });
  return { ok: !!ok };
}

module.exports = { borisBlockt, kreaturUebernehmbar, heldUebernehmbar, ziele, uebernehmen };

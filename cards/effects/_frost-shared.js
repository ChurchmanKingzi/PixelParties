'use strict';
// ═══════════════════════════════════════════
//  GETEILT: Einfrieren (v1317)
//
//  Aus Iceage herausgeloest, damit Iceage, Cold-Hearted Yuki-Onna und
//  Heart of Ice DIESELBE Auslegung benutzen:
//    • `gegnerZiele(engine, oi)` — „all targets your opponent controls":
//      lebende Helden + Kreaturen (keine Ausruestung, keine Abilities).
//    • `einfrieren(engine, ziel, { dauer, appliedBy, source })` — Helden
//      ueber `addHeroStatus`, Kreaturen ueber `applyCreatureStatus`, beide
//      mit Urheber. Immunitaeten (freeze_immune, immune …) greifen dort.
//    • `frostVerlaengern(ziel, plus)` — „Frozen for N additional turns":
//      Helden `statuses.frozen.duration`, Kreaturen `counters.frozenDuration`
//      (fehlend = 1, wie im Abbau am Zugende).
//    • `eisblockAnimation(engine, oi, ziele)` — ALLE Ziele gleichzeitig
//      (Als Regel 22.9.), `ice_encase` samt Klang.
// ═══════════════════════════════════════════

function gegnerZiele(engine, oi) {
  const gs = engine.gs;
  const out = [];
  const helden = gs.players[oi]?.heroes || [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (h?.name && h.hp > 0) out.push({ type: 'hero', owner: oi, heroIdx: hi, name: h.name });
  }
  for (const inst of engine.cardInstances) {
    if (inst.owner !== oi || inst.zone !== 'support') continue;
    if (engine.isEquipInZone(inst.name, inst)) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || cd.cardType !== 'Creature') continue;
    out.push({ type: 'creature', owner: oi, inst, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, name: inst.name });
  }
  return out;
}

async function einfrieren(engine, ziel, { dauer = 1, appliedBy = -1, source = null } = {}) {
  const gs = engine.gs;
  if (ziel.type === 'hero') {
    const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!h?.name || h.hp <= 0) return false;
    await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'frozen', { duration: dauer, appliedBy, source });
    return !!h.statuses?.frozen;
  }
  if (!ziel.inst || ziel.inst.zone !== 'support') return false;
  const ok = await engine.applyCreatureStatus(ziel.inst, 'frozen', { sourceOwner: appliedBy, duration: dauer, source });
  return ok !== false && !!ziel.inst.counters?.frozen;
}

function istGefroren(engine, ziel) {
  if (ziel.type === 'hero') return !!engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx]?.statuses?.frozen;
  return !!(ziel.inst && ziel.inst.zone === 'support' && ziel.inst.counters?.frozen);
}

function frostVerlaengern(engine, ziel, plus) {
  if (ziel.type === 'hero') {
    const fr = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx]?.statuses?.frozen;
    if (!fr) return false;
    if (typeof fr === 'object') fr.duration = (fr.duration || 1) + plus;
    else engine.gs.players[ziel.owner].heroes[ziel.heroIdx].statuses.frozen = { duration: 1 + plus };
    return true;
  }
  const c = ziel.inst?.counters;
  if (!c?.frozen) return false;
  c.frozenDuration = (c.frozenDuration || 1) + plus;
  return true;
}

function eisblockAnimation(engine, ziele) {
  for (const z of ziele) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'ice_encase', owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : z.slotIdx,
    });
  }
}

module.exports = { gegnerZiele, einfrieren, istGefroren, frostVerlaengern, eisblockAnimation };

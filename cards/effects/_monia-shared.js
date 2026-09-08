// ═══════════════════════════════════════════
//  Shared helpers for the Monia family (v668).
//
//  Aufstieg „Cool Rescuer Monia" → „Monia Bot, the Foretold Rescuer of
//  Coolness": sie muss „Cool Tech Jetpack" tragen. Die Bereitschaft
//  pflegt der Basisheld ueber den sync-getriebenen Vertrag
//  `refreshAscensionReadiness` (Dajan-Muster) — das Jetpack kommt fast
//  nie ueber den normalen Spielweg (es wirft sich sofort ab), sondern
//  ueber Cool Repair, das seine eigenen Zonen-Hooks feuert; ein
//  sync-Refresh deckt alle Wege. Die Bedingung steht nur hier.
// ═══════════════════════════════════════════

const BASE_MONIA    = 'Cool Rescuer Monia';
const ASCEND_TARGET = 'Monia Bot, the Foretold Rescuer of Coolness';
const JETPACK_NAME  = 'Cool Tech Jetpack';

function findBaseMonia(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_MONIA) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_MONIA) { hero = h; actualOwner = p; break; }
    }
  }
  return hero ? { hero, actualOwner } : null;
}

/** Nach EFFEKTIVER Identitaet (Copy Device legt fremde Namen als Override). */
function hasEquipped(engine, owner, heroIdx, name, excludeInstId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeInstId && c.owner === owner && c.zone === 'support'
    && c.heroIdx === heroIdx && (c.counters?._effectOverride || c.name) === name);
}

function moniaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return hasEquipped(engine, found.actualOwner, heroIdx, JETPACK_NAME, excludeInstId);
}

function checkMoniaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (moniaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    if (hero.ascensionReady && hero.ascensionTarget === ASCEND_TARGET) return;
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else if (hero.ascensionReady) {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = { BASE_MONIA, ASCEND_TARGET, JETPACK_NAME, hasEquipped, moniaAscensionMet, checkMoniaAscension };

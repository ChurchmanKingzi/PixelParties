// ═══════════════════════════════════════════
//  Shared helpers for the Riffel family (v661).
//
//  Aufstieg „Future Tech Gunslinger Riffel" → „Riffel, Master of the
//  Ultimate Gun": sie muss „Ancient Tech Infinite Energy Core" UND
//  „Future Tech Gun" tragen. Fiona-Muster: der Basisheld pflegt die
//  Bereitschaft ueber Enter/Leave seiner eigenen Support Zones, die
//  beiden Equip-Skripte bleiben unberuehrt. Die Bedingung steht nur
//  hier; die Ascended-Karte fragt sie ueber `ascensionCondition` ab.
// ═══════════════════════════════════════════

const BASE_RIFFEL   = 'Future Tech Gunslinger Riffel';
const ASCEND_TARGET = 'Riffel, Master of the Ultimate Gun';
const CORE_NAME     = 'Ancient Tech Infinite Energy Core';
const GUN_NAME      = 'Future Tech Gun';
const ASCENSION_ITEMS = [CORE_NAME, GUN_NAME];

function findBaseRiffel(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_RIFFEL) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_RIFFEL) { hero = h; actualOwner = p; break; }
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

function riffelAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseRiffel(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return ASCENSION_ITEMS.every(n => hasEquipped(engine, found.actualOwner, heroIdx, n, excludeInstId));
}

function checkRiffelAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseRiffel(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (riffelAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = {
  BASE_RIFFEL, ASCEND_TARGET, CORE_NAME, GUN_NAME, ASCENSION_ITEMS,
  hasEquipped, riffelAscensionMet, checkRiffelAscension,
};

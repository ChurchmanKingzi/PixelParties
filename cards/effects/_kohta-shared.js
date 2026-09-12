// ═══════════════════════════════════════════
//  Gemeinsame Helfer der Kohta-Familie (v910).
//
//  Aufstieg „Kohta, the Silent Observer" → „Kohta, Master of
//  Super-Killing": er muss „Super-Killing Knife, the Tool of
//  Liquidation" UND „Summoning Instructions" tragen. Riffel-Muster
//  (v661): der BASISHELD pflegt die Bereitschaft ueber Enter/Leave
//  seiner eigenen Support Zones, die beiden Equip-Skripte bleiben
//  unberuehrt. Die Bedingung steht nur hier; die Ascended-Karte fragt
//  sie ueber `ascensionCondition` ab.
// ═══════════════════════════════════════════

const BASE_KOHTA    = 'Kohta, the Silent Observer';
const ASCEND_TARGET = 'Kohta, Master of Super-Killing';
const KNIFE_NAME    = 'Super-Killing Knife, the Tool of Liquidation';
const INSTRUCTIONS  = 'Summoning Instructions';
const ASCENSION_ITEMS = [KNIFE_NAME, INSTRUCTIONS];

function findBaseKohta(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_KOHTA) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_KOHTA) { hero = h; actualOwner = p; break; }
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

function kohtaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseKohta(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return ASCENSION_ITEMS.every(n => hasEquipped(engine, found.actualOwner, heroIdx, n, excludeInstId));
}

function checkKohtaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseKohta(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (kohtaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
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
  BASE_KOHTA, ASCEND_TARGET, KNIFE_NAME, INSTRUCTIONS, ASCENSION_ITEMS,
  hasEquipped, kohtaAscensionMet, checkKohtaAscension,
};

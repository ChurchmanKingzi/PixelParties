// ═══════════════════════════════════════════
//  Shared helpers for the Molinda family (v664).
//
//  Aufstieg „Cute Angel Molinda" → „Molinda, the Cutest Being in the
//  Sky": sie muss „Heart-Shaped Bow, the Final Proof of Cuteness"
//  tragen UND selbst mindestens 2 Love Shots gecastet haben (v667).
//  Weil der Zaehler an keiner Zone haengt, pflegt der Basisheld die
//  Bereitschaft ueber den sync-getriebenen Vertrag
//  `refreshAscensionReadiness` (Dajan-Muster). Die Bedingung steht nur
//  hier, die Ascended-Karte fragt sie ueber `ascensionCondition` ab.
// ═══════════════════════════════════════════

const BASE_MOLINDA  = 'Cute Angel Molinda';
const ASCEND_TARGET = 'Molinda, the Cutest Being in the Sky';
const BOW_NAME      = 'Heart-Shaped Bow, the Final Proof of Cuteness';
const LOVE_SHOT     = 'Love Shot';
const LOVE_SHOTS_NEEDED = 2;

/**
 * v667 (Al 30.8.): „has used at least 2 'Love Shot' Spells so far this
 * game" — gezaehlt werden nur Love Shots, die DIESE Molinda selbst
 * gecastet hat (Zaehler `hero._loveShotsCast` am Heldenobjekt, nie
 * zurueckgesetzt; ein negierter Cast zaehlt nicht — er erreicht
 * afterSpellResolved nicht).
 */
function loveShotsCast(hero) {
  return hero?._loveShotsCast || 0;
}

function findBaseMolinda(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_MOLINDA) {
    hero = null;
    for (let p = 0; p < 2; p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_MOLINDA) { hero = h; actualOwner = p; break; }
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

function molindaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMolinda(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  if (loveShotsCast(found.hero) < LOVE_SHOTS_NEEDED) return false;
  return hasEquipped(engine, found.actualOwner, heroIdx, BOW_NAME, excludeInstId);
}

function checkMolindaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMolinda(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (molindaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

module.exports = { BASE_MOLINDA, ASCEND_TARGET, BOW_NAME, LOVE_SHOT, LOVE_SHOTS_NEEDED, hasEquipped, loveShotsCast, molindaAscensionMet, checkMolindaAscension };

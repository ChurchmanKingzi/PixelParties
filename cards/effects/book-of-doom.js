// ═══════════════════════════════════════════
//  CARD EFFECT: "Book of Doom"
//  Artifact — Choose up to N opponent targets
//  (where N = floor(your Gold / card cost)).
//  Total cost = card cost × number of targets.
//  All targets take 50 damage simultaneously.
//  Hard once per turn.
// ═══════════════════════════════════════════

const CARD_NAME = 'Book of Doom';
const DAMAGE_PER_TARGET = 50;

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `book-of-doom:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Gold check is handled by the server (checks cardData.cost before calling canActivate)
    return true;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    const oppIdx = pi === 0 ? 1 : 0;
    // Both sides — the player can target any hero or creature on the board
    const ownHeroes = engine.getHeroTargets(pi);
    const ownCreatures = engine.getCreatureTargets(pi);
    const oppHeroes = engine.getHeroTargets(oppIdx);
    const oppCreatures = engine.getCreatureTargets(oppIdx);
    return [...ownHeroes, ...ownCreatures, ...oppHeroes, ...oppCreatures];
  },

  targetingConfig(gs, pi, cost, engine) {
    const ps = gs.players[pi];
    // Budget statt rohem Kontostand (Als Report 16.8.): mit Kent
    // stehen 20 Gold mehr zur Verfuegung, und der Ziel-Waehler muss das
    // wissen — sonst bietet er zu wenige Ziele an. `engine` liegt hier
    // als 5. Parameter an; aeltere Aufrufer ohne ihn fallen sauber auf
    // den Kontostand zurueck.
    const budget = engine?.goldBudget ? engine.goldBudget(pi, CARD_NAME) : (ps.gold || 0);
    const maxTargets = cost > 0
      ? (budget === Infinity ? 99 : Math.floor(budget / cost))
      : 99;
    return {
      description: `Select up to ${maxTargets} target${maxTargets !== 1 ? 's' : ''} to deal ${DAMAGE_PER_TARGET} damage each.`,
      confirmLabel: '📖 Unleash!',
      confirmClass: 'btn-danger',
      cancellable: true,
      dynamicCostPerTarget: cost,
      exclusiveTypes: false,
      maxPerType: { hero: 99, equip: 99 },
      maxTotal: maxTargets,
      // Per-target damage hint — read by the CPU's `inferDamage` so
      // the simulate-and-score targeting branch correctly evaluates
      // each candidate at 50 dmg. Without this the CPU treats Book
      // of Doom as 0-damage and skips the eval-delta path entirely.
      baseDamage: DAMAGE_PER_TARGET,
    };
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length > 0;
  },

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };

    const baseCost = engine._getCardDB()[CARD_NAME]?.cost || 1;
    const totalCost = baseCost * selectedIds.length;
    const ps = engine.gs.players[pi];

    // Bezahlbarkeit inkl. Kreditrahmen — sonst blockiert diese Zeile
    // genau den Zug, den der Ziel-Waehler oben schon erlaubt hat.
    if (!engine.canAffordGold(pi, totalCost, CARD_NAME)) return;

    // Claim HOPT
    if (!engine.claimHOPT('book-of-doom', pi)) return;

    // Deduct gold
    await engine._payCardCost(pi, totalCost);
    engine.log('gold_spend', { player: ps.username, amount: totalCost, total: ps.gold });

    // Map selected IDs to targets
    const targets = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (targets.length === 0) return;

    // ★ v1392: Schaden über die EINE Stelle für Mehrfachtreffer
    // (`engine.dealDamageToTargets`). Bis v1391 baute Book of Doom
    // Post-Target-Reaktionen, Interference-Klammer, Heldentreffer mit
    // Attrappen-Quelle und den Kreatur-Stapel selbst — und das Idol-
    // Fenster (Deepsea Idol) sowie die Brett-Wächter (Puppets) fehlten
    // ganz. Jetzt sieht jede Anti-AoE-Karte Book wie jede andere
    // Flächenquelle, sobald 2+ Ziele gewählt sind. Surprise-Fenster wie
    // bisher aus (Book ist ein Artifact, kein Attack/Spell).
    await engine.dealDamageToTargets(
      { name: CARD_NAME, owner: pi, heroIdx: -1 },
      targets.map(t => t.type === 'hero'
        ? { type: 'hero', owner: t.owner, heroIdx: t.heroIdx }
        : { type: 'creature', inst: t.cardInstance, owner: t.owner, heroIdx: t.heroIdx, slotIdx: t.slotIdx }),
      {
        damage: DAMAGE_PER_TARGET, damageType: 'other', sourceName: CARD_NAME,
        animationType: 'explosion', animDelay: 400, hitDelay: 0,
        surpriseCheck: false, attrappenQuelle: true,
      },
    );

    engine.sync();
    await engine._delay(400);
  },
};

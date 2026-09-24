// ═══════════════════════════════════════════
//  CARD EFFECT: "Bottled Lightning"
//  Potion — Alternating discard chain.
//  The player who "takes it" must choose 3
//  targets they control. 150/100/50 chain
//  lightning damage.
// ═══════════════════════════════════════════

const { kettenblitz } = require('./_kettenblitz-shared');   // v1333
const { runDiscardChain } = require('./_bottled-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,
  // Same reasoning as Bottled Flame — the discard chain forces ONE side to
  // take damage on its own targets. Turn 1 either fizzles on the shielded
  // opponent or wastes 300 damage on our own heroes.
  firstTurnSafe: false,

  async resolve(engine, pi) {
    const gs = engine.gs;
    const cardDB = engine._getCardDB();
    const damages = [150, 100, 50];

    const takerIdx = await runDiscardChain(engine, pi, 'Bottled Lightning');
    // null = die Abwurfkette wurde negiert (Ambush the Scout). Bei
    // diesem Trank IST die Kette der Effekt, also ist die ganze Karte
    // negiert — kein Schaden, kein Status (Als Ruling 5.8.).
    if (takerIdx == null) return;
    const takerPs = gs.players[takerIdx];

    engine.log('bottled_take', { player: takerPs.username, potion: 'Bottled Lightning' });

    // Build all targets the taker controls
    const targets = [];
    for (let hi = 0; hi < (takerPs.heroes || []).length; hi++) {
      const hero = takerPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({ id: `hero-${takerIdx}-${hi}`, type: 'hero', owner: takerIdx, heroIdx: hi, cardName: hero.name });
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== takerIdx || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({ id: `equip-${takerIdx}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: takerIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
    }
    if (targets.length === 0) return true;

    const selectedTargets = await engine.promptChainTargets(takerIdx, targets, damages, {
      title: 'Bottled Lightning',
    });
    if (selectedTargets.length === 0) return true;

    // Pre-damage post-target hand-reaction window — one consolidated
    // prompt per source for Sculpture Guards / Spectral Armor / etc.
    await engine.preDamageMultiTargetWindow(
      { name: 'Bottled Lightning', owner: pi, heroIdx: -1 },
      selectedTargets,
    );

    // ★ v1333: Trefferschleife im geteilten Modul (`_kettenblitz-shared`)
    // — Flaechenklammer (v1185), jeder Blitz gilt als Wahl seines Ziels.
    // Der erste Blitz entsteht am ersten Ziel selbst (kein Wirker).
    await kettenblitz(engine, {
      quelle: { name: 'Bottled Lightning', owner: pi }, zone: 'hand',
      ziele: selectedTargets, alleZiele: targets, schaden: damages, typ: 'potion',
    });

    return true;
  },
};

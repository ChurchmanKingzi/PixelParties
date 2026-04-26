// ═══════════════════════════════════════════
//  CARD EFFECT: "Bottled Lightning"
//  Potion — Alternating discard chain.
//  The player who "takes it" must choose 3
//  targets they control. 150/100/50 chain
//  lightning damage.
// ═══════════════════════════════════════════

const { runDiscardChain } = require('./_bottled-shared');

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
      const cd = cardDB[inst.name];
      if (!cd || cd.cardType !== 'Creature') continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({ id: `equip-${takerIdx}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: takerIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
    }
    if (targets.length === 0) return true;

    const selectedTargets = await engine.promptChainTargets(takerIdx, targets, damages, {
      title: 'Bottled Lightning',
    });
    if (selectedTargets.length === 0) return true;

    // Chain lightning animation + damage
    let prevOwner = selectedTargets[0].owner;
    let prevHeroIdx = selectedTargets[0].heroIdx;
    let prevZoneSlot = selectedTargets[0].type === 'hero' ? -1 : selectedTargets[0].slotIdx;

    for (let step = 0; step < selectedTargets.length; step++) {
      const tgt = selectedTargets[step];
      const dmg = damages[step];
      const tgtZoneSlot = tgt.type === 'hero' ? -1 : tgt.slotIdx;

      if (step > 0) {
        engine._broadcastEvent('qinglong_lightning', {
          srcOwner: prevOwner, srcHeroIdx: prevHeroIdx, srcZoneSlot: prevZoneSlot,
          tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step,
        });
      } else {
        engine._broadcastEvent('qinglong_lightning', {
          srcOwner: tgt.owner, srcHeroIdx: tgt.heroIdx, srcZoneSlot: tgtZoneSlot,
          tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step: 0,
        });
      }
      await engine._delay(400);

      if (tgt.type === 'hero') {
        const hero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (hero && hero.hp > 0) {
          await engine.actionDealDamage({ name: 'Bottled Lightning', owner: pi }, hero, dmg, 'normal');
        }
      } else if (tgt.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: 'Bottled Lightning', owner: pi },
          tgt.cardInstance, dmg, 'normal',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
      await engine._delay(10);

      prevOwner = tgt.owner;
      prevHeroIdx = tgt.heroIdx;
      prevZoneSlot = tgtZoneSlot;
    }

    return true;
  },
};

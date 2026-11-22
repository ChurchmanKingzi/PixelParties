// ═══════════════════════════════════════════
//  CARD EFFECT: "Healing Potion"
//  Potion (Normal) — Choose any target (either
//  player's) and heal it for HEAL_AMOUNT HP.
//
//  ★ Spielgestalter-Entscheidung 17.11.2026: der Trank ist
//  IMMER spielbar (sofern es ueberhaupt ein legales Ziel gibt)
//  und waehlt auch Ziele mit vollen HP an — der Picker warnt
//  nur („will have no effect", Warnungsprinzip).
//  ★ Warntext-UX (Spielgestalter-Entscheidung 17.11.2026): der
//  Hinweis haengt NICHT mehr an der Beschreibung der Zielwahl,
//  sondern am einzelnen Ziel (`hinweis`/`hinweisArt`); der Client
//  zeigt ihn nur, solange dieses Ziel angewaehlt und noch nicht
//  bestaetigt ist. Volle HP: Warnung („will have no effect").
//  Helden mit Overheal Shock (Heilung wird zu Schaden) tragen
//  diese Warnung NICHT, die Aktion hat Wirkung: Info „healing
//  will deal 250 damage". Die CPU sieht weiter nur Ziele mit
//  HP-Defizit (`cpuSicht`): sie verbrennt den Trank nicht auf
//  volle Ziele.
//
//  Animation: red/green hearts and pluses rising
//  from the healed target.
//
//  ★ v1065 (Als Balanceaenderung 14.9.): 200 → 250.
//  Der Wert stand an VIER Stellen als Literal —
//  Beschreibung, Helden-Heilung, Kreaturen-Heilung
//  und Log. Jetzt EINE Konstante, damit die
//  naechste Anpassung nicht drei Stellen vergisst
//  und der angezeigte Text vom echten Wert
//  abweicht.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const HEAL_AMOUNT = 250;

/**
 * CPU-Sicht (Spielgestalter-Entscheidung 17.11.2026: „nutzlose" Aktivierungen darf der Mensch, die CPU waehlt sie nicht):
 * CPU und ihre Rollouts behalten die alte Regel (nur Ziele mit HP-Defizit, sonst unspielbar).
 */
function cpuSicht(engine, pi) {
  return !!engine && !!(engine._inMctsSim || engine._fastMode || (typeof engine.isCpuPlayer === 'function' && engine.isCpuPlayer(pi)));
}

module.exports = {
  isPotion: true,
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    // Mensch: spielbar, sobald es ueberhaupt ein Ziel gibt (volle HP sind kein Grund mehr, den Trank zu sperren)
    if (!cpuSicht(engine, pi)) return module.exports.getValidTargets(gs, pi, engine).length > 0;
    // CPU: Need at least one target with HP < maxHP on either side
    for (let p = 0; p < gs.players.length; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (hero?.name && hero.hp > 0 && hero.hp < hero.maxHp) return true;
      }
    }
    // Check creatures too
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
        const curHp = inst.counters?.currentHp ?? maxHp;
        if (curHp > 0 && curHp < maxHp) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const targets = [];
    const cardDB = engine ? engine._getCardDB() : {};

    // Mensch: auch volle Ziele (Warnung im Picker); CPU: nur Ziele mit HP-Defizit (s. `cpuSicht`)
    const nurDefizit = cpuSicht(engine, pi);
    // Heroes from BOTH sides (CPU: with HP < maxHP)
    for (let p = 0; p < gs.players.length; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (nurDefizit && hero.hp >= hero.maxHp) continue;
        const t = {
          id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi, cardName: hero.name,
        };
        if (engine?.setzeZielHinweis) {
          // Overheal Shock: die Heilung trifft als Schaden (`healReversed` → `actionHealHero`) — eine Information, keine Warnung vor Nutzlosigkeit.
          if (hero.statuses?.healReversed) engine.setzeZielHinweis(t, `Overheal Shock: healing will deal ${HEAL_AMOUNT} damage to ${hero.name}.`, 'info');
          else if (hero.hp >= hero.maxHp) engine.setzeZielHinweis(t, `${hero.name} is at full HP, so healing will have no effect.`, 'warnung');
        }
        targets.push(t);
      }
    }

    // Creatures from BOTH sides (CPU: with HP < maxHP) — auch die Kreaturen gefallener Helden (bleiben auf dem Brett)
    if (engine) {
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
        const curHp = inst.counters?.currentHp ?? maxHp;
        if (curHp <= 0 || (nurDefizit && curHp >= maxHp)) continue;
        const t = {
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
        };
        if (curHp >= maxHp && engine?.setzeZielHinweis) engine.setzeZielHinweis(t, `${inst.name} is at full HP, so healing will have no effect.`, 'warnung');
        targets.push(t);
      }
    }

    return targets;
  },

  // Die Hinweise zu vollen Zielen und Overheal Shock stehen an den Zielen (`getValidTargets`), nicht im Beschreibungstext.
  targetingConfig() {
    return {
      description: `Choose a target to heal for ${HEAL_AMOUNT} HP.`,
      confirmLabel: '💚 Heal!',
      confirmClass: 'btn-success',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    };
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'healing_hearts',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const gs = engine.gs;

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;

      // Play healing animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'healing_hearts', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.actionHealHero(
        { name: 'Healing Potion', owner: pi },
        hero, HEAL_AMOUNT
      );
    } else if (target.type === 'equip' && target.cardInstance) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'healing_hearts', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
      });
      await engine._delay(400);

      await engine.actionHealCreature(
        { name: 'Healing Potion', owner: pi },
        target.cardInstance, HEAL_AMOUNT
      );
    }

    engine.log('healing_potion', {
      player: gs.players[pi].username,
      target: target.cardName,
      amount: HEAL_AMOUNT,
    });

    engine.sync();
    return true;
  },
};

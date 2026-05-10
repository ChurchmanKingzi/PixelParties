// ═══════════════════════════════════════════
//  HERO EFFECT: "Styx, the Gate to the Spirit World"
//
//  Whenever ANOTHER Hero is defeated (regardless
//  of which player controlled it), Styx's
//  controller may permanently increase Styx's
//  current AND max HP by 100 each. "May" is a
//  per-trigger choice — declines don't burn any
//  per-turn slot, and a future death will
//  re-prompt.
//
//  Wiring:
//   • `onHeroKO` hook fires per Styx instance for
//     every hero KO.
//   • Self-protection: skip when the dying hero
//     IS Styx — "another" excludes himself.
//   • Alive gate: a KO'd Styx can't grow further;
//     skip when his hp ≤ 0 already.
//   • `engine.increaseMaxHp(hero, 100)` defaults
//     to `alsoHealCurrent: true`, so a single
//     call covers both clauses ("current and max
//     HP by 100 each"). Permanent because the
//     mutation is on `hero.maxHp` / `hero.hp`
//     directly, not via a per-turn buff.
// ═══════════════════════════════════════════

const CARD_NAME = 'Styx, the Gate to the Spirit World';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ourPi = ctx.cardOwner;
      const ourHi = ctx.cardHeroIdx;
      const ourHero = gs.players[ourPi]?.heroes?.[ourHi];
      // A KO'd Styx can't absorb — the trigger only fires while he's
      // still standing. If he himself is the one dying, the
      // "another" gate below catches it; this guard is for chained
      // deaths where Styx was already dropped earlier in the chain.
      if (!ourHero?.name || ourHero.hp <= 0) return;

      const dyingHero = ctx.hero;
      if (!dyingHero?.name) return;

      // Resolve the dying hero's slot so we can self-exclude. The
      // hook payload doesn't carry owner/heroIdx for the KO target,
      // so we walk both player rosters by reference identity. Mirror
      // of the lookup Cannibalism does for the same reason.
      let deadOwner = -1, deadHeroIdx = -1;
      for (let p = 0; p < 2; p++) {
        const heroes = gs.players[p]?.heroes || [];
        for (let h = 0; h < heroes.length; h++) {
          if (heroes[h] === dyingHero) {
            deadOwner = p; deadHeroIdx = h;
            break;
          }
        }
        if (deadOwner >= 0) break;
      }
      if (deadOwner < 0) return;
      // "Another Hero" — never trigger off Styx's own death.
      if (deadOwner === ourPi && deadHeroIdx === ourHi) return;

      const confirmed = await engine.promptGeneric(ourPi, {
        type: 'confirm',
        title: `${CARD_NAME}`,
        message: `${dyingHero.name} has been defeated. Permanently increase ${ourHero.name}'s current and max HP by 100?`,
        showCard: CARD_NAME,
        confirmLabel: '👻 Absorb',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Soul-absorb visual on Styx's hero zone. `heal_sparkle` is the
      // standard "gained HP" zone animation used elsewhere; the
      // vertical ribbon reads as the spirit ascending into the gate.
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: ourPi, heroIdx: ourHi, zoneSlot: -1,
      });
      await engine._delay(300);

      // `alsoHealCurrent` defaults to true — a single call adds 100
      // to both current AND max HP, exactly matching "current and max
      // HP by 100 each".
      engine.increaseMaxHp(ourHero, 100);

      engine.log('styx_absorb', {
        player: gs.players[ourPi]?.username,
        hero: ourHero.name,
        absorbed: dyingHero.name,
        newMax: ourHero.maxHp,
      });
      engine.sync();
    },
  },
};

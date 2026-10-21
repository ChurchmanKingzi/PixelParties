// ═══════════════════════════════════════════
//  CARD EFFECT: "Sacred Hammer of the Volcano"
//  Artifact (Equipment, 4 Gold)
//  Grants +30 ATK to the equipped Hero.
//  When the Hero hits a Burned target with an
//  Attack, additionally increase that Attack's
//  damage by the Hero's ATK (W16e F02-03: aktuelle Attack stat —
//  Text: „the attacker's Attack stat", nicht „base").
//  Uses generic grantAtk/revokeAtk system.
// ═══════════════════════════════════════════

const ATK_BONUS = 30;

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * On equip: grant +30 ATK to the hero.
     */
    onPlay: async (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    /**
     * On game start: apply ATK bonus for pre-equipped hammers (Bill, etc.).
     */
    onGameStart: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero || !hero.name) return;
      // Only apply if not already granted (avoids double-grant if onPlay also fired)
      if (ctx.card.counters.atkGranted > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    /**
     * On removal: revoke the granted ATK.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if ((ctx.fromOwner !== ctx.cardOwner && ctx.fromOwner !== ctx.cardHeroOwner) || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;   // Styx 28.9.: Brettseite
      ctx.revokeAtk();
    },

    /**
     * Before damage: if this hero is attacking a Burned target,
     * add the hero's current Attack stat to the damage
     * (Text: „the attacker's Attack stat" — Buffs/Ausruestung zaehlen,
     * W16e F02-03; andere Karten sagen ausdruecklich „base Attack stat").
     */
    beforeDamage: (ctx) => {
      // Only applies to attack-type damage
      if (ctx.type !== 'attack') return;

      // Source must be this hero
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Styx 28.9.: „dieser Held" = Brettseite + Index (geliehener Held).
      if (!ctx._engine.quelleIstHeld(ctx.source, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx)) return;

      // Target must be burned
      const target = ctx.target;
      if (!target) return;
      const isBurned = target.statuses?.burned || target.counters?.burned;
      if (!isBurned) return;

      // Add the hero's current Attack stat to the damage
      const hero = ctx.attachedHero;
      if (!hero) return;
      const atk = hero.atk || 0;
      if (atk <= 0) return;

      ctx.modifyAmount(atk);
      ctx._engine.log('sacred_hammer_bonus', {
        hero: hero.name, baseAtk: atk, target: target.name || 'target',
      });
    },

    // ★ W39a (Al, 22.10.2026: alle Attack-Leser): „hits a Burned target with an Attack" gilt auch für eine brennende KREATUR als Ziel (bisher nur der Heldenpfad `beforeDamage`).
    beforeCreatureDamageBatch: (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      const atk = hero.atk || 0;
      if (atk <= 0) return;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled || e.isStatusDamage || e.type !== 'attack') continue;
        if (e.source?.heroIdx !== ctx.cardHeroIdx) continue;
        if (!ctx._engine.quelleIstHeld(e.source, ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx)) continue;
        if (!e.inst?.counters?.burned) continue;
        e.modifyAmount(atk);
        ctx._engine.log('sacred_hammer_bonus', { hero: hero.name, baseAtk: atk, target: e.inst.name });
      }
    },
  },
};

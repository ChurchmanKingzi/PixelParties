// ═══════════════════════════════════════════
//  CARD EFFECT: "Fireball"
//  Spell (Normal, Lv2, Destruction Magic)
//
//  Choose up to 2 targets your opponent controls
//  (Heroes and/or Creatures) and deal 150 damage
//  to each.
//
//  Animation: one big fireball per selected target
//  flies out from the casting Hero and explodes
//  into flames on impact.
//
//  `ctx.promptMultiTarget` (baseDamage:150 → the
//  damage-targeting signal) runs the surprise +
//  post-target reaction windows itself, so the
//  per-target damage below skips its own reaction
//  check (one consolidated window per cast — same
//  rationale as Laser Volley).
// ═══════════════════════════════════════════

const CARD_NAME = 'Fireball';
const FIREBALL_DAMAGE = 150;

module.exports = {
  // ★★ v1179 — ENTKOPPELTE ZAUBERBILDER: ein Feuerball je Ziel vom
  // Wirker, dann die Flammenexplosion. Rein visuell — kein Zustand.
  spellVisual: {
    projectile: {
      emoji: '🔥',
      // Das Emoji zeigt von Natur aus nach OBEN; `baseAngle: 90` dreht
      // es in die Flugrichtung.
      baseAngle: 90,
      emojiStyle: { fontSize: 44 },
      duration: 520,
    },
    stagger: 130,
    flightMs: 300,
    impact: { type: 'flame_explosion' },
    impactMs: 220,
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const srcHeroIdx = ctx.cardHeroIdx;

      // Up to 2 targets the opponent controls — Heroes and/or
      // Creatures. promptMultiTarget handles the targeting UI plus the
      // surprise + post-target reaction windows (baseDamage:150 makes
      // the damage-mitigation reactions eligible).
      // When performed via a forced effect (Chaorc Friendly Fireballer
      // sacrifices a Creature → "the Fireball MUST be used"), there's no
      // opt-out: the targeting can't be cancelled, so the player must
      // pick a target and fire. promptMultiTarget already enforces a
      // minimum of 1 target, so removing the cancel button is enough.
      const forced = !!ctx._forcePerform;
      const targets = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'enemy',
        max: 2,
        baseDamage: FIREBALL_DAMAGE,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `Choose up to 2 targets your opponent controls — deal ${FIREBALL_DAMAGE} damage to each.`,
        confirmLabel: `🔥 Fireball! (${FIREBALL_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: !forced,
      });

      // [] = cancelled or fully negated (promptMultiTarget already set
      // gs._spellCancelled / gs._spellNegatedByEffect as appropriate).
      if (!targets || targets.length === 0) return;

      const source = { name: CARD_NAME, owner: pi, heroIdx: srcHeroIdx, controller: pi };

      // ── One big fireball per target, flying from the caster ──
      // Staggered so two fireballs read as a quick volley, then we
      // wait out the trailing flight so the impact flames + damage
      // numbers land together with the projectiles.
      // ★★ v1179: Die Bilder liegen jetzt in `spellVisual` (unten) — die
      // Engine spielt sie hier UND wenn eine Reaktion den Zauber
      // abfaengt („MOE Shield"), wo der Effekt selbst nie laeuft.
      await engine.spielZauberBilder(CARD_NAME, {
        owner: pi, heroIdx: srcHeroIdx, zoneSlot: ctx.card?.zoneSlot,
        targets,
      });

      // ── Impact: flame explosion + 150 damage per target ──
      // Reaction/surprise windows already ran inside promptMultiTarget,
      // so skip them here (no nested counter windows per target).
      // ★★ v1184 (Als Befund 17.9.: „Deepsea Idol triggert nicht"):
      // Kreaturtreffer laufen jetzt in EINEM Batch, wie bei „Aquatic
      // Arrows" & Co. Der Einzelweg `actionDealCreatureDamage` verpackt
      // jeden Treffer in einen eigenen Batch mit genau EINEM Eintrag —
      // das Fenster fuer „2+ eigene Kreaturen aus einer Quelle"
      // (Deepsea Idol) ging deshalb nie auf. Helden bleiben beim
      // Einzelweg; sie haben ihre eigenen Fenster.
      //
      // ★★ v1185: Erst SAMMELN, dann klammern, dann schlagen. Die
      // Flaechenklammer (`beginMultiHit`, „Interference") fehlte hier
      // ganz — sie braucht die echte Zielzahl, und die steht erst nach
      // dem Sammeln fest. Das Anti-AoE-Fenster (Deepsea Idol) oeffnet
      // der Batch weiter selbst, weil alle Kreaturen in EINEM Aufruf
      // liegen; hier genuegt deshalb die reine Interference-Klammer.
      const heldenZiele = [];
      const kreaturZiele = [];
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!hero || hero.hp <= 0) continue;
          heldenZiele.push({ t, hero });
        } else {
          const inst = t.cardInstance
            || engine.cardInstances.find(c =>
              (c.owner === t.owner || c.controller === t.owner)
              && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
          if (!inst) continue;
          kreaturZiele.push(inst);
        }
      }

      engine.beginMultiHit(heldenZiele.length + kreaturZiele.length);
      try {
      for (const { t, hero } of heldenZiele) {
        if (!hero || hero.hp <= 0) continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1,
        });
        await engine.actionDealDamage(source, hero, FIREBALL_DAMAGE, 'destruction_spell', {
          _skipReactionCheck: true,
        });
      }

      if (kreaturZiele.length > 0) {
        // `animType` am Eintrag statt eigener Broadcasts — derselbe Weg
        // wie bei Aquatic Arrows; der Batch spielt die Bilder selbst.
        await engine.processCreatureDamageBatch(kreaturZiele.map(inst => ({
          inst, amount: FIREBALL_DAMAGE, type: 'destruction_spell',
          source, sourceOwner: pi, animType: 'flame_strike',
          _skipReactionCheck: true,
        })));
      }
      } finally {
        engine.endMultiHit();
      }

      engine.log('fireball', {
        player: ps.username,
        targets: targets.map(t => t.cardName),
        damage: FIREBALL_DAMAGE,
      });
      engine.sync();
    },
  },
};

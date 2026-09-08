// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Angel"
//  Spell (Support Magic Lv3, Attachment)
//
//  Once per game. Attach to ANY Hero (friend
//  or foe). When the equipped Hero would die,
//  set HP to 1, play angel animation, then
//  fully heal to max HP. Delete Guardian Angel.
//
//  If the Hero has Overheal Shock, the full
//  heal converts to damage and kills the hero.
// ═══════════════════════════════════════════

const { candidateHosts, attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const CARD_NAME = 'Guardian Angel';

module.exports = {
  activeIn: ['hand', 'support'],
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  oncePerGame: true,
  oncePerGameKey: 'guardianAngel',

  // CPU target override. Guardian Angel's effect text contains "heal"
  // which makes the generic target picker classify it as a heal spell —
  // and heal spells prefer enemy heroes with Overheal Shock attached
  // (healing them converts to damage for a kill). But Guardian Angel
  // is a DEFENSIVE attachment: it revives the equipped hero once. An
  // OHS-on-enemy plan doesn't apply. Force the pick to an OWN hero,
  // preferring the highest-max-HP living hero (biggest effective revive).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    const targets = promptData?.validTargets || [];
    const ownHeroes = targets.filter(t => t.type === 'hero' && t.owner === cpuIdx);
    if (ownHeroes.length === 0) return undefined; // no own hero available → defer to default
    const maxHpOf = (t) => {
      const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      return h?.maxHp || 0;
    };
    const sorted = [...ownHeroes].sort((a, b) => maxHpOf(b) - maxHpOf(a));
    return [sorted[0].id];
  },

  spellPlayCondition(gs, pi, engine) {
    return candidateHosts(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }); }, // v651: beide Seiten als Drop-Ziel
  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      // v650: Anlegen ueber den geteilten Vorgang (beide Seiten, Anti-Magic).
      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [pi, pi === 0 ? 1 : 0],
        description: 'Choose a Hero to protect with a Guardian Angel.',
        confirmLabel: '👼 Bless!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const targetOwner = host.owner, targetHeroIdx = host.heroIdx;
      const tps = gs.players[targetOwner];
      const targetHero = tps.heroes[targetHeroIdx];
      engine.sync();

      // Play golden sparkle animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: targetOwner, heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(1000);

      // Fire zone enter hook
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('guardian_angel_placed', {
        player: ps.username, target: targetHero.name, owner: targetOwner,
      });
      engine.sync();
    },

    /**
     * When the equipped Hero would die, prevent death and fully heal.
     */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const hero = ctx.hero;
      if (!hero?.name) return;

      // Find which player/hero this is
      let heroPi = -1, heroHi = -1;
      for (let p = 0; p < 2; p++) {
        for (let h = 0; h < (gs.players[p]?.heroes || []).length; h++) {
          if (gs.players[p].heroes[h] === hero) { heroPi = p; heroHi = h; break; }
        }
        if (heroPi >= 0) break;
      }
      if (heroPi < 0 || heroHi < 0) return;

      // Check if this hero has Guardian Angel equipped
      const supportZones = gs.players[heroPi].supportZones[heroHi] || [];
      let gaSlot = -1;
      for (let si = 0; si < supportZones.length; si++) {
        if ((supportZones[si] || []).includes('Guardian Angel')) { gaSlot = si; break; }
      }
      if (gaSlot < 0) return;

      // ── Delete Guardian Angel FIRST (prevents infinite loop with Overheal Shock) ──
      supportZones[gaSlot] = supportZones[gaSlot].filter(c => c !== 'Guardian Angel');
      const gaInst = engine.cardInstances.find(c =>
        c.owner === heroPi && c.zone === 'support' && c.heroIdx === heroHi && c.zoneSlot === gaSlot && c.name === 'Guardian Angel'
      );
      if (gaInst) {
        engine._untrackCard(gaInst.id);
        gs.players[gaInst.originalOwner].deletedPile.push('Guardian Angel');
      }

      // Set HP to 1 (prevent death)
      hero.hp = 1;
      engine.sync();

      // ── Play angel descending animation ──
      engine._broadcastEvent('play_guardian_angel', {
        owner: heroPi, heroIdx: heroHi,
      });
      await engine._delay(1200);

      // Auftritt links am Feld (Als Regel 21.8.: beim Revive).
      await engine.announceHookActivation('Guardian Angel', heroPi);

      // ── Golden light explosion on hero ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: heroPi, heroIdx: heroHi, zoneSlot: -1,
      });
      await engine._delay(600);

      // ── Fully heal to max HP (routes through actionHealHero for Overheal Shock interaction) ──
      const maxHp = hero.maxHp || 400;
      const healAmount = maxHp - 1; // From 1 to maxHp
      const healSource = { name: 'Guardian Angel', owner: heroPi, heroIdx: heroHi };
      await engine.actionHealHero(healSource, hero, healAmount);

      engine.log('guardian_angel_triggered', {
        hero: hero.name, owner: heroPi, healed: hero.hp > 0,
      });
      engine.sync();
    },
  },
};

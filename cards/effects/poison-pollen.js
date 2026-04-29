// ═══════════════════════════════════════════
//  CARD EFFECT: "Poison Pollen"
//  Spell (Decay Magic Lv1, Normal)
//
//  For every target on the board (heroes and
//  face-up creatures, both sides):
//    • Targets currently Stunned gain 1 Stack
//      of Poison (subject to poison immunity).
//    • Targets currently Poisoned get Stunned
//      (subject to stun immunity).
//
//  The board is sampled BEFORE any mutation so a
//  freshly-applied status doesn't chain through
//  the other clause mid-resolve. Not an
//  additional Action.
//
//  Animation: purple spore rain on every
//  affected target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // Snapshot every affected unit BEFORE mutating anything. If we read
      // statuses while applying, a hero that was only Stunned would be
      // Poisoned by the first clause and then hit by the second clause as
      // well — the card text "Stun all Poisoned targets" refers to the
      // board state at cast time, not mid-resolve.
      const toPoison = []; // currently Stunned → receive Poison
      const toStun   = []; // currently Poisoned → receive Stun

      for (let p = 0; p < 2; p++) {
        const ps = gs.players[p];
        if (!ps) continue;
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          const entry = { kind: 'hero', owner: p, heroIdx: hi, ref: hero };
          if (hero.statuses?.stunned)  toPoison.push(entry);
          if (hero.statuses?.poisoned) toStun.push(entry);
        }
      }

      // Creatures — pulled from engine.cardInstances so creatures on dead
      // heroes are still targeted (same convention as the earlier
      // dead-hero creature-targeting fixes).
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const entry = { kind: 'creature', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, ref: inst };
        if (inst.counters?.stunned)  toPoison.push(entry);
        if (inst.counters?.poisoned) toStun.push(entry);
      }

      if (toPoison.length === 0 && toStun.length === 0) {
        engine.sync();
        return;
      }

      // Visual spore rain — dedup so a target hit by both clauses doesn't
      // double up on the animation.
      const animated = new Set();
      const playAnim = (e) => {
        const zoneSlot = e.kind === 'creature' ? e.slotIdx : -1;
        const key = `${e.kind}-${e.owner}-${e.heroIdx}-${zoneSlot}`;
        if (animated.has(key)) return;
        animated.add(key);
        engine._broadcastEvent('play_zone_animation', {
          type: 'poison_pollen_rain',
          owner: e.owner, heroIdx: e.heroIdx, zoneSlot,
        });
      };
      for (const e of toPoison) playAnim(e);
      for (const e of toStun)   playAnim(e);
      await engine._delay(600);

      // Apply Poison to the Stunned targets.
      const source = { name: 'Poison Pollen', owner: pi };
      for (const e of toPoison) {
        if (e.kind === 'hero') {
          if (e.ref.hp <= 0) continue;
          await engine.addHeroStatus(e.owner, e.heroIdx, 'poisoned', {
            addStacks: 1, appliedBy: pi,
          });
        } else {
          if (e.ref.zone !== 'support') continue;
          await engine.actionApplyCreaturePoison(source, e.ref);
        }
      }

      // Apply Stun to the Poisoned targets. addHeroStatus handles the full
      // hero immunity chain (immune/shielded/stun_immune/...). For
      // creatures we use the canApplyCreatureStatus gate + direct counter
      // write, matching Reiza / Medusa's Curse / Heavy Hit.
      for (const e of toStun) {
        if (e.kind === 'hero') {
          if (e.ref.hp <= 0) continue;
          await engine.addHeroStatus(e.owner, e.heroIdx, 'stunned', {
            duration: 1, appliedBy: pi,
          });
        } else {
          if (e.ref.zone !== 'support') continue;
          if (engine.canApplyCreatureStatus(e.ref, 'stunned')) {
            e.ref.counters.stunned = 1;
            e.ref.counters.stunnedAppliedBy = pi;
            engine.log('status_add', {
              target: e.ref.name, status: 'stunned', owner: e.owner,
            });
            engine.sync();
          }
        }
      }

      engine.log('poison_pollen', {
        player: gs.players[pi]?.username,
        poisoned: toPoison.length,
        stunned: toStun.length,
      });
      engine.sync();
    },
  },
};

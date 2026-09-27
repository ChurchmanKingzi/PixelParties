// ═══════════════════════════════════════════
//  CARD EFFECT: "Dance of the Flame Pillars"
//  Spell (Destruction Magic Lv 2, Normal)
//
//  Choose as many DIFFERENT TARGETS as there are
//  Destruction Magic Spells WITH DIFFERENT NAMES
//  in your discard pile and deal 100 damage to
//  each. If there are MORE different DM Spells in
//  your discard than there are targets on the
//  board, deal 150 damage to ALL targets instead
//  (both sides included).
//
//  Implementation
//  ──────────────
//  • Count distinct Destruction Magic Spell
//    names in the controller's discard. The
//    "different names" wording is satisfied by
//    deduplicating the discard pile by name.
//  • Count viable on-board targets — alive
//    Heroes on either side + every Creature in
//    a support zone on either side.
//  • If `distinctCount > viableTargets`: full-
//    board AOE for 150 via `aoeHit`.
//  • Else: prompt for EXACTLY `distinctCount` (Als Befund 12.9.)
//    DIFFERENT targets via `promptMultiTarget`
//    (the multi-target prompt enforces unique
//    selections natively).
//  • Both modes deal damage type
//    `destruction_spell` so reactions /
//    Anti-Magic / Smug Coin all gate normally.
// ═══════════════════════════════════════════
// v875: Namensvergleiche ueber den BASISNAMEN — „[B]"/„[W]" sind
// Kosmetik (siehe CARD_API, „Namen vergleichen").
const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Dance of the Flame Pillars';
const PER_TARGET_DAMAGE  = 100;
const FULL_BOARD_DAMAGE  = 150;

function isDestructionMagicSpell(cd) {
  if (!cd) return false;
  if (cd.cardType !== 'Spell') return false;
  return cd.spellSchool1 === 'Destruction Magic'
      || cd.spellSchool2 === 'Destruction Magic';
}

function distinctDMSpellsInDiscard(engine, ps) {
  const cardDB = engine._getCardDB();
  const seen = new Set();
  for (const name of (ps.discardPile || [])) {
    if (seen.has(baseCardName(name))) continue;
    if (isDestructionMagicSpell(cardDB[name])) seen.add(baseCardName(name));
  }
  return seen.size;
}

function countAllValidTargets(engine) {
  let n = 0;
  for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0) n++;
    }
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      for (let z = 0; z < 3; z++) {
        const slot = ps.supportZones?.[hi]?.[z] || [];
        if (slot.length > 0) n++;
      }
    }
  }
  return n;
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'flame_pillars' }, impactMs: 260 },

  /**
   * Need at least one matching Spell in the controller's discard
   * pile, otherwise the card has no targets to even reach for.
   */
  spellPlayCondition(gs, playerIdx, engine) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    return distinctDMSpellsInDiscard(engine, ps) > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps     = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const N = distinctDMSpellsInDiscard(engine, ps);
      if (N <= 0) { gs._spellCancelled = true; return; }

      const totalTargets = countAllValidTargets(engine);
      // "More different DM in discard than targets on the board" —
      // strict inequality. With distinct === total, we still go for
      // the multi-target mode (the spec wording is "if there are
      // MORE different…").
      const fullBoardMode = N > totalTargets;

      const dmgSource = { name: CARD_NAME, owner: pi, heroIdx };

      if (fullBoardMode) {
        // ── 150 damage to ALL targets, both sides ──
        await ctx.aoeHit({
          damage: FULL_BOARD_DAMAGE,
          damageType: 'destruction_spell',
          side: 'any',
          types: ['hero', 'creature'],
          animationType: 'flame_pillars',
          sourceName: CARD_NAME,
        });
        engine.log('dance_of_flame_pillars_full', {
          player: ps.username, distinctSpells: N, damage: FULL_BOARD_DAMAGE,
        });
        return;
      }

      // ── Multi-target mode: GENAU N verschiedene Ziele ───────────────
      // ★ „Choose as many different targets as there are …" ist eine
      // ZAHL, kein Hoechstwert (Als Befund 12.9.): wer waehlen kann,
      // MUSS voll waehlen. `min: N` statt `min: 1`. Der Fall „weniger
      // Ziele auf dem Brett als Zahlen in der Ablage" ist oben schon
      // abgefangen — dort schlaegt die Karte flaechendeckend zu; hier
      // unten stehen also immer mindestens N Ziele zur Verfuegung.
      const selected = await ctx.promptMultiTarget({
        side: 'any',
        types: ['hero', 'creature'],
        min: N,
        max: N,
        baseDamage: PER_TARGET_DAMAGE,
        title: CARD_NAME,
        description: `Choose ${N} different target${N > 1 ? 's' : ''}. Deal ${PER_TARGET_DAMAGE} damage to each.`,
        confirmLabel: `🔥 Strike! (${PER_TARGET_DAMAGE} ×N)`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!Array.isArray(selected) || selected.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ★★ v1185: Der Mehrfachzweig hatte GAR KEINE Flaechenklammer —
      // weder „Interference" noch „Deepsea Idol" sahen ihn, obwohl er
      // ein Schlag auf N Ziele ist. `beginAoeStrike` setzt beides; die
      // Saeulen fallen weiter nacheinander.
      await engine.beginAoeStrike(selected.length, {
        creatures: selected.filter(t => t.type !== 'hero').map(t => t.cardInstance).filter(Boolean),
        source: dmgSource, amount: PER_TARGET_DAMAGE,
        type: 'destruction_spell', sourceOwner: pi,
      });
      try {
      for (const t of selected) {
        const tSlot = t.type === 'hero' ? -1 : t.slotIdx;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_pillars',
          owner: t.owner, heroIdx: t.heroIdx, zoneSlot: tSlot,
        });
        await engine._delay(220);
        if (t.type === 'hero') {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (h && h.hp > 0) {
            await engine.actionDealDamage(dmgSource, h, PER_TARGET_DAMAGE, 'destruction_spell');
          }
        } else if (t.cardInstance) {
          await engine.actionDealCreatureDamage(
            dmgSource, t.cardInstance, PER_TARGET_DAMAGE, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }
      } finally {
        await engine.endMultiHit();
      }

      engine.log('dance_of_flame_pillars_multi', {
        player: ps.username,
        distinctSpells: N,
        targets: selected.map(t => t.cardName),
        damagePerTarget: PER_TARGET_DAMAGE,
      });
      engine.sync();
    },
  },
};

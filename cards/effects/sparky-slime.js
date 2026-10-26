// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparky Slime"
//  Creature — On summon, choose any target
//  that is not Immune and Negate it.
//  At the start of owner's turn, gain 1 level.
//  Negated = hero + ability effects silenced,
//  but support/creature effects still active.
// ═══════════════════════════════════════════

const { slimeLevelUpHook } = require('./_slime-shared');

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'electric_strike' }, impactMs: 260,
  },

  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Sparky Slime',
        // Sagt dem CPU-Ziel-Gate, WELCHEN Status diese Abfrage anwendet
        // (Als Auftrag 9.8.). Ohne die Angabe lief das Gate nicht, und
        // die CPU verbrannte Status an Zielen, die Johanna schuetzt.
        appliesStatus: 'negated',
        description: 'Select a target to Negate.',
        confirmLabel: 'Negate!',
        confirmClass: 'btn-warning',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.immune && !hero.statuses?.negated;
          }
          if (t.type === 'equip' && t.cardInstance) {
            // Already-negated / nulled creatures don't qualify. Cardinal-
            // immune and other absolute-immunity targets are deliberately
            // NOT filtered — animation plays, status fizzles silently.
            return !(t.cardInstance.counters?.negated || t.cardInstance.counters?.nulled);
          }
          return true;
        },
      });

      if (selected.length === 0) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4: wirkt nicht → Blob stumm
      const target = selected[0];

      if (target.type === 'hero') {
        // W24d (N4-15): „until your next turn". Der Heldenstatus 'negated' faellt sonst am Zugende des Spielers,
        // in dessen Spalte der Held steht – ein EIGENER Held waere also schon am Ende des laufenden Zuges frei.
        // Dann: befristet bis zum Beginn des naechsten eigenen Zuges (`expiresAtTurn`, wie Locke) und vom
        // Zugende-Abbau ausgenommen (`permanent`). Gegnerische Helden enden wie bisher an SEINEM Zugende.
        const eigeneSpalte = target.owner === ctx.cardOwner;
        await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
          appliedBy: ctx.cardOwner,
          animationType: 'electric_strike',
          ...(eigeneSpalte ? { permanent: true, expiresAtTurn: engine.gs.turn + 2, expiresForPlayer: ctx.cardOwner, fristBeginn: true } : {}),
        });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          // Animation plays unconditionally so the player sees the
          // strike land even when the status fizzles on an immune target.
          engine._broadcastEvent('play_zone_animation', { type: 'electric_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
          // ★ Z2 (H03-15): „… until your next turn" — `applyCreatureStatus('negated')` legt keine Frist an (der Zaehler
          // `negatedDuration` hat keinen Leser), die Negierung blieb ewig. Wie Null/Locke ueber den Ablauf-Buff:
          // endet zu Beginn des naechsten eigenen Zuges; „counts as a negative status effect" → heilbar.
          if (engine.canApplyCreatureStatus(inst, 'negated', { name: 'Sparky Slime', owner: ctx.cardOwner })) {
            await engine.actionNegateCreature(inst, 'Sparky Slime', {
              expiresAtTurn: engine.gs.turn + 2, expiresForPlayer: ctx.cardOwner, fristBeginn: true,   // W68a
              buffKey: 'sparky_slime_negated', cleansable: true,
            });
          }
        }
      }
      engine.log('negate', { target: target.cardName, by: 'Sparky Slime', type: target.type });
    },

    // Als Ruling (Al 26.10.): „you may increase this Creature's level by 1" = Ja/Nein-Frage (Nein/Abbruch: Stufe bleibt) — `_slime-shared`.
    onTurnStart: slimeLevelUpHook('Sparky Slime'),
  },
};

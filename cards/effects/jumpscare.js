// ═══════════════════════════════════════════
//  CARD EFFECT: "Jumpscare"
//  Spell (Surprise) — Activates when the owner
//  is targeted by an opponent's single/multi-target
//  Attack, Spell, or Creature effect (NOT AoE).
//  After the effect fully resolves, choose any
//  target and Stun it for 2 turns (end of
//  opponent's next turn).
// ═══════════════════════════════════════════

const { isAttackSpellOrCreatureSource } = require('./_hooks');
const { collectBoardTargets } = require('./_waflav-shared');

module.exports = {
  isSurprise: true,

  /**
   * Trigger condition: only for non-AoE targeting.
   */
  surpriseTrigger(gs, tOwner, tHeroIdx, sourceInfo, engine) {
    // Don't trigger for AoE effects (Divine Gift of Fire, Flame Avalanche, etc.)
    if (sourceInfo?.cardInstance?._isAoeCheck) return false;
    // Must be an opponent's effect (Als Vorgabe 29.9.: `tOwner` = Ausloeser,
    // verglichen mit dem handelnden Spieler der Quelle)
    if ((sourceInfo?.controller ?? sourceInfo?.owner) === tOwner) return false;
    // v666 (Sweep): „opponent's Attack, Spell or Creature effect“.
    if (!isAttackSpellOrCreatureSource(engine, sourceInfo)) return false;
    return true;
  },

  /**
   * On activation: queue a deferred stun effect that fires
   * after the triggering spell/effect fully resolves.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner ?? ctx.cardOriginalOwner;   // 29.9.: Ausloeser (Kontrolleur)

    // Queue deferred effect — will execute after spell/effect resolution
    if (!gs._deferredSurprises) gs._deferredSurprises = [];
    gs._deferredSurprises.push({
      name: 'Jumpscare',
      ownerIdx: pi,
      heroIdx: ctx.cardHeroIdx, heroOwner: ctx.cardHeroOwner,   // W46a: Träger-Held = „der Angreifer" der Stun-Wahl (Fenster/Reaktionen sehen ihn)
      execute: async (eng) => {
        // Prompt the owner to choose any target to Stun
        // Create a temporary target picker context
        // W16g (R01-03): „any target on the board“ = Helden UND Kreaturen (Al, Welle 10 Q55;
        // gleicher Sammler wie Thunderstruck Waflav).
        const allTargets = collectBoardTargets(eng);

        if (allTargets.length === 0) return;

        const selectedIds = await eng.promptEffectTarget(pi, allTargets, {
          title: 'Jumpscare',
          description: 'Choose any target to Stun for 2 turns!',
          confirmLabel: '😱 Stun!',
          confirmClass: 'btn-danger',
          cancellable: false,
          maxTotal: 1,
        });

        if (!selectedIds || selectedIds.length === 0) return;
        const picked = allTargets.find(t => t.id === selectedIds[0]);
        if (!picked) return;

        if (picked.type !== 'hero') {
          const kreatur = picked.cardInstance;
          if (!kreatur || kreatur.zone !== 'support') return;
          eng._broadcastEvent('jumpscare_box', {
            owner: picked.owner, heroIdx: picked.heroIdx, slotIdx: picked.slotIdx,
          });
          await eng._delay(700);
          await eng.applyCreatureStatus(kreatur, 'stunned', { duration: 2, appliedBy: pi });
          eng.log('jumpscare_stun', {
            player: eng.gs.players[pi]?.username,
            target: picked.cardName,
          });
          eng.sync();
          return;
        }

        const tgtHero = eng.gs.players[picked.owner]?.heroes?.[picked.heroIdx];
        if (!tgtHero || tgtHero.hp <= 0) return;

        // Jack-in-the-box animation
        eng._broadcastEvent('jumpscare_box', {
          owner: picked.owner, heroIdx: picked.heroIdx,
        });
        await eng._delay(700);

        // Apply Stun (respects immunities). Duration 2 = ticks down at the
        // end of each of the target's turns, expiring at the end of their
        // NEXT turn — matches Baihu's "lasts through next turn" pattern.
        // W46a (Al, 22.10.2026: die Wirkung einer Surprise gilt nach cardType — Jumpscare ist ein SPELL): die aufgeschobene Betäubung läuft NACH `_activateSurprise` (Spell-Stapel schon abgeräumt) —
        // Spell-Immunitäten (Anti Magic, Energy Aura) lesen den Stapel, also steht Jumpscare für die Betäubung des Helden wieder darauf.
        eng._pushResolvingSpell('Jumpscare');
        try {
          await eng.addHeroStatus(picked.owner, picked.heroIdx, 'stunned', { duration: 2, appliedBy: pi });
        } finally { eng._popResolvingSpell(); }

        eng.log('jumpscare_stun', {
          player: eng.gs.players[pi]?.username,
          target: tgtHero.name,
        });
        eng.sync();
      },
    });

    // Don't negate the triggering effect
    return { effectNegated: false };
  },
};

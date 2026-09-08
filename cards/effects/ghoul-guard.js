// ═══════════════════════════════════════════
//  CARD EFFECT: "Ghoul Guard"
//  Creature (Normal)
//
//  "When this Creature is defeated, your
//  opponent must choose a target they control
//  that is not Bleeding and Bleed it for the
//  rest of the game. When this Creature is
//  defeated by an opponent's Attack, Spell or
//  Creature effect, Bleed all their targets
//  instead."
//
//  Als Ruling 7 (4.9.): Gegnerwahl, nicht
//  abbrechbar; ohne nicht-blutendes Ziel passiert
//  nichts. Gedacht fuer Sacrifice-Decks (Opfer →
//  EIN Ziel blutet).
//
//  Umsetzung (v712): `onCreatureDeath` (eigene
//  Instanz, Cycling-Demons-Muster). Quelle des
//  Gegners und Attack/Spell/Creature-Effekt →
//  `isAttackSpellOrCreatureSource` → alle Ziele.
// ═══════════════════════════════════════════

const { isAttackSpellOrCreatureSource } = require('./_hooks');
const { bleedTarget, collectPlayerTargets } = require('./_bleed-shared');

const CARD_NAME = 'Ghoul Guard';

module.exports = {
  activeIn: ['support'],

  cpuResponse(engine, kind, promptData) {
    if (kind === 'effectTarget' && promptData?.source === CARD_NAME) {
      const targets = promptData.validTargets || [];
      // Gegner (CPU) waehlt: lieber eine Creature als einen Helden.
      const cre = targets.find(t => t.type === 'equip');
      const pick = cre || targets[0];
      return pick ? { selectedIds: [pick.id] } : null;
    }
    return null;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const opp = pi === 0 ? 1 : 0;
      const src = ctx.source;
      const srcOwner = src?.heroOwner ?? src?.controller ?? src?.owner ?? -1;
      // `isAttackSpellOrCreatureSource` liest `cardName`/`cardInstance` —
      // Quellen tragen den Namen oft nur als `name`.
      const srcInfo = src ? { ...src, cardName: src.cardName || src.name } : null;
      const byOpponentEffect = srcOwner === opp && isAttackSpellOrCreatureSource(engine, srcInfo);

      if (byOpponentEffect) {
        let n = 0;
        for (const t of collectPlayerTargets(engine, opp, { notBleeding: true })) {
          if (await bleedTarget(engine, t, CARD_NAME, pi, { animationType: 'bloody_cut' })) n++;
        }
        engine.log('ghoul_guard_bleed_all', { player: gs.players[pi]?.username, killer: src?.name || null, bled: n });
        engine.sync();
        return;
      }

      const options = collectPlayerTargets(engine, opp, { notBleeding: true });
      if (options.length === 0) {
        engine.log('ghoul_guard_no_target', { player: gs.players[pi]?.username });
        return;
      }
      const pick = await engine.promptEffectTarget(opp, options, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Ghoul Guard was defeated — choose a target you control to Bleed.',
        confirmLabel: '🩸 Bleed!', confirmClass: 'btn-danger',
        cancellable: false, maxTotal: 1, minRequired: 1,
        _skipRedirectCheck: true, _skipPostTargetReactions: true, ignoreUntargetable: true,
      });
      const chosen = (pick && pick.length) ? options.find(t => t.id === pick[0]) : options[0];
      if (chosen && await bleedTarget(engine, chosen, CARD_NAME, pi, { animationType: 'bloody_cut' })) {
        engine.log('ghoul_guard_bleed', { player: gs.players[pi]?.username, target: chosen.cardName });
      }
      engine.sync();
    },
  },
};

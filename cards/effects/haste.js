// ═══════════════════════════════════════════
//  CARD EFFECT: "Haste"
//  Spell (Support Magic Lv1, Normal)
//  Draw 2/3/4 cards based on caster's total
//  Support Magic level. Cards drawn one by one.
// ═══════════════════════════════════════════

const { drawWouldBeBlocked } = require('./_draw-block-shared');
const { heldSeite } = require('./_hooks');   // Als Befund 29.9.: Brettseite geliehener Helden

module.exports = {
  cpuMeta: { scalesWithSchool: 'Support Magic' },
  // Z6 (S02-21): der Zug ist der einzige Nutzen - unter Hand-/Zieh-Sperre gar nicht spielbar (Praezedenz Brilliant Idea).
  blockedByHandLock: true,
  blockedByDrawLock: true,

  // ── Tuscan Artist (Als Ruling 16.8.) ──
  // Haste zieht 2/3/4 je nach Support-Magic-Level des CASTERS. Der Zug
  // ist ihr einziger Nutzen, also ist sie gesperrt, wenn genau dieser
  // Held 2 oder 3 zoege — bei Level 3+ (4 Karten) bleibt sie spielbar.
  // Deshalb `canPlayWithHero` und nicht `neverPlayable`: der Server
  // graut ueber `cardGateBlockedCards` erst aus, wenn KEIN eigener Held
  // sie mehr spielen kann.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const smLevel = engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx, heldSeite(gs, pi, heroIdx));   // W16g (S02-18): + Xals Support-Zonen-Stapel   // W4a: harte Negierung -> Stufe 0
    const drawCount = smLevel >= 3 ? 4 : smLevel >= 2 ? 3 : 2;
    return !drawWouldBeBlocked(engine, pi, drawCount);
  },
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
      if (!hero?.name || hero.hp <= 0) return;

      // Calculate Support Magic level
      const smLevel = engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx, ctx.cardHeroOwner ?? pi);   // W16g (S02-18): + Xals Support-Zonen-Stapel   // Als Befund 29.9.: Zonen des Wirkers auf seiner Brettseite; W4a: harte Negierung -> Stufe 0
      const drawCount = smLevel >= 3 ? 4 : smLevel >= 2 ? 3 : 2;

      // Confirm
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Haste',
        message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''}. (Support Magic Lv${smLevel})`,
        confirmLabel: `⚡ Haste! (+${drawCount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Draw cards
      await engine.actionDrawCards(pi, drawCount);

      engine.log('haste', { player: ps.username, drawn: drawCount, smLevel });
      engine.sync();
    },
  },
};

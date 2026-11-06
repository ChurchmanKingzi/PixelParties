// ═══════════════════════════════════════════
//  SPELL: "Prophecy of Coolness"
//  Search your deck for any card and place it on
//  top of your Coolness Stack. Once per turn.
//
//  Inherent additional Action — doesn't consume the
//  turn's main Action slot (per the buff).
// ═══════════════════════════════════════════

const CARD_NAME = 'Prophecy of Coolness';
const HOPT_KEY  = 'prophecyOfCoolnessUsedThisTurn';

function isOnCooldown(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn;
}

module.exports = {
  // ★ Z7b: FIZZELT die Karte (Wirker beim Auflösen handlungsunfähig, v1328), war sie GESPIELT → Stempel (Engine: `_noteFizzledPlay`).
  // Eine ganz NEGIERTE Karte stempelt nicht (Als Entscheidung, Welle 3).
  onFizzledPlay: ({ engine, gs, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  inherentAction: true,

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Per-turn limit — uses the engine's canonical `gs.hoptUsed[key:pi]`
    // storage. Without this exact key path, the gate misses and the
    // spell becomes castable again after a cancel-then-retry, falling
    // through to discard with no effect.
    if (isOnCooldown(gs, pi)) return false;
    // Als Ruling (Al 26.10.): der Stack existiert, solange Wowhalla liegt — auch leer (`hasCoolnessStack`); Prophecy legt nur eine Karte DARAUF.
    const eng = engine || gs._engineRef;
    if (!(eng?.hasCoolnessStack ? eng.hasCoolnessStack(pi) : (Array.isArray(ps.coolnessStack) && ps.coolnessStack.length > 0))) return false;
    return Array.isArray(ps.mainDeck) && ps.mainDeck.length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      // Defensive re-check (the engine may invoke onPlay even when
      // spellPlayCondition returned false for some edge paths).
      if (isOnCooldown(engine.gs, pi) || !engine.hasCoolnessStack(pi)) {
        engine.gs._spellCancelled = true;
        return;
      }
      const pushed = await ctx.searchAndPushToCoolnessStack(pi, {
        title: CARD_NAME,
        description: 'Choose any card from your deck and place it on top of your Coolness Stack.',
      });
      if (!pushed) {
        // Player cancelled — return spell to hand and DO NOT claim
        // the HOPT, so they can try again this turn.
        engine.gs._spellCancelled = true;
        return;
      }
      // Commit: claim the HOPT only now that the effect resolved.
      ctx.hardOncePerTurn(HOPT_KEY);
    },
  },
};

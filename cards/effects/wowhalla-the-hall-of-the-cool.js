// ═══════════════════════════════════════════
//  CARD EFFECT: "Wowhalla, the Hall of the Cool"
//  Spell (Magic Arts Lv3, Area) — keystone of the
//  Cool archetype.
//
//  Behaviour
//  ─────────
//  ① On entry: place the top of the caster's deck
//     face-up in front of them. That pile is the
//     Coolness Stack and is rendered to the right
//     of the battlefield, under the first
//     Permanent slot.
//  ② End of each of the caster's turns: place the
//     top of the caster's deck onto the Stack.
//  ③ When this card is removed from the board, the
//     entire Coolness Stack is deleted.
//
//  ④ When this card is the target of an opponent's
//     effect, the controller may delete the top of
//     their Coolness Stack to negate it. Hooks into
//     the engine's generalized `tryAreaProtection`
//     window — every effect that destroys an Area
//     calls it before the destroy lands.
// ═══════════════════════════════════════════

const CARD_NAME = 'Wowhalla, the Hall of the Cool';

module.exports = {
  // Live in 'hand' so the self-cast onPlay fires; live in 'area' so
  // onTurnEnd / onCardLeaveZone fire once placed.
  activeIn: ['hand', 'area'],

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onCardLeaveZone-Confirm (Coolness-Stack-Zufuhr), Gratis-Ressource.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    /**
     * Self-cast: drop into the caster's Area zone, then seed the
     * Coolness Stack with the top card of the deck.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      await engine.placeArea(ctx.cardOwner, ctx.card);
      // Seed the Stack from the top of the deck. requireStack is OFF
      // here — Wowhalla creates the Stack from nothing on entry.
      await ctx.pushDeckTopToCoolnessStack(ctx.cardOwner, { source: CARD_NAME });
    },

    /**
     * End of each of the caster's turns: feed the Stack one card.
     * We listen to onTurnEnd while in the 'area' zone — only the
     * caster's own End Phase fires (the activePlayer check below).
     */
    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      if (ctx.activePlayer !== ctx.cardOwner) return;
      // Defensive: skip if Wowhalla has already left the Area zone
      // this turn (race with onCardLeaveZone — the engine gates the
      // listener on inst.zone but a stale ctx can still fire).
      const areaList = ctx._engine.gs.areaZones?.[ctx.cardOwner] || [];
      if (!areaList.includes(CARD_NAME)) return;
      await ctx.pushDeckTopToCoolnessStack(ctx.cardOwner, { source: CARD_NAME });
    },

    /**
     * ★ Der Stack wird auch dann angelegt, wenn Wowhalla NICHT von der
     * Hand kommt (Als Befund 19.8.).
     *
     * `onPlay` oben ist auf `cardZone === 'hand'` verriegelt. Eine
     * Wowhalla, die der PUZZLE-CREATOR direkt in die Area-Zone setzt —
     * oder die ein Effekt dorthin bringt — hatte deshalb nie einen
     * Coolness Stack. Folge: `hasCoolnessStack` ist falsch, die
     * Selbstverteidigung bietet sich gar nicht erst an, und das
     * Loeschen des Stacks beim Verlassen sieht aus, als funktioniere
     * es (es ist nur nichts da). Genau dieses Bild hat Al gemeldet.
     *
     * Der Kartentext sagt „When this card comes into play" — eine
     * Puzzle-Platzierung IST das. Doppelbefuellung ist ausgeschlossen:
     * `onPlay` legt den Stack an, bevor dieser Hook laeuft, und wir
     * fuellen nur einen LEEREN Stack.
     */
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'area') return;
      if (ctx.enteringCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      if (engine.hasCoolnessStack(ctx.cardOwner)) return;
      await ctx.pushDeckTopToCoolnessStack(ctx.cardOwner, { source: CARD_NAME });
    },

    /**
     * ★ ...und beim SPIELSTART (Als Befund 19.8., zweiter Anlauf).
     *
     * Der Hook darueber reicht NICHT: ein Puzzle baut sein Brett
     * direkt in den Spielzustand — `gs.areaZones` wird gesetzt, ohne
     * dass je ein Zonenwechsel stattfindet, also feuert auch kein
     * `onCardEnterZone`. `onGameStart` dagegen laeuft im Puzzle
     * ausdruecklich (server.js ~13985), genau fuer solche Faelle.
     * Damit hat eine vorbereitete Wowhalla ihren Stack, und ihre
     * Selbstverteidigung steht ueberhaupt zur Verfuegung.
     */
    onGameStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      if (engine.hasCoolnessStack(ctx.cardOwner)) return;
      await ctx.pushDeckTopToCoolnessStack(ctx.cardOwner, { source: CARD_NAME });
    },

    /**
     * When Wowhalla leaves the Area zone (destroyed, removed, etc.),
     * the Stack "dies" with its anchor — every card on the Stack is
     * deleted (sent to the deleted pile).
     *
     * We only react to OUR OWN departure from 'area'. The fire-site
     * shape varies; only REJECT when a field is explicitly present
     * and mismatches.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'area') return;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return;
      await ctx.deleteCoolnessStack(ctx.cardOwner, { source: CARD_NAME });
    },
  },

  /**
   * Generalized Area-protection hook. Engine calls this on every
   * tracked card before an opposing effect destroys an Area. We only
   * react when WE are the target and the source is on the opponent's
   * side. The cost is a single Stack pop-to-delete; if the controller
   * can't pay (empty Stack), the prompt skips silently.
   */
  async onAreaTargetedByOpponent(ctx, info) {
    // Only react when WE are the target.
    if (info?.targetInst?.id !== ctx.card.id) return null;
    // Only when the source is on the opponent's side.
    if (info.sourceOwner === ctx.cardOwner) return null;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (!engine.hasCoolnessStack(pi)) return null;

    const sourceName = info.source?.name || 'an opposing effect';
    const confirmed = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${sourceName} is targeting Wowhalla! Delete the top of your Coolness Stack to negate?`,
      showCard: CARD_NAME,
      confirmLabel: '🛡️ Negate',
      confirmClass: 'btn-success',
      cancelLabel: 'Allow',
      cancellable: true,
    });
    if (!confirmed) return null;
    await ctx.popCoolnessStackTo(pi, 'delete', { source: CARD_NAME });
    return { negated: true };
  },
};

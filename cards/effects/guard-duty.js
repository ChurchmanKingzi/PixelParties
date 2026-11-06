// ═══════════════════════════════════════════
//  CARD EFFECT: "Guard Duty"
//  Spell (Support Magic Lv1, Normal)
//  Archetype: Guardian Beasts.
//
//  Shuffle your entire discard pile back into
//  your deck. Your opponent MAY then shuffle
//  their entire discard pile back into their
//  deck (their choice — they confirm via prompt).
//  Counts as an additional Action.
//
//  Als Ruling (Al 26.10.): nur SPIELBAR, wenn die eigene Ablage ins eigene Deck gemischt werden darf
//  (Hatusbal, Knight [B], Stab-Ablagesperre); Sperre beim Gegner lässt nur dessen Teil entfallen.
//
//  ONCE PER GAME — gated via `gs._guardDutyUsed[pi]`
//  set on resolution. The hand-play `canPlay` gate
//  short-circuits when the flag is set so the card
//  greys out cleanly.
// ═══════════════════════════════════════════

const ONCE_PER_GAME_KEY = '_guardDutyUsed';
const CARD_NAME = 'Guard Duty';

/**
 * Darf `p` seine Ablage jetzt ins eigene Deck zurückmischen? Zurückmisch-Sperre (Hatusbal; Distracting Crystal in `p`s Hand) UND die
 * Ablage-Ausgangssperren (Knight of Kings [B], Stab-Sperre, Freikauf des Eye of Ren) — die Karte schob die Ablage sonst an allen vorbei.
 * Ist es gesperrt, entfällt NUR dieser Teil (wie bei Meditation); der Teil des Gegners bleibt davon unberührt.
 */
async function ablageMischenErlaubt(engine, p) {
  if (engine.shuffleBackIntoOwnDeckBlocked(p, { fromHandOrDiscard: true })) return false;
  return engine._discardOutAllowed(p, { sourceOwner: p });
}

module.exports = {
  // ★ Z7b: FIZZELT die Karte (Wirker beim Auflösen handlungsunfähig, v1328), war sie GESPIELT → Stempel (Engine: `_noteFizzledPlay`).
  // Eine ganz NEGIERTE Karte stempelt nicht (Als Entscheidung, Welle 3).
  onFizzledPlay: ({ gs, pi }) => { if (!gs[ONCE_PER_GAME_KEY]) gs[ONCE_PER_GAME_KEY] = {}; gs[ONCE_PER_GAME_KEY][pi] = true; },

  inherentAction: true, // Free additional Action — no main-action cost.
  // Shuffles discard pile back into deck — flagged for "No Retreat!"
  // detection.
  shufflesFromHandOrDiscardIntoDeck: true,

  // Als Ruling (Al 26.10.): „Die Karte soll nur spielbar sein, wenn der Discard Pile auch ins eigene Deck gemischt werden darf. Sperre beim Gegner ist
  // egal." — unspielbar (ausgegraut, nichts verbraucht), solange die EIGENE Ablage nicht ins eigene Deck zurück darf: Zurückmisch-Sperre (Hatusbal,
  // Distracting Crystal), Stapel-Ausgang (Knight of Kings [B]) oder harte Stab-Ablagesperre (der freikaufbare Eye of Ren zählt NICHT, wie bei
  // Meditation). Eine Sperre beim Gegner lässt nur DESSEN Teil entfallen (`onPlay`), die Karte bleibt spielbar.
  spellPlayCondition(gs, pi, engine) {
    if (gs[ONCE_PER_GAME_KEY]?.[pi]) return false;
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    if (eng.shuffleBackIntoOwnDeckBlocked(pi, { fromHandOrDiscard: true })) return false;
    if (!eng.pileOutAllowed(pi, 'discard', { sourceOwner: pi })) return false;
    if (eng.isDiscardOutHardLocked?.(pi)) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps) return;

      // Stamp the per-game flag immediately on resolution. Even if the
      // shuffles fizzle (empty discard piles, or the opponent declines),
      // the card has been "used" — once-per-game.
      if (!gs[ONCE_PER_GAME_KEY]) gs[ONCE_PER_GAME_KEY] = {};
      gs[ONCE_PER_GAME_KEY][pi] = true;

      // Step 1: caster's discard → caster's main deck, then shuffle.
      const myDp = ps.discardPile || [];
      if (myDp.length > 0 && await ablageMischenErlaubt(engine, pi)) {
        const moved = myDp.length;
        ps.mainDeck.push(...myDp);
        // In place leeren, das Array nicht ersetzen: sonst geht ein
        // `discardPile.push`-Override (Wildur, Forsaken) verloren (A04-cute-08).
        myDp.length = 0;
        engine.shuffleDeck(pi, 'main');
        engine.log('guard_duty_shuffle_self', { player: ps.username, moved });
        // Hatusbals Bonus: diese Karte geht an `actionRecycleCards`
        // vorbei (sie schiebt die GANZE Ablage in einem Rutsch), meldet
        // ihren Effekt also selbst.
        await engine.noteShuffledBack(pi, moved, CARD_NAME);
      }

      // Step 2: prompt opponent (yes/no). Fizzle silently if opp's
      // discard is empty — no choice to offer.
      if (ops?.discardPile?.length > 0 && await ablageMischenErlaubt(engine, oi)) {
        const choice = await engine.promptGeneric(oi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `${ps.username} played Guard Duty — you may shuffle your entire discard pile back into your deck. Accept?`,
          options: [
            { id: 'yes', label: '🔁 Yes, shuffle my discard back' },
            { id: 'no', label: 'No, keep my discard' },
          ],
          cancellable: false,
        });
        if (choice?.optionId === 'yes') {
          const moved = ops.discardPile.length;
          ops.mainDeck.push(...ops.discardPile);
          ops.discardPile.length = 0;   // in place (A04-cute-08)
          engine.shuffleDeck(oi, 'main');
          engine.log('guard_duty_shuffle_opp', { player: ops.username, moved });
          await engine.noteShuffledBack(oi, moved, CARD_NAME);   // Hatusbal/Leadership des Gegners zählen sein Zurückmischen
        }
      }

      engine.sync();
    },
  },
};

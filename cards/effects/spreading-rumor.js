// ═══════════════════════════════════════════
//  CARD EFFECT: "Spreading Rumor"
//  Spell (Normal, Lv1, Decay Magic) — BANNED
//
//  Declare a card name. Your opponent must
//  discard all copies of the declared card from
//  their hand. If at least 1 card is discarded
//  this way, the play counts as an inherent
//  additional Action — but the caster cannot
//  interact with their opponent's hand for the
//  rest of the turn afterwards.
//
//  Als Ruling (Al 26.10.): „you MAY make this count as an additional Action": bei ≥ 1 abgeworfener Karte fragt der Zauber Ja/Nein — aber NUR, wenn
//  der Spieler danach überhaupt noch eine Aktion nutzen könnte (`hasPayableActionFor`: reguläre Aktion noch offen oder einlösbarer Zweitaktions-
//  Zuschlag/Geber, Muster Pillar of Light). Ohne solche Aktion: keine Frage, normale Aktion, und die Sperre „cannot interact with your opponent's
//  hand" greift NICHT (sie gilt nur, wenn man „if you do" die Zusatzaktion gewählt hat). „Nein" = normale Aktion, ebenfalls ohne Sperre.
//
//  CONDITIONAL INHERENT — defaults to inherent
//  (no Action consumed) WHENEVER the casting
//  Hero has Action capacity that would otherwise
//  be spent on this Spell:
//    • Main Phase 1 (Action Phase still ahead).
//    • Action Phase, Hero hasn't acted yet (main
//      slot available).
//    • Action Phase, Hero used main but has a
//      second-Action grant.
//    • Any phase with a matching additional-
//      action provider for spell-category.
//  Plays in scenarios outside that capacity fall
//  back to the engine's normal action gate (and
//  thus reject if no Action is reachable).
//
//  FUMBLE → retroactive consume. If the Spell
//  whiffs (0 cards discarded), the inherent
//  status is revoked: the engine consumes an
//  additional-action provider if available, else
//  marks the main Action as spent (advancing to
//  Action Phase from Main 1, or to Main Phase 2
//  from a "between two actions" Action-Phase
//  cast). Half-second pacing between phase steps
//  so the auto-advance is readable. Server-side
//  rider — set the `_spreadingRumorFumbled`
//  signal here, doPlaySpell consumes it after
//  spell-resolution depth releases.
// ═══════════════════════════════════════════

// v875: Namensvergleiche ueber den BASISNAMEN (siehe CARD_API).
const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Spreading Rumor';

module.exports = {
  // CPU: wie bisher immer als Zusatzaktion zählen lassen (mit Sperre) — die Frage kommt nur, wenn danach noch eine Aktion nutzbar wäre (Ruling Al 26.10.).
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData?.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },

  /**
   * Conditional inherent gate — true iff the casting Hero is alive,
   * not silenced, and the player has Action capacity that would
   * otherwise be spent on this Spell. The four capacity branches
   * mirror the spec line: "still has an Action available this turn".
   * Returning false routes the play through the engine's standard
   * Action gate, which will reject when no Action capacity exists at
   * all (e.g. Main Phase 2 without an additional-action provider).
   */
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs?.players?.[pi];
    if (!ps) return false;
    // Centralized incapacitation gate — rejects dead / Frozen /
    // Stunned / Bound / hard-Negated Heroes. Weakening-Crystal-
    // sourced negation is intentionally NOT disqualifying (effect-
    // only form leaves Action capacity intact); the helper handles
    // that distinction so we don't duplicate it here.
    if (engine?.isHeroIncapacitated?.(pi, heroIdx)) return false;

    const phase = gs.currentPhase;
    // Main Phase 1 — Action Phase still pending; the upcoming main
    // Action slot counts as capacity.
    if (phase === 2) return true;

    // Action Phase capacity:
    //   • Hero hasn't acted yet → main slot still available.
    //   • Hero acted but has a second-Action grant alive.
    if (phase === 3) {
      const hasActed = (ps.heroesActedThisTurn || []).includes(heroIdx);
      if (!hasActed) return true;
      const hasBonus = (ps.bonusActions?.heroIdx === heroIdx
                        && (ps.bonusActions.heroOwner ?? pi) === pi /* Styx 28.9.: Seite */
                        && ps.bonusActions.remaining > 0)
        || ((ps._bonusMainActions || 0) > 0);
      if (hasBonus) return true;
    }

    // Any phase — additional-action provider for spell-category.
    if (typeof engine?.findAdditionalActionForCard === 'function') {
      const typeId = engine.findAdditionalActionForCard(pi, CARD_NAME, heroIdx);
      if (typeId) return true;
    }

    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // Spreading Rumor lock from a previous successful cast this
      // turn — even Spreading Rumor itself can't bypass it.
      if (ps._oppHandInteractionLockedTurn === gs.turn) {
        engine.log('rumor_locked', { player: ps.username });
        gs._spellCancelled = true;
        return;
      }

      // ★ W63d: KEIN Früh-Auftritt vor dem Namens-Dialog — er ist abbrechbar, und der Gegner darf die Karte erst nach dem Commit sehen
      // (zentraler Auftritts-Puffer; der Auftritt kommt mit der ersten sichtbaren Wirkung nach der Namenswahl).

      const cardDB = engine._getCardDB();
      const allNames = Object.keys(cardDB).filter(n => {
        const cd = cardDB[n];
        if (!cd) return false;
        if (cd.cardType === 'Token') return false;
        return true;
      }).sort((a, b) => a.localeCompare(b));

      const result = await engine.promptGeneric(pi, {
        type: 'cardNamePicker',
        title: CARD_NAME,
        description: `Declare a Card name. ${ops.username} discards every copy from their hand.`,
        cardNames: allNames,
        cancellable: true,
      });
      if (!result || result.cancelled || !result.cardName) {
        gs._spellCancelled = true;
        return;
      }
      const declared = result.cardName;
      const trifft = (n) => baseCardName(n) === baseCardName(declared);   // v875

      // Dump every copy of the declared name in one forced-discard
      // batch — multi-copy reveals (Glass of Marbles, Skull Necklace,
      // etc.) all resolve their on-discard reactors AFTER every copy
      // has hit the pile, matching the engine-wide ordering.
      // v1324: Boris darf den erzwungenen Abwurf ignorieren.
      const _anzahl = (ops.hand || []).filter(trifft).length;
      // ★ W74c: ERST das Ambush-Fenster, DANN Boris (`fremdAbwurfEntfaellt`; vorher fragte Boris zuerst, das Fenster kam je Karte danach).
      const _boris = _anzahl > 0 && await engine.fremdAbwurfEntfaellt(oi, _anzahl, { source: CARD_NAME, sourceOwner: pi });
      const discarded = _boris ? 0 : await engine.withDiscardBatch(oi, { source: CARD_NAME }, async () => {
        let n = 0;
        while (true) {
          // v875: Basisname (siehe Accusation) — abgeworfen wird unter
          // dem echten Namen der gefundenen Karte.
          const idx = (ops.hand || []).findIndex(trifft);
          if (idx < 0) break;
          const ok = await engine.actionDiscardHandCard(oi, ops.hand[idx], idx, {
            source: CARD_NAME,
            sourceOwner: pi,   // v860: fremder Zwangsabwurf (Erstrunden-Schutz)
            _skipHandInteractionCheck: true,   // W74c: das Fenster lief schon oben
          });
          if (!ok) break;
          n++;
        }
        return n;
      });

      engine.log('rumor_resolved', {
        player: ps.username, opponent: ops.username,
        declared, discarded,
      });

      if (discarded > 0) {
        // ★ Als Ruling (Al 26.10.): „you MAY make this count as an additional Action, but IF YOU DO, you cannot interact with your opponent's hand …"
        // Bei ≥ 1 abgeworfener Karte kommt die Ja/Nein-Frage „als Zusatzaktion zählen lassen?" NUR, wenn der Spieler danach überhaupt noch eine Aktion nutzen
        // könnte (Muster Pillar of Light: reguläre Aktion noch offen oder einlösbarer Zweitaktions-Zuschlag / passender Geber — `hasPayableActionFor`, am Ende der
        // Auflösung gelesen: ein Zuschlag, der diesen Guss getragen hat, ist dann schon verbraucht). Ohne solche Aktion gibt es keine Frage: normale Aktion
        // (Server zahlt sie über `gs._spellForcesActionConsume`, der Curse-Vertrag), und die Sperre greift dann NICHT — sie gilt nur, wenn man die Zusatzaktion gewählt hat.
        // Sofort-Guss (`gs._immediateActionContext`, Chaos Diamond …): der Guss IST schon die Zusatzaktion — Sperre ohne Frage, nichts wird verbraucht.
        const sofort = !!gs._immediateActionContext;
        const inhaerent = !sofort && gs._spellWasInherent === true;      // von der Engine als Zusatzaktion gespielt (Skript `inherentAction`)
        let zusatzaktion = true;
        if (inhaerent) {
          if (engine.hasPayableActionFor?.(pi, CARD_NAME, heroIdx)) {
            const ja = await engine.promptGeneric(pi, {
              type: 'confirm',
              title: CARD_NAME,
              message: `${discarded} card${discarded === 1 ? '' : 's'} discarded. Count ${CARD_NAME} as an additional Action? If you do, you cannot interact with your opponent's hand for the rest of the turn.`,
              showCard: CARD_NAME,
              confirmLabel: 'Additional Action',
              cancelLabel: 'Normal Action',
              cancellable: true,
            });
            zusatzaktion = typeof engine._confirmSaidYes === 'function' ? engine._confirmSaidYes(ja) : !!(ja && !ja.cancelled);
          } else {
            zusatzaktion = false;
          }
          if (!zusatzaktion) {
            gs._spellForcesActionConsume = true;       // normale Aktion: die nächste verfügbare wird bezahlt (server.js, wie Curse / Forbidden Curse of Aging)
            engine.log('rumor_normal_action', { player: ps.username });
          }
        } else if (!sofort) {
          zusatzaktion = false;                          // schon als normale Aktion bezahlt (kein Zusatzaktions-Weg) — keine Sperre
        }
        if (zusatzaktion) {
          // Zusatzaktion gewählt — inherent stays. Apply the opp-hand-
          // interaction lock per card text. The engine's inherent
          // path already consumed nothing, so no further action
          // bookkeeping is needed.
          ps._oppHandInteractionLockedTurn = gs.turn;
          ps.oppHandLocked = true;   // W16g (S03-02): auch fuer Slow und Arthor (gleiche Regel, zweite Flagge)
          engine.log('rumor_inherent', { player: ps.username });
        }
      } else {
        // Fumble — revoke the inherent status. Server-side rider
        // (in doPlaySpell) consumes an additional-action provider
        // if available, else advances to Action Phase / Main 2 to
        // mark the main Action spent.
        gs._spreadingRumorFumbled = {
          pi, heroIdx, cardName: CARD_NAME,
        };
        engine.log('rumor_fumbled', { player: ps.username });
      }

      engine.sync();
    },
  },
};

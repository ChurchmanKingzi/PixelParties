// ═══════════════════════════════════════════
//  CARD EFFECT: "End of the Future"
//  Spell (Normal, Lv 0, Destruction Magic, Secret Rare) — Mini-Archetyp
//
//  „When you draw this card as part of your starting hand: You may
//   immediately reveal it. You can only play this card while it is revealed
//   by its own effect. Choose any target and deal damage equal to 50 times
//   the number of cards in your hand to it. Immediately end your turn
//   afterwards. This Spell can never affect more than 1 target."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Startblatt-Fenster (siehe Glimpse of the Future): Aufdecken ist
//    freiwillig. Aufgedeckt = Marke `ps._selfRevealedHandIndices[i]` je
//    PHYSISCHER Kopie (Handindex-Feld: folgt der Karte durch Umsortieren und
//    faellt weg, sobald sie die Hand verlaesst — „bis sie die Hand verlaesst,
//    egal wohin"). Zusaetzlich die normale dauerhafte Aufdeckung
//    (`_permanentlyRevealedHandIndices`), damit der Gegner sie sieht.
//    ANDERE Aufdeck-Effekte setzen die Eigenmarke nicht → die Karte bleibt
//    unspielbar.
//  • Spielbar nur die selbst aufgedeckte Kopie: `spellPlayCondition` (Grauton
//    nach Name) UND `canPlayFromHandIdx` (die konkrete Kopie, Engine-Gate).
//  • Schaden = 50 × Karten in der Hand OHNE die End of the Future, die gerade
//    gespielt wird. Ein Ziel (`neverMultiTarget`); Zugende zuletzt ueber den
//    kanonischen Hebel `_terrorForceEndTurn` (wie Armageddon), nur wenn das
//    Spiel weitergeht.
// ═══════════════════════════════════════════

const CARD_NAME = 'End of the Future';
const PRO_KARTE = 50;

function kopieOffen(ps, idx) {
  return !!ps?._selfRevealedHandIndices?.[idx] && (ps.hand || [])[idx] === CARD_NAME;
}

module.exports = {
  requiresTarget: true,
  neverMultiTarget: true,

  /** CPU: das Angebot annehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'cardGallery') return undefined;
    const k = (promptData.cards || [])[0];
    return k ? { cardName: k.name, source: k.source } : undefined;
  },

  /** Grauton nach Name: mindestens EINE selbst aufgedeckte Kopie auf der Hand. */
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    return (ps?.hand || []).some((n, i) => n === CARD_NAME && kopieOffen(ps, i));
  },

  /** Die konkret gespielte Kopie muss selbst aufgedeckt sein. */
  canPlayFromHandIdx(gs, pi, handIdx) {
    return kopieOffen(gs.players[pi], handIdx);
  },

  startingHand: {
    async resolve(engine, pi) {
      const ps = engine.gs.players[pi];
      if (!ps) return null;
      // Eine noch NICHT selbst aufgedeckte Kopie suchen.
      const idx = (ps.hand || []).findIndex((n, i) => n === CARD_NAME && !kopieOffen(ps, i));
      if (idx < 0) return null;
      const ok = await engine.promptStartingHandYesNo(pi, CARD_NAME,
        'You may immediately reveal it. You can only play this card while it is revealed by its own effect.',
        '👁️ Reveal!');
      if (!ok) return null;
      // Die Hand kann sich waehrend der Abfrage nicht aendern, aber sicher ist sicher.
      const jetzt = (ps.hand || []).findIndex((n, i) => n === CARD_NAME && !kopieOffen(ps, i));
      if (jetzt < 0) return null;
      if (!ps._selfRevealedHandIndices) ps._selfRevealedHandIndices = {};
      ps._selfRevealedHandIndices[jetzt] = true;
      if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
      ps._permanentlyRevealedHandIndices[jetzt] = true;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine.log('end_of_the_future_reveal', { player: ps.username });
      engine.sync();
      return null;
    },
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Die gespielte Kopie liegt beim Aufloesen noch auf der Hand — sie zaehlt nicht mit.
      const inHand = (ps.hand || []).includes(CARD_NAME) ? 1 : 0;
      const anzahl = Math.max(0, (ps.hand || []).length - inHand);
      const schaden = PRO_KARTE * anzahl;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Deal ${schaden} damage (${PRO_KARTE} × ${anzahl} card${anzahl === 1 ? '' : 's'} in your hand) to a target. Your turn ends afterwards.`,
        confirmLabel: `⏳ ${schaden} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) { gs._spellCancelled = true; return; }

      engine._broadcastEvent('play_zone_animation', {
        type: 'mega_explosion', owner: ziel.owner, heroIdx: ziel.heroIdx,
        zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
      });
      await engine._delay(500);

      if (ziel.type === 'hero') {
        const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (h && h.hp > 0) await ctx.dealDamage(h, schaden, 'destruction_spell');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx ?? -1, heroOwner: ctx.cardHeroOwner ?? pi },
          ziel.cardInstance, schaden, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true });
      }
      engine.log('end_of_the_future', { player: ps.username, hand: anzahl, damage: schaden, target: ziel.cardName });
      engine.sync();

      // „Immediately end your turn afterwards." — nur, wenn das Spiel weitergeht.
      if (gs.result) return;
      gs._terrorForceEndTurn = pi;
      gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      engine.sync();
    },
  },
};

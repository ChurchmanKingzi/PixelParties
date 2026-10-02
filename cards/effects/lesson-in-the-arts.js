// ═══════════════════════════════════════════
//  CARD EFFECT: "Lesson in the Arts"
//  Spell (Magic Arts Lv0, Normal)
//
//  „Attach up to 3 copies of Magic Arts from your hand or deck to the user as
//   additional attachments. Immediately end your turn afterwards."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „up to 3": Der Spieler waehlt nacheinander je eine Kopie (Hand ODER Deck) und kann nach der ersten
//    jederzeit abbrechen. Abbruch VOR der ersten Kopie → Zauber wird nicht gespielt (`_spellCancelled`).
//  • Zusaetzliche Anlage (`skipAbilityGivenCheck`): verbraucht das Anlegen des Helden NICHT; die Zielzone
//    folgt `abilityZielZone` (Stapel bis Level 3, verwahrte/versiegelte Zonen). Auch Magic Arts ueber
//    Level 3 hinaus gibt es nicht — passt keine Kopie mehr, endet die Auswahl.
//  • Spielbar nur mit mindestens 1 Magic Arts auf Hand/Deck UND einem Nutzer, der es aufnehmen kann.
//  • Deck-Kopien laufen als Durchgang ueber die Hand (`handZugangSync` von 'transit') in die kanonische
//    Anlegeroutine; wurde aus dem Deck genommen, wird es am Ende einmal gemischt.
//  • „Immediately end your turn afterwards": `gs._spellEndsTurn = true` (Zug-Ende-Schutz greift, wie Premonition).
// ═══════════════════════════════════════════

const CARD_NAME = 'Lesson in the Arts';
const ABILITY = 'Magic Arts';
const MAX = 3;

/** Kann der Nutzer (Brettseite `hs`, Slot `hi`) noch eine Kopie aufnehmen? */
function kannAufnehmen(engine, hs, hi) {
  return engine.abilityZielZone(hs, hi, ABILITY) >= 0;
}

function kopien(ps, quelle) {
  return (quelle === 'hand' ? (ps.hand || []) : (ps.mainDeck || [])).filter(n => n === ABILITY).length;
}

module.exports = {

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (kopien(ps, 'hand') + kopien(ps, 'deck') === 0) return false;
    if (!engine) return true;
    for (const { physOwner, heroIdx: hi, hero } of engine.heroesControlledBy(pi)) {
      if (hero?.name && hero.hp > 0 && kannAufnehmen(engine, physOwner, hi)) return true;
    }
    return false;
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'cardGallery' && payload?.title === CARD_NAME) {
      const c = payload.cards?.[0];
      return c ? { cardName: c.name, source: c.source } : { cancelled: true };
    }
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const hs = ctx.cardHeroOwner ?? pi;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      let angelegt = 0;
      let ausDeck = false;
      for (let n = 0; n < MAX; n++) {
        if (!kannAufnehmen(engine, hs, heroIdx)) break;
        const galerie = [];
        const h = kopien(ps, 'hand'), d = kopien(ps, 'deck');
        if (h > 0) galerie.push({ name: ABILITY, source: 'hand', count: h });
        if (d > 0) galerie.push({ name: ABILITY, source: 'deck', count: d });
        if (galerie.length === 0) break;

        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
          description: `Attach a copy of ${ABILITY} to ${hero.name} as an additional attachment (${n + 1}/${MAX}).${n > 0 ? ' Cancel to stop here.' : ''}`,
          cards: galerie, confirmLabel: '📖 Attach', cancellable: true,
        });
        if (!wahl || wahl.cancelled || !wahl.cardName) break;
        const quelle = (wahl.source === 'hand' || wahl.source === 'deck') && kopien(ps, wahl.source) > 0
          ? wahl.source : galerie[0].source;

        if (quelle === 'deck') {
          const taken = await engine.takeFromPile(ps, 'deck', ABILITY, { source: CARD_NAME });
          if (!taken) break;
          ausDeck = true;
          engine._broadcastEvent('deck_search_add', { cardName: ABILITY, playerIdx: pi });
          engine.handZugangSync(ps, ABILITY, { von: 'transit', source: CARD_NAME });
        }
        const res = await engine.attachAbilityFromHand(pi, ABILITY, heroIdx, {
          skipAbilityGivenCheck: true, ...(hs !== pi ? { heroOwner: hs } : {}),
        });
        if (!res?.success) break;
        angelegt++;
        await engine._delay(250);
      }

      if (angelegt === 0) {
        if (ausDeck) engine.shuffleDeck(pi);
        gs._spellCancelled = true;   // nichts gewaehlt: der Zauber wird nicht gespielt
        return;
      }
      if (ausDeck) engine.shuffleDeck(pi);
      engine.log('lesson_in_the_arts', { player: ps.username, hero: hero.name, copies: angelegt });
      // „Immediately end your turn afterwards."
      gs._spellEndsTurn = true;
      engine.sync();
    },
  },
};

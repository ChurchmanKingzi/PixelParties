// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaos-Diamond, the Cracked Keeper"
//  Hero — 450 HP / 80 ATK — Destruction Magic + Terror
//
//  „When this is one of your starting Heroes, your Potion Deck must
//   consist of exactly 15 Normal or Attachment Spells with different
//   names whose total levels do not exceed 15. You may spend your
//   Action to reveal the top 2 cards of your Potion Deck and
//   immediately have this Hero perform all Spells among them in order
//   as additional Actions, regardless of their levels. You can only
//   activate this effect if this was one of your starting Heroes. If
//   this is one of your starting Heroes, you can never draw cards from
//   your Potion Deck."
//
//  ── DREI TEILE ────────────────────────────────────────────────────
//  1) DECKBAU (Client `isDeckLegal`/`canAddCard` in app-shared.jsx,
//     Server `potionDeckGroesseOk`): mit ihm im Team nimmt das Potion
//     Deck NUR Normal-/Attachment-Spells, je Name eine Kopie, genau 15,
//     Gesamtlevel ≤ 15. Dort steht die Regel, nicht im Kartenskript.
//
//  2) „STARTING HERO": `onGameStart` stempelt `hero._chaosStarting` — alle
//     Helden, die beim Spielstart auf dem Brett stehen, sind Starthelden.
//     Ein spaeter ins Spiel gekommener Chaos-Diamond (Wiederbelebung,
//     Gabby-artige Wege) traegt den Stempel nicht: kein Effekt, KEINE
//     Zieh-Sperre. Dieselbe Stelle setzt `ps.potionDrawBanned`, das
//     `engine.actionDrawFromPotionDeck` liest („you can never draw") —
//     am SPIELER statt am Helden, damit die Sperre auch bleibt, wenn
//     der Held faellt (der Text sagt „never").
//
//  3) EFFEKT (Aktion): die obersten 2 Karten des Potion Decks werden
//     ZUSAMMEN aufgedeckt (beide Seiten sehen sie), danach giesst der
//     Held jeden SPELL darunter der Reihe nach ueber `_castSpellImmediately` — der
//     echte Zusatzaktions-Weg (Zielwahl, Reaktionsfenster, Ablage,
//     Wisdom-Kosten wie bei Friedhelm), Stufenanforderungen gelten
//     ausdruecklich NICHT. Nach dem Aufdecken ist es Pflicht:
//     Abbruch in der Zielwahl ist gesperrt (`_forceNonCancellable`).
//     Ist der Held zwischendurch handlungsunfaehig (gefallen, Frozen,
//     Stunned, Negated) oder bricht ein Spell ab, wandern die aufgedeckten,
//     nicht aufgeloesten Spells in die ABLAGE. Die Aktion ist in jedem
//     Fall verbraucht (auch wenn kein Spell wirkte). Nicht-Spells unter den
//     beiden bleiben ungenutzt liegen. Beim Aktivieren zeigt der Held einen roten Lichtblitz
//     (`red_lightning`, Client: app-board.jsx ANIM_REGISTRY).
// ═══════════════════════════════════════════

const CARD_NAME = 'Chaos-Diamond, the Cracked Keeper';
const REVEAL_COUNT = 2;
const REVEAL_MS = 900;

/** Die obersten REVEAL_COUNT Karten des Potion Decks, mit „ist Spell"-Flag. */
function oberste(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  return (ps?.potionDeck || []).slice(0, REVEAL_COUNT).map(name => ({
    name, istSpell: db[name]?.cardType === 'Spell',
  }));
}

function kannHandeln(engine, feld, heroIdx) {
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const st = hero.statuses || {};
  return !st.frozen && !st.stunned && !st.negated;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // „You may spend your Action"
  heroEffectActionCost: true,

  cpuMeta: { usesAction: true, dealsDamage: true },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    // „You can only activate this effect if this was one of your starting Heroes."
    if (!hero._chaosStarting) return false;
    return oberste(engine, pi).length > 0;
  },

  cpuShouldUseHeroEffect(engine, pi) {
    const hi = (engine?.gs?.players?.[pi]?.heroes || []).findIndex(h => h?.name === CARD_NAME);
    if (hi < 0) return false;
    const hero = engine.gs.players[pi].heroes[hi];
    if (!hero._chaosStarting || hero.hp <= 0) return false;
    return oberste(engine, pi).some(k => k.istSpell);
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    const feld = ctx.cardHeroOwner ?? pi;

    const aufgedeckt = oberste(engine, pi);
    if (aufgedeckt.length === 0) return false;

    // Der Auftritt: roter Lichtblitz auf dem Helden.
    engine._broadcastEvent('play_zone_animation', {
      type: 'red_lightning', owner: feld, heroIdx, zoneSlot: -1,
    });
    await engine._delay(450);

    // ① BEIDE Karten werden ZUSAMMEN aufgedeckt (Als Vorgabe), erst danach
    // wird aufgeloest.
    for (const k of aufgedeckt) {
      engine._broadcastEvent('card_reveal', { cardName: k.name });
      engine.log('hand_card_revealed', { player: ps.username, card: k.name, by: CARD_NAME });
    }
    await engine._delay(REVEAL_MS);

    // ② Der Reihe nach wirken. Jeder Spell wird frisch im Deck gesucht, weil
    // der Vorgaenger es schon verlassen hat. Was aufgedeckt wurde, aber nicht
    // gewirkt werden kann (Held handlungsunfaehig, Spell bricht ab), geht
    // in die Ablage — nie zurueck aufs Deck.
    const verfallen = [];
    for (const k of aufgedeckt) {
      if (!k.istSpell) continue;                      // Nicht-Spells bleiben liegen
      const poolIndex = (ps.potionDeck || []).indexOf(k.name);
      if (poolIndex < 0) continue;
      if (!kannHandeln(engine, feld, heroIdx)) { verfallen.push(k.name); continue; }

      engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;
      let r = null;
      try {
        r = await engine._castSpellImmediately(pi, heroIdx, k.name, {
          fromZone: 'deck',
          pool: ps.potionDeck,
          poolIndex,
          by: CARD_NAME,
          ...(feld !== pi ? { heroOwner: feld } : {}),
        });
      } finally {
        engine._forceNonCancellable--;
      }
      if (r?.cancelled) verfallen.push(k.name);       // kam zurueck aufs Deck → ablegen
    }

    for (const name of verfallen) {
      if (!(await engine.takeFromPile(pi, 'potionDeck', name, { source: CARD_NAME }))) continue;
      if (!ps.discardPile) ps.discardPile = [];
      ps.discardPile.push(name);
      engine._trackCard(name, pi, 'discard');
      engine._pileFlight(pi, name, 'potionDeck', 'discard');
      engine.log('chaos_diamond_discard', { player: ps.username, card: name });
      engine.sync();
      await engine._delay(300);
    }

    engine.log('chaos_diamond_cast', { player: ps.username, revealed: aufgedeckt.map(k => k.name), unresolved: verfallen });
    engine.sync();
    // Die Aktion ist verbraucht, auch wenn kein Spell wirkte („Eigene Schuld").
    return true;
  },

  hooks: {
    // „starting Heroes": alles, was beim Spielstart auf dem Brett steht.
    onGameStart: (ctx) => {
      const engine = ctx._engine;
      const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
      const hero = ctx.attachedHero ?? engine?.gs?.players?.[feld]?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      hero._chaosStarting = true;
      // „you can never draw cards from your Potion Deck" — am Spieler.
      const ps = engine.gs.players[ctx.cardOwner];
      if (ps) ps.potionDrawBanned = true;
    },
  },
};

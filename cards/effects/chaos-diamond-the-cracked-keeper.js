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
//     aufgedeckt (beide Seiten sehen sie), danach giesst der Held jeden
//     SPELL darunter der Reihe nach ueber `_castSpellImmediately` — der
//     echte Zusatzaktions-Weg (Zielwahl, Reaktionsfenster, Ablage,
//     Wisdom-Kosten wie bei Friedhelm), Stufenanforderungen gelten
//     ausdruecklich NICHT. Nach dem Aufdecken ist es Pflicht:
//     Abbruch in der Zielwahl ist gesperrt (`_forceNonCancellable`).
//     Ist der Held zwischendurch handlungsunfaehig (gefallen, Frozen,
//     Stunned, Negated), faellt der Rest aus und die Karte bleibt
//     oben im Deck. Nicht-Spells unter den beiden bleiben ungenutzt
//     liegen. Beim Aktivieren zeigt der Held einen roten Lichtblitz
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
    // Ohne Spell unter den obersten zwei bliebe die Aktion wirkungslos.
    return oberste(engine, pi).some(k => k.istSpell);
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
    if (!aufgedeckt.some(k => k.istSpell)) return false;

    // Der Auftritt: roter Lichtblitz auf dem Helden.
    engine._broadcastEvent('play_zone_animation', {
      type: 'red_lightning', owner: feld, heroIdx, zoneSlot: -1,
    });
    await engine._delay(450);

    // Aufdecken: beide Seiten sehen die Karten, eine nach der anderen.
    for (const k of aufgedeckt) {
      engine._broadcastEvent('card_reveal', { cardName: k.name });
      engine.log('hand_card_revealed', { player: ps.username, card: k.name, by: CARD_NAME });
      await engine._delay(REVEAL_MS);
    }

    // Reihenfolge von oben nach unten; jeder Spell wird frisch im Deck gesucht,
    // weil der Vorgaenger es schon verlassen hat.
    let gewirkt = 0;
    for (const k of aufgedeckt) {
      if (!k.istSpell) continue;
      if (!kannHandeln(engine, feld, heroIdx)) break;
      const poolIndex = (ps.potionDeck || []).indexOf(k.name);
      if (poolIndex < 0) continue;

      engine._forceNonCancellable = (engine._forceNonCancellable || 0) + 1;
      try {
        const r = await engine._castSpellImmediately(pi, heroIdx, k.name, {
          fromZone: 'deck',
          pool: ps.potionDeck,
          poolIndex,
          by: CARD_NAME,
          ...(feld !== pi ? { heroOwner: feld } : {}),
        });
        if (!r?.cancelled) gewirkt++;
      } finally {
        engine._forceNonCancellable--;
      }
    }

    engine.log('chaos_diamond_cast', { player: ps.username, spells: gewirkt });
    engine.sync();
    // Mindestens ein Spell lief → Aktion verbraucht. Sonst (alles
    // abgebrochen/unmoeglich) bekommt der Spieler sie zurueck.
    return gewirkt > 0;
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

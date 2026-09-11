// ═══════════════════════════════════════════
//  CARD EFFECT: "Tryse, the Shadow Slayer"
//  Hero · 400 HP · 120 ATK · Starting Abilities: Stealth, Stealth
//
//  „Up to 2 times per turn, when this Hero defeats a target your
//   opponent controls, your opponent must discard 2 random cards from
//   their hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „a target" = Held ODER Creature. Deshalb beide Tod-Fenster
//    (`onHeroKO`, `onCreatureDeath`), wie bei Wanted Poster.
//  • „your opponent controls" geht nach KONTROLLE, nicht Besitz: eine
//    Creature, die mir gehoert, aber beim Gegner steht, zaehlt; eine
//    geklaute Creature in meiner Reihe zaehlt nicht.
//  • „this Hero defeats" = die Todesquelle IST dieser Held. Erkannt
//    ueber Besitzer + Heldenindex, wobei eine Creature aus SEINER
//    Support Zone ausgeschlossen wird (`src.zone === 'support'`) —
//    sie teilt den Heldenindex, ist aber ihre eigene Quelle. Exakt der
//    Vertrag von Wanted Poster, nur hier fuer einen Helden.
//    Erfasst damit Angriffe, Attack-/Spell-Karten des Helden, seine
//    Abilities und Effekte, die „treated as an Attack" sind
//    (Heragas-Bauart).
//  • „Up to 2 times per turn" ist die WEICHE Form (Als Regel v249):
//    zwei Ausloesungen je Zug, gezaehlt auf DIESER Instanz. Der
//    Zaehler haengt an einer Zugmarke und braucht deshalb kein
//    Aufraeumen bei Zugwechsel.
//  • „2 random cards" — der Gegner waehlt NICHT. Hat er nur noch eine
//    Karte, geht diese eine weg (so viel wie moeglich).
//
//  ── HAND-INTERAKTION ──────────────────────────────────────────────
//  Zwangs-Abwurf aus fremder Hand ⇒ „Ambush the Scout" muss dagegen
//  greifen koennen. Die Karte steht genau dafuer in PENDING
//  (`_hand-interaction-registry.js`, via: 'manual'). Das Fenster wird
//  EINMAL fuer den ganzen Effekt geoeffnet (`count: 2`) — nicht je
//  abgeworfener Karte; negiert der Gegner, faellt der komplette
//  Abwurf aus. Die beiden Einzel-Abwuerfe laufen danach mit
//  `_skipHandInteractionCheck`, sonst oeffnete jeder ein zweites
//  Fenster.
//
//  KEIN `bypassStatusFilter`: ein negierter, eingefrorener oder
//  betaeubter Held loest nicht aus — das ist die Standardregel, und
//  hier ist sie richtig.
// ═══════════════════════════════════════════

const CARD_NAME = 'Tryse, the Shadow Slayer';
const MAX_PER_TURN = 2;
const DISCARD_COUNT = 2;

/**
 * Ist die Todesquelle DIESER Held? Vertrag wie in Wanted Poster:
 * Besitzer und Heldenindex muessen stimmen, und eine Creature aus
 * seiner eigenen Support Zone zaehlt NICHT (sie teilt den Index, ist
 * aber ihre eigene Quelle). Synthetische Quellen von Attack-/Spell-
 * Karten haben kein `zone`-Feld und gelten als Heldenseite.
 */
function istDieserHeld(ctx) {
  const src = ctx.source;
  if (!src) return false;
  const srcOwner = src.controller ?? src.owner ?? -1;
  if (srcOwner !== ctx.cardOwner) return false;
  if ((src.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  if (src.zone === 'support') return false;
  return true;
}

/** Zwei Ausloesungen je Zug, gezaehlt auf dieser Heldeninstanz. */
function darfNochAusloesen(engine, inst) {
  const c = inst.counters || (inst.counters = {});
  const turn = engine.gs?.turn ?? 0;
  if (c._tryseTurn !== turn) { c._tryseTurn = turn; c._tryseUsed = 0; }
  return (c._tryseUsed || 0) < MAX_PER_TURN;
}
function verbrauche(engine, inst) {
  const c = inst.counters || (inst.counters = {});
  c._tryseUsed = (c._tryseUsed || 0) + 1;
}

/**
 * Der eigentliche Effekt. `opferName` dient nur dem Protokoll.
 */
async function schattenschlag(ctx, opferName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const oppIdx = pi === 0 ? 1 : 0;
  const oppPs = gs.players[oppIdx];
  if (!oppPs || !(oppPs.hand || []).length) return;

  const inst = ctx.card;
  if (!inst || !darfNochAusloesen(engine, inst)) return;

  // Hand-Interaktions-Fenster EINMAL fuer den ganzen Abwurf (siehe
  // Kopfkommentar). Negiert der Gegner, ist der Effekt erledigt — die
  // Ausloesung zaehlt trotzdem als verbraucht, sie hat stattgefunden.
  verbrauche(engine, inst);
  if (await engine.checkHandInteractionReaction(oppIdx, 'discard', {
    byPi: pi, count: DISCARD_COUNT, sourceName: CARD_NAME,
  })) {
    engine.log('tryse_negated', { player: gs.players[pi]?.username });
    return;
  }

  await engine.showTriggeredEffect(CARD_NAME, {
    playerIdx: pi,
    source: `tryse:${gs.turn}:${opferName}`,
  });

  // „2 random cards" — so viele, wie die Hand hergibt. Der Index wird
  // je Runde neu gezogen, weil die Hand zwischendurch schrumpft.
  const abgeworfen = [];
  for (let i = 0; i < DISCARD_COUNT; i++) {
    const hand = oppPs.hand || [];
    if (hand.length === 0) break;
    const idx = Math.floor(Math.random() * hand.length);
    const name = hand[idx];
    const ok = await engine.actionDiscardHandCard(oppIdx, name, idx, {
      source: CARD_NAME,
      sourceOwner: pi,
      _skipHandInteractionCheck: true,
    });
    if (!ok) break;
    abgeworfen.push(name);
  }

  if (abgeworfen.length === 0) return;
  engine.log('tryse_discard', {
    player: gs.players[pi]?.username,
    target: oppPs.username,
    defeated: opferName,
    count: abgeworfen.length,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // Gegnerischer HELD besiegt.
    onHeroKO: async (ctx) => {
      if (!istDieserHeld(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const hero = ctx.hero;
      if (!hero?.name) return;
      // „your opponent controls" — der gefallene Held muss auf der
      // Gegnerseite stehen.
      if ((engine.gs.players?.[oppIdx]?.heroes || []).indexOf(hero) < 0) return;
      await schattenschlag(ctx, hero.name);
    },

    // Gegnerische CREATURE besiegt.
    onCreatureDeath: async (ctx) => {
      if (!istDieserHeld(ctx)) return;
      const pi = ctx.cardOwner;
      const death = ctx.creature;
      if (!death) return;
      if ((death.controller ?? death.owner) === pi) return;   // nur Gegnerseite
      await schattenschlag(ctx, death.name);
    },
  },
};

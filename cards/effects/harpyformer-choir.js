// ═══════════════════════════════════════════
//  CARD EFFECT: "Harpyformer Choir"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a
//    "Summoning Magic" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Summoning Magic
//    Ability from hand. Until the beginning of
//    your next turn, the next damage ANY Creature
//    you control would take is reduced by 100.
//
//  ★ W7a (A07-29, Al 14.10.2026): der Schutz ist eine
//  VERGEBENE Wirkung — er hängt am Spieler
//  (`ps._kreaturenSchild`, Engine
//  `_kreaturenSchadenSchilde`) und überlebt Tod,
//  Frost, Betäubung und Negation des Choir. Er endet
//  beim nächsten Zugbeginn des Besitzers oder mit
//  dem ersten geschützten Treffer.
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME    = 'Harpyformer Choir';
const ABILITY_NAME = 'Summoning Magic';

module.exports = {
  inherentAction: harpyformerInherentAction,

  cpuMeta: {
    // ── Ausspiel-Vorfahrt: muss die ERSTE Kreatur des Zuges sein ────
    // Der Gratis-Zusatzaktions-Vertrag der Harpyformer greift NUR,
    // solange `_creaturesSummonedThisTurn === 0`. Kommt irgendeine
    // andere Kreatur zuerst, ist die Gratis-Aktion für diesen Zug
    // ersatzlos verloren — das ist keine Wertfrage, sondern eine
    // KAUSALE Bedingung, genau der Fall, für den die Vorfahrt gebaut
    // wurde (der Wert-Term geht nur mit Faktor 0.1 in den Score ein und
    // könnte ein negatives Reihenfolge-Gewicht nie überstimmen).
    // Beide Harpyformer tragen dieselbe Stufe; welcher von beiden
    // innerhalb der Stufe zuerst kommt, entscheidet das gelernte
    // Ranking.
    playOrderPriority: 100,
  },

  activeIn: ['support'],
  // ── On summon: search deck for Summoning Magic + shield hook ──────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4 (Al): kein Treffer → wirkt nicht → Blob stumm

      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4 (Al): abgelehntes „you may" → Blob stumm

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: activate the shield ───────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    if (!(ps?.hand || []).includes(ABILITY_NAME)) return false;
    // ★ v1039 (Als Vorgabe 12.9.): „Hat man keine Creatures, sollte
    // Choir nie genutzt werden." Der Schutz gilt der naechsten Kreatur,
    // die Schaden naehme — ohne eine auf dem Brett verpufft die
    // Ability-Karte ersatzlos. Gilt auch fuer den Choir selbst: er IST
    // eine Kreatur und kann sich schuetzen, darum zaehlt er mit.
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const eigene = (engine.cardInstances || []).some(c => {
      if ((c.controller ?? c.owner) !== pi || c.zone !== 'support' || c.faceDown) return false;
      if (engine.isEquipInZone(c.name, c)) return false;
      const cd = engine.getEffectiveCardData(c);
      return !!cd && hasCardType(cd, 'Creature');   // Tokens/Artifact Creatures zaehlen (Als Sweep 9.10.)
    });
    return eigene;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      costKind: 'protect',        // ★ v1039: Lernkanal-Lage passend zur Gegenleistung
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to reduce the next damage a Creature you control takes by 100 until your next turn.`,
      source: CARD_NAME,
      logType: 'choir_discard',
    });
    if (!ok) return false;

    // Schutz am SPIELER vergeben (überlebt den Choir; Engine `_kreaturenSchadenSchilde`)
    (ps._kreaturenSchild = ps._kreaturenSchild || []).push({ by: CARD_NAME, reduce: 100, turn: gs.turn });
    engine.log('choir_shield_active', { player: ps.username });

    engine.sync();
    return true;
  },
};

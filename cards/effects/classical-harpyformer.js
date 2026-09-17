// ═══════════════════════════════════════════
//  CARD EFFECT: „Classical Harpyformer"
//  Creature (Summoning Magic Lv 0, 50 HP, PP MBS1)
//  Archetyp: Harpyformers
//
//  „If this is the first Creature you summon during your turn,
//   summoning it counts as an additional Action. When you summon this
//   Creature, you may search your deck for a Wealth Ability, reveal it
//   and add it to your hand. You may once per turn discard a Wealth
//   Ability from your hand to gain 5 Gold."
//
//  BAUART — die Familienform der Harpyformer, drei Klauseln:
//  ──────
//  ① `inherentAction: harpyformerInherentAction` — die Gratis-
//     Zusatzaktion greift nur, solange in diesem Zug noch KEINE Kreatur
//     beschworen wurde. Das ist eine kausale Bedingung, keine
//     Wertfrage; deshalb traegt die Karte wie ihre Geschwister
//     `playOrderPriority: 100`, damit die CPU sie VOR anderen Kreaturen
//     spielt — sonst ist die Gratis-Aktion ersatzlos verloren.
//
//  ② ★ OHNE KOSTEN, ANDERS ALS SKA: Ska bezahlt seine Suche mit 50
//     Schaden am Wirtshelden, „Classical" nicht — der Text nennt keine
//     Kosten. Das „you may" bleibt: gefragt wird trotzdem, denn die
//     Suche deckt die Karte dem Gegner auf.
//
//  ③ Einmal je Zug: eine „Wealth"-Ability von der Hand abwerfen fuer
//     5 Gold. Abwurf ueber `harpyformerDiscardCost` (feuert den
//     regulaeren Abwurf-Hook, damit „wenn abgeworfen"-Karten
//     mitbekommen, was passiert), Gold ueber `actionGainGold` — das
//     achtet auf die Goldsperre (Golden Arrow).
// ═══════════════════════════════════════════

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

const CARD_NAME    = 'Classical Harpyformer';
const ABILITY_NAME = 'Wealth';
const GOLD         = 5;

module.exports = {
  inherentAction: harpyformerInherentAction,

  cpuMeta: {
    // Siehe Kopf ①: muss die ERSTE Kreatur des Zuges sein, sonst
    // verfaellt die Gratis-Zusatzaktion. Gleiche Stufe wie die
    // uebrigen Harpyformer.
    playOrderPriority: 100,
  },

  // Die CPU nimmt die Suche mit — sie kostet nichts.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      // „you may" — die Suche deckt die Karte auf, also wird gefragt.
      const ja = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability, reveal it and add it to your hand?`,
      });
      if (!ja) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
      engine.sync();
    },
  },

  // ── Einmal je Zug: Wealth abwerfen fuer 5 Gold ───────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      costKind: 'gold',        // ★ v1038: Lernkanal-Lage passend zur Gegenleistung
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to gain ${GOLD} Gold.`,
      source: CARD_NAME,
      logType: 'classical_discard',
    });
    if (!ok) return false;                      // ohne Abwurf kein HOPT-Stempel

    await engine.actionGainGold(pi, GOLD, { source: CARD_NAME });
    engine.log('classical_harpyformer_gold', { player: ps.username, amount: GOLD });
    engine.sync();
    return true;
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Black Marketeer"
//  Creature (Summoning Magic Lv0) — 50 HP, kein Angriff
//
//  Drei Klauseln:
//   1. Beim Beschwoeren: bis zu 5 Karten aus der eigenen Ablage ins
//      Deck zurueckmischen, 4 Gold je Karte.
//   2. Einmal je Zug: eine Karte aus der Ablage ins Deck, 4 Gold.
//   3. Nur EINE Beschwoerung je Spieler und Spiel.
//
//  ── ALS VORGABEN (25.8., bindend) ─────────────────────────────
//  · Klausel 3 zaehlt JEDE Beschwoerung von ueberall, auch durch
//    Effekte — nicht nur das regulaere Ausspielen aus der Hand.
//    Ausgenommen ist nur, was gar nicht erst zur Beschwoerung kommt.
//    Vorbild: die Harpyformer, die ihren On-Summon ueber `hooks.onPlay`
//    haengen und damit jede Herkunft erwischen.
//  · Der Riegel gilt JE SPIELER, nicht je Spiel. Beide Seiten duerfen
//    ihren einen Marketeer beschwoeren.
//  · Klausel 1 ist KEINE Kosten, sondern ein durchweg positiver
//    Effekt. Null Karten zu waehlen ist erlaubt, aber schlecht —
//    entsprechend muss die CPU ihn umso hoeher bewerten, je voller die
//    Ablage ist, gedeckelt bei 5.
//  · Klausel 2 nur im EIGENEN Zug, wie bei Haressassin und den anderen
//    aktiven Kreaturen-Effekten.
//
//  ── WARUM DER RIEGEL AUF `gs` LIEGT ───────────────────────────
//  Waehrend der MCTS-Rollouts wird der Spielzustand gesichert und
//  zurueckgerollt. Ein Zaehler ausserhalb von `gs` wuerde von
//  `restore()` NICHT zurueckgedreht — die Suche wuerde den Riegel in
//  einer Planungskopie verbrauchen und er waere im echten Spiel weg.
//  Deshalb steht die Marke unter `gs.players[pi]`, genau wie
//  `_deepseaPerTurnSummoned` beim Rundenlimit der Deepseas.
// ═══════════════════════════════════════════

const CARD_NAME  = 'Black Marketeer';
const GOLD_JE    = 4;
const MAX_PICKS  = 5;

/** Hat dieser Spieler seinen einen Marketeer schon beschworen? */
function schonBeschworen(gs, pi) {
  const ps = gs?.players?.[pi];
  return !!(ps && ps._marketeerSummoned);
}

function markiereBeschworen(ctx) {
  // KOPIERTE On-Summon-Effekte zaehlen NICHT als Beschwoerung dieser
  // Karte — dieselbe Unterscheidung wie beim Deepsea-Rundenlimit:
  // limitiert ist das SUMMONEN, nicht das Ausloesen des Effekts.
  // Monstrosity, die den On-Summon kopiert, hat keinen Marketeer
  // beschworen und darf seinen Riegel nicht verbrauchen.
  if (ctx?._monstrosityCopy) return;
  const ps = ctx?._engine?.gs?.players?.[ctx.cardOwner];
  if (!ps) return;
  ps._marketeerSummoned = true;
}

/** Eindeutige Namensliste der eigenen Ablage als Galerie. */
function ablageGalerie(ps) {
  const gesehen = new Set();
  const galerie = [];
  for (const n of (ps?.discardPile || [])) {
    if (gesehen.has(n)) continue;
    gesehen.add(n);
    galerie.push({ name: n, source: 'discard' });
  }
  return galerie;
}

/** Gemeinsamer Ablauf: Karten waehlen, mischen, Gold gutschreiben. */
async function recycleUndGold(ctx, maxPicks, titelZusatz) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const ps = engine.gs.players[pi];
  const galerie = ablageGalerie(ps);
  if (!galerie.length) return 0;

  const wahl = await ctx.promptCardGalleryMulti(galerie, {
    title: CARD_NAME,
    description: titelZusatz,
    selectCount: Math.min(maxPicks, galerie.length),
    minSelect: 1,
    cancellable: true,
    menuSource: CARD_NAME,
  });
  const gewaehlt = wahl?.selectedCards || [];
  if (!gewaehlt.length) return 0;

  const recycelt = await engine.actionRecycleCards(pi, gewaehlt, {
    source: CARD_NAME,
    shuffle: true,
  });
  const anzahl = (recycelt || []).length;
  if (!anzahl) return 0;

  await ctx.gainGold(GOLD_JE * anzahl);
  engine.log('black_marketeer_recycle', {
    player: ps.username, cards: recycelt, count: anzahl, gold: GOLD_JE * anzahl,
  });
  engine.sync();
  return anzahl;
}

module.exports = {
  // Mischt aus der Ablage ins eigene Deck zurueck. Distracting Crystal
  // sperrt genau das, und Hatusbal liest es mit — ohne diese Marke
  // waere die Karte fuer beide unsichtbar.
  shufflesFromHandOrDiscardIntoDeck: true,

  activeIn: ['support'],
  creatureEffect: true,

  /**
   * Klausel 3, Vorderseite: die Karte steht gar nicht erst zur
   * Beschwoerung, wenn dieser Spieler seinen Marketeer schon hatte.
   * Client-Ausgrauen und CPU lesen beide hierueber, damit die CPU nie
   * mehr Beschwoerungen bekommt als ein Mensch.
   */
  canSummon(ctx) {
    return !schonBeschworen(ctx?._engine?.gs, ctx?.cardOwner);
  },

  /**
   * Klausel 2: einmal je Zug eine Karte recyceln.
   * Die Einmal-je-Zug-Sperre setzt die ENGINE selbst
   * (`hoptUsed['creature-effect:<id>']`), sobald wir `true`
   * zurueckgeben — ein eigener Zaehler waere eine zweite Wahrheit.
   * Abbruch liefert `false` und kostet damit nichts.
   */
  canActivateCreatureEffect(ctx) {
    const ps = ctx?._engine?.gs?.players?.[ctx.cardOwner];
    return (ps?.discardPile || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const anzahl = await recycleUndGold(ctx, 1,
      `Shuffle 1 card from your discard pile back into your deck and gain ${GOLD_JE} Gold.`);
    return anzahl > 0;
  },

  hooks: {
    /**
     * Klausel 1 + 3, Rueckseite. `onPlay` ist der On-Summon-Vertrag und
     * feuert bei JEDER Herkunft — Hand, Wiederbelebung, Effekt —, genau
     * wie bei den Harpyformern. Wird die Beschwoerung negiert, laeuft
     * der Hook gar nicht erst, und der Riegel bleibt frei.
     */
    onPlay: async (ctx) => {
      markiereBeschworen(ctx);

      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      if (!ps || !(ps.discardPile || []).length) return;

      await recycleUndGold(ctx, MAX_PICKS,
        `Shuffle up to ${MAX_PICKS} cards from your discard pile back into your deck `
        + `and gain ${GOLD_JE} Gold each.`);
    },
  },

  /**
   * CPU-Bewertung (Als Vorgabe: 》umso wertvoller, je mehr Karten im
   * Discard, capping out at 5《).
   *
   * ★ EINSCHRAENKUNG, ehrlich benannt: der vorhandene Vertrag
   * `cpuMeta.handValueAsGoldGain` wird in `estimateHandCardValueFor`
   * als ZAHL gelesen (`typeof goldGain === 'number'`) — er kann den
   * Ablagestand also nicht mitlesen. Der Wert unten ist deshalb eine
   * bewusste Schaetzung fuer die mittlere Partie: drei verwertbare
   * Karten in der Ablage, also 12 Gold.
   *
   * Der Zahlenwert ist nicht wirkungslos: er laeuft durch
   * `computeGoldDemand` und wird gegen den aktuellen Goldbedarf
   * verrechnet — bei gesaettigtem Gold faellt er auf ein Fuenftel, bei
   * Knappheit zaehlt er doppelt. Die Karte wird also situativ bewertet,
   * nur eben nicht nach der Ablage.
   *
   * Fuer die volle Vorgabe muesste `handValueAsGoldGain` auch eine
   * FUNKTION (engine, pi) annehmen duerfen — so wie `cpuMeta.alwaysCommit`
   * es bereits tut. Das ist eine Aenderung an `_cpu.js` und damit am
   * SPIELVERHALTEN aller Decks; mitten im laufenden Sammellauf waeren
   * die Wellen danach nicht mehr vergleichbar. Deshalb erst danach.
   */
  cpuMeta: {
    handValueAsGoldGain: 12,
  },
};

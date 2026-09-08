// ═══════════════════════════════════════════
//  CARD EFFECT: „Monster Nest"
//  Creature (Summoning Magic Lv 2, 150 HP, kein ATK)
//
//  „You may once per turn choose a level 3 or lower Creature from your
//   deck and place it on top of this card. This counts as that Creature
//   being summoned. When you do, the new Creature replaces this one
//   until the end of the turn. At the end of your turn, remove any
//   Creature placed on top of this one and delete it. This doesn't
//   count as the Creature being defeated."
//
//  ── ALS RULINGS (5.9.) ─────────────────────────────────────────────
//  • Solange oben eine Kreatur liegt, ist Monster Nest KOMPLETT
//    verdeckt: nicht zielbar, zaehlt nicht als kontrollierte Kreatur.
//  • Stirbt die obenliegende Kreatur noch in derselben Runde, ist das
//    Nest SOFORT wieder normal da.
//  • Darstellung wie Copy Device / Performance: der Platz zeigt die
//    obenliegende Kreatur, beim Hovern kommt das Nest zum Vorschein.
//
//  ── WAS DIE KARTE SELBST TUT UND WAS DAS MODUL TUT ─────────────────
//  Die Verdeck-Mechanik (Platz raeumen, Zone `nested`, Auftauchen,
//  Loeschen ohne Tod) liegt vollstaendig in `_nest-shared.js` — sie ist
//  nicht kartenspezifisch und die naechste Karte dieser Bauform nimmt
//  sie unveraendert. Hier steht nur, WANN das passiert.
//
//  ── „This counts as that Creature being summoned" ──────────────────
//  Deshalb `summonCreatureWithHooks` und nicht `actionPlaceCreature`:
//  onPlay / onCardEnterZone feuern, `_creaturesSummonedThisTurn` zaehlt
//  hoch, `turnPlayed` wird gestempelt (Beschwoerungskrankheit), und die
//  eigenen Beschwoerungsbedingungen der gelegten Kreatur (`canSummon`,
//  `beforeSummon`-Tribute) gelten wie bei jeder anderen Beschwoerung.
//
//  ── Once per turn ──────────────────────────────────────────────────
//  Blosses „Once per turn" = WEICH, pro Instanz (Regel ab v249): das
//  ist genau die Standard-HOPT des Creature-Effekts
//  (`creature-effect:<instId>`), also nichts extra zu bauen. Freie
//  Aktivierung — der Text nennt keine Aktionskosten.
// ═══════════════════════════════════════════

const { isPileCreature, isArtifactCreature, ZONES } = require('./_hooks');
const nest = require('./_nest-shared');

const CARD_NAME = 'Monster Nest';
const MAX_LEVEL = 3;

/**
 * Namen im Deck, die dieses Nest legen darf — entdoppelt, mit
 * Stueckzahl, alphabetisch.
 *
 * Level: ueber `effectiveCardLevel`, nicht ueber `cd.level`. Das ist
 * der kanonische Weg im Projekt (siehe `_area-shared`, Vullary) und
 * laesst Level-Senker wie Elven Forager mitzaehlen — dieselbe Zahl,
 * die der Rest des Spiels fuer diese Karte sieht.
 *
 * Artifact Creatures fallen raus: sie sind NUR in einer Support Zone
 * Kreaturen (Als Ruling 17.8.), im Deck also Artefakte. Der zentrale
 * Riegel in `summonCreatureWithHooks` wuerde sie ohnehin abweisen —
 * die Galerie soll aber gar nicht erst luegen.
 */
function eligibleFromDeck(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const zaehler = new Map();
  for (const cn of (ps.mainDeck || [])) {
    const cd = cardDB[cn];
    if (!cd) continue;
    if (!isPileCreature(cd)) continue;
    if (isArtifactCreature(cd)) continue;
    if (engine.effectiveCardLevel(cd, pi) > MAX_LEVEL) continue;
    zaehler.set(cn, (zaehler.get(cn) || 0) + 1);
  }
  return [...zaehler.entries()]
    .map(([name, count]) => ({ name, source: 'deck', count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  // `nested` ist Pflicht: waehrend das Nest verdeckt ist, muss sein
  // Aufraeumen am Zugende trotzdem laufen. Ohne den Eintrag verwirft
  // `CardInstance.isActiveIn` alle Hooks der verdeckten Instanz und die
  // gelegte Kreatur bliebe fuer immer liegen.
  activeIn: ['support', ZONES.NESTED],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    // Ein bereits verdecktes Nest hat keinen aktivierbaren Effekt mehr
    // — es liegt gar nicht auf dem Brett. Der Server kaeme hier zwar
    // ohnehin nicht durch (er sucht die Instanz im Support-Platz), aber
    // die Bedingung wird auch von geliehenen Ausloesern gefragt
    // (`reactivateCreatureEffect`, v752).
    if (inst.zone !== 'support') return false;
    if (inst.counters?._nestCoverId) return false;
    return eligibleFromDeck(engine, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps || inst.zone !== 'support') return false;

    const gallery = eligibleFromDeck(engine, pi);
    if (gallery.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Choose a level ${MAX_LEVEL} or lower Creature from your deck. It is summoned on top of this card and replaces it until the end of the turn.`,
      confirmLabel: '🪺 Place it!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;

    const chosen = picked.cardName;
    const deckIdx = (ps.mainDeck || []).indexOf(chosen);
    if (deckIdx < 0) return false;

    const heroIdx = inst.heroIdx;
    const zoneSlot = inst.zoneSlot;

    if (!(await engine.takeFromPile(ps, 'deck', deckIdx, { source: CARD_NAME }))) return false;   // v820: Stapel-Schicht

    // ── SICHTBARE WANDERUNG VOM DECK IN DIE ZONE (v776) ─────────────
    // Als Vorgabe 5.9.: die Kreatur soll vom Deckstapel in die Support
    // Zone fliegen, WAEHREND das Nest dort liegen bleibt. Deshalb laeuft
    // der Flug VOR `sink` und vor der Beschwoerung — in dieser Zeit ist
    // das Nest noch eine ganz normale Karte im Platz (samt richtiger
    // HP-Anzeige), und die Kreatur wandert sichtbar darauf zu.
    // `play_card_transfer` bringt seinen Klang mit; es entsteht KEINE
    // neue Animation.
    const FLUG_MS = 700;
    engine._broadcastEvent('play_card_transfer', {
      cardName: chosen,
      sourceOwner: pi, sourceZoneKind: 'deck', sourceHeroIdx: heroIdx, sourceZoneSlot: -1,
      targetOwner: pi, targetHeroIdx: heroIdx, targetZoneSlot: zoneSlot,
      duration: FLUG_MS,
    });
    engine.sync();
    await engine._delay(FLUG_MS);

    // Das Nest sinkt LOGISCH unter die Karte, die gleich kommt — sein
    // Name bleibt dabei im Platz stehen (siehe `_nest-shared.sink`).
    if (nest.sink(engine, inst) < 0) {
      ps.mainDeck.push(chosen);
      engine.shuffleDeck(pi, 'main');
      return false;
    }

    const res = await engine.summonCreatureWithHooks(chosen, pi, heroIdx, zoneSlot, {
      source: CARD_NAME,
      // Ueberbaut die verdeckte Karte, statt den Platz zu ueberschreiben.
      coverNested: true,
      hookExtras: { _summonedBy: CARD_NAME, _summonedFromDeck: true },
    });

    if (!res?.inst) {
      // Beschwoerung abgelehnt (eigene Bedingung, unbezahlbarer Tribut,
      // gesperrte Zone …) — vollstaendig zuruecknehmen: Karte zurueck
      // ins Deck, Nest wieder hoch. Der Effekt gilt als nicht benutzt.
      nest.surface(engine, inst, { by: 'summon_failed' });
      ps.mainDeck.push(chosen);
      engine.shuffleDeck(pi, 'main');
      engine.sync();
      return false;
    }

    // Landete die Kreatur wider Erwarten woanders (ein Cross-Side-Hinweis
    // oder eine Umleitung koennte den Platz verschieben), zieht das Nest
    // mit: es liegt per Definition unter DIESER Karte. Sonst zeigte der
    // Abgleich sofort „nichts liegt oben" und holte das Nest wieder hoch.
    if (res.actualSlot != null && res.actualSlot !== zoneSlot) {
      inst.zoneSlot = res.actualSlot;
    }
    if (res.inst.heroIdx !== inst.heroIdx) {
      inst.heroIdx = res.inst.heroIdx;
      inst.zoneSlot = res.inst.zoneSlot;
    }

    // Gegenseitige Marken: die Kreatur weiss, was unter ihr liegt (der
    // Client liest genau das fuer die Hover-Darstellung), das Nest
    // weiss, welche Instanz auf ihm liegt.
    res.inst.counters._nestedUnder = CARD_NAME;
    inst.counters._nestCoverId = res.inst.id;

    engine.shuffleDeck(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: chosen, playerIdx: pi });

    engine.log('nest_covered', {
      player: ps.username, card: chosen, nest: CARD_NAME,
    });

    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosen,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.sync();
    return true;
  },

  hooks: {
    /**
     * „At the end of your turn, remove any Creature placed on top of
     * this one and delete it. This doesn't count as the Creature being
     * defeated."
     *
     * Nur im EIGENEN Zug — die Kreatur liegt also hoechstens bis zum
     * Ende der Runde oben, in der sie gelegt wurde.
     *
     * Ist die Kreatur inzwischen woanders (gebounct, umgezogen,
     * uebernommen), liegt sie nicht mehr „on top of this one" und wird
     * folgerichtig nicht geloescht; `coveringInstance` gibt dann null
     * zurueck und der Abgleich hat das Nest laengst hochgeholt.
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (inst.zone !== ZONES.NESTED) return;
      const pi = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== pi) return;

      const oben = nest.coveringInstance(engine, inst);
      if (oben) {
        await engine.showTriggeredEffect(CARD_NAME);
        engine.log('nest_cleared', {
          player: engine.gs.players[pi]?.username,
          card: oben.name, nest: CARD_NAME,
        });
        await nest.deleteWithoutDefeat(engine, oben, { source: CARD_NAME });
      }
      await nest.reconcile(engine, inst);
    },

    /**
     * Sofortiges Auftauchen, wenn die obenliegende Kreatur stirbt
     * (Als Ruling). Der Todespfad hat ihren Namen zu diesem Zeitpunkt
     * schon aus dem Platz gestrichen.
     */
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (inst.zone !== ZONES.NESTED) return;
      await nest.reconcile(engine, inst);
    },

    /**
     * Zustands-Abgleich als Netz darunter — dieselbe Lehre wie beim
     * Paraseed-Kadaver (v718): nicht jeder Weg vom Brett laeuft ueber
     * `onCreatureDeath`. Der Abgleich ist idempotent und tut nichts,
     * solange oben noch etwas liegt.
     */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (inst.zone !== ZONES.NESTED) return;
      await nest.reconcile(engine, inst);
    },
  },

  /**
   * Der Bewertungshorizont der CPU endet vor dem Zugende, an dem die
   * gelegte Kreatur wieder verschwindet — sie sieht also nur den
   * Gewinn (eine Kreatur mehr auf dem Brett, deren onPlay feuert) und
   * nie die Kosten. Das ist hier ausnahmsweise richtig herum: der
   * Effekt ist gratis und die Karte kommt aus dem Deck, also gibt es
   * kaum eine Lage, in der Nichtstun besser waere.
   */
  cpuMeta: { alwaysCommit: true },
};

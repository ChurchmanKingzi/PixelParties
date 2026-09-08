// ═══════════════════════════════════════════
//  CARD EFFECT: "Baaliel, the Demon General"
//  Hero (400 HP, 40 ATK — Destruction Magic + Leadership)
//
//  „This Hero can summon "Horned Demon" Creatures regardless of their
//   level. Once per turn, summoning a "Horned Demon" with this Hero
//   counts as an additional Action.
//   Whenever a target either player controls is defeated, place a
//   Demon Counter on all "Horned Demon" Creatures on the board."
//
//  Drei Effekte, drei bestehende Vertraege — kein Sondercode nach
//  Kartenname in Engine oder Server:
//
//  ① LEVEL-BYPASS — `canBypassLevelReqForCard`, dasselbe Helden-Gate
//     wie Cute Princess Mary. Horned Demon ist Summoning Magic Lv2,
//     Baaliel hat kein Summoning Magic — ohne den Bypass koennte er
//     seine eigene Kreatur nie beschwoeren. Der Bypass greift NUR fuer
//     Creatures mit „Horned Demon" im Namen (Teilstring, siehe
//     `_demon-counter-shared.js`); alles andere laeuft normal.
//
//  ② GRATIS-BESCHWOERUNG — `grantsInherentActionForCard`, der neue
//     HELDENSEITIGE Zwilling des Karten-Vertrags `inherentAction`
//     (v601). Die Engine fragt beide an derselben Stelle
//     (`cardHasInherentAction`): Listing der spielbaren Karten,
//     Validierung, Legacy-Listen des Servers — die CPU sieht damit
//     dieselbe Legalitaet wie der Mensch. „Once per turn" wird ueber
//     `gs.hoptUsed` gefuehrt (ueberlebt MCTS-Snapshots) und beim
//     tatsaechlichen Beschwoeren in `onAnyActionResolved` gestempelt,
//     das der Server NACH dem Beschwoeren mit `isInherent` feuert.
//     Konsequenz wie bei Quick Attack: die erste Horned-Demon-
//     Beschwoerung der Runde verbraucht NIE die Aktion — auch nicht,
//     wenn sie die erste Aktion der Runde waere. Das ist die Lesart
//     von „counts as an additional Action" im ganzen Spiel.
//
//  ③ DEMON COUNTER — `onCreatureDeath` + `onHeroKO`, beide Seiten
//     („a target EITHER player controls"), Vorbild Time Bomblebee. Ein
//     Zaehler auf JEDEN Horned Demon auf dem Brett, auch die des
//     Gegners. Baaliel muss dafuer LEBEN und handlungsfaehig sein (nicht
//     Frozen/Stunned/Negated) — sein eigener Tod zaehlt daher NICHT
//     (v630, Als Befund: vorher liefen die Zaehler auch bei totem
//     Baaliel weiter, weil `onHeroKO` den Toten-Filter umgeht).
//     Ein Horned Demon, der gerade selbst stirbt, bekommt nichts mehr
//     (`_deathResolved`-Riegel im Sammler).
//
//  Allgemeine Helden-Regel: ist Baaliel Frozen / Stunned / Negated
//  oder tot, feuern seine Hooks nicht (runHooks-Filter) — dann gibt
//  es keine Zaehler; und `canHeroSummon` verweigert ihm ohnehin jede
//  Beschwoerung.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  isHornedDemonName, hornedDemonsOnBoard, placeDemonCounters,
} = require('./_demon-counter-shared');

const CARD_NAME = 'Baaliel, the Demon General';

/** HOPT-Schluessel der Gratis-Beschwoerung — je Baaliel-Instanz (Seite + Slot). */
function freeSummonKey(pi, heroIdx) {
  return `baaliel-free-summon:${pi}:${heroIdx}`;
}
function freeSummonUsed(gs, pi, heroIdx) {
  return gs.hoptUsed?.[freeSummonKey(pi, heroIdx)] === gs.turn;
}

/** Ist diese Karte ein „Horned Demon"-Creature? */
function isHornedDemonCreature(cardData) {
  return !!cardData && hasCardType(cardData, 'Creature') && isHornedDemonName(cardData.name);
}

/** Das besiegte Ziel als Wahrheit: Kreatur ODER Held — beide Hooks laufen hier zusammen. */
async function onTargetDefeated(ctx) {
  if (!ctx.creature && !ctx.hero) return;
  const engine = ctx._engine;
  // v630 (Als Befund): `onHeroKO` traegt `_bypassDeadHeroFilter` — damit
  // feuerte der Hook auch fuer einen TOTEN Baaliel weiter. Ein besiegter,
  // eingefrorener, gestunnter oder negierter Baaliel verteilt keine
  // Zaehler; das schliesst seinen eigenen Tod ein (im Moment des KO ist
  // er bereits tot).
  const self = engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
  if (!self?.name || self.hp <= 0) return;
  if (engine.isHeroIncapacitated(ctx.cardOwner, ctx.cardHeroIdx) || self.statuses?.negated) return;
  const demons = hornedDemonsOnBoard(engine);
  if (demons.length === 0) return;
  // Quellen-Glow auf Baaliel (Discard-Kosmetik-System), dann die Zaehler.
  await engine.effectSourceGlow(ctx.cardOwner, CARD_NAME);
  placeDemonCounters(engine, demons, 1, CARD_NAME);
}

module.exports = {
  activeIn: ['hero'],

  /** ① Horned Demons ohne Level-/Schulpruefung. */
  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData, engine) {
    return isHornedDemonCreature(cardData);
  },

  /**
   * ② Erste Horned-Demon-Beschwoerung der Runde kostet keine Aktion.
   * Signatur wie `canBypassLevelReqForCard`; die Engine ruft es aus
   * `cardHasInherentAction` fuer jeden lebenden Helden.
   */
  grantsInherentActionForCard(gs, playerIdx, heroIdx, cardData, engine) {
    if (!isHornedDemonCreature(cardData)) return false;
    return !freeSummonUsed(gs, playerIdx, heroIdx);
  },

  hooks: {
    /**
     * Stempel der Gratis-Beschwoerung. Feuert NACH dem Beschwoeren
     * (server.js doPlayCreature) mit `isInherent`; nur die eigene
     * Beschwoerung eines Horned Demon durch DIESEN Baaliel zaehlt.
     */
    onAnyActionResolved: async (ctx) => {
      if (ctx.actionType !== 'creature' || !ctx.isInherent) return;
      if (ctx.playerIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      // `ctx.cardName` ist BAALIEL (der Lauscher) — der gespielte Name
      // kommt nur ueber `playedCardName` (siehe server.js doPlayCreature).
      if (!isHornedDemonName(ctx.playedCardName)) return;
      const gs = ctx._engine.gs;
      // Schluessel aus der IDENTITAET DES LAUSCHERS (dieser Baaliel),
      // nicht aus dem Ereignis — die Pruefung darueber stellt sicher,
      // dass beide dasselbe meinen.
      if (freeSummonUsed(gs, ctx.cardOwner, ctx.cardHeroIdx)) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[freeSummonKey(ctx.cardOwner, ctx.cardHeroIdx)] = gs.turn;
      ctx._engine.log('baaliel_free_summon', {
        player: gs.players[ctx.playerIdx]?.username, card: ctx.playedCardName,
      });
    },

    /** ③ Demon Counter bei jeder Niederlage — beide Seiten, Held oder Kreatur. */
    onCreatureDeath: onTargetDefeated,
    onHeroKO: onTargetDefeated,
  },
};

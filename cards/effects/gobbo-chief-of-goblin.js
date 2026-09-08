// ═══════════════════════════════════════════
//  CARD EFFECT: „Gobbo, Chief of Goblin"
//  Hero (600 HP, 90 ATK) — Start-Abilities Fighting + Pillage
//
//  „This Hero can use Attacks regardless of their levels. After
//   performing an Attack with a higher level than this Hero's Fighting
//   level, reduce this Hero's current and max HP by 100 times the
//   difference."
//
//  ── ALS RULINGS (5.9.) ─────────────────────────────────────────────
//  • Die Kosten koennen Gobbo TOETEN: Max HP bleiben bei mindestens 1,
//    die aktuellen HP duerfen auf 0 fallen — dann ist er besiegt.
//  • Die Kosten fallen nur an, wenn der Angriff AUFLOEST. Ein negierter
//    Angriff kostet nichts; ein aufgeloester, der ins Leere geht,
//    kostet trotzdem.
//  • Fuer die Differenz zaehlt das EFFEKTIVE Level des Angriffs —
//    Senkungen (Wisdom, Elven Forager) und Anhebungen zaehlen mit.
//
//  ── AUSLEGUNGEN (5.9., mit Al abgestimmt) ──────────────────────────
//  • Die Reduktion ist KEIN Schaden, sondern eine Statänderung: keine
//    `beforeDamage`/`afterDamage`-Trigger, nicht reduzierbar, nicht
//    negierbar, kein Firewall-Rueckschlag. Der Text sagt „reduce …
//    HP", nicht „deal damage".
//  • Die Level-Freigabe gilt fuer JEDEN Angriff, den dieser Held
//    benutzt — auch wenn ein fremder Effekt ihn ausfuehren laesst.
//  • Die Kosten fallen PRO Angriff an, mehrfach pro Runde.
//  • Der Max-HP-Verlust ist dauerhaft.
//
//  ── WARUM `afterSpellResolved` UND NICHT `onAnyActionResolved` ─────
//  Beide feuern nach einem Angriff, aber nur `afterSpellResolved` ist
//  schon auf „nicht negiert" gefiltert: Server und
//  `_castSpellImmediately` rufen ihn beide ausschliesslich im
//  `!gs._spellNegatedByEffect`-Zweig, und die Marke ist zum Zeitpunkt
//  von `onAnyActionResolved` bereits geloescht. Der Hook heisst zwar
//  „Spell", laeuft aber ausdruecklich auch fuer Attacks (die durch
//  denselben Pfad gehen) — und deckt damit auch Angriffe mit ab, die
//  ein anderer Effekt ausfuehrt (Taio, Call for Help).
//  Ein abgebrochener Guss (`_spellCancelled`) kommt gar nicht erst so
//  weit; er steigt vorher aus und rollt die Aktionsbuchhaltung zurueck.
// ═══════════════════════════════════════════

const { heroFightingLevel } = require('./_hooks');

const CARD_NAME = 'Gobbo, Chief of Goblin';
const HP_JE_STUFE = 100;

/**
 * Ist der gemeldete Angriff DIESER Held?
 *
 * ★ NICHT ueber `ctx.cardOwner` gehen: das Feld meldet den KONTROLLEUR.
 * Bei einem bezauberten Gobbo steht dort der Gegner, und ein Zugriff
 * auf `players[ctx.cardOwner].heroes[heroIdx]` traefe dessen
 * gleichindizierten Helden statt Gobbo (im Repro aufgefallen, 5.9.).
 * Die Heldenreihe, in der die Karte steckt, sagt `ctx.card.owner` —
 * der wechselt nie.
 *
 * `heroIdx` allein reicht ebenfalls nicht: er zeigt immer in die Reihe
 * des BESITZERS, und beide Seiten haben einen Helden 0. Erst
 * `heroOwner` (seit v778 im Vertrag) macht die Meldung eindeutig.
 *
 * Bezaubert oder dauerhaft uebernommen zahlt Gobbo trotzdem — er hat
 * den Angriff ausgefuehrt.
 */
function istDieserHeld(ctx) {
  if (ctx.heroIdx !== ctx.card.heroIdx) return false;
  const besitzer = ctx.heroOwner ?? ctx.casterIdx;
  return besitzer === ctx.card.owner;
}

module.exports = {
  activeIn: ['hero'],

  /**
   * „This Hero can use Attacks regardless of their levels."
   *
   * Ohne Obergrenze — anders als bei Sorin, der nur bis Level 3
   * freigibt. Attacks tragen den EIGENEN cardType `Attack` (Lehre vom
   * 4.9.), nicht Spell mit Subtype.
   */
  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData) {
    return !!cardData && cardData.cardType === 'Attack';
  },

  hooks: {
    /**
     * „After performing an Attack with a higher level than this Hero's
     * Fighting level, reduce this Hero's current and max HP by 100
     * times the difference."
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const cd = ctx.spellCardData;
      if (!cd || cd.cardType !== 'Attack') return;
      if (!istDieserHeld(ctx)) return;

      const besitzer = ctx.card.owner;
      const hero = engine.gs.players[besitzer]?.heroes?.[ctx.card.heroIdx];
      if (!hero || hero.hp === undefined || hero.hp <= 0) return;

      // Effektives Level (Als Ruling): Senkungen und Anhebungen zaehlen
      // mit, gerechnet fuer den Spieler, der den Angriff ausfuehrt.
      const angriffsLevel = engine.effectiveCardLevel(cd, ctx.casterIdx);
      const fighting = heroFightingLevel(engine, besitzer, ctx.card.heroIdx);
      const differenz = angriffsLevel - fighting;
      if (differenz <= 0) return;

      const verlust = HP_JE_STUFE * differenz;
      await engine.showTriggeredEffect(CARD_NAME);

      // Reihenfolge ist wichtig: ERST die Max-HP senken, DANN die
      // aktuellen setzen. `decreaseMaxHp` hebt die aktuellen HP auf
      // mindestens 1 an — liefe es andersherum, holte es einen gerade
      // auf 0 gebrachten Gobbo wieder zurueck (dieselbe Falle wie beim
      // Paraseed-Gifttick, v718).
      const hpVorher = hero.hp;
      engine.decreaseMaxHp(hero, verlust);          // Boden: Max HP 1
      const zielHp = hpVorher - verlust;            // darf rechnerisch <= 0 sein
      hero.hp = Math.max(1, Math.min(zielHp, hero.maxHp));

      engine.log('gobbo_hp_cost', {
        player: engine.gs.players[besitzer]?.username,
        hero: hero.name, attack: ctx.spellName,
        attackLevel: angriffsLevel, fighting, lost: verlust,
        hp: Math.max(0, zielHp), maxHp: hero.maxHp,
      });
      engine.sync();

      // Als Ruling: die aktuellen HP duerfen auf 0 — dann ist er
      // besiegt. Der kanonische Weg dorthin ist `actionDefeatHero`; er
      // oeffnet das Vor-Niederlage-Fenster (Escape & Co., v718) und
      // faehrt danach den vollen Todesablauf. Er verlangt HP > 0, um
      // ueberhaupt anzulaufen — deshalb steht Gobbo eine Zeile weiter
      // oben vorlaeufig auf 1, ohne dass ein Versand dazwischen liegt.
      if (zielHp <= 0) {
        await engine.actionDefeatHero(ctx.card, hero, { reason: CARD_NAME });
      }
    },
  },

  /**
   * KEIN CPU-Vertrag noetig — und `cpuShouldPlay` waere hier auch der
   * falsche: den liest der Planer vom Skript der GESPIELTEN Karte
   * (Artefakte / Potions), nicht vom Helden.
   *
   * Braucht es aber gar nicht: die Kosten sind eine echte
   * Zustandsaenderung am Helden, und der MCTS-Rollout bewertet den
   * Zustand NACH der Aktion. Verliert Gobbo 300 HP fuer einen Angriff,
   * sieht `evaluateState` genau das — anders als bei Effekten, deren
   * Preis erst spaeter oder ausserhalb des Horizonts anfaellt.
   */
};

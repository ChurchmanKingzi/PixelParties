// ═══════════════════════════════════════════
//  CARD EFFECT: "\"Bloom\", the Continent Corruptor"
//  Ascended Hero — 500 HP / 80 ATK
//
//  „You must immediately play this Hero from your hand on top of a
//   \"Bloom, the Maniacal Botanist\" you control when it is defeated by
//   the Poison of a \"Paraseed\". This condition cannot be negated or
//   substituted. Ascending this Hero does not end your turn. When this
//   Hero Ascends, its current and max HP become 500. Damage this Hero
//   would take from Poison is applied as healing instead. Before a
//   Hero with a \"Paraseed\" in its Support Zones takes Poison damage,
//   increase that Poison's damage by 100.\"
//
//  Bauform
//  ───────
//  • `ascendsFromDefeat: true` (v718, neuer Engine-Vertrag): der
//    Aufstieg traegt einen GEFALLENEN Helden. `performAscension`
//    weist sonst jeden Helden mit hp <= 0 ab — hier ist der Tod aber
//    genau die gedruckte Bedingung. Die HP setzt der Bonus unten.
//  • „You MUST\" — der Aufstieg wird nicht angeboten, sondern
//    ausgefuehrt: `onHeroKO` feuert aus der HAND (`activeIn` enthaelt
//    'hand') und ruft `performAscension` selbst auf. Kein Prompt,
//    keine Abfrage, keine CPU-Entscheidung.
//  • „cannot be negated or substituted\": der Aufstieg laeuft ueber
//    `skipCondition` NICHT — er erfuellt seine eigene Bedingung
//    regulaer (`ascensionCondition` liest denselben Stempel, den der
//    KO-Hook setzt), und `isAscensionConditionUnskippable` bleibt
//    damit unberuehrt.
//  • Die Umkehr des Gifts sitzt in `beforeDamage`: Betrag auf 0
//    setzen und stattdessen heilen. Die +60-Aura ist dieselbe
//    Bauform wie bei der Grundform, nur mit festem Betrag.
// ═══════════════════════════════════════════

const {
  BLOOM, countParaseedsOnHero, heroHasParaseed,
} = require('./_paraseed-shared');

const CARD_NAME = '"Bloom", the Continent Corruptor';
const AURA_BONUS = 100;   // v718 Balance (Al 4.9.): war 60
const ASCEND_HP = 500;

/** Stempel, den der KO-Hook setzt und die Bedingung liest. */
function stempelKey(pi, heroIdx) { return `bloomAscend:${pi}-${heroIdx}`; }

module.exports = {
  // 'hand': der erzwungene Aufstieg feuert, waehrend die Karte noch
  // auf der Hand liegt. 'hero': die beiden Auren wirken vom Brett.
  activeIn: ['hand', 'hero'],

  // Neuer Engine-Vertrag (v718): Aufstieg aus dem Tod heraus.
  ascendsFromDefeat: true,

  // „Ascending this Hero does not end your turn.\"
  blockEndPhaseOnAscend: true,

  cpuMeta: { dealsDamage: true, isHealing: true },

  /**
   * Gedruckte Aufstiegsbedingung. Sie ist erfuellt, wenn genau die
   * Situation vorliegt, die der KO-Hook gestempelt hat: die Grundform
   * ist am Gift einer Paraseed gefallen.
   */
  ascensionCondition(gs, pi, heroIdx, engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.name !== BLOOM) return false;
    return gs._bloomAscendReady?.[stempelKey(pi, heroIdx)] === gs.turn;
  },

  /** „its current and max HP become 500\" */
  async onAscensionBonus(engine, pi, heroIdx) {
    const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
    if (!hero) return;
    hero.maxHp = ASCEND_HP;
    hero.hp = ASCEND_HP;
    delete hero.maxHpCapped;
    delete hero.diedOnTurn;
    delete hero._koProcessed;
    engine.sync();
  },

  hooks: {
    // ── DER ZWANG ────────────────────────────────────────────────
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      // Nur aus der Hand — die Brettform hat hier nichts zu tun.
      if (ctx.cardZone !== 'hand') return;
      const pi = ctx.cardOwner;

      const gefallen = ctx.hero;
      if (!gefallen?.name || gefallen.name !== BLOOM) return;
      if (gefallen.hp > 0) return;                   // schon gerettet

      // Der Held muss MIR gehoeren („a Bloom you control\").
      let owner = -1, heroIdx = -1;
      for (let p = 0; p < (gs.players || []).length && heroIdx < 0; p++) {
        const hi = (gs.players[p]?.heroes || []).indexOf(gefallen);
        if (hi >= 0) { owner = p; heroIdx = hi; }
      }
      if (heroIdx < 0) return;
      // `performAscension` arbeitet auf der SPALTE des Spielers: die
      // Karte kommt aus meiner Hand, der Held muss also auch in meiner
      // Spalte stehen. Ein per Paraseed Control uebernommener fremder
      // Bloom steigt darueber nicht auf — bewusste Grenze, kein Bug.
      if (owner !== pi) return;
      if (engine.heroSideOf(owner, gefallen) !== pi) return;

      // „defeated by the Poison of a 'Paraseed'\" — Giftschaden UND
      // eine Paraseed in seinen Zonen.
      if (ctx.type !== 'poison') return;
      if (!heroHasParaseed(engine, owner, heroIdx)) return;

      const handIdx = (gs.players[pi]?.hand || []).indexOf(CARD_NAME);
      if (handIdx < 0) return;

      // Stempel setzen, damit `ascensionCondition` traegt, und sofort
      // aufsteigen. Kein Prompt: der Text sagt „must\".
      if (!gs._bloomAscendReady) gs._bloomAscendReady = {};
      gs._bloomAscendReady[stempelKey(owner, heroIdx)] = gs.turn;
      try {
        await engine.showTriggeredEffect(CARD_NAME);
        await engine.performAscension(pi, heroIdx, CARD_NAME, handIdx);
      } finally {
        delete gs._bloomAscendReady[stempelKey(owner, heroIdx)];
      }
    },

    // ── Gift heilt mich, und verstaerkt es bei Paraseed-Traegern ──
    beforeDamage: async (ctx) => {
      if (ctx.type !== 'poison') return;
      const engine = ctx._engine;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;
      if (ctx.cardZone !== 'hero') return;           // nur vom Brett

      const selbst = engine.gs.players[ctx.cardHeroOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!selbst?.name || selbst.hp <= 0) return;

      // (a) Trifft es mich selbst? Dann wird geheilt statt geschadet.
      if (ziel === selbst) {
        const betrag = ctx.amount;
        ctx.setAmount(0);
        ctx.cancel();
        if (betrag > 0) {
          await engine.actionHealHero(ctx.card, selbst, betrag);
        }
        return;
      }

      // (b) Sonst die Aura: +60 fuer jeden Paraseed-Traeger.
      let owner = -1, heroIdx = -1;
      for (let pi = 0; pi < (engine.gs.players || []).length && heroIdx < 0; pi++) {
        const hi = (engine.gs.players[pi]?.heroes || []).indexOf(ziel);
        if (hi >= 0) { owner = pi; heroIdx = hi; }
      }
      if (heroIdx < 0) return;
      if (countParaseedsOnHero(engine, owner, heroIdx) <= 0) return;

      ctx.modifyAmount(AURA_BONUS);
    },
  },
};

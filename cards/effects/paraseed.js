// ═══════════════════════════════════════════
//  CARD EFFECT: "Paraseed"
//  Creature (Normal, Lv0, 30 HP, Summoning Magic)
//
//  „When this Creature is defeated by a Hero or Creature, place it
//   into one of the attacking or corresponding Hero's free Support
//   Zones instead of sending it to the discard pile. While this
//   Creature is in a Hero's Support Zone, that Hero is Poisoned.
//   Damage that Hero takes from Poison reduces its current and max
//   HP. That Hero's Poison cannot be healed, but it is removed when
//   this Creature leaves the Hero's Support Zone.\"
//
//  Bauform
//  ───────
//  • Das Einnisten ist ein `_deathClaim` mit `to: 'support'` (v679b):
//    eine BEWEGUNG, kein Summon — kein Ablage-Zwischenstopp, keine
//    Summoning Sickness, sichtbarer Flug von der Sterbezone in die
//    neue Zone. Findet sich keine freie Zone beim Toeter, geht die
//    Paraseed ganz normal auf den Ablagestapel.
//  • `keepOriginalOwner` friert den Eigentuemer ein: der Kadaver
//    kehrt spaeter in die Ablage seines URSPRUENGLICHEN Besitzers
//    zurueck, auch wenn er zwischendurch in der Gegenspalte lag.
//  • Das Gift verwaltet `_paraseed-shared.syncParaseedPoison` — eine
//    Stelle fuer Auflegen (unheilbar) und Abnehmen.
//  • Der Max-HP-Fraß haengt an `afterDamage` mit `type === 'poison'`:
//    was das Gift dem Wirt abgezogen hat, zieht `decreaseMaxHp` ihm
//    noch einmal von der Obergrenze ab.
// ═══════════════════════════════════════════

const {
  isParaseedCreature, paraseedsOnHero, syncParaseedPoison, syncAllParaseedPoison,
  killerHeroOf, freeSlotOnHero,
} = require('./_paraseed-shared');

const CARD_NAME = 'Paraseed';

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // Die Paraseed IST der Schaden — sie stirbt gern, weil sie beim
    // Toeter wieder aufsteht. Ein eigener Verlust ist also billig,
    // ein gegnerisches Exemplar zu erschlagen dagegen teuer.
    deathValueToOwner: 0,
    appliesStatus: true,
  },

  hooks: {
    // ── Einzug: der Wirt wird vergiftet ──────────────────────────
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const eintritt = ctx.enteringCard;
      if (!eintritt || eintritt.id !== ctx.card.id) return;
      if (ctx.toZone !== 'support') return;
      await syncParaseedPoison(engine, eintritt.owner, eintritt.heroIdx);
    },

    // ── Abzug: das Gift faellt mit der letzten Paraseed ──────────
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.fromZone !== 'support') return;
      // Brettweiter Abgleich statt Einzelziel: die Feldnamen des
      // Verlass-Hooks unterscheiden sich je nach Weg (Ablage, Umzug,
      // Tod), und ein Fehlgriff liesse das Gift stehen. Der Hook
      // feuert ausserdem, BEVOR die Karte ausgebucht ist — die
      // abgehende Instanz wird deshalb uebergangen.
      await syncAllParaseedPoison(engine, ctx.card.id);
    },

    // ── Giftschaden frisst zusaetzlich die Obergrenze ────────────
    afterDamage: async (ctx) => {
      if (ctx.type !== 'poison') return;
      const engine = ctx._engine;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;          // nur Helden
      const wirt = engine.gs.players[ctx.card.owner]?.heroes?.[ctx.card.heroIdx];
      if (!wirt || wirt !== ziel) return;                  // nur der eigene Wirt

      // EINMAL je Tick, nicht einmal je Paraseed: liegen mehrere beim
      // selben Helden, rechnet nur die mit der kleinsten Instanz-ID ab
      // (Bauform aus hunting.js). Sonst zog jede Kopie denselben
      // Betrag noch einmal von der Obergrenze ab.
      const geschwister = paraseedsOnHero(engine, ctx.card.owner, ctx.card.heroIdx)
        .map(i => i.id).sort();
      if (geschwister.length > 0 && geschwister[0] !== ctx.card.id) return;

      const abzug = ctx.realDealt ?? ctx.amount ?? 0;
      if (!(abzug > 0)) return;
      // NICHT ueber `decreaseMaxHp`: dessen Klammer hebt die aktuellen
      // HP auf mindestens 1 an und wuerde einen Helden, den genau
      // dieser Gifttick gerade getoetet hat, wiederbeleben.
      const alt = ziel.maxHp || ziel.hp;
      const neu = Math.max(1, alt - abzug);
      ziel.maxHp = neu;
      if (ziel.hp > 0) ziel.hp = Math.min(ziel.hp, neu);
      engine.sync();
    },

    // ── Zustands-Abgleich ────────────────────────────────────────
    // „While this Creature is in a Hero's Support Zone, that Hero is
    // Poisoned" ist ein ZUSTAND, kein Ausloeser. Ein Weg fuehrt ohne
    // Eintritts-Hook in die Zone: der Kadaver-Anspruch unten
    // (`_deathClaim`) ist per Engine-Entscheidung (v699) eine reine
    // Bewegung und feuert `onCardEnterZone` ausdruecklich NICHT.
    // Deshalb gleicht die Karte ihren Zustand zusaetzlich zu jedem
    // Zug- und Phasenbeginn ab.
    onTurnStart: async (ctx) => { await syncAllParaseedPoison(ctx._engine); },
    onPhaseStart: async (ctx) => { await syncAllParaseedPoison(ctx._engine); },
    // Direkt nach dem Todes-Batch — das ist der Moment, in dem sich
    // eine erschlagene Paraseed beim Toeter eingenistet hat. Damit
    // liegt das Gift sofort auf, nicht erst zur naechsten Phase.
    afterCreatureDamageBatch: async (ctx) => { await syncAllParaseedPoison(ctx._engine); },

    // ── Tod: einnisten statt ablegen ─────────────────────────────
    onCreatureDeathClaim: async (ctx) => {
      const engine = ctx._engine;
      const tot = ctx.creature;
      if (!tot || tot.instId !== ctx.card.id) return;      // nur ich selbst
      if (!isParaseedCreature(tot.name, engine)) return;

      const toeter = killerHeroOf(engine, ctx.source);
      if (!toeter) return;                                  // Artifact/Potion/Status

      const slot = freeSlotOnHero(engine, toeter.owner, toeter.heroIdx);
      if (slot < 0) return;                                 // keine freie Zone → Ablage

      const inst = engine.cardInstances.find(c => c.id === tot.instId);
      if (!inst) return;

      inst._deathClaim = {
        to: 'support',
        name: tot.name,
        owner: toeter.owner,
        heroIdx: toeter.heroIdx,
        zoneSlot: slot,
        keepOriginalOwner: tot.originalOwner ?? tot.owner,
        by: CARD_NAME,
      };
    },
  },
};

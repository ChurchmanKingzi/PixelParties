// ═══════════════════════════════════════════
//  CARD EFFECT: "Bunny Bombs"
//  Creature (Normal, Lv0, 10 HP, Summoning Magic)
//
//  "At the end of each player's turn, place 1 Bomb Counter on this
//   Creature. When this Creature is defeated: Deal damage equal to 20
//   times the number of Bomb Counters on it to all targets on the
//   board. When this would result in a draw, you lose the game."
//
//  ── Der Zaehler ──
//  `onTurnEnd` feuert an JEDEM Zugende, also auch im Gegnerzug — der
//  Hook unterscheidet die Seiten nicht, und der Text will genau das.
//  Der Zaehler liegt als `counters.bunnyBombCounter` auf der Instanz und
//  waechst monoton; er wird NICHT je Runde zurueckgesetzt (anders als
//  die Nutzungszaehler anderer Karten).
//
//  BEWUSSTE FOLGE der Engine-Regel: ein eingefrorener, gestunter oder
//  negierter Bunny Bombs feuert seine Hooks NICHT und bekommt in dieser
//  Runde also keinen Zaehler. Das ist die allgemeine CC-Regel fuer
//  passive Kreatur-Effekte (siehe runHooks-Filter) — Einfrieren haelt
//  die Bombe an. An Al gemeldet, falls es anders gewuenscht ist.
//
//  ── Die Explosion ──
//  „all targets on the board" = ALLE Helden UND ALLE Kreaturen beider
//  Seiten. Die Zielliste wird VORHER eingefroren: waehrend der
//  Abarbeitung sterben Karten, und eine live gelesene Liste haette
//  Loecher. Die Bombe selbst ist zu diesem Zeitpunkt bereits vom Brett.
//
//  ── Das Unentschieden ──
//  Loescht die Explosion beide Seiten aus, entschied bisher stumm die
//  Schleifenreihenfolge in `checkAllHeroesDead`. Diese Karte sagt
//  ausdruecklich, wer dann verliert: ihr eigener Besitzer. Umgesetzt
//  ueber zwei Engine-Vertraege:
//   • `gs._deferGameOverCheck` haelt die Spielende-Pruefung an, solange
//     die Explosion laeuft — sonst beendete der erste toedliche Treffer
//     die Partie, bevor die andere Seite ueberhaupt dran war.
//   • `gs._drawLoserIdx` benennt den Verlierer fuer den Fall, dass am
//     Ende beide Seiten leer sind.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Bunny Bombs';
const DAMAGE_PER_COUNTER = 20;
// Eigener Schluessel: `bombCounters` (Plural) gehoert bereits Time
// Bomblebee — eine voellig andere Mechanik. Zwei fast gleich benannte
// Zaehler waeren eine Falle, deshalb heisst dieser hier eindeutig.
const COUNTER_KEY = 'bunnyBombCounter';
// Geteilt mit Time Bomblebee — dieselbe Bedeutung (eine Bombe tickt),
// also bewusst dieselbe Animation statt einer zweiten, gleich aussehenden.
const ANIM_TICK = 'bomblebee_tick';

/** Alle Helden und Kreaturen beider Seiten — Momentaufnahme. */
function collectBoardTargets(engine, selfId) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const heroes = [];
  const creatures = [];

  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (hero?.name && hero.hp > 0) heroes.push({ pi, hi, hero });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.id === selfId) continue;                 // die Bombe ist schon weg
    if (inst.zone !== 'support') continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    creatures.push(inst);
  }
  return { heroes, creatures };
}

module.exports = {
  activeIn: ['support'],

  // ── CPU-Bewertungshinweis ─────────────────────────────────────────
  // v332: Was der Tod dieser Karte IHREM BESITZER wert ist.
  //
  // Ohne diese Deklaration sah der CPU-Zielwaehler nur eine fette
  // Kreatur ohne Nachteil und schlug zu — um den eigenen Schlag danach
  // mit Monia (Kosten: Aktion + Handkarte) wieder aufzuheben. Genau
  // dafuer existiert `cpuMeta.onDeathBenefit`; Bunny Bombs hatte es nur
  // nie gefuellt.
  //
  // Der Wert haengt am Zaehler: ohne Zaehler ist die Karte harmlos, mit
  // vielen zuendet sie `Zaehler x 20` auf ALLES. Ein Support-Slot ist 30
  // wert, der Boden 5 — ab 25 ist Toeten also praktisch wertlos. Ein
  // Zaehler (20 Flaechenschaden) bleibt verschmerzbar, ab fuenf (100)
  // will man die Karte auf keinen Fall aufmachen.
  cpuMeta: {
    onDeathBenefit: (engine, inst) => {
      const zaehler = inst?.counters?.[COUNTER_KEY] || 0;
      if (zaehler <= 0) return 0;
      return Math.min(25, (zaehler * DAMAGE_PER_COUNTER) / 4);
    },
  },

  hooks: {
    /** Am Ende JEDES Zuges einen Bomb Counter. */
    onTurnEnd: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const counters = inst.counters || (inst.counters = {});
      counters[COUNTER_KEY] = (counters[COUNTER_KEY] || 0) + 1;
      // Kleine Zaehl-Animation (Als Wunsch 8.8.). Bewusst der bereits
      // vorhandene `bomblebee_tick`: ein leiser Funke mit Zuendschnur-
      // Ring, ausdruecklich zurueckhaltend gehalten, damit er nicht wie
      // ein Schadensereignis wirkt — genau das Richtige fuer „ein
      // Bomb Counter kommt dazu". Kein Client-Umbau noetig.
      ctx._engine._broadcastEvent('play_zone_animation', {
        type: ANIM_TICK,
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
      });
      ctx._engine.log('bunny_bombs_tick', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
        counters: counters[COUNTER_KEY],
      });
      ctx._engine.sync();
    },

    /** Beim eigenen Tod: das ganze Brett bekommt es ab. */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;   // nur der eigene Tod

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const counters = ctx.card.counters?.[COUNTER_KEY] || 0;
      const damage = counters * DAMAGE_PER_COUNTER;

      engine.log('bunny_bombs_detonate', {
        player: gs.players[pi]?.username, counters, damage,
      });
      if (damage <= 0) return;                              // ohne Zaehler kein Knall

      const { heroes, creatures } = collectBoardTargets(engine, ctx.card.id);

      // Spielende-Pruefung anhalten und den Verlierer eines
      // Unentschiedens benennen — beides bis zum Ende der Explosion.
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      const prevDrawLoser = gs._drawLoserIdx;
      gs._drawLoserIdx = pi;
      try {
        engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
        for (const t of heroes) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'explosion', owner: t.pi, heroIdx: t.hi, zoneSlot: -1,
          });
        }
        await engine._delay(300);

        for (const t of heroes) {
          if (t.hero.hp <= 0) continue;                     // schon gefallen
          await ctx.dealDamage(t.hero, damage, 'creature');
        }
        for (const inst of creatures) {
          if (inst.zone !== 'support') continue;            // zwischenzeitlich weg
          await engine.actionDealCreatureDamage(
            ctx.card, inst, damage, 'creature',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      } finally {
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }

      // Jetzt EINMAL auswerten — mit dem Unentschieden-Hinweis noch
      // gesetzt, damit „you lose the game" greift.
      try {
        await engine.checkAllHeroesDead();
      } finally {
        if (prevDrawLoser === 0 || prevDrawLoser === 1) gs._drawLoserIdx = prevDrawLoser;
        else delete gs._drawLoserIdx;
      }
      engine.sync();
    },
  },
};

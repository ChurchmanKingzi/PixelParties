// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Gun"
//  Artifact (Equipment, Cost 10) — Archetyp „Future Tech"
//
//  "Equip this card to a Hero you control. Increase the equipped
//   Hero's Attack stat by 40 times the number of "Future Tech Gun"
//   cards in your discard pile."
//
//  Mechanics
//  ─────────
//   • Baugleich zu `ancient-tech-infinite-energy-core.js` — dort steht
//     dieselbe Bauform („+10 je Karte mit verschiedenem Namen im
//     Ablagestapel"). Übernommen sind das idempotente Nachrechnen und
//     der komplette Satz Hooks, an denen sich der Ablagestapel ändern
//     kann. Unterschied: gezählt werden nur Kopien DIESER Karte, und
//     der Faktor ist 40.
//   • Zählweise: Kopien im Ablagestapel des TRÄGERS. Die Karte selbst
//     liegt in einer Support Zone und zählt sich also nicht mit —
//     erst wenn sie stirbt, hebt sie den Zuschlag ihrer Nachfolger.
//   • Das Nachrechnen ist idempotent: ändert sich nichts, passiert
//     nichts. Deshalb ist es unbedenklich, es an jeden plausiblen
//     Hook zu hängen.
//   • Der Zuschlag geht über `engine._applyHeroAtkDelta`, nicht über
//     `ctx.grantAtk` — nur so wird die Differenz sauber verrechnet und
//     Curse-Unterdrückung berücksichtigt. `counters.atkGranted` bleibt
//     der Stand, den `ctx.revokeAtk()` beim Verlassen der Zone wieder
//     abzieht.
//   • Kein Treibstoff-Sonderweg: dass Cybug ANTS diese Karte löscht,
//     ist Sache von ANTS. Diese Karte weiß davon nichts.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Gun';
const BONUS_PER_COPY = 40;

/**
 * Zuschlag neu berechnen und nur die Differenz anwenden. Idempotent —
 * ohne Änderung ein No-op, deshalb an jedem plausiblen Hook sicher.
 */
function zuschlagNachrechnen(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;

  const owner = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name) return;

  const ps = engine.gs.players[owner];
  // Ueber das gemeinsame Zaehlwerk statt per eigenem `filter` (v536):
  // nur so sieht die Karte kuenftige Namens-Aliasse (Prototypes,
  // Copy Device). Verhalten heute identisch.
  const kopien = zaehleInAblage(engine.gs, owner, CARD_NAME);
  const neuerZuschlag = kopien * BONUS_PER_COPY;

  if (!inst.counters) inst.counters = {};
  const bisher = inst.counters.atkGranted || 0;
  const delta = neuerZuschlag - bisher;
  if (delta === 0) return;

  engine._applyHeroAtkDelta(hero, owner, heroIdx, delta);
  inst.counters.atkGranted = neuerZuschlag;

  engine.log('future_tech_gun_atk', {
    hero: hero.name, bonus: neuerZuschlag, copies: kopien, delta,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    // Erstberechnung beim Anlegen und auf vorbelegten Puzzle-Brettern.
    onPlay: (ctx) => zuschlagNachrechnen(ctx),
    onGameStart: (ctx) => zuschlagNachrechnen(ctx),

    // Alles, was den Ablagestapel bewegen kann.
    afterSpellResolved: (ctx) => zuschlagNachrechnen(ctx),
    onAnyActionResolved: (ctx) => zuschlagNachrechnen(ctx),
    onDiscard: (ctx) => zuschlagNachrechnen(ctx),
    onMill: (ctx) => zuschlagNachrechnen(ctx),
    onCreatureDeath: (ctx) => zuschlagNachrechnen(ctx),
    onTurnStart: (ctx) => zuschlagNachrechnen(ctx),

    // Standard-Rücknahme. Der strenge Slot-Vergleich stellt sicher,
    // dass nur DIESES Exemplar beim Verlassen SEINER Zone abzieht.
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== ctx.card.heroIdx) return;
      if (ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },
  },
};

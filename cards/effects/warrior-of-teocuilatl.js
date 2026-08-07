// ═══════════════════════════════════════════
//  CARD EFFECT: "Warrior of Teocuilatl"
//  Creature (Normal), Lv1, 60 HP, Summoning Magic
//
//  "You may sacrifice a Creature you control that was
//   not summoned this turn to summon this Creature as
//   an additional Action. Whenever a Creature either
//   player controls would be affected by a card or
//   effect, you may remove 1 Doom Counter from a
//   'Doom Clock' to negate all effects that card or
//   effect would have on that Creature."
//
//  Als Ruling (5.8.): darf auch EIGENE Effekte
//  negieren — "either player controls" ist woertlich
//  gemeint. Selber Scope wie Cool Rescuer Monia, nur
//  mit den Countern als Zusatzvoraussetzung: bei 0
//  Countern kann der Effekt gar nicht triggern.
// ═══════════════════════════════════════════

const T = require('./_teocuilatl-shared');
const D = require('./_doom-clock-shared');

const CARD_NAME = 'Warrior of Teocuilatl';


/**
 * Auftritt beim Negieren (Als Vorgabe 5.8., Muster Cool Rescuer Monia):
 * die Creature DASHT zum geschuetzten Ziel, und ihr Kartenbild wird
 * eingeblendet — dasselbe Signal wie bei Reaktionen.
 */
async function auftritt(engine, ctx, zielInst) {
  const src = ctx.card;
  if (!src) return;
  engine._broadcastEvent('play_card_showcase', {
    cardName: CARD_NAME, owner: ctx.cardOwner, durationMs: 1200,
  });
  if (zielInst) {
    const seite = zielInst.stolenBy != null
      ? zielInst.owner
      : (zielInst.controller ?? zielInst.owner);
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: src.owner, sourceHeroIdx: src.heroIdx,
      sourceZoneSlot: src.zoneSlot,
      targetOwner: seite, targetHeroIdx: zielInst.heroIdx,
      targetZoneSlot: zielInst.zoneSlot,
      cardName: CARD_NAME, duration: 600,
      trailType: 'fire_stars',
    });
    await engine._delay(450);
  }
}

module.exports = {
  activeIn: ['hand', 'support'],

  inherentAction(gs, pi, heroIdx, engine) {
    return T.hasTribute(engine, pi);
  },
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return T.sacrificeableSlots(engine, pi, CARD_NAME).some(s => s.heroIdx === heroIdx);
  },
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine) {
    return !!T.findOccupant(engine, pi, heroIdx, slotIdx, CARD_NAME);
  },
  getBouncePlacementTargets(gs, pi, engine) {
    return T.sacrificeableSlots(engine, pi, CARD_NAME)
      .map(s => ({ heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (ps?._requestedBouncePlaceSlot) {
      const req = ps._requestedBouncePlaceSlot;
      delete ps._requestedBouncePlaceSlot;
      return await T.sacrificeSummonIntoSlot(engine, pi, req, CARD_NAME);
    }
    if (ps?._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;
    if (!ctx.isInherentAction) return true;

    const turn = engine.gs.turn;
    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1, maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to summon Warrior of Teocuilatl as an additional Action.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: (c) => c.inst.turnPlayed !== turn,
    });
    return !!paid;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    /**
     * Schutzschirm fuer eine Creature — beliebiger Seite.
     * Voraussetzung ist ein entfernbarer Doom Counter; ohne den
     * triggert der Effekt gar nicht (Als Ruling).
     */
    /**
     * SCHADEN an Creatures. Zweiter, getrennter Weg (Muster Cool
     * Rescuer Monia): `beforeCreatureAffected` deckt nur NICHT-Schaden
     * ab — Gift, Status, Verschieben. Kreatur-Schaden laeuft ueber den
     * Stapel-Hook, und genau deshalb liess sich Warrior nicht gegen
     * Basketskull aktivieren (Als Befund 5.8.).
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (ctx.card?.zone !== 'support') return;
      const entries = (ctx.entries || []).filter(e => !e.cancelled && e.inst);
      if (entries.length === 0) return;

      const uhren = D.clocksWithCounters(engine);
      if (uhren.length === 0) return;

      // "a Creature EITHER PLAYER controls" — beide Seiten, auch die
      // eigene (Als Ruling). Je Eintrag einzeln fragen, damit man
      // gezielt eine Creature schuetzen kann.
      for (const e of entries) {
        const frisch = D.clocksWithCounters(engine);
        if (frisch.length === 0) return;
        const name = e.inst?.name || 'a Creature';
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `Remove 1 Doom Counter to negate the damage to ${name}?`,
          confirmLabel: '🛡️ Negate!',
          cancelLabel: 'Let it through',
          cancellable: true,
        });
        if (!ja) continue;
        const uhr = await D.pickClock(engine, pi, frisch, {
          title: CARD_NAME,
          message: 'Remove 1 counter from which Doom Clock?',
          cancellable: true,
        });
        if (!uhr) continue;
        if (D.removeCounters(engine, uhr, 1) !== 1) continue;
        await auftritt(engine, ctx, e.inst);
        e.cancelled = true;
        engine.log('warrior_teocuilatl_negate', {
          player: engine.gs.players[pi]?.username, creature: name, kind: 'damage',
        });
      }
      engine.sync();
    },

    beforeCreatureAffected: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (ctx.card?.zone !== 'support') return;
      if (ctx.cancelled) return;

      const uhren = D.clocksWithCounters(engine);
      if (uhren.length === 0) return;      // keine Counter -> kein Trigger

      const betroffen = ctx.creature?.name || 'a Creature';
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Remove 1 Doom Counter to negate all effects on ${betroffen}?`,
        confirmLabel: '🛡️ Negate!',
        cancelLabel: 'Let it through',
        cancellable: true,
      });
      if (!ja) return;

      const uhr = await D.pickClock(engine, pi, uhren, {
        title: CARD_NAME,
        message: 'Remove 1 counter from which Doom Clock?',
        cancellable: true,
      });
      if (!uhr) return;
      if (D.removeCounters(engine, uhr, 1) !== 1) return;

      await auftritt(engine, ctx, ctx.creature);
      ctx.cancelled = true;
      engine.log('warrior_teocuilatl_negate', {
        player: engine.gs.players[pi]?.username,
        creature: betroffen,
      });
      engine.sync();
    },
  },
};

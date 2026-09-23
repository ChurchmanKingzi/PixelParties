'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Heart of Ice"  (v1317, neuer Text)
//  Artifact (Equipment) — Cost 8
//
//  "Equip this card to a Hero you control. The equipped Hero cannot be
//   Frozen. Additionally, any Hero hitting the equipped Hero with an
//   Attack and any Creature hitting it with its effect is Frozen for
//   1 turn."
//
//  ① Frost-Immunitaet des Traegers: `statuses.freeze_immune` (derselbe
//     Riegel wie The Sun Sword, `actionAddStatus` prueft ihn) plus
//     Anzeige-Buff. Liegt ein ZWEITES Heart of Ice am selben Helden,
//     bleibt die Immunitaet beim Abgang des ersten bestehen.
//  ② „any Hero hitting … with an Attack": nach der Aufloesung einer
//     Attack (`afterSpellResolved`), deren Treffer den Traeger umfassen —
//     der ANGREIFENDE Held friert ein, egal welche Seite.
//  ③ „any Creature hitting it with its effect": Schaden am Traeger, dessen
//     Quelle eine Creature auf dem Brett ist (`afterDamage`) — diese
//     Creature friert ein. Attacks laufen ueber ②, nicht doppelt.
//  Einfrieren ueber `_frost-shared` (Immunitaeten greifen), 1 Zug.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');
const { einfrieren, eisblockAnimation } = require('./_frost-shared');

const CARD_NAME = 'Heart of Ice';

function traeger(engine, inst) {
  if (!inst || inst.zone !== 'support') return null;
  const pi = inst.controller ?? inst.owner;
  const hero = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  return hero?.name ? { pi, hi: inst.heroIdx, hero } : null;
}

function immunSetzen(hero) {
  if (!hero.statuses) hero.statuses = {};
  hero.statuses.freeze_immune = { source: CARD_NAME };
  if (!hero.buffs) hero.buffs = {};
  hero.buffs.freeze_immune = { source: CARD_NAME };
}

function immunEntfernen(engine, pi, hi, ausserId) {
  const nochEins = engine.cardInstances.some(c => c.id !== ausserId && c.name === CARD_NAME
    && c.zone === 'support' && (c.controller ?? c.owner) === pi && c.heroIdx === hi);
  if (nochEins) return;
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (hero?.statuses?.freeze_immune?.source === CARD_NAME) delete hero.statuses.freeze_immune;
  if (hero?.buffs?.freeze_immune?.source === CARD_NAME) delete hero.buffs.freeze_immune;
}

async function vergelten(engine, heart, ziel) {
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: heart.controller ?? heart.owner });
  eisblockAnimation(engine, [ziel]);
  const ok = await einfrieren(engine, ziel, { dauer: 1, appliedBy: heart.controller ?? heart.owner, source: CARD_NAME });
  if (ok) engine.log('heart_of_ice', { player: engine.gs.players[heart.controller ?? heart.owner]?.username, target: ziel.name });
  engine.sync();
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const t = traeger(ctx._engine, ctx.card);
      if (t) { immunSetzen(t.hero); ctx._engine.sync(); }
    },
    onGameStart: async (ctx) => {
      const t = traeger(ctx._engine, ctx.card);
      if (t) immunSetzen(t.hero);
    },
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      immunEntfernen(ctx._engine, ctx.fromOwner ?? ctx.cardOwner, ctx.fromHeroIdx, ctx.card.id);
    },

    // ② Attack eines Helden trifft den Traeger → der Angreifer friert ein.
    afterSpellResolved: async (ctx) => {
      if (ctx.spellCardData?.cardType !== 'Attack') return;
      const engine = ctx._engine;
      const t = traeger(engine, ctx.card);
      if (!t) return;
      const getroffen = (ctx.damageTargets || []).some(d => d.type === 'hero' && d.owner === t.pi && d.heroIdx === t.hi);
      if (!getroffen) return;
      const aPi = ctx.heroOwner ?? ctx.casterIdx;
      const aHi = ctx.heroIdx;
      const angreifer = engine.gs.players[aPi]?.heroes?.[aHi];
      if (!angreifer?.name || angreifer.hp <= 0) return;
      await vergelten(engine, ctx.card, { type: 'hero', owner: aPi, heroIdx: aHi, name: angreifer.name });
    },

    // ③ Schaden aus dem Effekt einer Creature → diese Creature friert ein.
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const t = traeger(engine, ctx.card);
      if (!t || ctx.target !== t.hero) return;
      if (!(ctx.amount > 0) || ctx.type === 'attack') return;
      const q = ctx.source;
      if (!q) return;
      let inst = (q.id != null) ? engine.cardInstances.find(c => c.id === q.id) : null;
      if (!inst && q.name) {
        inst = engine.cardInstances.find(c => c.name === q.name && c.zone === 'support'
          && (c.controller ?? c.owner) === (q.controller ?? q.owner)
          && (q.heroIdx == null || c.heroIdx === q.heroIdx)
          && (q.zoneSlot == null || c.zoneSlot === q.zoneSlot));
      }
      if (!inst || inst.zone !== 'support') return;
      const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      await vergelten(engine, ctx.card, { type: 'creature', owner: inst.controller ?? inst.owner, inst, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, name: inst.name });
    },
  },
};

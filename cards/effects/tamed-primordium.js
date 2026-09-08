'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tamed Primordium"  (v831)
//  Creature — Lv1, 10 HP, Archetyp "Tamed"
//
//  "When this Creature is summoned via an effect, except the effect of
//   "Tamed Primordium", you may immediately summon up to 2 level 1 or
//   lower Creatures from your hand as additional Actions. If you summon
//   2 Creatures this way, delete this Creature and you cannot summon
//   Creatures for the rest of the turn afterwards."
//
//  • Trigger wie Tamed Hell Fox (`onPlay`, Effekt-Beschwoerung); die
//    Ausnahme laeuft ueber das hookExtra `_summonedByTamedPrimordium`,
//    das dieser Effekt seinen eigenen Beschwoerungen mitgibt.
//  • Beschwoerungen: echte Beschwoerungen (Held lebend, nicht CC,
//    Summoning Magic passend — `summonZonesFor`), Level ≤ 1 nach
//    `effectiveCardLevel`, Galerie → Zone → `summonFromPile(hand)`,
//    keine Aktion verbraucht (`onAnyActionResolved` als Zusatzaktion).
//  • Zwei beschworen → Selbstloeschung + `ctx.lockSummons()`
//    (`ps.summonLocked`, Engine-Vertrag: Hand UND Effekt-Beschwoerungen,
//    faellt am Zugbeginn).
// ═══════════════════════════════════════════
const { summonZonesFor, pickZone } = require('./_of-kings-shared');

const CARD_NAME = 'Tamed Primordium';
const MAX_LEVEL = 1;

function isEffectSummon(ctx) {
  return ctx.playedCard?.id === ctx.card.id && ctx.card.zone === 'support'
    && !ctx._isNormalSummon   // v832: Platzieren (Barker) zaehlt als Effekt-Beschwoerung (Al 8.9.)
    && !ctx._summonedByTamedPrimordium;
}

function eligibleHand(engine, pi) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  for (const n of new Set(ps?.hand || [])) {
    const cd = cardDB[n];
    if (!cd || !(cd.cardType === 'Creature' || String(cd.cardType || '').split('/').includes('Creature'))) continue;
    if (engine.effectiveCardLevel(cd, pi) > MAX_LEVEL) continue;
    if (summonZonesFor(engine, pi, cd).length === 0) continue;
    out.push(n);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.title !== CARD_NAME) return undefined;
    if (payload.type === 'confirm') return true;
    if (payload.type === 'cardGallery') {
      const cards = payload.cards || [];
      return cards.length ? { cardName: cards[0].name, source: cards[0].source } : null;
    }
    if (payload.type === 'zonePick') {
      const z = (payload.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : null;
    }
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (!isEffectSummon(ctx)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const ps = gs.players[pi];
      const inst = ctx.card;
      if (!ps || ps.summonLocked) return;
      if (eligibleHand(engine, pi).length === 0) return;

      const yes = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: 'Tamed Primordium was summoned by an effect. Summon up to 2 level 1 or lower Creatures from your hand as additional Actions? (2 Creatures: Tamed Primordium is deleted and you can\'t summon any more Creatures this turn.)',
        confirmLabel: '🐾 Summon!', cancelLabel: 'No', cancellable: true,
      });
      if (!yes) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      let summoned = 0;
      for (let i = 0; i < 2; i++) {
        if (ps.summonLocked) break;
        const names = eligibleHand(engine, pi);
        if (names.length === 0) break;
        const res = await engine.promptGeneric(pi, {
          type: 'cardGallery', title: CARD_NAME, showCard: CARD_NAME,
          cards: names.map(n => ({ name: n, source: 'hand' })),
          description: i === 0
            ? 'Summon a level 1 or lower Creature from your hand (additional Action).'
            : 'Summon a second Creature? (Tamed Primordium will be deleted and summoning locked for the turn.)',
          confirmLabel: '🐾 Summon!', cancelLabel: i === 0 ? 'No summon' : 'Stop (1 Creature)', cancellable: true,
        });
        if (!res || res.cancelled || !res.cardName) break;
        const cd = engine._getCardDB()[res.cardName];
        const zone = await pickZone(engine, pi, summonZonesFor(engine, pi, cd), CARD_NAME, `Summon ${res.cardName} with which Hero?`);
        if (!zone) break;
        const out = await engine.summonFromPile(pi, 'hand', res.cardName, zone.heroIdx, zone.slotIdx, {
          source: CARD_NAME, sourceOwner: pi, hookExtras: { _summonedByTamedPrimordium: true },
        });
        if (!out) break;
        summoned++;
        await engine.runHooks('onAnyActionResolved', {
          actionType: 'creature', playerIdx: pi, cardName: res.cardName, playedCardName: res.cardName, heroIdx: zone.heroIdx,
          isAdditional: true, isInherent: false, isFree: false, _skipReactionCheck: true,
        });
      }
      engine.log('tamed_primordium', { player: ps.username, summoned });
      if (summoned >= 2) {
        // Sperre VOR der Loeschung (Al 8.9.): `ps.summonLocked` sperrt auch
        // Platzierungen, und eine Summon-only-Karte (Pawn Chain) darf im
        // Todes-Fenster dieser Loeschung gar nicht erst angeboten werden
        // (`blockedBySummonLock`, v834).
        ctx.lockSummons();
        if (inst.zone === 'support') {
          inst._redirectToDeleted = true;
          await engine.actionDestroyCard({ name: CARD_NAME, owner: pi }, inst, { source: CARD_NAME });
        }
      }
      engine.sync();
    },
  },
};

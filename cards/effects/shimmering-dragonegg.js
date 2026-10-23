// ═══════════════════════════════════════════
//  CARD EFFECT: "Shimmering Dragonegg"
//  Creature (Normal, Lv0, 1 HP, Destruction Magic + Summoning Magic)
//  Archetype: Drago — neu am 23.10. (Als Auftrag)
//
//  "If you control no Creatures, summoning this counts as an additional
//   Action. When this Creature is defeated during your turn, you gain 8
//   Gold."
//
//  Das dritte Ei neben Icy und Flaming Dragonegg: gleicher erster Satz,
//  gleiches Ruling zum zweiten (nur ein Tod in der EIGENEN Runde loest
//  aus — etwa per Sacrifice; stirbt das Ei in der Gegnerrunde, gibt es
//  nichts). Statt eines Status bringt dieses Ei Gold, und zwar PFLICHT:
//  der Text sagt „you gain", nicht „you may" — keine Rueckfrage, keine
//  Zielwahl. Satz 1 und die Runden-Regel von Satz 2 legt
//  `_dragonegg-shared.js` aus (`eiInherentAction`, `starbInEigenerRunde`);
//  nur die Wirkung (Gold statt Status) steht hier.
//
//  Der Gewinn laeuft ueber `actionGainGold` OHNE `_isResourceGain`, ist
//  also ein EFFEKT-Gewinn: Gold Trap, Golden Vermin, Royal Treasury und
//  die Goldsperren (`goldLocked`, Tuscan Aristocrat) sehen ihn wie jeden
//  anderen. Ein negiertes/gefrorenes Ei zahlt nichts (derselbe Hook-Filter
//  wie bei Icy/Flaming Dragonegg).
// ═══════════════════════════════════════════

const { eiInherentAction, eiCpuResponse, starbInEigenerRunde } = require('./_dragonegg-shared');

const CARD_NAME = 'Shimmering Dragonegg';
const GOLD = 8;

/** Tod des Eis in der eigenen Runde → Gold fuer den KONTROLLEUR beim Tod (gestohlene Eier zahlen dem Dieb). */
async function goldEffekt(ctx) {
  const death = ctx.creature;
  if (!death || death.instId !== ctx.card.id) return;      // nur der eigene Tod
  const engine = ctx._engine;
  if (!starbInEigenerRunde(engine, death, ctx.card)) return;
  const pi = death.controller ?? ctx.card.controller ?? ctx.card.owner ?? death.owner;
  engine._broadcastEvent('play_zone_animation', { type: 'dragonegg_shimmer', owner: ctx.card.owner, heroIdx: ctx.card.heroIdx, zoneSlot: ctx.card.zoneSlot });
  engine._broadcastEvent('play_gold_coins', { owner: pi });
  await engine.actionGainGold(pi, GOLD);
  engine.log('dragonegg_gold', { player: engine.gs.players[pi]?.username, card: CARD_NAME, gold: GOLD });
  engine.sync();
}

module.exports = {
  // Entkoppelte Bilder (v1182): laufen auch, wenn die Karte negiert wird.
  spellVisual: {
    impact: { type: 'dragonegg_shimmer' }, impactMs: 260,
  },

  activeIn: ['support'],

  inherentAction: eiInherentAction,
  cpuResponse: eiCpuResponse,

  hooks: {
    onCreatureDeath: goldEffekt,
  },
};

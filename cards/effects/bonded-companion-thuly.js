// ═══════════════════════════════════════════
//  CREATURE: "Bonded Companion Thuly"
//
//  Gemeinsame Saetze: `_bonded-companions-shared.js`. Eigener Satz:
//
//    „Once per turn, when you sacrifice a target, you may choose a
//     target and deal 150 damage to it."
//
//  Zwei Ausloeser, weil die Engine Opfer in zwei Formen meldet: als
//  BATCH (`onSacrificeBatch`, eine gebuendelte Kostenzahlung) und als
//  Einzelfall (`onCreatureSacrificed`). Der Rundenzaehler haelt beide
//  zusammen — „once per turn" gilt fuer die Karte, nicht je Ausloeser.
// ═══════════════════════════════════════════

const { companion, companionGlow } = require('./_bonded-companions-shared');
const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Bonded Companion Thuly';
const USE_KEY   = 'thulyStrike';
const MAX_USES  = 1;
const SCHADEN   = 150;

async function schlagAnbieten(ctx, ausloeser) {
  const engine = ctx._engine;
  const gs = engine?.gs;
  const pi = ctx.cardOwner;
  if (ausloeser !== pi) return;                       // „when YOU sacrifice"

  const inst = ctx.card;
  if (usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES }) <= 0) return;

  companionGlow(engine, inst);
  const ziel = await ctx.promptDamageTarget({
    side: 'any',
    types: ['hero', 'creature'],
    damageType: 'creature',
    baseDamage: SCHADEN,
    title: CARD_NAME,
    source: CARD_NAME,
    description: `Deal ${SCHADEN} damage to any target?`,
    confirmLabel: `💥 Strike! (${SCHADEN})`,
    confirmClass: 'btn-danger',
    cancellable: true,
    maxTotal: 1,
  });
  if (!ziel) return;

  // Erst NACH der Zielwahl verbrauchen — ein Abbruch soll die Ladung
  // des Zuges nicht fressen.
  spendUse(inst, gs, { key: USE_KEY, max: MAX_USES });
  // Auftritt erst hier: vor der Zielwahl haette ein Abbruch dem Gegner
  // eine Karte gezeigt, die nie gefeuert hat.
  await engine.showTriggeredEffect(CARD_NAME);

  const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };
  const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;

  // ── Dash ins Ziel (Als Vorgabe 12.9., wie Sword in a Bottle) ──────
  // `play_ram_animation` kann auch aus einer SUPPORT ZONE starten —
  // `sourceZoneSlot` schaltet den Client von der Heldenzone auf die
  // Kreaturenzone um. Damit fliegt Thuly selbst ins Ziel, statt dass
  // der Schnitt aus dem Nichts erscheint.
  engine._broadcastEvent('play_ram_animation', {
    sourceOwner: inst.controller ?? inst.owner,
    sourceHeroIdx: inst.heroIdx,
    sourceZoneSlot: inst.zoneSlot,
    targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
    targetZoneSlot: slot,
    cardName: CARD_NAME, duration: 1000,
  });
  // Der Aufprall liegt bei rund 12 % der Laufzeit.
  await engine._delay(150);

  engine._broadcastEvent('play_zone_animation', {
    type: 'bloody_cut', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot,
  });
  await engine._delay(150);

  if (ziel.type === 'hero') {
    const opfer = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (opfer?.name && opfer.hp > 0) await engine.actionDealDamage(quelle, opfer, SCHADEN, 'creature');
  } else {
    const opfer = ziel.cardInstance
      || engine.findCards({ controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx })
           .find(c => c.zoneSlot === ziel.slotIdx);
    if (opfer) await engine.actionDealCreatureDamage(quelle, opfer, SCHADEN, 'creature', { sourceOwner: pi });
  }
  engine.log('thuly_strike', {
    player: gs.players[pi]?.username, target: ziel.cardName, damage: SCHADEN,
  });
  engine.sync();
}

module.exports = companion({
  name: CARD_NAME,
  eigeneHooks: {
    onSacrificeBatch: async (ctx) => {
      await schlagAnbieten(ctx, ctx.playerIdx);
    },
    onCreatureSacrificed: async (ctx) => {
      if (ctx._inSacrificeBatch) return;              // Batch hat schon gefragt
      const ausloeser = ctx.source?.owner
        ?? ctx.creature?.controller ?? ctx.creature?.owner;
      await schlagAnbieten(ctx, ausloeser);
    },
  },
});

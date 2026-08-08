// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Dragonegg"
//  Creature (Normal, Lv0, 1 HP, Destruction Magic + Summoning Magic)
//
//  "If you control no Creatures, summoning this counts as an additional
//   Action. When this Creature is defeated, you may choose any target
//   on the board and Freeze it for 1 turn."
//
//  ── Teil 1: die Zusatzaktion ──
//  Vertrag `inherentAction(gs, pi, heroIdx, engine)` — dieselbe Bauart
//  wie bei Aggressive Town Guard, nur mit anderer Bedingung: der zaehlt
//  die BESCHWOERUNGEN dieses Zuges, das Ei fragt nach dem BRETT. „If you
//  control no Creatures" heisst: keine einzige Kreatur unter eigener
//  Kontrolle, egal bei welchem Helden. Das Ei selbst liegt zu diesem
//  Zeitpunkt noch nicht auf dem Brett und zaehlt daher nicht mit.
//
//  Gezaehlt wird ueber `controller ?? owner` — eine gecharmte eigene
//  Kreatur steht unter fremder Kontrolle und zaehlt nicht mehr, eine
//  uebernommene gegnerische dagegen schon.
//
//  ── Teil 2: der Todeseffekt ──
//  `onCreatureDeath` mit Selbstpruefung (`death.instId === ctx.card.id`,
//  Muster Cute Bird). „you may" → abbrechbare Abfrage. „any target on
//  the board" = jedes Ziel, Freund wie Feind, Held wie Kreatur (Als
//  Ruling 4.8.). Gefrorene und immune Ziele werden nicht angeboten —
//  wie bei Icy Slime, dem Vorbild fuer den Freeze selbst.
//
//  „for 1 turn" ist die kurze Dauer: `duration: 1` bzw.
//  `frozenDuration: 1`. Icy Slimes 3 stehen fuer „until the end of your
//  next turn" und sind hier ausdruecklich NICHT gemeint.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Icy Dragonegg';
const FREEZE_TURNS = 1;

/** Kontrolliert dieser Spieler ueberhaupt eine Kreatur? */
function controlsAnyCreature(engine, pi) {
  if (!engine?.cardInstances) return false;
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  // Ohne `engine` laesst sich das Brett nicht lesen — dann lieber KEINE
  // Zusatzaktion versprechen, als eine zu behaupten, die der Server
  // hinterher nicht gewaehrt.
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return !controlsAnyCreature(engine, pi);
  },

  // Die CPU faehrt abbrechbare Confirms per Default ablehnend; ohne
  // diesen Abgriff verpufft der Todeseffekt bei ihr still (Muster
  // Cute Bird). Der generische Dispatch laedt dieses Skript nur fuer
  // Abfragen mit dem eigenen Kartentitel.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;   // nur der eigene Tod

      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: CARD_NAME,
        description: `Select a target to Freeze for ${FREEZE_TURNS} turn.`,
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true,                                   // „you may"
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return !!hero && !hero.statuses?.frozen && !hero.statuses?.immune;
          }
          if (t.cardInstance) return !t.cardInstance.counters?.frozen;
          return true;
        },
      });

      if (!selected || selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
          duration: FREEZE_TURNS,
          appliedBy: pi,
          animationType: 'ice_encase',
        });
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          // Animation laeuft unabhaengig davon, ob der Status haftet —
          // sonst sieht der Spieler bei einem immunen Ziel gar nichts.
          engine._broadcastEvent('play_zone_animation', {
            type: 'ice_encase', owner: target.owner,
            heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
          });
          await engine.applyCreatureStatus(inst, 'frozen', {
            sourceOwner: pi,
            source: CARD_NAME,
            frozenDuration: FREEZE_TURNS,
          });
        }
      }

      engine.log('freeze', {
        target: target.cardName || target.type, by: CARD_NAME, type: target.type,
      });
      engine.sync();
    },
  },
};

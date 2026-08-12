// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Slime"
//  Creature — On summon, choose any target
//  that is not Frozen or Immune and Freeze it.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

/**
 * Wie viele Ticks braucht "until the end of your next turn"?
 *
 * GEMESSEN (9.8., `processStatusExpiry('END')`): die Frost-Dauer laeuft
 * AUSSCHLIESSLICH am Zugende des KONTROLLEURS des eingefrorenen Ziels
 * herunter — die Schleife geht nur ueber `gs.players[activePlayer]` und
 * ueber dessen Kreaturen. Damit bedeutet derselbe Kartentext je nach
 * Seite eine andere Zahl:
 *
 *  • EIGENES Ziel: der erste Tick faellt noch in diesen Zug, der zweite
 *    ans Ende des eigenen naechsten — also **2**. Die frueheren 3 liefen
 *    bis zum Ende des UEBERNAECHSTEN eigenen Zuges (Als Befund: die CPU
 *    fror ihren eigenen Helden ein und blieb drei Runden stehen).
 *  • GEGNERISCHES Ziel: dort tickt es an SEINEN Zugenden. Mit **1** ist
 *    er genau seinen naechsten Zug lang eingefroren; 2 wuerde ihn zwei
 *    volle Zuege lahmlegen und den Text deutlich ueberschiessen.
 */
function frostDauer(casterIdx, targetOwnerIdx) {
  return targetOwnerIdx === casterIdx ? 2 : 1;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Icy Slime',
        description: 'Select a target to Freeze.',
        // Sagt dem CPU-Ziel-Gate, WELCHEN Status diese Abfrage anwendet.
        // Ohne die Angabe lief das Gate gar nicht, und die CPU verbrannte
        // ihre Freezes an Helden, die Johanna schuetzt (Als Demo 9.8.).
        appliesStatus: 'frozen',
        confirmLabel: 'Freeze!',
        confirmClass: 'btn-info',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.frozen && !hero.statuses?.immune;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.frozen;
          }
          return true;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
          // Dauer siehe `frostDauer` — sie haengt an der SEITE des Ziels.
          duration: frostDauer(ctx.cardOwner, target.owner),
          appliedBy: ctx.cardOwner, animationType: 'ice_encase' });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          // Animation plays unconditionally so the player sees the
          // freeze land even when the status fizzles on an immune target.
          engine._broadcastEvent('play_zone_animation', { type: 'ice_encase', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
          await engine.applyCreatureStatus(inst, 'frozen', {
            sourceOwner: ctx.cardOwner,
            source: 'Icy Slime',
            // Dieselbe Rechnung wie beim Helden — der Kreatur-Zaehler
            // laeuft ebenfalls nur am Zugende des Kontrolleurs herunter.
            frozenDuration: frostDauer(ctx.cardOwner, target.owner),
          });
        }
      }
      engine.log('freeze', { target: target.cardName, by: 'Icy Slime', type: target.type });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};

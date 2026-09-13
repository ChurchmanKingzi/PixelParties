// ═══════════════════════════════════════════
//  CARD EFFECT: „Wire Hatchling"
//  Creature (Summoning Magic Lv 2, 50 HP, PP CROSS)
//
//  „When you summon this Creature, choose any target on the board and
//   deal damage to it equal to half its current HP (rounded up)."
//
//  BAUART
//  ──────
//  • Ausloeser: `onPlay` mit Selbsttest und Zonenpruefung, dazu
//    `counters.isPlacement` als Riegel — PLATZIEREN ist keine
//    BESCHWOERUNG (Muster Knight of Kings). Eine Effektbeschwoerung
//    (Skullmael's Greatsword, Necromancy) ist dagegen eine und loest
//    mit aus.
//
//  • „half its CURRENT HP (rounded up)": gerechnet wird auf dem
//    aktuellen Wert des ZIELS, nicht auf dem Maximum —
//    `Math.ceil(hp / 2)`. Der Wert wird ERST NACH der Zielwahl
//    genommen: zwischen Angebot und Aufloesung kann sich das Brett
//    aendern.
//    Randfall aus der Aufrundung: ein Ziel mit 1 HP nimmt 1 und stirbt.
//    Alles darueber ueberlebt rechnerisch — halbieren toetet nicht.
//
//  • Schadenstyp `creature`: der Schaden kommt vom Effekt einer
//    Kreatur, nicht von einem Zauber oder Angriff.
//
//  • ANIMATION `paralyzing_bolts` (v963, Als Vorgabe): etliche kleine
//    Blitze, die das Ziel von allen Seiten treffen, dazu ein
//    Starrkrampf-Flackern.
// ═══════════════════════════════════════════

const CARD_NAME = 'Wire Hatchling';

module.exports = {
  requiresTarget: true,
  // ^ Tor fuer Blinded — siehe `_hooks.js`.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.playedCard?.id !== ctx.card?.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;        // platziert ≠ beschworen

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: "Deal damage equal to half the target's current HP (rounded up).",
        confirmLabel: '⚡ Half it!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) return;

      // Der Wert wird ERST JETZT genommen.
      let betrag = 0;
      let inst = null;
      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (!held?.name || held.hp <= 0) return;
        betrag = Math.ceil(held.hp / 2);
      } else {
        inst = ziel.cardInstance || engine.findCards({
          controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx,
        }).find(c => c.zoneSlot === ziel.slotIdx);
        const hp = inst?.counters?.currentHp ?? 0;
        if (!inst || hp <= 0) return;
        betrag = Math.ceil(hp / 2);
      }
      if (betrag <= 0) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'paralyzing_bolts', owner: ziel.owner, heroIdx: ziel.heroIdx,
        zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
        duration: 1200,
      });
      await engine._delay(620);

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (!held || held.hp <= 0) return;
        await ctx.dealDamage(held, betrag, 'creature');
      } else {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
          inst, betrag, 'creature',
          { sourceOwner: ctx.cardOwner, canBeNegated: true },
        );
      }

      engine.log('wire_hatchling_halve', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        target: ziel.cardName, amount: betrag,
      });
      engine.sync();
    },
  },
};

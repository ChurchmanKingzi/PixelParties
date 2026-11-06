// ═══════════════════════════════════════════
//  CARD EFFECT: „Wire Hatchling"
//  Creature (Summoning Magic Lv 2, 50 HP, PP CROSS)
//
//  „When you summon this Creature, choose any target on the board and
//   deal damage to it equal to half its current HP (rounded up)."
//
//  BAUART
//  ──────
//  • Ausloeser: `onPlay` mit Selbsttest und Zonenpruefung.
//    ★ W25c (N3-13, Al): „place triggert On-Summon" - auch das PLATZIEREN
//    (Drill Sergeant & Co.) und jede Effektbeschwoerung (Skullmael's
//    Greatsword, Necromancy) loesen den Effekt aus (der fruehere
//    `isPlacement`-Riegel ist entfallen).
//
//  • „half its CURRENT HP (rounded up)": gerechnet wird auf dem
//    aktuellen Wert des ZIELS, nicht auf dem Maximum —
//    `Math.ceil(hp / 2)`. Der Wert wird ERST NACH der Zielwahl
//    genommen: zwischen Angebot und Aufloesung kann sich das Brett
//    aendern.
//    Randfall aus der Aufrundung: ein Ziel mit 1 HP nimmt 1 und stirbt.
//    Alles darueber ueberlebt rechnerisch — halbieren toetet nicht.
//
//  • ★ W12 (Al, Q86): die Zielwahl ist PFLICHT (`cancellable: false`) — „Sobald er in einer Zone liegt, MUSS man ein
//    Ziel waehlen, man kommt da nicht raus." Es gibt keinen Abbruch und damit auch keine Rücknahme der Beschwörung;
//    gibt es kein legales Ziel, fizzelt der Effekt sichtbar (`summonEffektFizzelt`, nicht stumm).
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
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'paralyzing_bolts' }, impactMs: 260,
  },

  requiresTarget: true,
  // ^ Tor fuer Blinded — siehe `_hooks.js`.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.playedCard?.id !== ctx.card?.id || ctx.card.zone !== 'support') return;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: "Deal damage equal to half the target's current HP (rounded up).",
        confirmLabel: '⚡ Half it!',
        confirmClass: 'btn-danger',
        cancellable: false,   // pflichtwahl: Al (Q86/C05-09) - liegt der Hatchling in einer Zone, MUSS man ein Ziel waehlen, man kommt da nicht raus
      });
      // W12 (Q86): gibt es gar kein legales Ziel, FIZZELT der Effekt sichtbar; die Beschwoerung wird nie zurueckgenommen.
      if (!ziel) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { playerIdx: ctx.cardOwner });

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
        // Unversehrte Kreaturen haben noch kein `currentHp` (erst beim ersten Schaden gesetzt) — dann gelten die gedruckten HP (C05-01).
        const hp = inst?.counters?.currentHp
          ?? (inst ? (inst.counters?._cardDataOverride || engine._getCardDB()[inst.name])?.hp : 0) ?? 0;
        if (!inst || hp <= 0) return;
        betrag = Math.ceil(hp / 2);
      }
      if (betrag <= 0) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4: wirkt nicht → Blob stumm

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

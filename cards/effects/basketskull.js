// ═══════════════════════════════════════════
//  CARD EFFECT: "Basketskull"
//  Spell (Normal), Lv1, Destruction Magic, PP MSAZ
//
//  "Remove any number of Doom Counters from a
//   'Doom Clock' on the board to play this card.
//   Choose a target and deal damage equal to 70 times
//   the number of removed counters to it. This Spell
//   can never hit more than 1 target."
//
//  Als Hinweis (5.8.): **Bomb Berserker Bartas**
//  gibt einem normalen Destruction-Spell mit genau
//  1 Ziel und niedrigerem Level ein ZWEITES Ziel.
//  Basketskull sagt aber ausdruecklich "can never hit
//  more than 1 target" — deshalb das Flag
//  `neverMultiTarget`, das Bartas respektiert.
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Basketskull';
const DAMAGE_PER_COUNTER = 70;

module.exports = {
  requiresTarget: true,

  // Bartas & Co. duerfen dieser Karte KEIN zweites Ziel geben.
  neverMultiTarget: true,

  // Ohne entfernbare Counter ist die Karte nicht spielbar — die
  // Counter sind die KOSTEN, nicht ein optionaler Zusatz.
  spellPlayCondition(gs, pi, engine) {
    return D.clocksWithCounters(engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      const uhr = await D.pickClock(engine, pi, D.clocksWithCounters(engine), {
        title: CARD_NAME,
        message: 'Remove counters from which Doom Clock?',
      });
      if (!uhr) return false;

      // Auswahl als DROPDOWN (Als Vorgabe 5.8.: "dieselbe Art Dropdown
      // wie Siphem"). Bei bis zu 19 moeglichen Countern waere eine
      // Knopfreihe unbrauchbar — `renderAs: 'dropdown'` ist genau
      // dafuer da. Ids im selben Format wie bei Siphem (`n-<zahl>`),
      // damit das Muster wiedererkennbar bleibt.
      const max = D.counterCount(uhr);
      const optionen = [];
      for (let n = 1; n <= max; n++) {
        optionen.push({
          id: `n-${n}`,
          label: `${n} counter${n > 1 ? 's' : ''} → ${n * DAMAGE_PER_COUNTER} damage`,
        });
      }
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        renderAs: 'dropdown',
        title: CARD_NAME,
        description: `This Doom Clock has ${max} Doom Counter${max > 1 ? 's' : ''}. Remove how many?`,
        confirmLabel: 'Confirm',
        options: optionen,
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.optionId) return false;
      const treffer = String(wahl.optionId).match(/^n-(\d+)$/);
      if (!treffer) return false;
      const anzahl = parseInt(treffer[1], 10);
      if (!(anzahl >= 1 && anzahl <= max)) return false;

      const entfernt = D.removeCounters(engine, uhr, anzahl);
      if (!(entfernt > 0)) return false;   // faengt auch NaN ab
      const schaden = entfernt * DAMAGE_PER_COUNTER;

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: schaden,
        title: CARD_NAME,
        description: `Choose a target and deal ${schaden} damage to it.`,
        confirmLabel: `💀 ${schaden} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!ziel) return;

      // ── ANIMATION (Als Vorgabe 5.8.) ────────────────────────────────
      // Ein Totenschaedel fliegt vom Anwender zum Ziel und explodiert
      // dort. Muster von Cannon Tower: Projektil, kurz warten, dann
      // die Einschlags-Animation auf dem Zielfeld.
      const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx,
        targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
        targetZoneSlot: ziel.type === 'hero' ? undefined : ziel.slotIdx,
        emoji: '💀',
        // Groesse skaliert mit den entfernten Countern — mehr Counter,
        // groesserer Schaedel.
        emojiStyle: { fontSize: Math.min(56, 26 + entfernt * 6) },
        duration: 650,
      });
      await engine._delay(560);
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: ziel.owner,
        heroIdx: ziel.heroIdx, zoneSlot: zielSlot,
      });
      await engine._delay(150);

      engine.log('basketskull', {
        player: engine.gs.players[pi]?.username,
        counters: entfernt, damage: schaden, target: ziel.cardName,
      });

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, schaden, 'destruction_spell');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
          ziel.cardInstance, schaden, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
    },
  },
};

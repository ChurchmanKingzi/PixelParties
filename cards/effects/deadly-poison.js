'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "\"Deadly Poison\""  (W75e)
//  Spell (Normal, Lv1, Magic Arts + Support Magic)
//
//  „Choose a Poisoned Hero. The Poison heals that Hero instead of dealing damage to it until it is healed. It still counts as a negative status effect."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • „a Poisoned Hero": jeder lebende Held, Freund oder Feind, der vergiftet ist (Status `poisoned`). Ohne Giftopfer ist die Karte nicht spielbar (`spellPlayCondition`).
//  • Die Marke `deadly` am Giftstatus (`hero.statuses.poisoned.deadly`) kippt den Tick (Engine `processPoisonDamage`): statt Schaden gibt es zu Zugbeginn des Besitzers
//    Heilung in Höhe des Gift-Ticks (Stapel × Schaden je Stapel, wie beim Schaden verändert durch Gift-Hooks).
//  • „until it is healed": bis der HELD voll geheilt ist (aktuelle HP = Max-HP). Der Tick, der ihn auf die Max-HP bringt, ist der letzte Heil-Tick — danach fällt die Marke, und das
//    Gift schadet wieder wie jedes andere („Deadly" in Anführungszeichen). Ist der Held beim Tick schon voll, gilt er als geheilt: gewöhnlicher Schadens-Tick.
//    (Entscheidung zu einem mehrdeutigen Text: „it" = der Held; als Rückfrage vermerkt.)
//  • „It still counts as a negative status effect": der Status ist nach wie vor `poisoned` (negativ, heilbar, zählt für „Poisoned"-Karten, wird von Cleanse/Juice/Cure entfernt —
//    mit dem Status verschwindet die Marke). Weitere Gift-Stapel erhöhen den Heilbetrag, die Marke bleibt.
//  • Spell-Schutz: ein Held mit Anti Magic (ausreichende Stufe) / Effekt-Immunität bleibt unverändert.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `deadly_poison_heal` (Client: ANIM_REGISTRY, Pixelart): lila Giftschwaden steigen auf, grüne Heilkreuze dazwischen, die Wolken kippen per Dither von Lila zu Grün. Die
//  gleiche Animation läuft bei jedem Heil-Tick. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const CARD_NAME = '"Deadly Poison"';
const ANIM_MS = 1500;

module.exports = {
  spellVisual: { impact: { type: 'deadly_poison_heal' }, impactMs: 400 },
  requiresTarget: true,

  /** Spielbar nur, solange irgendein lebender Held (beliebige Seite) vergiftet ist und die Marke noch nicht trägt. */
  spellPlayCondition(gs /*, pi, engine */) {
    return (gs.players || []).some(p => (p?.heroes || []).some(h => h?.name && h.hp > 0 && h.statuses?.poisoned && !h.statuses.poisoned.deadly));
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const wirker = ctx.attachedHero || gs.players[pi]?.heroes?.[ctx.cardHeroIdx];

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero'],
        damageType: 'status',
        dealsDamage: false,   // kein Schaden: Schadensminderer-Reaktionen (Spectral Armor …) bleiben still
        title: CARD_NAME,
        appliesStatus: 'poisoned',
        description: 'Choose a Poisoned Hero. Its Poison heals it instead of dealing damage until it is healed.',
        confirmLabel: '💚 Heal!',
        confirmClass: 'btn-success',
        cancellable: true,
        condition: (t) => {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return !!(h && h.hp > 0 && h.statuses?.poisoned && !h.statuses.poisoned.deadly);
        },
      });
      if (!target) return;

      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0 || !hero.statuses?.poisoned) return;

      engine._broadcastEvent('play_zone_animation', { type: 'deadly_poison_heal', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1, duration: ANIM_MS });
      await engine._delay(ANIM_MS * 0.55);

      // Schutz: Effekt-Immunität / Anti Magic — die Marke ist ein Effekt auf den Helden.
      if (engine.hasEffectImmunity?.(target.owner, target.heroIdx, CARD_NAME)) { engine.log('effect_immunity', { hero: hero.name, status: 'deadly_poison' }); return; }
      if (engine._isHeroSpellProtected?.(hero, CARD_NAME)) { engine.log('buff_blocked', { target: hero.name, buff: 'deadly_poison', reason: 'magic_immune', source: CARD_NAME }); return; }
      if (!hero.statuses?.poisoned) return;                          // inzwischen geheilt (Kette)

      hero.statuses.poisoned.deadly = { by: pi, appliedTurn: gs.turn };
      engine.log('deadly_poison', { player: gs.players[pi]?.username, caster: wirker?.name, hero: hero.name });
      engine.sync();
    },
  },
};

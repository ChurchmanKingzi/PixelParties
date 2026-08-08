// ═══════════════════════════════════════════
//  CARD EFFECT: "Sorbereus, the Adapting Dragon"
//  Creature (Summoning Magic Lv1, Normal) —
//  100 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "You may once per turn choose a Hero and deal
//    damage equal to its Attack stat to it."
//
//  ── Wessen Angriffswert? ──
//  Der des GEWÄHLTEN Helden, gegen ihn selbst —
//  daher "adapting": der Drache spiegelt zurück,
//  was der Held austeilt. Ein starker Angreifer
//  trifft sich entsprechend hart.
//
//  Gemeint ist der AKTUELLE Wert, nicht der
//  aufgedruckte: die Kartensprache unterscheidet
//  das ausdrücklich (Ghuanjun sagt "this Hero's
//  BASE Attack stat", hier steht nur "its Attack
//  stat"). `hero.atk` ist genau dieser gelebte
//  Wert — Buffs, Debuffs und Curse schreiben
//  direkt hinein.
//
//  Beide Seiten sind wählbar; der Text schränkt
//  nicht ein. Ein Held ohne Angriff (0, z.B. durch
//  Curse) ist damit ein zulässiges, aber wirkungs-
//  loses Ziel — die Zielabfrage zeigt die Regel an,
//  die Entscheidung bleibt beim Spieler.
//
//  ── Rahmen ──
//  Freier Aktiv-Effekt in der Main Phase, einmal je
//  Zug (Standard von `creatureEffect`). Abbruch in
//  der Zielwahl gibt die Sperre über `return false`
//  wieder frei.
//
//  `baseDamage` bleibt bewusst ungesetzt: der Wert
//  hängt am Ziel, und die Vorschau kennt nur EINE
//  Zahl für alle. Der konkrete `damageType` genügt
//  der Engine, um die Abfrage als Schadensauswahl
//  zu behandeln (Untargetable-Prüfung, Surprise-
//  Fenster).
// ═══════════════════════════════════════════

const CARD_NAME = 'Sorbereus, the Adapting Dragon';

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero'],
      damageType: 'creature',
      title: CARD_NAME,
      description: 'Choose a Hero. It takes damage equal to its own Attack stat.',
      confirmLabel: '🐉 Adapt!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero || !(hero.hp > 0)) return false;
    const damage = Math.max(0, hero.atk || 0);

    if (damage > 0) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'critical_slash',
        // Nur der Schnitt, ohne die "CRITICAL!"-Schrift: der Held wird
        // von seinem eigenen Angriff getroffen, das ist kein
        // Kritischer Treffer.
        noLabel: true,
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
      });
      await engine._delay(450);
      await ctx.dealDamage(hero, damage, 'creature');
    }

    engine.log('sorbereus_adapt', {
      player: gs.players[pi]?.username,
      target: engine._heroLabel ? engine._heroLabel(hero) : hero.name,
      damage,
    });
    engine.sync();
    return true;
  },
};

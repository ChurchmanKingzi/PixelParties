// ═══════════════════════════════════════════
//  CARD EFFECT: "Molinda, the Cutest Being in the Sky"
//  Ascended Hero — 600 HP / 80 ATK — Ascension bonus: Charme 3
//
//  "You must play this Hero from your hand on top of a 'Cute Angel
//   Molinda' you control that is equipped with 'Heart-Shaped Bow, the
//   Final Proof of Cuteness' and has used at least 2 'Love Shot' Spells
//   so far this game. You may once per turn choose a target
//   your opponent controls and take control of it for the rest of the
//   turn."
//
//  Aufstieg: Bedingung in `_molinda-shared.js`, Bonus wie Arthor ueber
//  `performAscensionBonus(['Charme'])`.
//
//  Heldeneffekt (kein Aktionsverbrauch): Ziel beim Gegner (Held oder
//  Kreatur) → `actionStealHero` / `actionStealCreature` — dieselben
//  Zug-befristeten Uebernahmen wie Deepsea Succubus (Rueckgabe am
//  Zugbeginn durch die Engine, `onTakeControl`-Fenster fuer Very
//  Special Prisoner). Anders als die Succubus OHNE Schadensimmunitaet:
//  der Text verspricht keine. Boris-Sperre ueber `takesControlOfTargets`.
// ═══════════════════════════════════════════

const { ASCEND_TARGET, molindaAscensionMet } = require('./_molinda-shared');

const CARD_NAME = ASCEND_TARGET;

/** Gibt es beim Gegner ein uebernehmbares Ziel? */
function stealableTargets(engine, pi) {
  const gs = engine.gs;
  const opp = pi === 0 ? 1 : 0;
  const ops = gs.players[opp];
  if (!ops) return 0;
  if (gs.firstTurnProtectedPlayer === opp) return 0;
  let n = 0;
  for (const h of (ops.heroes || [])) if (h?.name && h.hp > 0 && h.charmedBy == null) n++;
  for (const c of engine.cardInstances) {
    if (c.owner !== opp || c.zone !== 'support' || c.stolenBy != null || c.faceDown) continue;
    const cd = engine.getEffectiveCardData?.(c) || engine._getCardDB()[c.name];
    if (!cd || cd.cardType !== 'Creature') continue;
    if (engine.isOmniImmune?.(c)) continue;
    n++;
  }
  return n;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  requiresTarget: true,
  takesControlOfTargets: true,
  // Rein schaedlich fuer den Gegner — unter dem Spielstart-Schutz gesperrt.
  heroEffectHarmfulOnly: true,

  ascensionCondition(gs, pi, heroIdx, engine) {
    return molindaAscensionMet(engine, pi, heroIdx, null);
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Charme']);
  },

  canActivateHeroEffect(ctx) {
    return stealableTargets(ctx._engine, ctx.cardOwner) > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const target = await ctx.promptDamageTarget({
      side: 'enemy', types: ['hero', 'creature'],
      title: CARD_NAME,
      description: 'Choose a target your opponent controls and take control of it for the rest of the turn.',
      confirmLabel: '💖 Charm!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!target) return false;

    // Herz-Projektil + Herzchen-Burst — dieselbe Bauform wie Love Shot
    // (`projectile-love-heart` / `love_burst`, Al 30.8.). Spielt VOR der
    // Uebernahme und unabhaengig davon, ob sie durchgeht (Immunitaeten
    // blocken Effekte, nie Animationen).
    const zoneSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
    const PROJECTILE_MS = 1100;
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx,
      targetOwner: target.owner, targetHeroIdx: target.heroIdx, targetZoneSlot: zoneSlot,
      projectileClass: 'projectile-love-heart', trailClass: 'projectile-love-trail',
      duration: PROJECTILE_MS,
    });
    await engine._delay(PROJECTILE_MS);
    engine._broadcastEvent('play_zone_animation', {
      type: 'love_burst', owner: target.owner, heroIdx: target.heroIdx, zoneSlot,
    });
    await engine._delay(250);

    let ok = false;
    if (target.type === 'hero') {
      ok = engine.actionStealHero(pi, target.owner, target.heroIdx, { sourceName: CARD_NAME });
    } else if (target.cardInstance) {
      ok = engine.actionStealCreature(pi, target.cardInstance, { sourceName: CARD_NAME });
    }
    if (!ok) return false;
    engine.log('molinda_charm', { player: ps.username, target: target.cardName || target.name || null });
    engine.sync();
    return true;
  },
};

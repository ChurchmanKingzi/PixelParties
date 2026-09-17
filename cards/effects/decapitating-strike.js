// ═══════════════════════════════════════════
//  CARD EFFECT: „Decapitating Strike"
//  Attack (Reaction, Fighting Lv1)
//
//  "Play this card immediately when a target is left at 50 or less HP
//   after taking damage. Defeat that target."
//
//  ── „LEFT AT 50 OR LESS HP AFTER TAKING DAMAGE" ──────────────────
//  ★ Der Zeitpunkt ist NACH dem Schaden, und die Schwelle misst den
//  REST, nicht den Schaden. Beide Nach-Schadens-Fenster der Engine
//  liefern genau das:
//    `isAfterDamageReaction`         → Helden
//    `isAfterCreatureDamageReaction` → Kreaturen
//  „a target" nennt keine Art und keine Seite, also beide Fenster und
//  beide Seiten (Corpse-Explosion-Muster, inklusive
//  `firesForOpponentDefeat`).
//
//  ★ ABER NICHT AUF EINEN BEREITS TOTEN. Bei 0 HP ist das Ziel schon
//  besiegt — „left at 50 or less" meint ein Ziel, das NOCH STEHT.
//  Deshalb KEIN `firesOnLethalDamage`: das Fenster bietet die Karte auf
//  dem toedlichen Schlag gar nicht erst an, und die Bedingung verlangt
//  zusaetzlich `hp > 0`. Ohne diese Grenze waere die Karte auf jedem
//  Kill ein wirkungsloser Leerlauf.
//
//  ── „DEFEAT THAT TARGET" ─────────────────────────────────────────
//  Ein Insta-Kill, kein Schaden — `actionDefeatHero` bzw.
//  `actionDestroyCard`. Damit laeuft er an Schadensminderung und
//  Versteinerung vorbei, greift aber in die vorhandenen
//  Niederlage-Fenster (Extra-Leben, Guardian Angel), was richtig ist:
//  „defeat" ist genau das, worauf die reagieren.
//
//  ★ Und er laeuft durch `actionDestroyCard` — also durch das
//  Zerstoerungs-Fenster von „Enhanced Guard Dog" (v1057). Eine einzelne
//  Zerstoerung, der Dog darf sie also abfangen. Genau richtig.
//
//  ── ANIMATION ────────────────────────────────────────────────────
//  v1154 (Al 17.9.): `decapitation` — gross und blutig, mit Klang, am
//  richtigen Ziel (das alte `sword_cleave` las seine Position nicht).
// ═══════════════════════════════════════════

const CARD_NAME = 'Decapitating Strike';
const SCHWELLE = 50;

/**
 * Der Schlag samt Animation — fuer beide Zielarten derselbe.
 * ★★ v1154: `decapitation` (gross und blutig, mit Klang) statt
 * `sword_cleave`; laenger stehen gelassen (1,7 s), und die Niederlage
 * folgt erst nach Schnitt und erstem Stoss der Fontaene.
 */
async function schlag(engine, owner, heroIdx, zoneSlot) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'decapitation', owner, heroIdx, zoneSlot, duration: 1700,
  });
  await engine._delay(700);
}

module.exports = {
  // Reaction-only: weder `proactivePlay` noch `isReaction`, damit die
  // Karte nie aus der Hand anklickbar ist (Corpse-Explosion-Muster).

  // ── HELD ──────────────────────────────────────────────────────────
  isAfterDamageReaction: true,

  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    if (!target || target.hp === undefined) return false;
    // ★ Muss NOCH STEHEN — ein toter Held ist kein „target left at 50".
    if (target.hp <= 0) return false;
    return target.hp <= SCHWELLE;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    const owner = engine._findHeroOwner(target);
    if (owner < 0) return;
    if (!target?.name || target.hp <= 0) return;

    await schlag(engine, owner, targetHeroIdx, -1);
    // ★ Signatur ist `(source, target, opts)` — die QUELLE steht vorn.
    // Mit dem Ziel als erstem Argument lief der Aufruf still ins Leere
    // (der Held blieb stehen); der Testfall hat es gefangen.
    await engine.actionDefeatHero(
      { name: CARD_NAME, owner: pi, controller: pi },
      target,
      { sourceOwner: pi, reason: CARD_NAME },
    );
    engine.log('decapitating_strike', {
      player: engine.gs.players[pi]?.username,
      target: target.name, restHp: target.hp,
    });
    engine.sync();
  },

  // ── KREATUR ───────────────────────────────────────────────────────
  isAfterCreatureDamageReaction: true,
  // Auch, wenn die Kreatur dem GEGNER gehoert — „a target" kennt keine
  // Seite.
  firesForOpponentDefeat: true,

  afterCreatureDamageCondition(gs, pi, engine, inst, source, amount, type) {
    if (!inst || inst.zone !== 'support') return false;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    const max = inst.counters?.maxHp ?? cd?.hp ?? 0;
    const rest = inst.counters?.currentHp ?? (max - (inst.counters?.damageTaken || 0));
    if (!(rest > 0)) return false;          // schon tot
    return rest <= SCHWELLE;
  },

  async afterCreatureDamageResolve(engine, pi, inst, source, amount, type) {
    if (!inst || inst.zone !== 'support') return;
    // ★ Physische Seite: eine uebernommene Kreatur steht auf der Seite
    // ihres Kontrolleurs.
    const seite = engine.physicalSide ? engine.physicalSide(inst) : (inst.controller ?? inst.owner);
    await schlag(engine, seite, inst.heroIdx, inst.zoneSlot);
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, controller: pi },
      inst,
      { sourceOwner: pi, sourceName: CARD_NAME, fireCreatureDeath: true },
    );
    engine.log('decapitating_strike', {
      player: engine.gs.players[pi]?.username, target: inst.name,
    });
    engine.sync();
  },
};

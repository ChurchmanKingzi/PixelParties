// ═══════════════════════════════════════════
//  CARD EFFECT: "Corpse Explosion"
//  Spell (Reaction) — Destruction Magic Lv2
//
//  "Play this card immediately when a target is defeated by an Attack
//   or Spell. Deal 50 damage to all targets the opponent of the
//   defeated target controls."
//
//  • Reaction-only — like Spiky Armor, cards.json marks the subtype
//    "Reaction" and this script exports NEITHER `proactivePlay` NOR
//    `isReaction`, so it can never be clicked from hand and the generic
//    reaction-chain collector skips it. It fires ONLY through the
//    engine's after-damage hand-reaction hubs.
//  • "a target is defeated" = a Hero OR a Creature, so both hubs are
//    used: `isAfterDamageReaction` (Hero) + `isAfterCreatureDamageReaction`
//    (Creature). `firesOnLethalDamage: true` is required so the hubs
//    still offer it on the killing blow; each condition then confirms
//    the target was actually defeated.
//  • "defeated by an Attack or Spell" — the damage `type` is `'attack'`
//    for Attacks and `'<school>_spell'` for Spells; Creature-effect /
//    status kills are excluded.
//  • `firesForOpponentDefeat: true` — opt-in flag the creature
//    after-damage hub honours so a HUMAN player may also chain Corpse
//    Explosion when the OPPONENT's Creature dies (not just their own).
//    CPUs are never offered that path (they would just self-damage).
//  • "The opponent of the defeated target" is fixed: `1 - C` where `C`
//    is the defeated target's controller — regardless of who plays the
//    card. Routed by synthesising a Corpse Explosion instance whose
//    controller is `C` and calling `actionAoeHit` with `side: 'enemy'`.
//    That engine path also handles Cardinal Beast omni-immunity and
//    shielded Heroes.
//  • Visual: ONE huge screen-engulfing explosion (`corpse_explosion`
//    zone animation) centred on the dying target — NO per-target
//    animations (`actionAoeHit` is called WITHOUT `animationType`).
// ═══════════════════════════════════════════

const CARD_NAME = 'Corpse Explosion';

/** "by an Attack or Spell" — Attacks deal type 'attack', Spells deal a
 *  '<school>_spell' type. Creature-effect / status kills are excluded. */
function defeatedByAttackOrSpell(type) {
  return type === 'attack' || (typeof type === 'string' && type.includes('spell'));
}

/**
 * Deal 50 damage to every Hero and Creature the opponent of the
 * defeated target controls. `defeatedControllerSide` is the defeated
 * target's controller — a synthetic instance controlled by that side
 * makes `actionAoeHit`'s `side: 'enemy'` resolve to "the opponent of
 * the defeated target", whoever actually played the card.
 *
 * `loc` = { owner, heroIdx, zoneSlot } of the defeated target — the
 * single screen-wide explosion is centred there.
 */
async function explode(engine, defeatedControllerSide, loc) {
  // ── One huge explosion, centred on the dying target ──
  if (loc) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'corpse_explosion',
      owner: loc.owner, heroIdx: loc.heroIdx, zoneSlot: loc.zoneSlot,
      duration: 1600,
    });
    await engine._delay(620); // let the fireball bloom before damage lands
  }

  const inst = engine._trackCard(CARD_NAME, defeatedControllerSide, 'hand', -1, -1);
  try {
    await engine.actionAoeHit(inst, {
      damage: 50,
      damageType: 'destruction_spell',
      side: 'enemy', // = 1 - defeatedControllerSide = opponent of the defeated target
      types: ['hero', 'creature'],
      // No `animationType` — the single screen-wide blast above is the
      // ONLY visual; per-target explosions are intentionally omitted.
      sourceName: CARD_NAME,
    });
  } catch (err) {
    console.error(`[${CARD_NAME}] explode error:`, err.message);
  } finally {
    engine._untrackCard(inst.id);
  }
  engine.log('corpse_explosion', {
    victim: engine.gs.players[engine.opponentOf(defeatedControllerSide)]?.username,
  });
  engine.sync();
}

/** W24a (N1-05): war die Todesquelle eine Attack- oder Spell-KARTE (Besiegen ohne Schaden)? */
function quelleIstAttackOderSpell(engine, source) {
  const cd = source?.name ? engine._getCardDB()[source.name] : null;
  const typ = String(cd?.cardType || '');
  return typ.includes('Attack') || typ.includes('Spell');
}

module.exports = {
  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'corpse_explosion' }, impactMs: 260 },

  // Required so the after-damage hubs still offer this card on the
  // killing blow (without it they skip it on every lethal hit).
  firesOnLethalDamage: true,

  // Opt-in: the creature after-damage hub also offers Corpse Explosion
  // to the HUMAN opponent of the defeated Creature's controller — so a
  // player may chain it to an opponent's Creature dying, not just their
  // own. CPUs are never offered this path.
  firesForOpponentDefeat: true,

  // ── HERO defeated → shared hero after-damage hub ──
  isAfterDamageReaction: true,

  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    return defeatedByAttackOrSpell(type) && !!target && target.hp <= 0;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    // `pi` is the player who PLAYED the card — the defeated Hero's
    // owner, or (via `firesForOpponentDefeat`) that owner's opponent.
    // The AoE direction keys off the defeated HERO's owner, not the
    // player, so it stays "the opponent of the defeated target".
    const physSide = engine.gs.players.findIndex(
      p => (p.heroes || []).includes(target));
    if (physSide < 0) return;
    // W24a (N1-04): Kontrolle statt Seite — bei einem uebernommenen Helden ist sein KONTROLLEUR die Seite des Gefallenen
    // (`heroSideOf`), die Explosion zielt auf dessen Gegner; der Blitz bleibt an der physischen Heldenposition.
    const defeatedControllerSide = engine.heroSideOf ? engine.heroSideOf(physSide, target) : physSide;
    await explode(engine, defeatedControllerSide, {
      owner: physSide, heroIdx: targetHeroIdx, zoneSlot: -1,
    });
  },

  // ── W24a (N1-05): „defeated by an Attack or Spell" auch OHNE Schaden ──
  // Trial of Dominance, Goldify (Kreaturen) und Insta-Kills wie Hand of Death (Helden) besiegen ohne Schadenseintrag; die Nach-Schaden-Fenster
  // oben sehen sie nie. Die Einzel-Fenster „Kreatur/Held besiegt" melden sie (Zwilling von Core Explosion); Schadenstode laufen weiter
  // NUR ueber die Nach-Schaden-Fenster (kein `type` bzw. kein `ohneSchaden`), damit die Karte nie doppelt angeboten wird.
  isCreatureDefeatedReaction: true,

  creatureDefeatedCondition(gs, pi, engine, deathInfo, source, type) {
    if (type || !deathInfo) return false;                       // Schadenstod: Nach-Schaden-Fenster
    return quelleIstAttackOderSpell(engine, source);
  },

  async creatureDefeatedResolve(engine, pi, deathInfo) {
    const seite = deathInfo.controller ?? deathInfo.owner;
    await explode(engine, seite, { owner: deathInfo.owner, heroIdx: deathInfo.heroIdx, zoneSlot: deathInfo.zoneSlot });
  },

  isHeroDefeatedReaction: true,

  heroDefeatedCondition(gs, pi, engine, info) {
    if (!info?.ohneSchaden || !info.hero) return false;
    if (engine.heroSideOf(pi, info.hero) !== pi) return false;   // Kontrolle statt Seite: nur der Kontrolleur reagiert
    return quelleIstAttackOderSpell(engine, info.source);
  },

  async heroDefeatedResolve(engine, pi, info) {
    await explode(engine, engine.heroSideOf(pi, info.hero), { owner: pi, heroIdx: info.heroIdx, zoneSlot: -1 });
    return false;                                               // der Held bleibt besiegt
  },

  // ── CREATURE defeated → additive creature after-damage hub ──
  isAfterCreatureDamageReaction: true,

  afterCreatureDamageCondition(gs, pi, engine, inst, source, amount, type) {
    if (!defeatedByAttackOrSpell(type) || !inst) return false;
    return (inst.counters?.currentHp ?? 1) <= 0 || inst.zone !== 'support';
  },

  async afterCreatureDamageResolve(engine, pi, inst, source, amount, type) {
    // `pi` is the player who PLAYED the card (the defeated Creature's
    // controller, or — via `firesForOpponentDefeat` — that controller's
    // opponent). The AoE direction keys off the defeated CREATURE's
    // controller, not the player, so it is always "the opponent of the
    // defeated target". Centre the blast on the Creature's slot.
    const defeatedControllerSide = inst.controller ?? inst.owner;
    await explode(engine, defeatedControllerSide, {
      owner: defeatedControllerSide,
      heroIdx: inst.heroIdx,
      zoneSlot: inst.zoneSlot,
    });
  },
};

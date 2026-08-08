// ═══════════════════════════════════════════
//  CARD EFFECT: "Cykyran War Counsellor"
//  Creature (Summoning Magic Lv2, Normal) — 150 HP
//
//  EFFECT:
//   "You can only control 1 \"Cykyran War
//    Counsellor\".
//    While you control at least 3 different \"War
//    Counsellor\" Creatures, your Heroes' Base Attack
//    stats are doubled. You may once per turn choose a
//    target and deal damage equal to one of your
//    Heroes' Attack stats to it. That damage cannot
//    exceed 300."
//
//  ── ① Die Verdopplung ──
//  Verdoppelt wird der BASISWERT, nicht der
//  Gesamtangriff (Als Ruling 8.8.): 80 Basis + 30 vom
//  Equip ergibt 190, nicht 210. Der Bonus ist also
//  immer genau der natuerliche Basiswert — er waechst
//  nicht mit fremden Buffs mit und stapelt auch mit
//  mehreren Kopien nicht, weil der neue Basiswert
//  stets das Doppelte des normalen ist.
//
//  Die Engine fuehrt beides getrennt: `hero.baseAtk`
//  ist der natuerliche Wert (Ghuanjun liest genau
//  den), `hero.atk` der gelebte Gesamtwert. Weil der
//  Kartentext den BASISWERT verdoppelt, ziehe ich
//  beide Felder mit — sonst waere die Differenz
//  `atk − baseAtk`, die andere Karten als "Summe der
//  Buffs" lesen, um den Bonus verfaelscht.
//
//  Buch fuehrt `hero._cykyranBonus`. `resync` rechnet:
//      natuerliche Basis = hero.baseAtk − eigener Bonus
//      Sollbonus         = Bedingung ? Basis : 0
//  und legt nur die DIFFERENZ an. Steht der Sollwert
//  schon, passiert gar nichts — sonst floss bei jedem
//  Feldereignis eine +/−-Animation ueber den Schirm.
//  Da der Bonus nicht mehr am Gesamtwert haengt, kann
//  ihn auch kein fremder Buff mehr verschieben; nur
//  die BEDINGUNG muss nachgerechnet werden.
//
//  Der Weg ueber `engine._applyHeroAtkDelta` ist
//  Absicht: dort haengt die Curse-Regel ("Angriff ist
//  0"), die eine direkte Zuweisung umgehen wuerde.
//
//  ── ② Der Schuss ──
//  "one of your Heroes" — der Spieler waehlt, welcher
//  Held den Wert stellt; gedeckelt bei 300. Der
//  angesagte Wert ist der AKTUELLE (also inklusive der
//  eigenen Verdopplung, falls sie greift).
// ═══════════════════════════════════════════

const {
  WC,
  countDistinctWarCounsellors,
  makeSingletonCanSummon,
} = require('./_war-counsellor-shared');

const CARD_NAME = 'Cykyran War Counsellor';
const NEEDED_DISTINCT = 3;
const DAMAGE_CAP = 300;

/** Verdopplung an- oder abgleichen. */
function resync(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const active = countDistinctWarCounsellors(engine, pi) >= NEEDED_DISTINCT;

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    const current = hero._cykyranBonus || 0;
    // Natuerlicher Basiswert = gespeicherte Basis minus unser eigener
    // Zuschlag. Fehlt `baseAtk` (aeltere Spielstaende), dient der
    // Gesamtwert als Notbehelf.
    const storedBase = hero.baseAtk !== undefined ? hero.baseAtk : (hero.atk || 0);
    const natural = Math.max(0, storedBase - current);
    const wanted = active ? natural : 0;
    const delta = wanted - current;
    if (!delta) continue;
    engine._applyHeroAtkDelta(hero, pi, hi, delta);
    if (hero.baseAtk !== undefined) hero.baseAtk = Math.max(0, hero.baseAtk + delta);
    hero._cykyranBonus = wanted;
  }
}

/** Nur aus einer offen im Support stehenden Kopie heraus. */
function resyncFromCtx(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  resync(ctx._engine, ctx.cardOwner);
}

module.exports = {
  // Harte Obergrenze dieses Schadens. Minocretes Verdoppler liest sie und
  // klemmt danach wieder auf 300 — "cannot exceed 300" gilt auch mit
  // fremder Hilfe (Als Ruling 8.8.).
  damageCap: DAMAGE_CAP,

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    return (ps?.heroes || []).some((h) => h?.name && h.hp > 0 && (h.atk || 0) > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Welcher Held stellt den Wert? ──
    const options = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || !(hero.hp > 0)) continue;
      const atk = hero.atk || 0;
      if (atk <= 0) continue;
      const dmg = Math.min(DAMAGE_CAP, atk);
      options.push({
        id: String(hi),
        label: `⚔️ ${hero.name} — ${dmg}`,
        description: atk > DAMAGE_CAP
          ? `Attack ${atk}, capped at ${DAMAGE_CAP}.`
          : `Attack ${atk}.`,
        color: '#ff4444',
      });
    }
    if (options.length === 0) return false;

    let heroIdx = Number(options[0].id);
    if (options.length > 1) {
      const pick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Which Hero\'s Attack stat should set the damage?',
        showCard: CARD_NAME,
        options,
        cancellable: true,
      });
      if (!pick || pick.cancelled || pick.optionId == null) return false;
      heroIdx = Number(pick.optionId);
    }
    const sourceHero = ps.heroes?.[heroIdx];
    if (!sourceHero?.name || !(sourceHero.hp > 0)) return false;
    const damage = Math.min(DAMAGE_CAP, sourceHero.atk || 0);
    if (!(damage > 0)) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage — ${sourceHero.name}'s Attack stat${(sourceHero.atk || 0) > DAMAGE_CAP ? ` (capped at ${DAMAGE_CAP})` : ''}.`,
      confirmLabel: `⚔️ Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      // Keule, die von oben aufs Ziel schwingt — dieselbe wie beim
      // 3-Headed Giant (Als Vorgabe).
      type: 'spiked_club_smash',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('cykyran_strike', {
      player: ps.username, hero: sourceHero.name, target: target.cardName, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Bedingung UND Grundwert koennen sich bei jedem dieser Ereignisse
    // aendern — kein Filter auf die gespielte Karte, gerade FREMDE
    // Beschwoerungen und Tode veraendern ja die Ratgeberzahl.
    onPlay: (ctx) => resyncFromCtx(ctx),
    onCardEnterZone: (ctx) => resyncFromCtx(ctx),
    onCardLeaveZone: (ctx) => resyncFromCtx(ctx),
    onCreatureDeath: (ctx) => resyncFromCtx(ctx),
    onTurnStart: (ctx) => resyncFromCtx(ctx),
    afterDamage: (ctx) => resyncFromCtx(ctx),
  },
};

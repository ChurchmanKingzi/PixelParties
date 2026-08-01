// ═══════════════════════════════════════════
//  CARD EFFECT: "Smoke Vial"
//  Potion — All Heroes the opponent controls are
//  Blinded until the end of YOUR next turn.
//
//  Blinded silences targeted Attacks / Spells /
//  effects but lets full-AoE plays through.
//  Duration is "until the end of the caster's
//  next turn". Buff/status expiry runs at
//  TURN-START only (_processBuffExpiry), and
//  gs.turn increments per player-turn, so with
//  cast=T → opp T+1 → caster's next turn T+2 →
//  opp T+3, the Blinded must survive through ALL
//  of T+2 and be gone by T+3. It therefore
//  expires at the START of T+3 — the first
//  turn-start AFTER the end of the caster's next
//  turn: expiresAtTurn = gs.turn + 3,
//  expiresForPlayer = opponent (the active
//  player at T+3).
//
//  (Previously this used the "+2 / caster"
//  pattern, which actually expires at the START
//  of the caster's next turn — i.e. "until the
//  START of your next turn". Corrected to the
//  literal card text; Disruption Ray uses the
//  same convention.)
//
//  Visual: thick gray smoke clouds enveloping
//  ALL three opponent hero slots — including
//  immune ones, dead ones, or empty ones — even
//  though the Blinded status itself only sticks
//  on alive, vulnerable heroes (immune / shielded
//  blocks are honoured by addHeroStatus).
// ═══════════════════════════════════════════

// Score-Bonus je Gegner-Held, der durch diesen Wurf NEU geblendet wird.
// Die Gate-Grundschwelle ist MCTS_ACTIVATION_GATE_THRESHOLD = 3, ein
// Ziel hebt die Karte also spürbar über die Standard-Hürde, ohne sie zu
// erzwingen — genau der Stellschrauben-Wert, an dem sich nach dem
// nächsten Training drehen lässt.
const BLIND_BONUS_PER_TARGET = 8;

/**
 * Zählt für die CPU-Heuristik, was dieser Wurf tatsächlich bewirken
 * würde. `helpers.isTargetImmune` ist die Ziel-Hygiene der CPU (tot,
 * immun, Baihu-Petrify, gecharmt, submerged, Erstzug-Schild) — bewusst
 * wiederverwendet, statt die Immunitätsregeln hier zu duplizieren.
 *
 * Rückgabe:
 *   alive      — lebende Gegner-Helden
 *   covered    — davon nach dem Wurf geblendet (inkl. bereits geblendeter:
 *                die bleiben geblendet und bekommen die Dauer erneuert)
 *   fresh      — davon NEU geblendet (das ist der eigentliche Zugewinn)
 */
function blindImpact(engine, pi, helpers) {
  const gs = engine?.gs;
  const oi = pi === 0 ? 1 : 0;
  const heroes = gs?.players?.[oi]?.heroes || [];
  const immune = typeof helpers?.isTargetImmune === 'function'
    ? helpers.isTargetImmune
    : null;
  let alive = 0, covered = 0, fresh = 0;
  for (let hi = 0; hi < heroes.length; hi++) {
    const hero = heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    alive++;
    const already = !!hero.statuses?.blinded;
    // Ohne Helfer (Aufrufer ohne Bündel) nur der billige Immun-Check —
    // die Heuristik bleibt dann konservativ statt falsch optimistisch.
    const blocked = immune
      ? immune(engine, { type: 'hero', owner: oi, heroIdx: hi })
      : !!hero.statuses?.immune;
    if (already) { covered++; continue; }
    if (blocked) continue;
    covered++;
    fresh++;
  }
  return { alive, covered, fresh };
}

module.exports = {
  isPotion: true,

  // ── CPU-Sonderlogik (Als Ruling) ─────────────────────────────────
  // Smoke Vial gehört zur selben Klasse wie Flashbang: die Wirkung
  // ("bis zum Ende DEINES nächsten Zuges") entfaltet sich erst im
  // Gegnerzug, die Sofortbewertung des Gates sieht davon nichts.
  // Anders als bei Flashbang skaliert der Wert hier aber mit der Lage,
  // deshalb zweistufig:
  //   • Vollabdeckung (JEDER lebende Gegner-Held ist danach geblendet
  //     und mindestens einer davon neu) → auto-commit. Ein kompletter
  //     Blackout der Gegner-Reihe ist immer den Wurf wert.
  //   • sonst → Score-Bonus je NEU geblendetem Ziel; das Gate wägt
  //     weiter ab und lässt die Vial liegen, wenn die Stellung
  //     dagegenspricht.
  // Die Zusatzbedingung "mindestens ein neues Blind" verhindert den
  // Leerwurf, wenn ohnehin schon alle geblendet sind (nur Dauer-Refresh)
  // — dieselbe Falle wie Flashbangs Doppelwurf.
  cpuMeta: {
    alwaysCommit: (engine, pi, helpers) => {
      const { alive, covered, fresh } = blindImpact(engine, pi, helpers);
      return alive > 0 && fresh > 0 && covered === alive;
    },
    activationScoreBonus: (engine, pi, helpers) =>
      BLIND_BONUS_PER_TARGET * blindImpact(engine, pi, helpers).fresh,
  },

  canActivate(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    return (gs.players[oi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const oi = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oi];
    if (!oppPs) return;

    // Start of the opponent's turn that follows the caster's next turn
    // = just after the end of the caster's next turn. See header.
    const expiresTurn = gs.turn + 3;

    // Smoke envelops all three opponent hero slots regardless of
    // alive/dead/immune state — the visual is part of the play, not the
    // status. addHeroStatus below still honours immune / shielded /
    // dead checks so the Blinded itself only sticks where it can.
    const heroCount = (oppPs.heroes || []).length;
    for (let hi = 0; hi < heroCount; hi++) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'smoke_vial', owner: oi, heroIdx: hi, zoneSlot: -1,
      });
    }
    await engine._delay(450);

    let landed = 0;
    for (let hi = 0; hi < heroCount; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      await engine.addHeroStatus(oi, hi, 'blinded', {
        expiresAtTurn: expiresTurn,
        expiresForPlayer: oi,
        appliedBy: pi,
        source: 'Smoke Vial',
      });
      landed++;
    }

    engine.log('smoke_vial', {
      player: gs.players[pi]?.username,
      blinded: landed,
    });
    engine.sync();
  },
};

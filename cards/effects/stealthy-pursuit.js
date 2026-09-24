// ═══════════════════════════════════════════
//  CARD EFFECT: „Stealthy Pursuit"
//  Spell · Reaction · Support Magic Lv1 · PP WAW
//
//  „Play this card immediately when one of your Heroes that can use
//   this Spell performs a different Attack or Spell. Until the end of
//   your next turn, that Hero cannot be chosen by your opponent's cards
//   or effects while you control another Hero that can be chosen by
//   them. Delete this card."
//
//  ── ZWEI SCHABLONEN ───────────────────────────────────────────────
//  · Das FENSTER ist das generische Kettenfenster, dasselbe wie bei den
//    Arrows („when a Hero you control performs an Attack"): jede Attack
//    und jeder Spell aus der Hand eroeffnet ueber `executeCardWithChain`
//    eine Kette, beide Spieler duerfen anhaengen. Auch eine REAKTIONS-
//    Attack/-Spell dieses Helden zaehlt als „performs" (Als Vorgabe
//    17.9.) — sie steht als Glied in derselben Kette.
//  · Die WIRKUNG ist die von „Dive Down": die Karte loescht sich und
//    haengt ihre Regel ueber `engine.addHeroTargetBlocker` an den
//    Helden; die Regel selbst steht hier in `blocksTargeting`.
//
//  ── WER WIRKT ─────────────────────────────────────────────────────
//  „one of your Heroes that can use this Spell performs …" und „that
//  Hero" — Wirker und Geschuetzter sind DERSELBE Held: der, der gerade
//  gehandelt hat, und nur, wenn er Support Magic 1 wirken kann. Dafuer
//  der neue Engine-Vertrag `reactionCasterAllowed` (v1327): er schraenkt
//  die Wirkerliste des Kettenfensters ein, der Wirker-Picker bietet
//  dann nur noch passende Helden an (mehrere nur, wenn in derselben
//  Kette mehrere eigene Helden gehandelt haben).
//
//  ── „A DIFFERENT ATTACK OR SPELL" ─────────────────────────────────
//  Jede Attack und jeder Spell ausser „Stealthy Pursuit" selbst — eine
//  zweite Kopie kann also nicht auf die erste antworten.
//
//  ── „UNTIL THE END OF YOUR NEXT TURN" ─────────────────────────────
//  `gs.turn` zaehlt jeden Spielerzug. Im eigenen Zug T gewirkt → bis
//  einschliesslich T+2; im Gegnerzug T (Reaktions-Attack) → T+1.
//
//  ── „CANNOT BE CHOSEN" — NICHT „OR HIT" ───────────────────────────
//  Nur das Waehlen ist gesperrt. Flaechenschaden trifft den Helden;
//  der Schadenspfad kennzeichnet sich mit `info.hit` (v1327), dort
//  steigt die Regel aus. Gegen „your opponent's cards or effects" —
//  JEDE Quellenart (Attack, Spell, Creature, Artefakt, Potion, Held).
//
//  ── ANTI-LOCK ─────────────────────────────────────────────────────
//  „while you control another Hero that can be chosen by them" — ein
//  ANDERER lebender eigener Held, den DIESE Quelle waehlen koennte.
//  Wie bei Stealth/Dive Down zaehlt ein zweiter gleich geschuetzter Held
//  nicht, sonst schuetzten sich zwei gegenseitig ins Nichts; und ein
//  Held, den ein anderer Schutz (Stealth, Jetpack …) gegen diese Quelle
//  abschirmt, ist ebenfalls keine Alternative.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Stealthy Pursuit';
const INNEN = '_stealthyPursuitInnen';   // Rekursionsriegel fuer die Anti-Lock-Frage

// ── Ausloeser ─────────────────────────────────────────────────────

/**
 * Die Helden, die in dieser Kette gerade eine ANDERE eigene Attack oder
 * einen Spell ausgefuehrt haben. Initialglied: `heroIdx`; Reaktions-
 * glieder: `casterHeroIdx`.
 */
function handelndeHelden(gs, pi, engine, chainCtx) {
  const kette = chainCtx?.chain;
  const out = new Set();
  if (!Array.isArray(kette)) return out;
  const db = engine._getCardDB();
  for (const glied of kette) {
    if (!glied || glied.owner !== pi || glied.fromHero) continue;
    if (glied.cardName === CARD_NAME) continue;                 // „a different …"
    const cd = db[glied.cardName];
    if (!cd || !(hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) continue;
    const hi = glied.isInitialCard ? glied.heroIdx : (glied.casterHeroIdx ?? glied.heroIdx);
    if (!Number.isInteger(hi) || hi < 0) continue;
    const held = gs.players?.[pi]?.heroes?.[hi];
    if (!held?.name || held.hp <= 0) continue;
    out.add(hi);
  }
  return out;
}

// ── Die Regel ─────────────────────────────────────────────────────

/** Traegt dieser Held einen gueltigen Stealthy-Pursuit-Eintrag? */
function istVerborgen(gs, held) {
  const liste = held?._targetBlockers;
  if (!Array.isArray(liste)) return false;
  return liste.some(b => b.card === CARD_NAME && (b.untilTurn == null || gs.turn <= b.untilTurn));
}

/**
 * Hat der Besitzer einen ANDEREN Helden, den diese Quelle waehlen kann?
 * Fragt die volle Zielregel der Engine (Stealth, Jetpack, Dive Down …)
 * fuer den anderen Helden — mit Riegel, damit diese Karte sich dabei
 * nicht selbst wieder befragt.
 */
function andererWaehlbarerHeld(engine, info) {
  const gs = engine.gs;
  const ps = gs.players?.[info.heroOwner];
  const liste = Array.isArray(info.allTargets) ? info.allTargets : null;
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (hi === info.heroIdx) continue;
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.untargetable || h.statuses?.invisible) continue;
    if (istVerborgen(gs, h)) continue;                 // gleich geschuetzt zaehlt nicht
    // Kennt der Picker die legalen Ziele der Quelle, entscheidet die Liste.
    if (liste && !liste.some(t => t?.type === 'hero' && t.owner === info.heroOwner && t.heroIdx === hi)) continue;
    let geblockt = false;
    try {
      const { blocker, ...rest } = info;
      geblockt = engine.heroBlocksTargeting(info.heroOwner, hi, { ...rest, [INNEN]: true });
    } catch { geblockt = false; }
    if (geblockt) continue;
    return true;
  }
  return false;
}

module.exports = {
  // ★★ ENTKOPPELTE BILDER (CARD_API): wird die Karte negiert, laeuft ihr
  // Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'mist_veil' }, impactMs: 260 },

  isReaction: true,
  deleteOnUse: true,                       // „Delete this card."

  // Nie proaktiv — nur als Glied einer Kette.
  canActivate: () => false,

  /**
   * Ohne Kette (Handkarten-Abdunkeln) → false. Sonst: gibt es in dieser
   * Kette einen eigenen Helden, der gerade eine andere Attack / einen
   * Spell ausgefuehrt hat? Ob er die Karte auch WIRKEN kann, prueft das
   * Fenster ueber `reactionCasterAllowed` + seine Standard-Wirkerpruefung.
   */
  reactionCondition(gs, pi, engine, chainCtx) {
    return handelndeHelden(gs, pi, engine, chainCtx).size > 0;
  },

  /** v1327-Vertrag: nur der Held, der gehandelt hat, darf wirken. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, chainCtx) {
    return handelndeHelden(gs, pi, engine, chainCtx).has(heroIdx);
  },

  /**
   * ★ DIE REGEL. Gelesen von `heroBlocksTargeting` ueber den Eintrag am
   * Helden (v1191-Zweig) — in beiden Zielwaehlern, am Dispatcher und im
   * Schadenspfad; im letzten steigt sie aus („cannot be CHOSEN").
   */
  blocksTargeting(gs, engine, info) {
    if (info[INNEN]) return false;
    if (info._truthSeeingEye || info.ignoreUntargetable) return false;
    if (info.hit) return false;
    if (info.chooserIdx == null || info.chooserIdx === info.heroOwner) return false;
    const held = gs.players?.[info.heroOwner]?.heroes?.[info.heroIdx];
    if (!istVerborgen(gs, held)) return false;
    return andererWaehlbarerHeld(engine, info);
  },

  resolve: async (engine, pi, _sel, _val, chain, myIndex) => {
    const gs = engine.gs;
    const ps = gs.players?.[pi];
    const glied = Array.isArray(chain) ? chain[myIndex] : null;
    const heroIdx = glied?.casterHeroIdx ?? glied?.heroIdx;
    const held = ps?.heroes?.[heroIdx];
    if (!held?.name || held.hp <= 0) {
      engine.log('stealthy_pursuit_fizzle', { player: ps?.username });
      return;
    }

    // Nebel um den Helden — vorhandene Animation samt Klang (`elem_wind`).
    const NEBEL_MS = 1400;
    engine._broadcastEvent('play_zone_animation', {
      type: 'mist_veil', owner: pi, heroIdx, zoneSlot: -1, duration: NEBEL_MS,
    });
    await engine._delay(700);

    // „Until the end of your NEXT turn"
    const bisZug = gs.activePlayer === pi ? gs.turn + 2 : gs.turn + 1;
    engine.addHeroTargetBlocker(pi, heroIdx, CARD_NAME, { untilTurn: bisZug, appliedBy: pi });

    engine.log('stealthy_pursuit', { player: ps.username, hero: held.name });
    engine.sync();
    await engine._delay(NEBEL_MS - 700);
  },

  cpuMeta: {
    // Schutz lohnt nur mit einem zweiten lebenden Helden (Anti-Lock).
    reactionHeuristic(engine) {
      const pi = engine._cpuPlayerIdx;
      const lebend = (engine.gs.players?.[pi]?.heroes || []).filter(h => h?.name && h.hp > 0);
      return lebend.length >= 2;
    },
  },

  // Fuer Tests und Nachbarkarten.
  istVerborgen,
};

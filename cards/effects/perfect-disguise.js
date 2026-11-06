// ═══════════════════════════════════════════
//  CARD EFFECT: "Perfect Disguise"
//  Artifact (Normal, 4 Gold, once per game)
//
//  Choose a target you control. That target
//  cannot be chosen by your opponent during their
//  next turn, except if it is your only legal
//  target.
//
//  ── Regel (Entscheidung Al) ───────────────────────────────────
//  „Except if it is your only legal target" = das EINZIGE LEGALE ZIEL
//  der gegnerischen Karte AUF DER EIGENEN SEITE. Massgeblich ist die
//  Liste der legalen Ziele DIESER Quelle (`info.allTargets`):
//    · kann sie NUR Heroes waehlen: der verkleidete Held ist waehlbar,
//      wenn er der letzte eigene (waehlbare) Held ist;
//    · kann sie Heroes ODER Creatures waehlen: er muss das einzige
//      Ziel ueberhaupt sein (eine Kreatur schuetzt den Helden, ein
//      Held schuetzt die Kreatur);
//    · kann sie nur Frozen Heroes waehlen: es braucht einen zweiten
//      Frozen Hero, um den verkleideten zu schuetzen.
//  Ein anderer Held, der selbst nicht waehlbar ist (Butterfly Cloud,
//  Invisibility, Stealth …), ist kein Ausweichziel.
//
//  Implementation
//  ──────────────
//  • Hero target: haengt den Zielschutz per `engine.addHeroTargetBlocker`
//    an den Helden (v1191, wie Dive Down/Stealthy Pursuit); die Regel
//    steht im Vertrag `blocksTargeting` unten und liest `info.allTargets`.
//    Frist: bis zum Beginn des naechsten eigenen Zuges des Wirkers
//    (`untilTurn` = der Gegnerzug dazwischen; ein uebersprungener
//    Gegnerzug verlaengert ueber `_zug-fristen.js`). Nur WAHL
//    („cannot be chosen"), nicht „or hit": Flaecheneffekte treffen.
//  • Creature target: stamps the soft-untargetable counter pair on the inst —
//      inst.counters.softUntargetable_by_opponent = 1
//      inst.counters.softUntargetable_by_opponent_pi = oppIdx
//    Die Engine-Zielwaehler (promptDamageTarget + promptMultiTarget)
//    lassen markierte Kreaturen weg, solange auf derselben Seite ein
//    anderes legales Ziel der Quelle (Held ODER Kreatur, soweit die
//    Quelle es anbietet) bleibt. Cleared at the START phase of the
//    caster's next turn (W68a: nur echte Gegnerzuege zaehlen).
//  • AoE auto-targeting (Heat Wave, Cataclysm,
//    Spawn Mother's board mode, …) is NOT
//    blocked: those don't "choose" a target,
//    they fan out across every legal one. Card
//    text says "cannot be chosen", which the
//    targeting filters cover; AoE is out of
//    scope by design.
//  • Once per game enforced by the engine's
//    standard `oncePerGame` + `oncePerGameKey`.
// ═══════════════════════════════════════════

const { istHeldOderKreatur } = require('./_targeting-shared');
const { hasCardType } = require('./_hooks');
const CARD_NAME = 'Perfect Disguise';
const ONCE_PER_GAME_KEY = 'perfectDisguise';
const INNEN = '_perfectDisguiseInnen';   // Riegel: beim Pruefen eines ANDEREN Helden fragt diese Karte sich nicht selbst

/** Traegt dieser Held einen gueltigen Perfect-Disguise-Eintrag? */
function istVerkleidet(gs, held) {
  const liste = held?._targetBlockers;
  if (!Array.isArray(liste)) return false;
  return liste.some(b => b.card === CARD_NAME && (b.untilTurn == null || gs.turn <= b.untilTurn));
}

/** Chuck, the Crazy Veteran (`ignoresOppUntargetable`): hebt Zielverbote fuer die Helden seines Kontrolleurs auf (wie der Engine-Filter). */
function chuckAktiv(engine, seite) {
  for (const { hero: h, physOwner, heroIdx: hi } of engine.heroesControlledBy(seite)) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.webbed || h.statuses?.negated) continue;
    if (engine._isHeroMummified?.(physOwner, hi)) continue;
    if (engine.heroScript(h)?.ignoresOppUntargetable) return true;
  }
  return false;
}

/**
 * Gibt es auf der Seite des Besitzers ein ANDERES legales Ziel dieser Quelle?
 * Die Liste der legalen Ziele steht in `info.allTargets` (Helden und Kreaturen, soweit die Quelle sie
 * anbietet; `ineligible` = vom Effekt ausgeschlossen zaehlt nicht). Ohne Liste (Dispatcher ohne Liste,
 * Aufrufer ohne `allTargets`) entscheidet der Brett-Scan.
 */
function anderesLegalesZiel(engine, info, kontrolleur) {
  const gs = engine.gs;
  const liste = Array.isArray(info.allTargets) ? info.allTargets.filter(t => t && !t.ineligible) : null;
  // Andere Helden des Kontrolleurs (Styx: Kontrolle statt Seite).
  for (const { physOwner, heroIdx: hi, hero: h } of engine.heroesControlledBy(kontrolleur)) {
    if (physOwner === info.heroOwner && hi === info.heroIdx) continue;
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.untargetable || h.statuses?.invisible) continue;   // selbst geschuetzt: kein Ausweichziel
    if (istVerkleidet(gs, h)) continue;                                // gleich geschuetzt zaehlt nicht
    if (liste && !liste.some(t => t.type === 'hero' && t.owner === physOwner && t.heroIdx === hi)) continue;
    // Ist dieser andere Held fuer DIESE Quelle selbst gesperrt (Stealth, Dive Down …), ist er kein legales Ziel.
    let geblockt = false;
    try {
      const { blocker, ...rest } = info;
      geblockt = engine.heroBlocksTargeting(physOwner, hi, { ...rest, [INNEN]: true });
    } catch { geblockt = false; }
    if (geblockt) continue;
    return true;
  }
  // Kreaturen des Kontrolleurs (nur, wenn die Quelle sie anbietet bzw. ohne Liste: Brett-Scan).
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== kontrolleur) continue;
    if ((inst.counters?.currentHp ?? 1) <= 0) continue;
    const c = inst.counters || {};
    if (c.untargetable_all) continue;
    if (c.untargetable_by_opponent && c.untargetable_by_opponent_pi === info.chooserIdx) continue;
    if (c.softUntargetable_by_opponent && c.softUntargetable_by_opponent_pi === info.chooserIdx) continue;   // gleich geschuetzt zaehlt nicht
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !(hasCardType(cd, 'Creature') || hasCardType(cd, 'Token'))) continue;
    try { if (engine._boardGuardsCreatureChoice?.(inst, info.chooserIdx)) continue; } catch { /* ignorieren */ }
    if (liste && !liste.some(t => (t.type === 'equip' || t.type === 'creature') && (t.cardInstance
      ? t.cardInstance.id === inst.id
      : (t.owner === engine.physicalSide(inst) && t.heroIdx === inst.heroIdx && t.slotIdx === inst.zoneSlot)))) continue;
    return true;
  }
  return false;
}

module.exports = {
  isTargetingArtifact: true,
  oncePerGame: true,
  oncePerGameKey: ONCE_PER_GAME_KEY,

  /**
   * ★ DIE REGEL (Held). Gelesen von `heroBlocksTargeting` ueber den Eintrag am Helden (v1191-Zweig): in beiden
   * Zielwaehlern, am Dispatcher (`promptEffectTarget`) und fuer Karten wie Sword in a Bottle. Im Schadenspfad
   * (`info.hit`) steigt sie aus — „cannot be CHOSEN", kein „or hit".
   */
  blocksTargeting(gs, engine, info) {
    if (info[INNEN]) return false;
    if (info._truthSeeingEye || info.ignoreUntargetable) return false;   // Truth-Seeing Eye hebt jeden Zielschutz auf
    if (info.hit) return false;
    if (info.festesZiel) return false;   // Einzelziel-Quelle (Rueckstoss …): kein anderes legales Ziel
    if (info.chooserIdx == null) return false;
    const held = gs.players?.[info.heroOwner]?.heroes?.[info.heroIdx];
    if (!istVerkleidet(gs, held)) return false;
    // „by your opponent": gesperrt ist nur der GEGNER des Kontrolleurs (Styx: Kontrolle statt Seite).
    const kontrolleur = engine.heroSideOf(info.heroOwner, held);
    if (info.chooserIdx === kontrolleur) return false;
    if (chuckAktiv(engine, kontrolleur)) return false;
    return anderesLegalesZiel(engine, info, kontrolleur);
  },

  // ── CPU-Gate-Bypass ──────────────────────────────────────────────
  // Als Verdachtsfall (Shadows over Blackport, 1360 Spiele): die Karte
  // war 739× spielbarer Kandidat am Gate und wurde 5× gespielt — 0.7%
  // Commit-Quote. KEIN Erfassungsloch (der Verfügbarkeits-Zähler
  // artifactPicks beweist beides), sondern dieselbe Bewertungslücke wie
  // bei Flashbang: der gesamte Nutzen liegt im GEGNERZUG ("cannot be
  // chosen by your opponent during their next turn"). Unmittelbar nach
  // dem Spielen sieht das Gate nur −4 Gold und eine Handkarte weniger;
  // der Schutz selbst verändert kein Board und keine HP. Der Skip-Zweig
  // gewinnt damit praktisch immer.
  //
  // `evaluateThroughTurnEnd` hilft hier NICHT (es verlängert nur bis
  // zum Ende des EIGENEN Zuges, der Schutz wirkt später). Bleibt
  // alwaysCommit — als FUNKTION, damit die einmal pro Spiel verfügbare
  // Karte nicht verpufft:
  //   • Der Kartentext entwertet sich selbst, solange man nur EIN
  //     legales Ziel hat ("except if it is your only legal target") —
  //     also erst ab 2 Zielen committen. Das ist keine Heuristik,
  //     sondern steht wörtlich auf der Karte.
  //   • Erst ab Zug 3 (gs.turn ≥ 5): in der Eröffnung gibt es noch
  //     nichts Schützenswertes, und die Karte ist unwiederbringlich.
  // Sonst greift wieder die normale Bewertung.
  cpuMeta: {
    alwaysCommit: (engine, pi) => {
      try {
        const gs = engine?.gs;
        if (!gs) return false;
        if ((gs.turn || 0) < 5) return false;
        const targets = module.exports.getValidTargets(gs, pi, engine) || [];
        return targets.length >= 2;
      } catch { return false; }
    },
  },

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // At least one own alive Hero OR at least one own face-up Creature.
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0) return true;
    }
    // (Creatures handled below — searching cardInstances requires the
    // engine reference which `canActivate` doesn't get; getValidTargets
    // covers it. The hero check alone is enough to greenlight the
    // Artifact in hand whenever the caster has any live hero, which
    // they normally always do.)
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const ps = gs.players[pi];
    const targets = [];
    if (!ps) return targets;

    // Own alive Heroes.
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Kontrolle statt Seite (Styx 28.9.): vom Gegner uebernommene
      // eigene Helden sind kein „target you control". Uebernommene
      // Gegnerhelden bleiben aussen vor — der untargetable-Status
      // verfaellt zum Zugbeginn der physischen Seite (Engine).
      if ((hero.charmedBy ?? hero.permaControlBy ?? pi) !== pi) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    // Own Creatures in support zones (controller-side, face-up).
    if (engine) {
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.faceDown) continue;
        if (!istHeldOderKreatur(engine, inst)) continue;   // „target you control" = Held oder Kreatur (Al, 25.10.): keine Ausruestung, kein Anhaengsel
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose one of your Heroes or Creatures to disguise from your opponent until your next turn.',
    confirmLabel: '🎭 Disguise!',
    confirmClass: 'btn-info',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
    maxTotal: 1,
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const oi = engine.opponentOf(pi);
    const gs = engine.gs;
    const ps = gs.players[pi];

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;
      // Zielschutz am Helden (Vertrag `blocksTargeting`, s. oben). „during their next turn": Frist bis zum Beginn des naechsten eigenen
      // Zuges des Wirkers — der Gegnerzug dazwischen ist der gemeinte (W68a: ein Skip des Gegners verlaengert `untilTurn` ueber `_zug-fristen.js`).
      const bisZug = gs.activePlayer === pi ? gs.turn + 1 : gs.turn;
      engine.addHeroTargetBlocker(target.owner, target.heroIdx, CARD_NAME, { untilTurn: bisZug, appliedBy: pi });
      engine.log('perfect_disguise', {
        player: ps.username, target: hero.name, type: 'hero',
      });
    } else if (target.type === 'equip') {
      // Re-resolve the inst from cardInstances (defensive — the inst
      // stashed in validTargets should still be live, but a chain
      // reaction between target-pick and resolve could in theory
      // remove it).
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      ) || target.cardInstance;
      if (!inst || inst.zone !== 'support') return false;
      // W71b (Al, 25.10.2026): Schutzfenster (Cool Rescuer Monia & Co.) VOR dem Schreiben; negiert = verbraucht, Kreatur unverändert.
      if (!(await engine.kreaturBetroffen(inst, 'buff', 'Perfect Disguise', { sourceOwner: pi, detail: 'untargetable' }))) return true;
      if (!inst.counters) inst.counters = {};
      inst.counters.softUntargetable_by_opponent = 1;
      inst.counters.softUntargetable_by_opponent_pi = oi;
      inst.counters.softUntargetable_gegnerZug = true;   // W68a (s. oben)
      engine.log('perfect_disguise', {
        player: ps.username, target: inst.name, type: 'creature',
      });
    } else {
      return false;
    }

    engine.sync();
    return true;
  },

  // Fuer Tests und Nachbarkarten.
  istVerkleidet,
};

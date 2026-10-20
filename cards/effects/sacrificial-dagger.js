// ═══════════════════════════════════════════
//  CARD EFFECT: "Sacrificial Dagger"
//  Artifact (Equipment, Cost 10)   (Banned)
//
//  "Equip this card to a Hero you control. Once per turn, when you
//   sacrifice a target you control, you may choose a target and deal
//   damage equal to the equipped Hero's Attack stat to it. This
//   counts as the equipped Hero hitting that target with an Attack."
//
//  Wiring:
//   • Equipment Artifact — placement is engine-native (cards.json
//     `subtype: Equipment`); no `onPlay` needed (Vampiric Sword pattern).
//   • `onCreatureSacrificed` triggers when the Dagger's controller
//     sacrifices a Creature they control. HOPT per-Dagger instance —
//     two Daggers each get one strike per turn. The HOPT is claimed
//     only when the player actually commits a target (the "you may"
//     is preserved — declining leaves it usable on a later sacrifice
//     this turn).
//   • "Counts as the equipped Hero hitting with an Attack" —
//     `attackerSourceOverride` routes the reaction windows (redirect /
//     surprise / post-target) to the equipped Hero, and the damage is
//     dealt 'attack'-type with the Hero as source, so retaliation
//     (Booby Trap, Fireshield, …) punishes that Hero.
//   • Animation: the `knife_sacrifice` zone animation — the same
//     dagger plunge a sacrificed Creature shows — plays on the target.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sacrificial Dagger';

/**
 * Der Schlag selbst (Kreaturen- UND Helden-Opfer). `pi` = Kontrolleur des Daggers (= Opferer), Träger muss leben.
 */
async function dolchSchlag(ctx, pi) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const hero = ctx.attachedHero;
  const heroIdx = ctx.cardHeroIdx;

  // Once per turn, per Dagger. Peek now; claim only on commit so a
  // declined "may" stays usable on a later sacrifice this turn.
  // (claimHOPT stores under `${key}:${pi}` — peek the suffixed key.)
  const hoptKey = `sacrificial_dagger:${ctx.card.id}`;
  if (gs.hoptUsed?.[`${hoptKey}:${pi}`] === gs.turn) return;

  const atk = Math.max(0, hero.atk || 0);

  // "you may choose a target" — optional; cancel = decline.
  const target = await ctx.promptDamageTarget({
    side: 'any',
    types: ['hero', 'creature'],
    damageType: 'attack',
    baseDamage: atk,
    title: CARD_NAME,
    description: `You may deal ${hero.name}'s Attack (${atk}) to a target — counts as ${hero.name}'s Attack.`,
    confirmLabel: `🗡️ Sacrificial Strike! (${atk})`,
    confirmClass: 'btn-danger',
    cancellable: true,
    // "Counts as the equipped Hero hitting with an Attack" — the
    // reaction windows attribute the hit to the equipped Hero.
    attackerSourceOverride: {
      name: hero.name, owner: pi, controller: pi,
      heroIdx, zone: 'hand', _heroAttackSource: true,
      treatedAsAttack: engine.heldenAngriffStempel(ctx.cardHeroOwner ?? pi, heroIdx),   // W30a: Stufe = Fighting-Level des Helden (war W27a: 0)
    },
  });
  if (!target) return; // declined — HOPT untouched

  // Auftritt links am Feld (Als Regel 21.8.: beim Opfern). Erst
  // hier, nach der verbindlichen Zusage — ein abgelehntes „may"
  // soll nichts anzeigen.
  await engine.announceHookActivation('Sacrificial Dagger', pi);

  // Committed — claim the once-per-turn.
  engine.claimHOPT(hoptKey, pi);

  // Re-resolve the live target (a reaction could have moved/killed it).
  let tHero = null, tInst = null;
  if (target.type === 'hero') {
    tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!tHero || tHero.hp <= 0) { engine.sync(); return; }
  } else if (target.cardInstance) {
    tInst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
    if (!tInst || tInst.zone !== 'support') { engine.sync(); return; }
  } else {
    engine.sync();
    return;
  }
  const tgtHeroIdx = tInst ? tInst.heroIdx : target.heroIdx;

  // ── Dagger animation ── the same knife-plunge a sacrificed
  // Creature shows, on the struck target.
  engine._broadcastEvent('play_zone_animation', {
    type: 'knife_sacrifice', owner: target.owner,
    heroIdx: tgtHeroIdx, zoneSlot: tInst ? tInst.zoneSlot : -1,
  });
  await engine._delay(550);

  // ── Damage, as the equipped Hero's Attack ──
  // Re-read the Hero — a reaction window could have changed its ATK.
  const feld = ctx.cardHeroOwner ?? pi;   // Styx 28.9.: Brettseite des Helden
  const liveHero = gs.players[feld]?.heroes?.[heroIdx];
  const damage = Math.max(0, liveHero?.atk || 0);
  const source = { name: hero.name, owner: pi, heroOwner: feld, heroIdx, treatedAsAttack: engine.heldenAngriffStempel(feld, heroIdx) };   // W30a: Stufe = Fighting-Level des Helden (war W27a: 0)

  if (tHero) {
    await engine.actionDealDamage(source, tHero, damage, 'attack');
  } else if (tInst) {
    await engine.actionDealCreatureDamage(
      source, tInst, damage, 'attack',
      { sourceOwner: pi, canBeNegated: true },
    );
  }

  engine.log('sacrificial_dagger', {
    player: gs.players[pi]?.username, hero: hero.name,
    damage, target: target.cardName || target.type,
  });
  engine.sync();
}

module.exports = {
  // W27a (Al, 21.10.2026): „treated as an Attack" zählt als LEVEL 0 überall, wo eine Karte die Stufe der Quelle liest (Glass Wall, Test Flight, Escape Device, Stealth, Jetpack) — Engine: `_heldenEffektStufe`.
  // W30a (Al, 21.10.2026): This counts as the equipped Hero hitting that target with an Attack → Stufe = FIGHTING-LEVEL des ausgerüsteten Helden (`fightingOfHost`; ohne Instanz 0).
  // W32a (Al, 22.10.2026): allgemeine Regel „Zählt als Attack eines Helden = Ability-Level dieses Helden" (hier Fighting-Level des Trägers); die Deklaration trägt keine Sonderstufe mehr.
  treatedAsAttack: { ability: 'Fighting' },
  activeIn: ['support'],

  cpuMeta: {
    // ── ATK-Umsetzer ────────────────────────────────────────────────
    // Schüttet 1×/Zug je Dagger-Instanz die ATK des ausgerüsteten
    // Helden als Schaden aus, ausgelöst von jedem eigenen Opfer.
    // Zusammen mit einer Opfer-Kreatur verdoppelt das den Ertrag jedes
    // Opfers — gemessen (1268 Spiele) WR nach Dagger-Equips auf den
    // ATK-Helden: 0→12.3%, 1→22.7%, 2→41.4%, 3→44.0%.
    atkConversionsPerTurn: 1,
  },

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      const pi = ctx.cardController ?? ctx.cardOwner;

      // Equipped Hero must be a living Hero — it's the ATK source.
      const hero = ctx.attachedHero;
      if (!hero || !hero.name || hero.hp <= 0) return;

      // "when YOU sacrifice a target you control" — the sacrificed
      // Creature is controlled by you AND you initiated the sacrifice.
      const sacrificed = ctx.creature;
      if (!sacrificed) return;
      if ((sacrificed.controller ?? sacrificed.owner) !== pi) return;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner != null && srcOwner !== pi) return;

      await dolchSchlag(ctx, pi);
    },

    // Welle 12 (Q98, Al: „Auch Heroes"): auch ein geopferter HELD (Divine Gift of Sacrifice, Teocuilatl, Pharaoh …) ist „a target you
    // sacrifice" — Hook `onHeroSacrificed` (`actionDefeatHero` mit `isSacrifice`, nach dem Todesablauf). Ein Held, der durch HP-Verlust stirbt,
    // wird NICHT geopfert (Al, Welle 12) und löst nicht aus. Opferer = `source.owner`; war der Träger selbst das Opfer, ging der Dagger mit.
    onHeroSacrificed: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const hero = ctx.attachedHero;
      if (!hero || !hero.name || hero.hp <= 0) return;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner != null && srcOwner !== pi) return;
      const kontrolle = ctx.hero ? engine.heroSideOf?.(ctx.heroOwner, ctx.hero) : null;
      if (kontrolle != null && kontrolle !== pi) return;
      if (srcOwner == null && kontrolle == null) return;
      await dolchSchlag(ctx, pi);
    },
  },
};

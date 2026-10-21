// ═══════════════════════════════════════════
//  CARD EFFECT: "Heragas, the Monster Slayer"
//  Hero · 450 HP · 100 ATK · Starting Abilities: Fighting, Hunting
//
//  "You may once per turn choose a Creature that was summoned before
//   the end of your last turn and deal damage equal to its max HP to
//   it. This is treated as an Attack. Whenever this Hero defeats a
//   Creature, draw 1 card."
//
//  ── UMSETZUNG ─────────────────────────────────────────────────────
//  • „summoned before the end of your last turn": die GEMEINSAME
//    Zeitmarke aus `_turn-end-recency-shared` — Ralzish liest sie mit
//    umgekehrtem Vorzeichen. `turnPlayed <= tick` ist erlaubt;
//    vorplatzierte Creatures (turnPlayed 0) sind immer erlaubt.
//  • „deal damage equal to its max HP": `counters.maxHp ?? cd.hp` —
//    dieselbe Lesart wie der Overkill-Wächter im Schadens-Batch.
//  • „treated as an Attack": Schadenstyp `'attack'` mit der
//    Heldenquelle `{ name, owner, heroIdx }` (Brackle-Bauart). Damit
//    reagieren Arrows, Reflexionen und — vor allem — Hunting, das
//    genau diese Quelle als „dieser Held besiegt" liest.
//  • „choose a Creature": JEDE Creature auf dem Brett, auch eigene
//    (Kartentext sagt nicht „opponent's"). ← LESART, Al kann sie
//    einschraenken.
//  • „Whenever this Hero defeats a Creature, draw 1 card": kein HOPT,
//    jede Creature (auch eigene), jeder Weg (Schaden UND Zerstoerung
//    — Als Ruling 1.9. zu Hunting gilt hier genauso). Gehoert in
//    `onCreatureDeath`, NICHT ins Anspruchsfenster: dort ist der Tod
//    noch nicht vollzogen. Zieht auch dann, wenn Hunting den Kadaver
//    beansprucht — die Creature ist trotzdem besiegt.
//  • Der Effekt selbst ist HOPT ueber den Hero-Effekt-Mechanismus
//    des Servers („you may once per turn"); `true` verbraucht ihn,
//    `false` (abgebrochen / nichts waehlbar) laesst ihn stehen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { summonedBeforeLastTurnEnd, stampTurnEnd } = require('./_turn-end-recency-shared');

const CARD_NAME = 'Heragas, the Monster Slayer';

function maxHpOf(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return inst.counters?.maxHp ?? cd?.hp ?? 0;
}

/** Alle waehlbaren Creatures (Brett, aufgedeckt, alt genug). */
function eligibleCreatures(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (!summonedBeforeLastTurnEnd(inst, ps, gs)) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  // W26a (Al, Welle 26): als Attack geltender Heldeneffekt ohne Karte — Stufen-Bedingungen ("level X or lower": Glass Wall, Test Flight, Future Tech Escape Device …) lesen die Quellstufe.
  // W32a (Al, 22.10.2026): „Zählt als Attack/Spell eines Helden = Ability-Level dieses Helden": die Quellstufe ist das FIGHTING-LEVEL Heragas' (nicht mehr fix 0) — Engine: `_heldenEffektStufe`.
  treatedAsAttack: { ability: 'Fighting' },
  activeIn: ['hero'],
  heroEffect: true,
  // Nur die Zeitmarken-Buchfuehrung im onTurnEnd laeuft auch durch
  // Frozen / Stunned / Negated — keine Macht, nur die richtige Marke.
  // (Der Server sperrt das Aktivieren des Effekts unter CC ohnehin;
  // das Ziehen beim Besiegen laeuft dann ebenfalls nicht — wer
  // negiert ist, besiegt nichts.)
  bypassStatusFilter: true,

  // CPU: der Effekt ist ein garantierter Kill — nutzen, sobald ein
  // GEGNERISCHES Ziel alt genug ist. Ohne diesen Riegel wuerde der
  // Pilot den Effekt auch mit nur eigenen Zielen anfangen und im
  // Picker abbrechen (Ralzish-Lehre).
  cpuShouldUseHeroEffect(engine, pi) {
    try {
      const opp = engine.opponentOf(pi);
      return eligibleCreatures(engine, pi).some(i => (i.controller ?? i.owner) === opp);
    } catch { return true; }
  },

  canActivateHeroEffect(ctx) {
    const hero = ctx.attachedHero;
    if (!hero?.name || hero.hp <= 0) return false;
    // ★ W34a (Al, 22.10.2026): ein Effekt, der als Attack zählt, unterliegt den Attack-Zählern und -Sperren (Berserk-Limit, Knife Throw, Rioting Village, Mirjam, Muras …) — `heroKannAngreifen`.
    if (!ctx._engine.heroKannAngreifen(ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx, ctx.cardOwner, { name: 'Heragas, the Monster Slayer' })) return false;

    return eligibleCreatures(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    // Styx 28.9.: Heragas steht auf der Brettseite `feld`.
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = ctx.attachedHero ?? gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const erlaubt = new Set(eligibleCreatures(engine, pi).map(i => i.id));
    if (erlaubt.size === 0) return false;

    // Ziel-Picker mit Angriffs-Semantik (Taunt, Untargetable, Truth-
    // Seeing Eye …) — die Frische-Regel als `condition` obendrauf.
    // ★ W36a (Al, 22.10.2026): „Negierter Treffer: ja, definitiv" — wird der Treffer im Zielfenster NEGIERT (Invisibility Cloak, Schutzkarten …), ist der Effekt für die Runde verbraucht (Einmal-Stempel bleibt, Rückgabe `true`) und zählt als gespielte Attack (Muster Alice); ein Abbruch des Spielers bleibt ein Abbruch.
    const { target, negiert } = await engine.heldenEffektZielwahl(ctx, {
      side: 'any',
      types: ['creature'],
      damageType: 'attack',
      title: CARD_NAME,
      description: 'Choose a Creature summoned before the end of your last turn. Heragas deals damage equal to its max HP to it (treated as an Attack).',
      confirmLabel: '🗡️ Slay!',
      confirmClass: 'btn-danger',
      cancellable: true,
      condition: (t) => !!t.cardInstance && erlaubt.has(t.cardInstance.id),
    });
    if (negiert) {
      await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: feld, name: CARD_NAME });
      engine.sync();
      return true;
    }
    if (!target?.cardInstance) return false;   // abgebrochen — HOPT bleibt
    const inst = target.cardInstance;

    // Betrag JETZT einfrieren — der Kartentext meint die max HP im
    // Moment des Angriffs.
    const betrag = maxHpOf(engine, inst);
    if (betrag <= 0) return false;

    // Angriffsstoss des Helden auf die Zone (Ralzish-Bauart), dann
    // der Treffer.
    // v1316: Treffer im Moment des Aufpralls, nicht danach.
    await engine.rammeBisKontakt({
      sourceOwner: feld, sourceHeroIdx: heroIdx,
      targetOwner: engine.physicalSide(inst),
      targetHeroIdx: inst.heroIdx >= 0 ? inst.heroIdx : 0,
      targetZoneSlot: inst.zoneSlot,
      cardName: hero.name, duration: 900,
    });

    const source = { name: CARD_NAME, owner: pi, heroIdx, ...(feld !== pi ? { heroOwner: feld } : {}) };
    // W32a (Al, 22.10.2026): der Treffer zählt als Attack — Attack-Reaktionen (Magic Topaz, Arrows …) über die virtuelle Attack-Kette.
    await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx, heroOwner: feld, ziele: [{ id: `equip-${engine.physicalSide(inst)}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst }], resolve: async () => {
      await engine.actionDealCreatureDamage(source, inst, betrag, 'attack',
        { sourceOwner: pi, canBeNegated: true });
      return true;
    } });

    engine.log('heragas_slay', {
      player: gs.players[pi].username, creature: inst.name, damage: betrag,
    });
    return true;
  },

  hooks: {
    onTurnEnd: async (ctx) => { stampTurnEnd(ctx); },

    // „Whenever this Hero defeats a Creature, draw 1 card."
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      const quelle = ctx.source;
      // Styx 28.9.: Quelle = dieser Held (Brettseite `heroOwner` + Index).
      if (!quelle || (quelle.heroOwner ?? quelle.owner) !== (ctx.cardHeroOwner ?? pi) || quelle.heroIdx !== hi) return;
      // W7a (H02-20, Al): `bypassStatusFilter` gilt nur der Zeitmarke im onTurnEnd — das Ziehen ist ein Heldeneffekt und ruht bei Frost/Betäubung/Negation.
      if (engine._isHeroEffectSilenced(ctx.cardHeroOwner ?? pi, hi)) return;
      await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.log('heragas_draw', {
        player: engine.gs.players[pi]?.username, creature: ctx.creature?.name,
      });
    },
  },
};

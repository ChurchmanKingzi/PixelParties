// ═══════════════════════════════════════════
//  CARD EFFECT: "Foresta, the Guard"
//  Creature (Summoning Magic, Lv3, Normal) — 300 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "You can only summon this Creature by sacrificing 2 Creatures you
//    control that were not summoned this turn and halving the current
//    HP of the corresponding Hero (rounded down). You may once per
//    turn choose a target and deal 500 damage to it."
//
//  ── ① Beschwörungskosten, Teil 1: zwei Kreaturen ──
//  GENAU 2 eigene Kreaturen, die NICHT in diesem Zug beschworen
//  wurden — wortgleich mit `blue-ice-dragon.js`, von dem die komplette
//  Bauform dieser Kosten übernommen ist. Wichtig bleibt derselbe
//  Merkposten: der Sammler `getSacrificableCreatures` filtert frische
//  Beschwörungen ABSICHTLICH nicht heraus (Opfern ist gewollte
//  Selbstentfernung), die Einschränkung muss also als eigener `filter`
//  im Spec stehen, sonst ist sie wirkungslos.
//
//  ── ② Beschwörungskosten, Teil 2: HP halbieren ──
//  „the corresponding Hero" = der Held, in dessen Support Zone die
//  Karte landet (Als Ruling 8.8., spielweites Vokabular).
//
//  **Als Ruling 19.8.: das ist eine REINE KOSTENZAHLUNG.** Kein
//  Schaden. Deshalb:
//    · kein `actionDealDamage` / `actionDealTrueDamage`,
//    · keine Schadens-Hooks (`beforeDamage` / `afterDamage`),
//    · kein Surprise-Fenster, kein Fireshield, keine Reaktion,
//    · nichts kann sie verhindern oder verringern.
//  Der HP-Wert wird direkt gesetzt. Vorbild für eine solche
//  Nicht-Schaden-Mutation ist `divine-gift-of-equality.js` — dort mit
//  Schutzabfrage, weil es FREMDE Helden trifft; hier ohne, weil es die
//  selbst gewählte Kosten des eigenen Zuges sind.
//
//  EINZIGE Ausnahme: bringt die Halbierung den Helden rechnerisch auf
//  0 (nur bei genau 1 HP möglich, `Math.floor(1 / 2) === 0`), läuft der
//  Tod über `actionDefeatHero`. Das ist KEIN Schadensweg — es ist der
//  Buchhaltungsweg für „Held liegt bei 0" (ON_HERO_KO, Ausrüstungen
//  abwerfen, Siegprüfung). Ohne ihn stünde ein Held mit 0 HP im Feld,
//  den kein System als tot erkennt.
//
//  Reihenfolge mit Absicht: erst die Kreaturen, dann die HP — so
//  steht es im Kartentext, und ein Abbruch in der Opferwahl kostet
//  damit gar nichts.
//
//  ── ③ Kein Haste, keine Zusatzaktion ──
//  Der Text kennt beides nicht. Foresta wird also ganz normal für eine
//  Aktion beschworen und hat Beschwörungsstarre: die Engine sperrt
//  Kreatureffekte im Beschwörungszug über `inst.turnPlayed === gs.turn`.
//  Hier wird bewusst NICHTS dagegen gesetzt (kein `counters._hasHaste`).
//
//  ── ④ Aktiv-Effekt: 500 Schaden ──
//  „You may once per turn" ist die WEICHE Form (Als Regel v249): pro
//  Instanz, nicht pro Spieler. Genau das ist die Standard-HOPT der
//  Engine (`creature-effect:<instId>`), zusammen mit Main Phase und
//  „kostet keinen Aktionsplatz". Ein Abbruch in der Zielwahl gibt die
//  Sperre über `return false` wieder frei.
//
//  Animation: `trex_chomp` (neu in v516) — der große T-Rex-Biss, den
//  `dino_bite` schon zeichnet, unter eigenem Typ, damit Foresta einen
//  eigenen Klang bekommt, ohne den Gigantisaurs einen aufzudrängen.
//  Der Schaden liegt auf dem SCHNAPPEN, nicht davor: die Kiefer
//  schließen bei 38 % der 1600 ms Animationsdauer.
// ═══════════════════════════════════════════

const CARD_NAME = 'Foresta, the Guard';
const TRIBUTES = 2;
const EFFECT_DAMAGE = 500;
/** Animationstyp des Aktiv-Effekts (ANIM_REGISTRY in app-board.jsx). */
const BISS_ANIM = 'trex_chomp';
/** Kiefer geschlossen: 38 % von 1600 ms Animationsdauer. */
const BISS_EINSCHLAG_MS = 620;

/**
 * Opferkosten. Als Funktion, weil der Filter den aktuellen Zug braucht —
 * ein Modul-Konstantenobjekt könnte `gs.turn` nicht sehen.
 * `showFilteredAsIneligible` lässt die in diesem Zug beschworenen
 * Kreaturen sichtbar, aber ausgegraut.
 *
 * `heroIdx` ist optional: beim Hand-Gate (`canSummon`) gibt es noch
 * keinen Zielhelden. Ist einer bekannt, nennt die Beschreibung den
 * ZWEITEN Kostenteil samt konkretem HP-Wert — damit ist die Opferwahl
 * zugleich die Bestätigung der Halbierung, und ein Abbruch dort kostet
 * nichts.
 */
function makeSacrificeSpec(engine, pi, heroIdx) {
  const turn = engine?.gs?.turn || 0;
  let hpHinweis = '';
  if (pi != null && pi >= 0 && heroIdx != null && heroIdx >= 0) {
    const hero = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
    if (hero && hero.hp > 0) {
      hpHinweis = ` ${hero.name}'s HP will be halved: ${hero.hp} → ${Math.floor(hero.hp / 2)}.`;
    }
  }
  return {
    minCount: TRIBUTES,
    maxCount: TRIBUTES,
    filter: (c) => c?.inst?.turnPlayed !== turn,
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: `Sacrifice ${TRIBUTES} of your Creatures that were not summoned this turn.${hpHinweis}`,
    confirmLabel: '🦖 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

/** Kann dieser Held Foresta überhaupt beschwören (lebt, Stufe reicht)? */
function heroCanSummonHere(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Belegte Support-Plätze, auf die Foresta geworfen werden darf.
 *
 * Nur bei Helden, deren Zonen KOMPLETT voll sind und bei denen ein
 * gültiger Tribut steht — nur dann wird durch das Opfern dort auch
 * wirklich ein Platz frei.
 *
 * EINE Quelle für drei Verbraucher (`getBouncePlacementTargets` für die
 * Hervorhebung im Client, `canPlaceOnOccupiedSlot` für die Annahme des
 * Wurfs auf dem Server, `canBypassFreeZoneRequirement` für die
 * Handkarten-Eignung) — sonst leuchten Plätze auf, die der Server
 * anschließend ablehnt. Wortgleich zu Blue-Ice Dragon.
 */
function occupiedDropSlots(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const spec = makeSacrificeSpec(engine, pi);
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const zones = ps.supportZones?.[hi] || [];
    const slots = [0, 1, 2];
    if (slots.some(z => (zones[z] || []).length === 0)) continue;   // hat noch Platz
    if (!heroCanSummonHere(engine, pi, hi)) continue;
    if (!engine.canSatisfySacrifice(pi, { ...spec, mustIncludeFromHeroIdx: hi })) continue;
    for (const z of slots) if ((zones[z] || []).length > 0) out.push({ heroIdx: hi, slotIdx: z });
  }
  return out;
}

/**
 * Zweiter Kostenteil: die aktuellen HP des entsprechenden Helden
 * halbieren, abgerundet. Reine Kosten — siehe Kopfkommentar.
 *
 * @returns {Promise<number>} die verlorene HP-Menge (nur fürs Log)
 */
async function zahleHpKosten(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  // Kein Held oder bereits tot: es gibt nichts zu halbieren. Der
  // reguläre Beschwörungsweg lässt das gar nicht erst zu (ein Held mit
  // hp <= 0 kann nicht handeln), eine Fremdbeschwörung könnte hier aber
  // durchaus mit einem toten Wirt ankommen.
  if (!hero || hero.hp <= 0) return 0;

  const vorher = hero.hp;
  const nachher = Math.floor(vorher / 2);

  if (nachher <= 0) {
    // Nur bei genau 1 HP erreichbar. Kein Schadensweg, aber der
    // Todesablauf muss laufen — siehe Kopfkommentar.
    await engine.actionDefeatHero(
      { name: CARD_NAME, owner: pi, heroIdx },
      hero,
      { reason: CARD_NAME, isSacrifice: true, respectFirstTurnProtection: false },
    );
  } else {
    hero.hp = nachher;
  }

  engine.log('foresta_hp_cost', {
    player: ps?.username,
    hero: hero.name,
    from: vorher,
    to: Math.max(0, nachher),
  });
  engine.sync();
  return vorher - Math.max(0, nachher);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // Handkarten-Gate der Engine (getSummonBlocked) und Fremdbeschwörungen
  // (engine.isCreatureSummonable) fragen hier nach. Die HP-Halbierung ist
  // BEWUSST kein Teil dieser Prüfung: sie ist immer zahlbar, solange der
  // Held lebt — und ein toter Held kann ohnehin nicht beschwören.
  canSummon(ctx) {
    const engine = ctx._engine;
    return engine.canSatisfySacrifice(ctx.cardOwner, makeSacrificeSpec(engine, ctx.cardOwner));
  },

  // Volle Zonen: die beiden Opfer machen ja gerade Platz.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx),

  getBouncePlacementTargets: (gs, pi, engine) => occupiedDropSlots(gs, pi, engine),

  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine) =>
    occupiedDropSlots(gs, pi, engine)
      .some(sl => sl.heroIdx === heroIdx && sl.slotIdx === slotIdx),

  /**
   * Beide Kostenteile bezahlen: erst die Kreaturen, dann die HP.
   * Bricht der Spieler die Opferwahl ab, ist die Beschwörung vom Tisch
   * und es wurde nichts bezahlt.
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;

    // Wurf auf einen belegten Platz → mind. ein Opfer muss von diesem
    // Helden kommen, sonst wird dort kein Platz frei.
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;

    const base = makeSacrificeSpec(engine, pi, heroIdx);
    const spec = allFullDrop
      ? {
          ...base,
          mustIncludeFromHeroIdx: heroIdx,
          description: `${base.description} At least one of them must come from the summoning Hero's Support Zones.`,
        }
      : base;

    const ok = await engine.resolveSacrificeCost(ctx, spec);
    if (!ok) return false;

    await zahleHpKosten(engine, pi, heroIdx);

    if (allFullDrop) {
      const supZones = ps.supportZones[heroIdx] || [];
      const freedSlot = [0, 1, 2].find(z => (supZones[z] || []).length === 0);
      if (freedSlot == null) return false;
      await engine.actionPlaceCreature(CARD_NAME, pi, heroIdx, freedSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    return true;
  },

  /**
   * Der Aktiv-Effekt: ein Ziel wählen, 500 Schaden. Frei (kein
   * Aktionsplatz), Main Phase, einmal je Zug — alles Standardverhalten
   * von `creatureEffect`.
   */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      // `baseDamage` ist bei Schadens-Pickern Pflicht (Great Wall of
      // Deri lässt nur getaggte Schadenswahlen auf geschützte
      // Kreaturen zu) und speist zugleich den Lernkanal.
      baseDamage: EFFECT_DAMAGE,
      title: CARD_NAME,
      description: `Choose a target and deal ${EFFECT_DAMAGE} damage to it.`,
      confirmLabel: '🦖 Bite!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Abbruch: `false` lässt die Einmal-pro-Zug-Sperre ungestempelt.
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

    engine._broadcastEvent('play_zone_animation', {
      type: BISS_ANIM,
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      damage: EFFECT_DAMAGE,
    });
    // Warten, bis die Kiefer zuschnappen — der Schaden soll auf dem
    // Biss liegen, nicht davor.
    await engine._delay(BISS_EINSCHLAG_MS);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, EFFECT_DAMAGE, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, EFFECT_DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.sync();
    return true;
  },
};

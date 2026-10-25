const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// COST-DISCARD-CHANNEL: n/a — Kosten sind Opfer-Kreaturen, kein Handabwurf
// ═══════════════════════════════════════════
//  CARD EFFECT: "Black-Thorn Dragon"
//  Creature (Destruction Magic + Summoning Magic, Lv3, Normal, Archetyp
//  "Drago") — 250 HP, kein ATK. Neu am 23.10. (Als Auftrag)
//
//  EFFECT (per cards.json):
//   "You can only summon this Creature by sacrificing 1 "Drago" Creature
//    you control that was not summoned this turn OR two "Drago" Creatures.
//    You may once per turn deal 200 damage to a target. This Creature and
//    the corresponding Hero are unaffected by all Spells."
//
//  Bauform Foresta, the Guard / Blue-Ice Dragon (Opferkosten, kein Haste,
//  keine Zusatzaktion, 200 statt 500 Schaden) — hier der Unterschied:
//
//  ── ① Beschwörungskosten: ZWEI Wege ──────────────────────────────────
//   (a) GENAU 1 „Drago"-Kreatur, die NICHT in diesem Zug beschworen wurde, ODER
//   (b) GENAU 2 „Drago"-Kreaturen — hier gilt die Einschränkung „nicht in
//       diesem Zug beschworen" NICHT (sie steht im Text nur hinter der ersten
//       Möglichkeit; zwei frisch beschworene Drachen dürfen also zusammen den
//       Preis zahlen) — und auch NICHT „you control" (Al 23.10.): hier dürfen
//       ausdrücklich auch GEGNERISCHE Drago-Kreaturen geopfert werden, in jeder
//       Mischung (2 eigene, 1+1, 2 gegnerische). Engine: Spec-Schalter
//       `auchGegner` (`_collectSacrificeCandidates`); eine fremde Kreatur mit
//       Schutz gegen fremde Zugriffe (Golden Wings, Oppo-Immunität …) ist kein
//       Kandidat, sonst gälte der Preis als bezahlt, ohne bezahlt zu sein.
//  Was „Drago" heißt, legt `_drago-shared.js` fest (Teilstring im Namen:
//  auch „Dragonegg", „Dragoneer", „Dragsparov, the King of Dragons" und
//  Black-Thorn Dragon selbst).
//
//  Stehen beide Wege offen, fragt der Dragon, welchen der Spieler gehen will
//  (Optionswahl); steht nur einer offen, entfällt die Frage. Die Wahl ist
//  abbrechbar (Abbruch = die Beschwörung findet nicht statt, nichts bezahlt);
//  die Opferwahl danach ebenfalls. Die CPU nimmt den billigeren Weg (a).
//
//  Die Kosten sind Kosten der Beschwörung (`paySummonCost`, vor dem
//  Reaktionsfenster) wie bei Foresta; ein Wurf auf einen belegten Platz
//  verlangt als Pflicht-Opfer ALLE Insassen der Zielzone (W19a) — der Platz
//  ist ein Ziel, wenn einer der beiden Wege ihn leeren kann.
//
//  ── ② Beschwörungsstarre ─────────────────────────────────────────────
//  Der Text kennt weder Haste noch Zusatzaktion: ganz normal für eine
//  Aktion beschworen, der Effekt ist im Beschwörungszug gesperrt.
//
//  ── ③ 200 Schaden, einmal pro Zug ────────────────────────────────────
//  „a target" — Held oder Kreatur, beliebige Seite. Standard-HOPT der
//  Engine; ein Abbruch in der Zielwahl gibt sie frei.
//
//  ── ④ „unaffected by all Spells" (Kreatur UND zugehöriger Held) ──────
//  Zwei Skript-Flaggen, gelesen von der Engine:
//   · `unaffectedBySpells`      — die Kreatur: Schaden, Heilung, Status,
//        Negierung, Buffs, Zerstörung, Verschieben, Diebstahl von Spells
//        wirken nicht (`engine.kreaturSpellImmun`, an den Stellen der
//        zentralen Immunitätsprüfung `kreaturGegnerEffektImmun`).
//   · `heroUnaffectedBySpells`  — „the corresponding Hero" = der Held, in
//        dessen Support Zone die Kreatur steht (Als Ruling 2.10.): auf den
//        fünf Wegen von Anti Magic/Energy Aura (Schaden, Heilung, Buff,
//        Status, Niederlage) sowie `heroNonDamageEffectBlocked`
//        (`engine.heroHasSpellImmunity`).
//  Gemeint sind ALLE Spells, eigene wie fremde, ohne Stufenschranke
//  (Areas, Anhänge und Surprise-Spells zählen nach Kartentyp; Attacks sind
//  keine Spells). Die Immunität ist ein laufender Schutz: sie ruht, solange
//  die Kreatur negiert/gefroren/betäubt ist. Piercing (Ida: „ignore any
//  effects that make a target unaffected by them") geht durch. Die Ziele
//  bleiben wählbar — „unaffected" heißt: die Wirkung bleibt aus.
// ═══════════════════════════════════════════

const { isDragoName, DRAGO } = require('./_drago-shared');
const { anyName } = require('./_alias-name');   // Shroomasaur: Zusatzname zählt für Namensfamilien

const CARD_NAME = 'Black-Thorn Dragon';
const EFFECT_DAMAGE = 200;
const ROUTE_ONE = 'one';   // 1 „Drago", nicht in diesem Zug beschworen
const ROUTE_TWO = 'two';   // 2 „Drago", beliebig
/** Zonen-Animation des Aktiv-Effekts (ANIM_REGISTRY in app-board.jsx). */
const ANIM = 'black_flame_strike';
const EINSCHLAG_MS = 520;

/**
 * Opfer-Spec je Weg. Als Funktion, weil Weg (a) den aktuellen Zug braucht.
 * `showFilteredAsIneligible`: in diesem Zug beschworene Drachen bleiben bei Weg (a)
 * sichtbar, aber ausgegraut.
 */
function makeSacrificeSpec(engine, route) {
  const turn = engine?.gs?.turn || 0;
  if (route === ROUTE_ONE) {
    return {
      minCount: 1,
      maxCount: 1,
      filter: (c) => anyName(c?.inst || { name: c?.cardName }, isDragoName) && c?.inst?.turnPlayed !== turn,
      showFilteredAsIneligible: true,
      title: CARD_NAME,
      description: `Sacrifice 1 "${DRAGO}" Creature you control that was not summoned this turn.`,
      confirmLabel: '🐉 Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
    };
  }
  return {
    minCount: 2,
    maxCount: 2,
    filter: (c) => anyName(c?.inst || { name: c?.cardName }, isDragoName),
    // Der Text sagt hier NICHT „you control" (Al 23.10.): auch gegnerische Drago-Kreaturen zählen (jede Mischung).
    auchGegner: true,
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: `Sacrifice 2 "${DRAGO}" Creatures (yours or your opponent's).`,
    confirmLabel: '🐉 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

const ROUTES = [ROUTE_ONE, ROUTE_TWO];

/** Kann dieser Held den Dragon überhaupt beschwören (lebt, Stufe reicht)? */
// Styx 28.9.: geliehene Helden der Gegenspalte — `heroOwner` = physische Seite des
// Helden (fehlt → pi); nur Helden, die `pi` kontrolliert.
function heroCanSummonHere(engine, pi, heroIdx, heroOwner = pi) {
  const hero = engine.gs.players[heroOwner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine.heroSideOf(heroOwner, hero) !== pi) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  if (heroOwner === pi) return engine.heroMeetsLevelReq(pi, heroIdx, cd);
  return engine.heroMeetsLevelReq(heroOwner, heroIdx, cd, { levelSourcePi: pi });
}

/** Welche der beiden Wege stehen gerade offen? (`extra`: z. B. Pflicht-Opfer der Zielzone) */
function offeneWege(engine, pi, extra = {}, selfId = null) {
  return ROUTES.filter(r => engine.canSatisfySacrifice(pi, { ...makeSacrificeSpec(engine, r), ...extra }, selfId));
}

/**
 * Belegte Support-Plätze, auf die der Dragon geworfen werden darf: nur bei Helden mit
 * KOMPLETT voller Spalte, und nur wenn EINER der beiden Wege die Zielzone ganz leeren kann
 * (Insassen = Pflicht-Opfer, W19a). EINE Quelle für Hervorhebung, Annahme des Wurfs
 * und Handkarten-Eignung — sonst leuchten Plätze auf, die der Server anschließend ablehnt.
 */
function occupiedDropSlots(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const out = [];
  const helden = typeof engine.heroesControlledBy === 'function'
    ? engine.heroesControlledBy(pi)
    : (ps.heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
  for (const { physOwner, heroIdx: hi } of helden) {
    const zones = gs.players[physOwner]?.supportZones?.[hi] || [];
    const slots = [0, 1, 2];
    if (slots.some(z => (zones[z] || []).length === 0)) continue;   // hat noch Platz
    if (!heroCanSummonHere(engine, pi, hi, physOwner)) continue;
    for (const z of slots) {
      if ((zones[z] || []).length === 0) continue;
      if (!ROUTES.some(r => engine.zoneLeerbarDurchOpfer(pi, physOwner, hi, z, makeSacrificeSpec(engine, r)))) continue;
      out.push(physOwner !== pi ? { heroIdx: hi, slotIdx: z, owner: physOwner } : { heroIdx: hi, slotIdx: z });
    }
  }
  return out;
}

/**
 * Welchen Weg geht der Spieler? Nur ein Weg offen → der. Beide → Optionswahl (abbrechbar).
 * @returns {Promise<string|null>} `ROUTE_ONE` | `ROUTE_TWO`, `null` = abgebrochen / kein Weg
 */
async function waehleWeg(ctx, wege) {
  if (wege.length === 0) return null;
  if (wege.length === 1) return wege[0];
  const wahl = await ctx._engine.promptGeneric(ctx.cardOwner, {
    type: 'optionPicker',
    title: CARD_NAME,
    description: `How do you want to pay for ${CARD_NAME}?`,
    showCard: CARD_NAME,
    options: [
      { id: ROUTE_ONE, label: `Sacrifice 1 "${DRAGO}" Creature (not summoned this turn)` },
      { id: ROUTE_TWO, label: `Sacrifice 2 "${DRAGO}" Creatures (also your opponent's)` },
    ],
    cancellable: true,
    gerrymanderEligible: true,
  });
  if (!wahl || wahl.cancelled || !wege.includes(wahl.optionId)) return null;
  return wahl.optionId;
}

/**
 * KOSTEN: Weg wählen, dann die Opfer. `false` = abgebrochen (nichts bezahlt).
 * Eine Stelle für `paySummonCost` (vor dem Reaktionsfenster) und den Fallback in `beforeSummon`.
 */
async function zahleKosten(ctx, allFullDrop, req = null) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const heroOwner = (isSeat(gs, ctx.cardHeroOwner)) ? ctx.cardHeroOwner : pi;
  const slotIdx = (req || gs.players[pi]?._requestedBouncePlaceSlot)?.slotIdx ?? null;
  // Wurf auf einen belegten Platz: alle Insassen der Zielzone sind Pflicht-Opfer.
  const ids = (allFullDrop && slotIdx != null) ? engine.zoneInsassen(heroOwner, heroIdx, slotIdx).map(c => c.id) : [];
  const extra = ids.length > 0 ? { requiredInstIds: ids } : {};
  const weg = await waehleWeg(ctx, offeneWege(engine, pi, extra, ctx.card?.id));
  if (!weg) return false;
  const base = makeSacrificeSpec(engine, weg);
  const spec = ids.length > 0
    ? { ...base, ...extra, description: `${base.description} The Creature(s) in the targeted Support Zone must be among them.` }
    : base;
  return !!(await engine.resolveSacrificeCost(ctx, spec));
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // ④ „unaffected by all Spells": Kreatur und zugehöriger Held (siehe Kopfkommentar).
  unaffectedBySpells: true,
  heroUnaffectedBySpells: true,

  // Handkarten-Gate der Engine (getSummonBlocked) und Fremdbeschwörungen
  // (engine.isCreatureSummonable) fragen hier nach: einer der beiden Wege muss zahlbar sein.
  canSummon(ctx) {
    return offeneWege(ctx._engine, ctx.cardOwner).length > 0;
  },

  // Volle Zonen: die Opfer machen ja gerade Platz.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx && (sl.owner ?? pi) === pi),

  getBouncePlacementTargets: (gs, pi, engine) => occupiedDropSlots(gs, pi, engine),

  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine, heroOwner = pi) =>
    occupiedDropSlots(gs, pi, engine)
      .some(sl => sl.heroIdx === heroIdx && sl.slotIdx === slotIdx && (sl.owner ?? pi) === heroOwner),

  // ★ W4b: die Opfer sind KOSTEN der Beschwörung und werden VOR dem Reaktionsfenster bezahlt (`paySummonCost`);
  // `beforeSummon` platziert danach nur noch (`ctx._summonKosten`). Ohne `paySummonCost` (Effekt-Beschwörungen)
  // zahlt `beforeSummon` selbst.
  async paySummonCost(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    const req = ps?._requestedBouncePlaceSlot || null;
    return (await zahleKosten(ctx, allFullDrop, req)) ? { allFullDrop, req } : false;
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    const heroOwner = (isSeat(gs, ctx.cardHeroOwner)) ? ctx.cardHeroOwner : pi;

    const pre = ctx._summonKosten;   // W4b: Kosten schon vor dem Reaktionsfenster bezahlt
    const allFullDrop = pre ? !!pre.allFullDrop : !!ps?._requestedBouncePlaceSlot;
    const reqSlot = (pre ? pre.req : ps?._requestedBouncePlaceSlot) || null;   // W19a: die gewählte Zielzone
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;

    if (!pre && !(await zahleKosten(ctx, allFullDrop, reqSlot))) return false;

    if (allFullDrop) {
      const supZones = gs.players[heroOwner]?.supportZones?.[heroIdx] || [];
      const freedSlot = (reqSlot && (supZones[reqSlot.slotIdx] || []).length === 0)
        ? reqSlot.slotIdx : [0, 1, 2].find(z => (supZones[z] || []).length === 0);
      if (freedSlot == null) return false;
      await engine.actionPlaceCreature(CARD_NAME, pi, heroIdx, freedSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
        ...(heroOwner !== pi ? { heldSeite: heroOwner } : {}),
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    return true;
  },

  /**
   * Der Aktiv-Effekt: ein Ziel wählen, 200 Schaden. Frei (kein Aktionsplatz), Main Phase,
   * einmal je Zug — alles Standardverhalten von `creatureEffect`.
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
      baseDamage: EFFECT_DAMAGE,
      title: CARD_NAME,
      description: `Choose a target and deal ${EFFECT_DAMAGE} damage to it.`,
      confirmLabel: '🐉 Strike!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    // Abbruch: `false` lässt die Einmal-pro-Zug-Sperre ungestempelt.
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM,
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(EINSCHLAG_MS);

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

    engine.log('black_thorn_strike', {
      player: gs.players[pi]?.username, target: target.cardName, damage: EFFECT_DAMAGE,
    });
    engine.sync();
    return true;
  },

  // CPU: bei zwei offenen Wegen den billigeren (1 Opfer) nehmen — der Standard der Engine wählte die letzte Option.
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'optionPicker' && payload?.title === CARD_NAME) {
      const o = (payload.options || []).find(x => x.id === ROUTE_ONE) || payload.options?.[0];
      return o ? { optionId: o.id } : undefined;
    }
    return undefined;
  },
};

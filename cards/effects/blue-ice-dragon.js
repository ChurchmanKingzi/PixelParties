// ═══════════════════════════════════════════
//  CARD EFFECT: "Blue-Ice Dragon"
//  Creature (Summoning Magic Lv2, Normal) —
//  250 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "You can only summon this Creature by
//    sacrificing 2 Creatures you control that were
//    not summoned this turn. You may summon this
//    Creature as an additional Action. You may once
//    per turn choose a target on the board. If it
//    is Frozen, deal 300 damage to it, otherwise
//    Freeze it for 2 turns. If you did not summon
//    this Creature as an additional Action by its
//    own effect, you may activate this effect the
//    turn this Creature was summoned."
//
//  ── ① Beschwörungskosten ──
//  GENAU 2 eigene Kreaturen, die NICHT in diesem
//  Zug beschworen wurden. Wichtig: der Sammler
//  `getSacrificableCreatures` filtert frische
//  Beschwörungen ABSICHTLICH nicht heraus (Opfern
//  ist gewollte Selbstentfernung, kein Zug der
//  Kreatur) — die Einschränkung dieses Kartentexts
//  muss also als eigener `filter` mitgegeben
//  werden, sonst wäre sie wirkungslos.
//
//  ── ② Beschwörungsart: frei ODER Haste ──
//  Zwei Wege, und der Spieler wählt:
//    · als zusätzliche Aktion (kostet keinen
//      Aktionsplatz) — dann KEIN Sofort-Effekt;
//    · regulär für eine Aktion — dann darf der
//      Effekt noch im selben Zug benutzt werden.
//  Der zweite Fall ist technisch "Haste": die
//  Engine sperrt Kreatureffekte im Beschwörungszug
//  über `inst.turnPlayed === gs.turn`, und genau
//  diese Sperre hebt `counters._hasHaste` auf.
//
//  Umgesetzt wie bei Big Gwen Guard: die Engine
//  entscheidet die Aktionskosten VOR `beforeSummon`,
//  deshalb meldet `inherentAction` nur dann "frei",
//  wenn der bezahlte Weg gar nicht offensteht
//  (Main Phase, oder Action Phase ohne freien
//  Aktionsplatz). Stehen beide Wege offen, gilt
//  zunächst der bezahlte, und `beforeSummon` fragt
//  nach; wählt der Spieler den freien Weg, hebt
//  `gs._summonModeUpgradedToInherent` die
//  Aktionsbuchung wieder auf.
//
//  Beschwörungen durch FREMDE Karten (Wiederbelebung,
//  Living Illusion, …) sind nicht "as an additional
//  Action by its own effect" — sie bekommen also
//  Haste. Deshalb ist Haste der Standard und wird
//  nur auf dem selbstgewählten Gratisweg unterdrückt.
//
//  ── ③ Aktiv-Effekt (einmal pro Zug, Main Phase) ──
//  Ziel auf dem Feld wählen: ist es bereits Frozen,
//  300 Schaden — sonst Frozen für 2 Züge. Die
//  Einmal-pro-Zug-Sperre ist die Standard-HOPT der
//  Engine (`creature-effect:<instId>`); ein Abbruch
//  in der Zielwahl gibt sie über `return false`
//  wieder frei.
// ═══════════════════════════════════════════

const CARD_NAME = 'Blue-Ice Dragon';
const TRIBUTES = 2;
const FREEZE_TURNS = 2;
const FROZEN_DAMAGE = 300;

/**
 * Opferkosten. Als Funktion, weil der Filter den aktuellen Zug
 * braucht — ein Modul-Konstantenobjekt könnte `gs.turn` nicht sehen.
 * `showFilteredAsIneligible` lässt die in diesem Zug beschworenen
 * Kreaturen sichtbar, aber ausgegraut: man sieht auf einen Blick,
 * warum sie nicht zählen.
 */
function makeSacrificeSpec(engine) {
  const turn = engine?.gs?.turn || 0;
  return {
    minCount: TRIBUTES,
    maxCount: TRIBUTES,
    filter: (c) => c?.inst?.turnPlayed !== turn,
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: `Sacrifice ${TRIBUTES} of your Creatures that were not summoned this turn.`,
    confirmLabel: '❄️ Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}

/** Steht in der Action Phase noch ein Aktionsplatz zur Verfügung? */
function actionSlotAvailable(gs, pi, heroIdx) {
  if (gs.currentPhase !== 3) return false;
  const ps = gs.players[pi];
  if (!ps) return false;
  if ((ps.heroesActedThisTurn || []).length === 0) return true;
  const hasBonus = (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0);
  return !!hasBonus;
}

/** Ist der GRATIS-Weg der einzig mögliche? Dann entfällt die Rückfrage. */
function freeSummonForced(gs, pi, heroIdx) {
  const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
  if (isMainPhase) return true;
  return !actionSlotAvailable(gs, pi, heroIdx);
}

/** Kann dieser Held Blue-Ice Dragon überhaupt beschwören (lebt,
 *  erfüllt die Stufenanforderung)? */
function heroCanSummonHere(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Belegte Support-Plätze, auf die Blue-Ice geworfen werden darf.
 *
 * Nur bei Helden, deren Zonen KOMPLETT voll sind und bei denen ein
 * gültiger Tribut steht — nur dann wird durch das Opfern dort auch
 * wirklich ein Platz frei. Hat der Held noch etwas frei, läuft die
 * Beschwörung ganz normal über den leeren Platz.
 *
 * EINE Quelle für drei Verbraucher (`getBouncePlacementTargets` für die
 * Hervorhebung im Client, `canPlaceOnOccupiedSlot` für die Annahme des
 * Wurfs auf dem Server, `canBypassFreeZoneRequirement` für die
 * Handkarten-Eignung) — sonst leuchten Plätze auf, die der Server
 * anschließend ablehnt.
 */
function occupiedDropSlots(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const spec = makeSacrificeSpec(engine);
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const zones = ps.supportZones?.[hi] || [];
    const slots = [0, 1, 2];
    if (slots.some(z => (zones[z] || []).length === 0)) continue;   // hat noch Platz
    if (!heroCanSummonHere(engine, pi, hi)) continue;
    // Genau der Spec, den `beforeSummon` gleich benutzt: mindestens ein
    // Opfer muss BEI DIESEM HELDEN stehen, sonst wird dort kein Platz frei.
    if (!engine.canSatisfySacrifice(pi, { ...spec, mustIncludeFromHeroIdx: hi })) continue;
    for (const z of slots) if ((zones[z] || []).length > 0) out.push({ heroIdx: hi, slotIdx: z });
  }
  return out;
}

/** Ist dieses Ziel gerade eingefroren? */
function targetIsFrozen(engine, target) {
  if (!target) return false;
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    return !!hero?.statuses?.frozen;
  }
  const inst = target.cardInstance;
  return !!inst?.counters?.frozen;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // Handkarten-Gate der Engine (getSummonBlocked) und Fremdbeschwörungen
  // (engine.isCreatureSummonable) fragen hier nach.
  canSummon(ctx) {
    const engine = ctx._engine;
    return engine.canSatisfySacrifice(ctx.cardOwner, makeSacrificeSpec(engine));
  },

  // Nur dann von sich aus "zusätzliche Aktion", wenn der bezahlte Weg
  // ohnehin nicht offensteht — sonst entscheidet der Spieler in
  // `beforeSummon` (siehe Kopfkommentar).
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (!engine.canSatisfySacrifice(pi, makeSacrificeSpec(engine))) return false;
    return freeSummonForced(gs, pi, heroIdx);
  },

  // Volle Zonen: die beiden Opfer machen ja gerade Platz. Ein Held mit
  // komplett belegten Zonen bleibt sonst als Beschwörer gesperrt,
  // obwohl das Opfern dort genau den nötigen Platz schafft.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) =>
    occupiedDropSlots(gs, pi, engine).some(sl => sl.heroIdx === heroIdx),

  // Damit der Client die belegten Plätze auch ANZEIGT und den Wurf
  // zulässt. Ohne diese Liste leuchten bei Kreatur-Zügen ausschließlich
  // LEERE Plätze auf (siehe `isDragValidZone` in app-board.jsx) — der
  // volle Held war damit gar nicht anwählbar, obwohl Server und
  // Kartenlogik den Wurf akzeptiert hätten. Genau das war der Fehler.
  getBouncePlacementTargets: (gs, pi, engine) => occupiedDropSlots(gs, pi, engine),

  // Serverseitige Annahme des Wurfs auf einen belegten Platz. Muss
  // exakt dieselbe Liste benutzen wie die Hervorhebung.
  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine) =>
    occupiedDropSlots(gs, pi, engine)
      .some(sl => sl.heroIdx === heroIdx && sl.slotIdx === slotIdx),

  /**
   * Opfer bezahlen, dann die Beschwörungsart klären.
   *
   * Reihenfolge mit Absicht: erst die Kosten. Bricht der Spieler die
   * Opferwahl ab, ist die Beschwörung ganz vom Tisch und es kann kein
   * Umschaltmerker zurückbleiben.
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;

    // Wurf auf einen belegten Platz -> mind. ein Opfer muss von diesem
    // Helden kommen, sonst wird dort kein Platz frei.
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;

    const base = makeSacrificeSpec(engine);
    const spec = allFullDrop
      ? {
          ...base,
          mustIncludeFromHeroIdx: heroIdx,
          description: `${base.description} At least one of them must come from the summoning Hero's Support Zones.`,
        }
      : base;

    const ok = await engine.resolveSacrificeCost(ctx, spec);
    if (!ok) return false;

    // ── Beschwörungsart ──
    // `ctx.isInherentAction` ist bereits true, wenn der Gratisweg
    // erzwungen war; dann gibt es nichts zu fragen.
    let freeSummon = !!ctx.isInherentAction;
    if (!freeSummon) {
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `How do you want to summon ${CARD_NAME}?`,
        showCard: CARD_NAME,
        confirmLabel: '❄️ Additional Action (no effect this turn)',
        cancelLabel: '⚔️ Use your Action (may use its effect this turn)',
        cancellable: true,
        gerrymanderEligible: true,
      });
      // `cancelled` heißt hier "zweite Beschriftung gewählt", nicht
      // "abgebrochen" — der Abbruchweg ist bereits durch die Opferwahl
      // gelaufen.
      if (choice && !choice.cancelled) {
        gs._summonModeUpgradedToInherent = pi;
        freeSummon = true;
      }
    }
    // Von `onPlay` gelesen und dort sofort wieder entfernt.
    ps._blueIceFreeSummon = freeSummon;

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
   * Der Aktiv-Effekt. Frei (kein Aktionsplatz), Main Phase, einmal je
   * Zug — alles Standardverhalten von `creatureEffect`.
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
      baseDamage: FROZEN_DAMAGE,
      title: CARD_NAME,
      description: `Choose a target. If it is Frozen, deal ${FROZEN_DAMAGE} damage — otherwise Freeze it for ${FREEZE_TURNS} turns.`,
      confirmLabel: '❄️ Choose!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    // Abbruch: `false` lässt die Einmal-pro-Zug-Sperre ungestempelt.
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    const frozen = targetIsFrozen(engine, target);

    engine._broadcastEvent('play_zone_animation', {
      type: frozen ? 'blue_ice_flames' : 'biseria_ice_engulf',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    // Warten, bis die Flammen zusammenschlagen bzw. das Eis geschlossen
    // ist — der Schaden soll auf dem Einschlag liegen, nicht davor.
    await engine._delay(frozen ? 780 : 900);

    if (frozen) {
      // Bereits eingefroren -> zerschmettern.
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) await ctx.dealDamage(hero, FROZEN_DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, FROZEN_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.log('blue_ice_shatter', {
        player: gs.players[pi]?.username, target: target.cardName, damage: FROZEN_DAMAGE,
      });
    } else {
      // Noch nicht eingefroren -> einfrieren.
      if (target.type === 'hero') {
        const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) {
          await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
            duration: FREEZE_TURNS, appliedBy: pi,
          });
        }
      } else if (target.cardInstance) {
        await engine.applyCreatureStatus(target.cardInstance, 'frozen', {
          sourceOwner: pi, duration: FREEZE_TURNS, source: CARD_NAME,
        });
      }
      engine.log('blue_ice_freeze', {
        player: gs.players[pi]?.username, target: target.cardName, duration: FREEZE_TURNS,
      });
    }

    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Haste stempeln, sofern NICHT über den eigenen Gratisweg
     * beschworen. Steht kein Merker (Beschwörung durch eine fremde
     * Karte, die `beforeSummon` überspringt), gilt der Standard: Haste.
     */
    onPlay: (ctx) => {
      // NUR beim eigenen Beschwoeren. Die Engine setzt am Summon-Pfad
      // ohnehin `_onlyCard` (_engine.js ~Z. 8540), der Hook erreicht also
      // schon nur diese Karte — der Riegel ist ein Guertel zum
      // Hosentraeger und haelt die Absicht sichtbar, falls je ein
      // Beschwoerungsweg ohne `_onlyCard` dazukommt. Kanonisches Muster,
      // siehe acid-rain.js / berserk.js.
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      const ps = engine.gs.players[ctx.cardOwner];
      const usedFreeSummon = !!ps?._blueIceFreeSummon;
      if (ps) delete ps._blueIceFreeSummon;
      if (usedFreeSummon || !inst) return;
      if (!inst.counters) inst.counters = {};
      inst.counters._hasHaste = true;
      engine.log('blue_ice_haste', {
        player: ps?.username,
        note: 'summoned with an Action — effect usable this turn',
      });
    },
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Rider"
//  Creature / Reaction (Summoning Magic Lv1) — 50 HP
//
//  Rules text:
//    "You cannot summon this Creature, except with
//     its own effect. You may immediately summon
//     this Creature from your hand as an additional
//     Action when an 'Elven' Creature you control
//     leaves the board, but you must summon it into
//     the same Support Zone that Creature occupied.
//     When you summon this Creature, search your
//     deck for any 'Elven' Creature, except 'Elven
//     Rider', reveal it and add it to your hand."
//
//  Als Ruling (Al 26.10.): „Jeder Abgang" — „leaves the board" gilt für JEDEN
//  Abgang einer „Elven"-Kreatur vom Brett: Tod, Zerstören, Opfer, Löschen,
//  Zurück auf die Hand (Bounce), Zurückmischen ins Deck. Ein KONTROLLWECHSEL
//  (Diplomacy, Capture, Dark Gear …) und ein Umzug auf dem Brett zählen NICHT.
//  Auslöser: `onCreatureDeath` (jeder Tod; der Platz ist dort schon frei),
//  `onCardLeaveZone` (zentrale Abgangs-Schiene von `actionMoveCard`/Mass
//  Routing/…; liegt der Platz im Hook noch belegt, läuft das Angebot per
//  `engine.nachAbgang` erst nach dem Abgang) und `onCardsReturnedToHand` (der
//  Deepsea-Bounce meldet keinen `leavingCard`). Doppelte Meldungen DESSELBEN
//  Abgangs fängt `_elvenRiderAsked` (je Rider-Kopie × abgehende Instanz) ab.
//
//  Design notes:
//    • No-summon-from-hand: the engine already
//      blocks Reaction-subtype cards from proactive
//      play (`validateActionPlay` line ~5375). We
//      deliberately do NOT export `proactivePlay`,
//      so the hand gate is automatic. No custom
//      `canSummon` / `spellPlayCondition` needed.
//    • Reaction trigger: `onCreatureDeath`. That
//      hook fires without the `_onlyCard` filter,
//      so every Rider listening in hand actually
//      receives the event (in contrast to
//      `onCardLeaveZone` which the engine targets
//      at the leaving card only).
//    • Same-slot constraint: we capture the slot
//      from `deathInfo.heroIdx/zoneSlot`. At hook
//      firing time the engine has already removed
//      the dying creature from its slot, so the
//      slot is guaranteed empty. We then call
//      `summonCreatureWithHooks` with that exact
//      slot — `safePlaceInSupport` will honour a
//      free target slot exactly; if (impossibly)
//      the slot is no longer free, it would
//      relocate, so we pre-verify emptiness and
//      fizzle if violated.
//    • Bypass of normal summon path: we go through
//      `summonCreatureWithHooks`, which routes
//      through `safePlaceInSupport` + fires onPlay.
//      `canSummon` / action-phase checks are skipped
//      ("except with its own effect": keine Aktion,
//      kein Gold, keine Phase). ★ W22a (Al, 20.10.2026):
//      den Beschwoerer-Helden mit der Schule/Stufe der
//      Karte (Summoning Magic 1) verlangt der Rider
//      trotzdem — `heldBeschwoertRider`.
//    • Opposing-turn safety: the reaction can
//      trigger during the opponent's turn. That's
//      correct per card text. The summon does not
//      consume any action or gold.
//    • On-summon tutor: fires in `onPlay` when
//      Rider lands in support zone. Reveals an
//      Elven from deck (excluding Rider) and adds
//      to hand. Uses the standard deck-search
//      reveal flow mirrored from Reality Crack and
//      Elven Druid.
//    • Once Rider is on the board, it simply counts
//      as another Elven Creature for Archer's
//      `inherentAction` gate — no extra per-Rider
//      bookkeeping needed. Listens for
//      `onCreatureDeath` in BOTH 'hand' and
//      'support' zones, but the hook body gates on
//      `ctx.cardZone === 'hand'` so on-board Riders
//      don't self-trigger.
// ═══════════════════════════════════════════

const {
  isElvenCreature,
} = require('./_elven-shared');

const CARD_NAME    = 'Elven Rider';
const EXCLUDE_NAME = 'Elven Rider';

// Key used on the player state to mark "Rider is mid-resolve — don't
// trigger the same physical hand card twice for overlapping events."
// Scoped per-player (`_elvenRiderResolving[pi]`) and cleared in finally.
const RESOLVING_KEY = '_elvenRiderResolving';
// Je Rider-Kopie × abgehende Instanz nur EIN Angebot (derselbe Abgang kommt über mehrere Hooks).
const ASKED_KEY = '_elvenRiderAsked';

/** Brettseite der Zone, in die der Rider muss (= die Zone der gestorbenen Karte); sonst der Kontrolleur. */
function riderSeite(deathInfo, ownerIdx) {
  return deathInfo?.seite ?? deathInfo?.owner ?? ownerIdx;
}

/**
 * Darf der Held der Zone den Rider beschwoeren? (Trigger-Pruefung UND erneute Pruefung nach der Bestaetigung.)
 *  - Welle 11 (Al, R5): „Reaction-Creatures koennen ... NUR von Heroes beschworen werden, die aktionsfaehig sind" — nicht Frozen / Stunned / Webbed / Bound
 *    (Welle 12: Negated sperrt nicht mehr); W20c (Al): nur der aktuelle Kontrolleur beschwoert mit dem Helden (`heroAgiert(…, engine, pi)`); fuer die
 *    seitenfremde Zone einer gestohlenen Kreatur (A09-15) gilt seit W22a wieder das Ruling vom 14.10. (s. u.).
 *  - ★ W22a (Al, 20.10.2026: „Ja, soll er" — wie Doomed Town Guard & Co. einen Beschwoerer-Helden mit Summoning Magic 1 verlangen): zusaetzlich die
 *    Schul-/Stufenanforderung der Karte (`heroMeetsLevelReq`: Summoning Magic 1, Ascension-/Wisdom-Bypaesse, harte Negation sperrt Stufe 1). „Except with its own
 *    effect" nimmt dem Rider nur die NORMALE Hand-Beschwoerung (Aktion, Gold, Phase) — den Beschwoerer-Helden ersetzt es nicht. Ohne tauglichen Helden gibt es kein
 *    Angebot: der Rider bleibt auf der Hand, nichts wird verbraucht. Die Hand-Ermaessigungen zaehlen vom Kontrolleur (`levelSourcePi`).
 */
function heldBeschwoertRider(engine, deathInfo, ownerIdx) {
  const rider = engine._getCardDB()[CARD_NAME];
  const se = require('./_summon-eligibility');
  const seite = riderSeite(deathInfo, ownerIdx);
  const hero = engine.gs.players[seite]?.heroes?.[deathInfo.heroIdx];
  const taugt = (feld, hi, h) => se.heroAgiert(h, engine, ownerIdx)
    && engine.heroMeetsLevelReq(feld, hi, rider, { levelSourcePi: ownerIdx });
  // Seitenfremde Zone (A09-15, Ruling Al 14.10.2026, bestaetigt 20.10.: „Das Ruling vom 14. [gilt]"): die gestohlene Elven stand in der Zone eines Helden der
  // Gegenseite, den der Kontrolleur NICHT kontrolliert — er beschwoert den Rider trotzdem seitenfremd dorthin, aber mit einem tauglichen EIGENEN Helden
  // (kontrolliert, aktionsfaehig, Summoning Magic 1). Der Besitzer der Zone, der die Elven nicht kontrollierte, bekommt nie einen Rider (isValidRiderTrigger).
  if (seite !== ownerIdx && hero?.name && engine.heroSideOf(seite, hero) !== ownerIdx) {
    return engine.heroesControlledBy(ownerIdx).some(({ physOwner, heroIdx, hero: h }) => taugt(physOwner, heroIdx, h));
  }
  // Sonst beschwoert der Held der Zone selbst (eigene Zone oder kontrollierter Held der Gegenspalte); ein abgegebener eigener Held beschwoert fuer den Spieler nichts.
  return taugt(seite, deathInfo.heroIdx, hero);
}

/**
 * Narrow check: is this `onCreatureDeath` event a valid trigger for a
 * Rider in our hand? Requires the deceased to be an Elven Creature we
 * controlled at the time of death, AND the slot it occupied to now be
 * empty so Rider can land there.
 */
function isValidRiderTrigger(engine, deathInfo, ownerIdx) {
  if (!deathInfo) return false;
  // Must have been a Creature WE CONTROLLED. The `controller` field on
  // deathInfo (set by the engine) is the gameplay-truth side; an Elven
  // cross-side-placed onto opp's board and dying there doesn't trigger
  // our Rider. Falls back to `owner` for any older payload that
  // pre-dates the controller field.
  if ((deathInfo.controller ?? deathInfo.owner) !== ownerIdx) return false;
  // Z1 (A09-15) / W4 (Al 14.10.2026: „Falls der temporary owner ein geeignetes Ziel zum Beschwoeren hat, darf er es
  // seitenfremd beschwoeren."): die Zone ist die der BRETTSEITE. Eine gestohlene Elven steht beim Besitzer — der Rider
  // des Kontrolleurs darf trotzdem in DIESE Zone (seitenfremd, `controller`), siehe `riderSeite`.
  const cardDB = engine._getCardDB();
  const cd = cardDB[deathInfo.name];
  if (!isElvenCreature(cd)) return false;
  const ps = engine.gs.players[riderSeite(deathInfo, ownerIdx)];
  if (!ps) return false;
  // Der Held der Zone beschwoert den Rider: aktionsfaehig, vom Spieler kontrolliert UND mit der Schule/Stufe der Karte (W22a, s. `heldBeschwoertRider`).
  if (!heldBeschwoertRider(engine, deathInfo, ownerIdx)) return false;
  // Slot must be empty RIGHT NOW. The engine clears the slot just
  // before firing this hook, so this normally passes — but another
  // reaction in the batch could conceivably have filled it.
  const slot = ps.supportZones?.[deathInfo.heroIdx]?.[deathInfo.zoneSlot];
  if (slot && slot.length > 0) return false;
  return true;
}

/**
 * On-summon tutor: pick an Elven from deck (excluding Rider), reveal it,
 * add to hand, shuffle. Mirrors the deck-search-reveal flow used by
 * Reality Crack, Madaga, Elven Druid.
 */
async function runRiderTutor(engine, pi) {
  const gs     = engine.gs;
  const ps     = gs.players[pi];
  const cardDB = engine._getCardDB();

  // Hand-lock fizzles only the search step — the summon itself already
  // resolved. No prompt, no shuffle, silent skip.
  if (ps?.handLocked) {
    engine.log('elven_rider_tutor_handlocked', { player: ps.username });
    return;
  }

  const counts = {};
  for (const name of (ps.mainDeck || [])) {
    if (name === EXCLUDE_NAME) continue;
    if (!isElvenCreature(cardDB[name])) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  const gallery = Object.entries(counts)
    .map(([name, count]) => ({ name, source: 'deck', count, level: cardDB[name]?.level || 0 }))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  if (gallery.length === 0) {
    engine.log('elven_rider_tutor_empty', { player: ps.username });
    // Still shuffle — the card text says "search your deck", which
    // typically implies a shuffle afterwards even on no-find.
    engine.shuffleDeck(pi, 'main');
    return;
  }

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
        searchToHand: true,   // v1119: Suche AUF DIE HAND
    cards: gallery,
    title: CARD_NAME,
    description: 'Choose an Elven Creature from your deck to add to your hand.',
    cancellable: true,
  });

  // Even cancellation triggers the shuffle per "search your deck" convention
  if (!picked || picked.cancelled || !picked.cardName) {
    engine.shuffleDeck(pi, 'main');
    engine.log('elven_rider_tutor_cancelled', { player: ps.username });
    return;
  }

  const chosenName = picked.cardName;
  if ((ps.mainDeck || []).indexOf(chosenName) < 0) {
    engine.shuffleDeck(pi, 'main');
    return;
  }

  // Route through the canonical helper so ON_CARD_ADDED_TO_HAND fires
  // (Cosmic Depths Analyzer / Gatherer key off this hook). Helper
  // handles splice + push + tracking + deck-search animation +
  // log + hook + opponent reveal. `shuffle: true` shuffles after
  // the splice, matching the original Fisher-Yates call.
  await engine.actionAddCardFromDeckToHand(pi, chosenName, {
    source: CARD_NAME,
    reveal: true,
    shuffle: true,
  });
  engine.log('elven_rider_tutor', { player: ps.username, added: chosenName });
}

/**
 * Gemeinsamer Rumpf aller Auslöser (Tod, Abgangs-Schiene, Bounce): bietet dem Spieler `pi` an, den Rider aus der Hand in den Platz der
 * abgehenden Elven zu beschwören. `death` = Abgangsdatensatz { name, owner, controller, seite, heroIdx, zoneSlot, instId }.
 * `riderId` = Instanz der lauschenden Rider-Kopie (mehrere Kopien fragen je eigener).
 */
async function riderAngebot(engine, pi, riderId, death) {
  const gs      = engine.gs;
  const ps      = gs.players[pi];
  if (!ps) return;

  if (!isValidRiderTrigger(engine, death, pi)) return;

  // Re-entry guard: one Rider per trigger event. Without this, two
  // Rider copies in hand could both be prompted for the same dying
  // Elven — which is technically fine by rules, but the second
  // would find the slot already filled by the first. Instead of
  // letting the second fizzle, we gate on an event key so only
  // ONE prompt per death.
  gs._elvenRiderTriggered = gs._elvenRiderTriggered || {};
  const evtKey = `${pi}:${death.heroIdx}:${death.zoneSlot}:${death.name}:${gs.turn}`;
  if (gs._elvenRiderTriggered[evtKey]) return;

  // Also a per-player in-flight guard against overlapping effects
  if (gs[RESOLVING_KEY]?.[pi]) return;

  // Als Playtest-Befund (Multi-Tod): Bei 2+ gleichzeitig sterbenden
  // Elven läuft dieser Hand-Listener je Todesfall aus einer VOR dem
  // ersten Replace eingesammelten Liste — nach dem ersten Summon
  // ist der Rider nicht mehr auf der Hand, der Prompt kam trotzdem
  // (und lief nach dem Confirm still in den handIdx<0-Gurt).
  // Frische Prüfung VOR dem Prompt: kein Rider auf der Hand, kein
  // Prompt. Mehrere Kopien prompten weiterhin je Tod (per Als
  // Einordnung korrekt so).
  if (!ps.hand.includes(CARD_NAME)) return;

  // Als Ruling (Al 26.10.): derselbe Abgang kann über mehrere Hooks gemeldet werden (Tod + Abgangs-Schiene) — je Rider-Kopie und abgehende
  // Instanz wird nur EINMAL gefragt.
  const askKey = `${riderId}:${death.instId ?? evtKey}`;
  if (!gs[ASKED_KEY]) gs[ASKED_KEY] = {};
  if (gs[ASKED_KEY][askKey]) return;
  gs[ASKED_KEY][askKey] = true;

  // ── Prompt the player ──
  const confirmed = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `An Elven Creature you controlled (${death.name}) just left the board. Summon Elven Rider into its slot?`,
    showCard: CARD_NAME,
    confirmLabel: 'Summon!',
    cancelLabel: 'No',
    cancellable: true,
  });
  if (!confirmed) return;

  // Still have a Rider in hand? (The player could, in theory, have
  // lost it between the prompt and confirm via another effect.)
  const handIdx = ps.hand.indexOf(CARD_NAME);
  if (handIdx < 0) return;

  // W22a: waehrend der Abfrage kann der Held Status/Schule verloren haben (Kettenreaktionen) — wie Doomed Town Guard neu pruefen.
  if (!heldBeschwoertRider(engine, death, pi)) return;

  // Re-verify the slot is empty (belt-and-suspenders)
  const seite = riderSeite(death, pi);   // W4: Brettseite der Zone (bei gestohlener Elven die des Besitzers)
  const slot = gs.players[seite]?.supportZones?.[death.heroIdx]?.[death.zoneSlot];
  if (slot && slot.length > 0) {
    engine.log('elven_rider_fizzle', { player: ps.username, reason: 'slot_occupied' });
    await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });   // v1360
    return;
  }

  // Claim the trigger + in-flight flag
  gs._elvenRiderTriggered[evtKey] = true;
  if (!gs[RESOLVING_KEY]) gs[RESOLVING_KEY] = {};
  gs[RESOLVING_KEY][pi] = true;

  try {
    // Consume the hand copy NOW — before summonCreatureWithHooks
    // can fire hooks that might inspect the hand.
    engine.takeFromPileSync(ps, 'hand', handIdx);

    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

    // Summon into the EXACT slot. `safePlaceInSupport` relocates
    // on occupied — we've already verified empty, so it lands
    // where requested.
    const res = await engine.summonCreatureWithHooks(
      CARD_NAME, seite, death.heroIdx, death.zoneSlot,
      // `fromHandIdx`: Flug von der Hand in die Zone (v934). Ohne
      // das erscheint die Kreatur ohne Bewegung im Slot — der
      // HOOK-Weg sendet den Flug nicht von selbst, anders als der
      // regulaere Spielweg im Server.
      { source: `${CARD_NAME} reaction`, skipBeforeSummon: false, fromHandIdx: handIdx, summonWindow: true,
        ...(seite !== pi ? { controller: pi } : {}) }   // W4: seitenfremd, vom Kontrolleur gefuehrt
    );
    if (res?.negated) return;   // Off Duty & co.: Karte ist schon geroutet
    if (!res) {
      // Extremely unlikely (no free slot after all). Put back.
      engine.handZugangSync(ps, CARD_NAME, { source: CARD_NAME, ohneInstanz: true });
      engine.log('elven_rider_fizzle', { player: ps.username, reason: 'place_refused' });
      await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });   // v1360
      return;
    }

    engine.log('elven_rider_summoned', {
      player: ps.username,
      triggered_by: death.name,
      hero: death.heroIdx,
      slot: death.zoneSlot,
    });
    engine.sync();
  } finally {
    gs[RESOLVING_KEY][pi] = false;
  }
}

module.exports = {
  // Must listen while in hand AND act like a normal Elven while on the
  // board. Hook bodies gate on `ctx.cardZone` to split behaviour.
  activeIn: ['hand', 'support'],

  // „You cannot summon this Creature, except with its own effect." – `engine.summonFromPile` weist fremde
  // Effekt-Beschwoerungen (Tamed Primordium & Co.) damit ab; der eigene Weg nutzt `summonCreatureWithHooks`.
  summonOnlyViaOwnEffect: true,

  hooks: {
    // ── Reaction trigger: an Elven Creature we control leaves the board ──
    // Tod (Schaden, Zerstören, Opfer, Löschen): der Platz ist im Hook schon frei.
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      await riderAngebot(ctx._engine, ctx.cardOwner, ctx.card.id, ctx.creature);
    },

    // Zentrale Abgangs-Schiene: Bounce auf die Hand, Mischen ins Deck, Löschen/Zerstören über `actionMoveCard`, Mass Routing, Staff-Illusionen …
    // (Als Ruling Al 26.10.: JEDER Abgang vom Brett; Kontrollwechsel/Umzug auf dem Brett NICHT.)
    onCardLeaveZone: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.fromZone !== 'support' || ctx.isTransfer || ctx._supportSchlaeft) return;
      const inst = ctx.leavingCard;   // der Deepsea-Bounce meldet keinen `leavingCard` → `onCardsReturnedToHand` unten
      if (!inst || inst.id == null || inst.id === ctx.card.id) return;
      if (ctx.toZone === 'support' || ctx.toZone === 'surprise') return;   // Umzug auf dem Brett (Kontrollwechsel, Platzwechsel, verdeckt legen)
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const riderId = ctx.card.id;
      const death = {
        name: inst.name, owner: inst.owner, originalOwner: inst.originalOwner,
        controller: inst.controller ?? inst.owner,
        seite: ctx.fromOwner ?? engine.physicalSide(inst),
        heroIdx: ctx.fromHeroIdx ?? inst.heroIdx, zoneSlot: ctx.fromZoneSlot ?? inst.zoneSlot,
        instId: inst.id,
      };
      // Im Hook steht die Karte je nach Weg noch im Platz (`actionMoveCard`: Hook VOR dem Umbuchen) — dann erst NACH dem Abgang anbieten.
      const slot = engine.gs.players[death.seite]?.supportZones?.[death.heroIdx]?.[death.zoneSlot];
      if (slot && slot.length > 0) {
        engine.nachAbgang(inst, () => riderAngebot(engine, pi, riderId, death));
        return;
      }
      await riderAngebot(engine, pi, riderId, death);
    },

    // Deepsea-Bounce (Racket Arrow, Chasing the Legend, Deepsea-Karten …): kommt ohne `leavingCard`; der Platz ist schon frei.
    onCardsReturnedToHand: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const insts = ctx.returnedInsts || [];
      for (let i = 0; i < insts.length; i++) {
        const inst = insts[i];
        if (!inst || inst.id == null || inst.id === ctx.card.id) continue;
        const death = {
          name: inst.name, owner: inst.owner, originalOwner: inst.originalOwner,
          controller: inst.controller ?? ctx.ownerIdx ?? inst.owner,
          seite: ctx.fromOwners?.[i] ?? ctx.ownerIdx ?? inst.owner,
          heroIdx: ctx.fromHeroIdxs?.[i] ?? inst.heroIdx, zoneSlot: ctx.fromZoneSlots?.[i] ?? inst.zoneSlot,
          instId: inst.id,
        };
        await riderAngebot(engine, ctx.cardOwner, ctx.card.id, death);
      }
    },

    // ── On-summon: search deck, add an Elven (not Rider) to hand ──
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'support') {
        // While in hand, the "onPlay" hook isn't meaningful — but a
        // generic onPlay fire (e.g. from a future bulk-hook) shouldn't
        // misfire the tutor.
        return;
      }
      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      // The tutor is explicit card text: fires every time Rider is
      // summoned (not just on the first one). No HOPT guard.
      await runRiderTutor(engine, pi);
    },
  },
};

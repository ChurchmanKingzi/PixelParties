// ═══════════════════════════════════════════
//  CARD EFFECT: "Charme"
//  Ability — Free activation (Main Phase)
//
//  Lv1: Copy-activate an opponent's ability
//       using this Hero's stats.
//  Lv2: Opponent gives you 1 card from hand.
//       Fizzles during turn-1 protection.
//  Lv3: Take control of opponent's hero for
//       the turn (charmed + immune).
//       Fizzles on turn-1-protected heroes.
//
//  Standard free-ability HOPT covers shared
//  lock (all Charme copies share one name).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  // BORIS-SPERRE (Klausel 1): holt Karten des Gegners auf die eigene Seite
  // Solange der Gegner einen wirksamen Boris hat, ist diese Karte
  // gar nicht erst aktivierbar. Siehe engine.borisBlockIdx.
  stealsOpponentCards: true,

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['ability'],
  freeActivation: true,
  actionPhaseEligible: true, // Lv1 can also activate during Action Phase to copy action-cost abilities

  /**
   * CPU brain hook for Charme Lv1's ability picker.
   *
   * Bug we're fixing: the CPU would happily borrow an opponent's
   * lower- or equal-level copy of an Ability the CPU itself already
   * controls at >= that level. Because every Ability has a hard
   * once-per-turn slot keyed on `(name, player)` and Charme stamps
   * the BORROWER's slot on commit, this trade is strictly negative —
   * the CPU spends its Charme + locks out its own (better-or-equal)
   * copy + gains a strictly worse effect. Filter those targets out
   * before the default brain ranks the rest. If nothing legal
   * remains, decline the activation (Charme rolls back, HOPT is
   * refunded by the standard cancel path in `_activateLv1`).
   *
   * Lv2 doesn't use a target picker, and Lv3's picker shows opp
   * heroes (no `cardName`-keyed dedup needed) — both fall through
   * to the default brain via the early-return on the title check.
   */
  cpuResponse(engine, kind, payload) {
    // BEIDE Dispatcher bedienen: der Pfad über `promptEffectTarget`
    // meldet sich mit 'effectTarget', der ältere Ziel-Pfad mit 'target'.
    // Die Prüfung stand vorher nur auf 'target' — zusammen mit dem
    // fehlenden `source` war die Antwort damit doppelt unerreichbar.
    if (kind !== 'target' && kind !== 'effectTarget') return undefined;
    const { validTargets, config } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    // Only intervene for the Lv1 ability picker.
    if (!String(config?.title || '').includes('Charme Lv1')) return undefined;
    // Inside an outer rollout — defer (no nested brain).
    if (engine._inMctsSim || engine._mctsKilledThisTurn) return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    if (cpuIdx < 0) return undefined;

    // Map: ability name → highest level the CPU currently controls
    // across all its Heroes' ability zones.
    const cpuPs = engine.gs.players[cpuIdx];
    const ownLevels = new Map();
    for (let hi = 0; hi < (cpuPs.heroes || []).length; hi++) {
      const h = cpuPs.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      const zones = cpuPs.abilityZones?.[hi] || [];
      for (const slot of zones) {
        if (!slot?.length) continue;
        const abName = slot[0];
        const prev = ownLevels.get(abName) || 0;
        if (slot.length > prev) ownLevels.set(abName, slot.length);
      }
    }

    const viable = validTargets.filter(t => {
      const cardName = t.cardName;
      if (!cardName) return true;
      // Borrow level == opp slot length. The target id encodes
      // `ability-{owner}-{heroIdx}-{slotIdx}` — re-read the slot
      // off the live state instead of trusting a stale level.
      const m = (t.id || '').match(/^ability-(\d+)-(\d+)-(\d+)$/);
      if (!m) return true;
      const oi = +m[1], hi = +m[2], zi = +m[3];
      const opSlot = engine.gs.players[oi]?.abilityZones?.[hi]?.[zi] || [];
      const borrowLv = opSlot.length;
      const ownLv = ownLevels.get(cardName) || 0;
      // Borrow only when it strictly upgrades the CPU's access to
      // this ability. ownLv === 0 (don't have it) → always viable.
      // ownLv >= borrowLv → strict-loss trade, skip.
      return ownLv < borrowLv;
    });

    if (viable.length === 0) return null; // Decline — don't waste Charme.
    if (viable.length === validTargets.length) return undefined; // Nothing filtered — defer.
    // Some targets filtered. Defer to the default brain on the
    // narrowed slate. The brain reads `validTargets` from the prompt
    // payload, so a mid-stream replacement isn't ideal — easiest
    // reliable narrow is to commit a single best pick here. Pick
    // the candidate with the largest `borrowLv - ownLv` swing
    // (biggest net level upgrade); ties broken arbitrarily by
    // first-found.
    let best = null, bestSwing = -Infinity;
    for (const t of viable) {
      const m = (t.id || '').match(/^ability-(\d+)-(\d+)-(\d+)$/);
      if (!m) continue;
      const oi = +m[1], hi = +m[2], zi = +m[3];
      const opSlot = engine.gs.players[oi]?.abilityZones?.[hi]?.[zi] || [];
      const borrowLv = opSlot.length;
      const ownLv = ownLevels.get(t.cardName) || 0;
      const swing = borrowLv - ownLv;
      if (swing > bestSwing) { bestSwing = swing; best = t; }
    }
    if (best) return [best.id];
    return undefined;
  },

  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;

    // Erst-Runden-Immunität (Als Regel): in Runde 1 sind ALLE Karten des
    // Nicht-Zugspielers immun gegen alles, was der Zugspieler tun kann.
    // Jede Charme-Stufe greift auf gegnerische Karten zu — Lv1 borgt eine
    // gegnerische Ability, Lv2 nimmt eine Handkarte, Lv3 übernimmt einen
    // Helden —, also ist die Fähigkeit dann komplett gesperrt. Vorher
    // fizzelten Lv2/Lv3 erst MITTEN in der Resolution, wodurch der HOPT
    // schon verbraucht war und die Aktivierung überhaupt angeboten wurde;
    // Lv1 kannte die Regel gar nicht. Die Fizzles bleiben als zweite
    // Absicherung stehen, falls eine Stufe über einen anderen Weg
    // erreicht wird.
    if (gs.firstTurnProtectedPlayer === oi) return false;

    if (level >= 3) {
      // Lv3: need opponent hero alive (Main Phase only)
      if (!isMainPhase) return false;
      return (ops.heroes || []).some(h => h?.name && h.hp > 0 && !h.charmedBy);
    } else if (level >= 2) {
      // Lv2: opponent must have 1+ cards in hand (Main Phase only)
      if (!isMainPhase) return false;
      return (ops.hand || []).length > 0;
    } else {
      // Lv1: opponent must have activatable abilities
      // During Main Phase: free-activation abilities
      // During Action Phase: action-cost abilities
      const abilities = _getOpponentActivatableAbilities(gs, pi, engine);
      if (isMainPhase) return abilities.some(a => a.isFree);
      if (isActionPhase) return abilities.some(a => !a.isFree);
      return false;
    }
  },

  onFreeActivate: async (ctx, level) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name) return false;

    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];

    if (level >= 3) {
      return await _activateLv3(engine, gs, pi, heroIdx, hero, oi, ops);
    } else if (level >= 2) {
      return await _activateLv2(engine, gs, pi, heroIdx, hero, oi, ops);
    } else {
      return await _activateLv1(engine, gs, pi, heroIdx, hero, oi, ops);
    }
  },
};

// ═══════════════════════════════════════════
//  LEVEL 1: Copy-activate opponent's ability
// ═══════════════════════════════════════════

function _getOpponentActivatableAbilities(gs, pi, engine) {
  const oi = pi === 0 ? 1 : 0;
  const ops = gs.players[oi];
  const results = [];

  // Karten, die in einer SUPPORT-Zone liegen, dort aber als Ability
  // zaehlen (Cloak of Edge) — zentral ueber den Sammler. Als Ruling
  // 5.8.: Cloak SOLL ausleihbar sein und erhoeht dann den Angriffswert
  // des CHARME-Helden. Sie liefert ihren Effekt ueber `onEquipEffect`
  // statt `onFreeActivate`, deshalb die eigene Schleife.
  for (const st of (engine?.collectSupportZoneAbilities?.(oi) || [])) {
    const h = ops.heroes?.[st.heroIdx];
    if (!h?.name || h.hp <= 0) continue;
    const script = loadCardEffect(st.cardName);
    if (!script?.onEquipEffect) continue;
    // HARTE Sperre pro NAME UND SPIELER (Als Reminder 5.8.): eine
    // Nutzung graut ALLE Kopien aus. Beide Seiten pruefen, wie bei den
    // uebrigen geborgten Abilities.
    if (gs.hoptUsed?.[`free-ability:${st.cardName}:${oi}`] === gs.turn) continue;
    if (gs.hoptUsed?.[`free-ability:${st.cardName}:${pi}`] === gs.turn) continue;
    results.push({
      abName: st.cardName, script, isFree: true, isAction: false,
      ownerHeroIdx: st.heroIdx, zoneIdx: st.slotIdx, level: 1,
      fromSupport: true, sourceInst: st.inst,
    });
  }

  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
      const slot = (ops.abilityZones[hi] || [])[zi] || [];
      if (slot.length === 0) continue;
      const abName = slot[0];
      const script = loadCardEffect(abName);
      const isFree = !!script?.freeActivation;
      const isAction = !!script?.actionCost;
      // Must have either onActivate (action) or onFreeActivate (free)
      if (!script?.onActivate && !script?.onFreeActivate) continue;
      // Cannot copy another Charme
      if (abName === 'Charme') continue;
      // HOPT gate — applies to BOTH the original owner AND the borrower.
      // The engine's per-(name, player) keys are normally one-shot per
      // turn. Charme's borrow has to honour the lock from BOTH sides:
      //   • Owner already used theirs → can't copy a spent slot.
      //   • Borrower already used their OWN copy of the same ability →
      //     can't double-dip via Charme. Charme's commit further down
      //     stamps the borrower's key so a subsequent self-activation
      //     of the same ability is also blocked.
      const ownerKey    = isFree ? `free-ability:${abName}:${oi}` : `ability-action:${abName}:${oi}`;
      const borrowerKey = isFree ? `free-ability:${abName}:${pi}` : `ability-action:${abName}:${pi}`;
      if (gs.hoptUsed?.[ownerKey] === gs.turn) continue;
      if (gs.hoptUsed?.[borrowerKey] === gs.turn) continue;
      // ── BEZAHLBARKEIT AUS SICHT DES AUSLEIHERS (1.8., Als Report) ──
      // Die geborgte Ability wird vom AUSLEIHER bezahlt, nicht vom
      // Besitzer. Ihre eigene Vorprüfung kennt die Kosten (Alchemy Lv1
      // verlangt 8 Gold), wurde hier aber nie befragt — deshalb bot der
      // Picker Alchemy auch bei leerer Kasse an und der Klick verpuffte.
      //
      // Der Kontext setzt bewusst `cardOwner: pi` (den Ausleiher), damit
      // die Prüfung dessen Gold und Vorräte liest. Nur ein explizites
      // `false` schließt aus — wirft die Karte oder braucht sie mehr
      // Kontext, bleibt sie wie bisher wählbar.
      const gate = isFree ? script.canFreeActivate : script.canActivate;
      if (typeof gate === 'function') {
        let erlaubt = true;
        try {
          const ctx = {
            _engine: engine, players: gs.players, gs,
            cardOwner: pi, cardController: pi,
            // `cardHeroIdx` bleibt bewusst offen: der Held des
            // AUSLEIHERS ist hier nicht bekannt, und die Kostenprüfungen
            // lesen ohnehin nur `cardOwner`. Ein Verweis auf eine nicht
            // vorhandene Variable wäre im try gelandet und hätte die
            // Prüfung still abgeschaltet — genau die Falle, die in
            // dieser Sitzung mehrfach zugeschlagen hat.
            cardName: abName,
          };
          erlaubt = gate.call(script, ctx, slot.length) !== false;
        } catch { erlaubt = true; }
        if (!erlaubt) continue;
      }
      results.push({ abName, abLevel: slot.length, ownerHeroIdx: hi, zoneIdx: zi, heroName: h.name, script, isFree });
    }
  }
  return results;
}

async function _activateLv1(engine, gs, pi, heroIdx, hero, oi, ops) {
  const allAbilities = _getOpponentActivatableAbilities(gs, pi, engine);
  const isActionPhase = gs.currentPhase === 3;
  // During Action Phase: only action-cost abilities; during Main Phase: only free abilities
  const abilities = isActionPhase
    ? allAbilities.filter(a => !a.isFree)
    : allAbilities.filter(a => a.isFree);
  if (abilities.length === 0) return false;

  // ── Direct click: highlight eligible opponent Ability slots, click
  // one to commit. `promptEffectTarget` with `autoConfirm: true`
  // skips the Confirm-button step — the first click that fills the
  // single-target slot dispatches the response automatically.
  //
  // The pending card-reveal + play-log slots are STASHED across the
  // click-pick so its auto-confirm doesn't burn them on the way in.
  // (`_firePendingCardReveal` runs from `resolveGenericPrompt` /
  // `resolveEffectPrompt` on every confirmed response — without the
  // stash, the player picking an ability would already reveal Charme
  // to the opponent before the borrowed ability gets a chance to
  // cancel.) After the pick, we put them back so the borrowed
  // ability's first confirmed prompt OR the server's end-of-resolve
  // path can fire them — both of which only run when the borrow
  // actually resolves. On full cancellation the server sees
  // `resolved === false` and clears them as part of its standard
  // free-activate rollback (HOPT released, no animation, no opponent
  // reveal).
  const targets = abilities.map(ab => ({
    id: ab.fromSupport
      ? `equip-${oi}-${ab.ownerHeroIdx}-${ab.zoneIdx}`
      : `ability-${oi}-${ab.ownerHeroIdx}-${ab.zoneIdx}`,
    // `type` MUSS der ZONE folgen, nicht dem Regeltyp — der Client
    // hebt Ability-Slots und Support-Slots ueber verschiedene Wege
    // hervor. Mit `type: 'ability'` fand der Picker die Cloak in der
    // Support-Zone nicht (Als Befund 5.8.).
    type: ab.fromSupport ? 'equip' : 'ability',
    owner: oi,
    heroIdx: ab.ownerHeroIdx,
    slotIdx: ab.zoneIdx,
    cardName: ab.abName,
  }));

  const stashedReveal = gs._pendingCardReveal;
  const stashedLog    = gs._pendingPlayLog;
  gs._pendingCardReveal = null;
  gs._pendingPlayLog    = null;

  let selectedIds;
  try {
    selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: `${hero.name} — Charme Lv1`,
      // Der CPU-Dispatcher löst das Kartenskript über den Prompt-Titel
      // auf (`loadCardEffect(config.source || config.title)`). Unser
      // Titel trägt den Heldennamen, ist also KEIN Kartenname — ohne
      // dieses Feld lief `loadCardEffect("… — Charme Lv1")` ins Leere
      // und die cpuResponse weiter unten war toter Code. Genau deshalb
      // kopierte die CPU im Mitschnitt vom 1.8. ein Leadership Lv1,
      // obwohl sie selbst Leadership 3 besaß.
      source: 'Charme',
      description: "Click an opponent's Ability to use it as your own.",
      confirmLabel: 'Confirm',
      cancellable: true,
      maxPerType: { ability: 1 },
      maxTotal: 1,
      minRequired: 1,
      autoConfirm: true,
    });
  } finally {
    gs._pendingCardReveal = stashedReveal;
    gs._pendingPlayLog    = stashedLog;
  }

  if (!selectedIds || selectedIds.length === 0) return false;
  const targetId = selectedIds[0];
  const selectedAb = abilities.find(ab =>
    (ab.fromSupport
      ? `equip-${oi}-${ab.ownerHeroIdx}-${ab.zoneIdx}`
      : `ability-${oi}-${ab.ownerHeroIdx}-${ab.zoneIdx}`) === targetId
  );
  if (!selectedAb) return false;

  const script = selectedAb.script;
  const activateFn = selectedAb.fromSupport
    ? script.onEquipEffect
    : (script.onFreeActivate || script.onActivate);
  if (!activateFn) return false;

  // Create a fake context as if the ability were on this Hero
  const fakeInst = {
    id: 'charme-copy-' + Date.now(),
    name: selectedAb.abName,
    owner: pi,
    controller: pi,
    zone: 'ability',
    heroIdx: heroIdx,
    zoneSlot: -1,
    counters: {},
    faceDown: false,
    getHook: () => null,
    isActiveIn: () => true,
  };

  const fakeCtx = engine._createContext(fakeInst, {});

  engine.log('charme_copy', {
    player: gs.players[pi].username, hero: hero.name,
    ability: selectedAb.abName, level: selectedAb.abLevel,
    from: selectedAb.heroName,
  });

  // Als Kosmetik-Ruling: die kopierte Ability erscheint zentral auf
  // dem Screen (CardRevealOverlay — wie ein Search-Confirm-Fenster,
  // fadet aber nach 3.5s von selbst aus). Gilt für CPU UND Mensch —
  // dieser Skript-Pfad läuft für beide; in Sims ist _broadcastEvent
  // stumm (_fastMode-Guard).
  engine._broadcastEvent('card_reveal', { cardName: selectedAb.abName, playerIdx: pi });

  // Propagate the borrowed ability's cancel return: when an ability
  // returns `false` from its onFreeActivate/onActivate (player backed
  // out of an internal prompt), Charme's outer wrapper must also
  // return `false` so the server's free-activate handler rolls back —
  // HOPT released, pending card-reveal cleared (opponent doesn't see
  // Charme), no `ability_activated` flash on Charme's slot. Anything
  // truthy / undefined / void counts as "Charme committed" — matches
  // the server's `resolved !== false` convention.
  const result = await activateFn(fakeCtx, selectedAb.abLevel);

  // On commit, stamp the BORROWER's HOPT key for this ability name.
  // Charme's borrow runs the script function directly — it never goes
  // through doActivateFreeAbility / doActivateActionCost, which is
  // where the engine normally stamps the per-(name, player) lock. So
  // without this manual stamp, the borrower could go on to play their
  // OWN copy of the same ability the same turn (Adventurousness etc.).
  // Skipped on cancel (the borrow didn't actually commit).
  if (result !== false) {
    if (!gs.hoptUsed) gs.hoptUsed = {};
    // Einheitlich der namensbasierte Schluessel — auch fuer Karten aus
    // der Support-Zone (Cloak of Edge). Sie sind hart einmal pro Runde
    // pro Spieler, nicht pro Instanz. Zusaetzlich die Besitzerseite
    // stempeln, damit der Gegner seine Cloak danach nicht mehr nutzen
    // kann (Als Reminder 5.8.).
    const stampKey = selectedAb.isFree
      ? `free-ability:${selectedAb.abName}:${pi}`
      : `ability-action:${selectedAb.abName}:${pi}`;
    gs.hoptUsed[stampKey] = gs.turn;
    if (selectedAb.fromSupport) {
      gs.hoptUsed[`free-ability:${selectedAb.abName}:${oi}`] = gs.turn;
    }
  }
  engine.sync();
  return result !== false;
}

// ═══════════════════════════════════════════
//  LEVEL 2: Steal card from opponent's hand
// ═══════════════════════════════════════════

async function _activateLv2(engine, gs, pi, heroIdx, hero, oi, ops) {
  if ((ops.hand || []).length === 0) return false;

  // Turn-1 protection: opponent is protected from hand theft
  if (gs.firstTurnProtectedPlayer === oi) {
    engine.log('charme_fizzle', { player: gs.players[pi].username, reason: 'turn-1 protection' });
    engine.sync();
    return true; // Effect was attempted (HOPT consumed) but fizzled
  }

  engine.log('charme_steal_start', { player: gs.players[pi].username, hero: hero.name });

  // Prompt the OPPONENT to choose a card to give away
  const result = await engine.promptGeneric(oi, {
    type: 'forceDiscard',
    title: `${hero.name} used Charme!`,
    description: 'Choose 1 card to give to your opponent.',
    instruction: 'Click a card in your hand to give it away.',
    opponentTitle: '💕 Opponent is choosing a card to give you...',
    opponentSubtitle: 'Waiting for opponent to select a card...',
  });

  let cardName;
  let stealHandIdx = -1;
  if (result?.cardName) {
    cardName = result.cardName;
    stealHandIdx = result.handIndex != null ? result.handIndex : ops.hand.indexOf(cardName);
    if (stealHandIdx < 0) stealHandIdx = ops.hand.indexOf(cardName);
  } else if (ops.hand.length > 0) {
    // Fallback: take the last card
    cardName = ops.hand[ops.hand.length - 1];
    stealHandIdx = ops.hand.length - 1;
  }

  if (cardName && stealHandIdx >= 0) {
    // Reaktionsfenster (Ambush the Scout), Kategorie 'steal' — VOR der
    // Flug-Animation, sonst sieht der Gegner die Karte schon fliegen
    // und sie kommt danach wieder zurueck. Charme baut den Griff in
    // die fremde Hand selbst statt ueber actionStealFromHand, deshalb
    // steht der Aufruf hier von Hand.
    if (await engine.checkHandInteractionReaction(oi, 'steal',
          { byPi: pi, count: 1, sourceName: 'Charme' })) {
      engine.log('charme_steal_negated', { player: gs.players[pi]?.username, from: ops.username });
      engine.sync();
      return;
    }
    // Broadcast the hand-rip flight FIRST so the client highlights
    // the source slot, hides it, and animates a face-up clone from
    // opp's hand into ours BEFORE the state sync arrives. Without
    // this, the diff-based hand-grew detector lumps the stolen card
    // together with any chained draws (e.g. Lilly, the Charming
    // Infiltrator's draw-on-steal trigger) and animates ALL of them
    // from our own deck pile — the steal visually came from the
    // wrong place. Pre-registering with `play_hand_steal` flips
    // `stealInProgressRef` and `stealSkipDrawRef` on the client so
    // the auto draw-anim skips the stolen card and Lilly's draw
    // still gets its proper deck-flight.
    const flightMs = 800;
    const highlightMs = 250;
    engine._broadcastEvent('play_hand_steal', {
      fromPlayer: oi, toPlayer: pi,
      indices: [stealHandIdx], cardNames: [cardName], count: 1,
      duration: flightMs, highlightMs,
    });
    // Wait long enough for the client's phase-3 cleanup to run
    // (`highlightMs + flightMs + 200` = 1250 ms) so `stealSkipDrawRef`
    // is set and `stealInProgressRef` is cleared by the time the
    // post-mutation sync arrives. A short +120 ms here would race
    // ahead of phase 3 and Lilly's chained draw would skip the
    // deck-flight animation. See `actionStealFromHand` for the
    // canonical buffer in the shared helper.
    await engine._delay(highlightMs + flightMs + 250);

    // Now apply the state mutation — clone has landed; the sync
    // that follows just swaps the clone for the real card.
    ops.hand.splice(stealHandIdx, 1);
    gs.players[pi].hand.push(cardName);
    // Instanz mitziehen (siehe _moveHandInstanceOwner): `owner` folgt
    // dem physischen Besitz, `originalOwner` bleibt — damit geht die
    // Karte beim Abwerfen/Löschen zurück in die richtige Ablage.
    engine._moveHandInstanceOwner(oi, pi, cardName);
    const charmerSid = gs.players[pi]?.socketId;
    if (charmerSid && engine.io) {
      engine.io.to(charmerSid).emit('card_reveal', { cardName });
    }
    engine.log('charme_steal', { player: gs.players[pi].username, card: cardName, from: ops.username });
    // Fire the universal "card taken from opponent" hook so passive
    // listeners (Lilly, the Charming Infiltrator, future similar
    // heroes) can react. One emit per stolen card — Charme Lv2
    // takes exactly one, but a future N-card steal would loop and
    // fire N times.
    await engine.runHooks('onCardTakenFromOpponent', {
      takerPi: pi, fromZone: 'hand', cardName,
    });
  }

  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  LEVEL 3: Take control of opponent's hero
// ═══════════════════════════════════════════

async function _activateLv3(engine, gs, pi, heroIdx, hero, oi, ops) {
  const heroTargets = [];
  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0 || h.charmedBy != null) continue;
    heroTargets.push({
      id: `hero-${oi}-${hi}`,
      type: 'hero', owner: oi, heroIdx: hi, cardName: h.name,
    });
  }

  if (heroTargets.length === 0) return false;

  const picked = await engine.promptEffectTarget(pi, heroTargets, {
    title: `${hero.name} — Charme Lv3`,
    description: 'Choose an opponent\'s Hero to take control of!',
    confirmLabel: '💕 Charm!',
    confirmClass: 'btn-success',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    greenSelect: true,
  });

  if (!picked || picked.length === 0) return false;

  const sel = heroTargets.find(t => t.id === picked[0]);
  if (!sel) return false;

  const targetHero = ops.heroes[sel.heroIdx];
  if (!targetHero?.name) return false;

  // Turn-1 protection: hero is protected — fizzle
  if (gs.firstTurnProtectedPlayer === oi) {
    engine.log('charme_fizzle', { player: gs.players[pi].username, target: targetHero.name, reason: 'turn-1 protection' });
    engine.sync();
    return true; // HOPT consumed but fizzled
  }

  // ── Resistance gate ──
  // Resistance listens on `beforeHeroEffect` and cancels the FIRST
  // non-damage effect each turn. Without this gate, the `charmedBy`
  // mutation would land directly and bypass Resistance entirely (the
  // `charmed` status set below would be cleaned up by Resistance's
  // onStatusApplied listener, but the `charmedBy` flag itself would
  // stick — leaving the hero half-charmed).
  const effectCtx = {
    playerIdx: oi, heroIdx: sel.heroIdx, hero: targetHero,
    effectType: 'charm', cancelled: false, _skipReactionCheck: true,
  };
  await engine.runHooks('beforeHeroEffect', effectCtx);
  if (effectCtx.cancelled) {
    engine.log('charme_blocked', {
      player: gs.players[pi].username, target: targetHero.name,
    });
    engine.sync();
    return true; // HOPT consumed but blocked
  }

  // ★ Effekt-Immunitaet respektieren (Als Vorgabe 21.8.: ALLE Effekte
  // sollen an einem geschuetzten Helden abprallen — Escape Device,
  // Invisibility Cloak). `charmed` laeuft bewusst NICHT ueber
  // `addHeroStatus` (kein Katalogstatus), also steht der Riegel hier
  // von Hand. `oi`/`sel.heroIdx` ist der betroffene Held.
  if (engine.hasEffectImmunity?.(oi, sel.heroIdx, null)) {
    engine.log('effect_immunity', { hero: targetHero.name, status: 'charmed' });
    engine.sync();
    return true;
  }

  // ── Take control ──
  targetHero.charmedBy = pi;
  targetHero.charmedFromOwner = oi;
  targetHero.charmedHeroIdx = sel.heroIdx;

  if (!targetHero.statuses) targetHero.statuses = {};
  targetHero.statuses.charmed = { controller: pi, appliedTurn: gs.turn };

  if (!gs._charmedSupportLocked) gs._charmedSupportLocked = [];
  gs._charmedSupportLocked.push({ owner: oi, heroIdx: sel.heroIdx });

  engine.log('charme_control', {
    player: gs.players[pi].username, hero: hero.name,
    target: targetHero.name, targetOwner: ops.username,
  });

  engine._broadcastEvent('play_zone_animation', {
    type: 'heal_sparkle', owner: oi, heroIdx: sel.heroIdx, zoneSlot: -1,
  });

  engine.sync();
  return true;
}

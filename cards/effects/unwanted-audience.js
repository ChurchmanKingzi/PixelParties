// ═══════════════════════════════════════════
//  CARD EFFECT: "Unwanted Audience"
//  Spell (Reaction) — Decay Magic + Magic Arts, Lv1
//
//  "Play this card at the beginning of your opponent's turn.
//   Creatures your opponent controls cannot activate their active
//   effects this turn. This counts as a negative status effect."
//
//  ── Timing / trigger ────────────────────────────────────────────
//  Same shape as "Jump in the River": NOT `isReaction` (that flag is
//  the chain-reaction system, wrong here). `spellPlayCondition`
//  returns false (never proactively playable); the card triggers
//  from its `onTurnStart` hook at the START of the OPPONENT's turn,
//  offers a confirm, then plays through `executeCardWithChain` so
//  the opponent still gets a counter window. If countered, `resolve`
//  never runs → no aura.
//
//  ── Effect ──────────────────────────────────────────────────────
//  ★ W14b (Q152, Al: „NUR aktive Effekte, passive Komponenten bleiben
//  unberührt!"): Every Creature the opponent controls that HAS an
//  active effect (script exports `creatureEffect` + `onCreatureEffect`
//  — the manually-triggered kind gated by summoning sickness) gets the
//  negative status `active_locked`. It blocks ONLY the activation
//  (`engine.isCreatureActiveEffectLocked`: activation gate, offer list,
//  CPU, Grimoire/Kohta repeats); passives, triggers and reactions of the
//  Creature keep working (a Bomb Mite, a rein passive Kreatur, is not
//  touched at all). Earlier versions applied `negated`, which silenced
//  the WHOLE Creature. Two properties stay:
//    • It is applied `cleansable: true`, so Beer / Juice CAN heal it
//      off (counts as a negative status effect; Lunatic / Light Ball
//      immunity is honoured on application and on the gate).
//    • It expires on its own at the end of the opponent's turn.
//  Creatures with an active effect the opponent summons LATER that
//  same turn are caught via the discard-resident `onCardEnterZone`
//  listener and suffer the same fate + animation.
//
//  ── Animation ───────────────────────────────────────────────────
//  Each affected Creature shows a cartoony floating "Z z z" sleeping
//  effect (`unwanted_audience_zzz`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Unwanted Audience';
const BUFF_KEY  = 'unwanted_audience_negated';

/**
 * Does this support-zone instance have an ACTIVE (manually-triggered)
 * effect? Mirrors the engine's own activatable-effect gate
 * (`script.creatureEffect`, honouring `_effectOverride`).
 */
function creatureHasActiveEffect(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  const effectName = inst.counters?._effectOverride || inst.name;
  const s = loadCardEffect(effectName);
  return !!(s?.creatureEffect && s?.onCreatureEffect);   // W14b: wie das Aktivierungs-Tor (server.js) – Bomb Mite (nur Flagge, rein passiv) hat KEINEN aktiven Effekt
}

/**
 * Put one Creature "to sleep": apply the cleansable `negated` status
 * expiring at the end of the opponent's turn, and — only if the
 * negation actually stuck (not Cardinal/Gate-immune) — play the Zzz.
 * @param {number} ownerPi - the Unwanted Audience controller (drives expiry)
 */
async function sleepCreature(engine, inst, ownerPi) {
  if (!inst || inst.counters?.active_locked) return;
  // R02-05: „This counts as a negative status effect" — `actionNegateCreature`
  // prueft Light Ball und die Immunitaet gegen negative Status (Lunatic Golem)
  // nicht selbst (die sitzen in `canApplyCreatureStatus`), also hier.
  if (engine._lightBallProtects(inst.controller ?? inst.owner, 'creature')) return;
  if (engine._creatureNegStatusImmune(inst)) return;
  // W5b-Z2 (Al, Welle 5: „Monia kann darauf reagieren"): Cool Rescuer Monia schützt „Creatures either player controls, die von
  // einer Karte/einem Effekt betroffen würden" – das Setzen der Negierung hat das Fenster `beforeCreatureAffected` bisher
  // nie geöffnet (wie bei Gift: `actionApplyCreaturePoison`). Bricht Monia ab, schläft die Kreatur nicht ein.
  // Monias Schild („… all Creatures") steht für diesen Effekt schon (angenommenes Angebot bei einer früheren Kreatur): kein weiteres Fenster, die Kreatur schläft nicht ein.
  // (W58a: die Einmal-pro-Zug-Sperre ist weg; Monias Hook prüft den Schild selbst — die Prüfung hier spart nur das Fenster.)
  if (engine.moniaSchildBlockt(inst, { name: CARD_NAME }, inst.controller ?? inst.owner)) return;
  const fensterCtx = { creature: inst, effectType: 'status', source: { name: CARD_NAME, owner: ownerPi }, cancelled: false, _skipReactionCheck: true };
  await engine.runHooks('beforeCreatureAffected', fensterCtx);
  if (fensterCtx.cancelled) return;
  // ★ W14b (Q152, Al: „NUR aktive Effekte, passive Komponenten bleiben unberührt!"): kein `negated` mehr (das legte die GANZE Kreatur still,
  // auch Passive wie Bomb Mites Zündung), sondern der eigene Status `active_locked`, der nur das AKTIVIEREN sperrt
  // (`engine.isCreatureActiveEffectLocked`). Ablauf, Heilbarkeit (Beer/Juice) und Schutzprüfungen wie gehabt über `actionNegateCreature`.
  await engine.actionNegateCreature(inst, CARD_NAME, {
    statusKey: 'active_locked',
    _skipAffectedWindow: true,   // W16b: das Monia-Fenster ist oben schon aufgegangen
    // Current turn is the OPPONENT's; it ends when ownerPi's next
    // turn starts (gs.turn + 1 / expiresForPlayer = ownerPi). Same
    // arithmetic Jump in the River uses for its turn-scoped buff.
    expiresAtTurn: engine.gs.turn + 1,
    expiresForPlayer: ownerPi,
    cleansable: true,            // ← Beer / Juice may heal THIS negation
    buffKey: BUFF_KEY,
  });
  if (inst.counters?.active_locked) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'unwanted_audience_zzz',
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      duration: 1700,
    });
  }
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'unwanted_audience_zzz' }, impactMs: 260,
  },

  // CPU: confirm Unwanted Audience's "play it?" prompt — the default brain
  // declines cancellable confirms outside a card-cast (onTurnStart trigger),
  // so without this the CPU never plays this disruption. (Title == card name.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  // Fire hooks from hand (the onTurnStart trigger) AND discard (the
  // catch-later-summons listener, after the card resolves there).
  activeIn: ['hand', 'discard'],

  // Never proactively playable — only via the onTurnStart trigger.
  // (Deliberately NOT `isReaction`; see header.)
  spellPlayCondition() { return false; },

  hooks: {
    /**
     * Beginning of the OPPONENT's turn: offer to play the card.
     */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;   // only a hand copy triggers
      if (ctx.isMyTurn) return;              // only on the opponent's turn

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // One prompt per turn even with multiple copies in hand.
      if (gs._unwantedAudiencePromptDone === gs.turn) return;
      gs._unwantedAudiencePromptDone = gs.turn;

      const ps = gs.players[pi];
      if (!ps?.hand?.includes(CARD_NAME)) return;
      // ★ W21a (Al, 20.10.2026: „ja"): Wirker-Held mit Decay Magic 1 (Magic Arts zaehlt als zweite Schule laut Kartendaten) noetig —
      // eigener oder uebernommener; sonst kein Angebot.
      if (!engine.hookReaktionWirkerVorhanden(pi, CARD_NAME)) return;

      const want = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: "Play Unwanted Audience? Your opponent's Creatures with active effects can't use them this turn.",
        confirmLabel: '🎭 Yes!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!want) return;

      // Remove one copy from hand, keep its instance (it becomes the
      // discard-resident listener for later summons).
      const removeIdx = ps.hand.indexOf(CARD_NAME);
      if (removeIdx < 0) return;
      // ★ W21a: Wirker waehlen (vor jeder Entnahme; Abbruch = nichts passiert).
      const wirkerPlan = await engine.hookReaktionWirkerWaehlen(pi, CARD_NAME);
      if (!wirkerPlan) return;
      if (ps.hand.indexOf(CARD_NAME) !== removeIdx) return;

      // Zone-anchored hand→discard flight. This card is removed from
      // hand here and pushed to discard only AFTER executeCardWithChain
      // — across the chain's intervening syncs the client's diff-based
      // fly-out detector can't pair the hand-shrink with the later
      // discard-grow, so the card would just TELEPORT into the pile.
      // Broadcast an explicit pile-transfer BEFORE the splice (hand
      // slot still rendered → accurate source rect). The card always
      // ends up in discard (even if countered), so the flight is
      // correct unconditionally. `fromHandIdx` = pre-splice slot, per
      // the engine's canonical hand→pile pattern.
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME,
        from: 'hand', to: 'discard',
        fromHandIdx: removeIdx,
        // Einsatz-Beleg: derselbe Fall wie Jump in the River — die
        // Karte spielt sich im eigenen Reaktions-Hook aus der Hand,
        // also feuert afterSpellResolved nicht und ohne Marker bliebe
        // sie im Report bei 0 Einsätzen. 'sole' zwingend, weil `true`
        // Spell/Attack bewusst überspringt.
        asPlay: 'sole',
      });

      engine.takeFromPileSync(ps, 'hand', removeIdx);
      // ★★ v1222: Abgleich SOFORT nach dem Hand-Abgang. Der Client verdeckt den
      // Startplatz der abfliegenden Karte nur, solange die Hand noch so
      // gross ist wie beim Abflug — bleibt der `sync` aus, taucht sie
      // nach dem Flug wieder auf (Als Befund 18.9. zu „Dive Down").
      engine.sync();
      await engine._rxPayWisdom(ps, wirkerPlan);   // W21a: Wisdom-Abwurf des Wirkers (Karte ist schon aus der Hand)
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME);

      // Reveal to opponent + spectators (same etiquette as Jump in the River).
      const oppIdx = engine.opponentOf(pi);
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
      if (engine.room?.spectators) {
        for (const spec of engine.room.spectators) {
          if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: CARD_NAME });
        }
      }
      await engine._delay(100);

      const chainResult = await engine.executeCardWithChain({
        cardName: CARD_NAME,
        owner: pi,
        cardType: 'Spell',
        goldCost: 0,
        // Runs ONLY if the card isn't countered in the chain window.
        resolve: async () => {
          // Arm the turn-scoped aura so later opponent summons are
          // caught by the discard listener below.
          gs._unwantedAudience = { player: oppIdx, owner: pi, turn: gs.turn };

          // Put every current opponent Creature with an active
          // effect to sleep. (Snapshot the ids first — sleepCreature
          // mutates counters; iterating cardInstances live is fine
          // but we filter defensively.)
          for (const cInst of [...engine.cardInstances]) {
            if ((cInst.controller ?? cInst.owner) !== oppIdx) continue;
            if (!creatureHasActiveEffect(engine, cInst)) continue;
            await sleepCreature(engine, cInst, pi);
          }
          require('./_monia-shared').angeboteBeenden(gs);   // Z2: Monias Schild gilt für DIESEN Effekt (alle Kreaturen), nicht darüber hinaus
          engine.log('unwanted_audience', {
            player: ps.username, target: gs.players[oppIdx]?.username,
          });
          return { success: true };
        },
      });

      // Card always heads to discard — but KEEP its instance tracked
      // (zone → discard) so its onCardEnterZone listener can catch
      // Creatures summoned later this turn. (Jump in the River
      // untracks here; this card must not, hence the manual move.)
      if (inst) {
        inst.zone = 'discard';
        inst.heroIdx = -1;
        inst.zoneSlot = -1;
      }
      ps.discardPile.push(CARD_NAME);

      if (chainResult.negated) {
        engine.log('unwanted_audience_negated', { player: ps.username });
      }
      engine.sync();
    },

    /**
     * A Creature the opponent summons LATER this turn also falls
     * asleep. Fires from the discard-resident instance (onCardEnterZone
     * is broadcast without `_onlyCard`, so passive listeners see it).
     */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ua = gs._unwantedAudience;
      if (!ua || ua.turn !== gs.turn) return;        // aura not armed this turn
      if (ctx.toZone !== 'support') return;
      const inst = ctx.enteringCard;
      if (!inst) return;
      if ((inst.controller ?? inst.owner) !== ua.player) return;  // opponent's side only
      if (inst.counters?.active_locked) return;      // already asleep (idempotent vs. dup copies)
      if (!creatureHasActiveEffect(engine, inst)) return;
      await sleepCreature(engine, inst, ua.owner);
      require('./_monia-shared').angeboteBeenden(gs);   // Z2: Schild nur für diese Auslösung
      engine.sync();
    },

    /**
     * Disarm at the end of the opponent's turn (the negation buffs
     * expire on their own via actionNegateCreature's timed buff).
     */
    onTurnEnd: async (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._unwantedAudience && gs._unwantedAudience.turn === gs.turn) {
        delete gs._unwantedAudience;
      }
    },
  },
};

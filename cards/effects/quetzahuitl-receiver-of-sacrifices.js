// ═══════════════════════════════════════════
//  CARD EFFECT: "Quetzahuitl, Receiver of Sacrifices"
//  Hero — printed 200 HP / 200 ATK. Despite its `cardType: 'Hero'`,
//  this card sits in the player's MAIN DECK and gets drawn into hand
//  like any other card. It enters play through a reactive "divine
//  descent" trigger, not through the normal Hero-setup path.
//
//  Trigger:
//    When the LAST living Hero you control is defeated during your
//    opponent's turn while Quetzahuitl is in your hand:
//      1. Delete all your Heroes.
//      2. Delete every card in all your Heroes' Support and Ability
//         Zones (route to the Deleted pile, NOT the Discard pile).
//      3. Place Quetzahuitl from hand into the dying Hero's slot.
//      4. Attach up to 3 copies of "Divinity" pulled from your deck,
//         hand, or discard pile (priority order) — stacked into a
//         single ability slot, matching Sacrifice-to-Divinity's
//         placement convention.
//      5. When Quetzahuitl is later defeated, the controller loses
//         the game immediately.
//
//  Engine integration notes:
//    • Trigger lives in the hand-zone listener under `onHeroKO`
//      (`activeIn: ['hand']`). The engine walks all hand-zone
//      CardInstances with a matching hook during the KO cascade, so
//      Quetzahuitl reliably sees the death event before
//      `checkAllHeroesDead` runs — which is critical, because after
//      our placement Quetzahuitl is alive and the "all heroes dead
//      → game over" check correctly returns false.
//
//    • Replacement strategy: install Quetzahuitl in the slot of the
//      Hero that just died. Card text says the player chooses one
//      of their Hero Zones; defaulting to the dying slot keeps the
//      flow non-prompted mid-KO-cascade, which would otherwise be
//      jarring. Can be replaced with an explicit zone prompt later
//      if the user wants the literal "choose a slot" experience.
//
//    • Loss-on-defeat enforcement: a second `onHeroKO` listener
//      (`activeIn: ['hero']`) fires `engine.onGameOver` if this
//      card's own hero object is the one being KO'd. Without this,
//      a future effect that puts an extra Hero on the board next to
//      Quetzahuitl would silently let the game continue past
//      Quetzahuitl's defeat — `checkAllHeroesDead` only triggers
//      loss when EVERY Hero is dead.
//
//    • Divinity attachment: routed through `canAttachAbilityToHero`
//      with `allowRestricted: true` — same gate Sacrifice to
//      Divinity / Very Special Prisoner use to bypass Divinity's
//      `restrictedAttachment` block. The freshly-tracked
//      Quetzahuitl slot has empty ability zones, so the first
//      Divinity lands in slot 0 and copies 2 and 3 stack on top of
//      it (Divinity stacks up to 3 deep on a single slot).
// ═══════════════════════════════════════════

const CARD_NAME = 'Quetzahuitl, Receiver of Sacrifices';
const DIVINITY  = 'Divinity';

module.exports = {
  // Hooks need to fire from the hand (trigger) AND from the hero
  // zone (loss-on-defeat).
  activeIn: ['hand', 'hero'],

  // Never proactively playable. The card enters play only through
  // its reactive descent trigger; until then it sits dimmed in
  // hand. `canActivate: () => false` keeps the standard play paths
  // greyed out, `neverPlayable: true` keeps it out of chain windows
  // and CPU consideration.
  canActivate: () => false,
  neverPlayable: true,

  hooks: {
    onHeroKO: async (ctx) => {
      // Branch by zone — hand triggers the descent, hero triggers
      // the loss enforcement.
      if (ctx.cardZone === 'hero') {
        return handleLossOnDefeat(ctx);
      }
      if (ctx.cardZone === 'hand') {
        return handleHandTrigger(ctx);
      }
    },
  },
};

// ═══════════════════════════════════════════
//  HAND TRIGGER — divine descent
// ═══════════════════════════════════════════

async function handleHandTrigger(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps) return;

  // Card text restricts the trigger to "during your opponent's
  // turn" — `ctx.isMyTurn` is true when this card's controller is
  // the active player, so abort whenever it's our own turn.
  if (ctx.isMyTurn) return;

  const dyingHero = ctx.hero;
  if (!dyingHero?.name) return;
  if (!isLastLivingHero(ps, dyingHero)) return;

  // Reentrancy guard — protects against a second hand-resident
  // Quetzahuitl firing in the same KO cascade.
  if (gs._quetzahuitlAscending) return;
  gs._quetzahuitlAscending = true;
  try {
    await performDescent(engine, pi, dyingHero, ctx.card);
  } finally {
    delete gs._quetzahuitlAscending;
  }
}

function isLastLivingHero(ps, dyingHero) {
  const heroes = ps.heroes || [];
  if (!heroes.includes(dyingHero)) return false;
  for (const h of heroes) {
    if (h === dyingHero) continue;
    if (h?.name && h.hp > 0) return false;
  }
  return true;
}

async function performDescent(engine, pi, dyingHero, handInst) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  const targetHeroIdx = (ps.heroes || []).findIndex(h => h === dyingHero);
  if (targetHeroIdx < 0) return;

  // ── 1. Pull Quetzahuitl out of hand. ──
  const handIdx = ps.hand.indexOf(CARD_NAME);
  if (handIdx < 0) return;
  // Einsatz-Beleg für den Trainings-Recorder. Als Verdachtsfall
  // "Quetzahuitl 0% — lehnt die CPU ab?": nein, hier gibt es gar keinen
  // Prompt, der Abstieg läuft vollautomatisch und funktioniert (gegen
  // die echte Engine verifiziert). Er war nur unsichtbar: die Karte
  // wandert Hand → Hero-Zone, ohne je die Play-Pfade zu berühren, und
  // die drei quetzahuitl_*-Logs stehen nicht in ACT_EVENTS. Ergebnis:
  // plays 0 trotz realer Abstiege. `asPlay: 'sole'` ist das etablierte
  // Signal dafür (kein afterSpellResolved, keine Doppelzählung möglich).
  // Der Client kennt `to: 'hero'` nicht und bricht sauber ab
  // (`if (!srcEl || !tgtEl) return;`) — die Optik liefert ohnehin die
  // eigene play_zone_animation des Abstiegs.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: CARD_NAME,
    from: 'hand', to: 'hero',
    fromHandIdx: handIdx, toHeroIdx: targetHeroIdx,
    asPlay: 'sole',
  });
  ps.hand.splice(handIdx, 1);
  if (handInst) {
    engine.cardInstances = engine.cardInstances.filter(c => c.id !== handInst.id);
  }

  engine.log('quetzahuitl_descent_begin', {
    player: ps.username,
    dyingHero: dyingHero.name,
    slot: targetHeroIdx,
  });

  // ── 2. Delete every Hero, plus every card in their Support and
  //       Ability Zones, sending the cards to the Deleted pile.
  //       Following Rain of Death's convention: fire
  //       `onCardLeaveZone` BEFORE mutating state so abilities
  //       like Toughness / Fighting can undo their granted bonuses
  //       before their inst is untracked. `_onlyCard: inst` keeps
  //       same-named siblings on unrelated heroes from misfiring.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const abZones = ps.abilityZones?.[hi];
    const supZones = ps.supportZones?.[hi];

    const heroInsts = engine.cardInstances.filter(c =>
      c.owner === pi && c.heroIdx === hi &&
      (c.zone === 'ability' || c.zone === 'support')
    );

    for (const inst of heroInsts) {
      await engine.runHooks('onCardLeaveZone', {
        _onlyCard: inst,
        card: inst,
        fromZone: inst.zone,
        fromOwner: inst.owner,
        fromHeroIdx: inst.heroIdx,
        fromZoneSlot: inst.zoneSlot,
        _skipReactionCheck: true,
      });
    }

    // Now mutate. Zone arrays preserve their slot structure
    // (3 ability slots; support zone count varies with islands but
    // we just clear each existing slot's contents).
    if (Array.isArray(abZones)) {
      for (let zi = 0; zi < abZones.length; zi++) {
        const slot = abZones[zi] || [];
        for (const name of slot) {
          if (!ps.deletedPile) ps.deletedPile = [];
          ps.deletedPile.push(name);
        }
        abZones[zi] = [];
      }
    }
    if (Array.isArray(supZones)) {
      for (let zi = 0; zi < supZones.length; zi++) {
        const slot = supZones[zi] || [];
        for (const name of slot) {
          if (!ps.deletedPile) ps.deletedPile = [];
          ps.deletedPile.push(name);
        }
        supZones[zi] = [];
      }
    }

    // Untrack every CardInstance attached to this hero — abilities,
    // supports, and the hero's own hero-zone inst all go. The hero
    // object itself is replaced (target slot) or blanked (other
    // slots) further down.
    engine.cardInstances = engine.cardInstances.filter(c => {
      if (c.owner !== pi) return true;
      if (c.heroIdx !== hi) return true;
      return c.zone !== 'ability' && c.zone !== 'support' && c.zone !== 'hero';
    });
  }

  // Blank out every hero slot. For the target slot we'll install
  // Quetzahuitl right after; the others become empty placeholders
  // (name=null, hp=0) so `checkAllHeroesDead` correctly sees them
  // as gone but Quetzahuitl alive.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero) continue;
    hero.name = null;
    hero.hp = 0;
    hero.maxHp = 0;
    hero.atk = 0;
    hero.baseAtk = 0;
    hero.ability1 = null;
    hero.ability2 = null;
    hero.statuses = {};
  }

  // ── 3. Install Quetzahuitl in the dying Hero's slot. ──
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME] || {};
  const baseHp  = cd.hp  || 200;
  const baseAtk = cd.atk || 200;

  ps.heroes[targetHeroIdx] = {
    name: CARD_NAME,
    hp: baseHp,
    maxHp: baseHp,
    atk: baseAtk,
    baseAtk: baseAtk,
    ability1: null,
    ability2: null,
    statuses: {},
  };
  if (!ps.abilityZones[targetHeroIdx]) ps.abilityZones[targetHeroIdx] = [[], [], []];
  if (!ps.supportZones[targetHeroIdx]) ps.supportZones[targetHeroIdx] = [[], [], []];

  engine._trackCard(CARD_NAME, pi, 'hero', targetHeroIdx);

  engine._broadcastEvent('play_zone_animation', {
    type: 'holy_revival', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
  });
  engine.log('quetzahuitl_arrival', {
    player: ps.username, slot: targetHeroIdx, hp: baseHp, atk: baseAtk,
  });
  engine.sync();
  await engine._delay(800);

  // ── 4. Attach up to 3 Divinity copies from deck / hand / discard. ──
  let attached = 0;
  for (let n = 0; n < 3; n++) {
    if (!engine.canAttachAbilityToHero(pi, DIVINITY, targetHeroIdx, { allowRestricted: true })) break;
    const pulledFrom = pullDivinityFromAnySource(ps);
    if (!pulledFrom) break;

    const abZones = ps.abilityZones[targetHeroIdx];
    const targetZone = pickDivinityZone(abZones);
    if (targetZone < 0) {
      // Out of room — refund the pulled copy back to where it came from.
      refundDivinity(engine, pi, pulledFrom);
      break;
    }

    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(DIVINITY);
    const divInst = engine._trackCard(DIVINITY, pi, 'ability', targetHeroIdx, targetZone);

    if (pulledFrom === 'deck') {
      engine._broadcastEvent('deck_search_add', { cardName: DIVINITY, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
    }

    await engine.runHooks('onPlay', {
      _onlyCard: divInst, playedCard: divInst, cardName: DIVINITY,
      zone: 'ability', heroIdx: targetHeroIdx, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: divInst, toZone: 'ability', toHeroIdx: targetHeroIdx,
      _skipReactionCheck: true,
    });
    engine._broadcastEvent('ability_activated', {
      owner: pi, heroIdx: targetHeroIdx, zoneIdx: targetZone, abilityName: DIVINITY,
    });
    attached++;
  }

  engine.log('quetzahuitl_divinity_attached', {
    player: ps.username, count: attached,
  });
  engine.sync();
}

function pullDivinityFromAnySource(ps) {
  // Order matches the card text "from your deck, hand or discard
  // pile" — but deck-first would force a shuffle reveal even when
  // a free hand copy is available, so prefer hand → deck → discard
  // to minimize information leakage. Switch to deck-first if the
  // user wants strict left-to-right text ordering.
  const fromHand = ps.hand.indexOf(DIVINITY);
  if (fromHand >= 0) { ps.hand.splice(fromHand, 1); return 'hand'; }
  const fromDeck = (ps.mainDeck || []).indexOf(DIVINITY);
  if (fromDeck >= 0) { ps.mainDeck.splice(fromDeck, 1); return 'deck'; }
  const fromDisc = (ps.discardPile || []).indexOf(DIVINITY);
  if (fromDisc >= 0) { ps.discardPile.splice(fromDisc, 1); return 'discard'; }
  return null;
}

function refundDivinity(engine, pi, source) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  if (source === 'hand') ps.hand.push(DIVINITY);
  else if (source === 'deck') { ps.mainDeck.push(DIVINITY); engine.shuffleDeck(pi, 'main'); }
  else if (source === 'discard') ps.discardPile.push(DIVINITY);
}

function pickDivinityZone(abZones) {
  // Stack onto an existing Divinity slot first (max 3 deep), else
  // use the first empty slot. Mirrors sacrifice-to-divinity.js's
  // auto-placement tie-breaker.
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length > 0 && slot[0] === DIVINITY && slot.length < 3) return z;
  }
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) return z;
  }
  return -1;
}

// ═══════════════════════════════════════════
//  HERO-ZONE LISTENER — loss on defeat
// ═══════════════════════════════════════════

function handleLossOnDefeat(ctx) {
  // Only fire when THIS card's own hero is the one dying. With
  // `activeIn: ['hero']`, `ctx.attachedHero` is the hero in our
  // slot — if that's the hero in the KO event, Quetzahuitl just
  // died and the controller loses.
  if (ctx.hero !== ctx.attachedHero) return;

  const engine = ctx._engine;
  const gs = engine.gs;
  if (gs.result) return;

  const pi = ctx.cardOwner;
  const winnerIdx = pi === 0 ? 1 : 0;
  engine.log('quetzahuitl_defeated', {
    loser: gs.players[pi]?.username,
    winner: gs.players[winnerIdx]?.username,
  });
  if (engine.onGameOver) {
    engine.onGameOver(engine.room, winnerIdx, 'quetzahuitl_defeated');
  }
}

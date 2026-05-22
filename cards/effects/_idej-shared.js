// ═══════════════════════════════════════════
//  SHARED HELPER: Idej archetype
//
//  The "Idej" package: 4 Idej Lord Heroes, 4 "Idej Blade" Equipment
//  Artifacts, 4 "Idej Sword" Equipment Artifacts, the "Idej Projection"
//  Attachment Spell, and the "Idej Projector" Reaction Artifact.
//
//  This module is the single source of truth for the archetype
//  predicates and the "attach an Idej Projection / equip an Idej
//  Blade into a free Support Zone slot of an Idej Hero" placement
//  used by the Lords' start-of-game effect and by Idej Projector.
//
//  Attachments / Equipment both occupy Support Zone slots (the engine
//  standard — see Prophecy of Tempeste), so an Idej Hero holds at most
//  3 attached cards. The Lords search "up to N", letting the player
//  leave a slot free for an Idej Sword.
// ═══════════════════════════════════════════

const IDEJ_ARCHETYPE = 'Idej';
const PROJECTION_NAME = 'Idej Projection';

/** Is `name` an "Idej" Hero (archetype Idej, Hero / Ascended Hero)? */
function isIdejHero(name, engine) {
  if (!name || !engine) return false;
  const cd = engine._getCardDB()[name];
  if (!cd) return false;
  if (cd.cardType !== 'Hero' && cd.cardType !== 'Ascended Hero') return false;
  return cd.archetype === IDEJ_ARCHETYPE;
}

/** Name-prefix predicates — the package's blades / swords. */
function isIdejBlade(name) {
  return typeof name === 'string' && name.startsWith('Idej Blade');
}
function isIdejSword(name) {
  return typeof name === 'string' && name.startsWith('Idej Sword');
}
function isIdejProjection(name) {
  return name === PROJECTION_NAME;
}

/** Free Support Zone slot indices (0-2) on a Hero. */
function freeSupportSlots(ps, heroIdx) {
  const sz = (ps?.supportZones || [])[heroIdx] || [];
  const out = [];
  for (let s = 0; s < 3; s++) {
    if (((sz[s] || []).length) === 0) out.push(s);
  }
  return out;
}

/** Does Hero `heroIdx` (controlled by `pi`) already hold an Idej Sword? */
function heroHasIdejSword(engine, pi, heroIdx) {
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== pi || inst.heroIdx !== heroIdx) continue;
    if (isIdejSword(inst.name)) return true;
  }
  return false;
}

/**
 * Place an Idej Projection / Blade into the first free Support Zone
 * slot of `heroIdx`, track it as a support-zone instance, and fire
 * onCardEnterZone. Returns the new instance, or null if no free slot.
 *
 * `opts.fromPile` ('deck' | 'hand' | 'discard') broadcasts a
 * `play_pile_transfer` so the card visibly flies from that pile into
 * the Support Zone slot.
 */
async function attachIdejCardToHero(engine, pi, heroIdx, cardName, opts = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
  const slots = freeSupportSlots(ps, heroIdx);
  if (slots.length === 0) return null;
  const slot = slots[0];
  ps.supportZones[heroIdx][slot] = [cardName];
  const inst = engine._trackCard(cardName, pi, 'support', heroIdx, slot);
  // Flight: the card visibly travels from its source pile into the slot.
  if (opts.fromPile) {
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName,
      from: opts.fromPile, to: 'support',
      toHeroIdx: heroIdx, toSlotIdx: slot,
    });
  }
  engine.sync();
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true,
  });
  return inst;
}

/**
 * Discard an attached Idej card (an Idej Projection used as a shield)
 * from its host Hero. Manual splice — NOT actionDestroyCard — because
 * this is a self-paid cost, not a destruction effect (Gate Shield /
 * Cardinal checks must not apply). Emits a zone-anchored
 * `play_pile_transfer` so the flight is correct even when a Hero holds
 * several identically-named Projections.
 */
async function discardAttachedIdejCard(engine, inst) {
  if (!inst) return;
  const gs = engine.gs;
  const ownerPs = gs.players[inst.owner];
  const heroIdx = inst.heroIdx;
  const slot = inst.zoneSlot;
  const name = inst.name;

  const zoneArr = ((ownerPs?.supportZones || [])[heroIdx] || [])[slot] || [];
  const zi = zoneArr.indexOf(name);
  if (zi >= 0) zoneArr.splice(zi, 1);

  engine._broadcastEvent('play_pile_transfer', {
    owner: inst.owner, cardName: name,
    from: 'support', to: 'discard',
    fromHeroIdx: heroIdx, fromSlotIdx: slot,
  });
  await engine.runHooks('onCardLeaveZone', {
    _onlyCard: inst, card: inst, leavingCard: inst,
    fromZone: 'support', fromHeroIdx: heroIdx, fromZoneSlot: slot,
    fromOwner: inst.owner, toZone: 'discard',
  });
  engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
  const discPs = gs.players[inst.originalOwner ?? inst.owner];
  if (discPs) {
    if (!discPs.discardPile) discPs.discardPile = [];
    discPs.discardPile.push(name);
  }
}

/**
 * Shared start-of-game routine for the 4 Idej Lords. Opens ONE gallery
 * picker over the controller's deck "Idej Projection" + "Idej Blade"
 * cards, with per-type caps (`caps.projections` / `caps.blades`) so
 * each type greys out once its quota is filled. The chosen cards then
 * fly from the deck into the Lord's Support Zone slots one by one.
 *
 * Each cap is clamped to the card text, the deck's available copies,
 * and the Lord's free Support slots.
 */
async function idejLordStartOfGame(ctx, caps) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const ps = gs.players[pi];
  if (!ps) return;
  const lordName = ps.heroes?.[heroIdx]?.name || 'Idej Lord';

  const free = freeSupportSlots(ps, heroIdx).length;
  if (free === 0) return;

  const projInDeck = (ps.mainDeck || []).filter(n => n === PROJECTION_NAME).length;
  const bladesInDeck = (ps.mainDeck || []).filter(n => isIdejBlade(n));

  const projCap = Math.min(caps.projections || 0, projInDeck, free);
  const bladeCap = Math.min(caps.blades || 0, bladesInDeck.length, free);
  if (projCap === 0 && bladeCap === 0) return;

  // ── Build ONE gallery: Projection entries (capped), then Blades ──
  // `cardTypes` / `typeLimits` drive the per-type grey-out client-side.
  const galleryCards = [];
  const cardTypes = {};
  for (let i = 0; i < projCap; i++) {
    cardTypes[galleryCards.length] = 'Projection';
    galleryCards.push({ name: PROJECTION_NAME, source: 'deck' });
  }
  if (bladeCap > 0) {
    for (const name of bladesInDeck) {
      cardTypes[galleryCards.length] = 'Blade';
      galleryCards.push({ name, source: 'deck' });
    }
  }
  const typeLimits = { Projection: projCap, Blade: bladeCap };
  const selectCount = Math.min(free, projCap + bladeCap);

  // Let the opening "you go first/second" announcement finish before
  // the first Idej prompt opens — once per game. Puzzle mode shows no
  // such announcement (app-board.jsx skips it for isPuzzle), so the
  // wait would be pure dead air there — skip it (matches Hel / Sid).
  if (!gs._idejOpeningDelayDone) {
    gs._idejOpeningDelayDone = true;
    engine.sync();
    if (!engine.isPuzzle) await engine._delay(3800);
  }
  gs.heroEffectPending = { ownerIdx: pi, heroName: lordName };
  engine.sync();

  const attached = [];
  try {
    const parts = [];
    if (projCap > 0) parts.push(`up to ${projCap} "Idej Projection"`);
    if (bladeCap > 0) parts.push(`up to ${bladeCap} "Idej Blade"`);

    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: galleryCards,
      cardTypes,
      typeLimits,
      selectCount,
      minSelect: 0,
      title: lordName,
      description: `Search your deck and attach ${parts.join(' and ')} card(s) to ${lordName}.`,
      confirmLabel: '⚔️ Attach!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    const picked = (result && !result.cancelled && Array.isArray(result.selectedCards))
      ? result.selectedCards : [];

    // Attach one at a time — each card flies from the deck into its
    // Support Zone slot, with a beat between so they land in sequence.
    for (let i = 0; i < picked.length; i++) {
      if (freeSupportSlots(ps, heroIdx).length === 0) break;
      const name = picked[i];
      const di = ps.mainDeck.indexOf(name);
      if (di < 0) continue;
      ps.mainDeck.splice(di, 1);
      const inst = await attachIdejCardToHero(engine, pi, heroIdx, name, { fromPile: 'deck' });
      if (inst) attached.push(name);
      else ps.mainDeck.push(name);
      if (i < picked.length - 1) await engine._delay(750);
    }

    if (attached.length > 0) {
      engine.shuffleDeck(pi, 'main');
      engine.log('idej_lord_setup', { player: ps.username, lord: lordName, attached });
    }
  } catch (err) {
    console.error('[Idej Lord] start-of-game error:', err.message);
  } finally {
    gs.heroEffectPending = null;
    engine.sync();
  }
}

/**
 * `canEquipToHero` body shared by every Idej Equip — only "Idej"
 * Heroes can be equipped. Falls back to the "Idej Lord " name prefix
 * when no engine reference is available for the archetype lookup.
 */
function canEquipToIdejHero(gs, pi, heroIdx, engine) {
  const hero = gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  const eng = engine || gs._engineRef;
  if (eng) return isIdejHero(hero.name, eng);
  return hero.name.startsWith('Idej Lord ');
}

/**
 * Factory for the 4 "Idej Blade" Equipment Artifacts. Each Blade
 * reduces one Magic school's level by 1 for Spells the equipped Idej
 * Hero casts — the Taio-the-Sun-Fencer per-instance / per-casting-Hero
 * `reduceCardLevel` pattern. `school` is the cards.json spellSchool
 * string (e.g. 'Decay Magic').
 */
function makeIdejBlade(school) {
  return {
    activeIn: ['support'],
    canEquipToHero(gs, pi, heroIdx, engine) {
      return canEquipToIdejHero(gs, pi, heroIdx, engine);
    },
    // The engine walks every active instance the controller owns and
    // sums each `reduceCardLevel`. We rebate 1 only for Spells of
    // `school` cast by the exact Hero THIS Blade is equipped to —
    // `heroIdx` is the casting Hero, `inst.heroIdx` the equipped one.
    reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx) {
      if (!cardData || cardData.cardType !== 'Spell') return 0;
      if (heroIdx == null || !inst || heroIdx !== inst.heroIdx) return 0;
      if (cardData.spellSchool1 !== school && cardData.spellSchool2 !== school) return 0;
      return 1;
    },
  };
}

module.exports = {
  IDEJ_ARCHETYPE,
  PROJECTION_NAME,
  isIdejHero,
  isIdejBlade,
  isIdejSword,
  isIdejProjection,
  freeSupportSlots,
  heroHasIdejSword,
  canEquipToIdejHero,
  attachIdejCardToHero,
  discardAttachedIdejCard,
  idejLordStartOfGame,
  makeIdejBlade,
};

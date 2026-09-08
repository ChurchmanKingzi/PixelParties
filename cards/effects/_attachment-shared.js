// ═══════════════════════════════════════════
//  GETEILT: Attachment-Spells anlegen — DIE eine Auslegung (v650)
//
//  Ein Spell mit Subtyp „Attachment" bleibt nach dem Guss in einer
//  Support Zone liegen. Bis v649 baute jede Karte den Vorgang selbst
//  nach (13 Kopien, zwei davon ohne Anti-Magic-Pruefung, nur eine mit
//  den Drop-Hinweisen des Servers). Jetzt gibt es drei Bausteine, aus
//  denen jedes Attachment seinen `onPlay` zusammensetzt:
//
//    pickAttachmentHost(ctx, CARD_NAME, opts) → { owner, heroIdx, slotIdx } | null
//      Wer TRAEGT die Karte? Baut die Zielliste (Seiten ueber
//      `opts.sides`, Helden ueber `opts.heroFilter(hero, hi, side)`),
//      liest die Drop-Hinweise des Servers (`gs._attachmentHeroIdx` /
//      `gs._attachmentZoneSlot` — beim Ziehen auf Held oder Zone),
//      entscheidet automatisch, wenn nur ein Platz in Frage kommt, und
//      fragt sonst per Prompt (Held = linkester freier Platz, oder eine
//      konkrete Zone). Setzt bei Abbruch `gs._spellCancelled` (die Karte
//      geht zurueck auf die Hand) und gibt null zurueck.
//
//    placeAttachment(ctx, CARD_NAME, host, opts) → inst | null
//      Legt die Karte in die Zone: Anti-Magic-Schutz des Wirts
//      (`_isHeroSpellProtected`, ueberspringbar mit
//      `opts.skipMagicImmune`), Zone-Push (bei belegtem Wunschplatz der
//      naechste freie), Hand-Instanz austragen, Instanz in der Support
//      Zone tracken (Besitzer = WIRT-Seite, `originalOwner` = Caster —
//      das ist das Modell, das die bestehenden Attachments nutzen),
//      `gs._spellPlacedOnBoard` (sonst schickt doPlaySpell den Spell in
//      den Discard), optionaler Auftritt, `onCardEnterZone`.
//
//    attachToHero(ctx, CARD_NAME, opts) → { host, inst } | null
//      Beides hintereinander — der Normalfall ohne Zwischenlogik.
//
//    attachmentHostsFor(gs, pi, engine, opts) → [{ heroIdx, slotIdx }]
//      Empfaenger-Zonen fuers Ziehen (Engine-Vertrag `attachmentHosts`);
//      dieselbe Zielliste wie der Picker, nur EIGENE Seite (der Client
//      hebt fremde Zonen ueber diesen Vertrag nicht hervor).
//
//  Vertrag fuer die Karte: `activeIn` muss 'hand' enthalten (sonst
//  feuert `onPlay` nicht), und ein `spellPlayCondition`, das
//  `attachmentHostsFor(...).length > 0` prueft, haelt die Karte grau,
//  wenn kein Platz frei ist.
// ═══════════════════════════════════════════

function freeSlots(ps, heroIdx) {
  const slots = ps?.supportZones?.[heroIdx] || [];
  const out = [];
  for (let si = 0; si < 3; si++) if (!slots[si] || slots[si].length === 0) out.push(si);
  return out;
}

/** Alle in Frage kommenden Plaetze: [{ side, heroIdx, slotIdx }]. */
function candidateHosts(gs, pi, engine, opts = {}) {
  const sides = opts.sides || [pi];
  const out = [];
  for (const side of sides) {
    const ps = gs.players[side];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (opts.heroFilter && !opts.heroFilter(h, hi, side, engine)) continue;
      for (const si of freeSlots(ps, hi)) out.push({ side, heroIdx: hi, slotIdx: si });
    }
  }
  return out;
}

/**
 * Empfaenger-Zonen fuer den Engine-Vertrag `attachmentHosts` (Drop-
 * Hervorhebung). Standard: eigene Seite. Mit `opts.sides` (z.B.
 * `[oppIdx]` fuer Overheal Shock, `[pi, oppIdx]` fuer Berserk) tragen die
 * Eintraege `owner` — der Client bietet dann auch gegnerische Zonen und
 * Helden als Drop-Ziel an (v651).
 */
function attachmentHostsFor(gs, pi, engine, opts = {}) {
  const sides = opts.sides || [pi];
  return candidateHosts(gs, pi, engine, { ...opts, sides }).map(h => ({ owner: h.side, heroIdx: h.heroIdx, slotIdx: h.slotIdx }));
}

async function pickAttachmentHost(ctx, CARD_NAME, opts = {}) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const hosts = candidateHosts(gs, pi, engine, opts);
  if (hosts.length === 0) { gs._spellCancelled = true; return null; }

  // 1) Drop-Hinweis des Servers: auf Held (und ggf. Zone) gezogen —
  //    `gs._attachmentOwner` nennt die Seite (v651), Standard eigene Seite.
  const hintHero = gs._attachmentHeroIdx;
  if (hintHero != null && hintHero >= 0) {
    const wanted = gs._attachmentZoneSlot;
    const hintSide = (gs._attachmentOwner === 0 || gs._attachmentOwner === 1) ? gs._attachmentOwner : pi;
    const exact = hosts.find(h => h.side === hintSide && h.heroIdx === hintHero && wanted != null && wanted >= 0 && h.slotIdx === wanted);
    const any = hosts.find(h => h.side === hintSide && h.heroIdx === hintHero);
    const hit = exact || any;
    if (hit) return { owner: hit.side, heroIdx: hit.heroIdx, slotIdx: hit.slotIdx };
  }
  // 2) Caster-Held als Standard, wenn gewuenscht und moeglich
  if (opts.preferCaster) {
    const hit = hosts.find(h => h.side === pi && h.heroIdx === ctx.cardHeroIdx);
    if (hit) return { owner: hit.side, heroIdx: hit.heroIdx, slotIdx: hit.slotIdx };
  }
  // 3) Genau ein Held mit genau einem Platz → automatisch
  const byHero = new Map();
  for (const h of hosts) { const k = `${h.side}-${h.heroIdx}`; if (!byHero.has(k)) byHero.set(k, []); byHero.get(k).push(h); }
  if (byHero.size === 1 && hosts.length === 1) return { owner: hosts[0].side, heroIdx: hosts[0].heroIdx, slotIdx: hosts[0].slotIdx };
  // 4) Prompt: Helden (linkester freier Platz) und konkrete Zonen
  const targets = [];
  for (const [, list] of byHero) {
    const { side, heroIdx } = list[0];
    for (const h of list) targets.push({ id: `equip-${side}-${heroIdx}-${h.slotIdx}`, type: 'equip', owner: side, heroIdx, slotIdx: h.slotIdx, cardName: '' });
    targets.push({ id: `hero-${side}-${heroIdx}`, type: 'hero', owner: side, heroIdx, cardName: gs.players[side].heroes[heroIdx].name, _autoSlot: list[0].slotIdx });
  }
  const result = await engine.promptEffectTarget(pi, targets, {
    title: CARD_NAME,
    description: opts.description || `Choose a Hero (leftmost free Support Zone) or a specific empty Support Zone to attach ${CARD_NAME} to.`,
    confirmLabel: opts.confirmLabel || '📎 Attach!', confirmClass: opts.confirmClass || 'btn-success',
    cancellable: opts.cancellable !== false, exclusiveTypes: true, maxPerType: { hero: 1, equip: 1 }, maxTotal: 1, greenSelect: true,
    ...(opts.promptExtras || {}),
  });
  if (!result || result.length === 0) { gs._spellCancelled = true; return null; }
  const picked = targets.find(t => t.id === result[0]);
  if (!picked) { gs._spellCancelled = true; return null; }
  return { owner: picked.owner, heroIdx: picked.heroIdx, slotIdx: picked.type === 'hero' ? picked._autoSlot : picked.slotIdx };
}

async function placeAttachment(ctx, CARD_NAME, host, opts = {}) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const hps = gs.players[host.owner];
  const hero = hps?.heroes?.[host.heroIdx];
  if (!hero?.name || hero.hp <= 0) return null;
  if (!opts.skipMagicImmune && engine._isHeroSpellProtected(hero, CARD_NAME)) {
    engine.log('attach_blocked', { card: CARD_NAME, target: hero.name, reason: 'magic_immune' });
    engine._playAntiMagicBlockedAnim(hero);
    return null;
  }
  if (!hps.supportZones[host.heroIdx]) hps.supportZones[host.heroIdx] = [[], [], []];
  let slot = host.slotIdx;
  if ((hps.supportZones[host.heroIdx][slot] || []).length > 0) {
    const free = freeSlots(hps, host.heroIdx);
    if (free.length === 0) return null;
    slot = free[0];
  }
  if (!hps.supportZones[host.heroIdx][slot]) hps.supportZones[host.heroIdx][slot] = [];
  hps.supportZones[host.heroIdx][slot].push(CARD_NAME);
  const oldInst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME);
  if (oldInst) engine._untrackCard(oldInst.id);
  const inst = engine._trackCard(CARD_NAME, host.owner, 'support', host.heroIdx, slot);
  inst.originalOwner = pi;
  inst.turnPlayed = gs.turn || 0;
  gs._spellPlacedOnBoard = true;
  // v651 (Als Befund): die Karte verlaesst die Hand JETZT — nicht erst,
  // wenn der Server nach `onPlay` aufraeumt (die Handkopie blieb sonst bis
  // zum Ende des Auftritts sichtbar). Der Server findet danach keine
  // aufzuloesende Handkarte mehr (`_resolvingCard` geloescht) und laesst
  // den Slot in Ruhe.
  const ps = gs.players[pi];
  if (ps?._resolvingCard?.name === CARD_NAME) {
    const pool = ps._resolvingCard.fromCreation ? ps.creationZone : ps.hand;
    const hi = (pool || []).indexOf(CARD_NAME);
    if (hi >= 0) { pool.splice(hi, 1); engine.notePlayedFromHand?.(pi); }
    ps._resolvingCard = null;
  }
  engine.sync();
  if (opts.animationType) {
    engine._broadcastEvent('play_zone_animation', { type: opts.animationType, owner: host.owner, heroIdx: host.heroIdx, zoneSlot: opts.animOnHero ? -1 : slot });
  }
  engine.log('attachment_placed', { card: CARD_NAME, player: gs.players[pi]?.username, hero: hero.name, side: host.owner, heroIdx: host.heroIdx, zoneSlot: slot });
  if (!opts.skipEnterHook) {
    await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx, _skipReactionCheck: true });
  }
  engine.sync();
  return inst;
}

async function attachToHero(ctx, CARD_NAME, opts = {}) {
  const host = await pickAttachmentHost(ctx, CARD_NAME, opts);
  if (!host) return null;
  const inst = await placeAttachment(ctx, CARD_NAME, host, opts);
  return inst ? { host, inst } : null;
}

module.exports = { freeSlots, candidateHosts, attachmentHostsFor, pickAttachmentHost, placeAttachment, attachToHero };

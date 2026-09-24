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
  const alle = candidateHosts(gs, pi, engine, opts);
  // ★★ v1143b (Al 17.9., „Forbidden Curse of Aging"): zwei weiche Stufen
  // NEBEN dem harten `heroFilter`:
  //   • `opts.heroDim(hero, hi, side)`    → Held bleibt SICHTBAR, aber
  //     ausgegraut und nicht waehlbar (`t.ineligible`);
  //   • `opts.heroAccent(hero, hi, side)` → Hervorhebungsfarbe des Ziels
  //     (`t.accent`, z.B. 'green': „dieses Ziel macht den Einsatz zur
  //     Zusatz-Aktion").
  const gedimmt = (h) => !!opts.heroDim?.(gs.players[h.side]?.heroes?.[h.heroIdx], h.heroIdx, h.side, engine);
  const hosts = alle.filter(h => !gedimmt(h));
  if (hosts.length === 0) { gs._spellCancelled = true; return null; }

  // 1) Drop-Hinweis des Servers: auf Held (und ggf. Zone) gezogen —
  //    `gs._attachmentOwner` nennt die Seite (v651), Standard eigene Seite.
  // ★★ v1143b: `opts.ignoreDropHints` — der Drop bestimmt bei solchen
  // Karten den WIRKER, nicht den Wirt (Als Vorgabe 17.9.: „Drag/Drop NUR
  // auf moegliche Caster, DAS oeffnet dann die Zielauswahl").
  const hintHero = opts.ignoreDropHints ? null : gs._attachmentHeroIdx;
  const wanted = opts.ignoreDropHints ? null : gs._attachmentZoneSlot;
  const hintSide = (gs._attachmentOwner === 0 || gs._attachmentOwner === 1) ? gs._attachmentOwner : pi;
  if (hintHero != null && hintHero >= 0) {
    const exact = hosts.find(h => h.side === hintSide && h.heroIdx === hintHero && wanted != null && wanted >= 0 && h.slotIdx === wanted);
    const any = hosts.find(h => h.side === hintSide && h.heroIdx === hintHero);
    const hit = exact || any;
    if (hit) return { owner: hit.side, heroIdx: hit.heroIdx, slotIdx: hit.slotIdx };
  }
  // ★ SLOT-HINWEIS OHNE HELDEN-HINWEIS (v856, Als Befund zu Intrude) ──
  // Der Client schickt `attachHeroIdx` NUR fuer Karten, die den Vertrag
  // `attachmentHosts` deklarieren — `attachmentZoneSlot` dagegen immer.
  // Drei Anlege-Zauber haben den Vertrag nicht (Intrude, Anti Magic
  // Enchantment, Idej Projection); bei ihnen fiel die ganze Hinweis-
  // Stufe aus, weil sie am fehlenden Helden-Hinweis haengt, und Schritt
  // 2 legte auf den linkesten freien Platz — egal, wohin gezogen wurde.
  // Ein Slot-Hinweis allein ist eindeutig genug, sobald er mit dem
  // Caster-Helden zusammen einen gueltigen Platz ergibt.
  if ((hintHero == null || hintHero < 0) && wanted != null && wanted >= 0) {
    const beimCaster = hosts.find(h => h.side === pi && h.heroIdx === ctx.cardHeroIdx && h.slotIdx === wanted);
    if (beimCaster) return { owner: beimCaster.side, heroIdx: beimCaster.heroIdx, slotIdx: beimCaster.slotIdx };
  }
  // 2) Caster-Held als Standard, wenn gewuenscht und moeglich.
  // ★ v1364 (Als Befund Sticky Wand): NICHT im Sofort-Guss
  // (`_immediateActionContext` — Sticky Wand, Yukana, Coffee …). Dort gibt
  // es keinen Drop, der den Wirt ausdrueckt; der Caster als stiller
  // Standard nahm dem Spieler die Wahl. Dann fragt Schritt 4.
  if (opts.preferCaster && !gs._immediateActionContext) {
    const hit = hosts.find(h => h.side === pi && h.heroIdx === ctx.cardHeroIdx);
    if (hit) return { owner: hit.side, heroIdx: hit.heroIdx, slotIdx: hit.slotIdx };
  }
  // 3) Genau ein Held mit genau einem Platz → automatisch
  const byHero = new Map();
  for (const h of hosts) { const k = `${h.side}-${h.heroIdx}`; if (!byHero.has(k)) byHero.set(k, []); byHero.get(k).push(h); }
  if (byHero.size === 1 && hosts.length === 1 && alle.length === hosts.length) return { owner: hosts[0].side, heroIdx: hosts[0].heroIdx, slotIdx: hosts[0].slotIdx };
  // Ausgegraute Helden kommen fuer die ANZEIGE dazu (hinter die waehlbaren).
  for (const h of alle) {
    if (!gedimmt(h)) continue;
    const k = `${h.side}-${h.heroIdx}`;
    if (!byHero.has(k)) byHero.set(k, []);
    byHero.get(k).push({ ...h, _gedimmt: true });
  }
  // 4) Prompt: Helden (linkester freier Platz) und konkrete Zonen
  const targets = [];
  for (const [, list] of byHero) {
    const { side, heroIdx } = list[0];
    const zusatz = {};
    if (list[0]._gedimmt) zusatz.ineligible = true;
    const akzent = opts.heroAccent?.(gs.players[side]?.heroes?.[heroIdx], heroIdx, side, engine);
    if (akzent && !zusatz.ineligible) zusatz.accent = akzent;
    for (const h of list) targets.push({ id: `equip-${side}-${heroIdx}-${h.slotIdx}`, type: 'equip', owner: side, heroIdx, slotIdx: h.slotIdx, cardName: '', ...zusatz });
    targets.push({ id: `hero-${side}-${heroIdx}`, type: 'hero', owner: side, heroIdx, cardName: gs.players[side].heroes[heroIdx].name, _autoSlot: list[0].slotIdx, ...zusatz });
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
  if (!picked || picked.ineligible) { gs._spellCancelled = true; return null; }
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

// ═══════════════════════════════════════════
//  ★★ v1143 — ANHAENGSEL, DIE EINEN STATUS TRAGEN
//
//  „Forbidden Curse of Aging\" (`aged`) und „Decisive Defeat\"
//  (`negated`) legen einen ECHTEN Status an, der genau so lange lebt wie
//  die Karte. Beide bauten das Aufraeumen bisher selbst — und Decisive
//  Defeat pruefte dabei nicht, WELCHE Karte die Zone verlaesst:
//  `ctx.card` ist im Hook die LAUSCHENDE Karte, die gehende steht in
//  `ctx.leavingCard`. Verliess irgendeine andere Karte irgendeine Zone,
//  nahm Decisive Defeat seine Negierung zurueck.
//
//    setzeAnhaengselStatus(engine, owner, heroIdx, CARD_NAME, STATUS)
//      Legt den Status am Wirt an, markiert mit `_fromAttachment`.
//
//    anhaengselStatusHooks(CARD_NAME, STATUS, { heilenWirftAb })
//      → { onCardEnterZone, onCardLeaveZone, onStatusRemoved? }
//      • Eintritt in eine Support Zone: Status anlegen (auch nach einem
//        Umzug an einen anderen Helden).
//      • Austritt: Status nehmen, wenn keine zweite Kopie mehr am Wirt
//        haengt.
//      • `heilenWirftAb: true` — wird der Status entfernt (Cleanse,
//        Einzelentfernung), gehen alle Kopien am Wirt in die Ablage
//        ihres URSPRUENGLICHEN Besitzers. Bis dahin wirken sie schon
//        nicht mehr (`engine._attachmentStatusHaelt`).
// ═══════════════════════════════════════════

function setzeAnhaengselStatus(engine, owner, heroIdx, CARD_NAME, STATUS_NAME) {
  const wirt = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!wirt?.name || wirt.hp <= 0) return false;
  if (!wirt.statuses) wirt.statuses = {};
  wirt.statuses[STATUS_NAME] = {
    permanent: true,
    appliedTurn: engine.gs.turn || 0,
    _fromAttachment: CARD_NAME,
  };
  return true;
}

function kopienAmWirt(engine, CARD_NAME, owner, heroIdx, ausser) {
  return (engine.cardInstances || []).filter(c =>
    c !== ausser && c.name === CARD_NAME && c.zone === 'support'
    && c.owner === owner && c.heroIdx === heroIdx && !c.faceDown);
}

function anhaengselStatusHooks(CARD_NAME, STATUS_NAME, optionen = {}) {
  const hooks = {
    onCardEnterZone: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME) return;
      if (ctx.enteringCard?.id !== inst.id) return;
      if (ctx.toZone && ctx.toZone !== 'support') return;
      if (inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const wirt = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
      if (!wirt?.name || wirt.statuses?.[STATUS_NAME]) return;
      setzeAnhaengselStatus(engine, inst.owner, inst.heroIdx, CARD_NAME, STATUS_NAME);
      engine.sync();
    },

    onCardLeaveZone: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME) return;
      // ★ Nur die EIGENE Karte — einige Austrittswege tragen nur `_onlyCard`.
      const gehend = ctx.leavingCard || ctx._onlyCard;
      if (gehend?.id !== inst.id) return;
      if (ctx.fromZone && ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const owner = ctx.fromOwner ?? inst.owner;
      const heroIdx = ctx.fromHeroIdx ?? inst.heroIdx;
      const wirt = engine.gs.players[owner]?.heroes?.[heroIdx];
      if (!wirt?.statuses?.[STATUS_NAME]) return;
      if (wirt.statuses[STATUS_NAME]._fromAttachment !== CARD_NAME) return;
      if (kopienAmWirt(engine, CARD_NAME, owner, heroIdx, inst).length > 0) return;
      // Direkt statt `removeHeroStatus`: kein `onStatusRemoved`, sonst
      // liefe `heilenWirftAb` gegen die Karte, die ohnehin schon geht.
      delete wirt.statuses[STATUS_NAME];
      engine.log('status_remove', { target: wirt.name, status: STATUS_NAME, by: CARD_NAME });
      engine.sync();
    },
  };

  if (optionen.heilenWirftAb) {
    hooks.onStatusRemoved = async (ctx) => {
      if (ctx.status !== STATUS_NAME) return;
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const wirt = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];
      if (!wirt) return;
      // Nur der eigene Wirt — `actionRemoveStatus` liefert keine
      // Koordinaten, also ueber das Heldenobjekt selbst.
      const passt = ctx.target
        ? ctx.target === wirt
        : (ctx.heroOwner === inst.owner && ctx.heroIdx === inst.heroIdx);
      if (!passt || wirt.statuses?.[STATUS_NAME]) return;
      // ★★ v1168: Wird der Status UEBERTRAGEN (Tea), zieht die Karte mit
      // um statt abzufallen. Der uebertragende Effekt setzt die Marke vor
      // dem Heilen und raeumt sie danach wieder ab.
      if (inst.counters?._anhaengselZiehtUm) return;
      // Alle Kopien hoeren denselben Hook; die erste raeumt ab, die
      // uebrigen finden nichts mehr (sie selbst stehen nicht mehr im
      // Support).
      for (const kopie of [inst, ...kopienAmWirt(engine, CARD_NAME, inst.owner, inst.heroIdx, inst)]) {
        if (kopie.zone !== 'support') continue;
        engine.log('status_remove', { target: kopie.name, status: 'attachment', by: STATUS_NAME });
        // ★★ v1143b: sichtbar — der EINE Brett→Ablage-Weg mit Flug.
        await engine.sendBoardCardToDiscard(kopie, { source: { name: STATUS_NAME } });
      }
      engine.sync();
    };
  }
  return hooks;
}

module.exports = {
  freeSlots, candidateHosts, attachmentHostsFor, pickAttachmentHost, placeAttachment, attachToHero,
  setzeAnhaengselStatus, anhaengselStatusHooks,
};

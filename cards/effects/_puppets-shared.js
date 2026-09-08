// ═══════════════════════════════════════════
//  SHARED HANDLER: Puppets-Archetyp (v704)
//  Tri Fecta, the Puppet Master / Tri Ad, the
//  Puppet Mistress + sechs Puppet-Tokens
//
//  EINZIGE Auslegungsstelle fuer:
//    • die Token-Paare (Tri-Fecta-Satz ↔ Tri-Ad-Satz)
//    • den Tausch beim Auflegen/Zuruecknehmen
//      von Tri Ad (stiller Austausch am Platz,
//      pro Token eine eigene Animation — Als
//      Vorgabe 2.9.)
//    • die gemeinsamen Token-Flags (Engine-
//      Vertraege v704: choosableAsCreature,
//      sharesHpWithHero, cannotChangeSupportZone)
//    • die Aktivsperre „No other Token in the
//      corresponding Hero's Support Zones can use
//      its active effect for the rest of the turn"
//    • „When this Hero has no Tokens in its
//      Support Zones, it is immediately defeated"
//    • die Zonensperre der beiden Helden
//    • „Alle Puppets, die etwas fuer Creatures
//      tun, tun das AUCH fuer andere Puppets"
//      (Als Ruling 2.9.) → collectAllyTargets
//
//  Als Rulings (2.9., bindend):
//    • Tri Ad ist ein NORMALER Hero (nur im Main
//      Deck), KEIN Ascended Hero — keine der
//      beiden Formen zaehlt als Ascended
//    • Auflegen/Zuruecknehmen: kostenlos in der
//      Main Phase, keine Action, EIN gemeinsames
//      HOPT
//    • Tausch: kein Discard/Deleted, keine
//      Todes-Trigger, Counter+HOPT des alten
//      Tokens verfallen, das neue ist sofort
//      nutzbar
//    • Tokens sind Ziel fuer Einzelziele,
//      Angriffe, „target a Creature" und
//      „any target"-AoE — NICHT fuer „all
//      Creatures"
//    • Start-Tokens sind in Zug 1 aktivierbar
// ═══════════════════════════════════════════

const { hasCardType, ZONES } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const TRI_FECTA = 'Tri Fecta, the Puppet Master';
const TRI_AD    = 'Tri Ad, the Puppet Mistress';

const SHISHI = 'Destructive Puppet Shishi';
const BRAMMI = 'Creative Puppet Brammi';
const VINNY  = 'Preserving Puppet Vinny';
const PAVI   = 'Loving Puppet Pavi';
const SARAS  = 'Clever Puppet Saras';
const LAKI   = 'Lucky Puppet Laki';

/** Tri Fectas Startsatz — Reihenfolge = Slot 0..2. */
const FECTA_SET = [SHISHI, BRAMMI, VINNY];
/** Tausch-Paare: Fecta-Token → Ad-Token und zurueck. */
const TO_AD    = { [SHISHI]: PAVI, [BRAMMI]: SARAS, [VINNY]: LAKI };
const TO_FECTA = { [PAVI]: SHISHI, [SARAS]: BRAMMI, [LAKI]: VINNY };
const ALL_TOKENS = new Set([...FECTA_SET, PAVI, SARAS, LAKI]);
const PUPPET_HEROES = new Set([TRI_FECTA, TRI_AD]);

/**
 * Tausch-Animation je NEUEM Token — eigene Alias-Typen (Client
 * ANIM_REGISTRY + ZONE_ANIM_SFX, v706), damit jedes Token seinen EIGENEN,
 * lauten Klang hat (Als Befund: die alten Zonen-Animationen klangen zu
 * leise/subtil).
 */
const SWAP_ANIM = {
  [SHISHI]: 'puppet_swap_shishi',
  [BRAMMI]: 'puppet_swap_brammi',
  [VINNY]:  'puppet_swap_vinny',
  [PAVI]:   'puppet_swap_pavi',
  [SARAS]:  'puppet_swap_saras',
  [LAKI]:   'puppet_swap_laki',
};
const SWAP_MS = 520;
/** Counter, die den Tausch ueberleben (Al 3.9.: Preserve — Luck analog). */
const PERSISTENT_COUNTERS = ['preserve', 'luck'];

function isPuppetToken(name) { return ALL_TOKENS.has(name); }

/** Gemeinsames HOPT von Auflegen (Tri Ad) und Zuruecknehmen — Als Ruling 2. */
const TRI_AD_HOPT_KEY = (pi) => `puppets:tri-ad-swap:${pi}`;
function triAdHoptFree(gs, pi) { return gs.hoptUsed?.[TRI_AD_HOPT_KEY(pi)] !== gs.turn; }
function stampTriAdHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[TRI_AD_HOPT_KEY(pi)] = gs.turn;
}
function isPuppetHero(name)  { return PUPPET_HEROES.has(name); }

/**
 * Gemeinsame Skript-Flags aller Puppet-Tokens (Engine-Vertraege v704).
 * Jedes Token-Skript spreadet sie in seinen Export.
 */
const PUPPET_TOKEN_BASE = {
  activeIn: ['support'],
  // „can still be chosen like one" — Zielwaehler, Aktivierungsliste,
  // „any target"-AoE.
  choosableAsCreature: true,
  // „This Hero and Tokens in its Support Zones share 1 HP pool".
  sharesHpWithHero: true,
  // „Cannot be moved to a different Support Zone."
  cannotChangeSupportZone: true,
  // Tokens verlassen das Brett nur per Zerstoerung — keine HP-Anzeige.
  creatureEffect: true,
  // Strukturelle Hooks (Abgang → Niederlage-Pruefung) laufen auch
  // gestunnt/negiert und bei totem Spaltenhelden.
  bypassStatusFilter: true,
  bypassDeadHeroFilter: true,
};

/**
 * Gemeinsame Hooks aller Puppet-Tokens — jedes Token-Skript spreadet sie
 * in sein `hooks`. Zweites Netz zur Helden-Seite: der Abgang eines Tokens
 * wird von der Token-Instanz SELBST gemeldet (auch auf `_onlyCard`-Pfaden,
 * die den Helden nicht erreichen).
 */
const PUPPET_TOKEN_HOOKS = {
  onCardLeaveZone: async (ctx) => {
    const engine = ctx._engine;
    const me = ctx.card;
    const leaving = ctx.leavingCard || me;
    if (!me || leaving?.id !== me.id) return;   // nur der eigene Abgang
    if (ctx.fromZone && ctx.fromZone !== ZONES.SUPPORT) return;
    const pi = ctx.fromOwner ?? (me.controller ?? me.owner);
    const hi = ctx.fromHeroIdx ?? me.heroIdx;
    await checkPuppetHeroDefeat(engine, pi, hi, { name: me.name, owner: pi, heroIdx: hi }, me.id);
  },
};

// ── Aktivsperre ────────────────────────────────────────────────────
function lockKey(pi, heroIdx) { return `${pi}-${heroIdx}`; }

/** Hat in dieser Spalte diesen Zug schon ein ANDERES Token aktiviert? */
function isPuppetActiveLocked(engine, pi, heroIdx, instId) {
  const gs = engine.gs;
  const lock = gs._puppetActiveLock?.[lockKey(pi, heroIdx)];
  if (!lock || lock.turn !== gs.turn) return false;
  return lock.instId !== instId;
}

/** Nach einer Aktivierung: alle anderen Tokens der Spalte fuer den Zug sperren. */
function lockPuppetActives(engine, pi, heroIdx, instId) {
  const gs = engine.gs;
  if (!gs._puppetActiveLock) gs._puppetActiveLock = {};
  gs._puppetActiveLock[lockKey(pi, heroIdx)] = { turn: gs.turn, instId };
  engine.log('puppet_actives_locked', {
    player: gs.players[pi]?.username, heroIdx, by: engine.cardInstances.find(c => c.id === instId)?.name || null,
  });
}

/**
 * Laeuft in dieser Spalte gerade der Formwechsel? Zwei Quellen:
 *  • `gs._puppetSwapInProgress` — gesetzt vom Tausch selbst (und von Tri
 *    Ads Rueckweg VOR performDescend);
 *  • `gs._formChangeInProgress` — generischer Engine-Stempel ab dem
 *    Identitaetswechsel in performAscension (v707), deckt Flourish +
 *    Wartezeit VOR dem Tausch ab. Nur gueltig im selben Zug (Rueckfall
 *    gegen liegengebliebene Stempel).
 */
function isPuppetSwapInProgress(engine, pi, heroIdx) {
  const gs = engine.gs;
  const key = lockKey(pi, heroIdx);
  if (gs._puppetSwapInProgress?.[key]) return true;
  const fc = gs._formChangeInProgress?.[key];
  return !!fc && fc.turn === gs.turn;
}

/** Sperre der Spalte von aussen setzen/loesen (Tri Ads Rueckweg). */
function setPuppetSwapLock(engine, pi, heroIdx, on) {
  const gs = engine.gs;
  if (!gs._puppetSwapInProgress) gs._puppetSwapInProgress = {};
  if (on) gs._puppetSwapInProgress[lockKey(pi, heroIdx)] = true;
  else delete gs._puppetSwapInProgress[lockKey(pi, heroIdx)];
}

/**
 * Glanz + Klang auf dem Token OHNE Wartezeit (Al 3.9.: kein spuerbarer
 * Verzug vor dem Prompt). `effectSourceGlow` wartet 500 ms; hier reist
 * der Glanz mit Koordinaten direkt raus.
 */
function puppetGlow(engine, pi, inst, sfx = 'ability_activate') {
  if (!inst) return;
  engine._broadcastEvent('effect_source_glow', {
    playerIdx: pi, cardName: inst.name, origin: 'board', sfx,
    zone: inst.zone, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
}

/** Gemeinsamer Aktivierungs-Gate aller Token-Aktiven. */
function canUsePuppetActive(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== ZONES.SUPPORT) return false;
  const pi = ctx.cardOwner;
  // Waehrend der Tausch-Animation sind ALLE Puppets gesperrt (Al 3.9.).
  if (isPuppetSwapInProgress(engine, pi, inst.heroIdx)) return false;
  const hero = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (isPuppetActiveLocked(engine, pi, inst.heroIdx, inst.id)) return false;
  return true;
}

// ── Tokens der Spalte ──────────────────────────────────────────────
function puppetTokensInColumn(engine, pi, heroIdx, opts = {}) {
  return engine.cardInstances.filter(c =>
    (c.controller ?? c.owner) === pi && c.zone === ZONES.SUPPORT
    && c.heroIdx === heroIdx && isPuppetToken(c.name)
    && (!opts.excludeId || c.id !== opts.excludeId));
}

/**
 * „When this Hero has no Tokens in its Support Zones, it is immediately
 * defeated." — nach jedem Token-Abgang aus der Spalte pruefen.
 * `excludeId`: die gerade abgehende Instanz (der Hook feuert VOR dem
 * Splice der Zone).
 */
async function checkPuppetHeroDefeat(engine, pi, heroIdx, source, excludeId) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0 || !isPuppetHero(hero.name)) return false;
  if (puppetTokensInColumn(engine, pi, heroIdx, { excludeId }).length > 0) return false;
  engine.log('puppet_hero_no_tokens', { hero: hero.name, player: engine.gs.players[pi]?.username });
  await engine.actionDefeatHero(source || { name: hero.name, owner: pi, heroIdx }, hero, {
    respectFirstTurnProtection: false, reason: 'no_puppet_tokens',
  });
  purgePuppetCountersIfOrphaned(engine, pi);
  engine.sync();
  return true;
}

/**
 * Zonensperre beider Helden: „No cards can be placed into this Hero's
 * Support Zones, except by its own effect or the effects of "Puppet"
 * Tokens." Eingehende Puppet-Tokens und Quellen aus dem Archetyp sind
 * erlaubt, alles andere gesperrt.
 */
function puppetSupportZonesLocked(engine, pi, heroIdx, opts = {}) {
  if (opts.cardName && isPuppetToken(opts.cardName)) return false;
  const src = typeof opts.source === 'string' ? opts.source : opts.source?.name;
  if (src && (isPuppetHero(src) || isPuppetToken(src))) return false;
  return true;
}

/**
 * Puppet-Tokens haben NIE Summoning Sickness (Als Ruling 9 — Start-
 * Tokens sind in Zug 1 aktivierbar; getauschte sofort). Beides setzen:
 * `turnPlayed = 0` (Anzeige/Zaehlungen „letzter Zug") UND `_hasHaste`
 * (hebt das Aktivierungs-Gate unabhaengig von jeder Zug-Buchfuehrung —
 * im Puzzle-Start standen die Tokens trotz turnPlayed 0 als „sick").
 */
function markNoSummoningSickness(inst) {
  if (!inst) return;
  inst.turnPlayed = 0;
  if (!inst.counters) inst.counters = {};
  inst.counters._hasHaste = true;
}

// ── Tokens legen / tauschen ────────────────────────────────────────
/**
 * Token in einen Slot der Spalte legen (Spielstart, Puzzle-Nachbestueckung).
 * Laeuft ueber den zentralen Summon-Pfad; Quelle = Held (passiert die
 * Zonensperre). `turnPlayed = 0` → sofort aktivierbar (Als Ruling 9).
 */
async function placePuppetToken(engine, pi, heroIdx, tokenName, slot, opts = {}) {
  const res = await engine.summonCreatureWithHooks(tokenName, pi, heroIdx, slot, {
    source: opts.source || TRI_FECTA,
    skipLog: false,
    skipReactionCheck: true,
    hookExtras: { _skipEnterSupportSurprise: true },
  });
  if (res?.inst) markNoSummoningSickness(res.inst);
  return res;
}

/**
 * Stiller Austausch am Platz (Als Ruling 3): kein Discard/Deleted, keine
 * Todes-Trigger, Counter und HOPT des alten Tokens verfallen, das neue
 * ist sofort nutzbar. Pro Token eine eigene Animation.
 * `toHeroName` = TRI_AD (Fecta-Satz → Ad-Satz) oder TRI_FECTA (zurueck).
 */
async function swapPuppetTokens(engine, pi, heroIdx, toHeroName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return 0;
  const map = toHeroName === TRI_AD ? TO_AD : TO_FECTA;
  const tokens = puppetTokensInColumn(engine, pi, heroIdx)
    .slice().sort((a, b) => a.zoneSlot - b.zoneSlot);
  if (tokens.length === 0) return 0;
  // Sperre fuer die Dauer der Animation — kein „aus Versehen" aktivieren.
  setPuppetSwapLock(engine, pi, heroIdx, true);
  engine.sync();
  let swapped = 0;
  try {
    // Auftakt-Klang auf dem Helden (Formwechsel).
    engine._broadcastEvent('play_zone_animation', {
      type: 'puppet_form_change', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(260);
    for (const old of tokens) {
      const neu = map[old.name];
      if (!neu) continue;
      const slot = old.zoneSlot;
      engine._broadcastEvent('play_zone_animation', {
        type: SWAP_ANIM[neu] || 'modifier_sparkle',
        owner: pi, heroIdx, zoneSlot: slot,
      });
      await engine._delay(SWAP_MS);
      // Zustand: Name im Slot, Instanz ersetzen (frische ID → frisches HOPT).
      const zone = ps.supportZones?.[heroIdx]?.[slot];
      if (Array.isArray(zone)) {
        const at = zone.indexOf(old.name);
        if (at >= 0) zone[at] = neu; else zone[0] = neu;
      }
      engine._untrackCard(old.id);
      const inst = engine._trackCard(neu, pi, ZONES.SUPPORT, heroIdx, slot);
      markNoSummoningSickness(inst);
      // Persistente Counter mitnehmen (Preserve/Luck ueberleben den Tausch).
      if (inst) {
        for (const k of PERSISTENT_COUNTERS) {
          if (old.counters?.[k]) inst.counters[k] = old.counters[k];
        }
      }
      engine.log('puppet_token_swapped', {
        player: ps.username, heroIdx, slot, from: old.name, to: neu,
        carried: PERSISTENT_COUNTERS.filter(k => old.counters?.[k]),
      });
      swapped++;
      engine.sync();
    }
  } finally {
    setPuppetSwapLock(engine, pi, heroIdx, false);
    engine.sync();
  }
  return swapped;
}

// ── Verbuendete Ziele inkl. Puppets ────────────────────────────────
/**
 * Als Ruling 8: Effekte, die „Creatures you control" etwas tun (Vinnys
 * Counter, Lakis Counter auf „all targets"), erfassen AUCH Puppets.
 * Liefert { heroes: [{hero, heroIdx}], creatures: [inst] }.
 */
function collectAllyTargets(engine, pi, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const heroes = [];
  if (opts.heroes !== false) {
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp > 0) heroes.push({ hero: h, heroIdx: hi });
    }
  }
  const creatures = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== ZONES.SUPPORT || inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd) continue;
    if (hasCardType(cd, 'Creature') || isPuppetToken(inst.name)) creatures.push(inst);
  }
  return { heroes, creatures };
}

/** Besitzt die Quelle des Effekts der Gegner des Zielbesitzers? */
function isOpponentSource(sourceCard, ownerIdx) {
  if (!sourceCard) return false;
  const so = sourceCard.heroOwner ?? sourceCard.controller ?? sourceCard.owner;
  return typeof so === 'number' && so >= 0 && so !== ownerIdx;
}

/** Instanz zu einem 'equip'-Ziel (Support-Zone) — ueber ID oder Koordinaten. */
function instForTarget(engine, t) {
  if (!t) return null;
  if (t.cardInstance) return t.cardInstance;
  if (t._cardInstance) return t._cardInstance;
  if (t.type !== 'equip') return null;
  return engine.cardInstances.find(c =>
    (c.owner === t.owner || c.controller === t.owner) && c.zone === ZONES.SUPPORT
    && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx) || null;
}

// ── Luck / Preserve: Einloesung an den HELDEN (Als Ruling 3.9.) ───────
// Liegen die Counter einmal, sind sie JEDERZEIT einloesbar — auch ohne
// Laki/Vinny auf dem Brett. Traeger der Waechter sind deshalb Tri Fecta
// und Tri Ad (`boardGuards`, Engine-Scan v708 auf lebenden Helden-
// Instanzen). Verliert ein Spieler beide Helden, verschwinden alle seine
// Luck/Preserve Counter (`purgePuppetCountersIfOrphaned`).

/** Kontrolliert der Spieler einen lebenden Tri Fecta / Tri Ad? */
function playerControlsPuppetHero(engine, pi) {
  return (engine.gs.players[pi]?.heroes || []).some(h => h?.name && h.hp > 0 && isPuppetHero(h.name));
}

function hasLuck(engine, ownerIdx, t) {
  if (!t) return false;
  if (t.type === 'hero') return !!engine.gs.players[ownerIdx]?.heroes?.[t.heroIdx]?._luckCounter;
  const inst = instForTarget(engine, t);
  return !!inst?.counters?.luck;
}

function removeAllLuck(engine, pi) {
  const { heroes, creatures } = collectAllyTargets(engine, pi);
  let n = 0;
  for (const { hero } of heroes) if (hero._luckCounter) { delete hero._luckCounter; n++; }
  for (const inst of creatures) if (inst.counters?.luck) { delete inst.counters.luck; n++; }
  for (const h of (engine.gs.players[pi]?.heroes || [])) if (h?._luckCounter) { delete h._luckCounter; n++; }
  return n;
}

function removeAllPreserve(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== ZONES.SUPPORT) continue;
    if (inst.counters?.preserve) { delete inst.counters.preserve; n++; }
  }
  return n;
}

/** Ohne Tri Fecta/Tri Ad verschwinden alle Luck/Preserve Counter des Spielers. */
function purgePuppetCountersIfOrphaned(engine, pi) {
  if (playerControlsPuppetHero(engine, pi)) return 0;
  const n = removeAllLuck(engine, pi) + removeAllPreserve(engine, pi);
  if (n > 0) {
    engine.log('puppet_counters_purged', { player: engine.gs.players[pi]?.username, removed: n });
    engine.sync();
  }
  return n;
}

/** Waechter 1: Luck Counter → Umleitung (Lucky Puppet Laki). */
const LUCK_GUARD = {
  guardCardName: LAKI,
  isBoardRedirect: true,
  boardRedirectPrompt(attackerName, selected) {
    return `${attackerName} targets ${selected?.cardName || 'a lucky target'}. Remove ALL Luck Counters to redirect it to another target you control?`;
  },
  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!isOpponentSource(sourceCard, ownerIdx)) return false;
    if (!selected || selected.owner !== ownerIdx) return false;
    if (!hasLuck(engine, ownerIdx, selected)) return false;
    return (validTargets || []).some(t => t && t.owner === ownerIdx && t.id !== selected.id
      && (t.type === 'hero' || t.type === 'equip'));
  },
  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets) {
    const options = (validTargets || []).filter(t => t && t.owner === ownerIdx && t.id !== selected.id
      && (t.type === 'hero' || t.type === 'equip'));
    if (options.length === 0) return null;
    let pick = null;
    if (options.length === 1) pick = options[0];
    else {
      const r = await engine.promptEffectTarget(ownerIdx, options, {
        title: LAKI, source: LAKI,
        description: 'Choose the target that takes the redirected card or effect.',
        confirmLabel: '↪️ Redirect!', cancellable: false, maxTotal: 1, minRequired: 1,
        _skipRedirectCheck: true, _skipPostTargetReactions: true, ignoreUntargetable: true,
      });
      pick = (r && r.length) ? options.find(t => t.id === r[0]) : options[0];
    }
    if (!pick) return null;
    await announceRedeem(engine, ownerIdx, LAKI);
    const removed = removeAllLuck(engine, ownerIdx);
    engine._broadcastEvent('play_zone_animation', {
      type: 'puppet_luck', owner: ownerIdx, heroIdx: pick.heroIdx, zoneSlot: pick.type === 'hero' ? -1 : pick.slotIdx,
    });
    engine.log('laki_redirect', { player: engine.gs.players[ownerIdx]?.username, from: selected.cardName, to: pick.cardName, countersRemoved: removed });
    engine.sync();
    return { redirectTo: pick };
  },
};

/** Waechter 2: Preserve Counter → Teil-Negation (Preserving Puppet Vinny). */
const PRESERVE_GUARD = {
  guardCardName: VINNY,
  // Zielwahl-Fenster
  isBoardRedirect: true,
  isBoardNegation: true,
  boardRedirectPrompt(attackerName, selected) {
    return `${attackerName} would affect ${selected?.cardName || 'a preserved Creature'}. Remove ALL Preserve Counters to negate its effects on your preserved Creatures?`;
  },
  canBoardRedirect(gs, ownerIdx, inst, selected, validTargets, config, sourceCard, engine) {
    if (!isOpponentSource(sourceCard, ownerIdx)) return false;
    if (!selected || selected.type !== 'equip' || selected.owner !== ownerIdx) return false;
    return !!instForTarget(engine, selected)?.counters?.preserve;
  },
  async onBoardRedirect(engine, ownerIdx, inst, selected, validTargets, config) {
    const picked = Array.isArray(config?._redirectPickedIds) && config._redirectPickedIds.length
      ? config._redirectPickedIds : [selected.id];
    const drop = [];
    for (const id of picked) {
      const t = (validTargets || []).find(x => x && x.id === id);
      if (!t || t.type !== 'equip' || t.owner !== ownerIdx) continue;
      if (instForTarget(engine, t)?.counters?.preserve) drop.push(id);
    }
    if (!drop.includes(selected.id)) drop.push(selected.id);
    await announceRedeem(engine, ownerIdx, VINNY);
    const removed = removeAllPreserve(engine, ownerIdx);
    engine._broadcastEvent('play_zone_animation', {
      type: 'puppet_preserve', owner: ownerIdx, heroIdx: selected.heroIdx, zoneSlot: selected.slotIdx,
    });
    engine.log('vinny_negate', { player: engine.gs.players[ownerIdx]?.username, targets: drop.length, countersRemoved: removed });
    engine.sync();
    return { dropTargetIds: drop };
  },
  // Pfade ohne Zielwahl-Fenster (Batch / Zerstoerung / Status)
  boardEffectGuard: true,
  boardEffectGuardPrompt(sourceName, targetInsts, kind) {
    const n = targetInsts.filter(t => t?.counters?.preserve).length;
    const was = kind === 'destroy' ? 'destroy' : kind === 'status' ? 'affect' : 'damage';
    return `${sourceName} would ${was} ${n} preserved Creature${n === 1 ? '' : 's'}. Remove ALL Preserve Counters to negate it on them?`;
  },
  canGuardEffect(gs, ownerIdx, inst, targetInsts, source) {
    if (!isOpponentSource(source, ownerIdx)) return false;
    return targetInsts.some(t => t?.counters?.preserve);
  },
  async onGuardEffect(engine, ownerIdx, inst, targetInsts, source, kind) {
    const dropInstIds = targetInsts.filter(t => t?.counters?.preserve).map(t => t.id);
    await announceRedeem(engine, ownerIdx, VINNY);
    const removed = removeAllPreserve(engine, ownerIdx);
    for (const t of targetInsts) {
      if (!dropInstIds.includes(t.id)) continue;
      engine._broadcastEvent('play_zone_animation', { type: 'puppet_preserve', owner: ownerIdx, heroIdx: t.heroIdx, zoneSlot: t.zoneSlot });
    }
    engine.log('vinny_negate_effect', { player: engine.gs.players[ownerIdx]?.username, kind, targets: dropInstIds.length, countersRemoved: removed });
    engine.sync();
    return { dropInstIds };
  },
  // AoE
  boardAoeGuard: true,
  boardAoeGuardPrompt(sourceName, entries) {
    const n = entries.filter(e => e.inst?.counters?.preserve).length;
    return `${sourceName} would hit ${n} preserved Creature${n === 1 ? '' : 's'}. Remove ALL Preserve Counters to negate it on them?`;
  },
  canGuardAoe(gs, ownerIdx, inst, entries, sourceCard) {
    if (!isOpponentSource(sourceCard, ownerIdx)) return false;
    return entries.some(e => e.inst?.counters?.preserve);
  },
  async onGuardAoe(engine, ownerIdx, inst, entries) {
    const dropInstIds = entries.filter(e => e.inst?.counters?.preserve).map(e => e.inst.id);
    await announceRedeem(engine, ownerIdx, VINNY);
    const removed = removeAllPreserve(engine, ownerIdx);
    for (const e of entries) {
      if (!dropInstIds.includes(e.inst?.id)) continue;
      engine._broadcastEvent('play_zone_animation', { type: 'puppet_preserve', owner: ownerIdx, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot });
    }
    engine.log('vinny_negate_aoe', { player: engine.gs.players[ownerIdx]?.username, targets: dropInstIds.length, countersRemoved: removed });
    engine.sync();
    return { dropInstIds };
  },
};

/** Karte des einloesenden Puppets zeigen (Al 3.9.: Bild streamen). */
async function announceRedeem(engine, ownerIdx, cardName) {
  try { await engine.announceHookActivation(cardName, ownerIdx, { source: `puppet-redeem:${engine.gs.turn}:${Date.now()}` }); }
  catch { /* rein kosmetisch */ }
}

/** Beide Waechter — Export der Helden-Skripte (`boardGuards`). */
const PUPPET_HERO_GUARDS = [LUCK_GUARD, PRESERVE_GUARD];

/** Skript-Vertrag `loadCardEffect(name)` nur nachladen, wenn vorhanden. */
function scriptOf(name) { try { return loadCardEffect(name); } catch { return null; } }

module.exports = {
  TRI_FECTA, TRI_AD, SHISHI, BRAMMI, VINNY, PAVI, SARAS, LAKI,
  FECTA_SET, TO_AD, TO_FECTA, SWAP_ANIM,
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS,
  isPuppetToken, isPuppetHero, triAdHoptFree, stampTriAdHopt,
  isPuppetActiveLocked, lockPuppetActives, canUsePuppetActive, isPuppetSwapInProgress, setPuppetSwapLock, puppetGlow,
  puppetTokensInColumn, checkPuppetHeroDefeat, puppetSupportZonesLocked,
  placePuppetToken, swapPuppetTokens,
  collectAllyTargets, isOpponentSource, instForTarget, scriptOf,
  playerControlsPuppetHero, purgePuppetCountersIfOrphaned, removeAllLuck, removeAllPreserve,
  LUCK_GUARD, PRESERVE_GUARD, PUPPET_HERO_GUARDS,
};

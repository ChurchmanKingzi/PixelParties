// ═══════════════════════════════════════════
//  SHARED: "Waflav" archetype — Evolution Counters,
//  the form stack, Ascension cost and Descend.
//
//  Six cards use this: the base Hero and five
//  Ascended forms. Everything the forms have in
//  common lives here so a rules change lands once.
//
//  ── Evolution Counters ──
//  `hero._evolutionCounters`, a plain number on the
//  Hero object — same shape as `hero._divinityCounters`
//  (Pharaoh) and `hero._changeCounters` (Cosmic Depths).
//  Heroes are serialised wholesale (`heroes: ps.heroes`),
//  so the field reaches the client with no plumbing.
//  It sits on the Hero rather than the hero CardInstance
//  because both precedents and the whole badge layer do.
//
//  ── Form stack (Als Ruling) ──
//  The forms behave as a STACK. Ascending pushes the
//  previous form onto `hero._formStack` (done by the
//  engine for any card with `formsAscensionStack`);
//  Descending pops exactly one level, so
//  base → Stormkissed → Deep-Drowned descends back to
//  Stormkissed, never straight to base.
//
//  ── Ascension price ──
//  Not the spell-school orb path. Each Ascended form
//  declares `ascensionCondition` / `payAscensionCost`
//  (engine contract) and charges its own printed number
//  of Evolution Counters.
//
//  ── Descend ──
//  Once per turn, FREE (Als Ruling: no Action cost, the
//  only restriction is once per turn). Routed through
//  the standard `heroEffect` plumbing, so it inherits the
//  client button, the phase gate and the HOPT stamp. The
//  shed form returns to hand — ascend/descend cycling
//  within one turn is the intended play pattern.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const BASE_FORM = 'Waflav, the Metamorphing Monstrosity';
const ARCHETYPE = 'Waflav';

/**
 * Printed price and Descend yield of every Ascended form.
 * `cost` = Evolution Counters removed to Ascend into it.
 * `descendGain` = counters placed when Descending FROM it.
 */
const FORMS = {
  'Stormkissed Waflav':   { cost: 1, descendGain: 1 },
  'Flamebathed Waflav':   { cost: 2, descendGain: 1 },
  'Swampborne Waflav':    { cost: 2, descendGain: 1 },
  'Thunderstruck Waflav': { cost: 2, descendGain: 1 },
  'Deep-Drowned Waflav':  { cost: 4, descendGain: 2 },
};

// ── Evolution Counters ───────────────────────────────────────────────

function getEvo(hero) {
  return (hero && typeof hero._evolutionCounters === 'number')
    ? hero._evolutionCounters : 0;
}

function setEvo(hero, n) {
  if (!hero) return;
  const safe = Math.max(0, Math.floor(n || 0));
  if (safe === 0) delete hero._evolutionCounters;
  else hero._evolutionCounters = safe;
}

/**
 * Place counters. Every mutation funnels through here (and `spendEvo`)
 * so the Ascension-availability refresh below can hang off the same
 * two calls — there is no "counters changed" hook in the engine.
 */
function addEvo(engine, pi, heroIdx, n, source) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return 0;
  const before = getEvo(hero);
  setEvo(hero, before + n);
  const gained = getEvo(hero) - before;
  if (gained > 0) {
    engine.log('evolution_counter', {
      player: engine.gs.players[pi]?.username, hero: hero.name,
      amount: gained, total: getEvo(hero), source: source || null,
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
    });
  }
  refreshAscensionTargets(engine, pi);
  return gained;
}

function spendEvo(engine, pi, heroIdx, n) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (getEvo(hero) < n) return false;
  setEvo(hero, getEvo(hero) - n);
  refreshAscensionTargets(engine, pi);
  return true;
}

// ── Archetype / form helpers ─────────────────────────────────────────

function isWaflavName(engine, name) {
  if (!name) return false;
  const cd = engine._getCardDB()[name];
  return !!cd && cd.archetype === ARCHETYPE;
}

/** Which Ascended forms could this Hero afford right now? */
function affordableForms(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  if (!isWaflavName(engine, hero.name)) return [];
  const evo = getEvo(hero);
  return Object.keys(FORMS).filter(f => FORMS[f].cost <= evo && f !== hero.name);
}

/**
 * Keep `hero.ascensionTargets` in sync with the counters.
 *
 * The client gates the "play this Ascended Hero" affordance on
 * `hero.ascensionReady && hero.ascensionTarget === cardName` — a single
 * target. Waflav has FIVE forms at different prices, so the array field
 * carries the full set and the client accepts either shape. The scalar
 * is kept populated too (first affordable form) so nothing that still
 * reads the old field breaks.
 */
function refreshAscensionTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    if (!isWaflavName(engine, hero.name)) continue;
    const forms = affordableForms(engine, pi, hi);
    if (forms.length > 0) {
      hero.ascensionTargets = forms;
      hero.ascensionTarget = forms[0];
      hero.ascensionReady = true;
    } else {
      delete hero.ascensionTargets;
      delete hero.ascensionTarget;
      delete hero.ascensionReady;
    }
  }
}

// ── Engine contracts shared by all five Ascended forms ───────────────

/**
 * Build the `ascensionCondition` / `payAscensionCost` pair for a form.
 * "You must play this Hero from your hand on top of a 'Waflav' Hero you
 * control by removing N Evolution Counters from it."
 */
function ascensionContract(cost) {
  return {
    ascensionCondition(gs, pi, heroIdx, engine) {
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;
      if (!isWaflavName(engine, hero.name)) return false;   // "a 'Waflav' Hero you control"
      return getEvo(hero) >= cost;
    },
    payAscensionCost(engine, pi, heroIdx) {
      spendEvo(engine, pi, heroIdx, cost);
    },
  };
}

/**
 * HOPT key for a form's once-per-turn Descend.
 *
 * Keyed on the FORM NAME, not just the player: each Ascended card
 * carries its own "You may once per turn Descend this Hero", so
 * Deep-Drowned descending into Stormkissed leaves Stormkissed's own
 * once-per-turn intact — which is exactly the multi-form cycling the
 * archetype is built around.
 */
function descendHoptKey(formName, pi, heroIdx) {
  return `waflav-descend:${formName}:${pi}:${heroIdx}`;
}

function canDescend(engine, pi, heroIdx) {
  const gs = engine.gs;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (!Array.isArray(hero._formStack) || hero._formStack.length === 0) return false;
  return gs.hoptUsed?.[descendHoptKey(hero.name, pi, heroIdx)] !== gs.turn;
}

/**
 * "You may once per turn Descend this Hero to place N Evolution
 * Counters onto it."
 *
 * Counters land AFTER the Descend, i.e. on the form we land on — that
 * is what "onto it" refers to once the transformation has happened, and
 * it is what makes the cycle work: descend for fuel, re-ascend.
 */
async function performWaflavDescend(engine, pi, heroIdx, gain) {
  if (!canDescend(engine, pi, heroIdx)) return false;
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  const key = descendHoptKey(hero.name, pi, heroIdx);
  // Namen der ABSTEIGENDEN Form jetzt sichern: `performDescend` schreibt
  // das Heldenobjekt in-place um, danach liest `hero.name` schon die
  // Form DARUNTER. Ohne diese Zeile stempelte die Descend-Telemetrie
  // konsequent die falsche Form (im Repro aufgefallen).
  const fromForm = hero.name;

  // Rueckfrage vor dem Abstieg. Descend ist folgenreich — die aktuelle
  // Form wandert auf den Ablagestapel und ist damit weg — und der
  // Einstieg ist ein einzelner Klick auf den Helden. Der Dialog nennt
  // die Zielform beim Namen, damit klar ist, wo man landet.
  const target = hero._formStack[hero._formStack.length - 1];
  const ok = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: hero.name,
    source: hero.name,
    message: `Really Descend back to ${target}?`,
    description: `${hero.name} is sent to the discard pile and you place ${gain} Evolution Counter${gain > 1 ? 's' : ''}.`,
    showCard: target,
    confirmLabel: '⬇️ Descend!',
    cancelLabel: 'Stay',
    cancellable: true,
  });
  // BEIDE Rueckgabeformen akzeptieren: der Mensch-Pfad liefert
  // `{ confirmed: true }`, der generische CPU-Default in
  // `_getCpuGenericResponse` liefert ein BLANKES `true`. Wer nur
  // `ok?.confirmed` liest, sperrt die CPU komplett aus — genau die
  // Falle, die _cpu.js an zwei Stellen dokumentiert.
  if (!(ok === true || ok?.confirmed === true)) return false;
  const res = await engine.performDescend(pi, heroIdx);
  if (!res?.success) return false;
  // ── Descend-Telemetrie (Als Auftrag 6.8.) ─────────────────────────
  // Der Descend ist der Counter-REGENERATOR des Archetyps: Stack
  // rueckwaerts abarbeiten, Zaehler sammeln, dann Deep-Drowned oben
  // drauf. Ohne eigene Messung war "wie oft steigt die CPU pro Zug
  // wieder ab?" aus den Trainingsdaten nicht beantwortbar — im
  // `evolution_counter`-Log steckt zwar die Quelle 'Descend', das Log
  // wandert aber nicht in die Trainings-Records. Nur live: in
  // Simulationen wuerde der Zaehler mit jedem Rollout hochlaufen.
  try {
    if (!engine._inMctsSim) {
      if (!engine._descendLog) engine._descendLog = [];
      engine._descendLog.push({ pi, t: engine.gs?.turn || 0, from: fromForm, gain });
      // fired-Arm des Descend-Lernkanals: erst HIER steht fest, dass der
      // Abstieg wirklich stattgefunden hat (Gate und Prompt liegen
      // zwischen Absicht und Vollzug).
      const pend = engine._pendingDescendTags;
      if (pend && pend.pi === pi && pend.heroIdx === heroIdx && pend.hero === fromForm) {
        require('./_deck-profile').noteDescend(engine, pi, fromForm, pend.tags, 1);
        engine._pendingDescendTags = null;
      }
    }
  } catch { /* Telemetrie darf nie einen Abstieg kippen */ }
  if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
  engine.gs.hoptUsed[key] = engine.gs.turn;
  addEvo(engine, pi, heroIdx, gain, 'Descend');
  engine.sync();
  return true;
}

// ── "Whenever this Hero defeats a target" ────────────────────────────

/**
 * Al's ruling: without an explicit narrowing on the card ("defeats a
 * target with an Attack"), EVERY direct damage counts — Attack, Spell,
 * effect. NOT status ticks and NOT damage dealt by Creatures.
 *
 * Both exclusions fall out of the source shape:
 *   • Burn / Poison ticks pass `{ name: 'Burn' | 'Poison' }` with no
 *     `owner` and no `heroIdx`, so the identity test below rejects them.
 *   • A Creature's damage carries the Creature's own CardInstance as
 *     the source, whose `heroIdx` is the support slot's hero — that
 *     WOULD match, so support-zone sources and `type: 'creature'` are
 *     rejected explicitly.
 */
function isDirectDefeatByThisHero(ctx, source) {
  if (!source) return false;
  if (ctx.type === 'creature') return false;
  if (source.zone === 'support') return false;
  const owner = source.owner ?? source.controller;
  if (owner !== ctx.cardOriginalOwner) return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  return true;
}

/**
 * The hook pair for a defeat trigger. `afterDamage` covers Hero targets;
 * `processCreatureDamageBatch` does NOT fire afterDamage per creature,
 * so Creature kills need `onCreatureDeath` separately (Xiong pattern).
 */
function defeatTriggerHooks(onDefeat) {
  return {
    afterDamage: async (ctx) => {
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (target.hp > 0) return;
      if (!isDirectDefeatByThisHero(ctx, ctx.source)) return;
      await onDefeat(ctx);
    },
    onCreatureDeath: async (ctx) => {
      if (!isDirectDefeatByThisHero(ctx, ctx.source)) return;
      await onDefeat(ctx);
    },
  };
}


/**
 * CPU soft-gate for a Descend.
 *
 * Descending is only worth it as part of a CYCLE: shed a form, bank the
 * counters, climb again. Without a Waflav form in hand to climb back
 * into, the CPU would just walk itself down the stack and lose stats, so
 * the gate requires one. Whether the cycle is actually the best line in
 * this position is left to MCTS — this only removes the obviously bad
 * arm, the same division of labour as Kazena's `cpuShouldUseHeroEffect`.
 */
/**
 * Soll die CPU absteigen? (Als Ruling 6.8., ersetzt die alte Fassung)
 *
 * ALT: nur wenn eine Waflav-Form auf der HAND liegt. Das war zu eng —
 * es verbot den Abstieg auch dann, wenn er auf einer ANDEREN Ascended
 * Form landet, also gar kein Rueckkletter-Problem entsteht.
 *
 * NEU, Als Formulierung: die Einschraenkung lautet nicht "ich muss
 * wieder hochkommen", sondern **"Waflav soll den Zug nicht in der
 * Basisform beenden muessen"**. Landet der Abstieg auf einer Ascended
 * Form, ist er also immer frei. Nur der letzte Schritt hinunter zur
 * Basisform braucht eine Form auf der Hand als Rueckfahrkarte.
 *
 * Deckneutral formuliert ueber `cardType === 'Ascended Hero'` statt
 * ueber den Namen der Basisform.
 */
function cpuShouldDescendRaw(engine, pi, heroIdx) {
  if (!canDescend(engine, pi, heroIdx)) return false;
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const hero = ps.heroes?.[heroIdx];
  const target = hero?._formStack?.[hero._formStack.length - 1];
  if (target) {
    try {
      const cardDB = engine._getCardDB ? engine._getCardDB() : null;
      if (cardDB?.[target]?.cardType === 'Ascended Hero') return true;
    } catch { /* im Zweifel die strengere Bedingung unten */ }
  }
  return (ps.hand || []).some(n => FORMS[n]);
}

/**
 * Descend-Entscheidung MIT gelerntem Kanal.
 *
 * `cpuShouldDescendRaw` oben ist der reine Regel-/Vertrags-Teil (Als
 * Ruling: nicht in der Basisform enden muessen). Darueber liegt jetzt
 * der gelernte Kanal, der die eigentliche Frage beantwortet: "jetzt
 * abbauen oder noch weiterstapeln?" Ohne Profil liefert er null und
 * alles bleibt beim Alten; im Training erzeugt die Exploration den
 * Kontrast, aus dem die Regel entsteht.
 */
function cpuShouldDescend(engine, pi, heroIdx) {
  if (!cpuShouldDescendRaw(engine, pi, heroIdx)) return false;
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return false;

  // ── EINE Entscheidung je Held, Form und Runde ─────────────────────
  // v260 hat hier bei JEDEM Aufruf neu gewuerfelt. `cpuShouldDescend`
  // wird aber pro Zug vielfach aufgerufen — je Held und je Wiederholung
  // in `activateHeroEffects`, dazu aus Deep-Drowneds counterSpend-Kosten.
  // Jeder Aufruf durfte vetoen, also war die effektive Skip-Rate nicht
  // die eingestellte Exploration ε, sondern 1−(1−ε)^k. Gemessen im Lauf
  // 13-30: **73%** uebersprungene Abstiegs-Absichten in iter1 bei
  // eingestellten 15%, Abstiege 0.42/Spiel statt 0.92 — und der Lernkanal
  // hat sich sein eigenes held-Arm-Rauschen eingefangen.
  //
  // Der Cache haengt am Engine-Objekt und ist nach Runde UND Formnamen
  // geschluesselt, laeuft also von selbst ab. In Simulationen wird er
  // NUR GELESEN: ein Rollout soll die Live-Entscheidung sehen, sie aber
  // weder wuerfeln noch ueberschreiben noch protokollieren.
  const turn = engine.gs?.turn || 0;
  const key = `${pi}:${heroIdx}:${hero.name}:${turn}`;
  if (!engine._descendChoiceCache) engine._descendChoiceCache = new Map();
  const cached = engine._descendChoiceCache.get(key);
  if (cached !== undefined) return cached;
  if (engine._inMctsSim) return true;   // ohne Cache-Eintrag: Vertragslage

  let allow = true;
  try {
    const dp = require('./_deck-profile');
    const tags = dp.classifyDescendTags(engine, pi, heroIdx);
    if (tags && tags.length > 0) {
      const dec = dp.descendDecision(engine, pi, hero.name, tags);
      if (dec === 'skip') {
        dp.noteDescend(engine, pi, hero.name, tags, 0);
        allow = false;
      } else {
        // Der fired-Arm wird erst gestempelt, wenn der Abstieg WIRKLICH
        // passiert — hier ist es nur die Absicht, dazwischen liegen noch
        // Gate und Prompt. `performWaflavDescend` traegt ihn nach.
        engine._pendingDescendTags = { pi, heroIdx, hero: hero.name, tags };
      }
    }
  } catch { /* ohne Profil: unveraendert */ }
  engine._descendChoiceCache.set(key, allow);
  return allow;
}


// ── On-Ascension-Effekte (gemeinsame Bausteine) ──────────────────────
//
// Jeder Ascended Hero hat zusaetzlich zu seinen Haupteffekten einen
// On-Play-Effekt, der beim Aufstieg feuert (Engine-Slot
// `onAscensionBonus`; Beato und Arthor nutzen ihn seit jeher). Er feuert
// AUSSCHLIESSLICH beim Ascend — `performDescend` ruft ihn nicht auf.

/** Jedes lebende Hero-Ziel plus jede offene Creature, beide Seiten. */
function collectBoardTargets(engine) {
  const gs = engine.gs;
  const targets = [];
  for (let p = 0; p < 2; p++) {
    const ps = gs.players[p];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      targets.push({
        id: `hero-${p}-${hi}`, type: 'hero',
        owner: p, heroIdx: hi, cardName: h.name,
      });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    targets.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner,
      heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return targets;
}

/**
 * "Choose any target on the board and <apply status> to it."
 *
 * Die Statusanwendung laeuft ueber `addHeroStatus` / `applyCreatureStatus`,
 * damit ALLE normalen Schranken greifen, ohne dass die Karte sie kennen
 * muss: Karians Immunitaet, Johannas Schutzschirm fuer die uebrigen
 * eigenen Helden, `<status>_immune`-Buffs, Anti-Magic und so weiter.
 * Die Erst-Runden-Immunitaet erledigt der zentrale Ziel-Filter in
 * `promptEffectTarget` — geschuetzte Karten stehen gar nicht erst im
 * Picker.
 *
 * Der Prompt ist NICHT cancellable: "Choose any target" ist keine
 * Kann-Klausel. Steht kein legales Ziel zur Verfuegung (Runde 1 gegen
 * ein leeres eigenes Brett), verpufft der Effekt still.
 */
async function applyStatusOnAscension(engine, pi, cardName, statusName, opts = {}) {
  const targets = collectBoardTargets(engine);
  if (targets.length === 0) return false;

  const pick = await engine.promptEffectTarget(pi, targets, {
    title: cardName,
    source: cardName,
    description: opts.description || `Choose any target on the board.`,
    confirmLabel: opts.confirmLabel || 'Apply!',
    confirmClass: opts.confirmClass || 'btn-warning',
    cancellable: false,
    maxTotal: 1,
    minRequired: 1,
    appliesStatus: statusName,
    redSelect: true,
  });
  if (!pick || pick.length === 0) return false;
  const sel = targets.find(t => t.id === pick[0]);
  if (!sel) return false;

  const statusOpts = {
    appliedBy: pi,
    source: cardName,
    ...(opts.duration ? { duration: opts.duration } : {}),
    ...(opts.stacks ? { stacks: opts.stacks } : {}),
    ...(opts.animationType ? { animationType: opts.animationType } : {}),
  };

  if (sel.type === 'hero') {
    await engine.addHeroStatus(sel.owner, sel.heroIdx, statusName, statusOpts);
  } else if (sel.cardInstance) {
    await engine.applyCreatureStatus(sel.cardInstance, statusName, {
      ...statusOpts, sourceOwner: pi,
    });
  }
  engine.log('waflav_on_ascension_status', {
    player: engine.gs.players[pi]?.username,
    hero: cardName, status: statusName, target: sel.cardName,
  });
  engine.sync();
  return true;
}

/**
 * "Add N Ascended Hero(es) from your deck / discard pile to your hand."
 *
 * Handsperre respektiert (Beato-Muster): wer nicht suchen darf, dessen
 * Bonus verpufft still statt halb zu resolven. `max > 1` laeuft als
 * Folge abbrechbarer Galerien — "up to 2" heisst, der Spieler darf nach
 * dem ersten Pick aufhoeren.
 */
async function tutorAscendedHeroes(engine, pi, cardName, { from, max = 1 } = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return 0;
  if (ps.handLocked) {
    engine.log('waflav_tutor_handlocked', { player: ps.username, hero: cardName });
    return 0;
  }
  const cardDB = engine._getCardDB();
  const pileOf = () => (from === 'discard' ? ps.discardPile : ps.mainDeck) || [];
  const label = from === 'discard' ? 'discard pile' : 'deck';

  let taken = 0;
  for (let i = 0; i < max; i++) {
    const names = [...new Set(pileOf().filter(n => cardDB[n]?.cardType === 'Ascended Hero'))].sort();
    if (names.length === 0) break;
    const choice = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      title: cardName,
      source: cardName,
      description: max > 1
        ? `Add an Ascended Hero from your ${label} to your hand (${taken}/${max}). Cancel to stop.`
        : `Add an Ascended Hero from your ${label} to your hand.`,
      cards: names.map(n => ({ name: n, source: from })),
      cancellable: max > 1,          // "up to N" darf abgebrochen werden
    });
    const picked = choice?.cardName;
    if (!picked) break;
    const pile = pileOf();
    const idx = pile.indexOf(picked);
    if (idx < 0) break;
    pile.splice(idx, 1);
    ps.hand.push(picked);
    engine._trackCard(picked, pi, 'hand');
    taken++;
    engine.log('waflav_tutor', { player: ps.username, hero: cardName, card: picked, from });
    engine.sync();
  }
  // KEIN enforceHandLimit hier. Das Handlimit ist eine ZUGENDE-Regel;
  // die Engine prueft es in der End Phase. Ein Tutor mittendrin darf es
  // nicht ausloesen — Al sah genau das nach Stormkisseds Deck-Tutor.
  return taken;
}

/**
 * Gemeinsame CPU-Zielwahl fuer die drei Status-On-Ascension-Effekte:
 * immer die gefaehrlichste GEGNERISCHE Karte. Der generische Responder
 * wuerde bei einer Liste, die absichtlich beide Seiten enthaelt, auch
 * eigene Karten treffen.
 */
function cpuPickEnemyTarget(engine, payload) {
  const { validTargets, playerIdx } = payload || {};
  if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
  const me = playerIdx != null ? playerIdx : engine._cpuPlayerIdx;
  if (me < 0) return undefined;
  const enemy = validTargets.filter(t => t.owner !== me);
  const pool = enemy.length > 0 ? enemy : validTargets;
  let best = null, bestScore = -Infinity;
  for (const t of pool) {
    let score;
    if (t.type === 'hero') {
      const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      score = (h?.atk || 0) * 2 + (h?.hp || 0) / 10;
    } else {
      const inst = t.cardInstance;
      score = (inst?.atk || 0) * 2 + (inst?.hp || 0) / 10;
    }
    if (enemy.length === 0) score = -score;   // zur Not das eigene Unwichtigste
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best ? [best.id] : undefined;
}


/**
 * Darf `abilityName` GERADE JETZT an diesen Helden angelegt werden?
 *
 * Sammelt die Schranken, die der Hand-Play-Pfad in server.js einzeln
 * prueft, an einer Stelle — sonst bietet ein Karteneffekt Abilities an,
 * die der Held gar nicht tragen kann:
 *   • `restrictedAttachment` (Divinity & Co. lehnen generische Pfade ab)
 *   • `ascendedHeroOnly` (z. B. Smugness) an einem NICHT-Ascended Helden
 *     — genau der Fall der Waflav-Basisform
 *   • karteneigenes `canAttachToHero`
 *   • Platz: freie Zone oder gleichnamiger Stapel < 3 bzw.
 *     `customPlacement` (ueber `canAttachAbilityToHero`)
 */
function canAttachAbilityHere(engine, pi, heroIdx, abilityName) {
  const gs = engine.gs;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cardDB = engine._getCardDB();
  if (cardDB[abilityName]?.cardType !== 'Ability') return false;

  const script = loadCardEffect(abilityName);
  if (script?.restrictedAttachment) return false;
  if (script?.ascendedHeroOnly && cardDB[hero.name]?.cardType !== 'Ascended Hero') return false;
  if (script?.canAttachToHero && !script.canAttachToHero(gs, pi, heroIdx, engine)) return false;

  return engine.canAttachAbilityToHero(pi, abilityName, heroIdx);
}

/** Die legal anlegbaren Ability-Namen aus einer Zone (Deck oder Hand). */
function attachableAbilitiesIn(engine, pi, heroIdx, list) {
  const seen = new Set();
  const out = [];
  for (const n of list || []) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (canAttachAbilityHere(engine, pi, heroIdx, n)) out.push(n);
  }
  return out.sort();
}


/**
 * Ascension-Verfuegbarkeit beim SPIELSTART berechnen.
 *
 * `refreshAscensionTargets` haengt sonst ausschliesslich an `addEvo` /
 * `spendEvo` und an `onAscendSetup` — also an BEWEGUNG. Ein Puzzle, das
 * einen Waflav mit vorgegebenen Countern aufstellt, bewegt beim Start
 * gar nichts: `ascensionReady` blieb ungesetzt, und der Spieler konnte
 * mit 10 Countern erst aufsteigen, NACHDEM er irgendeinen Effekt
 * benutzt und damit den Zaehler angefasst hatte.
 *
 * Der Hook feuert je Waflav-Instanz fuer deren eigenen Besitzer, deckt
 * also beide Seiten ab, und ist idempotent — mehrfaches Feuern schadet
 * nicht. Er gehoert in JEDE der sechs Formen, weil ein Puzzle auch mit
 * einer bereits aufgestiegenen Form starten kann.
 */
const gameStartHook = {
  onGameStart: (ctx) => {
    refreshAscensionTargets(ctx._engine, ctx.cardOwner);
  },
};


/**
 * Alle lebenden „Waflav"-Helden von `pi` als Ziel-Eintraege.
 * „a 'Waflav' Hero you control" — Archetyp-Pruefung, keine Namensliste,
 * also zaehlen Basisform und jede Ascended-Form gleichermassen.
 */
function waflavHeroTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (!isWaflavName(engine, h.name)) continue;
    out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
  }
  return out;
}

/**
 * Eine Karte als KOSTEN aus der Hand abwerfen.
 *
 * Bewusst ueber `actionDiscardHandCard`: der Engine-Helfer erledigt
 * Flug, Effekt-Glow, Ablage-Routing fuer geklaute Kopien und die
 * Discard-Hooks. Selbst spleissen wuerde all das umgehen — genau der
 * Fehler, den die frueheren Direkt-Pushes gemacht haben.
 */
async function discardFromHand(engine, pi, cardName, handIndex, source) {
  const ps = engine.gs.players[pi];
  if (!ps || !Array.isArray(ps.hand)) return false;
  const idx = (typeof handIndex === 'number' && ps.hand[handIndex] === cardName)
    ? handIndex : ps.hand.indexOf(cardName);
  if (idx < 0) return false;
  await engine.actionDiscardHandCard(pi, cardName, idx, { source: source || cardName });
  return true;
}

/**
 * Cards whose Hero Effect holds SEVERAL independent once-per-turn
 * options (base Waflav's three effects, Deep-Drowned's Overcharge +
 * Descend) cannot use the engine's shared `hero-effect:<name>` stamp:
 * it would lock out the remaining options after the first use, which
 * the card texts do not say. Such a card manages its own HOPT keys and
 * returns `false` from `onHeroEffect` so the shared stamp is skipped.
 *
 * The engine stashes a pending reveal BEFORE calling the effect and
 * only drains it on the `!== false` path, so a self-managing card must
 * drain it itself or the stash leaks into the next card played.
 */
function finishSelfManagedHeroEffect(engine) {
  try {
    if (engine.gs._pendingCardReveal) engine._firePendingCardReveal();
    else if (engine.gs._pendingPlayLog) engine._firePendingPlayLog();
  } catch { /* never block the effect on presentation */ }
  return false;
}

/**
 * Vertrag fuer den Counter-Ausgabe-Lernkanal (`counterSpendRules`).
 *
 * Der Kanal beantwortet EINE Frage: "diesen Zaehler jetzt ausgeben oder
 * fuer den Aufstieg aufheben?" — und er soll sie generisch stellen
 * koennen, ohne Waflav-Wissen im Piloten. Dafuer braucht der Classifier
 * drei Dinge von der Karte: was die naechste Nutzung KOSTET, wie der
 * Stand zu LESEN ist und wie er sich reversibel SETZEN laesst.
 *
 * `set` dient ausschliesslich der Probe "waere nach der Ausgabe noch ein
 * Aufstieg bezahlbar?" — der Classifier senkt den Stand, fragt die
 * `ascensionCondition` jeder Form auf der Hand und stellt den
 * Ursprungswert sofort wieder her. Deshalb bewusst das ROHE `setEvo`
 * ohne `refreshAscensionTargets`: die Probe darf keine Nebenwirkung
 * hinterlassen, und `setEvo` fasst `hero.ascensionTargets` nicht an.
 *
 * `cost` darf 0 liefern — dann ist die Aktivierung keine Ausgabe (die
 * vier Descend-Formen legen Zaehler NACH statt sie zu verbrauchen) und
 * der Kanal bleibt fuer diesen Helden stumm.
 */
function counterSpendContract(costFn) {
  return {
    cost(engine, pi, heroIdx) {
      try { return Math.max(0, Number(costFn(engine, pi, heroIdx)) || 0); }
      catch { return 0; }
    },
    get(engine, pi, heroIdx) {
      return getEvo(engine.gs?.players?.[pi]?.heroes?.[heroIdx]);
    },
    set(engine, pi, heroIdx, n) {
      setEvo(engine.gs?.players?.[pi]?.heroes?.[heroIdx], n);
    },
  };
}

/**
 * Untergrenze fuer Ability-Priors dieses Archetyps (Als Auftrag 6.8.).
 *
 * Waflav hat DREI Ability-Slots und startet mit Cannibalism + Toughness —
 * genau EINER ist frei. Die Counter-Quelle der Basis- und der
 * Thunderstruck-Form ist "besiegt ein Ziel", und dafuer muss der Held
 * eine Attack einsetzen koennen: ohne Fighting Lv1 sind Heavy Hit und
 * Quick Attack unbenutzbar und die primaere Counter-Quelle des Decks
 * ist tot. Das ist ein STRUKTURELLES Freischalten, keine Geschmacksfrage.
 *
 * Warum ein Floor noetig ist: `abilities` wird am SPIELENDE gestempelt,
 * der Ability-Kanal misst also mit, wie gut Spiele liefen, in denen eine
 * Ability zufaellig noch dalag. Gemessen im Lauf 13-30 stand Fighting
 * mit +106.6 gleichauf mit `Toughness≥2` (+106.6) und knapp vor
 * `Alchemy` (+72.9) und `Cannibalism≥2` (+69.4) — also konkurrierten
 * drei Nachstapelungen um den einen freien Slot, den das Deck fuer
 * Fighting braucht. Gleiche Klasse wie Summoning Magic @ Teppes: die
 * Korrelation bestraft (bzw. verwaessert) das Fundament, weil sie es von
 * Verschleppung nicht unterscheiden kann.
 *
 * NUR Stufe 1 bekommt den Boden. Eine zweite oder dritte Kopie ist kein
 * Freischalten mehr — dort bleibt das Lernen vollstaendig frei, auch
 * nach unten.
 */
function waflavAbilityPriorFloor(abilityName, targetLevel) {
  if (abilityName === 'Fighting' && targetLevel <= 1) return 150;
  return null;
}

module.exports = {
  BASE_FORM, ARCHETYPE, FORMS,
  getEvo, setEvo, addEvo, spendEvo,
  isWaflavName, affordableForms, refreshAscensionTargets,
  ascensionContract, canDescend, performWaflavDescend, descendHoptKey,
  isDirectDefeatByThisHero, defeatTriggerHooks,
  finishSelfManagedHeroEffect, cpuShouldDescend, cpuShouldDescendRaw,
  counterSpendContract, waflavAbilityPriorFloor,
  collectBoardTargets, applyStatusOnAscension, tutorAscendedHeroes, cpuPickEnemyTarget,
  canAttachAbilityHere, attachableAbilitiesIn, gameStartHook,
  waflavHeroTargets, discardFromHand,
};

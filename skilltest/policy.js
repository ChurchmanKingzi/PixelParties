'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — STANDARD-POLICY DES BOTS
//
//  Alles, was der Bot WÄHLT, steht hier und liest seine Gewichte aus
//  einem Profil (`weights`). Das Lernsystem (skilltest/learn/) ersetzt
//  nur die Gewichte und die gelernten Kartenwerte, nie den Code.
//
//  Der Bot spielt über dieselben Wege wie ein Mensch:
//   • Basisangriff / Hero-Effekt / Creature-Effekt (Akteur-Aktionen)
//   • Handkarten: Zauber & Angriffe, Creatures (verbrauchen den Zug),
//     Artifacts & Surprises (frei, Main Phase)
//  Welche Aktion zuerst kommt, entscheidet `score`: Standard-Neigung
//  (Gewichte) + gelernter Kartenwert (`playValue`) + Neugier (UCB).
// ═══════════════════════════════════════════════════════════════════
const rounds = require('./rounds');
const { getCardDB } = require('../cards/effects/_card-db');

const profileMod = () => require('./learn/profile');
const FOCUS_BONUS = 40;             // Aufschlag für Ziele des vom Lookahead gewählten Gegners (größer als alle Heuristik-Unterschiede)
const MAX_PROMPT_REPEATS = 24;     // so oft darf EINE Karte in einer Aktion denselben freiwilligen Ziel-Prompt stellen

const DEFAULT_WEIGHTS = {
  aggression: 1.0,          // wie bereitwillig angreifen statt Effekte zu nutzen
  lowestHp: 1.0,            // Vorliebe für Ziele mit wenig HP
  killBonus: 2.0,           // Vorliebe für tödliche Treffer
  focusLeader: 0.0,         // >0: stärkste Gegner bevorzugen; <0: Schwache
  heroEffect: 0.6,          // Neigung, aktive Hero-Effekte zu nutzen
  creatureEffect: 0.8,      // Neigung, Creature-Effekte zu nutzen
  spell: 1.0,               // Neigung, Handzauber/-angriffe zu spielen
  summon: 0.9,              // Neigung, Creatures zu beschwören
  equip: 1.0,               // Neigung, Artifacts auszurüsten (frei)
  potion: 1.0,              // Neigung, Tränke zu trinken (frei)
  abilityPlay: 1.0,         // Neigung, Abilities von der Hand an Helden zu legen (frei, einmal je Held und Round)
  abilityUse: 0.8,          // Neigung, aktive Ability-Effekte zu nutzen (kostet die Aktion des Helden)
  reactEager: 1.0,          // Neigung, Reaktionen (Hand, Surprise, Held) auszulösen, wenn die Karten-Heuristik sie erlaubt
  lookahead: 1.0,           // Vielfaches der Rollouts des Lookaheads (skilltest/mcts.js); 0 = der Sitz sucht nie. Wird nicht evolviert.
  healBias: 1.0,            // wie stark Heilung/Buffs bei Verletzten bevorzugt werden
  friendlyFire: 1.0,        // 0 = nie eigene Ziele bei feindlichen Karten (1 = Standard-Vermeidung)
  learned: 1.0,             // Gewicht des gelernten Kartenwerts
  explore: 0.4,             // Neugier auf selten ausprobierte Karten (UCB)
  // Aufbau (Vorbereitung):
  keepCards: 4,             // Obergrenze: so viele Handkarten behält der Bot höchstens, der Rest geht in den Recycler
  keepBias: 0.0,            // verschiebt die Schwelle „behalten gegen recyceln" (> 0: eher behalten, < 0: eher recyceln; Einheit: Platzierungsgüte)
  heroHp: 1.0,              // Gewicht der Helden-HP bei der Heldenwahl
  heroAtk: 2.0,             // Gewicht des Helden-ATK bei der Heldenwahl
};

function weightsOf(room, seat) {
  const st = room.gameState.skillTest;
  return Object.assign({}, DEFAULT_WEIGHTS, (st.botWeights && st.botWeights[seat]) || {});
}

/** Gelerntes Profil — `null` für Sitze, die ohne Profil spielen sollen (Vergleichsläufe, `st.noProfile`). */
function profile(room, seat) {
  try {
    const st = room && room.gameState && room.gameState.skillTest;
    if (st && st.noProfile && st.noProfile.includes(seat)) return null;
    return require('./learn/profile').get();
  } catch { return null; }
}

// ── Karten-Hilfen ──────────────────────────────────────────────────
const _bene = new Map();
/** Hilft die Karte eher den EIGENEN Zielen (Heilung, Schutz, Buff) statt zu schaden? Aus dem Kartentext geschätzt. */
function isBeneficial(cardName) {
  if (_bene.has(cardName)) return _bene.get(cardName);
  const c = getCardDB()[cardName];
  const t = ((c && c.effect) || '').toLowerCase();
  const good = /\b(heal|restore|revive|protect|shield|immune|immunity|cleanse|remove (all )?(negative )?status|gain \d+|\+\d+ (atk|attack|hp|max)|increase|boost|buff)\b/.test(t);
  const bad = /\b(damage|destroy|delete|deal|opponent|enemy|freeze|stun|burn|poison|discard|steal|bound|negate)\b/.test(t);
  const v = good && !bad;
  _bene.set(cardName, v);
  return v;
}

/** Stellungswert eines Sitzes: Heroes, Creatures, Gold. Grundlage der gelernten Spielwerte. */
function sideValue(engine, seat) {
  const gs = engine.gs, ps = gs.players[seat];
  if (!ps) return 0;
  const db = getCardDB();
  let v = 0;
  for (const h of ps.heroes || []) if (h && h.name && h.hp > 0) v += h.hp + (h.atk || 0);
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || (inst.controller ?? inst.owner) !== seat) continue;
    const cd = db[inst.name];
    if (!cd || cd.cardType !== 'Creature') continue;
    const hp = (inst.counters && (inst.counters.currentHp ?? inst.counters.maxHp)) ?? cd.hp ?? 0;
    v += 0.6 * hp;
  }
  v += 0.2 * (ps.gold || 0);
  return v;
}

/** Relative Stellung: eigener Wert minus Mittel der lebenden Gegner (ausgeschiedene zählen nicht). */
function stateValue(engine, seat) {
  const gs = engine.gs, st = gs.skillTest;
  const others = gs.players.map((_, i) => i).filter(i => i !== seat && !(st && st.eliminated.includes(i)));
  const mean = others.length ? others.reduce((a, i) => a + sideValue(engine, i), 0) / others.length : 0;
  return sideValue(engine, seat) - mean;
}

/** Schlüssel für gelernte Aktionswerte. */
function cardKey(kind, name) { return kind + ':' + name; }

/** Gelernter Bonus + Neugier für einen Aktionsschlüssel. */
function learnedBonus(prof, w, key) {
  if (!prof) return w.explore * 1.0;
  const e = prof.playValue && prof.playValue[key];
  const n = e ? e.n : 0;
  const total = (prof.totals && prof.totals.plays) || 0;
  const mean = n > 0 ? e.sum / n : 0;
  const ucb = total > 0 ? Math.sqrt(2 * Math.log(total + 1) / (n + 1)) : 1;
  return w.learned * Math.max(-4, Math.min(4, mean)) + w.explore * Math.min(2, ucb);
}

// ── Zielwahl ───────────────────────────────────────────────────────
/** Zielwahl: Gegner (Seiten ≥ 0 außer dem eigenen Sitz), niedrige HP, tödliche Treffer; Heil-/Buff-Karten wählen eigene Ziele. */
function chooseTargets(engine, seat, validTargets, config, base) {
  if (!validTargets || !validTargets.length) return [];
  const w = weightsOf(engine.room, seat);
  // Eigene Karten-Antworten (cpuResponse) haben Vorrang: sie kennen die Regel der Karte.
  const cardName = config.source || config.title;
  if (cardName) {
    try {
      const { loadCardEffect } = require('../cards/effects/_loader');
      const script = loadCardEffect(cardName);
      if (script && script.cpuResponse) {
        const r = script.cpuResponse(engine, 'effectTarget', { validTargets, config, playerIdx: seat });
        if (r !== undefined) return r;
      }
    } catch { /* weiter mit der Heuristik */ }
  }
  // Freiwillige „erneut"-Prompts: nach einigen Wiederholungen derselben Karte in EINER Aktion abbrechen (verhindert Endlosschleifen).
  if (cardName && config.cancellable) {
    const counts = engine._stPromptCounts || (engine._stPromptCounts = {});
    const key = seat + ':' + cardName;
    if ((counts[key] = (counts[key] || 0) + 1) > MAX_PROMPT_REPEATS) return [];
  }
  const bene = cardName ? isBeneficial(cardName) : false;
  const st = engine.gs.skillTest;
  const focus = engine._stFocus && engine._stFocus.by === seat ? engine._stFocus : null;
  if (engine._stActing === seat && validTargets.some(t => (t.owner != null ? t.owner : seat) !== seat)) engine._stTargetPrompts = (engine._stTargetPrompts || 0) + 1;   // Zielwahl unter Gegnern kam vor
  const strength = (i) => (engine.gs.players[i].heroes || []).reduce((a, h) => a + (h && h.name && h.hp > 0 ? h.hp : 0), 0);
  const scored = validTargets.filter(t => !t.ineligible).map(t => {
    const ownerSeat = t.owner != null ? t.owner : seat;
    const enemy = ownerSeat !== seat;
    let score;
    if (bene) {
      score = enemy ? -10 * (w.friendlyFire > 0 ? 1 : 0.2) : 10;
      const hp = t.hp ?? t.currentHp ?? null, mx = t.maxHp ?? null;
      if (!enemy && hp != null && mx) score += w.healBias * 6 * (1 - hp / Math.max(1, mx));
    } else {
      score = enemy ? 10 : -10 * (w.friendlyFire > 0 ? w.friendlyFire : 0.1);
      if (enemy) {
        if (st && st.eliminated.includes(ownerSeat)) score -= 4;                 // ausgeschiedene Spieler: Creatures nur nachrangig
        score += w.focusLeader * (strength(ownerSeat) / 200);
      }
      const hp = t.hp ?? t.currentHp ?? null;
      if (hp != null) {
        score += w.lowestHp * (200 / Math.max(20, hp));
        if (config.damage && hp <= config.damage) score += w.killBonus * 3;       // tödlicher Treffer
      }
    }
    if (t.type === 'hero') score += 2;
    // Lookahead (mcts.js): „Fokus" auf die Ziele EINES Gegners — als Planvariante der Suche, nicht als Dauerregel
    if (focus && ownerSeat === focus.seat && enemy && !bene) score += FOCUS_BONUS;
    return { id: t.id, score: score + Math.random() * 0.5 };
  }).sort((a, b) => b.score - a.score);
  const minNeeded = Math.max(config.cancellable ? 0 : 1, config.minRequired || 0);
  const maxAllowed = config.maxTotal ?? scored.length;
  const count = Math.min(Math.max(minNeeded, 1), maxAllowed, scored.length);
  return scored.slice(0, count).map(s => s.id);
}

/** Welchen Gegner trifft ein Flächenschaden? Standard: den mit den wenigsten Gesamt-HP (focusLeader>0: den stärksten). */
function choosePlayer(engine, seat, candidates) {
  const w = weightsOf(engine.room, seat);
  const hpOf = (i) => (engine.gs.players[i].heroes || []).reduce((a, h) => a + (h && h.name && h.hp > 0 ? h.hp : 0), 0);
  const sorted = [...candidates].sort((a, b) => hpOf(a) - hpOf(b));
  return w.focusLeader > 0 ? sorted[sorted.length - 1] : sorted[0];
}

// ── Aktionen ───────────────────────────────────────────────────────
/** Hero-Indizes, die diese Handkarte jetzt wirken können (bereit, Stufe, nicht gelähmt). */
function castersFor(engine, seat, cardData) {
  const ready = rounds.heroActors(engine, seat);
  return ready.filter(hi => { try { return engine.heroMeetsLevelReq(seat, hi, cardData); } catch { return false; } });
}

function freeSupportSlots(ps, hi) {
  const zones = (ps.supportZones && ps.supportZones[hi]) || [];
  const out = [];
  for (let z = 0; z < 3; z++) if (!(zones[z] || []).length) out.push(z);
  return out;
}

/** Erschöpfte, lebende Heroes (ohne Lähmung), die per Zusatzaktion (zweite Aktion einer Gewährung) noch handeln dürfen. */
function bonusHeroesFor(engine, seat, category, cardName) {
  const ps = engine.gs.players[seat];
  const out = [];
  (ps.heroes || []).forEach((h, hi) => {
    if (!h || !h.name || h.hp <= 0 || !engine.gs.skillTest.exhaustedHeroes[seat + ':' + hi]) return;
    if (rounds.isIncapacitated(h)) return;
    try {
      const found = cardName ? engine.findAdditionalActionForCard(seat, cardName, hi) : engine.findAdditionalActionForCategory(seat, category, hi);
      if (found) out.push(hi);
    } catch { /* keine Zusatzaktion */ }
  });
  return out;
}

/**
 * Creature-Effekte, die ein Bot nie auslöst: Sie sperren das eigene Ziel (Befund Nachttraining: „Gorinthian War Counselor" betäubt den
 * letzten Gegner jede Round neu, und aller Schaden an ihm wird 0 — der Bot kann nie gewinnen, die Partie läuft endlos).
 */
const AVOID_CREATURE_EFFECTS = new Set(['Gorinthian War Counselor']);

/** Verbrauchende Aktionen: Basisangriff, Effekte, Handzauber, Beschwörungen — beste zuerst. */
function rankActions(room, seat, host) {
  const engine = room.engine, gs = room.gameState, ps = gs.players[seat];
  const w = weightsOf(room, seat);
  const prof = profile(room, seat);
  const db = getCardDB();
  const out = [];
  const heroes = rounds.heroActors(engine, seat);
  const creatures = rounds.withActive(engine, seat, () => rounds.creatureActors(engine, seat));

  for (const c of creatures) {
    if (c.canActivate === false) continue;
    if (AVOID_CREATURE_EFFECTS.has(c.cardName)) continue;
    const params = { heroIdx: c.heroIdx, zoneSlot: c.zoneSlot, instId: c.instId ?? c.id };
    if (c.charmedOwner != null) params.charmedOwner = c.charmedOwner;
    const key = cardKey('creatureEffect', c.cardName || 'creature');
    out.push({ score: w.creatureEffect * 5 + learnedBonus(prof, w, key) + Math.random(), kind: 'creature', key,
      run: () => rounds.act(room, seat, 'activate_creature_effect', params, () => host.doActivateCreatureEffect(room, seat, params), host) });
  }

  // Aktive Hero-Effekte (kosten den Zug, erschöpfen den Hero nicht).
  let heroEffects = [];
  try { heroEffects = rounds.withActive(engine, seat, () => engine.getActiveHeroEffects(seat)) || []; } catch { heroEffects = []; }
  for (const e of heroEffects) {
    if (e.equippedCard) continue;                              // Ausrüstungs-Effekte: vorerst nicht
    const params = { heroIdx: e.heroIdx };
    const key = cardKey('heroEffect', e.heroName);
    out.push({ score: w.heroEffect * 5 + learnedBonus(prof, w, key) + Math.random(), kind: 'heroEffect', key,
      run: () => rounds.act(room, seat, 'activate_hero_effect', params, () => host.doActivateHeroEffect(room, seat, params), host) });
  }

  // Aktive Ability-Effekte (Aktionskosten): wie Hero-Effekte, aber der Held muss bereit sein (oder eine Zusatzaktion haben).
  try {
    gs.currentPhase = rounds.PHASE_ACTION;
    const ready = new Set([...heroes, ...bonusHeroesFor(engine, seat, 'ability_activation')]);
    const acts = rounds.withActive(engine, seat, () => engine.getActivatableAbilities(seat, { ownSideOnly: true })) || [];
    for (const e of acts) {
      if (!ready.has(e.heroIdx)) continue;
      const params = { heroIdx: e.heroIdx, zoneIdx: e.zoneIdx, zoneKind: e.zoneKind || 'ability' };
      const key = cardKey('ability', e.abilityName);
      out.push({ score: w.abilityUse * 5 + learnedBonus(prof, w, key) + Math.random(), kind: 'ability', key,
        run: () => rounds.act(room, seat, 'activate_ability', params, () => host.doActivateAbility(room, seat, params), host) });
    }
  } catch { /* keine aktivierbaren Abilities */ }

  // Handkarten: Zauber/Angriffe über bereite Heroes, Creatures in freie Zonen.
  (ps.hand || []).forEach((name, handIndex) => {
    const c = db[name];
    if (!c) return;
    const sub = (c.subtype || '').toLowerCase();
    if ((c.cardType === 'Spell' || c.cardType === 'Attack') && (sub === 'normal' || sub === '')) {
      const key = cardKey('spell', name);
      const base = (c.cardType === 'Attack' ? w.aggression : w.spell) * 6;
      const casters = castersFor(engine, seat, c);
      for (const hi of bonusHeroesFor(engine, seat, null, name)) if (!casters.includes(hi) && engine.heroMeetsLevelReq(seat, hi, c)) casters.push(hi);   // Zusatzaktion
      for (const hi of casters) {
        const params = { cardName: name, handIndex, heroIdx: hi };
        out.push({ score: base + learnedBonus(prof, w, key) + Math.random() * 1.5, kind: 'spell', key, card: name, hero: hi,
          run: () => rounds.act(room, seat, 'play_spell', params, () => host.doPlaySpell(room, seat, params), host) });
      }
    } else if (c.cardType === 'Creature' && sub === 'normal' && host.doPlayCreature) {
      if (c.cost && (ps.gold || 0) < c.cost) return;
      const key = cardKey('summon', name);
      for (const hi of castersFor(engine, seat, c)) {
        const free = freeSupportSlots(ps, hi);
        if (!free.length) continue;
        const params = { cardName: name, handIndex, heroIdx: hi, zoneSlot: free[0] };
        out.push({ score: w.summon * 5 + learnedBonus(prof, w, key) + Math.random(), kind: 'summon', key, card: name, hero: hi,
          run: () => rounds.act(room, seat, 'play_creature', params, () => host.doPlayCreature(room, seat, params), host) });
      }
    }
  });

  for (const hi of [...heroes, ...bonusHeroesFor(engine, seat, 'attack')]) {
    out.push({ score: w.aggression * 6 + Math.random() * 2 - (heroes.includes(hi) ? 0 : 0.5), kind: 'attack', key: cardKey('attack', 'Attack'),
      run: () => rounds.playBaseAttack(room, seat, hi, host) });
  }
  return out.sort((a, b) => b.score - a.score);
}

const scriptOf = (name) => { try { return require('../cards/effects/_loader').loadCardEffect(name); } catch { return null; } };
const attempt = (fn, dflt = false) => { try { return fn(); } catch { return dflt; } };

/** Ist irgendeiner meiner Helden verletzt? (Heil-Tränke sind sonst verschwendet.) */
function anyHeroHurt(ps) {
  return (ps.heroes || []).some(h => h && h.name && h.hp > 0 && h.maxHp && h.hp < h.maxHp);
}

/** Trank trinken: bei Zielsitzung (`gs.potionTargeting`) Ziele wählen und bestätigen, sonst abbrechen. */
async function usePotion(room, seat, host, params) {
  const gs = room.gameState, engine = room.engine;
  rounds.setPhaseFor(room, seat, 'use_potion', params);
  const ok = await host.doUsePotion(room, seat, params);
  if (!ok) return false;
  const pt = gs.potionTargeting;
  if (pt && pt.ownerIdx === seat && !pt.isEffectPrompt) {
    const ids = chooseTargets(engine, seat, pt.validTargets || [], { ...(pt.config || {}), source: pt.potionName }, null);
    let done = false;
    if (ids.length) {
      rounds.setPhaseFor(room, seat, 'confirm_potion', {});
      done = await host.doConfirmPotion(room, seat, { selectedIds: ids });
    }
    if (!done) { gs.potionTargeting = null; engine.sync(); return false; }
  }
  return true;
}

/**
 * Freie Spielzüge der Main Phase (verbrauchen den Zug nicht): Artifacts ausrüsten, Surprises legen,
 * Tränke trinken, Abilities von der Hand an Helden legen.
 * Der Bot führt sie vor der eigentlichen Aktion aus. Jede Karte kommt nur einmal vor (einmalig im Spiel).
 */
function freeActions(room, seat, host) {
  const engine = room.engine, gs = room.gameState, ps = gs.players[seat];
  const w = weightsOf(room, seat);
  const prof = profile(room, seat);
  const db = getCardDB();
  const out = [];
  const alive = (ps.heroes || []).map((h, hi) => (h && h.name && h.hp > 0 ? hi : -1)).filter(hi => hi >= 0);
  (ps.hand || []).forEach((name, handIndex) => {
    const c = db[name];
    if (!c) return;
    const sub = (c.subtype || '').toLowerCase();
    if (c.cardType === 'Artifact' && (sub === 'equipment' || sub === 'normal') && host.doPlayArtifact) {
      const key = cardKey('equip', name);
      const base = w.equip * 4 + learnedBonus(prof, w, key);
      if (sub === 'equipment') {
        for (const hi of alive) {
          const free = freeSupportSlots(ps, hi);
          if (!free.length) continue;
          const params = { cardName: name, handIndex, heroIdx: hi, zoneSlot: free[0] };
          out.push({ score: base - (ps.heroes[hi].hp > 0 ? 0 : 5) + Math.random(), key: 'free:' + name + ':' + hi, learnKey: key,
            run: () => { rounds.setPhaseFor(room, seat, 'play_artifact', params); return host.doPlayArtifact(room, seat, params); } });
        }
      } else {
        const params = { cardName: name, handIndex, heroIdx: alive[0] };
        out.push({ score: base - 1 + Math.random(), key: 'free:' + name, learnKey: key,
          run: () => { rounds.setPhaseFor(room, seat, 'play_artifact', params); return host.doPlayArtifact(room, seat, params); } });
      }
    } else if (c.cardType === 'Potion' && host.doUsePotion) {
      // Tränke: einmalig; Heilung/Buffs nur, wenn jemand verletzt ist. Reaktions-Tränke spielt die Reaktionslogik.
      const script = scriptOf(name);
      if (!script || !script.isPotion || script.isReaction) return;
      if (attempt(() => engine.arePotionsLockedFor(seat))) return;
      if (script.canActivate && !attempt(() => script.canActivate(gs, seat, engine))) return;
      if (isBeneficial(name) && !anyHeroHurt(ps)) return;
      const key = cardKey('potion', name);
      const params = { cardName: name, handIndex };
      out.push({ score: w.potion * 4 + learnedBonus(prof, w, key) + Math.random(), key: 'free:' + name, learnKey: key,
        run: () => usePotion(room, seat, host, params) });
    } else if (c.cardType === 'Ability' && host.doPlayAbility) {
      // Hand-Abilities: an einen Helden mit freier Zone oder passendem Stapel (Stufe +1), je Held einmal pro Round.
      const script = scriptOf(name);
      if (script && script.ascendedHeroOnly) return;
      for (const hi of alive) {
        if (ps.abilityGivenThisTurn && ps.abilityGivenThisTurn[hi] && !((ps._bonusAbilityAttachments && ps._bonusAbilityAttachments[hi]) > 0)) continue;
        const zone = attempt(() => engine.abilityZielZone(seat, hi, name), -1);
        if (zone < 0) continue;
        if (script && script.canAttachToHero && !attempt(() => script.canAttachToHero(gs, seat, hi, engine))) continue;
        const stacks = (ps.abilityZones[hi] || []).some(z => (z || [])[0] === name);
        const heroName = ps.heroes[hi].name;
        const pair = prof ? profileMod().meanOf(prof.pairValue[heroName < name ? heroName + '|' + name : name + '|' + heroName]) : 0;
        const key = cardKey('abilityPlay', name);
        const params = { cardName: name, handIndex, heroIdx: hi, zoneSlot: zone };
        out.push({ score: w.abilityPlay * 4 + (stacks ? 2 : 0) + 2 * pair + learnedBonus(prof, w, key) + Math.random(), key: 'free:ability:' + name + ':' + hi, learnKey: key,
          run: () => { rounds.setPhaseFor(room, seat, 'play_ability', params); return host.doPlayAbility(room, seat, params); } });
      }
    } else if ((c.cardType === 'Creature' || c.cardType === 'Spell' || c.cardType === 'Attack') && sub === 'surprise' && host.doPlaySurprise) {
      for (const hi of alive) {
        if ((ps.surpriseZones && ps.surpriseZones[hi] && ps.surpriseZones[hi].length)) continue;
        const params = { cardName: name, handIndex, heroIdx: hi };
        out.push({ score: 3 + Math.random(), key: 'free:' + name + ':' + hi, learnKey: cardKey('surprise', name),
          run: () => { rounds.setPhaseFor(room, seat, 'play_surprise', params); return host.doPlaySurprise(room, seat, params); } });
      }
    }
  });
  return out.sort((a, b) => b.score - a.score);
}

// ── Reaktionen ─────────────────────────────────────────────────────
// Die Standard-CPU der Engine (_cpu.js installCpuBrain) ist auf zwei Spieler gebaut und im Modus nicht installiert; die
// Engine-Vorgabe lehnt jede freiwillige Frage ab. Deshalb entscheidet der Bot Reaktionen selbst. Kanäle:
//   1. Karten-Heuristik (Veto): `cpuResponse` der Karte, `cpuMeta.reactionHeuristic`, keine Negation eigener Karten.
//      Ob die Reaktion überhaupt möglich ist, prüft die Engine schon (`reactionCondition`, Kosten, Wirker, Sperren).
//   2. Persona `reactEager` (Neigung 0 … 2)
//   3. gelernt: Stellungsänderung des Sitzes bis zum Ende der laufenden Aktion, getrennt für „gefeuert" und „gehalten"
//      (`react-fire:<Karte>` / `react-hold:<Karte>`); sobald beide Arme genug Beobachtungen haben, entscheidet der Vergleich
//   4. Neugier: ohne Daten wird gelegentlich bewusst gehalten, damit der Vergleich überhaupt entsteht
const RX_MIN_N = 6;

const saysYes = (r) => r === true || !!(r && r.confirmed === true);

/** Negations-Reaktion? („negate this spell/the effect …"; „cannot be negated" zählt nicht.) */
function isNegation(cd) {
  const t = ((cd && cd.effect) || '').toLowerCase();
  if (!t) return false;
  if (/(cannot|can ?not|may not|will not) be negated/.test(t) && !/negate (the|this|that)/.test(t)) return false;
  return /negate (the|this|an|its) /i.test(t);
}

/** Karten-Heuristik für eine Reaktion: true = darf feuern, false = nicht (Veto). */
function reactionHeuristic(engine, seat, promptData, cardName) {
  const script = scriptOf(cardName);
  if (script && typeof script.cpuResponse === 'function') {
    const r = attempt(() => script.cpuResponse(engine, 'generic', promptData), undefined);
    if (r !== undefined) return saysYes(r);
  }
  const hf = script && script.cpuMeta && script.cpuMeta.reactionHeuristic;
  if (typeof hf === 'function') return !!attempt(() => hf(engine, promptData));
  const cd = getCardDB()[cardName];
  if (cd && isNegation(cd)) {
    const src = engine._currentEffectSource;                                    // wer die Karte spielt, auf die reagiert wird
    const owner = src && Number.isInteger(src.owner) ? src.owner : engine.gs.activePlayer;
    return owner !== seat;                                                       // nie eigene Karten negieren
  }
  return true;
}

/** Soll die Reaktion `cardName` jetzt ausgelöst werden? (Die Heuristik hat bereits zugestimmt.) */
function reactionVerdict(engine, seat, cardName) {
  const room = engine.room, w = weightsOf(room, seat), prof = profile(room, seat);
  const arm = (a) => prof && prof.playValue && prof.playValue['react-' + a + ':' + cardName];
  const f = arm('fire'), h = arm('hold');
  if (f && h && f.n >= RX_MIN_N && h.n >= RX_MIN_N) {
    return (f.sum / f.n - h.sum / h.n) * w.learned + (w.reactEager - 1) * 0.5 >= 0;
  }
  return Math.random() < Math.max(0.1, Math.min(1, 0.2 + 0.6 * w.reactEager));
}

// ── Basisaufbau ────────────────────────────────────────────────────
/**
 * Basis für einen CPU-Sitz: Heroes nach Wert (HP/ATK + gelernter Kartenwert), Abilities/Support nach gelernter
 * Passung zum Hero, unbrauchbare Karten in den Recycler (mehr Gold, früherer Spielbeginn).
 */
function prepareBase({ env, ps, room, idx, pool, noProfile, weights, record }) {
  const { buildWithRecycling, usableInBattle } = require('./autoprep');
  const KM = require('./learn/keepmodel');
  const Rules = require('../public/skilltest-rules.js');
  const { CONFIG } = require('./config');
  const L = require('./learn/profile');
  const prof = noProfile ? null : profile();
  const w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
  const cv = (n) => (prof ? L.meanOf(prof.cardValue[n]) : 0);
  const pv = (a, b) => (prof ? L.meanOf(prof.pairValue[a < b ? a + '|' + b : b + '|' + a]) : 0);
  // Behalten oder recyceln: gelernt, mit der restlichen Hand und dem Brett als Kontext (learn/keepmodel.js). Ohne Profil gilt nur
  // die feste Vorgabe (brauchbar im Kampf → behalten). Im Training wird gelegentlich gegen die Entscheidung gespielt (Messung).
  const decide = KM.makeDecider({
    env, model: (prof && prof.keepModel) || KM.newModel(),
    usable: usableInBattle, protect: (n) => Rules.HAND_ONLY_HEROES.includes(n),
    maxKeep: Math.max(0, Math.round(w.keepCards)), bias: w.keepBias, explore: record ? Math.min(0.3, 0.25 * w.explore) : 0,
  });
  return buildWithRecycling(env, ps, {
    pool, config: CONFIG, decide, record,
    maxKeep: Math.max(0, Math.round(w.keepCards)),
    heroScore: (n, c) => w.heroHp * (c.hp || 0) + w.heroAtk * (c.atk || 0) + 150 * cv(n),
    pairScore: (hero, card) => 2 * pv(hero, card),
    keepScore: (n) => 2 * cv(n),
  });
}

module.exports = {
  prepareBase,
  DEFAULT_WEIGHTS, weightsOf, chooseTargets, choosePlayer, rankActions, freeActions,
  stateValue, sideValue, isBeneficial, cardKey, reactionVerdict, reactionHeuristic, saysYes,
};

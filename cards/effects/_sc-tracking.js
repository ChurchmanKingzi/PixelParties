// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SC-TRACKING WÄHREND DER PARTIE (v1381)
//
//  Reine Buchungslogik für `gs._scTracking[pi]`. Die Engine ruft nur
//  ihre beiden Helfer `_scNoteHit` und `_scNoteHeroHpLoss` (plus
//  `notePlayedFromHand` und die Goldbuchung in `actionGainGold`); was
//  eine Messgröße bedeutet, steht HIER und nirgends sonst.
//
//  Ausgewertet wird das Ganze am Spielende in `/sc-rewards.js`.
//  Kategorien, die sich am Ende vom Brett ablesen lassen (Super-Skilled,
//  Over-Skilled, Spammer), brauchen hier KEIN Feld — Als Ruling 24.9.:
//  „Es zählt nur am Ende!"
//
//  Das Objekt lebt im Spielzustand → Snapshot/Restore der MCTS rollt
//  es automatisch mit zurück.
// ═══════════════════════════════════════════════════════════════
'use strict';

const { hasCardType, SPELL_SCHOOL_ABILITIES } = require('./_hooks');

/** Frischer Zähler für einen Spieler. */
function neu() {
  return {
    totalGoldEarned: 0,       // Rich
    maxDamageInstance: 0,     // Brutal — größter Einzeltreffer, jedes Ziel
    cardsPlayedFromHand: 0,   // Anti-Farm-Riegel
    creatureOverkill: false,  // Overkill
    heroEverBelow50: false,   // Flawless — irgendein Held je auf ≤ 50 % HP
    wasFirstToOneHero: false, // Comeback
    totalHpLost: 0,           // Good Game
    // ── v1382 ──
    heroKillTurn: -1,         // Double/Triple Kill: Zug der laufenden Zählung
    heroKillsInTurn: 0,       //   … gegnerische Helden in diesem Zug
    maxHeroKillsInTurn: 0,    //   … Bestwert der Partie
    ascended: false,          // Ascended
    spellSchools: [],         // Scholar — Array statt Set (Snapshot/JSON-sicher)
    surprisesActivated: 0,    // Surprise Party
    longestChain: 0,          // Chain Reaction
    hpRestored: 0,            // Field Medic — Helden und Kreaturen
    enemyCreaturesDefeated: 0,// Exterminator
    potionsUsed: 0,           // Alchemist
    // ── v1383 ──
    usedAdditionalAction: false, // Back to Basics
    mainActionTurn: -1,       //   … Zug, in dem die Main-Action schon verbraucht ist
    dmgSpell: 0,              // Only Spells
    dmgCreature: 0,           // Creature Tamer
    dmgOther: 0,              //   … jeder andere Schaden (auch Status) bricht beide
    lastKillExact: false,     // Right on Target — gilt für den LETZTEN Heldentod
    startHpSumme: null,       // Overhealed — Summe der Helden-HP bei Spielbeginn
  };
}

/** Overhealed: HP-Summe aller eigenen Helden bei Spielbeginn festhalten. */
function startHp(tracking, players) {
  for (let pi = 0; pi < 2; pi++) {
    const t = tracking?.[pi];
    if (!t || t.startHpSumme != null) continue;
    t.startHpSumme = hpSumme(players?.[pi]);
  }
}
/** Summe der HP aller benannten Helden eines Spielers (besiegte = 0). */
function hpSumme(ps) {
  return (ps?.heroes || []).reduce((s, h) => s + (h?.name ? Math.max(0, h.hp || 0) : 0), 0);
}

// Status-Ticks tragen keinen Besitzer an der Quelle — der Status selbst
// merkt sich meist, wer ihn gesetzt hat (`appliedBy`).
const STATUS_SCHLUESSEL = { Burn: 'burned', Poison: 'poisoned', Bleed: 'bleeding' };

/**
 * Only Spells / Creature Tamer (Als Rulings 24.9.): welcher Art war der
 * Schaden, den ein Spieler verursacht hat? Jedes Ziel zählt, auch eigene.
 * Status-Schaden zählt als „andere Art" und bricht beide Kategorien —
 * zugerechnet dem, der den Status gesetzt hat, sonst dem Gegner des Opfers.
 */
function schaden(tracking, { source, amount, opferSeite, ziel, istStatus, cardDB }) {
  if (!tracking || !(amount > 0)) return;
  if (istStatus) {
    const k = STATUS_SCHLUESSEL[source?.name];
    const von = k ? (ziel?.statuses?.[k]?.appliedBy ?? ziel?.counters?.[k]?.appliedBy) : undefined;
    const wer = (von === 0 || von === 1) ? von
      : (opferSeite === 0 || opferSeite === 1) ? 1 - opferSeite : null;
    const t = wer == null ? null : tracking[wer];
    if (t) t.dmgOther = (t.dmgOther || 0) + amount;
    return;
  }
  const wer = source?.owner ?? source?.controller;
  const t = (wer === 0 || wer === 1) ? tracking[wer] : null;
  if (!t) return;
  const cd = cardDB?.[source?.name];
  const istSpell = hasCardType(cd, 'Spell');
  const istKreatur = hasCardType(cd, 'Creature');   // Artifact-Creatures eingeschlossen
  if (istSpell) t.dmgSpell = (t.dmgSpell || 0) + amount;
  if (istKreatur) t.dmgCreature = (t.dmgCreature || 0) + amount;
  if (!istSpell && !istKreatur) t.dmgOther = (t.dmgOther || 0) + amount;
}

/**
 * Back to Basics (Als Ruling 24.9.): „jede Aktion, die nicht die
 * Main-Action in der Action Phase ist". Zusatzaktion ist also:
 * geschenkt (isAdditional), inhärent (isInherent), frei (isFree),
 * außerhalb der eigenen Action Phase — oder jede weitere Aktion im
 * selben Zug, auch wenn ein Pfad sie nicht markiert.
 */
function aktion(tracking, ctx, env) {
  const pi = ctx?.playerIdx;
  const t = tracking?.[pi];
  if (!t || !env?.istAktion?.(ctx)) return;
  let zusatz = !!(ctx.isAdditional || ctx.isInherent || ctx.isFree)
    || env.phase !== env.actionPhase || env.activePlayer !== pi;
  if (!zusatz) {
    if (t.mainActionTurn === env.turn) zusatz = true;
    else t.mainActionTurn = env.turn;
  }
  if (zusatz) t.usedAdditionalAction = true;
}

/**
 * Wer hat besiegt? Dieselbe Regel wie der Coreling-Stempel in
 * `runHooks` (v744): die Quelle muss einem Spieler gehören, und zwar
 * NICHT der Seite des Opfers. Status-Ticks ohne Verursacher und eigene
 * Opfer zählen damit nicht (Als Ruling 1.9.).
 * @returns {number|null} Spielerindex des Siegers über dieses Ziel
 */
function taeterVon(source, opferSeite) {
  const taeter = source?.owner ?? source?.controller;
  if (taeter !== 0 && taeter !== 1) return null;
  if (taeter === opferSeite) return null;
  return taeter;
}

/** Double/Triple Kill — ein gegnerischer Held wurde besiegt. */
function heldBesiegt(tracking, source, opferSeite, turn) {
  const wer = taeterVon(source, opferSeite);
  const t = wer == null ? null : tracking?.[wer];
  if (!t) return;
  if (t.heroKillTurn !== turn) { t.heroKillTurn = turn; t.heroKillsInTurn = 0; }
  t.heroKillsInTurn = (t.heroKillsInTurn || 0) + 1;
  if (t.heroKillsInTurn > (t.maxHeroKillsInTurn || 0)) t.maxHeroKillsInTurn = t.heroKillsInTurn;
}

/** Field Medic — tatsächlich zurückgewonnene HP (Überheilung zählt mit). */
function heilung(t, amount) {
  if (t && amount > 0) t.hpRestored = (t.hpRestored || 0) + amount;
}

/**
 * Chain Reaction — eine Reaktionskette löst auf. Gutgeschrieben wird
 * JEDEM Spieler, der mindestens ein Glied beigesteuert hat.
 */
function kette(tracking, chain) {
  const laenge = chain?.length || 0;
  const beteiligt = new Set((chain || []).map(l => l?.owner).filter(o => o === 0 || o === 1));
  for (const pi of beteiligt) {
    const t = tracking?.[pi];
    if (t && laenge > (t.longestChain || 0)) t.longestChain = laenge;
  }
}

/**
 * Zähler, die an einem Hook hängen — aufgerufen aus `runHooks`, der
 * einen Stelle, durch die jedes dieser Ereignisse läuft (auch die, die
 * Kartenmodule selbst feuern).
 */
function beiHook(tracking, hookName, ctx, env = {}) {
  if (!tracking || !ctx) return;
  const cardDB = env.cardDB;
  switch (hookName) {
    case 'onAnyActionResolved':
      aktion(tracking, ctx, env);
      return;
    case 'afterSpellResolved': {
      // Scholar: nur Karten vom Typ Spell (Attacks laufen durch denselben
      // Hook). Double Spells decken beide Schulen ab.
      const t = tracking[ctx.casterIdx];
      const cd = ctx.spellCardData || cardDB?.[ctx.spellName];
      if (!t || !hasCardType(cd, 'Spell')) return;
      if (!Array.isArray(t.spellSchools)) t.spellSchools = [];
      for (const schule of [cd.spellSchool1, cd.spellSchool2]) {
        if (SPELL_SCHOOL_ABILITIES.includes(schule) && !t.spellSchools.includes(schule)) t.spellSchools.push(schule);
      }
      return;
    }
    case 'onSurpriseActivated': {
      // Aufdecken zählt, auch wenn die Surprise danach negiert wird
      // (Als Ruling 24.9., Golden Ladybug).
      const t = tracking[ctx.surpriseOwner];
      if (t) t.surprisesActivated = (t.surprisesActivated || 0) + 1;
      return;
    }
    case 'afterPotionUsed': {
      // Feuert nur für aufgelöste (nicht negierte) Tränke.
      const t = tracking[ctx.potionOwner];
      if (t) t.potionsUsed = (t.potionsUsed || 0) + 1;
      return;
    }
    case 'onCreatureDeath': {
      const k = ctx.creature;
      if (!k) return;
      const wer = taeterVon(ctx.source, k.controller ?? k.owner);
      const t = wer == null ? null : tracking[wer];
      if (t) t.enemyCreaturesDefeated = (t.enemyCreaturesDefeated || 0) + 1;
      return;
    }
    default:
  }
}

/** Brutal: größter Einzeltreffer. */
function treffer(t, amount) {
  if (amount > (t.maxDamageInstance || 0)) t.maxDamageInstance = amount;
}

/**
 * Ein Held hat HP verloren (Schaden jeder Art ODER Niederlage ohne
 * Schaden — dann ist `amount` seine HP davor).
 *
 * Flawless: „taking 50%+ damage" → Grenze `<=` (bis v1380 stand `<`, genau
 * 50 % rutschte durch). Ein besiegter Held hat 0 HP und fällt damit
 * automatisch darunter — auch ein eigenes Opfer (Als Ruling 24.9.).
 *
 * Comeback: geprüft wird NUR der Besitzer des Helden, der gerade verloren
 * hat. Bis v1380 lief eine Schleife über beide Seiten; standen beide
 * gleichzeitig auf ≤ 1 Held, bekam immer Sitz 0 das Flag.
 *
 * @param {object[]} tracking  gs._scTracking (beide Spieler)
 * @param {number}   owner     Besitzer des Helden
 * @param {object}   hero
 * @param {number}   amount    verlorene HP
 * @param {object[]} heroes    alle Helden dieses Besitzers
 */
function heldVerlor(tracking, owner, hero, amount, heroes, opts = {}) {
  const t = tracking?.[owner];
  if (!t) return;
  if (amount > 0) t.totalHpLost = (t.totalHpLost || 0) + amount;
  if (hero.maxHp > 0 && hero.hp <= hero.maxHp * 0.5) t.heroEverBelow50 = true;
  const lebend = heroes.filter(h => h?.name && h.hp > 0).length;
  if (lebend <= 1 && !tracking.some(x => x?.wasFirstToOneHero)) {
    t.wasFirstToOneHero = true;
  }
  // Right on Target: fällt gerade der LETZTE Held dieses Spielers, merkt
  // sich die Gegenseite, ob der Treffer exakt war. Ein späterer letzter
  // Tod (nach Wiederbelebung) überschreibt das; Niederlagen ohne Schaden
  // sind nie exakt.
  if (hero.hp <= 0 && lebend === 0) {
    const g = tracking[owner === 0 ? 1 : 0];
    if (g) g.lastKillExact = !!opts.exakt;
  }
}

/** Hook-Namen, die `beiHook` auswertet — Vorfilter für `runHooks`. */
const HOOKS_MIT_ZAEHLER = new Set(['onAnyActionResolved', 'afterSpellResolved', 'onSurpriseActivated', 'afterPotionUsed', 'onCreatureDeath']);

module.exports = { HOOKS_MIT_ZAEHLER, neu, startHp, hpSumme, schaden, aktion, treffer, heldVerlor, heldBesiegt, heilung, kette, beiHook, taeterVon };

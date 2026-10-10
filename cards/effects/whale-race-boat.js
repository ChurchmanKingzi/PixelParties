// ═══════════════════════════════════════════
//  CARD EFFECT: "Whale Race Boat"
//  Artifact / Equipment (Race Boats, Cost 12, Secret Rare)
//
//  „A Hero can only have 1 "Race Boat" Artifact equipped to it. Once per
//   turn, when the equipped Hero performs an Action, deal 40 damage to all
//   other targets on the board. This damage is increased by 30 for every
//   Creature in the equipped Hero's Support Zones."
//
//  ── ALS VORGABEN (10.10., bindend) ────────────────────────────────────
//  · Die Creatures-Zahl schliesst Bonus-Zonen von „Flying Island in the Sky"
//    ein (`_race-boat-shared.kreaturenAmHeld`).
//  · Es loest AUTOMATISCH bei der ERSTEN Aktion aus, die der ausgeruestete
//    Held ausfuehrt. Ist diese Aktion die Beschwoerung einer Creature, zaehlt
//    die NEUE Creature schon fuer den Schaden: der Haken feuert erst NACH der
//    Aktion (`onAnyActionResolved`), gezaehlt wird dann.
//  · Die Animation ist eine gewaltige Pixelart-Welle (`tidal_wave`), die die
//    komplette GEGNERSEITE ueberschwemmt.
//
//  ── Auslegung ─────────────────────────────────────────────────────────
//  · „performs an Action": ueber den gemeinsamen Ausloeser `handlungsHooks`
//    (`onAnyActionResolved` + Reaktionen des Helden, `_action-shared`) — jede
//    Aktion aus jedem Aktionspfad, auch Zusatz- und inhaerente Aktionen;
//    Heldeneffekte nur mit Aktionskosten (Als Ruling 4.8.). In JEDER Runde,
//    nicht nur der eigenen (Einheitszaehler `_charges`: frisch je Spielerzug).
//  · „all other targets on the board": Helden UND Creatures BEIDER Seiten —
//    ohne den ausgeruesteten Helden selbst. Die eigenen Creatures (auch die in
//    den Zonen des Helden) trifft es mit. Gesammelt wie bei einem Flaechenschlag
//    (`collectAoe*Targets`: verdeckte Surprises sind immun).
//  · Schadensquelle ist das Boot, nicht der Held: synthetische Quelle ohne
//    Heldenindex (`heroIdx: -1`, Book-of-Doom-Muster wie Explosivo's Sword) —
//    eine Ausruestung loest den Schaden aus, der Held „greift" nicht an. Typ
//    'artifact'. EIN Flaechenschlag (`dealDamageToTargets`, `istFlaeche`).
//  · Der Schaden faellt, wenn die Wellenfront die Ziele erreicht
//    (`WELLE_TREFFER_MS`), das Spiel laeuft kurz danach weiter.
// ═══════════════════════════════════════════

const RB = require('./_race-boat-shared');
const { handlungsHooks } = require('./_action-shared');
const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Whale Race Boat';
const BASIS = 40;
const PRO_KREATUR = 30;
const ZAEHLER = { key: 'WhaleRaceBoat', max: 1 };

// Zeiten (ms) — gehoeren zur Animation `tidal_wave` (app-board.jsx).
const WELLE_MS = 2100;          // Lebensdauer der Animation
const WELLE_TREFFER_MS = 700;   // Front erreicht die Mitte der Gegnerseite bei ~600 ms (inkl. Mount-Vorlauf)
const NACH_TREFFER_MS = 450;    // so lange wartet die Aufloesung nach dem Schaden, dann laeuft das Spiel weiter

/** Alle Ziele ausser dem ausgeruesteten Helden, als Eintraege fuer `dealDamageToTargets`. */
function andereZiele(engine, t) {
  const alle = [];
  for (let i = 0; i < engine.playerCount(); i++) alle.push(i);
  const ziele = [];
  for (const { hero, heroIdx, owner } of engine.collectAoeHeroTargets(alle, {})) {
    if (owner === t.seite && heroIdx === t.heroIdx) continue;
    ziele.push({ type: 'hero', owner, heroIdx, cardName: hero.name });
  }
  const gesehen = new Set();
  for (const { inst } of engine.collectAoeCreatureTargets(alle, {}, ['hero', 'creature'])) {
    if (gesehen.has(inst.id)) continue;      // Besitzer ≠ Kontrolleur taucht in beiden Durchlaeufen auf
    gesehen.add(inst.id);
    ziele.push({ type: 'creature', inst, owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: inst.name });
  }
  return ziele;
}

async function beiAktion(ctx) {
  const t = RB.traeger(ctx);
  if (!t) return;
  // Der AUSGERUESTETE Held handelt (Brettseite + Index; ein uebernommener Held traegt `heroOwner`).
  if (ctx.heroIdx !== t.heroIdx || (ctx.heroOwner ?? ctx.playerIdx) !== t.seite) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  // Einmal pro Zug — VOR dem Schaden gestempelt (kein zweiter Ausloeser mitten in der Aufloesung).
  if (usesLeft(t.inst, gs, ZAEHLER) <= 0) return;
  spendUse(t.inst, gs, ZAEHLER);

  const ctrl = t.kontrolleur;
  const n = RB.kreaturenAmHeld(engine, t.seite, t.heroIdx);
  const schaden = BASIS + PRO_KREATUR * n;
  await engine.announceHookActivation(CARD_NAME, ctrl);

  const ziele = andereZiele(engine, t);
  if (ziele.length === 0) { engine.sync(); return; }

  const gegnerSeite = engine.opponentOf(ctrl);
  // Die Welle ueberschwemmt die komplette Gegnerseite; alle getroffenen Ziele stehen in `targets` (die ausserhalb
  // der Gegnerseite bekommen einen Gischt-Einschlag).
  engine._broadcastEvent('play_zone_animation', {
    type: 'tidal_wave', zoneType: 'board', owner: t.seite, heroIdx: -1, zoneSlot: -1,
    duration: WELLE_MS, regionOwner: gegnerSeite,
    originOwner: t.seite, originHeroIdx: t.heroIdx,
    targets: ziele.map(z => ({ owner: z.owner, heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : z.zoneSlot, cardName: z.cardName })),
  });
  await engine._delay(WELLE_TREFFER_MS);

  const quelle = { name: CARD_NAME, owner: ctrl, heroIdx: -1 };
  await engine.dealDamageToTargets(quelle, ziele, {
    damage: schaden, damageType: 'artifact', sourceName: CARD_NAME, istFlaeche: true, hitDelay: 0,
  });
  engine.log('whale_race_boat', {
    player: gs.players[ctrl]?.username, hero: t.hero.name, creatures: n, damage: schaden, targets: ziele.length,
  });
  await engine._delay(NACH_TREFFER_MS);
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  /** „A Hero can only have 1 "Race Boat" Artifact equipped to it." */
  canEquipToHero: RB.canEquipToHero,

  hooks: { ...handlungsHooks(beiAktion) },

  _test: { BASIS, PRO_KREATUR },
};

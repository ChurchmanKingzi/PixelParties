// ═══════════════════════════════════════════
//  CARD EFFECT: "Crocodile Race Boat"
//  Artifact / Equipment (Race Boats, Cost 12)
//
//  „A Hero can only have 1 "Race Boat" Artifact equipped to it. Once per
//   turn, during your turn, when the equipped Hero defeats its fourth target
//   your opponent controls this turn, it may immediately perform an
//   additional Action, but you cannot perform more Actions for the rest of
//   the turn afterwards. The number of targets this Hero needs to defeat is
//   reduced by the number of Creatures in the equipped Hero's Support Zones,
//   to a minimum of 1."
//
//  ── ALS VORGABEN (10.10., bindend) ────────────────────────────────────
//  · Die Creatures-Zahl schliesst Bonus-Zonen von „Flying Island in the Sky"
//    ein (`_race-boat-shared.kreaturenAmHeld`). Drei Creatures bei dem Helden
//    → ein Kill genuegt.
//  · Die Zusatzaktion darf NUR der ausgeruestete Held ausfuehren und laeuft
//    SOFORT — wie der Bonus-Spell der Victory Phoenix Cannon
//    (`performImmediateAction` mit dem Helden). Wird das Boot entfernt, bevor
//    sie ausgefuehrt werden kann, VERFAELLT sie samt Nachteil (wir pruefen
//    unmittelbar vor dem Angebot, ob es noch am Helden haengt).
//  · MEHRERE Ziele zugleich (Flaechenschaden: „Boiling Oil" legt zwei
//    Creatures um) zaehlen als mehrere Ziele gegen die Schwelle: jeder Tod ist
//    ein eigenes Ereignis (`afterDamage` je Held, `onCreatureDeath` je Kreatur).
//    Braucht das Boot 2 Kills und der Held legt 2 Creatures gleichzeitig um,
//    loest das die Zusatzaktion sofort aus.
//
//  ── Auslegung ─────────────────────────────────────────────────────────
//  · „defeats": jeder DIREKTE Schaden des Helden (Attack, Spell, Effekt),
//    nicht Status-Ticks, nicht Kreaturenschaden (`defeatTriggerHooks`, Als
//    Ruling Waflav — dieselbe Frage wie bei Gravedigger's Shovel).
//  · „your opponent controls": das besiegte Ziel gehoert dem Gegner des
//    Kontrolleurs (Held nach Kontrolle, Creature nach Controller).
//  · „during your turn": nur in der Runde des Kontrolleurs wird gezaehlt.
//  · Die Schwelle wird bei JEDEM Tod frisch gerechnet (4 − Creatures, min. 1)
//    und mit „erreicht oder ueberschritten" geprueft; „once per turn" haelt
//    `claimHOPT` (VOR der Zusatzaktion gestempelt: Kills der Zusatzaktion
//    selbst loesen nichts zweites aus).
//  · Die Kills werden AM BOOT gezaehlt, ab dem Moment, in dem es am Helden
//    haengt (Zaehler `counters._crocKills = { turn, n }`).
//  · Der Nachteil („you cannot perform more Actions … afterwards") greift
//    IMMER nach dem Ausloesen — auch wenn die Zusatzaktion abgelehnt wird oder
//    der Held sie nicht ausfuehren kann (wie der Overflowing Chalice, Als
//    Vorgabe 28.8.). Er ist der spielerweite `actionLocked`-Riegel.
// ═══════════════════════════════════════════

const W = require('./_waflav-shared');
const RB = require('./_race-boat-shared');

const CARD_NAME = 'Crocodile Race Boat';
const BASIS_ZIELE = 4;

/** Wie viele Ziele der Held JETZT besiegen muss: 4 minus Creatures, mindestens 1. */
function schwelle(engine, seite, heroIdx) {
  return Math.max(1, BASIS_ZIELE - RB.kreaturenAmHeld(engine, seite, heroIdx));
}

/** Haengt das Boot noch an demselben Helden? (Sonst verfaellt die Zusatzaktion.) */
function nochAusgeruestet(engine, inst, t) {
  return engine.cardInstances.includes(inst) && inst.zone === 'support'
    && inst.heroIdx === t.heroIdx && engine.physicalSide(inst) === t.seite;
}

async function onDefeat(ctx) {
  const t = RB.traeger(ctx);
  if (!t) return;
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = t.inst;
  const ctrl = t.kontrolleur;
  // „during your turn"
  if (gs.activePlayer !== ctrl) return;
  // Das besiegte Ziel gehoert dem Gegner des Kontrolleurs (wie Gravedigger's Shovel).
  const oppIdx = engine.opponentOf(ctrl);
  if (ctx.creature) {
    if ((ctx.creature.controller ?? ctx.creature.owner) !== oppIdx) return;
  } else if (ctx.target) {
    const tOwner = engine._findHeroOwner(ctx.target);
    if (tOwner < 0 || engine.heroSideOf(tOwner, ctx.target) !== oppIdx) return;
  } else return;

  // Zaehlen — jedes besiegte Ziel einzeln.
  const z = inst.counters._crocKills;
  const stand = (z && z.turn === gs.turn) ? z.n : 0;
  inst.counters._crocKills = { turn: gs.turn, n: stand + 1 };
  const noetig = schwelle(engine, t.seite, t.heroIdx);
  if (stand + 1 < noetig) return;

  // Einmal pro Zug — VOR der Zusatzaktion gestempelt.
  if (!engine.claimHOPT(`crocodile-race-boat:${inst.id}`, ctrl)) return;
  await engine.announceHookActivation(CARD_NAME, ctrl);

  // „Wird das Equip entfernt, bevor die Bonus-Action durchgefuehrt werden kann, verfaellt sie."
  if (!nochAusgeruestet(engine, inst, t)) return;

  const ps = gs.players[ctrl];
  engine.log('crocodile_race_boat', {
    player: ps?.username, hero: t.hero.name, defeated: stand + 1, needed: noetig,
  });
  await engine.performImmediateAction(ctrl, t.heroIdx, {
    title: CARD_NAME,
    description: `${t.hero.name} defeated ${stand + 1} target${stand + 1 > 1 ? 's' : ''}! Perform an additional Action — afterwards you cannot perform more Actions this turn.`,
    ...(t.seite !== ctrl ? { heroOwner: t.seite } : {}),
  });

  // Der Nachteil: keine weiteren Aktionen in dieser Runde (spielerweiter Riegel, faellt zum Zugwechsel).
  if (ps) {
    ps.actionLocked = true;
    engine.log('crocodile_race_boat_lock', { player: ps.username });
  }
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  /** „A Hero can only have 1 "Race Boat" Artifact equipped to it." */
  canEquipToHero: RB.canEquipToHero,

  hooks: { ...W.defeatTriggerHooks(onDefeat) },

  _test: { schwelle, BASIS_ZIELE },
};

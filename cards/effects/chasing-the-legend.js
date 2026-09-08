// ═══════════════════════════════════════════
//  CARD EFFECT: "Chasing the Legend"
//  Spell / Reaction (Summoning Magic Lv1)
//
//  „Play this card immediately when a Creature would take damage. Add
//   that Creature to its owner's hand before the damage is applied."
//
//  ── Als Rulings (29.8.) ───────────────────────────────────────
//  · „owner" = der URSPRUENGLICHE Besitzer der Kreatur, nicht der
//    aktuelle Controller. `actionMoveCard` legt eine Karte immer in
//    die Hand von `inst.owner` — Stehlen aendert nur `controller`,
//    also landet eine gestohlene Kreatur beim Bestohlenen.
//  · Der Angreifer darf KEIN neues Ziel waehlen: der Schaden an die
//    Kreatur wird schlicht geblankt (`{ negated: true }` im
//    Vor-Schaden-Fenster), der Rest des Effekts laeuft weiter.
//  · Auftritt: dieselbe Unsichtbar-Werde-Animation wie Invisibility
//    Cloak (`play_cloak_vanish`, hier kuerzer und ohne Wiederauftauchen
//    der Kreatur — sie ist danach weg), zusaetzlich Nebelschwaden um
//    die Kreatur (`mist_veil`, v618, Klang `elem_wind` tief).
//
//  ── Fenster ───────────────────────────────────────────────────
//  „a Creature" — irgendeine. Deshalb BEIDE Vor-Schaden-Fenster:
//  das des Controllers (`isCreaturePreDamageReaction`) und das des
//  anderen Spielers (`isOppCreaturePreDamageReaction`). Beide laufen
//  je Schadenseintrag im Kreaturen-Batch, VOR dem HP-Abzug — genau
//  „before the damage is applied". Verdeckte Kreaturen (Surprises)
//  werden nicht angeboten.
// ═══════════════════════════════════════════

const CARD_NAME = 'Chasing the Legend';

function bedingung(gs, pi, engine, inst, source, amount) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (!(amount > 0)) return false;
  return true;
}

async function rettung(engine, pi, inst, source, amount) {
  const gs = engine.gs;
  if (!inst || inst.zone !== 'support') return { negated: false };
  const ownerIdx = inst.owner;
  const ctrl = inst.controller ?? inst.owner;
  const heroIdx = inst.heroIdx, zoneSlot = inst.zoneSlot, name = inst.name;

  engine._broadcastEvent('play_zone_animation', {
    type: 'mist_veil', owner: ctrl, heroIdx, zoneSlot, duration: 1600,
  });
  engine._broadcastEvent('play_cloak_vanish', {
    owner: ctrl, heroIdx, zoneSlot, fadeMs: 700, holdMs: 200,
  });
  await engine._delay(750);

  await engine.actionMoveCard(inst, 'hand', -1, -1, { source: CARD_NAME });

  engine.log('chasing_the_legend', {
    player: gs.players[pi]?.username, creature: name,
    toHandOf: gs.players[ownerIdx]?.username, blankedDamage: amount, from: source?.name || null,
  });
  engine.sync();
  return { negated: true };
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isCreaturePreDamageReaction: true,
  creaturePreDamageCondition: bedingung,
  creaturePreDamageResolve: rettung,

  isOppCreaturePreDamageReaction: true,
  oppCreaturePreDamageCondition: bedingung,
  oppCreaturePreDamageResolve: rettung,
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Teleportation Powder"   (Potion)
//
//  „Choose any undefeated Hero on the board and remove it, its
//   Abilities, and all cards equipped or attached to it from the game
//   completely. At the beginning of your next turn, return those cards
//   to the Zones they were removed from. A player does not lose the
//   game, even if all their other Heroes are defeated. You can only
//   play 1 \"Teleportation Powder\" per game."
//
//  ── WAS MITGEHT ───────────────────────────────────────────────────
//  Der Held selbst (mit HP, Status, Buffs, Zaehlern), seine ABILITIES
//  und alles, was an ihm haengt: Equipments und Attachments in seinen
//  Support Zones, plus seine Surprise-Zone.
//  CREATURES bleiben stehen. Sie sind laut Regelwerk unabhaengig von
//  ihrem Helden (sie ueberleben seinen Tod) und sind weder „equipped"
//  noch „attached" — der Kartentext nennt sie nicht. Eine Creature, die
//  per `treatAsEquip` als Ausruestung gilt, geht dagegen mit.
//  ← LESART, Al kann sie umdrehen.
//
//  ── RUECKKEHR (Als Regel 11.9.) ───────────────────────────────────
//  · GANZ AM ANFANG des naechsten eigenen Zuges — vor Statusablauf und
//    vor Burn/Poison. Dafuer gibt es seit v867 den Hook
//    `onTurnStartEarly`; der normale `onTurnStart` feuert erst NACH dem
//    Statusschaden. Ein zurueckkehrender Held mit Gift nimmt den Tick
//    dieses Zuges also noch mit.
//  · Die Karten kommen NICHT als frisch gespielt zurueck: keine
//    `onPlay`-, keine `onCardEnterZone`-Hooks, kein Ascension-Bonus.
//    Alles wird an seinen Platz zurueckgestellt, sonst nichts.
//  · Zurueckgestellt wird in die URSPRUENGLICHEN Zonen. Ist eine Zone
//    inzwischen fremdbesetzt (jemand hat in die leere Support Zone
//    beschworen), weicht die Karte auf den naechsten freien Platz
//    DESSELBEN Helden aus; gibt es keinen, bleibt sie draussen — sie
//    verschwindet nicht in einen Stapel, denn sie war nie dort.
//
//  ── WER LOEST DIE RUECKKEHR AUS ───────────────────────────────────
//  Die Potion selbst liegt nach dem Einsatz im Loeschstapel. Sie haengt
//  ihren Hook deshalb ueber `activeIn: ['deleted']` an — Stapel-Bewohner
//  bekommen fuer die gelisteten Hooks einen Tracker (`_ensurePileListeners`,
//  seit v867 auch fuer `onTurnStartEarly`). Der Auftrag selbst steht im
//  SPIELSTAND (`gs._teleportPending`), nicht im Skript: so ueberlebt er
//  jede Simulation und jedes Zurueckspulen.
//
//  ── BLENDE (v868, Als Vorgabe) ────────────────────────────────────
//  Die betroffenen Zonen werden ueber ~1 s transparent, BEVOR der
//  Spielstand sie leert — sonst waeren die Karten schon weg, wenn die
//  Blende anfaengt. Dieselbe Blende laeuft bei der Rueckkehr rueckwaerts
//  (von durchsichtig zu voll), damit das Wiederauftauchen nicht hart
//  einrastet. Das Ereignis `zone_fade` ist generisch gehalten: es nennt
//  Zonen und eine Dauer, keine Karte — jeder kuenftige Effekt, der
//  etwas vom Brett nimmt oder zurueckbringt, kann es mitbenutzen.
//  Geblendet werden die KARTEN in den Zonen, nicht die Zonen selbst:
//  Rahmen und Beschriftung bleiben stehen, darunter kommt der leere
//  Platz zum Vorschein.
//
//  ── NIEDERLAGE ────────────────────────────────────────────────────
//  `ps._teleportedAway` zaehlt entrueckte Helden. Solange der Zaehler
//  steht, verliert die Seite nicht, auch wenn alle uebrigen Helden
//  besiegt sind (Engine, `checkGameOver`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Teleportation Powder';
const BLENDE_MS = 1000;
// Klang der Blende. Eine eigene „vanish"-Datei gibt es in der
// Klangbibliothek nicht, und ein erfundener Name laedt still ins Leere
// (404 → `_sfxMissing`). `elem_wind` ist der vorhandene Luftzug-Klang;
// tief und leise fuer das Verschwinden, heller und etwas lauter fuer
// die Rueckkehr — dieselbe Quelle, zwei Lesarten.
const KLANG_WEG = { name: 'elem_wind', rate: 0.72, volume: 1.15 };
const KLANG_ZURUECK = { name: 'elem_wind', rate: 1.25, volume: 1.0 };

/** Zonenliste fuer die Blende — genau die, die geleert bzw. gefuellt werden. */
function blendZonen(auftrag) {
  const z = [{ kind: 'hero', heroIdx: auftrag.heroIdx }];
  for (let zi = 0; zi < (auftrag.abilities || []).length; zi++) {
    if ((auftrag.abilities[zi] || []).length > 0) z.push({ kind: 'ability', heroIdx: auftrag.heroIdx, slotIdx: zi });
  }
  for (const e of (auftrag.support || [])) z.push({ kind: 'support', heroIdx: auftrag.heroIdx, slotIdx: e.slot });
  if ((auftrag.surprises || []).length > 0) z.push({ kind: 'surprise', heroIdx: auftrag.heroIdx });
  return z;
}

/** Ist diese Karte in einer Support Zone eine Creature (bleibt stehen)? */
function istCreature(engine, inst) {
  if (inst.counters?.treatAsEquip) return false;   // gilt als Ausruestung
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return !!cd && hasCardType(cd, 'Creature');
}

/** Tiefe Kopie eines Heldenobjekts — ohne Verweise auf lebende Objekte. */
function heldKopieren(hero) {
  return JSON.parse(JSON.stringify(hero));
}

module.exports = {
  isPotion: true,
  // Hooks aus dem LOESCHSTAPEL heraus (siehe Kopfkommentar).
  activeIn: ['deleted'],
  oncePerGame: true,
  oncePerGameKey: CARD_NAME,

  canActivate(gs, playerIdx) {
    for (let pi = 0; pi < 2; pi++) {
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const out = [];
    // „any undefeated Hero on the board" — beide Seiten. Der
    // Erstrunden-Schutz gilt trotzdem: in Runde 1 ist der Gegner
    // unantastbar.
    for (let pi = 0; pi < 2; pi++) {
      if (pi !== playerIdx && gs.firstTurnProtectedPlayer === pi) continue;
      out.push(...engine.getHeroTargets(pi));
    }
    return out;
  },

  targetingConfig: {
    title: CARD_NAME,
    description: 'Remove an undefeated Hero — with its Abilities, Equipments and Attachments — from the game. It all returns at the beginning of your next turn.',
    confirmLabel: '✨ Teleport!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  animationType: 'gold_sparkle',

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ziel = (validTargets || []).find(t => t.id === selectedIds?.[0]);
    if (!ziel || ziel.type !== 'hero') return;
    const oi = ziel.owner;
    const hi = ziel.heroIdx;
    const ops = gs.players[oi];
    const hero = ops?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return;

    // ── Alles einsammeln, was mitgeht ───────────────────────────────
    const auftrag = {
      besitzer: oi,
      heroIdx: hi,
      rueckkehrBei: pi,                 // zu Beginn von DESSEN naechstem Zug
      gesetztInZug: gs.turn,
      hero: heldKopieren(hero),
      abilities: (ops.abilityZones?.[hi] || []).map(slot => (slot || []).slice()),
      surprises: (ops.surpriseZones?.[hi] || []).slice(),
      support: [],                      // { slot, name, counters, faceDown }
    };

    // Support Zones: Ausruestung und Anhaenge mitnehmen, Creatures nicht.
    for (let si = 0; si < 3; si++) {
      const slot = (ops.supportZones?.[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        && ((c.controller ?? c.owner) === oi || c.owner === oi));
      if (inst && istCreature(engine, inst)) continue;   // Creature bleibt
      auftrag.support.push({
        slot: si,
        namen: slot.slice(),
        counters: inst ? JSON.parse(JSON.stringify(inst.counters || {})) : {},
        owner: inst ? inst.owner : oi,
        controller: inst ? (inst.controller ?? inst.owner) : oi,
        faceDown: !!inst?.faceDown,
      });
    }

    // ── Vom Brett nehmen ────────────────────────────────────────────
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: oi, heroIdx: hi, zoneSlot: -1,
    });
    // Erst ausblenden, DANN leeren (siehe Kopfkommentar).
    engine._broadcastEvent('zone_fade', {
      owner: oi, zones: blendZonen(auftrag), durationMs: BLENDE_MS,
      direction: 'out', sfx: KLANG_WEG,
    });
    await engine._delay(BLENDE_MS);

    for (const eintrag of auftrag.support) {
      ops.supportZones[hi][eintrag.slot] = [];
      for (const name of eintrag.namen) {
        const inst = engine.cardInstances.find(c =>
          c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === eintrag.slot && c.name === name);
        if (inst) engine._untrackCard(inst.id);
      }
    }
    for (let zi = 0; zi < (ops.abilityZones?.[hi] || []).length; zi++) {
      for (const name of (ops.abilityZones[hi][zi] || [])) {
        const inst = engine.cardInstances.find(c =>
          c.zone === 'ability' && c.owner === oi && c.heroIdx === hi && c.zoneSlot === zi && c.name === name);
        if (inst) engine._untrackCard(inst.id);
      }
      ops.abilityZones[hi][zi] = [];
    }
    for (const name of auftrag.surprises) {
      const inst = engine.cardInstances.find(c =>
        c.zone === 'surprise' && c.owner === oi && c.heroIdx === hi && c.name === name);
      if (inst) engine._untrackCard(inst.id);
    }
    if (ops.surpriseZones?.[hi]) ops.surpriseZones[hi] = [];

    // Heldeninstanz und Heldenobjekt entfernen. Der PLATZ bleibt
    // bestehen (leerer Name) — die Spalte darf nicht wegrutschen, sonst
    // zeigen alle Indizes daneben.
    const heldInst = engine.cardInstances.find(c =>
      c.zone === 'hero' && c.owner === oi && c.heroIdx === hi);
    if (heldInst) engine._untrackCard(heldInst.id);
    ops.heroes[hi] = { name: '', hp: 0, maxHp: 0, statuses: {}, buffs: {} };

    ops._teleportedAway = (ops._teleportedAway || 0) + 1;
    if (!gs._teleportPending) gs._teleportPending = [];
    gs._teleportPending.push(auftrag);

    engine.log('teleport_removed', {
      player: gs.players[pi]?.username,
      hero: auftrag.hero.name, owner: ops.username,
      abilities: auftrag.abilities.flat().length,
      attached: auftrag.support.reduce((n, e) => n + e.namen.length, 0),
      returnsFor: gs.players[pi]?.username,
    });
    engine.sync();
  },

  hooks: {
    // Rueckkehr ganz am Anfang des Zuges dessen, der die Potion spielte.
    onTurnStartEarly: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const offen = gs._teleportPending;
      if (!Array.isArray(offen) || offen.length === 0) return;
      const dran = gs.activePlayer;

      const bleiben = [];
      for (const auftrag of offen) {
        if (auftrag.rueckkehrBei !== dran || auftrag.gesetztInZug === gs.turn) {
          bleiben.push(auftrag);
          continue;
        }
        await zurueckstellen(engine, auftrag);
      }
      gs._teleportPending = bleiben;
      if (bleiben.length === 0) delete gs._teleportPending;
    },
  },
};

/**
 * Alles an seinen Platz — OHNE Eintritts- oder Spiel-Hooks. Genau das
 * ist Als Regel: „gilt NICHT als frisch gespielt".
 */
async function zurueckstellen(engine, auftrag) {
  const gs = engine.gs;
  const ps = gs.players[auftrag.besitzer];
  if (!ps) return;
  const hi = auftrag.heroIdx;

  // Held zurueck (mit HP, Status, Buffs — der Zustand von vorher).
  ps.heroes[hi] = auftrag.hero;
  engine._trackCard(auftrag.hero.name, auftrag.besitzer, 'hero', hi);

  // Abilities zurueck in ihre Slots.
  if (!ps.abilityZones[hi]) ps.abilityZones[hi] = [[], [], []];
  for (let zi = 0; zi < auftrag.abilities.length; zi++) {
    ps.abilityZones[hi][zi] = (auftrag.abilities[zi] || []).slice();
    for (const name of ps.abilityZones[hi][zi]) {
      engine._trackCard(name, auftrag.besitzer, 'ability', hi, zi);
    }
  }

  // Support-Karten zurueck. Ist der urspruengliche Platz inzwischen
  // besetzt, weicht die Karte auf den naechsten freien Platz DESSELBEN
  // Helden aus; gibt es keinen, bleibt sie draussen (siehe Kopf).
  if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
  const verloren = [];
  for (const eintrag of auftrag.support) {
    let ziel = eintrag.slot;
    if ((ps.supportZones[hi][ziel] || []).length > 0) {
      ziel = -1;
      for (let si = 0; si < 3; si++) {
        if ((ps.supportZones[hi][si] || []).length === 0) { ziel = si; break; }
      }
    }
    if (ziel < 0) { verloren.push(...eintrag.namen); continue; }
    ps.supportZones[hi][ziel] = eintrag.namen.slice();
    for (const name of eintrag.namen) {
      const inst = engine._trackCard(name, eintrag.owner, 'support', hi, ziel);
      if (inst) {
        inst.counters = JSON.parse(JSON.stringify(eintrag.counters || {}));
        inst.controller = eintrag.controller;
        inst.faceDown = !!eintrag.faceDown;
      }
    }
  }

  // Surprises zurueck (verdeckt, wie sie lagen).
  if (auftrag.surprises.length > 0) {
    ps.surpriseZones[hi] = auftrag.surprises.slice();
    for (const name of auftrag.surprises) {
      const inst = engine._trackCard(name, auftrag.besitzer, 'surprise', hi);
      if (inst) inst.faceDown = true;
    }
  }

  ps._teleportedAway = Math.max(0, (ps._teleportedAway || 0) - 1);

  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: auftrag.besitzer, heroIdx: hi, zoneSlot: -1,
  });
  // Rueckkehr: dieselbe Blende rueckwaerts. Der Spielstand steht zu
  // diesem Zeitpunkt schon, das Einblenden laeuft also auf den frisch
  // gezeichneten Zonen.
  engine._broadcastEvent('zone_fade', {
    owner: auftrag.besitzer, zones: blendZonen(auftrag),
    durationMs: BLENDE_MS, direction: 'in', sfx: KLANG_ZURUECK,
  });
  engine.log('teleport_returned', {
    player: ps.username, hero: auftrag.hero.name,
    abilities: auftrag.abilities.flat().length,
    attached: auftrag.support.reduce((n, e) => n + e.namen.length, 0),
    lost: verloren.length ? verloren : undefined,
  });
  engine.sync();
  await engine._delay(BLENDE_MS);
}

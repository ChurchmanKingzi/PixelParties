// ═══════════════════════════════════════════
//  CARD EFFECT: "Teleportation Powder"   (Potion)
//
//  „Choose an undefeated Hero your opponent controls and remove it, its
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
//
//  ── ★ W53a (Al, 22.10.2026): „KEINERLEI Hooks … nach dem Auftauchen EXAKT wie vorher" ──
//  Verschwinden und Wiederauftauchen feuern KEINEN Hook (weder `onCardLeaveZone`/`onCardEnterZone` noch `onEquipLost`/`onEquipGained` noch sonst einen
//  Leave-/Enter-Hook; einzig die Resistance-Pruefung `beforeHeroEffect` laeuft beim Verschwinden, W13). Dazu wird nichts neu erzeugt, sondern der ZUSTAND
//  mitgenommen und unveraendert zurueckgestellt:
//    · der Held ist dasselbe Objekt (kein Klon; HP, Buffs, Status, Aufstiegs-/Gewinn-Marken bleiben, wie sie waren),
//    · jede mitgehende Karteninstanz (Held, Abilities, Surprises, Ausruestung/Anhaengsel samt unsichtbarer Traeger gewonnener Effekte) kommt mit DERSELBEN
//      Instanz-Id, denselben Zaehlern/Stempeln (`atkGranted`, `_taioAtkTotal`, `_taioAtkGrantedBy`, HOPT-Schluessel `equip-effect:<id>` …), derselben
//      Spielzug-Marke (`turnPlayed`) und an derselben Stelle der Instanzliste zurueck (vorher: neue Ids, Zaehler weg — eine Ability wie Fighting verlor
//      dabei ihre Buchung und der Bonus blieb nach dem Ablegen stehen),
//    · der Zaehler `_teleportedAway` verschwindet wieder, wenn er 0 erreicht.
//  Einzige Ausnahme vom Platz: ist die Zone inzwischen fremdbesetzt, weicht die Karte aus (siehe oben).
//
//  ── ★ W54a (Al, 22.10.2026): Karte kann nicht zurueck = NORMALER ABGANG ──────────────────────
//  Findet eine mitgenommene Karte beim Wiederauftauchen keinen Platz (ihre Zone ist fremdbesetzt UND der Held hat keinen freien Platz), bleibt sie draussen und verlaesst den Helden
//  wie bei jedem anderen Abgang: `onEquipLost` (Grund `teleportLost`) an alle Zustandslauscher (Taio, Toras, Aufstiegs-Bereitschaft, Tempeluna …), die Karte raeumt sich selbst auf
//  (`abgangMelden`). Nur dieser Fall feuert Hooks; Verschwinden und normales Auftauchen bleiben hook-frei.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { opponentOfGs } = require('./_opp');

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

/**
 * W53a: merkt sich ALLE Karteninstanzen, die mit dem Helden gehen — mit vollem Zustand (Id, Zaehler, Stempel, Status, Spielzug-Marke, Kontrolle …) und ihrem
 * Platz in der Instanzliste. Das sind der Held selbst, seine Abilities und Surprises, die mitgehenden Support-Karten (Ausruestung/Anhaengsel, nicht Creatures)
 * und die unsichtbaren Traeger gewonnener Heldeneffekte (`_gainedEffectOnly`). `daten` ist eine flache Kopie ohne die Skript-Zwischenablage; eine am Objekt
 * gesetzte `isActiveIn`-Ueberschreibung (Initiation Ritual, Traeger gewonnener Effekte: immer `() => true`) wird als Flag gemerkt.
 */
function instanzenMerken(engine, oi, hi, auftrag) {
  const slots = new Set(auftrag.support.map(e => e.slot));
  const out = [];
  engine.cardInstances.forEach((c, index) => {
    let geht = false;
    if (c.zone === 'hero' || c.zone === 'ability' || c.zone === 'surprise') {
      geht = c.owner === oi && c.heroIdx === hi;
    } else if (c.zone === 'support' && c.heroIdx === hi) {
      if (c.zoneSlot === -1) geht = c.owner === oi && !!c.counters?._gainedEffectOnly;                       // unsichtbarer Traeger eines gewonnenen Heldeneffekts
      else geht = slots.has(c.zoneSlot) && (engine.physicalSide(c) === oi || c.owner === oi || (c.controller ?? c.owner) === oi);
    }
    if (!geht) return;
    const daten = {};
    for (const k of Object.keys(c)) if (k !== 'script' && k !== 'isActiveIn') daten[k] = c[k];
    out.push({ daten, index, aktivUeberschrieben: Object.prototype.hasOwnProperty.call(c, 'isActiveIn') });
  });
  return out;
}

/** W53a: eine gemerkte Instanz mit EXAKT ihrem alten Zustand wieder einsetzen (kein Hook). `zoneSlot` darf abweichen (Ausweichplatz). */
function instanzEinsetzen(engine, eintrag, zoneSlot) {
  const d = eintrag.daten;
  const inst = engine._trackCard(d.name, d.owner, d.zone, d.heroIdx, zoneSlot ?? d.zoneSlot);
  for (const k of Object.keys(d)) inst[k] = d[k];
  if (zoneSlot != null) inst.zoneSlot = zoneSlot;
  inst.script = null;                                                    // wird beim naechsten Zugriff neu geladen
  if (eintrag.aktivUeberschrieben) inst.isActiveIn = () => true;
  // an die alte Stelle der Instanzliste (Hook-Reihenfolge wie vorher)
  const liste = engine.cardInstances;
  liste.pop();
  liste.splice(Math.min(eintrag.index, liste.length), 0, inst);
  return inst;
}

/**
 * ★ W54a: eine Karte, die nicht zum Helden zurueckkehren kann, VERLAESST ihn — wie bei jedem normalen Abgang: sie steht fuer den Moment der Meldung noch an ihrem alten Platz in der
 * Instanzliste (Leave-Semantik; Zaehl-Lauscher schliessen `leavingCard.id` aus), `onCardLeaveZone` geht nur an die Karte selbst (ihre Aufraeum-Haken: ATK-Bonus zurueck, Curse
 * loest sich, Tempelunas Fee nimmt ihren Effekt mit) und der zentrale Verteiler meldet danach `onEquipLost` (Grund `teleportLost`) an alle Zustandslauscher. Danach ist die Instanz
 * weg („nie dort gelegen"); ihre gestempelte ATK-Buchung wird in jedem Fall abgezogen (Sicherheitsnetz, idempotent).
 */
async function abgangMelden(engine, auftrag, eintrag) {
  const d = eintrag.daten;
  const phantom = instanzEinsetzen(engine, eintrag, d.zoneSlot);
  try {
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: phantom, card: phantom, leavingCard: phantom,
      fromZone: 'support', fromOwner: auftrag.besitzer, fromHeroIdx: auftrag.heroIdx, fromZoneSlot: d.zoneSlot,
      _equipGrund: 'teleportLost', source: CARD_NAME, _skipReactionCheck: true,
    });
    engine.actionRevokeAtkAmTraeger(phantom);
  } finally {
    engine.cardInstances = engine.cardInstances.filter(c => c !== phantom);
  }
}

module.exports = {
  isPotion: true,
  // ★ W54a: SCHALTER fuer die Resistance-Pruefung beim Verschwinden (`beforeHeroEffect`, W13/Q144: „Resistance blockt jeden Nicht-Schaden-Effekt"; Kartentext Resistance Lv3: „unaffected by all
  // cards and effects, except damage"). Al hat in W53 auf „Resistance beim Verschwinden weiter laufen lassen?" mit „Nein" geantwortet — das widerspricht dem dokumentierten Ruling Q144/M02-11
  // (Teleportation Powder ist dort ausdruecklich genannt) und dem Resistance-Kartentext; deshalb NICHT umgesetzt, Rueckfrage an Al. Auf `false` gestellt feuert das Verschwinden keinen einzigen Hook.
  resistancePruefung: true,
  // Hooks aus dem LOESCHSTAPEL heraus (siehe Kopfkommentar).
  activeIn: ['deleted'],
  oncePerGame: true,
  oncePerGameKey: CARD_NAME,

  // ★ NUR GEGNERISCHE HELDEN (v1029, Als Textaenderung 12.9.):
  // „Choose an undefeated Hero YOUR OPPONENT controls" — vorher stand
  // dort „any … on the board", eigene Helden waren also waehlbar.
  canActivate(gs, playerIdx) {
    const oi = opponentOfGs(gs, playerIdx);
    if (gs.firstTurnProtectedPlayer === oi) return false;   // Runde-1-Schutz
    return (gs.players[oi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const oi = opponentOfGs(gs, playerIdx);
    // Der Erstrunden-Schutz gilt weiterhin: in Runde 1 ist der Gegner
    // unantastbar — und damit gibt es gar kein Ziel mehr.
    if (gs.firstTurnProtectedPlayer === oi) return [];
    return engine.getHeroTargets(oi);
  },

  targetingConfig: {
    title: CARD_NAME,
    description: "Remove an undefeated Hero your opponent controls — with its Abilities, Equipments and Attachments — from the game. It all returns at the beginning of your next turn.",
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

    // W13 (Q144, Al: Resistance blockt JEDEN Nicht-Schaden-Effekt): „remove it … from the game" ist
    // ein Nicht-Schaden-Effekt auf den Helden. Animation zuerst, dann der zentrale Pruefer; bei
    // Block ist die Potion verbraucht (Einmal-Stempel gesetzt), der Held bleibt unberuehrt.
    if (module.exports.resistancePruefung !== false && await engine.heroNonDamageEffectBlocked(oi, hi, 'remove_from_game', { sourceOwner: pi, source: CARD_NAME })) {
      engine._broadcastEvent('play_zone_animation', {   // Animation trotzdem (Regel: Immunitaeten blocken Effekte, nie Animationen)
        type: 'gold_sparkle', owner: oi, heroIdx: hi, zoneSlot: -1,
      });
      engine.sync();
      return;
    }

    // ── Alles einsammeln, was mitgeht ───────────────────────────────
    const auftrag = {
      besitzer: oi,
      heroIdx: hi,
      rueckkehrBei: pi,                 // zu Beginn von DESSEN naechstem Zug
      gesetztInZug: gs.turn,
      hero: hero,                       // W53a: dasselbe Objekt (kein Klon) — der Zustand kommt EXAKT zurueck
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

    // W53a: die Instanzen, die mitgehen, MIT Zustand merken (Id, Zaehler, Stempel, Spielzug-Marke, Platz in der Instanzliste).
    auftrag.instanzen = instanzenMerken(engine, oi, hi, auftrag);

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
    }
    for (let zi = 0; zi < (ops.abilityZones?.[hi] || []).length; zi++) ops.abilityZones[hi][zi] = [];
    if (ops.surpriseZones?.[hi]) ops.surpriseZones[hi] = [];

    // Alle mitgehenden Instanzen aus der Instanzliste nehmen — still (kein Hook).
    const weg = new Set(auftrag.instanzen.map(e => e.daten.id));
    engine.cardInstances = engine.cardInstances.filter(c => !weg.has(c.id));

    // Heldenobjekt entfernen. Der PLATZ bleibt bestehen (leerer Name) — die
    // Spalte darf nicht wegrutschen, sonst zeigen alle Indizes daneben.
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
  const neu = Array.isArray(auftrag.instanzen);   // Auftraege aus aelteren Spielstaenden haben keinen gemerkten Instanz-Zustand → alter Weg unten

  // Held zurueck (dasselbe Objekt: HP, Status, Buffs, Marken — der Zustand von vorher).
  ps.heroes[hi] = auftrag.hero;
  if (!neu) engine._trackCard(auftrag.hero.name, auftrag.besitzer, 'hero', hi);

  // Abilities zurueck in ihre Slots.
  if (!ps.abilityZones[hi]) ps.abilityZones[hi] = [[], [], []];
  for (let zi = 0; zi < auftrag.abilities.length; zi++) {
    ps.abilityZones[hi][zi] = (auftrag.abilities[zi] || []).slice();
    if (!neu) for (const name of ps.abilityZones[hi][zi]) engine._trackCard(name, auftrag.besitzer, 'ability', hi, zi);
  }

  // Support-Karten zurueck. Ist der urspruengliche Platz inzwischen
  // besetzt, weicht die Karte auf den naechsten freien Platz DESSELBEN
  // Helden aus; gibt es keinen, bleibt sie draussen (siehe Kopf).
  if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
  const verloren = [];
  const platz = {};   // alter Platz → tatsaechlicher Platz (nur gesetzt, wo die Karte zurueckkehrt)
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
    platz[eintrag.slot] = ziel;
    if (!neu) {
      for (const name of eintrag.namen) {
        const inst = engine._trackCard(name, eintrag.owner, 'support', hi, ziel);
        if (inst) {
          inst.counters = JSON.parse(JSON.stringify(eintrag.counters || {}));
          inst.controller = eintrag.controller;
          inst.faceDown = !!eintrag.faceDown;
        }
      }
    }
  }

  // Surprises zurueck (verdeckt, wie sie lagen).
  if (auftrag.surprises.length > 0) {
    ps.surpriseZones[hi] = auftrag.surprises.slice();
    if (!neu) {
      for (const name of auftrag.surprises) {
        const inst = engine._trackCard(name, auftrag.besitzer, 'surprise', hi);
        if (inst) inst.faceDown = true;
      }
    }
  }

  // W53a: alle gemerkten Instanzen mit ihrem alten Zustand zurueck (Id, Zaehler, Stempel, Spielzug-Marke, Platz in der Instanzliste) — in alter Reihenfolge.
  const nichtZurueck = [];   // W54a: Karten, die nicht zurueckkehren koennen (kein freier Platz) — sie gehen als normaler Abgang vom Helden ab (s. u.)
  if (neu) {
    for (const eintrag of auftrag.instanzen.slice().sort((x, y) => x.index - y.index)) {
      const d = eintrag.daten;
      if (d.zone === 'support' && d.zoneSlot >= 0) {
        if (platz[d.zoneSlot] === undefined) { nichtZurueck.push(eintrag); continue; }   // kein Platz mehr: die Karte bleibt draussen
        instanzEinsetzen(engine, eintrag, platz[d.zoneSlot]);
      } else {
        instanzEinsetzen(engine, eintrag, null);
      }
    }
  }

  // Zaehler zurueck auf „nie entrueckt" (nicht auf 0 stehen lassen).
  const rest = Math.max(0, (ps._teleportedAway || 0) - 1);
  if (rest > 0) ps._teleportedAway = rest; else delete ps._teleportedAway;
  // ★ W54a (Al, 22.10.2026: „Ja" — eine Karte, die nicht zurueckkehren kann, soll wie ein NORMALER ABGANG behandelt werden): der Held ist wieder da, die Karte bleibt draussen und
  // verlaesst ihn damit. Der Abgang laeuft wie jeder andere (`abgangMelden`): Grund `teleportLost`, `onEquipLost` an alle Zustandslauscher (Taio, Toras, Aufstiegs-Bereitschaft …),
  // die Karte raeumt sich selbst auf (ATK-Bonus zurueck, Fluch loest sich, Tempelunas Fee nimmt ihren Effekt mit). Danach ist der Zustand „nie dort gelegen".
  // Alle anderen Faelle (Verschwinden, normales Auftauchen) bleiben hook-frei (W53a).
  for (const eintrag of nichtZurueck) await abgangMelden(engine, auftrag, eintrag);

  // W18b (Al 19.10.: „via Teleport Powder zurueckkehrende Heroes bekommen automatisch den Status/Debuff"): laeuft eine Anti Magic Zone,
  // ist der Rueckkehrer gesperrt. Keine Eintritts-Hooks (Regel 11.9.) — nur der Zonen-Status.
  await engine.amzFensterAufHeldAnwenden(auftrag.besitzer, hi);

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

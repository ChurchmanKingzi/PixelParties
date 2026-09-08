// ═══════════════════════════════════════════
//  CARD EFFECT: "Thicket"
//  Artifact (Normal, 4 Gold)
//
//  „Choose a Creature you control. That Creature cannot be chosen by
//   cards and effects until the beginning of your next turn. A Creature
//   cannot be affected by \"Thicket\" on 2 consecutive turns.\"
//
//  Auslegung
//  ─────────
//  • „cannot be chosen by cards and effects\" — OHNE den Zusatz „by
//    your opponent\", den Perfect Disguise ausdruecklich traegt. Der
//    Schutz gilt deshalb fuer BEIDE Seiten: auch der eigene Spieler
//    kann die Kreatur nicht mehr anwaehlen, solange sie im Dickicht
//    steht. Das ist der Preis des Schutzes.
//  • Und es gibt kein „ausser sie ist das einzige Ziel\"-Ventil
//    (Perfect Disguise hat genau das, Thicket nicht) — die Marke ist
//    hart: `counters.untargetable_all` (v724), gefiltert in beiden
//    Ziel-Sammlern der Engine.
//  • Flaechen-Effekte, die gar nicht WAEHLEN, sondern ueber jedes
//    legale Ziel fahren (Heat Wave, Cataclysm), bleiben unberuehrt —
//    dieselbe Auslegung, die Perfect Disguise seit jeher dokumentiert.
//  • „until the beginning of your next turn\": die Marke faellt im
//    START-Durchgang des WIRKERS (Engine, neben der Perfect-Disguise-
//    Aufraeumung). Der ganze Gegnerzug liegt dazwischen.
//  • „not on 2 consecutive turns\": der Zeitstempel `counters.thicketTurn`
//    haelt fest, wann die Kreatur zuletzt im Dickicht stand. `gs.turn`
//    zaehlt HALBE Zuege, mein naechster Zug ist also +2. Gesperrt ist
//    damit alles mit `gs.turn - thicketTurn <= 2`; ab +4 geht es
//    wieder — dann liegt ein eigener Zug ohne Thicket dazwischen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Thicket';

/** Darf diese Instanz JETZT ins Dickicht? (Sperre fuer Folgezuege) */
function darfInsDickicht(engine, inst) {
  const letzte = inst?.counters?.thicketTurn;
  if (letzte == null) return true;
  return (engine.gs.turn - letzte) > 2;
}

module.exports = {
  isTargetingArtifact: true,

  cpuMeta: {
    // Wie bei Perfect Disguise liegt der ganze Nutzen im GEGNERZUG —
    // unmittelbar nach dem Spielen sieht das Bewertungs-Gate nur
    // −4 Gold. Ohne Anstoss wuerde die Karte praktisch nie gespielt.
    // Anders als dort gibt es hier KEINE Einmal-pro-Spiel-Klausel, der
    // Anstoss darf also milder ausfallen: es muss ueberhaupt etwas zu
    // schuetzen geben (eine erlaubte eigene Kreatur) und der Gegner
    // muss handlungsfaehig sein (ab Zug 2).
    alwaysCommit: (engine, pi) => {
      try {
        const gs = engine?.gs;
        if (!gs || (gs.turn || 0) < 3) return false;
        return (module.exports.getValidTargets(gs, pi, engine) || []).length > 0;
      } catch { return false; }
    },
  },

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;                       // Sammler entscheidet
    return module.exports.getValidTargets(gs, pi, eng).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return [];
    const targets = [];
    for (const inst of eng.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== pi) continue;
      if (inst.faceDown) continue;
      // Nur echte Creatures (Equipment, Attachments, Token ohne
      // Kreaturen-Charakter fallen raus).
      const cd = eng.getEffectiveCardData(inst) || eng._getCardDB()[inst.name];
      if (!cd || !eng.isChoosableAsCreature(inst, cd)) continue;
      // „not on 2 consecutive turns\"
      if (!darfInsDickicht(eng, inst)) continue;
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose one of your Creatures. Nothing can choose it until your next turn — not even you.',
    confirmLabel: '🌿 Hide!',
    confirmClass: 'btn-info',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
    maxTotal: 1,
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    // Instanz frisch aufloesen — zwischen Zielwahl und Aufloesung kann
    // eine Reaktion das Brett gedreht haben.
    const inst = engine.cardInstances.find(c =>
      c.zone === 'support' && c.owner === target.owner
      && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    ) || target.cardInstance;
    if (!inst || inst.zone !== 'support') return false;
    if (!darfInsDickicht(engine, inst)) return false;

    if (!inst.counters) inst.counters = {};
    inst.counters.untargetable_all = 1;
    inst.counters.untargetable_all_pi = pi;      // wessen Zugbeginn raeumt auf
    inst.counters.thicketTurn = engine.gs.turn;  // Sperre fuer den Folgezug

    // Auftritt: 34 Blaetter und Halme schlagen von aussen ueber der
    // Zone zusammen (`thicket_cover`, v724 — eigene Animation, Klang
    // `elem_biomancy` tiefer gefahren, s. ZONE_ANIM_SFX).
    engine._broadcastEvent('play_zone_animation', {
      type: 'thicket_cover',
      owner: inst.controller ?? inst.owner,
      heroIdx: inst.heroIdx,
      zoneSlot: inst.zoneSlot,
    });
    engine.sync();
    await engine._delay(700);
    return true;
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: „Wavilion"
//  Creature (Summoning Magic Lv 0, 50 HP, PP CROSS, Banned)
//
//  „When the corresponding Hero defeats a target with an Attack,
//   permanently increase its Attack stat by 100 afterwards."
//
//  BAUART
//  ──────
//  • „the corresponding Hero" = der Held, in dessen Support Zone diese
//    Karte liegt (Als Vokabular-Ruling 8.8., gilt kartenuebergreifend).
//    Das ist zugleich der Held, dessen Attack-Wert steigt — „its"
//    bezieht sich auf ihn, nicht auf das besiegte Ziel (das ist ja weg).
//
//  • ★ DAUERHAFT heisst hier WIRKLICH dauerhaft (Als Vorgabe 12.9.):
//    der Zuwachs bleibt, auch wenn Wavilion das Brett verlaesst.
//    Deshalb `engine._applyHeroAtkDelta(...)` und NICHT `ctx.grantAtk`:
//    letzteres schreibt `counters.atkGranted` auf die Karteninstanz mit
//    und ist der Weg fuer Ausruestung, die ihren Bonus beim Verlassen
//    der Zone per `revokeAtk` wieder einkassiert. `_applyHeroAtkDelta`
//    fasst den Wert direkt an, kennt aber die Curse-Unterdrueckung
//    (Held auf 0 gepinnt → der Zuwachs wandert in den versteckten
//    Sammler und kommt beim Reinigen zurueck) und sendet den
//    `fighting_atk_change`-Ausschlag fuer die Anzeige. Es gibt in der
//    Engine KEINEN automatischen Widerruf — nur Karten, die
//    `revokeAtk` selbst rufen, nehmen etwas zurueck. Wavilion tut das
//    bewusst nie, auch nicht in `onCardLeaveZone`.
//    Vorbild: Nero Zira („permanently increase this Hero's Attack").
//
//  • Ausloeser-Erkennung „besiegt ein Ziel mit einem Angriff" nach dem
//    Muster von Explosivo's Sword (dieselbe Textstelle):
//      – HELD als Ziel  → `afterDamage`, `ctx.type === 'attack'`, Quelle
//        ist der entsprechende Held, `target.hp <= 0` nach dem Treffer.
//      – CREATURE als Ziel → `afterCreatureDamageBatch`, je Eintrag
//        dieselben Tore plus `inst.counters.currentHp <= 0`.
//    `source.zone === 'support'` schliesst Kreaturen aus, die im selben
//    Slot sitzen und denselben `heroIdx` tragen — der Held soll
//    zuschlagen, nicht sein Gefolge.
//
//  • EINMAL JE ANGRIFF, nicht je besiegtem Ziel. Ein Flaechenangriff,
//    der drei Ziele umlegt, gibt +100, nicht +300. Die Engine selbst
//    behandelt die QUELLENINSTANZ als Identitaet eines Angriffs — sie
//    entprellt `onAttackDeclare` ueber `source._attackDeclareFired` und
//    sammelt im Schadens-Batch die eindeutigen Quellen in einem Set.
//    Wavilion haengt seine Marke an dieselbe Stelle, aber MIT DER
//    EIGENEN KARTEN-ID im Schluessel: liegen zwei Wavilions beim
//    selben Helden, gibt jeder seine 100 (der Text kennt keine
//    Einmal-Klausel, nur die Quelle darf sich nicht doppelt zaehlen).
//
//  • Der Held bekommt seinen Zuwachs auch dann, wenn er den Angriff
//    selbst nicht ueberlebt hat (Rueckstoss): der Wert ist dauerhaft,
//    besiegte Helden bleiben auf dem Brett und sind wiederbelebbar.
// ═══════════════════════════════════════════

const CARD_NAME = 'Wavilion';
const ATK_BONUS = 100;

/**
 * Die Seite, auf der Wavilion physisch liegt — also die Spalte des
 * „corresponding Hero". `physicalSide` beruecksichtigt gestohlene
 * Karten; bei einer uebernommenen Creature ist der entsprechende Held
 * der, unter dem sie jetzt tatsaechlich steht.
 */
function eigeneSeite(engine, ich) {
  return engine.physicalSide(ich);
}

/** Ist diese Schadensquelle der Angriff des entsprechenden Helden? */
function vomEntsprechendenHelden(engine, ich, quelle, typ) {
  if (typ !== 'attack' || !quelle) return false;
  // Eine Creature im selben Slot teilt sich den `heroIdx` mit ihrem
  // Wirt, ist aber eine eigene Quelle — nicht der Held.
  if (quelle.zone === 'support') return false;
  if ((quelle.heroIdx ?? -1) !== ich.heroIdx) return false;
  // `heroOwner` steht auf Quellen, bei denen ein FREMDER Held den
  // Angriff koerperlich ausfuehrt (Charme, Love Shot) — dann zaehlt er,
  // nicht der Spieler, der die Karte gespielt hat.
  const angreiferSeite = quelle.heroOwner ?? quelle.owner ?? quelle.controller;
  return angreiferSeite === eigeneSeite(engine, ich);
}

/**
 * Den Zuwachs geben — genau einmal je Angriff und Wavilion-Instanz.
 * Die Marke haengt an der QUELLENINSTANZ des Angriffs, weil die Engine
 * dieselbe Identitaet fuer ihre eigene Angriffs-Entprellung benutzt.
 */
async function gibZuwachs(ctx, quelle) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const ich = ctx.card;
  const marke = `_wavilionFired_${ich.id}`;
  if (quelle[marke]) return;
  quelle[marke] = true;

  const pi = eigeneSeite(engine, ich);
  const hero = gs.players[pi]?.heroes?.[ich.heroIdx];
  if (!hero?.name) return;

  // ★ Grundregel (CARD_API): ein Effekt, der aus einem HOOK heraus
  // feuert, streamt seine Karte an BEIDE Spieler. Es gibt keinen
  // Abbruchpunkt davor — der Effekt ist verpflichtend.
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

  // Eigene Animation (v943, Als Vorgabe): ein buffender Wasserzauber
  // auf dem entsprechenden Helden — Wavilion ist ein Fisch, er schwimmt
  // in der aufsteigenden Saeule mit. Registry-Eintrag `water_blessing`
  // in app-board.jsx, Klang in ZONE_ANIM_SFX. Der Zuwachs faellt erst
  // NACH dem Aufstieg, damit die Zahl zum abgesetzten Segen hochgeht
  // und nicht davor.
  engine._broadcastEvent('play_zone_animation', {
    type: 'water_blessing', owner: pi, heroIdx: ich.heroIdx, zoneSlot: -1,
    duration: 1200,
  });
  await engine._delay(620);

  engine._applyHeroAtkDelta(hero, pi, ich.heroIdx, ATK_BONUS);
  engine.log('atk_grant', { hero: hero.name, amount: ATK_BONUS, source: CARD_NAME });
  engine.sync();
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'water_blessing' }, impactMs: 260,
  },

  activeIn: ['support'],

  cpuMeta: {
    // Wavilion soll LEBEN — er bringt nur etwas, solange er liegt.
    // `cardValueFloor` hebt den gelernten Kartenwert (Trainingspipeline),
    // `cpuInstBonus` den Brettwert der liegenden Instanz. Massstab:
    // ein Support-Slot ist 30 wert, den bekommt die Karte ohnehin —
    // die 25 hier sind der Aufschlag dafuer, dass jeder toedliche
    // Angriff des Wirts dauerhaft +100 Attack bedeutet.
    //
    // ★ MUSS EINE FUNKTION SEIN: die Schleife in `evaluateState` prueft
    // `typeof fn !== 'function'` und ueberspringt alles andere. Eine
    // blosse Zahl ist eine tote Anmeldung.
    cardValueFloor: 70,
    cpuInstBonus(engine, inst, ownerIdx) {
      const hero = engine?.gs?.players?.[ownerIdx]?.heroes?.[inst?.heroIdx];
      if (!hero?.name || hero.hp <= 0) return 0;   // toter Wirt greift nicht an
      return 25;
    },
  },

  hooks: {
    // ── Der entsprechende Held besiegt einen HELDEN ──────────────────
    // `afterDamage` laeuft, nachdem die HP verrechnet sind und bevor
    // ON_HERO_KO feuert — dieselbe Stelle, an der Explosivo's Sword
    // seinen Treffer erkennt.
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      if (!ich) return;
      const quelle = ctx.source;
      if (!vomEntsprechendenHelden(engine, ich, quelle, ctx.type)) return;

      const ziel = ctx.target;
      // Helden tragen `.statuses`; Kreaturen laufen ueber den Batch-Hook.
      if (!ziel || ziel.hp === undefined || !ziel.statuses) return;
      if (ziel.hp > 0) return;                       // ueberlebt → kein Zuwachs

      await gibZuwachs(ctx, quelle);
    },

    // ── Der entsprechende Held besiegt eine CREATURE ─────────────────
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      if (!ich || !ctx.entries) return;

      for (const e of ctx.entries) {
        if (!vomEntsprechendenHelden(engine, ich, e.source, e.type)) continue;
        const inst = e.inst;
        if (!inst || (inst.counters?.currentHp ?? 1) > 0) continue;
        await gibZuwachs(ctx, e.source);
        return;                                       // einmal je Angriff
      }
    },
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Forbidden Grimoire"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Forbidden Grimoire of a Forgotten Sorceress\". This Creature may
//   once per turn use the active effects of up to 2 Creatures on the
//   board with different names, except \"Spirit of the Forbidden
//   Grimoire\", whose combined levels do not exceed 4. Both effects are performed at the
//   same time. Effects used by this Creature cannot be used another
//   time for the rest of the turn in any way afterwards.\"
//   (Fassung Al 5.9.)
//
//  Ablauf (Als Vorgabe 5.9.)
//  ─────────────────────────
//  ERST werden BEIDE Kreaturen gewaehlt, DANN laufen ihre Effekte —
//  keine Zielwahl vor der zweiten Kreaturenwahl. Die zweite Liste ist
//  bereits auf das Restbudget gefiltert (4 minus Level der ersten), die
//  Summenregel ist also nie verletzbar.
//
//  ★ GRENZE, die ich nicht heimlich uebergehe: „performed at the same
//    time\" ist mit der heutigen Kreaturen-Schnittstelle nicht woertlich
//    machbar. `onCreatureEffect` waehlt seine Ziele SELBST und wirkt in
//    derselben Funktion — Zielwahl und Aufloesung lassen sich von
//    aussen nicht trennen. Umgesetzt ist deshalb die naechstliegende
//    Form: beide Effekte laufen unmittelbar nacheinander in EINEM
//    Block, ohne Fenster, Phase oder Gegnerzug dazwischen, und mit
//    erzwungener Aufloesung (kein Abbruch mittendrin). Fuer echte
//    Gleichzeitigkeit braeuchte es einen zweistufigen Vertrag
//    (`prepareCreatureEffect` → Ziele, dann `onCreatureEffect` mit
//    diesen Zielen) in JEDEM Kreaturenskript.
//
//  Sperre danach
//  ─────────────
//  „cannot be used another time for the rest of the turn IN ANY WAY\" —
//  zwei Marken: die normale Rundensperre (`creature-effect:<id>`, damit
//  der Client die Kreatur ausgraut) UND `counters._effectLockedTurn`
//  (v748), die auch geschenkte Wiederholungen bindet: Kohta kann einen
//  so verbrauchten Effekt nicht nachzuenden, und ein zweiter Grimoire
//  ihn nicht noch einmal leihen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { GRIMOIRE_NAME, hasGrimoire } = require('./_fiona-shared');

const CARD_NAME = 'Spirit of the Forbidden Grimoire';
const MAX_SUMME = 4;

/** Effektives Level einer Kreatur auf dem Brett. */
function levelVon(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  const lv = cd?.level;
  return Number.isFinite(lv) ? lv : 0;
}

/**
 * Alle Kreaturen auf dem Brett mit einem AKTIVEN Effekt — „on the
 * board\", also beide Seiten.
 *
 * Rueckgabe je Eintrag: `{ inst, ineligible, grund }`.
 *
 * NICHT in der Liste (gar nicht erst gezeigt): dieser Archetyp selbst,
 * alles ohne aktiven Effekt, verdeckte Karten. Die haben mit dem
 * Effekt nichts zu tun.
 *
 * MIT `ineligible` (gezeigt, aber ausgegraut — Als Vorgabe 5.9.):
 * Kreaturen, deren Effekt gerade nicht laufen KANN. Der Spieler soll
 * sehen, dass es sie gibt und dass sie eben nicht gehen — statt sich
 * zu fragen, wo Cosmic Skeleton hin ist. Gruende: negiert, in diesem
 * Zug schon verbraucht, eigene Bedingung nicht erfuellt (Cosmic
 * Skeleton: lebender Traegerheld und eine Schule ausser Summoning
 * Magic), oder allein schon ueber dem Levelbudget.
 *
 * Die dynamischen Schranken — gleicher Name, Restbudget nach der
 * ersten Wahl — regelt der Picker live (`uniqueBy`, `maxBudget`).
 */
function sammleKandidaten(engine) {
  const { loadCardEffect } = require('./_loader');
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.name === CARD_NAME) continue;                 // „except …\"
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const script = loadCardEffect(inst.name);
    if (!script?.onCreatureEffect) continue;               // kein aktiver Effekt

    let grund = null;
    if (inst.counters?.negated || inst.counters?.nulled) grund = 'negated';
    else if (inst.counters?._effectLockedTurn === engine.gs.turn) grund = 'used this turn';
    else if (levelVon(engine, inst) > MAX_SUMME) grund = `level ${levelVon(engine, inst)}`;
    else if (typeof script.canActivateCreatureEffect === 'function') {
      try {
        if (!script.canActivateCreatureEffect(engine._createContext(inst, {}))) {
          grund = 'requirements not met';
        }
      } catch { grund = 'requirements not met'; }
    }
    out.push({ inst, ineligible: !!grund, grund });
  }
  return out;
}

/** Nur die tatsaechlich ausleihbaren. */
function ausleihbar(engine) {
  return sammleKandidaten(engine).filter(k => !k.ineligible).map(k => k.inst);
}

/**
 * EIN Picker fuer BEIDE Kreaturen (v750, Als Befund 5.9.).
 *
 * Frueher liefen zwei Picker nacheinander — das las sich wie zwei
 * getrennte Entscheidungen und machte den Abbruchknopf mehrdeutig.
 * Jetzt ist es ein echter Mehrfach-Picker:
 *   • bis zu 2 Ziele (`maxTotal`),
 *   • gleiche Namen prallen beim Klick ab (`uniqueBy: 'cardName'`),
 *   • die Levelsumme ebenso (`maxBudget` + `budgetCost` je Ziel),
 *   • „✓ Done" bestaetigt die Auswahl — auch mit nur EINER Kreatur,
 *   • Cancel/Escape bricht den ganzen Effekt ab.
 * Beide Regeln sind neu im Client und damit fuer jede kuenftige Karte
 * mit Summen- oder Namensschranke verfuegbar.
 */
async function waehleBeide(engine, pi, kandidaten) {
  const ziele = kandidaten.map(({ inst, ineligible, grund }) => ({
    id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
    type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
    slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    budgetCost: levelVon(engine, inst),
    // Gezeigt, aber nicht anklickbar — der Client graut `ineligible`
    // von selbst aus.
    ineligible: ineligible || undefined,
    ineligibleReason: grund || undefined,
  }));
  const wahl = await engine.promptEffectTarget(pi, ziele, {
    title: CARD_NAME,
    description: `Choose up to 2 Creatures with different names whose levels add up to at most ${MAX_SUMME}. Their effects resolve together.`,
    confirmLabel: '📖 Copy',
    confirmClass: 'btn-info',
    cancelLabel: 'Cancel',
    cancellable: true,
    previewCardName: CARD_NAME,
    maxTotal: 2, minRequired: 1,
    uniqueBy: 'cardName',
    maxBudget: MAX_SUMME,
  });
  if (!wahl || wahl.length === 0) return null;        // Cancel/Escape

  // Serverseitig nachrechnen — der Client ist nur die Bequemlichkeit.
  const gewaehlt = wahl
    .map(id => ziele.find(z => z.id === id && !z.ineligible)?.cardInstance)
    .filter(Boolean);
  const gefiltert = [];
  let summe = 0;
  for (const inst of gewaehlt) {
    if (gefiltert.some(x => x.name === inst.name)) continue;
    const lv = levelVon(engine, inst);
    if (summe + lv > MAX_SUMME) continue;
    gefiltert.push(inst);
    summe += lv;
  }
  return gefiltert.length > 0 ? gefiltert : null;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: { dealsDamage: true },

  /** „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hasGrimoire(engine, pi, heroIdx);
  },

  canActivateCreatureEffect(ctx) {
    return ausleihbar(ctx._engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    // ── Schritt 1: BEIDE Kreaturen in EINEM Picker waehlen, bevor
    //    irgendein Ziel gewaehlt wird. ─────────────────────────────
    const kandidaten = sammleKandidaten(engine);
    if (!kandidaten.some(k => !k.ineligible)) return false;

    const geliehen = await waehleBeide(engine, pi, kandidaten);
    if (!geliehen) return false;                    // Cancel — spurlos

    // ── Schritt 2: ZIELWAHL beider Effekte, noch ohne Wirkung ─────
    // Zweistufiger Vertrag (v749): Karten mit `prepareCreatureEffect`
    // waehlen hier bereits ihre Ziele. Damit ist „both effects are
    // performed at the same time" woertlich erfuellt — keine Wirkung
    // faellt, bevor nicht ALLE Ziele stehen.
    const plaene = new Map();
    for (const inst of geliehen) {
      if (inst.zone !== 'support') continue;
      const { ok, plan } = await engine.prepareCreatureEffectFor(inst, pi, { forceResolve: true });
      if (ok) plaene.set(inst.id, plan);
    }

    // ── Schritt 3: wirken, DANACH sperren ────────────────────────
    // Die Sperre greift „afterwards" — nach dem Gebrauch durch diese
    // Karte. Sie vor dem Lauf zu setzen war zu frueh: dann sahen
    // Beobachter, die WAEHREND des Blocks reagieren (Kohta nach einem
    // Kill des ersten Effekts), den Effekt bereits als verbraucht und
    // schwiegen (Als Befund 5.9.).
    for (const inst of geliehen) {
      if (inst.zone !== 'support') continue;        // zwischendurch gefallen
      await engine.reactivateCreatureEffect(inst, pi, {
        ignoreEffectLock: true,
        plan: plaene.has(inst.id) ? plaene.get(inst.id) : undefined,
      });
    }
    for (const inst of geliehen) {
      if (!inst.counters) inst.counters = {};
      inst.counters._effectLockedTurn = engine.gs.turn;
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      engine.gs.hoptUsed[`creature-effect:${inst.id}`] = engine.gs.turn;
    }

    engine.sync();
    return true;
  },
};

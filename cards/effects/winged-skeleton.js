// ═══════════════════════════════════════════
//  CARD EFFECT: "Winged Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  Once per turn, when a "Skeleton" Creature you control is chosen by
//  an opponent's card or effect, you may return that Creature back to
//  your hand to negate the card or effect.
//
//  ★ Als Ruling (Al 26.10.): „Es soll der GANZE Effekt negiert werden, aber Winged Skeleton darf nur feuern, wenn ein Skelett GEWÄHLT wird, also z. B. nicht bei
//  Flame Avalanche."
//   • GEWÄHLT: die Karte hängt am Fenster NACH DER ZIELWAHL (`isEquippedPostTargetReaction`, dieselbe Bauform wie Cool Tech Jetpack / Future Tech Weathercock):
//     `promptDamageTarget`, `promptMultiTarget` und der Dispatcher `promptEffectTarget` (nach der Bestätigung der Ziele) fragen sie, bevor irgendein Treffer fällt.
//     Ein Flächenschlag („all targets": Flame Avalanche, Hole in the Sky, Heat Wave …) WÄHLT niemanden — er öffnet das Fenster nur mit `_isAoeCheck` bzw. ohne
//     Auswahl-Ziele (kein `cardInstance`) und lässt die Karte schweigen (CARD_API „Ein Flächenschlag WÄHLT niemanden").
//   • GANZER EFFEKT: die Rückgabe liefert `{ effectNegated: true }` — wie bei Anti Magic Shield & Co. bricht die auswählende Karte/der Effekt ab, auch die übrigen
//     gewählten Ziele (Helden, andere Kreaturen) werden nicht mehr getroffen. `negatesWholeCard`: die gewirkte Karte löst nie auf (Einmal-Stempel zurück).
//   • Bisher lauschte die Karte an `beforeCreatureAffected` / `beforeCreatureDamageBatch` und negierte nur den Treffer auf das Skelett (bei Mehrzielwahl blieben die
//     anderen Ziele getroffen) — und feuerte bei einem Flächenschlag, der zufällig nur ein Skelett traf. Beide Hooks sind weg.
//
//  Umsetzung:
//   • `postTargetCondition`: die Quelle gehört dem Gegner (`sourceOwner !== pi`), kein Flächenschlag (`_isAoeCheck`), diese Instanz ruht nicht (frozen/negated …),
//     ihr Einmal-pro-Zug-Stempel (`counters.wingedSkeletonNegate`, je Instanz) ist frei, und unter den GEWÄHLTEN Zielen steht mindestens ein Skelett, das du kontrollierst.
//   • `postTargetResolve`: sind mehrere deiner Skelette gewählt, wählst du, welches zurückgeht (genau eines je Einsatz); es geht in die Hand seines KONTROLLEURS
//     (Herkunft bleibt gemerkt, W64c), der Stempel wird gesetzt, der Effekt negiert.
//   • Die Rückfrage („Activate?") stellt die Engine (`postTargetMessage` formuliert sie für Kreaturen statt „your Hero").
//
//  Per-turn cap: SOFT once-per-turn — each Winged Skeleton instance has its own per-turn negation slot, stored on `inst.counters.wingedSkeletonNegate`. Two Winged
//  Skeletons each get their own activation per the default Creature HOPT semantics.
// ═══════════════════════════════════════════

const { anyName } = require('./_alias-name');   // Shroomasaur: Zusatzname zählt für Namensfamilien
const { isSkeletonCreature } = require('./_skeleton-shared');

const CARD_NAME = 'Winged Skeleton';
const HOPT_KEY = 'wingedSkeletonNegate';

function alreadyUsedThisTurn(gs, inst) {
  return inst?.counters?.[HOPT_KEY] === gs.turn;
}
function stampUsed(gs, inst) {
  if (!inst) return;
  if (!inst.counters) inst.counters = {};
  inst.counters[HOPT_KEY] = gs.turn;
}

/**
 * Splice the targeted Skeleton off the board and back into its
 * original owner's hand. Mirrors Sparkfly Worker's stealBoardCardToHand
 * pattern but restricted to support-zone Skeletons. Fires the
 * cross-side flight animation so the bounce is visible on both clients.
 */
function bounceSkeletonToHand(engine, targetInst) {
  const gs = engine.gs;
  // W64c (Al 23.10.2026: „Bounce geht an den aktuellen Kontrolleur", Herkunft bleibt): Brettseite = wo die Kreatur liegt, Hand = die des KONTROLLEURS
  // („return that Creature back to YOUR hand"), Besitzer = permanenter Besitzer (Platzmarke → spätere Stapel gehören ihm).
  const seite = engine.physicalSide(targetInst);
  const ktrl = engine.kontrolleurVon(targetInst);
  const besitzer = engine.kartenBesitzerVon(targetInst);
  const boardPs = gs.players[seite];
  const handPs = gs.players[ktrl];
  if (!boardPs || !handPs) return false;
  const supportSlot = boardPs.supportZones?.[targetInst.heroIdx]?.[targetInst.zoneSlot] || [];
  const slotIdx = supportSlot.indexOf(targetInst.name);
  if (slotIdx >= 0) supportSlot.splice(slotIdx, 1);
  engine.handZugangSync(handPs, targetInst.name, { von: 'brett', source: CARD_NAME, ...(besitzer !== ktrl ? { originalOwner: besitzer } : {}) });
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: seite,
    toOwner: ktrl,
    cardName: targetInst.name,
    from: 'support',
    to: 'hand',
    fromHeroIdx: targetInst.heroIdx,
    fromSlotIdx: targetInst.zoneSlot,
    toHandIdx: handPs.hand.length - 1,
  });
  engine._untrackCard(targetInst.id);
  return true;
}

/**
 * Die GEWÄHLTEN Skelette, die `pi` kontrolliert. Nur echte Auswahl-Ziele zählen (Zielobjekt mit `cardInstance`, so liefern es die Zielwähler); die Ziele der
 * Flächen-/Batch-Fenster der Engine („type: creature" ohne Instanz) sind keine Wahl.
 */
function gewaehlteSkelette(engine, pi, targets) {
  const out = [];
  for (const t of (targets || [])) {
    const inst = t?.cardInstance || t?._cardInstance;   // manche Skripte führen ihre Kreaturen-Ziele nur als `_cardInstance` (Skeleton Archer …)
    if (!inst || inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (!engine.cardInstances.includes(inst)) continue;
    if (!anyName(inst, (n) => isSkeletonCreature(n, engine))) continue;
    if (!out.includes(inst)) out.push(inst);
  }
  return out;
}

module.exports = {
  // „negate the card or effect" = die gewirkte Karte löst NIE auf → ihre Einmal-Stempel werden zurückgegeben (Engine: `_merkeGanzeNegation`).
  negatesWholeCard: true,

  activeIn: ['support'],

  isEquippedPostTargetReaction: true,
  postTargetKreaturWahl: true,   // sieht auch die gewählten KREATUREN aus der allgemeinen Zielwahl (`promptEffectTarget`, Engine v1368)

  // CPU: die Rückkehr kostet nur ein Skelett-Handkarten-Replay, der Effekt des Gegners fällt ganz weg — immer annehmen.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && (promptData?.title === CARD_NAME || promptData?.reactionCardName === CARD_NAME)) return { confirmed: true };
    return undefined;
  },

  /**
   * CPU-Vorabpruefung (W82b, Vertrag `cpuSchuetzt`, gelesen von `engine.kreaturGeschuetztVor`): dieses Winged Skeleton negiert die Wirkung, wenn sie ein Skelett seines Kontrolleurs WAEHLT
   * (`e.gerichtet`; ein Flaechenschlag waehlt niemanden), von einem Gegner kommt, negierbar ist, das Skelett nicht ruht und sein Einmal-Stempel dieses Zuges frei ist.
   */
  cpuSchuetzt(engine, traeger, ziel, e) {
    if (!e?.gerichtet || e.canBeNegated === false) return false;
    const gs = engine.gs;
    const pi = traeger.controller ?? traeger.owner;
    if (!(e.quelleOwner >= 0) || e.quelleOwner === pi) return false;
    if (alreadyUsedThisTurn(gs, traeger)) return false;
    if ((ziel.controller ?? ziel.owner) !== pi) return false;
    return anyName(ziel, (n) => isSkeletonCreature(n, engine));
  },

  postTargetCondition(gs, pi, engine, targets, sourceCard, opts) {
    const inst = opts?.inst;
    if (!inst || inst.zone !== 'support') return false;
    if (sourceCard?._isAoeCheck) return false;                       // ein Flächenschlag wählt niemanden
    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (sourceOwner === pi || sourceOwner < 0) return false;        // nur „an opponent's card or effect"
    if (alreadyUsedThisTurn(gs, inst)) return false;
    if (engine.isCardPassiveDormant?.(inst)) return false;           // gefroren / betäubt / negiert …
    return gewaehlteSkelette(engine, pi, targets).length > 0;
  },

  /** Formuliert die Rückfrage der Engine für Kreaturen („is targeting your Hero!" passt hier nicht). */
  postTargetMessage(engine, srcName, opts, targets) {
    const inst = opts?.inst;
    const pi = inst ? (inst.controller ?? inst.owner) : -1;
    const namen = gewaehlteSkelette(engine, pi, targets).map(i => i.name);
    return `${srcName} is choosing ${namen.join(', ')}! Return it to your hand to negate the card or effect?`;
  },

  async postTargetResolve(engine, pi, targets, sourceCard, opts) {
    const gs = engine.gs;
    const inst = opts?.inst;
    const kandidaten = gewaehlteSkelette(engine, pi, targets);
    if (kandidaten.length === 0) return {};
    let ziel = kandidaten[0];
    if (kandidaten.length > 1) {
      // Mehrere deiner Skelette sind gewählt: genau EINES geht zurück — du wählst (Pflichtwahl, der Rückgabepreis ist schon zugesagt).
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Which chosen Skeleton do you return to your hand?',
        options: kandidaten.map((c, i) => ({ id: `n-${i}`, label: `${c.name}` })),
        cancellable: false,
      });
      const m = String(wahl?.optionId || '').match(/^n-(\d+)$/);
      if (m && kandidaten[Number(m[1])]) ziel = kandidaten[Number(m[1])];
    }
    stampUsed(gs, inst);
    bounceSkeletonToHand(engine, ziel);
    engine.log('winged_skeleton_negate', {
      player: gs.players[pi]?.username,
      rescued: ziel.name,
      sourceCard: sourceCard?.name || 'unknown',
      verb: 'chosen',
    });
    engine.sync();
    return { effectNegated: true };
  },
};

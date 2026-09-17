// ═══════════════════════════════════════════
//  CARD EFFECT: „Hat of Madness"
//  Artifact / EQUIPMENT (Kosten 6, PP MSGB)
//
//  „Whenever the equipped Hero performs an Action, its controller must
//   add a card from their hand to their opponent's hand."
//
//  (Kosten standen bis v952 bei 10 — Als Anpassung 12.9., in
//   cards.json.)
//
//  BAUART
//  ──────
//  • Equipment-Konvention: die Platzierung treibt der Subtyp
//    „Equipment" aus cards.json, das Skript kuemmert sich nur um den
//    Trigger und hoert aus der Support Zone (Muster Explosivo's Sword,
//    Blade of the Swamp Witch).
//
//  • ★ WAS IST EINE „ACTION"? Der Hook `onAnyActionResolved` feuert in
//    JEDEM Aktionspfad — auch fuer Artefakte, Potions und kostenlose
//    Ability-Aktivierungen, die eben KEINE Aktion sind. Das Sieb dafuer
//    gibt es in der Engine bereits: `_bleedTriggersForAction`, die
//    Auslegung hinter Als Bleed-Regeln (3./4.9.) — Attack, Spell,
//    Creature (auch als Zusatz-, Inherent- oder Freiaktion), der
//    Heldeneffekt und die Ability MIT Aktionskosten. Genau diese Menge
//    ist gemeint, deshalb wird sie hier WIEDERVERWENDET statt
//    nachgebaut: „was blutet, ist eine Handlung". Kostenlose
//    Heldeneffekte (Elana) erreichen diesen Hook ohnehin nie — sie
//    laufen an ihm vorbei direkt in den Bleed-Pfad.
//
//  • „its controller" ist der Spieler, der den Helden kontrolliert —
//    also der Handelnde. Bei einer an einen GEGNERISCHEN Helden
//    ausgeruesteten Kopie zahlt damit der Gegner, nicht der Besitzer
//    des Hutes. Verglichen wird deshalb die SEITE des Huts
//    (`physicalSide`), nicht sein Besitzer.
//
//  • „must" — Pflicht: die Handkarten-Wahl ist NICHT abbrechbar. Ist
//    die Hand leer, passiert nichts; ist die Gegnerhand gesperrt,
//    scheitert die Uebergabe in der Engine und es passiert ebenfalls
//    nichts (`actionTransferCardToOppHand` prueft das selbst, ebenso
//    das Reaktionsfenster fuer Hand-Interaktionen).
//
//  • Uebergabe ueber `actionTransferCardToOppHand` — damit feuern alle
//    Zuhoerer dieses Vorgangs mit (Mary Crestmas' „may draw", Letter of
//    Misinformations, Ambush the Scout).
// ═══════════════════════════════════════════

const CARD_NAME = 'Hat of Madness';

const { handlungsHooks } = require('./_action-shared');

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  hooks: {
    // v1157: auch Reaktionen dieses Helden (`_action-shared.js`)
    ...handlungsHooks(async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ich = ctx.card;
      if (!ich || ich.zone !== 'support') return;

      // Nur Handlungen DIESES Helden.
      const seite = engine.physicalSide(ich);
      if (ctx.playerIdx !== seite) return;
      if (ctx.heroIdx !== ich.heroIdx) return;

      // Nur echte Aktionen (siehe Kopf) — dieselbe Auslegung wie Bleed.
      const istAktion = typeof engine._bleedTriggersForAction === 'function'
        ? engine._bleedTriggersForAction(ctx)
        : ['attack', 'spell', 'creature'].includes(String(ctx.actionType || ''));
      if (!istAktion) return;

      const ps = gs.players[seite];
      const oi = seite === 0 ? 1 : 0;
      const ops = gs.players[oi];
      if (!ps || !ops) return;
      if (!(ps.hand || []).length) return;               // leere Hand: nichts zu geben
      if (ops.handLocked) return;                        // Gegnerhand gesperrt

      const eligibleIndices = ps.hand.map((_, i) => i);

      // ★ Grundregel (CARD_API): ein Effekt, der aus einem HOOK heraus
      // feuert, streamt seine Karte an BEIDE Spieler — hier VOR dem
      // Prompt, weil es nichts abzubrechen gibt („must").
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: seite });

      const wahl = await engine.promptGeneric(seite, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: `${CARD_NAME}: you must give a card from your hand to ${ops.username}.`,
        eligibleIndices,
        cancellable: false,
      });
      if (!wahl || wahl.handIndex == null) return;

      const ok = await engine.actionTransferCardToOppHand(seite, wahl.handIndex, { source: CARD_NAME });
      if (!ok) return;

      engine.log('hat_of_madness_gift', {
        player: ps.username, opponent: ops.username,
        card: wahl.cardName, after: ctx.actionType,
      });
      engine.sync();
    }),
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Potion Launcher"
//  Artifact (Equipment, Cost 20)
//
//  "Equip this card to a Hero you control. You may once per turn look at
//   as many of the top cards of your Potion Deck as there are \"Future
//   Tech Potion Launcher\" cards in your discard pile, choose 1 of them
//   and play it immediately, if possible. Shuffle the remaining cards
//   back into your Potion Deck."
//
//  ── Das Trankgeschütz ──
//  Wieder der Archetyp-Vertrag: die Reichweite wächst mit den Kopien in
//  der Ablage. Mit leerer Ablage sieht man null Karten — die Aktivierung
//  wird deshalb gar nicht erst angeboten.
//
//  ── „play it immediately" ──
//  Ein Kartenskript kann Tränke nicht über den Serverpfad einsetzen.
//  Tuscan Mystic hat dafür längst den Weg gebaut (Als Hinweis 21.8.):
//  Skript laden, Sperre und eigenes Gate prüfen, Ziele holen und
//  `script.resolve(engine, pi, gewaehlt, ziele)` rufen. Diese Karte
//  benutzt denselben Helfer — er liegt jetzt in `_potion-shared.js`,
//  damit beide Karten EINE Fassung teilen statt zweier, die
//  auseinanderlaufen.
//
//  ── „if possible" ──
//  Lässt sich der gewählte Trank nicht auslösen (Sperre, eigenes Gate,
//  keine legalen Ziele), fizzelt er. Das ist ein zulässiger Ausgang und
//  KEIN Abbruch: die Aktivierung ist verbraucht, die restlichen Karten
//  wandern trotzdem zurück.
//
//  ── Der Rest geht zurück, der gespielte Trank wird GELÖSCHT ──
//  „Shuffle the remaining cards back" — die übrigen wandern in den
//  Trankstapel zurück. Der abgefeuerte Trank dagegen landet im
//  Gelöscht-Stapel, nicht in der Ablage (Als Regel 21.8.: eine
//  gespielte Potion wird deleted). Denselben Weg nimmt Tuscan Mystic
//  für ihre beiden aufgedeckten Karten.
// ═══════════════════════════════════════════

const { zaehleInAblage, waehleAusNamen } = require('./_future-tech-shared');
const { loesePotionAus, verbrauchePotion } = require('./_potion-shared');

const CARD_NAME = 'Future Tech Potion Launcher';

module.exports = {
  activeIn: ['support'],
  equipEffect: true,

  // ★ Der Vertrag heisst `canActivateEquipEffect(ctx)` und nimmt den
  //   KONTEXT, nicht `(gs, pi, engine)` — Beleg `_crusader-shared.js`
  //   und Charm of Balance. Gesammelt wird er von
  //   `getActivatableEquips`, ausgeloest von `doActivateEquipEffect`.
  canActivateEquipEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps || (ps.potionDeck || []).length === 0) return false;
    if (engine.arePotionsLockedFor?.(pi)) return false;
    return zaehleInAblage(gs, pi, CARD_NAME) > 0;
  },

  // Rueckgabe `false` = abgebrochen; der Server gibt das reservierte
  // Einmal-pro-Zug dann wieder frei.
  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = inst.controller ?? inst.owner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const wieViele = zaehleInAblage(gs, pi, CARD_NAME);
    if (wieViele <= 0) return false;

    const oben = (ps.potionDeck || []).slice(0, wieViele);
    if (oben.length === 0) return false;

    const name = await waehleAusNamen(engine, pi, [...new Set(oben)], {
      source: 'potionDeck',
      title: CARD_NAME,
      description: `Top ${oben.length} of your Potion Deck — choose 1 to fire immediately. The rest are shuffled back.`,
      // ★ NICHT abbrechbar (Als Vorgabe 21.8.). Die Wahlfreiheit liegt
      //   darin, die Ausruestung ueberhaupt zu aktivieren; ist sie
      //   einmal angestossen, wird gefeuert. Dieselbe Linie wie bei
      //   Tuscan Mystic („immediately resolve one of them").
      cancellable: false,
    });
    if (!name) return false;

    // Die gewaehlte Karte verlaesst den Trankstapel, der Rest bleibt
    // liegen und wird gleich gemischt.
    const idx = ps.potionDeck.indexOf(name);
    if (idx < 0) return false;
    ps.potionDeck.splice(idx, 1);

    engine._broadcastEvent('card_reveal', { cardName: name, playerIdx: pi });
    await engine._delay(420);

    // „if possible" — fizzelt der Trank, ist die Aktivierung trotzdem
    // verbraucht.
    const gewirkt = await loesePotionAus(engine, pi, name);

    // ★ Gespielte Traenke werden GELOESCHT, nicht abgelegt (Als Regel
    //   21.8.) — samt sichtbarem Weg Trankstapel → Geloeschtes. Beides
    //   macht der gemeinsame Helfer, damit kuenftige Karten dieser
    //   Bauart es nicht je einzeln nachbauen muessen.
    await verbrauchePotion(engine, pi, name, { von: 'potionDeck' });

    // „Shuffle the remaining cards back into your Potion Deck."
    engine.shuffleDeck(pi, 'potion');

    engine.log('ft_potion_launcher', {
      player: ps.username, potion: name, looked: oben.length, resolved: gewirkt,
    });
    engine.sync();
    return true;
  },
};

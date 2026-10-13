// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Drone"
//  Creature (Normal, Lv 0) — 20 HP, kein ATK.
//
//  "You may once per turn discard up to as many cards as there are
//   \"Future Tech Drone\" cards in your discard pile and draw the same
//   number of cards."
//
//  ── Der Kreislauf des Archetyps in einer Karte ──
//  Abwerfen ist hier kein Preis, sondern der halbe Zweck: was auf der
//  Hand liegt und in der Ablage mehr wert ist, wandert dorthin — und
//  wird gleich durch frische Karten ersetzt. Mit leerer Ablage tut die
//  Drohne nichts (Als Ruling 21.8.), erst die zweite Kopie macht sie
//  zum Motor.
//
//  ── „up to" heißt: der Spieler bestimmt die Menge ──
//  Die Auswahl läuft Karte für Karte und ist jederzeit abbrechbar. Wer
//  nur eine Karte loswerden will, wirft eine.
//
//  ── Standardwege statt Eigenbau (Als Vorgabe 21.8.) ──
//  Abwurf und Ziehen laufen exakt wie bei Inventing: der eingebaute
//  `forceDiscardCancellable`-Dialog laesst den Spieler die Karte
//  DIREKT IN SEINER HAND anklicken (keine Galerie), `actionDiscardHandCard`
//  bucht sie mit Flug in die Ablage, und am Ende zieht EIN
//  `actionDrawCards` alles auf einmal nach. Erst abwerfen, dann
//  ziehen — sonst wirft man gerade Gezogenes gleich wieder ab.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Drone';

module.exports = {
  creatureEffect: true,
  requiresTarget: false,

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const maximum = zaehleInAblage(gs, pi, CARD_NAME);
    if (maximum <= 0) {
      // Kein Abbruch mit `false`: die Drohne DARF leerlaufen, aber sie
      // soll dafür nicht ihre Rundennutzung verbrennen.
      engine.log('ft_drone', { player: ps.username, discarded: 0, drawn: 0 });
      return false;
    }

    // ── Standardweg fuer „abwerfen und nachziehen" (Vorbild Inventing) ──
    // Nicht die Galerie, sondern der eingebaute `forceDiscardCancellable`
    // -Dialog: der Spieler klickt die Karte direkt in seiner Hand an,
    // genau wie bei Inventing. Danach `actionDiscardHandCard` mit dem
    // gemeldeten Handindex und am Ende EIN `actionDrawCards`.
    let anzahl = 0;
    for (let i = 0; i < maximum; i++) {
      if ((ps.hand || []).length === 0) break;
      const wahl = await engine.promptGeneric(pi, {
        type: 'forceDiscardCancellable',
        title: CARD_NAME,
        description: i === 0
          ? `Click a card to discard it and draw 1 card.${maximum > 1 ? ` You may discard up to ${maximum}.` : ''}`
          : 'Click another card to discard it and draw 1 more, or cancel.',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled) break;
      const { cardName, handIndex } = wahl;
      if (cardName === undefined || handIndex === undefined) break;
      // `_noGlow`: `actionDiscardHandCard` laesst sonst ZUERST die
      // Quellkarte aufleuchten und wirft erst danach ab — zwischen
      // Klick und Abwurf lag dadurch eine spuerbare Pause (Als
      // Rueckmeldung 21.8.). Die Drohne hat sich mit ihrem Dialog
      // bereits angekuendigt, der Glow ist reine Wartezeit.
      const ok = await engine.actionDiscardHandCard(pi, cardName, handIndex, {
        source: CARD_NAME, _noGlow: true,
      });
      if (!ok) break;
      anzahl++;
    }

    if (anzahl === 0) return false;

    engine.sync();
    await engine._delay(350);   // Abwurf setzen lassen, dann ziehen
    await engine.actionDrawCards(pi, anzahl);

    engine.log('ft_drone', {
      player: ps.username, discarded: anzahl, drawn: anzahl,
    });
    engine.sync();
    return true;
  },
};

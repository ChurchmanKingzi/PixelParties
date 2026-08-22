// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Control Device"
//  Artifact (Equipment, Cost 4)
//
//  "Equip this card to a Hero your opponent controls. Your opponent may
//   once per turn, during their turn, take control of this Hero for the
//   rest of the turn. At the end of each of your opponent's turns, they
//   must delete a \"Future Tech Control Device\" from their discard pile,
//   or this equipped card is sent to their discard pile."
//
//  ── Der Text liest sich AUS DER SICHT DER KARTE ──
//  [Als Klarstellung 21.8.] Die Karte LIEGT auf der Gegnerseite. Ab dem
//  Anlegen ist „your opponent" deshalb der URSPRÜNGLICHE BESITZER — also
//  der Spieler, der sie gespielt hat. Er ist es, der Kontrolle nimmt,
//  und er ist es, der den Unterhalt zahlt.
//
//  ── Cross-Side-Ausrüstung ──
//  `placesOnOpponentBoard` (Vorbild Powder Keg) legt sie in die
//  gegnerische Support Zone. Der Aktivierungs-Sammler lief bis v565 NUR
//  über die eigenen Zonen — eine Karte auf der Gegnerseite wurde nie
//  angeboten. Dafür gibt es jetzt `getActivatableEquipsCrossSide`.
//
//  ── Die Übernahme ──
//  `hero.controlledBy = pi` — dieselbe Marke wie bei Controlled Attack,
//  samt `onTakeControl`-Fenster (Very Special Prisoner reagiert darauf)
//  und Kontroll-Animation. Sie hält bis zum Zugende; das Aufräumen
//  besorgt die Engine wie bei jeder anderen Übernahme.
//
//  ── Der Unterhalt ──
//  Am Ende JEDES Zuges des Besitzers: eine Kopie aus SEINER Ablage
//  löschen. Geht das nicht — oder will er nicht —, wandert die
//  ausgerüstete Karte in SEINE Ablage. Der Unterhalt läuft auch, wenn
//  die Kontrolle in diesem Zug gar nicht genommen wurde: der Kartentext
//  knüpft ihn nicht daran.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Control Device';
/** Zahl und Takt der Blitze bei der Uebernahme. */
const BLITZE = 4;
const BLITZ_ABSTAND_MS = 110;

/**
 * ★ WER IST DER BESITZER? (Als Befund 21.8.: „passiert nichts")
 *
 * Bei Cross-Side-Karten ist **`inst.owner` die GASTGEBERSEITE** — also
 * der Gegner —, damit diese Seite die Hooks der Karte ausloest
 * (Powder-Keg-Modell, server.js ~6310). Der Spieler, der sie gespielt
 * hat, steht in **`inst.originalOwner`**.
 *
 * Meine erste Fassung las ueberall `inst.owner` und suchte den
 * Wirtsheld auf der FALSCHEN Seite: die Aktivierung fand ihren Helden
 * nicht, der Unterhalt feuerte am falschen Zugende. Beides blieb still.
 */
function besitzer(inst) {
  // Die Karte liegt IMMER auf der Gegenseite ihres Besitzers — die
  // Gastgeberseite (`inst.owner`) bestimmt ihn also eindeutig.
  // `originalOwner` waere die direkte Auskunft, FEHLT aber bei Karten,
  // die ein Puzzle vorbelegt hat (Als Befund 21.8.).
  return inst.owner === 0 ? 1 : 0;
}

/** Der Held, an dem diese Instanz haengt — auf der GASTGEBERSEITE. */
function wirtsheld(engine, inst) {
  return engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx] || null;
}

module.exports = {
  activeIn: ['support'],
  placesOnOpponentBoard: true,
  equipEffect: true,

  canActivateEquipEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const engine = ctx._engine;
    // Nur der BESITZER aktiviert — er sitzt auf der anderen Seite.
    const pi = besitzer(inst);
    if (engine.gs.activePlayer !== pi) return false;
    const held = wirtsheld(engine, inst);
    if (!held?.name || held.hp <= 0) return false;
    return held.controlledBy !== pi;              // schon uebernommen?
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = besitzer(inst);
    const oi = inst.owner;                        // Gastgeberseite
    const held = wirtsheld(engine, inst);
    if (!held?.name || held.hp <= 0) return false;

    held.controlledBy = pi;

    await engine.runHooks('onTakeControl', {
      controllerPi: pi, originalOwnerPi: oi,
      targetType: 'hero', targetName: held.name, targetHero: held,
      heroIdx: inst.heroIdx, kind: 'controlled', sourceName: CARD_NAME,
    });

    // ── Übernahme: dunkle Kontrolle PLUS Blitze (Als Vorgabe 21.8.:
    //    „etwas flashiger, mit kleinen Blitzen") ──
    // ★ BEWUSST über ZONEN-Koordinaten, nicht über Selektoren: die
    //   Anker `me`/`opp` sind BETRACHTERABHÄNGIG (`owner === myIdx ?
    //   'me' : 'opp'`) — ein serverseitig gebauter Selektor-String
    //   träfe bei einem der beiden Spieler die falsche Seite. Die
    //   Zonen-Felder löst jeder Client für sich auf.
    engine._broadcastEvent('dark_control', { owner: oi, heroIdx: inst.heroIdx });
    for (let i = 0; i < BLITZE; i++) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'electric_strike',
        owner: oi, heroIdx: inst.heroIdx, zoneSlot: -1,
      });
      await engine._delay(BLITZ_ABSTAND_MS);
    }
    await engine._delay(500);

    engine.log('ft_control_device', {
      player: gs.players[pi]?.username, hero: held.name,
      opponent: gs.players[oi]?.username,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Unterhalt am Ende JEDES Zuges des Besitzers.
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const pi = besitzer(inst);
      if (gs.activePlayer !== pi) return;          // nur SEINE Zugenden

      const ps = gs.players[pi];
      if (!ps) return;

      if (zaehleInAblage(gs, pi, CARD_NAME) > 0) {
        // Eine Kopie aus der eigenen Ablage loeschen — der Preis.
        const idx = ps.discardPile.lastIndexOf(CARD_NAME);
        if (idx >= 0) {
          engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName: CARD_NAME, from: 'discard', to: 'deleted',
          });
          await engine._delay(420);
          ps.discardPile.splice(idx, 1);
          if (!ps.deletedPile) ps.deletedPile = [];
          ps.deletedPile.push(CARD_NAME);
          // ★ Klang zum Loeschen (Als Hinweis 21.8.): der Flug allein
          //   war stumm. Der Loeschklang haengt am LOG-Eintrag
          //   `card_deleted`, nicht an einem `sfx`-Feld des Fluges —
          //   der Client schaltet in seiner Log-Auswertung darauf
          //   (app-shared.jsx ~426). Vorbild `_guardian-beasts-shared`.
          engine.log('card_deleted', {
            player: ps.username, card: CARD_NAME, by: CARD_NAME,
          });
          engine.log('ft_control_device_upkeep', {
            player: ps.username, paid: true,
          });
          engine.sync();
          return;
        }
      }

      // Kein Unterhalt → die ausgeruestete Karte geht in SEINE Ablage.
      const held = wirtsheld(engine, inst);
      engine.log('ft_control_device_upkeep', { player: ps.username, paid: false });
      if (held && held.controlledBy === pi) delete held.controlledBy;
      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx }, inst,
        { toOwnerDiscard: true },
      );
      engine.sync();
    },
  },
};

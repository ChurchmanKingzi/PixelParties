// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Gear"
//  Artifact (Equipment, Cost 4)
//
//  "Equip this card to a Hero you control. The first time every turn
//   when your opponent adds a card from their deck to their hand, they
//   must send cards equal to twice the number of \"Future Tech Gear\" in
//   your discard pile from the top of their deck to the discard pile.
//   You can only have 1 \"Future Tech Gear\" equipped to your Heroes at
//   any time."
//
//  ── Die Störkarte des Archetyps ──
//  Die einzige Future-Tech-Karte, die die Ablage des GEGNERS füllt
//  statt der eigenen. Zwei Karten je eigener Kopie, also derselbe
//  Aufbauvertrag — nur nach außen gerichtet.
//
//  ── BEIDE Wege (Textänderung Als 21.8.) ──
//  „…when your opponent draws OR adds a card from their deck to their
//  hand via an effect…" — das Spiel trennt beides sauber: `ON_DRAW`
//  feuert beim Ziehen vom Stapel, `ON_CARD_ADDED_TO_HAND` bei Tutoren.
//  Die Karte hängt jetzt an BEIDEN Hooks; die gemeinsame Rundensperre
//  sorgt dafür, dass trotzdem nur der erste Vorgang je Zug zählt —
//  egal welcher der beiden es war.
//
//  ── „The first time every turn" ──
//  Harte Sperre je Zug, aber auf den GEGNER bezogen (er ist der, dessen
//  Hand wächst): `ft-gear-fired:<turn>` auf dem eigenen Spieler.
//
//  ── „only 1 equipped at any time" ──
//  Über `canEquipToHero` — den Vertrag, den die ganze
//  Ausrüstungsfamilie benutzt (Wanted Poster, Vampiric Sword, Slippery
//  Skates). ACHTUNG, Unterschied zu jenen: die verbieten nur eine
//  ZWEITE Kopie am SELBEN Helden, dieser Text verbietet eine zweite
//  Kopie an ALLEN eigenen Helden — deshalb prüft die Funktion hier über
//  alle Heldenzonen, nicht nur über die angefragte.
//  Zusätzlich prüft der Hook, ob DIESE Instanz die vorderste ist, damit
//  zwei versehentlich liegende Kopien nicht doppelt mahlen.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Gear';
const JE_KOPIE = 2;
/** Wie lange der Auftritt steht, bevor gemahlen wird. */
const AUFTRITT_MS = 450;

/**
 * Ist diese Instanz — nach ihrer WIRKSAMEN Identität — eine Gear?
 *
 * ★ Eine Karte mit geliehener Identität (Future Tech Copy Device als
 * Gear) heisst weiter Copy Device. Wer nur `c.name` prüft, übersieht
 * sie: die Kopie könnte dann NEBEN einer echten Gear liegen, obwohl der
 * Kartentext genau eine erlaubt, und beide würden mahlen.
 */
function istGear(inst) {
  if (!inst) return false;
  return (inst.counters?._effectOverride || inst.name) === CARD_NAME;
}

/** Alle wirksamen Gears einer Seite, die im Feld liegen. */
function gearsImFeld(engine, owner) {
  return (engine.cardInstances || []).filter(c =>
    c && c.zone === 'support' && istGear(c)
    && (c.controller ?? c.owner) === owner);
}

/** Liegt DIESE Instanz als erste ihres Namens im Feld? */
function istDieVorderste(engine, inst, owner) {
  const alle = gearsImFeld(engine, owner);
  return alle.length === 0 || alle[0] === inst;
}

module.exports = {
  activeIn: ['support'],

  /**
   * Höchstens EINE Gear über alle eigenen Helden hinweg.
   *
   * ★ Über die INSTANZEN geprüft, nicht über die Namen in den Zonen:
   * eine Copy Device, die gerade eine Gear IST, muss mitzählen (v575).
   * Ohne Engine-Referenz — die gibt es in diesem Vertrag nicht immer —
   * bleibt der alte Namensscan als Rückfall.
   */
  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    if (engine) return gearsImFeld(engine, playerIdx).length === 0;
    const zonen = gs.players[playerIdx]?.supportZones || [];
    for (const heldZonen of zonen) {
      for (const slot of (heldZonen || [])) {
        if ((slot || []).includes(CARD_NAME)) return false;
      }
    }
    return true;
  },

  hooks: {
    onCardAddedToHand: (ctx) => ausloesen(ctx),
    onDraw: (ctx) => ausloesen(ctx),
  },
};

/** Gemeinsamer Ablauf beider Hooks. */
async function ausloesen(ctx) {
      const engine = ctx._engine;
      const gs = engine.gs;
      const owner = ctx.cardOwner;
      const oi = owner === 0 ? 1 : 0;

      // Nur wenn der GEGNER etwas auf die Hand bekommen hat.
      if (ctx.playerIdx !== oi) return;
      if (!istDieVorderste(engine, ctx.card, owner)) return;

      // „The first time every turn" — EINE Sperre fuer beide Wege.
      if (!engine.claimHOPT('ft-gear-fired', owner)) return;

      const menge = JE_KOPIE * zaehleInAblage(gs, owner, CARD_NAME);
      if (menge <= 0) {
        // Kein Auftritt, wenn nichts passiert — die Anzeige soll etwas
        // ANKUENDIGEN, nicht Leerlauf melden.
        engine.log('ft_gear', { player: gs.players[owner]?.username, milled: 0 });
        return;
      }

      // ★ AUFTRITT LINKS NEBEN DEM FELD (Als Vorgabe 21.8.: „soll bei
      //   beiden Spielern links neben dem Board angezeigt werden, genau
      //   wie ein aktiver Effekt").
      //
      //   Aktivierungen bekommen das ueber `armEffectAnnounce` /
      //   `announceActiveEffect` geschenkt — Gear ist aber ein PASSIVER
      //   Hook und laeuft an diesen Wegen vorbei. `announceActiveEffect`
      //   allein reichte hier auch nicht: es schickt den Reveal
      //   ABSICHTLICH nur an den Aktivierenden, weil der Gegner ihn auf
      //   normalen Wegen schon aus `_firePendingCardReveal` hat. Ein
      //   passiver Ausloeser erzeugt den aber nie. Deshalb derselbe
      //   Reveal, nur an den ganzen Raum.
      engine._broadcastEvent('card_reveal', {
        cardName: CARD_NAME, playerIdx: owner, sfx: 'ability_activate',
      });
      await engine._delay(AUFTRITT_MS);

      const ops = gs.players[oi];
      const vorher = (ops?.discardPile || []).length;
      // Von OBEN — der Text sagt „from the top of their deck". Der
      // Helfer animiert den Flug und feuert `onMill` (Als Regel 21.8.:
      // jede Bewegung zwischen Stapeln wird animiert).
      await engine.actionMillCards(oi, menge, { source: CARD_NAME });

      engine.log('ft_gear', {
        player: gs.players[owner]?.username, target: ops?.username,
        milled: (ops?.discardPile || []).length - vorher, requested: menge,
      });
      engine.sync();
}

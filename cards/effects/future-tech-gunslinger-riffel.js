// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Gunslinger Riffel"
//  Hero — 400 HP / 40 ATK, Adventurousness + Inventing
//
//  "You may once per turn choose an equippable Artifact in your discard
//   pile that this Hero has no copies of equipped to it yet. Search your
//   deck for a copy of that Artifact and equip it to this Hero without
//   paying its Cost."
//
//  ── Der Held des Archetyps ──
//  Er bezahlt nichts und macht die Ablage zum Katalog: was einmal
//  gestorben ist, kann er sich als frische Kopie aus dem Deck holen.
//  Mit Future Tech Laser Cannon (60 Gold) ist das der Unterschied
//  zwischen „unbezahlbar" und „liegt auf dem Tisch".
//
//  ── Zwei Stapel, zwei Rollen (leicht zu verwechseln) ──
//   • Die ABLAGE ist nur der KATALOG — dort wird gewählt, dort bleibt
//     die Karte liegen.
//   • Die Kopie, die angelegt wird, kommt aus dem DECK.
//  Liegt ein Artefakt in der Ablage, aber keine Kopie mehr im Deck,
//  steht es gar nicht erst zur Wahl.
//
//  ── „no copies of it equipped to it yet" ──
//  Bezieht sich auf DIESEN Helden, nicht auf das ganze Feld: dieselbe
//  Karte darf an einem anderen Helden hängen.
//
//  ── Rückgabevertrag ──
//  [CARD_API, Als Befund 17.8.] Jeder Pfad, der nichts bewirkt, gibt
//  `false` zurück — sonst stempelt die Engine das Einmal-pro-Zug
//  trotzdem ab. Betrifft hier: keine Kandidaten, abgebrochene Auswahl,
//  kein freier Slot.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { waehleAusNamen } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Gunslinger Riffel';

/** Freie Support-Plätze dieses Helden. */
function freieSlots(ps, heroIdx) {
  const zonen = ps.supportZones?.[heroIdx] || [];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const slot = zonen[i];
    if (!slot || (Array.isArray(slot) && slot.length === 0)) out.push(i);
  }
  return out;
}

/** Trägt dieser Held den Namen schon? */
function schonAngelegt(ps, heroIdx, name) {
  for (const slot of (ps.supportZones?.[heroIdx] || [])) {
    if ((slot || []).includes(name)) return true;
  }
  return false;
}

/**
 * Wählbare Namen: Ausrüstung, liegt in der ABLAGE, eine Kopie im DECK,
 * und an DIESEM Helden noch nicht angelegt.
 */
function kandidaten(gs, pi, heroIdx, engine) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const imDeck = new Set(ps.mainDeck || []);
  const out = new Set();
  for (const name of (ps.discardPile || [])) {
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if ((cd.subtype || '') !== 'Equipment') continue;   // „equippable"
    if (!imDeck.has(name)) continue;                    // Kopie im Deck noetig
    if (schonAngelegt(ps, heroIdx, name)) continue;
    out.add(name);
  }
  return [...out];
}

module.exports = {
  heroEffect: true,

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    // ★ `ctx.cardHeroIdx`, NICHT `ctx.heroIdx` (Als Befund 21.8.: „Riffel
    //   reagiert nicht, obwohl sie als nutzbar gehighlightet wird").
    //   Den zweiten Namen gibt es im Heldenkontext nicht — er war
    //   `undefined`, die Wache unten brach sofort ab, und weil ein
    //   `false` als „nichts passiert" gilt, blieb es voellig still.
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps || heroIdx == null || heroIdx < 0) return false;

    if (freieSlots(ps, heroIdx).length === 0) return false;

    const wahl = kandidaten(gs, pi, heroIdx, engine);
    if (wahl.length === 0) return false;

    const name = await waehleAusNamen(engine, pi, wahl, {
      source: 'discard',
      title: CARD_NAME,
      description: 'Pick an Equipment from your discard pile — a copy comes out of your deck and equips here for free.',
      cancellable: true,
    });
    if (!name) return false;                       // Abbruch kostet nichts

    // Die Kopie kommt aus dem DECK, nicht aus der Ablage.
    const deckIdx = (ps.mainDeck || []).indexOf(name);
    if (deckIdx < 0) return false;                 // zwischenzeitlich weg
    const slots = freieSlots(ps, heroIdx);
    if (slots.length === 0) return false;
    const slot = slots[0];

    ps.mainDeck.splice(deckIdx, 1);
    ps.supportZones[heroIdx][slot] = [name];
    const inst = engine._trackCard(name, pi, 'support', heroIdx, slot);

    // Sichtbarer Weg Deck → Support (Als Regel: jede Bewegung zwischen
    // Stapeln wird animiert). Bauform aus `_idej-shared.js`.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: name,
      from: 'deck', to: 'support',
      toHeroIdx: heroIdx, toSlotIdx: slot,
    });
    engine.sync();
    await engine._delay(520);

    engine.shuffleDeck(pi, 'main');                // „Search your deck"

    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    engine.log('ft_gunslinger_riffel', {
      player: ps.username, card: name, heroIdx, slot,
    });
    engine.sync();
    return true;
  },
};

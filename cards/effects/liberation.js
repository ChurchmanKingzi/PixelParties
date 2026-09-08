// ═══════════════════════════════════════════
//  CARD EFFECT: "Liberation"
//  Spell (Normal, Lv1, Support Magic)
//
//  „Choose one of the following effects:
//   • Choose up to 3 Creatures from your discard pile OR up to 3 of
//     your deleted Creatures and openly add them to your hand. Delete
//     this card.
//   • Gain permanent control of all Creatures your opponent controls
//     originally owned by you.\"   (Neufassung, Al 4.9.)
//
//  Bauform
//  ───────
//  • Angeboten wird NUR, was gerade geht. Steht bloss ein Effekt
//    offen, laeuft er ohne Auswahlmenue durch; stehen beide offen,
//    kommt das Optionsmenue.
//  • Die Rueckholung greift genau die Kontrolle ab, die
//    `actionTransferCreature` gesetzt hat (Dark Gear, Diplomacy,
//    Hunting ab Stufe 2): der Kadaver-Eigentuemer `originalOwner`
//    bleibt bei einem solchen Zug eingefroren, waehrend `controller`
//    und `owner` zur Gegenseite kippen. Genau dieses Paar — bei mir
//    daheim, drueben in der Spalte — ist das Merkmal.
//    Ein VORUEBERGEHEND gestohlenes Exemplar (Deepsea Succubus,
//    `inst.stolenBy`) steht physisch ohnehin noch bei mir und laeuft
//    am Zugbeginn von selbst zurueck — es ist hier nicht gemeint.
//  • Zurueck geht es ueber denselben Weg, der sie geholt hat:
//    `actionTransferCreature` bringt Flug, Zonenbuchhaltung,
//    Kontrollwechsel und die Pruefung auf „Defending the Gate\" mit.
//    Ist bei mir keine Zone mehr frei, bleibt der Rest drueben.
//  • „openly add\" — die aufgenommenen Karten laufen durch
//    `revealSearchedCards`, der Gegner sieht also jede einzelne.
//  • Mehrere Kopien derselben Kreatur sind ausdruecklich erlaubt
//    (der Text sagt nicht „with different names\"), deshalb wird
//    EINZELN gepickt statt ueber eine Mehrfachgalerie, die je Name
//    nur einen Eintrag fuehrt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Liberation';
const MAX_PICKS = 3;

/** Kreaturen-Namen in einem Stapel, in Reihenfolge, mit Duplikaten. */
function kreaturenIn(engine, liste) {
  const cardDB = engine._getCardDB();
  return (liste || []).filter(n => {
    const cd = cardDB[n];
    return cd && hasCardType(cd, 'Creature');
  });
}

/**
 * Alle Kreaturen, die der Gegner DAUERHAFT von mir kontrolliert.
 * Merkmal: physisch in seiner Spalte, `originalOwner` aber bei mir.
 */
function zurueckholbare(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    if ((inst.originalOwner ?? inst.owner) !== pi) continue;
    // Kardinalbestien & Co. lassen sich von nichts anfassen — sie
    // wuerden in `actionTransferCreature` ohnehin abprallen, sollen
    // die Option aber auch nicht kuenstlich am Leben halten.
    if (engine.isOmniImmune(inst)) continue;
    out.push(inst);
  }
  return out;
}

/** ALLE freien Support Zones auf meiner Seite (place: Heldenzustand egal). */
function freieZonen(engine, pi) {
  const ps = engine.gs.players[pi];
  const zonen = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    const slots = ps.supportZones[hi] || [];
    const anzahl = Math.max(3, slots.length);
    for (let si = 0; si < anzahl; si++) {
      if ((slots[si] || []).length > 0) continue;
      const label = hero?.name
        ? (hero.hp <= 0 ? `${hero.name} (KO)` : hero.name)
        : `Column ${hi + 1}`;
      zonen.push({
        owner: pi, heroIdx: hi, slotIdx: si,
        label: `${label} — ${si >= 3 ? 'Island ' + (si - 2) : 'Slot ' + (si + 1)}`,
      });
    }
  }
  return zonen;
}

function kannBergen(engine, pi) {
  const ps = engine.gs.players[pi];
  return kreaturenIn(engine, ps?.discardPile).length > 0
    || kreaturenIn(engine, ps?.deletedPile).length > 0;
}

function kannBefreien(engine, pi) {
  return zurueckholbare(engine, pi).length > 0 && freieZonen(engine, pi).length > 0;
}

// ─── Effekt 1: aus Ablage oder Deleted Pile auf die Hand ─────────

async function bergen(engine, pi, ctx) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  const ausAblage = kreaturenIn(engine, ps.discardPile);
  const ausDeleted = kreaturenIn(engine, ps.deletedPile);

  // Stapel waehlen — nur fragen, wenn beide etwas hergeben.
  let stapel = ausAblage.length > 0 ? 'discard' : 'deleted';
  if (ausAblage.length > 0 && ausDeleted.length > 0) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker', title: CARD_NAME,
      description: 'Take Creatures from which pile?',
      options: [
        { id: 'discard', label: `🗑️ Discard pile (${ausAblage.length})` },
        { id: 'deleted', label: `❌ Deleted cards (${ausDeleted.length})` },
      ],
      cancellable: true,
    });
    if (!wahl || wahl.cancelled) { gs._spellCancelled = true; return false; }
    stapel = wahl.optionId || wahl.id || wahl.selected || wahl.option || 'discard';
  }

  // Einzeln picken, damit mehrere Kopien desselben Namens moeglich sind.
  //
  // REIHENFOLGE STEHT FEST (Als Befund 4.9.): Die Galerie wurde bisher
  // bei jedem Durchgang neu aus dem Stapel gebaut, und der Stapel
  // aendert seine Reihenfolge, sobald eine Kopie herausgeloest wird —
  // die eben gewaehlte Kreatur rutschte dadurch an eine andere Stelle
  // und der naechste Klick landete auf der falschen Karte. Die
  // Anzeigereihenfolge wird deshalb EINMAL vor dem ersten Pick
  // festgelegt und danach nur noch gefiltert; die Stueckzahl je
  // Eintrag zaehlt neu.
  const reihenfolge = [...new Set(kreaturenIn(
    engine, stapel === 'deleted' ? ps.deletedPile : ps.discardPile))];

  const genommen = [];
  for (let i = 0; i < MAX_PICKS; i++) {
    const quelle = stapel === 'deleted' ? ps.deletedPile : ps.discardPile;
    const uebrig = kreaturenIn(engine, quelle);
    if (uebrig.length === 0) break;

    const zaehler = {};
    for (const n of uebrig) zaehler[n] = (zaehler[n] || 0) + 1;
    const galerie = reihenfolge
      .filter(name => zaehler[name] > 0)
      .map(name => ({ name, source: stapel, count: zaehler[name] }));

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME,
      description: genommen.length === 0
        ? `Choose a Creature to add to your hand (up to ${MAX_PICKS}).`
        : `Choose another Creature (${genommen.length}/${MAX_PICKS}), or stop here.`,
      cards: galerie,
      cancellable: true,
      cancelLabel: genommen.length === 0 ? 'Cancel' : '✓ Done',
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) break;

    const idx = quelle.indexOf(wahl.cardName);
    if (idx < 0) break;

    if (stapel === 'discard') {
      const ok = await engine.addCardFromDiscardToHand(pi, wahl.cardName, pi, { source: CARD_NAME });
      if (!ok) break;                       // Discard-Sperre (Eye of Ren)
    } else {
      if (!(await engine.takeFromPile(ps, 'deleted', idx, { source: CARD_NAME }))) break;   // v820: Stapel-Schicht
      ps.hand.push(wahl.cardName);
      engine._trackCard(wahl.cardName, pi, 'hand');
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: wahl.cardName,
        from: 'deleted', to: 'hand',
        toHandIdx: ps.hand.length - 1, finalHandSize: ps.hand.length,
      });
      engine.sync();
      await engine._delay(320);
    }
    genommen.push(wahl.cardName);
  }

  if (genommen.length === 0) { gs._spellCancelled = true; return false; }

  // „openly\" — jede aufgenommene Karte wird dem Gegner gezeigt.
  await engine.revealSearchedCards(pi, genommen, CARD_NAME);

  // „Delete this card.\" Die Standard-Ablage in server.js wird ueber
  // `_spellPlacedOnBoard` abgeklemmt (Bauform aus forbidden-zone.js),
  // das Untracking uebernimmt die Karte deshalb selbst.
  gs._spellPlacedOnBoard = true;
  ps.deletedPile.push(CARD_NAME);
  if (ctx?.card?.id) engine._untrackCard(ctx.card.id);
  engine.sync();
  return true;
}

// ─── Effekt 2: eigene Kreaturen zurueckholen ─────────────────────

async function befreien(engine, pi) {
  const gs = engine.gs;

  for (;;) {
    const offen = zurueckholbare(engine, pi);
    if (offen.length === 0) break;
    const zonen = freieZonen(engine, pi);
    if (zonen.length === 0) break;          // kein Platz mehr — Rest bleibt drueben

    const inst = offen[0];
    const ziel = zonen.length === 1 ? zonen[0]
      : (await engine.promptGeneric(pi, {
          type: 'zonePick', zones: zonen, title: CARD_NAME,
          description: `Bring ${inst.name} back into which Support Zone?`,
          previewCardName: inst.name, cancellable: false,
        })) || zonen[0];

    const res = await engine.actionTransferCreature(inst, pi, ziel.heroIdx, ziel.slotIdx, {
      sourceName: CARD_NAME,
    });
    // Prallt der Zug ab (Defending the Gate, Omni-Immunitaet), waere
    // die Schleife sonst endlos — dann ist hier Schluss.
    if (res?.success === false) break;
  }

  gs._spellCancelled = false;
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['hand'],
  // Holt Ziele auf die eigene Seite zurueck — dieselbe Marke, die
  // Boris & Co. lesen.
  takesControlOfTargets: true,
  // Dokumentiert die Selbstloeschung des ersten Effekts; die
  // eigentliche Weiche steht in `bergen()`, weil der zweite Effekt
  // ganz normal auf den Ablagestapel geht.
  deleteOnUse: false,

  cpuMeta: {
    // Reine Kartenwirtschaft bzw. Rueckholung — kein Schaden, kein Status.
    castTriggersDraw: true,
  },

  /** Spielbar, sobald einer der beiden Effekte etwas bewirken kann. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return kannBergen(engine, pi) || kannBefreien(engine, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const bergbar = kannBergen(engine, pi);
      const befreibar = kannBefreien(engine, pi);
      if (!bergbar && !befreibar) { gs._spellCancelled = true; return; }

      // Nur bei echter Wahl ein Menue.
      let modus = bergbar ? 'recover' : 'free';
      if (bergbar && befreibar) {
        const anzahl = zurueckholbare(engine, pi).length;
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker', title: CARD_NAME,
          description: 'Choose one of the following effects.',
          options: [
            { id: 'recover', label: '🗃️ Add up to 3 Creatures from a pile to your hand' },
            { id: 'free', label: `⛓️‍💥 Take back ${anzahl} Creature${anzahl === 1 ? '' : 's'} of yours` },
          ],
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) { gs._spellCancelled = true; return; }
        modus = wahl.optionId || wahl.id || wahl.selected || wahl.option || 'recover';
      }

      if (modus === 'free') await befreien(engine, pi);
      else await bergen(engine, pi, ctx);
    },
  },
};

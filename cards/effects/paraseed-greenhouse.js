// ═══════════════════════════════════════════
//  CARD EFFECT: "Paraseed Greenhouse"
//  Spell (Area, Lv1, Summoning Magic)
//
//  „You may once per turn discard a card from your hand to search your
//   deck for a \"Paraseed\" and place it into the free Support Zone of
//   any Hero you control that does not have a \"Paraseed\" in its
//   Support Zones yet OR move any number of \"Paraseeds\" anywhere on
//   the board to the free Support Zones of any other Heroes on the
//   board.\"
//
//  Bedienung (Als Vorgaben 4.9.)
//  ─────────────────────────────
//  • KEIN „Discard? Yes/No\"-Vorspann. Steht nur EIN Modus offen, geht
//    es direkt in die Abwurf-Auswahl; Escape oder Cancel dort bricht
//    den ganzen Effekt ab, ohne ihn zu verbrauchen. Das ist ab v718
//    der Standard fuer Abwurf-Kosten (s. CARD_API).
//  • Stehen BEIDE Modi offen, kommt das Optionsmenue — und direkt
//    danach, ohne Zwischenschritt, die Abwurf-Auswahl.
//  • Der Umzug laeuft ueber das BRETT, nicht ueber eine Galerie, und
//    zwar EINZELN im Wechsel: eine Paraseed anklicken, ihre Zielzone
//    waehlen, sie fliegt — dann die naechste, bis der Spieler abbricht
//    oder nichts mehr geht. Jede Paraseed darf nur EINMAL wandern.
//  • Beim Pflanzen leuchten ALLE freien Zonen eines in Frage
//    kommenden Helden, nicht nur die erste.
//
//  Pflichten
//  ─────────
//  • Diver Helmet: ein geschuetzter Held ist weder Ziel einer
//    Pflanzung noch Quelle oder Ziel eines Umzugs.
//  • Der Umzug laeuft ueber `actionTransferCreature` — der einzige
//    Weg, der Flug, Zonenbuchhaltung, Kontrollwechsel UND
//    „Defending the Gate\" mitbringt.
// ═══════════════════════════════════════════

const {
  isParaseedCreature, heroHasParaseed, syncParaseedPoison,
} = require('./_paraseed-shared');
const { heroHasDiverHelmet, isAreaImmuneInst } = require('./_diver-helmet-shared');

const CARD_NAME = 'Paraseed Greenhouse';

/** ALLE freien Zonen eines Helden (place: Heldenzustand egal). */
function freieZonen(engine, pi, heroIdx) {
  const slots = engine.gs.players[pi]?.supportZones?.[heroIdx] || [];
  const anzahl = Math.max(3, slots.length);
  const out = [];
  for (let si = 0; si < anzahl; si++) {
    if (!slots[si] || slots[si].length === 0) out.push(si);
  }
  return out;
}

/** Pflanzziele: eigene Helden ohne Paraseed — mit JEDER freien Zone. */
function pflanzZiele(engine, pi) {
  const ziele = [];
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    if (heroHasDiverHelmet(engine, pi, hi)) continue;
    if (heroHasParaseed(engine, pi, hi)) continue;
    for (const si of freieZonen(engine, pi, hi)) {
      ziele.push({
        owner: pi, heroIdx: hi, slotIdx: si,
        label: `${hero.name} — ${si >= 3 ? 'Island ' + (si - 2) : 'Slot ' + (si + 1)}`,
      });
    }
  }
  return ziele;
}

/** Alle Paraseeds auf dem GANZEN Brett (Diver Helmet ausgenommen). */
function alleParaseeds(engine) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (!isParaseedCreature(inst.name, engine)) continue;
    if (isAreaImmuneInst(engine, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Freie Zonen aller Helden auf dem Brett, ausser denen des Wirts. */
function umzugsZiele(engine, ausserHost) {
  const ziele = [];
  for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
    const ps = engine.gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      if (ausserHost && ausserHost.owner === pi && ausserHost.heroIdx === hi) continue;
      if (heroHasDiverHelmet(engine, pi, hi)) continue;
      for (const si of freieZonen(engine, pi, hi)) {
        ziele.push({
          owner: pi, heroIdx: hi, slotIdx: si,
          label: `${engine.gs.players[pi]?.username || 'P' + pi} — ${hero.name}`,
        });
      }
    }
  }
  return ziele;
}

function kannPflanzen(engine, pi) {
  const ps = engine.gs.players[pi];
  return (ps?.mainDeck || []).some(n => isParaseedCreature(n, engine))
    && pflanzZiele(engine, pi).length > 0;
}

function kannUmziehen(engine) {
  return alleParaseeds(engine)
    .some(inst => umzugsZiele(engine, { owner: inst.owner, heroIdx: inst.heroIdx }).length > 0);
}

// ─── Die beiden Modi ─────────────────────────────────────────────

async function pflanzen(engine, pi) {
  const ps = engine.gs.players[pi];
  const kandidaten = [...new Set((ps.mainDeck || []).filter(n => isParaseedCreature(n, engine)))];
  if (kandidaten.length === 0) return true;                  // Kosten sind bezahlt

  const gewaehlt = kandidaten.length === 1 ? kandidaten[0]
    : (await engine.promptGeneric(pi, {
        type: 'cardGallery', title: CARD_NAME,
        description: 'Pick a "Paraseed" to plant.',
        cards: kandidaten.map(n => ({ name: n, source: 'deck' })),
        cancellable: false,
      }))?.cardName || kandidaten[0];

  const ziele = pflanzZiele(engine, pi);
  if (ziele.length === 0) return true;
  const zone = ziele.length === 1 ? ziele[0]
    : (await engine.promptGeneric(pi, {
        type: 'zonePick', zones: ziele, title: CARD_NAME,
        description: `Place ${gewaehlt} into which Support Zone?`,
        previewCardName: gewaehlt, cancellable: false,
      })) || ziele[0];

  const _taken_deckIdx = await engine.takeFromPile(ps, 'deck', gewaehlt, { source: CARD_NAME });   // v820: Stapel-Schicht
  if (!_taken_deckIdx) return true;
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: gewaehlt,
    from: 'deck', to: 'support',
    toHeroIdx: zone.heroIdx, toSlotIdx: zone.slotIdx,
  });
  engine.sync();
  await engine._delay(520);

  await engine.actionPlaceCreature(gewaehlt, pi, zone.heroIdx, zone.slotIdx, {
    source: 'deck', sourceName: CARD_NAME, animationType: 'poison_splash',
  });
  engine.shuffleDeck(pi, 'main');
  await syncParaseedPoison(engine, pi, zone.heroIdx);
  engine.sync();
  return true;
}

async function umziehen(engine, pi) {

  // Jede Paraseed darf nur EINMAL wandern (Als Vorgabe 4.9.) — die
  // Instanz-IDs der schon bewegten merkt sich diese Menge. Ueber die
  // ID und nicht ueber die Zone, weil die Zone sich beim Umzug ja
  // gerade aendert.
  const schonBewegt = new Set();
  let runde = 0;

  for (;;) {
    const beweglich = alleParaseeds(engine).filter(inst =>
      !schonBewegt.has(inst.id)
      && umzugsZiele(engine, { owner: inst.owner, heroIdx: inst.heroIdx }).length > 0);
    if (beweglich.length === 0) break;

    // ── Schritt 1: EINE Paraseed anklicken ────────────────────────
    // `autoConfirm` + `maxTotal: 1`: der Klick loest sofort aus, es
    // gibt keinen Bestaetigungsknopf dazwischen.
    const ziele = beweglich.map(inst => ({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    }));

    const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      description: runde === 0
        ? 'Click a "Paraseed" to move.'
        : 'Click the next "Paraseed" to move, or stop here.',
      confirmLabel: '🪴 Move it',
      confirmClass: 'btn-info',
      cancelLabel: runde === 0 ? 'Cancel' : '✓ Done',
      cancellable: true,
      previewCardName: CARD_NAME,
      autoConfirm: true,
      maxTotal: 1,
      minRequired: 1,
    });
    if (!gewaehlt || gewaehlt.length === 0) break;          // fertig

    const inst = ziele.find(z => z.id === gewaehlt[0])?.cardInstance;
    if (!inst || inst.zone !== 'support') break;

    // ── Schritt 2: Zielzone waehlen und sofort fliegen ────────────
    const vonOwner = inst.owner;
    const vonHero = inst.heroIdx;
    const wirt = engine.gs.players[vonOwner]?.heroes?.[vonHero]?.name || '—';
    const zonen = umzugsZiele(engine, { owner: vonOwner, heroIdx: vonHero });
    if (zonen.length === 0) break;

    const ziel = zonen.length === 1 ? zonen[0]
      : (await engine.promptGeneric(pi, {
          type: 'zonePick', zones: zonen, title: CARD_NAME,
          description: `Move the "${inst.name}" from ${wirt} into which Support Zone?`,
          previewCardName: inst.name, cancellable: false,
        })) || zonen[0];

    const zielOwner = ziel.owner ?? vonOwner;
    const res = await engine.actionTransferCreature(inst, zielOwner, ziel.heroIdx, ziel.slotIdx, {
      sourceName: CARD_NAME,
    });
    // Auch ein gescheiterter Umzug (Defending the Gate, Omni-Immunitaet)
    // verbraucht den Versuch — sonst bietet die naechste Runde dieselbe
    // Paraseed endlos wieder an.
    schonBewegt.add(inst.id);
    if (res?.success === false) { runde++; continue; }

    await syncParaseedPoison(engine, vonOwner, vonHero);
    await syncParaseedPoison(engine, zielOwner, ziel.heroIdx);
    engine.sync();
    runde++;
  }

  return true;
}

module.exports = {
  activeIn: ['hand', 'area'],
  areaEffect: true,

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },

  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx._activator ?? ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    if ((ps.hand || []).length === 0) return false;        // Abwurf ist Pflichtkosten
    if (ps.handLocked) return false;
    return kannPflanzen(engine, pi) || kannUmziehen(engine);
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx._activator ?? ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const pflanzbar = kannPflanzen(engine, pi);
    const umziehbar = kannUmziehen(engine);
    if (!pflanzbar && !umziehbar) return false;

    // Nur bei echter Wahl ein Menue; sonst direkt zu den Kosten.
    let modus = pflanzbar ? 'plant' : 'move';
    if (pflanzbar && umziehbar) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker', title: CARD_NAME,
        description: 'Discard 1 card from your hand to use the Greenhouse.',
        options: [
          { id: 'plant', label: '🌱 Search a "Paraseed" and plant it' },
          { id: 'move', label: '🪴 Move "Paraseeds" to other Heroes' },
        ],
        cancellable: true,
      });
      if (!wahl || wahl.cancelled) return false;
      modus = wahl.optionId || wahl.id || wahl.selected || wahl.option || 'plant';
    }

    // Kosten. Ein Abbruch hier beendet den Effekt, ohne ihn zu
    // verbrauchen — Standard fuer Abwurf-Kosten ab v718.
    const handVorher = (ps.hand || []).length;
    await engine.actionPromptForceDiscard(pi, 1, {
      title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
      cancellable: true,
      description: modus === 'plant'
        ? 'Discard 1 card to search your deck for a "Paraseed".'
        : 'Discard 1 card to move "Paraseeds" to other Heroes.',
    });
    if ((ps.hand || []).length === handVorher) return false;   // abgebrochen

    return modus === 'move' ? umziehen(engine, pi) : pflanzen(engine, pi);
  },
};

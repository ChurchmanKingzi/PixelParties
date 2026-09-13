// ═══════════════════════════════════════════
//  CARD EFFECT: „Boulder in a Bottle"
//  Potion (PP THW)
//
//  „Place this card into the free Support Zone of a Hero your opponent
//   controls. While it is in a Support Zone, this card is treated as a
//   level 3 Creature with 150 HP and the following effect:
//   \"This Creature occupies all free Support Zones of the corresponding
//    Hero. This Creature cannot be sacrificed.\""
//
//  BAUART
//  ──────
//  • Zielsuchende Potion: `getValidTargets` liefert die HELDEN des
//    Gegners, die noch mindestens eine freie Support Zone haben, und
//    `resolve` legt die Karte dort hinein. Tote Helden zaehlen mit —
//    Kreaturen sind vom Zustand ihres Slot-Helden unabhaengig, und der
//    Text nimmt sie nicht aus (anders als beim AUSRUESTEN, das an
//    toten Helden verboten ist).
//
//  • ★ DIE POTION BLEIBT LIEGEN. Potions wandern nach dem Aufloesen in
//    den Geloescht-Stapel — diese nicht. Der vorgesehene Weg dafuer ist
//    das Fenster `afterPotionUsed` mit `ctx.setFlag('placed', true)`
//    (Biomancy macht es genauso fuer seine Token). BEWUSST NICHT ueber
//    `gs._spellPlacedOnBoard`: dieser Zweig steht im Server VOR dem
//    Potion-Zweig und wuerde `afterPotionUsed` und `checkPotionLock`
//    mit ueberspringen.
//
//  • ★ SIE LIEGT IN DER SPALTE DES GEGNERS UND GEHOERT DAMIT IHM.
//    `safePlaceInSupport` traegt den Besitzer der ZONE ein — genau
//    richtig: der Brocken belegt SEINE Plaetze, taucht auf SEINER Seite
//    auf, und die Klausel „cannot be sacrificed" richtet sich gegen
//    IHN (sonst opfert er den Brocken weg und hat seine Zonen zurueck).
//
//  • „treated as a level 3 Creature with 150 HP": Override-Zaehler
//    `_cardDataOverride` (Biomancy-Muster) — `getEffectiveCardData`
//    liest ihn, und damit behandelt die ganze Engine die Karte als
//    Kreatur: Ziel- und Schadenspfade, AoE, Stufenabfragen, Tooltip.
//    Typ `Creature/Token` wie beim Biomancy-Token: es ist und bleibt
//    eine Potion, sie soll beim Verlassen des Bretts in den
//    GELOESCHT-Stapel gehen, nicht in die Ablage.
//
//  • „occupies all free Support Zones": `_multizone-shared` mit der
//    Standardzahl 3 — `claimZones` belegt jede noch FREIE Zone des
//    Gastgebers mit dem Platzhalter und laesst belegte in Ruhe. Genau
//    das sagt der Text. Bewusst OHNE `multiZone: 3` am Modul: dieses
//    Flag verspricht „braucht 3 Zonen", und der Brocken darf auch zu
//    einem Helden mit nur einer freien Zone.
//
//  • „cannot be sacrificed": neuer, enger Engine-Vertrag
//    `cannotBeSacrificed` in `getSacrificableCreatures` (v958). Nicht
//    ueber `_cardinalImmune` — das sperrt JEDEN Effekt, hier geht es
//    nur ums Opfern.
// ═══════════════════════════════════════════

const multizone = require('./_multizone-shared');

const CARD_NAME = 'Boulder in a Bottle';
const BOULDER_HP = 150;
const BOULDER_LEVEL = 3;

/** Indizes der freien Support Zones eines Helden. */
function freieZonen(gs, pi, heroIdx) {
  const zonen = gs.players[pi]?.supportZones?.[heroIdx] || [];
  const anzahl = Math.max(3, zonen.length);
  const out = [];
  for (let z = 0; z < anzahl; z++) if (((zonen[z] || []).length) === 0) out.push(z);
  return out;
}

/** Hat dieser Held noch eine freie Support Zone? */
function hatFreieZone(gs, pi, heroIdx) {
  return freieZonen(gs, pi, heroIdx).length > 0;
}

/**
 * ★ WO LANDET DER BROCKEN SELBST (Als Vorgabe 12.9.): sind alle drei
 * Grundzonen frei, in die MITTLERE — der Fels liegt dann zwischen den
 * beiden blockierten Plaetzen statt am Rand. Sonst der erste freie
 * Platz.
 */
function landeplatz(gs, pi, heroIdx) {
  const frei = freieZonen(gs, pi, heroIdx);
  if (frei.length === 0) return -1;
  if ([0, 1, 2].every(z => frei.includes(z))) return 1;
  return frei[0];
}

/** Der Zaehlerblock, der die Potion auf dem Brett zur Kreatur macht. */
function boulderCounters(potionData) {
  return {
    _cardDataOverride: {
      ...(potionData || {}),
      cardType: 'Creature/Token',
      hp: BOULDER_HP,
      level: BOULDER_LEVEL,
      effect: 'This Creature occupies all free Support Zones of the corresponding Hero. '
        + 'This Creature cannot be sacrificed.',
    },
    currentHp: BOULDER_HP,
    maxHp: BOULDER_HP,
    cannotBeSacrificed: true,
  };
}

module.exports = {
  isPotion: true,
  // Hooks feuern vom Brett aus (Zonen halten, Zonen freigeben) UND aus
  // der Hand heraus braucht die Karte nichts — `afterPotionUsed` laeuft
  // fuer die schon platzierte Instanz.
  activeIn: ['support'],

  // ★ Engine-Vertrag (v958): diese Karte kommt in keiner Opferauswahl vor.
  cannotBeSacrificed: true,

  canActivate(gs, playerIdx) {
    const oi = playerIdx === 0 ? 1 : 0;
    const heroes = gs.players[oi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      if (!heroes[hi]?.name) continue;
      if (hatFreieZone(gs, oi, hi)) return true;
    }
    return false;
  },

  getValidTargets(gs, playerIdx) {
    const oi = playerIdx === 0 ? 1 : 0;
    const out = [];
    const heroes = gs.players[oi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name) continue;
      if (!hatFreieZone(gs, oi, hi)) continue;
      out.push({ id: `hero-${oi}-${hi}`, type: 'hero', owner: oi, heroIdx: hi, cardName: hero.name });
    }
    return out;
  },

  targetingConfig: {
    title: CARD_NAME,
    description: "Place this card into a free Support Zone of one of your opponent's Heroes. "
      + 'It becomes a level 3 Creature with 150 HP that blocks every free Support Zone of that Hero.',
    confirmLabel: '🪨 Drop it!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    maxTotal: 1,
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const ziel = (validTargets || []).find(t => t.id === selectedIds[0]);
    if (!ziel) return;

    const gs = engine.gs;
    const oi = ziel.owner;
    if (!hatFreieZone(gs, oi, ziel.heroIdx)) return;      // Brett hat sich geaendert

    // ── Felsen auf ALLE freien Zonen (Als Vorgabe 12.9.) ───────────
    // Gestaffelt, damit es nach Steinschlag klingt und nicht nach einem
    // einzigen Aufschlag. Die Zonen, die gleich blockiert werden, sind
    // genau die, die jetzt noch frei sind — der Landeplatz des Brockens
    // selbst gehört dazu.
    const treffer = freieZonen(gs, oi, ziel.heroIdx);
    for (let i = 0; i < treffer.length; i++) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'falling_boulder', owner: oi, heroIdx: ziel.heroIdx, zoneSlot: treffer[i],
      });
      if (i < treffer.length - 1) await engine._delay(220);
    }
    await engine._delay(620);

    // Platzierung in die Zone des GEGNERS — der Besitzer ist damit er.
    const platz = engine.safePlaceInSupport(CARD_NAME, oi, ziel.heroIdx, landeplatz(gs, oi, ziel.heroIdx));
    if (!platz?.inst) return;
    const inst = platz.inst;

    // Kartendaten-Override: ab jetzt ist die Potion auf dem Brett eine
    // Kreatur mit 150 HP und Stufe 3.
    const potionData = engine._getCardDB()[CARD_NAME];
    inst.counters = { ...(inst.counters || {}), ...boulderCounters(potionData) };

    // „occupies all free Support Zones of the corresponding Hero"
    const ctx = engine._createContext(inst, {});
    multizone.claimZones(ctx, 'boulder_zones_claimed');

    engine.log('boulder_placed', {
      player: gs.players[pi]?.username,
      opponent: gs.players[oi]?.username,
      hero: ziel.cardName,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: ziel.heroIdx,
      _skipReactionCheck: true,
    });
    engine.sync();
  },

  hooks: {
    // Platzhalter halten (Puzzle-Nachtrag) und beim Abgang abraeumen.
    ...multizone.multiZoneHooks(CARD_NAME, { claimLog: 'boulder_zones_claimed' }),

    // ★ Nicht loeschen: die Karte liegt jetzt auf dem Brett.
    afterPotionUsed: async (ctx) => {
      if (ctx.potionName !== CARD_NAME) return;
      if (ctx.card?.zone !== 'support') return;
      ctx.setFlag('placed', true);
    },
  },
};

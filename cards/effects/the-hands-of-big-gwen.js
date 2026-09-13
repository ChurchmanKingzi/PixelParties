// ═══════════════════════════════════════════
//  CARD EFFECT: „The Hands of Big Gwen"
//  Artifact / EQUIPMENT (Kosten 20, PP MSGB)
//
//  „The equipped Hero's Attack stat is increased by 10.
//   Once per turn, when the equipped Hero hits one or more targets with
//   an Attack, its controller may choose a card from their discard pile
//   that is not an Attack and add it to their hand."
//
//  BAUART
//  ──────
//  • ATK-ZUSCHLAG ueber den Ausruestungs-Dreiklang (Muster Blade of the
//    Swamp Witch): `ctx.grantAtk` beim Anlegen, dasselbe beim
//    Spielstart (Puzzle-Aufbau, wenn die Karte schon liegt), und
//    `ctx.revokeAtk`, wenn sie ihre Zone verlaesst. Kein
//    `_applyHeroAtkDelta` — der waere DAUERHAFT, die Ausruestung gibt
//    aber nur, solange sie liegt.
//
//  • ★ „HITS one or more targets" — nicht „defeats". Ausgeloest wird,
//    sobald der Angriff bei irgendeinem Ziel ANKOMMT. Ein Angriff mit
//    mehreren Zielen fragt trotzdem nur EINMAL: die Marke haengt an der
//    Quelleninstanz des Angriffs (Wavilion-Muster), dieselbe
//    Identitaet, die auch die Engine fuer ihre Angriffs-Entprellung
//    benutzt.
//
//  • „Once per turn" ohne Zusatz = WEICH, je Instanz (v249). HOPT-
//    Schluessel mit der Karten-ID, beansprucht ERST beim Zugriff —
//    ein abgelehntes „may" bleibt fuer einen spaeteren Angriff im
//    selben Zug nutzbar (Sacrificial-Dagger-Muster). Zwei Paar Haende
//    am selben Helden haben eigene Schluessel.
//
//  • „a card ... that is NOT an Attack": gefiltert wird ueber den
//    KARTENTYP, nicht ueber den Subtyp — jede Karte der eigenen Ablage
//    ausser `cardType === 'Attack'`.
//
//  • „its controller" ist der Spieler, der den HELDEN kontrolliert —
//    an einen gegnerischen Helden angelegt gehoert die Karte ihm.
//    Verglichen wird deshalb die SEITE des Anhaengsels
//    (`physicalSide`), wie bei Hat of Madness.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Hands of Big Gwen';
const ATK_BONUS = 10;

/** Kam dieser Schaden vom ausgeruesteten Helden, per Attack? */
function vomWirt(ctx, quelle, typ) {
  if (typ !== 'attack' || !quelle) return false;
  if (quelle.zone === 'support') return false;          // Kreatur im selben Slot ist nicht der Held
  if ((quelle.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  const seite = quelle.heroOwner ?? quelle.owner ?? quelle.controller;
  return seite === (ctx.cardController ?? ctx.cardOwner);
}

/** Gemeinsamer Weg beider Treffer-Fenster. */
async function bieteRueckholungAn(ctx, quelle) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const ich = ctx.card;
  if (!ich || ich.zone !== 'support') return;

  // Ein Angriff = ein Angebot, auch bei mehreren Zielen.
  const marke = `_gwenHandsOffered_${ich.id}`;
  if (quelle[marke]) return;
  quelle[marke] = true;

  const pi = engine.physicalSide(ich);
  const ps = gs.players[pi];
  if (!ps) return;

  // Weiches Once per turn — erst NACHSEHEN, beansprucht wird beim Zugriff.
  const hoptKey = `gwen-hands:${ich.id}`;
  if (gs.hoptUsed?.[`${hoptKey}:${pi}`] === gs.turn) return;

  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  const kandidaten = [];
  for (const name of (ps.discardPile || [])) {
    if (gesehen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || cd.cardType === 'Attack') continue;      // „not an Attack"
    gesehen.add(name);
    kandidaten.push({ name, source: 'discard' });
  }
  if (kandidaten.length === 0) return;

  const wahl = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: kandidaten,
    title: CARD_NAME,
    description: 'Choose a card from your discard pile that is not an Attack and add it to your hand.',
    confirmLabel: '🕰️ Take it',
    confirmClass: 'btn-info',
    cancellable: true,
  });
  if (!wahl || wahl.cancelled || !wahl.cardName) return;   // „may" — HOPT bleibt frei
  if (!kandidaten.some(k => k.name === wahl.cardName)) return;

  // ── Ab hier verbindlich ──────────────────────────────────────────
  if (!engine.claimHOPT(hoptKey, pi)) return;
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

  const idx = (ps.discardPile || []).indexOf(wahl.cardName);
  if (idx < 0) return;
  if (!(await engine.takeFromPile(ps, 'discard', idx, { source: CARD_NAME }))) return;

  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: wahl.cardName, from: 'discard', to: 'hand',
    toHandIdx: ps.hand.length,
  });
  await engine._delay(560);

  ps.hand.push(wahl.cardName);
  engine._trackCard(wahl.cardName, pi, 'hand');
  engine.log('gwen_hands_recover', {
    player: ps.username, card: wahl.cardName,
  });
  engine.sync();
}

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  // Abbrechbare Prompts bricht die Engine fuer die CPU pauschal ab
  // (Befund v828). Sie nimmt die teuerste Karte zurueck — was viel
  // kostet, ist in der Regel auch das, was sie wiederhaben will.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const karten = promptData.cards || [];
    if (karten.length === 0) return undefined;
    const db = engine?._getCardDB?.() || {};
    let beste = karten[0];
    for (const k of karten) {
      if ((db[k.name]?.cost || 0) > (db[beste.name]?.cost || 0)) beste = k;
    }
    return { cardName: beste.name, source: 'discard' };
  },

  hooks: {
    // ── ATK-Zuschlag, solange die Karte liegt ────────────────────────
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.card.heroIdx
          || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },

    // ── Treffer an einem HELDEN ─────────────────────────────────────
    afterDamage: async (ctx) => {
      if (!ctx.card) return;
      if (!vomWirt(ctx, ctx.source, ctx.type)) return;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined || !ziel.statuses) return;   // Kreaturen unten
      await bieteRueckholungAn(ctx, ctx.source);
    },

    // ── Treffer an CREATURES ────────────────────────────────────────
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.card || !ctx.entries) return;
      for (const e of ctx.entries) {
        if (!vomWirt(ctx, e.source, e.type)) continue;
        await bieteRueckholungAn(ctx, e.source);
        return;
      }
    },
  },
};

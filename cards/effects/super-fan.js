'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Super Fan"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may discard two Ability cards from your hand to summon this Creature as an additional Action. You may once per turn reveal the top
//   card of your deck. If it is an Ability, immediately attach it to a Hero you control as an additional attachment, if possible. Otherwise,
//   put it on top or bottom of your deck (your choice)."
//
//  ── ① BESCHWÖRUNG ALS ZUSATZAKTION (gemeinsame Bauform, `_extra-summon-shared.js`, `count: 2`) ───────────
//  Kosten: ZWEI Ability-Karten aus der HAND abwerfen — eine Auswahl mit Bestätigen (`handPick`, genau zwei; erst nach dem Bestätigen wird abgeworfen,
//  Abbruch lehnt die Beschwörung ab, nichts ist verbraucht). Die Regel (Als Vorgabe 10.10.): Hat man keine Aktion (Main Phase / Action Phase ohne freie Aktion),
//  MÜSSEN die Kosten gezahlt werden — die Zusatzaktion ist der einzige Weg. Hat man eine Aktion frei (Action Phase), darf man wählen: „Special" (zwei Abilities
//  abwerfen, Aktion bleibt) oder „Normal" (Aktion des Helden). Mit weniger als zwei Abilities auf der Hand gibt es nur den normalen Weg.
//  Effekt-Beschwörungen zahlen nichts.
//
//  ── ② EINMAL PRO ZUG: OBERSTE KARTE AUFDECKEN (`_deck-top-shared.js`) ───────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion): die oberste Deckkarte fliegt in die Bildmitte, dreht sich um und BLEIBT
//  dort liegen, bis entschieden ist, wohin sie kommt (beide Spieler sehen sie). Ist sie eine ABILITY, wird sie SOFORT (kein „may") an einen Helden angelegt,
//  den du kontrollierst — „as an additional attachment", also ohne das Anlegen des Helden für diesen Zug zu verbrauchen (`skipAbilityGivenCheck`), „if possible":
//    • tauglicher Held: lebendig, dein eigener (kein an den Gegner verliehener) und mit Platz für die Karte (`canAttachAbilityToHero` → `abilityZielZone`:
//      freie Zone oder gleichnamiger Stapel unter Stufe 3, verwahrte/versiegelte Zonen, `restrictedAttachment` wie Divinity bleibt draußen). Die Zonenregeln
//      sind EXAKT die des normalen Anlegens; nur das Zug-Kontingent entfällt.
//    • mehrere taugliche Helden: der Spieler wählt bei liegender Karte (Heldenwahl `abilityAttachTarget`, ohne Abbruch; ein Klick auf eine bestimmte
//      Ability Zone wählt auch den Platz); genau einer → direkt. Dann fliegt die Karte aus der Mitte auf den Platz (Flugziel `dest: 'ability'`) und wird mit
//      allen Anlege-Hooks angelegt (`attachAbilityFromHand` über den Durchgang `handZugangSync(… 'transit')`, kein Handflug). Kein Mischen: das Aufdecken ist
//      keine Suche.
//    • kein Held kann sie aufnehmen / keine Ability / Deck-Entnahme gesperrt („Otherwise") → der Spieler legt die Karte oben oder unten auf das Deck (sie liegt dabei
//      in der Mitte und fliegt danach rückwärts umgedreht zurück ins Deck).
//  Ohne Karte im Deck ist der Effekt nicht aktivierbar.
//  Grenze: Von Styx/Charm LEIHWEISE gehaltene Helden der Gegenseite sind keine Ziele (die Heldenwahl kennt nur eigene Helden).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `fan_cheer` (Pixelart, Hülle `ppSalve`; Vorlage: das Kartenbild — der Fan mit dem Leuchtstab und die Herzen) läuft AUF DEM DECK
//  (Als Vorgabe 10.10.: „auf dem Deck angezeigt, nicht auf den Creatures selbst"; `originDeck` + Ziel `{ owner, deck: true }`): ein Leuchtstab schwingt über
//  dem Deck, rosa und grüne Herzen steigen auf. Klänge in ZONE_ANIM_SFX; Log `super_fan`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { makeDiscardCostSummon } = require('./_extra-summon-shared');
const { oberste, haltenImZentrum, gibFrei, obenOderUnten, cpuBehaeltOben } = require('./_deck-top-shared');

const CARD_NAME = 'Super Fan';
const FAN_MS = 700;          // Länge des Schwenkens bis zum Aufdecken (deckt sich mit `fan_cheer` im Client; +100 ms Einbau-Versatz)
const KOSTEN_ANZAHL = 2;

const kosten = makeDiscardCostSummon({
  cardName: CARD_NAME,
  count: KOSTEN_ANZAHL,
  eligible: (engine, pi, name, handIdx, cd) => hasCardType(cd, 'Ability'),
  description: `Discard ${KOSTEN_ANZAHL} Ability cards from your hand to summon ${CARD_NAME} as an additional Action.`,
});

/** Eigene Helden (Slot-Indizes), die `name` JETZT als zusätzliche Anlage aufnehmen könnten — leer = „if possible" scheitert. */
function moeglicheHelden(engine, pi, name) {
  const cd = engine._getCardDB()[name];
  if (!cd || !hasCardType(cd, 'Ability')) return [];
  if (!engine.pileOutAllowed(pi, 'deck', { source: CARD_NAME })) return [];      // Deck-Entnahme gesperrt → nichts anzulegen
  const ps = engine.gs.players[pi];
  const out = [];
  (ps?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    if (engine.heroSideOf(pi, h) !== pi) return;                                 // nur Helden, die ich kontrolliere (kein verliehener Held)
    if (engine.canAttachAbilityToHero(pi, name, hi)) out.push(hi);
  });
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: kosten.canSummon,
  inherentAction: kosten.inherentAction,
  beforeSummon: kosten.beforeSummon,

  /** Aktivierbar, solange das Deck nicht leer ist (Aufdecken ist keine Suche). */
  canActivateCreatureEffect(ctx) {
    return !!oberste(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const top = oberste(engine, pi);
    if (!ps || !top) return false;

    // Der Leuchtstab schwingt über dem DECK.
    engine._broadcastEvent('play_zone_animation', {
      type: 'fan_cheer', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: FAN_MS + 400,
      targets: [{ owner: pi, deck: true }],
      originOwner: pi, originDeck: true,
    });
    await engine._delay(FAN_MS);

    // Aufdecken: die Karte liegt in der Bildmitte, bis entschieden ist, wohin sie kommt.
    const key = await haltenImZentrum(engine, pi, top, { source: CARD_NAME });
    let angelegtAn = null;
    let lage = null;
    let freigegeben = false;
    try {
      // „If it is an Ability, immediately attach it to a Hero you control as an additional attachment, if possible."
      const helden = moeglicheHelden(engine, pi, top);
      let ziel = null;
      if (helden.length > 0) {
        let heroIdx = helden[0];
        let wunsch = -1;
        if (helden.length > 1) {
          const wahl = await engine.promptGeneric(pi, {
            type: 'abilityAttachTarget', cardName: top, eligibleHeroIdxs: helden,
            skipAbilityGiven: true,                          // zusätzliche Anlage: der Client blendet die „einmal pro Zug"-Sperre aus
            title: CARD_NAME,
            description: `Attach "${top}" to one of your Heroes as an additional attachment.`,
            cancellable: false,
          });
          if (wahl && typeof wahl.heroIdx === 'number' && helden.includes(wahl.heroIdx)) heroIdx = wahl.heroIdx;
          if (wahl && typeof wahl.zoneSlot === 'number') wunsch = wahl.zoneSlot;
        }
        const zone = engine.abilityZielZone(pi, heroIdx, top, { wunschZone: wunsch });
        if (zone >= 0 && oberste(engine, pi) === top) ziel = { heroIdx, zone };
        // ★ Welle 14 (Al, Q5): Resistance blockt das Anlegen per Effekt — vor jeder Kartenbewegung; die Karte geht dann den „Otherwise"-Weg (oben/unten).
        if (ziel && await engine.abilityAnlegenDurchResistanceBlockiert(pi, pi, ziel.heroIdx, CARD_NAME)) ziel = null;
      }
      if (ziel) {
        // Die Karte fliegt aus der Mitte in ihre Ability Zone; gebucht wird mit der Landung.
        await gibFrei(engine, pi, key, top, { dest: 'ability', destHeroIdx: ziel.heroIdx, destSlotIdx: ziel.zone, destSide: pi });
        freigegeben = true;
        const entnommen = await engine.takeFromPile(pi, 'deck', top, { source: CARD_NAME });
        if (entnommen) {
          engine.handZugangSync(pi, top, { von: 'transit', source: CARD_NAME });   // Durchgang zur Anlage, keine Suche
          const res = await engine.attachAbilityFromHand(pi, top, ziel.heroIdx, {
            skipAbilityGivenCheck: true, resistanzGeprueft: true, targetZoneSlot: ziel.zone, keinFlug: true,
          });
          if (res?.success) angelegtAn = ps.heroes[ziel.heroIdx]?.name || true;
          else engine.log('super_fan_fizzle', { player: ps.username, card: top });
        }
      }
      // „Otherwise, put it on top or bottom of your deck (your choice)."
      if (!angelegtAn && oberste(engine, pi) === top) lage = await obenOderUnten(engine, pi, top, { source: CARD_NAME });
    } finally {
      // Liegt die Karte noch in der Mitte (nicht angelegt, auch wenn oben etwas schiefging), fliegt sie zurück ins Deck.
      if (!freigegeben) await gibFrei(engine, pi, key, top, { dest: 'deck' });
    }
    engine.log('super_fan', { player: ps.username, card: top, attachedTo: angelegtAn === true ? null : angelegtAn, placed: lage });
    engine.sync();
    return true;
  },

  /** CPU: Special statt Normal, eine gute Karte oben lassen, eine schwache nach unten. */
  cpuResponse(engine, kind, payload) {
    const r = kosten.cpuResponse(engine, kind, payload);
    if (r !== undefined) return r;
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME || payload.type !== 'confirm') return undefined;
    if (payload._topOrBottom) {
      const pi = engine._cpuPlayerIdx;
      return cpuBehaeltOben(engine, pi, payload.showCard) ? { confirmed: true } : null;
    }
    return undefined;
  },

  _test: { ...kosten._test, moeglicheHelden },
};

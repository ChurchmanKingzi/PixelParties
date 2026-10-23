'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Front Soldier"
//  Creature / Reaction (Summoning Magic Lv0, 50 HP) — Text neu (Als Vorgabe 10.10.)
//
//  „Immediately summon this Creature from your hand as an additional Action when your opponent plays a Reaction or activates a Surprise.
//   Negate that Reaction or Surprise. Then, both players draw 2 cards."
//
//  (Vorher: „… Your opponent draws 2 cards." — jetzt ziehen BEIDE, der Besitzer zuerst, dann der Gegner.)
//
//  ── DREI WEGE, auf denen „your opponent plays a Reaction or activates a Surprise" eintritt ──────────────────
//  Die Karte ist eine Handfalle (`activeIn: ['hand']`, Reaction-Creature: nie proaktiv spielbar) und lauscht an drei Stellen:
//
//   ① KETTENFENSTER — der Gegner spielt eine Reaction in eine Kette (Bauform Cute Camera + Rebelliokai Courtly Kirin): `isReaction` +
//     `reactionCondition` (das oberste Kettenglied ist eine Reaction des GEGNERS: jedes spätere Glied einer Kette ist eine, dazu eine als
//     Erstes gespielte Reaction-Karte; Helden-Effekte zählen nicht) und ein Platz für die Beschwörung. Die Auflösung (`resolve`) beschwört
//     den Soldaten (`skipPostResolveDiscard`: er landet über `summonCreatureWithHooks` auf dem Brett, kein Nachwurf in die Ablage),
//     negiert das Glied DIREKT DARUNTER (`negateChainLink`) und lässt beide ziehen. Scheitert die Beschwörung, wandert die Karte in die
//     Ablage und nichts wird negiert.
//   ② SURPRISE-AKTIVIERUNG — Handfalle über `hooks.onSurpriseActivated` (Bauform Boots of Hermes): der Gegner aktiviert eine Surprise →
//     Abfrage → der Soldat wird SOFORT aus der Hand beschworen (`sofortAusHandBeschwoeren`, Zonenwahl, „additional Action") → die Surprise
//     wird negiert (`ctx.setFlag('_surpriseNegated', true)`, die Engine verbraucht sie wie einen negierten Zauber) → beide ziehen 2.
//   ③ HAND-REAKTIONSFENSTER — der Gegner spielt eine Reaction in einem der eigenen Engine-Fenster (Held besiegt, vor Schaden,
//     Board-Karte in die Ablage … `_rxHandkarteEinsetzen`, KEINE Kette): neuer allgemeiner Hook `onReactionPlayed` (Engine:
//     `_rxHandkarteEinsetzen` feuert ihn, wenn die Reaction bezahlt und aufgedeckt ist; `ctx.setFlag('_reactionNegated', true)` lässt ihre
//     Wirkung ausfallen — die Karte liegt dann in der Ablage, die Kosten sind bezahlt, wie bei jeder negierten Karte). Ablauf wie ②.
//
//  „IMMEDIATELY SUMMON … AS AN ADDITIONAL ACTION": eine GANZ NORMALE Beschwörung (Als Ruling 8.8.): tauglicher Beschwörer (lebendig, nicht
//  Frozen/Stunned/Webbed/Bound/Negated, keine Beschwörungs-/Aktionssperre), freie Zone — ohne die ist die Handfalle nicht einsetzbar. Die
//  Beschwörung ist die Zusatzaktion (`alsZusatzaktion`), keine Aktion des Zuges. Mehrere mögliche Zonen: der Spieler wählt.
//
//  ★ REACTION-CREATURES AUS DER HAND GELTEN AUCH ALS „GESPIELTE REACTIONS" (Als Korrektur 10.10.): Doomed Town Guard, Explosive Drone, Enhanced Guard
//  Dog, Chaorc Rider Warg und Elven Rider beschwören sich über ihren EIGENEN Hook-Weg — aber alle fünf rufen `summonCreatureWithHooks` mit
//  `fromHandIdx` + `summonWindow: true`. Genau dort (Engine, vor dem Landen) feuert `onReactionPlayed` (Weg ③); der Soldat negiert: die Karte geht in
//  die Ablage statt aufs Brett, der Aufrufer sieht `{ negated: true, inst: null }` und beendet seinen Effekt ohne Wirkung (derselbe Vertrag wie bei Off Duty).
//  Rebelliokai Courtly Kirin ist ein Kettenglied (Weg ①). „Wendy, the Shy Girl" hat noch kein Skript.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `front_soldier_block` (Pixelart, Brett-Animation, Hülle `ppSalve`; Vorlage: das Kartenbild — der gepanzerte Wächter): am
//  Platz des Soldaten kracht ein Schild von oben herab, Schlagring und Funken, bei ~280 ms der Aufprall (+100 ms Einbau-Versatz). Klänge in
//  ZONE_ANIM_SFX; Logs `front_soldier` (`negated`, `via`).
// ═══════════════════════════════════════════

const { eligibleSummonZones, sofortAusHandBeschwoeren } = require('./_summon-eligibility');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Front Soldier';
const DRAW = 2;
const BLOCK_MS = 560;        // bis zum Aufprall des Schildes (deckt sich mit `front_soldier_block` im Client; +100 ms Einbau-Versatz)

/** Plätze, auf die der Soldat JETZT als Zusatzaktion beschworen werden könnte (leer = Handfalle nicht einsetzbar). */
function zonen(engine, pi) {
  return eligibleSummonZones(engine, pi, CARD_NAME, { nachKontrolle: true, alsAktion: true });
}

/** Ist dieses Kettenglied eine Reaction des Gegners von `pi`? */
function gegnerReaktion(engine, pi, link) {
  if (!link || link.owner === pi || link.fromHero) return false;
  if (!link.isInitialCard) return true;                        // jedes spätere Glied einer Kette IST eine Reaction
  const cd = engine._getCardDB()[link.cardName];               // als Erstes gespielt: nur eine Karte mit Untertyp Reaction …
  // … und KEINE Creature: der erste Glied eines Beschwörungsfensters („A creature was just summoned") ist die Beschwörung selbst. Reaction-Creatures
  // aus der Hand gelten über `onReactionPlayed` (Weg ③) als gespielt — hier zusätzlich zuzugreifen hieße, dieselbe Entscheidung zweimal zu fragen.
  return !!cd && (cd.subtype || '') === 'Reaction' && !hasCardType(cd, 'Creature');
}

/** „Then, both players draw 2 cards." — der Besitzer zuerst, dann der Gegner. */
async function beideZiehen(engine, pi) {
  await engine.actionDrawCards(pi, DRAW);
  await engine.actionDrawCards(engine.opponentOf(pi), DRAW);
}

/** Schild-Auftritt am Platz des Soldaten, dann der Aufprall abwarten. */
async function schildKracht(engine, owner, heroIdx, slotIdx) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'front_soldier_block', zoneType: 'board', owner, heroIdx: -1, zoneSlot: -1, duration: BLOCK_MS + 500,
    targets: [{ owner, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME }],
    originOwner: owner, originHeroIdx: heroIdx, originZoneSlot: slotIdx,
  });
  await engine._delay(BLOCK_MS);
}

/**
 * Gemeinsamer Ablauf der Handfallen ② und ③: Abfrage → Beschwörung aus der Hand → (Aufruf-seitig) Negieren → beide ziehen.
 * `negiere()` setzt das Flag des jeweiligen Hooks. Gibt true zurück, wenn negiert wurde.
 */
async function handfalle(ctx, { gegnerKarte, gegnerName, art, schon, negiere }) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOriginalOwner;
  if (gegnerKarte == null || gegnerKarte === pi) return false;     // nur auf den GEGNER reagieren
  if (schon()) return false;                                        // schon negiert (frühere Kopie / anderer Effekt)
  const inst = ctx.card;
  if (!inst || inst.zone !== 'hand') return false;
  const ps = gs.players[pi];
  if (!ps || ps.hand.indexOf(CARD_NAME) < 0) return false;
  if (zonen(engine, pi).length === 0) return false;                 // kein tauglicher Beschwörer / Platz → nicht einsetzbar

  const antwort = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `Your opponent ${art === 'surprise' ? 'activated' : 'played'} "${gegnerName}". Summon ${CARD_NAME} as an additional Action to negate it? Then both players draw ${DRAW} cards.`,
    showCardLeft: CARD_NAME,                                        // links der Soldat selbst (die Reaktionskarte), rechts der Auslöser — wie im Kettenfenster
    showCard: gegnerName || undefined,
    confirmLabel: '🛡️ Negate!',
    cancelLabel: 'Pass',
    cancellable: true,
    gerrymanderEligible: true,
  });
  if (!antwort || antwort.cancelled) return false;
  if (schon()) return false;                                        // nach der Abfrage neu prüfen
  if (ps.hand.indexOf(CARD_NAME) < 0) return false;

  engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
  await engine._delay(800);
  let platz = null;
  const ok = await sofortAusHandBeschwoeren(engine, pi, CARD_NAME, {
    source: CARD_NAME,
    nachZonenwahl: async (z) => { platz = z; await schildKracht(engine, z.owner ?? pi, z.heroIdx, z.slotIdx); },
  });
  if (!ok) return false;                                            // Abbruch in der Zonenwahl: nichts negiert, nichts gezogen

  negiere();
  engine.log('front_soldier', { player: ps.username, negated: gegnerName, via: art });
  await beideZiehen(engine, pi);
  engine.sync();
  void platz;
  return true;
}

module.exports = {
  selfDeleteOnExternalDiscard: false,
  // Reaction-Creature: `isReaction` öffnet das Kettenfenster, die Engine verwehrt proaktives Spielen (Untertyp Reaction, kein `proactivePlay`).
  isReaction: true,
  // Der Soldat beschwört sich in `resolve` selbst aufs Brett — kein Nachwurf in die Ablage.
  skipPostResolveDiscard: true,
  activeIn: ['hand'],
  canSummon: () => true,

  cpuMeta: {
    // Der Soldat ist ein Körper UND ein Negator: die CPU setzt ihn gegen jede gegnerische Reaction ein, sobald er einsetzbar ist
    // (die Bedingung prüft schon den Platz); beide ziehen 2 — kein Nachteil, der den Einsatz verbietet.
    reactionHeuristic: () => true,
  },

  /** CPU: die Handfallen-Frage (②, ③) immer bejahen — der Soldat ist Körper UND Negator, die Bedingung hat den Platz schon geprüft. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },

  /** ① Kettenfenster: das oberste Glied ist eine Reaction des Gegners, und es gibt einen Platz für den Soldaten. */
  reactionCondition(gs, pi, engine, chainCtx) {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    if (!gegnerReaktion(engine, pi, chainCtx.chain[chainCtx.chain.length - 1])) return false;
    return zonen(engine, pi).length > 0;
  },

  /** ① Auflösung (LIFO — vor der gegnerischen Reaction): beschwören, das Glied darunter negieren, beide ziehen 2. */
  async resolve(engine, pi, _selectedIds, _validTargets, chain, myIdx) {
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const fallbackDiscard = () => { engine.handKartenBesitzerPs(ps, CARD_NAME).discardPile.push(CARD_NAME); engine.sync(); };   // W64c: Ablage des permanenten Besitzers (gestohlene Handkarte)

    const frei = zonen(engine, pi);
    if (frei.length === 0) { fallbackDiscard(); return false; }
    let ziel = frei[0];
    if (frei.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick', title: CARD_NAME,
        description: `Summon ${CARD_NAME} into which Support Zone? (as an additional Action)`,
        zones: frei, cancellable: false, heroShortcut: false,
      });
      ziel = frei.find(z => z.heroIdx === wahl?.heroIdx && z.slotIdx === wahl?.slotIdx && (z.owner ?? pi) === (wahl?.owner ?? pi)) || frei[0];
    }

    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
    await engine._delay(600);
    await schildKracht(engine, ziel.owner ?? pi, ziel.heroIdx, ziel.slotIdx);
    const res = await engine.summonCreatureWithHooks(CARD_NAME, ziel.owner ?? pi, ziel.heroIdx, ziel.slotIdx, {
      source: `${CARD_NAME} reaction`, controller: pi, alsZusatzaktion: true, hookExtras: { _isNormalSummon: false },
    });
    if (!res) { fallbackDiscard(); return false; }

    // Das Glied direkt unter dem eigenen negieren (die Reaction des Gegners, auf die geantwortet wurde).
    const ziel2 = (chain && myIdx > 0) ? chain[myIdx - 1] : null;
    if (ziel2) {
      engine.negateChainLink(chain, myIdx - 1);
      engine.log('reaction_negated', { negator: CARD_NAME, negated: ziel2.cardName, owner: pi });
    }
    engine.log('front_soldier', { player: ps.username, negated: ziel2?.cardName || null, via: 'chain' });
    await beideZiehen(engine, pi);
    engine.sync();
    return true;
  },

  hooks: {
    /** ② Der Gegner aktiviert eine Surprise. */
    onSurpriseActivated: async (ctx) => {
      await handfalle(ctx, {
        gegnerKarte: ctx.surpriseController ?? ctx.surpriseOwner,
        gegnerName: ctx.surpriseCardName || 'that Surprise',
        art: 'surprise',
        schon: () => !!ctx._surpriseNegated,
        negiere: () => { ctx.setFlag('_surpriseNegated', true); ctx.setFlag('_surpriseNegatedBy', CARD_NAME); },
      });
    },

    /** ③ Der Gegner spielt eine Reaction in einem Hand-Reaktionsfenster der Engine (`_rxHandkarteEinsetzen`). */
    onReactionPlayed: async (ctx) => {
      await handfalle(ctx, {
        gegnerKarte: ctx.reactionOwner,
        gegnerName: ctx.reactionCardName || 'that Reaction',
        art: 'reaction',
        schon: () => !!ctx._reactionNegated,
        negiere: () => { ctx.setFlag('_reactionNegated', true); ctx.setFlag('_reactionNegatedBy', CARD_NAME); },
      });
    },
  },

  _test: { zonen, gegnerReaktion },
};

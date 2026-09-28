// ═══════════════════════════════════════════
//  CARD EFFECT: „Ethan, the Prodigy"
//  Creature (Summoning Magic Lv1, 50 HP)   (banned)
//
//  "You may immediately summon this Creature as an additional Action
//   when you use a Spell with an original level of 4 or higher. While
//   this Creature is on the board, the levels of all Spells in both
//   players' hands are reduced by 1 while in hand. You can only control
//   1 \"Ethan, the Prodigy\"."
//
//  ── DREI TEILE ────────────────────────────────────────────────────
//  ① SOFORT-BESCHWOERUNG aus der HAND, wenn ein Spell mit ORIGINALER
//     Stufe ≥ 4 eingesetzt wurde. Die Karte lauscht also aus der Hand
//     (`activeIn` enthaelt 'hand').
//
//     ★ „ORIGINAL LEVEL" heisst der GEDRUCKTE Wert, nicht der
//     ermaessigte. Genau das ist hier heikel, weil Ethan selbst Stufen
//     senkt: haette man den effektiven Wert genommen, koennte ein
//     zweiter Ethan sich nie mehr ausloesen, sobald der erste liegt.
//     Deshalb `cardData.level` aus der Kartendatenbank, NICHT
//     `effectiveCardLevel`.
//
//  ② STUFENSENKUNG fuer BEIDE Seiten, nur in der HAND.
//     • `reduceCardLevel` ist der generische Vertrag; der Motor laeuft
//       ohnehin ueber jede Instanz.
//     • `globalReduceCardLevel: true` hebt den Standard-Filter auf, der
//       sonst nur die eigene Seite beliefert — „both players' hands"
//       verlangt genau das.
//     • `evalOpts.pileSide` markiert Auswertungen aus Deck, Ablage oder
//       Geloeschtem; dort gilt die Senkung NICHT („while in hand").
//       Muster von „Chaorc Ruin Mourner".
//
//  ③ „YOU CAN ONLY CONTROL 1" — Beschwoerungssperre, solange schon
//     einer liegt. Greift auch fuer die Sofort-Beschwoerung.
//
//  ── MEHRERE ETHANS STAPELN NICHT ─────────────────────────────────
//  Weil man nur einen kontrollieren darf, stellt sich die Frage kaum —
//  ein gegnerischer Ethan liegt aber auf der ANDEREN Seite und senkt
//  ebenfalls global. Zwei Ethans (einer je Seite) ergeben damit -2 in
//  beiden Haenden. Das folgt woertlich aus „all Spells in both players'
//  hands" und ist kein Versehen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Ethan, the Prodigy';
const AUSLOESE_STUFE = 4;

/** Kontrolliert `pi` bereits einen Ethan auf dem Brett? */
function hatEthan(engine, pi) {
  return (engine.cardInstances || []).some(c =>
    c.name === CARD_NAME && c.zone === 'support' && !c.faceDown
    && (c.controller ?? c.owner) === pi);
}

/** Freie Support-Zonen, in die `pi` beschwoeren darf. */
function freieZonen(engine, pi) {
  return engine.getFreeSupportZones(pi, { nachKontrolle: true, livingHeroesOnly: true })
    .filter(z => darfUeberHeld(engine, pi, z.owner, z.heroIdx));
}

// Kontrolle statt Seite (Styx 28.9.) — beschworen wird mit „a Hero you
// control": auch ein uebernommener Held der Gegenspalte (Zone traegt
// `owner` = physische Seite), ein abgegebener eigener dagegen nicht.
// `_canHeroActivateSurprise` kennt nur die eigene Spalte — fuer den
// uebernommenen Helden dieselben Kernpruefungen an der physischen Adresse.
function darfUeberHeld(engine, pi, feld, hi) {
  if (feld === pi) return engine._canHeroActivateSurprise(pi, hi, CARD_NAME);
  if (engine._reaktionGesperrt(pi)) return false;
  const hero = engine.gs.players[feld]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  const st = hero.statuses || {};
  if (st.frozen || st.stunned || st.webbed || st.negated) return false;
  return engine.heroMeetsLevelReq(feld, hi, engine._getCardDB()[CARD_NAME], { levelSourcePi: pi });
}

module.exports = {
  activeIn: ['hand', 'support'],

  // ② Die Senkung gilt fuer BEIDE Seiten — ohne dieses Flag beliefert
  // der Motor nur die eigene.
  globalReduceCardLevel: true,

  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts) {
    // Nur wirksam, solange Ethan auf dem BRETT liegt.
    if (!inst || inst.zone !== 'support' || inst.faceDown) return 0;
    if (!cardData || cardData.cardType !== 'Spell') return 0;
    // „while in hand" — Auswertungen aus Deck/Ablage/Geloeschtem tragen
    // `pileSide` und bleiben unberuehrt (Ruin-Mourner-Muster).
    if (evalOpts?.pileSide) return 0;
    return 1;
  },

  hooks: {
    /**
     * ① „when you use a Spell with an original level of 4 or higher"
     *
     * `afterSpellResolved` feuert nur bei WIRKLICH aufgeloesten Karten
     * und deckt auch die Sonderwege ab (zusaetzliche, freie, sofortige
     * und Ersatz-Aktionen) — dieselbe Wahl wie bei Pharaoh und Santa.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hand') return;      // nur aus der Hand
      const pi = ctx.cardOwner;
      if (ctx.casterIdx !== pi) return;               // „when YOU use"

      const cd = ctx.spellCardData;
      if (!cd || cd.cardType !== 'Spell') return;
      // ★ ORIGINALE Stufe — der gedruckte Wert.
      if ((cd.level || 0) < AUSLOESE_STUFE) return;

      const ps = engine.gs.players[pi];
      if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;
      if (hatEthan(engine, pi)) return;               // ③ nur einer
      const zonen = freieZonen(engine, pi);
      if (zonen.length === 0) return;

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: CARD_NAME,
        message: `Summon ${CARD_NAME} as an additional Action?`,
        confirmLabel: '✨ Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ja) return;

      // Nach der Abfrage neu pruefen — das Brett kann sich waehrend des
      // Ueberlegens geaendert haben.
      if (!(ps.hand || []).includes(CARD_NAME)) return;
      if (hatEthan(engine, pi)) return;
      const zonenJetzt = freieZonen(engine, pi);
      if (zonenJetzt.length === 0) return;

      let ziel = zonenJetzt[0];
      if (zonenJetzt.length > 1) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'zonePick',
          title: CARD_NAME,
          description: `Summon ${CARD_NAME} into which Support Zone?`,
          zones: zonenJetzt,
          cancellable: true,
        });
        if (!wahl || wahl.cancelled) return;
        ziel = zonenJetzt.find(z => z.owner === (wahl.owner ?? pi) && z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx)
          || zonenJetzt.find(z => z.heroIdx === wahl.heroIdx && z.slotIdx === wahl.slotIdx);
        if (!ziel) return;
      }
      const feld = ziel.owner ?? pi;   // Kontrolle statt Seite (Styx 28.9.)

      const handIdx = ps.hand.indexOf(CARD_NAME);
      engine.takeFromPileSync(ps, 'hand', handIdx);
      const res = await engine.summonCreatureWithHooks(
        CARD_NAME, feld, ziel.heroIdx, ziel.slotIdx,
        {
          source: CARD_NAME, fromHandIdx: handIdx, ...(feld !== pi ? { controller: pi } : {}),
          // Kontrolle statt Seite (Styx 28.9.): `beforeSummon` sieht als
          // `cardOwner` die Feldseite — der Beschwoerer kommt extra mit.
          hookExtras: { _isNormalSummon: false, ethanKontrolleur: pi },
        },
      );
      if (!res?.inst) { engine.handZugangSync(ps, CARD_NAME, { von: 'rueckgabe', ohneInstanz: true }); return; }   // v1395

      engine.log('ethan_prodigy_summon', {
        player: ps.username, trigger: ctx.spellName || null, level: cd.level,
      });
      engine._broadcastEvent('summon_effect', {
        owner: feld, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
      });
      engine.sync();
    },

  },

  /**
   * ③ „You can only control 1 «Ethan, the Prodigy»."
   *
   * ★ `beforeSummon` ist KEIN Hook, sondern eine Karten-Funktion, die
   * der Motor vor JEDER Beschwoerung dieser Karte aufruft — `false`
   * bricht sie ab. Dadurch greift die Sperre sowohl gegen die normale
   * Beschwoerung als auch gegen den Sofort-Weg oben, ohne dass beide
   * sie einzeln pruefen muessten.
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.ethanKontrolleur ?? ctx.cardOwner;   // Styx 28.9. (s. Sofort-Weg)
    return !hatEthan(engine, pi);
  },

  /** CPU: eine Gratis-Kreatur, die beiden Seiten die Stufen senkt. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    if (promptData.type === 'zonePick') {
      const z = (promptData.zones || [])[0];
      return z ? { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },
};

// ═══════════════════════════════════════════
//  CARD EFFECT: „Aurora Borealis"
//  Spell (Magic Arts Lv 1, PP MBS1, Secret Rare)
//
//  „Choose up to 1/2/3 Spells with different names from your deck,
//   reveal them and add them to your hand. If the user has Magic Arts 3,
//   you may delete 2 of your chosen Spells to immediately perform the
//   third one as an additional Action with the user."
//
//  BAUART
//  ──────
//  • ★ „1/2/3" IST DAS MAGIC-ARTS-LEVEL DES NUTZERS (Als Vorgabe
//    12.9.): Lv 1 → eine Karte, Lv 2 → zwei, Lv 3 und hoeher → drei.
//    Gelesen mit `effectiveSchoolLevelForCaster`, das Ability-Stapel in
//    Support Zones mitzaehlt (Xal, Xalibur) — NICHT die rohe
//    Ability-Zone.
//
//  • „up to": weniger geht, gar keine nicht — der Waehler verlangt
//    mindestens eine Karte und laesst sich abbrechen (dann meldet die
//    Karte `gs._spellCancelled` und bleibt auf der Hand).
//
//  • „with different names": je Name nur ein Eintrag in der Galerie.
//
//  • Die Karten kommen aus dem DECK auf die Hand — also `card_reveal`
//    (beide Seiten sehen sie) und `deck_search_add` (der Flug aus dem
//    Deck). NICHT `hand_card_materialize`: das ist fuer Karten von
//    AUSSERHALB des Spiels (v995).
//
//  • ★ DER DRITTE ZAUBER: nur bei Magic Arts 3 UND drei gewaehlten
//    Karten. Angeboten werden nur Zauber, die der Nutzer auch WIRKLICH
//    wirken kann (`heroMeetsLevelReq`) — der Text sagt „perform … with
//    the user", nicht „regardless of its level". Der dritte laeuft ueber
//    `_castSpellImmediately` — die Bruecke wirkt ihn OHNE Aktionskosten,
//    genau das meint „as an additional Action". ★ W14b (Q159): die
//    anderen zwei werden erst am Zusagepunkt des gewirkten Zaubers
//    geloescht (Hand → Geloescht, mit Flug); bricht der Spieler dessen
//    Zielwahl ab, bleiben alle drei Karten auf der Hand.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Aurora Borealis';
const SCHULE = 'Magic Arts';

/** Wie viele Zauber darf der Nutzer holen? */
function anzahlFuer(engine, pi, heroIdx) {
  let lvl = 0;
  try { lvl = engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { lvl = 0; }
  return Math.max(1, Math.min(3, lvl));
}

/** Zauber im eigenen Deck, je Name einmal. */
function zauberImDeck(engine, pi) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps?.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Spell') continue;
    gesehen.add(name);
    out.push({ name, source: 'deck', level: cd.level || 0 });
  }
  return out;
}

/** Eine Handkarte loeschen — Flug, dann Ankunft (Muster v1010). */
async function loescheAusHand(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const idx = (ps.hand || []).indexOf(name);
  if (idx < 0) return false;
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: name, from: 'hand', to: 'deleted', fromHandIdx: idx,
  });
  engine.takeFromPileSync(ps, 'hand', idx);
  const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'hand' && c.name === name);
  if (inst) engine._untrackCard(inst.id);
  await engine._delay(650);
  if (!ps.deletedPile) ps.deletedPile = [];
  engine.handKartenBesitzerPs(ps, name).deletedPile.push(name);   // W3/W5a: Stapel des permanenten Besitzers
  engine.sync();
  return true;
}

/** Wie `loescheAusHand`, aber synchron (feuert am Zusagepunkt mitten in der Aufloesung des gewirkten Zaubers). */
function loescheAusHandSync(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const idx = (ps.hand || []).indexOf(name);
  if (idx < 0) return false;
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: name, from: 'hand', to: 'deleted', fromHandIdx: idx,
  });
  engine.takeFromPileSync(ps, 'hand', idx);
  const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'hand' && c.name === name);
  if (inst) engine._untrackCard(inst.id);
  if (!ps.deletedPile) ps.deletedPile = [];
  engine.handKartenBesitzerPs(ps, name).deletedPile.push(name);   // W3/W5a: Stapel des permanenten Besitzers
  engine.sync();
  return true;
}

module.exports = {
  requiresTarget: false,

  // Ohne Zauber im Deck gibt es nichts zu holen.
  spellPlayCondition: (gs, pi, engine) => (engine ? zauberImDeck(engine, pi).length > 0 : true),

  // Abbrechbare Prompts bricht die Engine fuer die CPU pauschal ab
  // (Befund v828). Sie nimmt die teuersten/hoechsten Zauber und laesst
  // den Dreier-Tausch aus — zwei Karten loeschen, um eine sofort zu
  // wirken, ist eine Bewertung, die sie (noch) nicht treffen kann.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'cardGalleryMulti') {
      const karten = (promptData.cards || []).slice()
        .sort((a, b) => (b.level || 0) - (a.level || 0));
      const n = promptData.selectCount || 1;
      const wahl = karten.slice(0, n).map(c => c.name);
      return wahl.length > 0 ? { selectedCards: wahl } : undefined;
    }
    if (promptData.type === 'confirm') return { cancelled: true };   // kein Tausch
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const kandidaten = zauberImDeck(engine, pi);
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }

      const lvl = (() => {
        try { return engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx) || 0; } catch { return 0; }
      })();
      const anzahl = Math.min(anzahlFuer(engine, pi, heroIdx), kandidaten.length);

      // ── Auswahl ─────────────────────────────────────────────────
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        searchToHand: true, searchPile: 'deck',   // v1121
        cards: kandidaten,
        title: CARD_NAME,
        description: `Choose up to ${anzahl} Spell${anzahl > 1 ? 's' : ''} with different names from your deck `
          + `(${SCHULE} ${lvl}). They are revealed and added to your hand.`,
        selectCount: anzahl,
        minSelect: 1,
        confirmLabel: '🌌 Take',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      const namen = (wahl?.selectedCards || []).slice(0, anzahl)
        .filter(n => kandidaten.some(k => k.name === n));
      if (namen.length === 0) { gs._spellCancelled = true; return; }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── Aus dem Deck auf die Hand ───────────────────────────────
      const geholt = [];
      for (const name of namen) {
        const idx = (ps.mainDeck || []).indexOf(name);
        if (idx < 0) continue;
        if (!(await engine.takeFromPile(ps, 'deck', idx, { source: CARD_NAME, shuffle: true, toHand: true }))) continue;
        engine._broadcastEvent('card_reveal', { cardName: name });
        engine._broadcastEvent('deck_search_add', { cardName: name, playerIdx: pi });
        await engine.handZugang(ps, name, { von: 'deck', source: CARD_NAME, reveal: true });   // W85b: „reveal them“ → Atta (onCardsRevealed)
        geholt.push(name);
        engine.sync();
        await engine._delay(320);
      }
      engine.log('aurora_borealis', {
        player: ps.username, level: lvl, cards: geholt,
      });
      engine.sync();

      // ── ★ Der dritte Zauber (nur Magic Arts 3 mit drei Karten) ──
      if (lvl < 3 || geholt.length < 3) return;

      const wirkbar = geholt.filter(n => {
        const cd = engine._getCardDB()[n];
        if (!cd) return false;
        if (engine.areaKarteGesperrt(cd, pi, { kapazitaet: true })) return false;   // Als Ruling (Al 27.10.): Reality Crack („cannot play another Area") / Shipwrecked — eine Area ist nicht wirkbar; Als Fix (Al 27.10.): auch ohne Platz in der Area Zone (Limit 1, Spatial Crevice 3 VERSCHIEDENE) bzw. als Dublette nicht
        // „Only 1 per game" (Divine Gift …): der Sofort-Guss prueft das nicht selbst (S01-11)
        const sc = loadCardEffect(n);
        if ((sc?.oncePerGame || sc?.oncePerGameKey) && ps._oncePerGameUsed?.has(sc.oncePerGameKey || n)) return false;
        try { return engine.heroMeetsLevelReq(pi, heroIdx, cd); } catch { return false; }
      });
      if (wirkbar.length === 0) return;

      const ja = await engine.promptSpellAuswahl(pi, {   // W48a: Zeitfenster der Spell-Auswahl (keine Surprise aktivierbar)
        type: 'confirm',
        title: CARD_NAME,
        message: 'Delete 2 of the chosen Spells to perform the third one immediately?',
        showCard: CARD_NAME,
        confirmLabel: '🌠 Perform one',
        cancelLabel: 'Keep all three',
        cancellable: true,
      });
      const bestaetigt = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(ja) : !!(ja && !ja.cancelled);
      if (!bestaetigt) return;

      const pick = await engine.promptSpellAuswahl(pi, {   // W48a: Zeitfenster der Spell-Auswahl
        type: 'cardGallery',
        cards: wirkbar.map(n => ({ name: n, source: 'hand' })),
        title: CARD_NAME,
        description: 'Choose the Spell to perform. The other two are deleted.',
        confirmLabel: '🌠 Perform',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;   // „you may" — nichts passiert
      const gewirkt = pick.cardName;
      if (!wirkbar.includes(gewirkt)) return;   // nur ein angebotener (wirkbarer) Zauber

      // ★ W14b (Q159, Al: „Das Deleten soll erst passieren, nachdem der gewählte Spell komplett committed wurde; wird er abgebrochen,
      // verbleiben die Karten auf der Hand."): die anderen zwei werden erst am ZUSAGEPUNKT des gewählten Zaubers gelöscht (erste bestätigte
      // Antwort seiner Aufloesung, spätestens sein Ende — dieselbe Allgemeinregel wie Taio, Welle 13); Abbruch lässt alle drei Karten
      // unberührt auf der Hand. Das Löschen ist dabei synchron (Flug-Ereignis, kein Warten), weil es mitten in einer Abfrage feuert.
      const andere = geholt.filter(n => n !== gewirkt);
      let committed = false;
      const geloescht = [];   // [{ name, idx }] — fuer die Rueckgabe, falls der Guss NACH dem Zusagepunkt doch abbricht (CPU: Zusage sofort)
      const commit = () => {
        if (committed) return;
        committed = true;
        for (const name of andere) {
          const idx = ps.hand.indexOf(name);
          if (loescheAusHandSync(engine, pi, name)) geloescht.push({ name, idx });
        }
      };
      const zusage = engine._zusageAuftrittVormerken(commit, pi);
      // … dann den dritten sofort wirken (ohne Aktionskosten).
      const handIdx = ps.hand.indexOf(gewirkt);
      if (handIdx < 0) { engine._zusageAuftrittVerwerfen(zusage); return; }
      engine.log('aurora_perform', { player: ps.username, card: gewirkt });
      let res = null;
      try {
        res = await engine._castSpellImmediately(pi, heroIdx, gewirkt, {
          fromZone: 'hand', pool: ps.hand, poolIndex: handIdx, by: CARD_NAME,
          alsZusatzaktion: true,   // v1352
        });
      } finally {
        if (!res || res.cancelled) engine._zusageAuftrittVerwerfen(zusage); else engine._feuereZusageAuftritte(zusage);
      }
      // Abbruch NACH dem Zusagepunkt (CPU: sofort; Mensch: spaetere Stufe einer mehrstufigen Wahl): die zwei Zauber kommen zurueck auf die Hand.
      if ((!res || res.cancelled) && committed) {
        for (const g of geloescht.slice().reverse()) {
          const dIdx = (ps.deletedPile || []).lastIndexOf(g.name);
          if (dIdx < 0) continue;
          engine.takeFromPileSync(ps, 'deleted', dIdx, { source: CARD_NAME });
          engine.returnToPile(pi, 'hand', g.name, Math.min(g.idx, ps.hand.length));
          engine._trackCard(g.name, pi, 'hand');
        }
        engine.sync();
      }
      engine.sync();
    },
  },
};

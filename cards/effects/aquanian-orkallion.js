// ═══════════════════════════════════════════
//  CARD EFFECT: „Aquanian Orkallion"
//  Creature (Summoning Magic Lv 1, 100 HP, PP CROSS)
//
//  „When you summon this Creature, you may search your deck for an Area
//   and bring it into play, regardless of its level.
//   When this Creature leaves the board, destroy all Areas on the
//   board."
//
//  BAUART
//  ──────
//  • BESCHWOERUNG: `onPlay` mit `playedCard === self` in einer Support
//    Zone. BEWUSST OHNE `_isNormalSummon`-Tor (anders als die
//    Tamed-Karten): der Text sagt schlicht „when you summon", also
//    zaehlen Handbeschwoerung, Effektbeschwoerung und Platzieren
//    gleichermaassen (Als Ruling 8.9.: Platzieren ist eine
//    Effekt-Beschwoerung).
//
//  • „regardless of its level" — die Eignungsregel ist die GEMEINSAME
//    aus `_area-shared.js` (Typ Spell/Attack/Creature, Subtyp Area, und
//    die Karte MUSS ein Level haben, sonst zoege man Smuggler's Pier),
//    nur ohne die Schwelle 3: `{ maxLevel: Infinity }`. Vorher hatte
//    das Modul die Schwelle fest eingebaut — sie ist jetzt beweglich,
//    die drei Altnutzer (Planet in a Bottle, Reality Crack, Cooldin)
//    bleiben unveraendert bei 3.
//
//  • „bring it into play" laeuft exakt wie bei Reality Crack: Instanz
//    anlegen, den EIGENEN `onPlay` der Area feuern (jede Area legt sich
//    selbst in die Zone, v903), und nur falls das ausbleibt, per
//    `placeArea` nachhelfen. So laufen Selbstlege-Vertrag,
//    Hintergrund-Schicht und Platzierungs-Surprises normal.
//
//  • EINE AREA JE SPIELER (Regelwerk): kontrolliert der Beschwoerer
//    schon eine, wird gar nicht erst gesucht — dasselbe Tor, das die
//    Engine beim Ausspielen einer Area aus der Hand zieht
//    (`areaZones[pi].length > 0`). Der Effekt ist ein „you may", er
//    darf also folgenlos verpuffen.
//
//  • ABGANG: `onCardLeaveZone` meldet „HIER geht jemand", nicht „DU
//    gehst" (v925) — deshalb der Vergleich auf `leavingCard.id`. Der
//    Hook deckt beide Wege ab, ueber die eine Kreatur das Brett
//    verlaesst: den Schadens-Batch (`_onlyCard` vor `onCreatureDeath`)
//    und `actionMoveCard` (Opferung, Rueckgabe auf die Hand, Loeschen).
//    Zerstoert werden ALLE Areas, auch die eigene und die, die er
//    gerade selbst geholt hat.
//
//  • ANIMATION `maelstrom` (v944, Als Vorgabe): ein riesiger Strudel
//    ueber dem GANZEN Spielfeld — `zoneType: 'board'`, der Kanal fuer
//    Effekte, die an keiner Zone haengen. Er laeuft bei BEIDEN
//    Ereignissen: wenn die Area hochkommt und wenn sie weggerissen wird.
// ═══════════════════════════════════════════

const { isTutorableArea } = require('./_area-shared');

const CARD_NAME = 'Aquanian Orkallion';
const STRUDEL_MS = 2000;   // Laufzeit der Animation
const STRUDEL_VORLAUF = 700;   // bis der Trichter steht

/** Der Strudel ueber dem ganzen Brett. */
async function strudel(engine, pi) {
  engine._broadcastEvent('play_zone_animation', {
    type: 'maelstrom', zoneType: 'board',
    owner: pi, heroIdx: -1, zoneSlot: -1,
    duration: STRUDEL_MS,
  });
  await engine._delay(STRUDEL_VORLAUF);
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'maelstrom' }, impactMs: 260,
  },

  activeIn: ['support'],

  cpuMeta: {
    // Der Wert der Karte liegt im Suchen einer Area und im Abraeumen
    // beim Abgang — beides sieht die Standardbewertung einer 100-HP-
    // Kreatur ohne Angriffswert nicht.
    cardValueFloor: 55,
  },

  // ── CPU-Antwort auf die Galerie ──────────────────────────────────
  // Abbrechbare Prompts bricht die Engine fuer die CPU grundsaetzlich
  // ab, wenn das Skript keine `cpuResponse` liefert (Befund v828) —
  // ohne das hier waere der Sucheffekt fuer jeden CPU-Gegner tot.
  // Gewaehlt wird die Area mit dem HOECHSTEN Level: „regardless of its
  // level" ist der ganze Witz der Karte, und teure Areas sind die, die
  // sonst nicht ins Spiel kaemen.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const karten = promptData.cards || [];
    if (karten.length === 0) return undefined;
    let beste = karten[0];
    for (const k of karten) if ((k.level || 0) > (beste.level || 0)) beste = k;
    return { cardName: beste.name, source: beste.source || 'deck' };
  },

  hooks: {
    // ── „When you summon this Creature" ─────────────────────────────
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const ich = ctx.card;
      if (!ich) return;
      if (ctx.playedCard?.id !== ich.id) return;     // nur die eigene Beschwoerung
      if (ich.zone !== 'support') return;

      const pi = ich.controller ?? ich.owner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Eine Area je Spieler — dasselbe Tor wie beim Ausspielen aus der
      // Hand. Wer schon eine kontrolliert, bekommt keine Suche.
      if ((gs.areaZones?.[pi] || []).length > 0) return;

      const cardDB = engine._getCardDB();
      const gezaehlt = {};
      for (const n of (ps.mainDeck || [])) {
        if (!isTutorableArea(cardDB[n], engine, pi, { maxLevel: Infinity })) continue;
        gezaehlt[n] = (gezaehlt[n] || 0) + 1;
      }
      const galerie = Object.entries(gezaehlt)
        .map(([name, count]) => ({ name, source: 'deck', count, level: cardDB[name]?.level || 0 }))
        .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
      if (galerie.length === 0) return;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galerie,
        title: CARD_NAME,
        description: 'You may bring an Area from your deck into play, regardless of its level.',
        cancellable: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName) return;   // „you may" — abgelehnt

      const name = wahl.cardName;
      if (!(await engine.takeFromPile(ps, 'deck', name, { source: CARD_NAME }))) return;
      engine.shuffleDeck?.(pi, 'main');

      // ★ Auftritt erst NACH der bindenden Wahl (CARD_API): die Galerie
      // ist der Commit, ein Abbruch zeigt nichts.
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine._broadcastEvent('deck_search_add', { cardName: name, playerIdx: pi });

      await strudel(engine, pi);

      // Reality-Crack-Weg: die Area legt sich per eigenem `onPlay`
      // selbst in die Zone; nur wenn sie das nicht tut, wird nachgeholfen.
      const neu = engine._trackCard(name, pi, 'hand', ich.heroIdx, -1);
      await engine.runHooks('onPlay', {
        _onlyCard: neu, playedCard: neu,
        cardName: name, zone: 'hand',
        heroIdx: ich.heroIdx,
        _skipReactionCheck: true,
      });
      if (neu.zone !== 'area') await engine.placeArea(pi, neu);

      engine.log('orkallion_area_search', { player: ps.username, area: name });
      engine.sync();
    },

    // ── „When this Creature leaves the board" ───────────────────────
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      const geht = ctx.leavingCard || ich;
      // ★ Der Hook meldet JEDEN Abgang (v925) — nur der eigene zaehlt.
      if (!ich || geht?.id !== ich.id) return;
      if (ctx.fromZone !== 'support') return;

      const pi = ich.controller ?? ich.owner;
      if ((engine.cardInstances || []).every(c => c.zone !== 'area')) return;   // nichts abzureissen

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      await strudel(engine, pi);

      const weg = await engine.removeAllAreas(-2, CARD_NAME);
      engine.log('orkallion_area_wipe', {
        player: engine.gs.players[pi]?.username, wiped: weg,
      });
      engine.sync();
    },
  },
};

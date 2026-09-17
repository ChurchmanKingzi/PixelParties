// ═══════════════════════════════════════════
//  CARD EFFECT: "Enhanced Guard Dog"
//  Creature (Summoning Magic Lv1, 50 HP, Subtyp Reaction)
//
//  "Immediately summon this Creature as an additional Action when
//   exactly 1 card from your side of the board would be sent to the
//   discard pile by an opponent's card or effect. Negate that card or
//   effect."
//
//  ── DIE GANZE ABGRENZUNG STECKT IN DER STELLE ─────────────────────
//  ★ Als wichtigstes Ruling (14.9.): der Dog blockt NUR direkte
//  Zerstoerung, NICHT den Tod durch Schaden. Dafuer braucht es keine
//  einzige Sonderregel — das Fenster haengt an `actionDestroyCard`,
//  und der Schadenstod routet seinen Tod im Schadens-Batch, kommt dort
//  also nie vorbei. Im Code ist das seit dem Cosmic-Depths-Fenster
//  sogar schon so dokumentiert.
//
//  ★ „sent to the DISCARD PILE" faellt aus derselben Wahl heraus:
//  `actionDestroyCard` routet IMMER in die Ablage. „Tengu Windstorm"
//  schickt ins DECK und loest deshalb korrekt nicht aus (Als Befund
//  14.9.). Umgekehrt haengt das Fenster BEWUSST nicht an
//  `actionMoveCard`, obwohl auch dort Karten in die Ablage wandern:
//  genau dort laeuft der Schadenstod durch.
//
//  ★ „exactly 1 card" kommt aus der Zerstoerungs-Klammer
//  (`beginDestroyScope`, v1057). Ein Effekt, der mehrere Karten auf
//  einmal abraeumt, klammert seine Schleife; `actionDestroyCard` laeuft
//  je Karte einzeln und wuesste sonst beim ersten Opfer nichts vom
//  zweiten.
//
//  ── NEGATION: „die ganze Karte, ausser was schon resolved ist" ─────
//  Als Regel 14.9., und sie meint LOGISCHE Abhaengigkeit, nicht
//  Code-Reihenfolge: bei „Deal 150 damage. If this kills, remove 1
//  card" MUSS der Schaden vorher gefallen sein, damit das Removal
//  ueberhaupt ausloest — der bleibt also stehen. Bei „The Yeeting"
//  muss der Recoil NICHT vorher fallen, er stand nur zufaellig zuerst
//  im Code; dort ist das Fenster deshalb vor den Recoil gezogen
//  worden, damit Code- und Wirkungsreihenfolge uebereinstimmen.
//
//  Der Dog setzt `gs._spellNegatedByEffect` — die vorhandene,
//  kanonische Marke fuer „dieser Guss ist negiert". Karten, die sie
//  lesen, brechen ihren Rest von selbst ab; `actionDestroyCard` kehrt
//  ohnehin sofort zurueck.
//
//  ── KEIN `isReaction: true` ───────────────────────────────────────
//  Lehre aus Pawn Chain (v830) und Doomed Town Guard: das Flag meldet
//  eine Karte im generischen Kettenfenster bei JEDEM Kartenspiel als
//  spielbar. Der Ausloeser hier ist das eigene Fenster.
// ═══════════════════════════════════════════

const CARD_NAME = 'Enhanced Guard Dog';

/**
 * Support-Zonen, in die der Dog JETZT beschworen werden duerfte.
 * Echte Beschwoerung aus der Hand, also das volle Gatter aus
 * `_canHeroActivateSurprise`: lebender, nicht eingefrorener /
 * betaeubter / negierter Held, der die Karte einsetzen darf, plus
 * freie Zone. Bauform von Doomed Town Guard.
 */
function summonableZones(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hand', 'support'],

  // ★ Der Engine-Vertrag fuer das Zerstoerungs-Fenster (v1057).
  isDestroyReaction: true,

  /**
   * Darf der Dog auf DIESE Zerstoerung ueberhaupt antworten?
   *
   * Die Seiten- und Einzelzerstoerungs-Pruefung erledigt das Fenster
   * selbst. Hier bleibt nur, was der Karte gehoert: sie muss auf der
   * Hand liegen und es muss ein Platz frei sein — ohne Beschwoerung
   * keine Negation (Als Bestaetigung 14.9.).
   */
  destroyReactionCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps || !(ps.hand || []).includes(CARD_NAME)) return false;
    return summonableZones(engine, pi).length > 0;
  },

  /**
   * Fragen, Zone waehlen, beschwoeren, negieren.
   * @returns {boolean} true = die Zerstoerung ist negiert.
   */
  async onDestroyReaction(engine, pi, lage) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return false;

    let zones = summonableZones(engine, pi);
    if (zones.length === 0) return false;

    const quelle = lage?.sourceName || "An opponent's effect";
    const opfer = lage?.victimName || 'a card';
    const confirmed = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${quelle} would send ${opfer} to your discard pile! Summon ${CARD_NAME} and negate it?`,
      showCard: CARD_NAME,
      confirmLabel: '🐕 Summon & Negate!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!confirmed) return false;

    // Nach dem Prompt neu pruefen — waehrend der Spieler ueberlegt, kann
    // sich das Brett geaendert haben (Kettenreaktionen). Gleiche
    // Vorsicht wie bei Doomed Town Guard.
    if (!(ps.hand || []).includes(CARD_NAME)) return false;
    zones = summonableZones(engine, pi);
    if (zones.length === 0) return false;

    let dest = zones[0];
    if (zones.length > 1) {
      const pick = await engine.promptGeneric(pi, {
        type: 'zonePick',
        title: CARD_NAME,
        description: `Summon ${CARD_NAME} into which Support Zone?`,
        zones,
        cancellable: true,
      });
      if (!pick || pick.cancelled) return false;
      dest = { heroIdx: pick.heroIdx, slotIdx: pick.slotIdx };
    }

    // Grundregel (CARD_API): ein Effekt, der sich aus einem Hook heraus
    // aktiviert, streamt seine Karte an BEIDE Spieler — erst NACH dem
    // Ja, damit ein abgelehnter Trigger nichts zeigt.
    await engine.showTriggeredEffect(CARD_NAME, {
      playerIdx: pi,
      source: `egd:${gs.turn}:${opfer}`,
    });

    const handIdx = ps.hand.indexOf(CARD_NAME);
    ps.hand.splice(handIdx, 1);
    const res = await engine.summonCreatureWithHooks(
      CARD_NAME, pi, dest.heroIdx, dest.slotIdx,
      { source: CARD_NAME, fromHandIdx: handIdx },
    );
    if (!res?.inst) { ps.hand.push(CARD_NAME); return false; }

    // „Negate that card or effect." Die kanonische Marke; der
    // Zerstoerungs-Trichter kehrt ohnehin sofort zurueck.
    gs._spellNegatedByEffect = true;
    engine.log('enhanced_guard_dog_negate', {
      player: ps.username, saved: opfer, negated: lage?.sourceName || null,
    });
    engine.sync();
    return true;
  },

  // CPU: der Dog kostet keine Aktion, rettet eine Brettkarte und
  // negiert obendrein — beide Prompts sind fuer sie immer gut. Ohne
  // diesen Eintrag lehnt der generische Responder abbrechbare Prompts
  // pauschal ab (Barker-Bugklasse).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'confirm') return { confirmed: true };
    if (promptData.type === 'zonePick') {
      const z = (promptData.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },
};

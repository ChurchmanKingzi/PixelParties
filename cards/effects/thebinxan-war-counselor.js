// ═══════════════════════════════════════════
//  CARD EFFECT: "Thebinxan War Counselor"
//  Creature (Summoning Magic Lv2, Normal) — 110 HP
//
//  EFFECT:
//   "You can only control 1 \"Thebinxan War
//    Counselor\".
//    You may once per turn make your opponent declare
//    a card type (Attack/Spell/Creature, Artifact,
//    Ability, Potion, Hero/Ascended Hero). Reveal the
//    top card of
//    your deck and add it to your hand. If it is not
//    a card of the declared type, deal 50 damage to
//    all targets your opponent controls."
//
//  ── Das Ratespiel ──
//  Der GEGNER waehlt, nicht ich — deshalb geht die
//  Abfrage an `oppIdx` und ist NICHT abbrechbar: er
//  muss sich festlegen. Danach kommt die oberste
//  Deckkarte offen auf meine Hand; passt sie nicht zur
//  Ansage, nehmen ALLE Ziele des Gegners 50 Schaden.
//
//  ── Die fuenf Ansagen sind genau die des Textes ──
//  Drei davon buendeln mehrere Typen unter EINER
//  Ansage: "Attack/Spell/Creature" und "Hero/Ascended
//  Hero". Damit ist jeder Kartentyp des Spiels
//  abgedeckt — der Gegner hat immer eine ehrliche
//  Chance zu raten.
//
//  (Aeltere Fassung des Textes listete nur
//  "Attack/Spell" und "Ascended Hero"; damit waren
//  Kreaturen und normale Heroes ueberhaupt nicht
//  ansagbar und der Schaden bei einer enthuellten
//  Kreatur unausweichlich. Al hat den Text am 8.8.
//  entsprechend nachgezogen.)
//
//  ── Leeres Deck ──
//  Ohne Karte zum Enthuellen gibt es nichts zu
//  vergleichen, also wird der Effekt gar nicht
//  angeboten (`canActivateCreatureEffect`) — sonst
//  haette der Gegner umsonst angesagt und die
//  Rundennutzung waere verbrannt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { makeSingletonCanSummon } = require('./_war-counselor-shared');

const CARD_NAME = 'Thebinxan War Counselor';
const DAMAGE = 50;

/** Die fuenf ansagbaren Typen, genau wie auf der Karte. */
const DECLARATIONS = [
  { id: 'attackspellcreature', label: '⚔️ Attack / Spell / Creature',
    types: ['Attack', 'Spell', 'Creature'], color: '#ff4444' },
  { id: 'artifact', label: '🏺 Artifact', types: ['Artifact'], color: '#ffd700' },
  { id: 'ability', label: '📘 Ability', types: ['Ability'], color: '#44aaff' },
  { id: 'potion', label: '🧪 Potion', types: ['Potion'], color: '#a0703c' },
  { id: 'heroascended', label: '👑 Hero / Ascended Hero',
    types: ['Hero', 'Ascended Hero'], color: '#aa44ff' },
];

/** Passt die enthuellte Karte zur Ansage? */
function matchesDeclaration(engine, cardName, declId) {
  const decl = DECLARATIONS.find((d) => d.id === declId);
  if (!decl) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  return decl.types.some((t) => hasCardType(cd, t));
}

/** Wo steht Thebinxan? Braucht die CPU-Antwort, um den Ansager zu finden. */
function findThebinxan(engine) {
  return (engine.cardInstances || []).find(
    (i) => i && i.zone === 'support' && !i.faceDown && i.name === CARD_NAME,
  ) || null;
}

module.exports = {
  /**
   * ── CPU-Ansage ──
   * Gefragt wird der GEGNER des Thebinxan-Spielers; `cpuResponse` bekommt
   * aber keinen Spielerindex mit, also leite ich ihn ueber die Karte auf
   * dem Feld ab.
   *
   * Geraten wird aus dem Kartengedaechtnis der Engine (`knownOpponentCards`)
   * — also NUR aus dem, was die CPU oeffentlich gesehen hat, nie aus dem
   * Serverwissen. Gewaehlt wird die Ansage, unter der die meisten bekannten
   * Karten fallen; bei Gleichstand eine davon.
   *
   * Weiss sie nichts, raet sie zufaellig — aber NIE "Hero/Ascended Hero",
   * solange sie nicht gesehen hat, dass so etwas ueberhaupt im Deck des
   * Gegners steckt (Als Vorgabe). Enthuellte Deckkarten landen genau dafuer
   * im `deck`-Fach des Gedaechtnisses; Thebinxans eigener Effekt fuettert
   * es also mit jeder Aktivierung.
   *
   * ANMERKUNG: Enthuellt wird die oberste Karte des DECKS, das Gedaechtnis
   * zaehlt aber vor allem bekannte HANDkarten. Das ist ein indirektes
   * Signal (beides stammt aus demselben Deck) — so von Al vorgegeben.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'optionPicker') return undefined;
    const ids = new Set((promptData.options || []).map((o) => o.id));
    if (!ids.has('artifact')) return undefined;          // nicht unsere Abfrage

    const card = findThebinxan(engine);
    if (!card) return undefined;
    const owner = card.controller ?? card.owner;
    const declarer = owner === 0 ? 1 : 0;                // die CPU wird gefragt

    let known = { hand: {}, deck: {} };
    try { known = engine.knownOpponentCards(declarer) || known; } catch { /* Beiwerk */ }

    // Beste Ansage nach bekannten Handkarten.
    let best = null;
    let bestScore = 0;
    for (const decl of DECLARATIONS) {
      if (!ids.has(decl.id)) continue;
      let score = 0;
      for (const [name, count] of Object.entries(known.hand || {})) {
        if (matchesDeclaration(engine, name, decl.id)) score += count;
      }
      if (score > bestScore) { bestScore = score; best = decl.id; }
    }
    if (best) return { optionId: best };

    // Nichts bekannt -> zufaellig, Helden nur bei belegtem Deckwissen.
    const heroSeenInDeck = Object.keys(known.deck || {}).some((name) => {
      const cd = engine._getCardDB()[name];
      return !!cd && (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero'));
    });
    const pool = DECLARATIONS
      .filter((d) => ids.has(d.id))
      .filter((d) => d.id !== 'heroascended' || heroSeenInDeck);
    const choices = pool.length > 0 ? pool : DECLARATIONS.filter((d) => ids.has(d.id));
    const pick = choices[Math.floor(Math.random() * choices.length)];
    return { optionId: pick.id };
  },

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: makeSingletonCanSummon(CARD_NAME),

  canActivateCreatureEffect(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    return (ps?.mainDeck || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const inst = ctx.card;
    const ps = gs.players[pi];
    const opp = gs.players[oppIdx];
    if (!ps || !opp) return false;

    const topCard = (ps.mainDeck || [])[0];
    if (!topCard) return false;

    // ── Der Gegner sagt an (keine Abbruchmoeglichkeit) ──
    const declared = await engine.promptGeneric(oppIdx, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: `${ps.username} reveals the top card of their deck. Declare a card type — if you are wrong, all your targets take ${DAMAGE} damage.`,
      showCard: CARD_NAME,
      options: DECLARATIONS.map((d) => ({ id: d.id, label: d.label, color: d.color })),
      cancellable: false,
    });
    const declId = declared?.optionId || DECLARATIONS[0].id;   // Ausweichwert
    const decl = DECLARATIONS.find((d) => d.id === declId) || DECLARATIONS[0];

    // Die Ansage MUSS beim Spieler ankommen — er sieht die Abfrage des
    // Gegners ja nicht. Grosses Schild in der Bildmitte, in der Farbe des
    // angesagten Kartentyps, plus ein Eintrag im Ereignisprotokoll.
    engine._broadcastEvent('play_type_declaration', {
      label: decl.label.replace(/^\S+\s/, ''),   // Emoji weg, nur der Text
      color: decl.color,
      declaredBy: opp.username,
    });
    engine.log('thebinxan_declared', {
      player: opp.username, declaration: decl.label.replace(/^\S+\s/, ''),
    });
    await engine._delay(900);                     // Schild lesen lassen

    // ── Enthuellen und auf die Hand ──
    const added = await engine.actionAddCardFromDeckToHand(pi, topCard, {
      source: CARD_NAME, reveal: true,
    });
    if (!added) {
      // Handsperre o.ae. — die Ansage ist gefallen, es gibt aber keine
      // enthuellte Karte, also auch keinen Vergleich.
      engine.log('thebinxan_fizzle', { player: ps.username, reason: 'reveal_failed' });
      return true;
    }

    const hit = matchesDeclaration(engine, topCard, declId);
    engine.log('thebinxan_reveal', {
      player: ps.username, card: topCard, correct: hit,
    });

    if (hit) {
      engine.sync();
      return true;                                   // richtig geraten, kein Schaden
    }

    // ── Falsch geraten: 50 Schaden auf ALLE Ziele des Gegners ──
    for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
      const hero = opp.heroes[hi];
      if (!hero?.name || !(hero.hp > 0)) continue;
      engine._broadcastEvent('play_zone_animation', {
        type: 'electric_strike', owner: oppIdx, heroIdx: hi, zoneSlot: -1,
      });
    }
    await engine._delay(420);

    for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
      const hero = opp.heroes[hi];
      if (!hero?.name || !(hero.hp > 0)) continue;
      await ctx.dealDamage(hero, DAMAGE, 'creature');
    }
    const oppCreatures = (engine.cardInstances || []).filter(
      (i) => i && i.zone === 'support' && (i.controller ?? i.owner) === oppIdx,
    );
    for (const victim of oppCreatures) {
      if (victim.zone !== 'support') continue;        // zwischenzeitlich weg
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        victim, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('thebinxan_punish', {
      player: ps.username, damage: DAMAGE,
      heroes: (opp.heroes || []).filter((h) => h?.name && h.hp > 0).length,
      creatures: oppCreatures.length,
    });
    engine.sync();
    return true;
  },
};

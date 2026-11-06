// ═══════════════════════════════════════════
//  CARD EFFECT: "You are the Chosen One!!!"
//  Spell (Normal, Magic Arts, Lv9)
//
//  „This Spell's level is reduced by 1 for every Ability attached to the user. Immediately perform an Attack or Spell from your hand with the user as an additional Action. You cannot
//   play other cards for the rest of the turn afterwards. This counts as an additional Action."
//
//  ── STUFE JE NUTZER ────────────────────────────────────────────────────
//  Karten-Vertrag `levelOffsetForHero` (neu, Engine: `_heldStufenOffset`): die Stufe der Karte für einen Helden = 9 − (Zahl seiner Ability-KARTEN, Stapelhöhen zählen, Abilities in Support
//  Zonen [Xal, Xalibur] mit), nie unter 0. `heroMeetsLevelReq` (Spielbarkeit) und `effectiveCardLevel` lesen ihn; die Hand zeigt die gedruckte Stufe 9. Zieht der Spieler die Karte über einen
//  Helden, zeigt der Client dessen Stufe als Abzeichen (`heroPlayableCards.stufen`, `engine.stufenHinweise`).
//
//  ── NUR MIT PASSENDER HANDKARTE ───────────────────────────────────────
//  Die sofortige Zusatzaktion ist nicht optional. Deshalb darf nur ein Held die Karte wirken, der sie stufenmäßig kann UND mindestens eine Attack oder einen ANDEREN Spell aus der Hand
//  ausführen kann (`getHeroEligibleActionCards`: Stufe, Schulen, Sperren, Ziele; ohne Aktionsökonomie — die Aktion ist geschenkt). Eine weitere Kopie dieser Karte zählt nicht (keine Ketten).
//  Reactions, Surprises und Kreaturen/Abilities/Heldeneffekte stehen nicht zur Wahl.
//
//  ── ABLAUF ───────────────────────────────────────────────────────────
//  1. Die goldene Aura (`chosen_one_aura`, Pixelart) hüllt den Nutzer ein.
//  2. `performImmediateAction` (Attack/Spell, nicht abbrechbar — bricht ein Antwortweg trotzdem ab, wird neu gefragt): die gewählte Karte läuft als Zusatzaktion des Nutzers.
//  3. Danach gilt die Handspielsperre (`ps._handPlayLock`, „You cannot play any more cards from your hand this turn!") bis zum Zugende. Auch wenn KEINE passende Karte mehr da ist (der
//     Gegner hat sie zwischen Aktivierung und Auslösung abgeworfen), verpufft der Zauber, die Sperre bleibt.
//
//  ── ZUSATZAKTION ─────────────────────────────────────────────────────
//  `inherentAction: true` — der Zauber kostet nie eine Aktion (Main Phase und Action Phase).
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Die CPU spielt die Karte über die inhärente Schiene (Main Phase); die geschenkte Aktion beantwortet ihre Sofortaktions-Wahl. `cpuDeferUntilLast`: die Sperre beendet ihre übrigen Kartenzüge.
// ═══════════════════════════════════════════

const { abilityCardCount } = require('./_ability-cost-shared');

const CARD_NAME = 'You are the Chosen One!!!';
const AURA_MS = 1900;           // Länge von `chosen_one_aura` im Client
const AURA_VOR_MS = 900;        // so lange läuft die Aura, bevor die Zusatzaktion gefragt wird
const MAX_VERSUCHE = 6;         // Obergrenze für das Neufragen, falls ein Antwortweg die Pflichtaktion abbricht

/** Zahl der Ability-Karten am Helden (Brettseite `seite`). */
function abilitiesAmHelden(engine, seite, heroIdx) {
  return abilityCardCount(engine.getAbilityTargets(seite, { heroIdx }));
}

let pruefTiefe = 0;
/**
 * Attacks und andere Spells aus der Hand, die dieser Held jetzt ausführen darf. Weitere Kopien dieser Karte zählen NICHT (keine Ketten aus mehreren Kopien); die Liste der Engine prüft jede
 * Handkarte über deren `canPlayWithHero` — also auch diese Karte selbst, daher der Riegel gegen die Rekursion.
 */
function andereKarten(engine, pi, heroIdx, hs) {
  if (pruefTiefe > 0) return [];
  pruefTiefe++;
  try {
    const db = engine._getCardDB();
    // Wisdom: die Kosten dieser Karte werden VOR der Zusatzaktion gezahlt (`engine.zahleOffeneWisdom`), die des gespielten Zaubers danach — beide müssen aus der Hand bezahlbar sein, sonst
    // endet die Pflichtaktion in einer Sackgasse (Karte und Abwürfe weg, nichts gespielt). Beim Auflösen (`_wisdomOffen` gesetzt) ist die eigene Zahlung schon erfolgt: nichts mehr zu reservieren.
    const eigen = engine._wisdomOffen ? 0 : engine.getWisdomDiscardCost(hs, heroIdx, db[CARD_NAME]);
    const hand = engine.gs.players[pi]?.hand?.length || 0;
    return engine.getHeroEligibleActionCards(pi, heroIdx, hs !== pi ? hs : null)
      .filter(n => n !== CARD_NAME && (db[n]?.cardType === 'Attack' || db[n]?.cardType === 'Spell'))
      .filter(n => {
        if (!(eigen > 0) || db[n]?.cardType !== 'Spell') return true;
        const kosten = engine.getWisdomDiscardCost(hs, heroIdx, db[n]);
        return !(kosten > 0) || hand - 2 - eigen >= kosten;      // ohne diese Karte und den Zauber selbst
      });
  } finally { pruefTiefe--; }
}

module.exports = {
  // „This counts as an additional Action." — immer.
  inherentAction: true,

  cpuMeta: {
    // „You cannot play other cards" — die Karte gehört ans Ende des Zuges.
    cpuDeferUntilLast: true,
  },

  /** Stufe je Nutzer: −1 je Ability am Helden (die Engine hält die Stufe bei ≥ 0). */
  levelOffsetForHero(gs, seite, heroIdx, engine) {
    if (!engine) return 0;
    return -abilitiesAmHelden(engine, seite, heroIdx);
  },

  /** Grau, solange kein eigener Held eine passende Handkarte hätte (Stufe prüft die Engine je Held). */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    const heroes = gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) if (andereKarten(engine, pi, hi, pi).length > 0) return true;
    return false;
  },

  /** Je Nutzer: mindestens eine Attack oder ein anderer Spell aus der Hand, den DIESER Held ausführen darf. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    try { return andereKarten(engine, pi, heroIdx, pi).length > 0; } catch { return true; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hs = ctx.cardHeroOwner ?? pi;                       // Brettseite des Nutzers (geliehener Held)
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[hs]?.heroes?.[heroIdx];
      if (!ps || !hero?.name) return;

      // 0) Die Wisdom-Kosten dieser Karte VOR der Zusatzaktion (der Zweitguss zahlt seine eigenen): erst Chosen One, dann der gespielte Zauber.
      await engine.zahleOffeneWisdom(pi);

      // 1) Die Aura.
      engine._broadcastEvent('play_zone_animation', { type: 'chosen_one_aura', owner: hs, heroIdx, zoneSlot: -1, duration: AURA_MS, unterFiguren: true });
      await engine._delay(AURA_VOR_MS);

      // 2) Die Pflichtaktion: eine Attack oder ein Spell aus der Hand mit dem Nutzer.
      let ergebnis = { played: false };
      try {
        for (let versuch = 0; versuch < MAX_VERSUCHE; versuch++) {
          if (hero.hp <= 0) break;
          if (andereKarten(engine, pi, heroIdx, hs).length === 0) break;        // nichts (mehr) da: der Zauber verpufft
          ergebnis = await engine.performImmediateAction(pi, heroIdx, {
            title: CARD_NAME,
            description: `${hero.name} immediately performs an Attack or Spell from your hand as an additional Action.`,
            allowedCardTypes: ['Attack', 'Spell'],
            cardNameFilter: (n) => n !== CARD_NAME,        // keine Ketten aus mehreren Kopien
            skipAbilities: true,
            skipHeroEffects: true,
            cancellable: false,
            ...(hs !== pi ? { heroOwner: hs } : {}),
          });
          if (ergebnis?.played) break;
        }
      } finally {
        // 3) „You cannot play other cards for the rest of the turn afterwards" — auch wenn nichts mehr zu spielen war.
        ps._handPlayLock = { turn: gs.turn || 0, allow: 'all' };
        engine.log('hand_play_locked', { player: ps.username, by: CARD_NAME });
        engine.log('chosen_one', { player: ps.username, hero: hero.name, performed: ergebnis?.played ? ergebnis.cardName : null });
        engine.sync();
      }
    },
  },

  _test: { abilitiesAmHelden, andereKarten, AURA_MS },
};

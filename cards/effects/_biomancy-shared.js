// ═══════════════════════════════════════════
//  GETEILT: was ein „Biomancy Token" IST
//
//  Die EINZIGE Stelle, an der festgelegt ist, wie eine Potion zu
//  einem Biomancy-Token wird. Ausgelagert am 16.8., als „Kyli, the
//  Deceptive Sapling" dazukam — ihr Text sagt woertlich „as if they
//  were summoned by the effect of this Hero's Biomancy", die beiden
//  Karten muessen also GARANTIERT dasselbe Ding erzeugen. Eine
//  zweite Kopie des Override-Blocks waere genau die Art Duplikat,
//  die irgendwann auseinanderlaeuft.
//
//  Verbraucher:
//    · `biomancy.js`                      — der regulaere Weg
//      (Potion gespielt → statt Loeschung als Token aufs Brett)
//    · `kyli-the-deceptive-sapling.js`    — holt geloeschte Potions
//      zurueck und legt sie als Token
//    · der Puzzle-Loader in `server.js`   — Als Puzzle-Editor kann
//      Tokens vorab setzen (`_creatureStatuses[...].biomancyLevel`)
//
//  WAS EIN TOKEN AUSMACHT (alles in `inst.counters`):
//    `_cardDataOverride`  Potion-Datensatz mit cardType
//                         'Creature/Token', der Token-HP und einer
//                         numerischen Stufe. Das ist der Grund, warum
//                         die Engine den Token ueberhaupt als Kreatur
//                         behandelt — gelesen wird er ueber
//                         `engine.getEffectiveCardData(inst)`.
//    `_effectOverride`    'Biomancy Token' → der Loader zieht den
//                         Aktiveffekt aus `biomancy-token.js` statt
//                         aus dem Potion-Skript.
//    `currentHp`/`maxHp`  Token-HP.
//    `biomancyDamage`     Schaden des Aktiveffekts (= HP).
//    `biomancyLevel`      Stufe der erzeugenden Biomancy (1-3).
//
//  ACHTUNG BEIM ERWEITERN: eine Karte, die einen Token erzeugt, ruft
//  `placeBiomancyToken` — sie baut den Override NICHT selbst nach.
// ═══════════════════════════════════════════

'use strict';

/** HP = Schaden je Biomancy-Stufe. Kartentext: Lv1 40 / Lv2 60 / Lv3 80. */
const TOKEN_STATS = { 1: 40, 2: 60, 3: 80 };

/** Wieviele Zonen hat ein Held? Engineweit 3. */
const SUPPORT_SLOTS = 3;

/** Stufe auf 1-3 klemmen und die Kennzahlen dazu liefern. */
function tokenStatsForLevel(level) {
  const lvl = Math.max(1, Math.min(3, Number(level) || 0));
  const hp = TOKEN_STATS[lvl];
  // Die Token-STUFE ist um eins niedriger als die Biomancy-Stufe
  // (Kartentext: „Biomancy 1 → Token mit lv 0"). Sie muss numerisch im
  // Override stehen, sonst liest alles, was effektive Kartendaten
  // auswertet, die `null` der Potion — Dark Gears stufenabhaengiges
  // Kostengatter, das Stufen-Abzeichen auf dem Brett und der Tooltip.
  return { level: lvl, hp, damage: hp, tokenLevel: Math.max(0, lvl - 1) };
}

/**
 * Der Zaehler-Block, den eine Token-Instanz traegt. Bewusst als reines
 * Datenobjekt: der Puzzle-Loader in `server.js` setzt Tokens ohne
 * Platzierungsweg und braucht genau das hier, nicht die Platzierung.
 *
 * @param {object} potionData Datensatz der Potion aus cards.json
 * @param {number} level      Biomancy-Stufe 1-3
 */
function biomancyTokenCounters(potionData, level) {
  const { hp, damage, tokenLevel, level: lvl } = tokenStatsForLevel(level);
  return {
    _cardDataOverride: {
      ...(potionData || {}),
      cardType: 'Creature/Token',
      hp,
      level: tokenLevel,
      effect: `Once per turn: Deal ${damage} damage to any target on the board.`,
    },
    _effectOverride: 'Biomancy Token',
    currentHp: hp,
    maxHp: hp,
    biomancyDamage: damage,
    biomancyLevel: lvl,
  };
}

/** Biomancy-Stufe eines Helden (0 = keine Biomancy). */
function biomancyLevelOf(engine, pi, heroIdx) {
  const zones = engine?.gs?.players?.[pi]?.abilityZones?.[heroIdx] || [];
  try { return engine.countAbilitiesForSchool('Biomancy', zones) || 0; }
  catch { return 0; }
}

/** Indizes der freien Support Zones eines Helden. */
function freeSupportSlots(engine, pi, heroIdx) {
  const zones = engine?.gs?.players?.[pi]?.supportZones?.[heroIdx] || [[], [], []];
  const out = [];
  for (let z = 0; z < SUPPORT_SLOTS; z++) {
    if (((zones[z] || []).length) === 0) out.push(z);
  }
  return out;
}

/**
 * Ist diese Karte eine Potion? Geprueft am ROHEN Datenbankeintrag, NICHT
 * an den effektiven Daten — genau darum geht es bei Kylis Klausel „a
 * Creature that is not a Potion": ein Biomancy-Token liegt als
 * Creature/Token auf dem Brett, IST aber eine Potion. Wer hier
 * `getEffectiveCardData` benutzt, haelt jeden Token faelschlich fuer
 * eine normale Kreatur und macht die Anti-Schleife wirkungslos.
 */
function isPotionCardName(engine, cardName) {
  const cd = engine?._getCardDB?.()[cardName];
  return !!cd && String(cd.cardType || '').split('/').includes('Potion');
}

/**
 * Eine Potion als Biomancy-Token in eine Support Zone legen.
 *
 * Fuehrt den kompletten Weg aus: Platzierung, Override-Zaehler,
 * Bluetenanimation, Log, `onCardEnterZone` (damit Pes'zet & Co.
 * ausloesen). Der Aufrufer kuemmert sich nur um Auswahl und Herkunft
 * der Potion.
 *
 * @returns {Promise<object|null>} { inst, slot } oder null, wenn keine
 *          Zone frei war
 */
async function placeBiomancyToken(engine, pi, heroIdx, potionName, level, opts = {}) {
  const placeResult = engine.safePlaceInSupport(potionName, pi, heroIdx, opts.slot ?? -1);
  if (!placeResult) return null;
  const { inst, actualSlot } = placeResult;

  const potionData = engine._getCardDB()[potionName];
  Object.assign(inst.counters, biomancyTokenCounters(potionData, level));

  engine._broadcastEvent('play_zone_animation', {
    type: 'biomancy_bloom',
    owner: pi, heroIdx, zoneSlot: actualSlot,
  });
  if (opts.animate !== false) await engine._delay(opts.animationMs ?? 600);
  // ERST JETZT synchronisieren — der Token soll erscheinen, wenn SEINE
  // Bluetenanimation durch ist, nicht wenn die letzte durch ist.
  // Frueher stand hier kein sync: Kyli legt bis zu drei Tokens in einer
  // Schleife, die Animationen liefen also versetzt (richtig), die Tokens
  // ploppten aber alle gemeinsam beim Abschluss-sync der Karte auf
  // (Als Report 16.8.). Bei Biomancy selbst (immer nur EIN Token) war
  // das nie sichtbar.
  engine.sync();

  const stats = tokenStatsForLevel(level);
  engine.log('biomancy_token_created', {
    player: engine.gs.players[pi]?.username,
    hero: engine.gs.players[pi]?.heroes?.[heroIdx]?.name,
    potion: potionName,
    level: stats.level, hp: stats.hp, damage: stats.damage,
    source: opts.sourceName || 'Biomancy',
  });

  // Eintritts-Hooks nachziehen (Pes'zet und Verwandte). `_skipReactionCheck`
  // wie im urspruenglichen Biomancy-Pfad — die Platzierung ist kein
  // eigener Aktivierungszeitpunkt.
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true,
  });

  return { inst, slot: actualSlot };
}

module.exports = {
  TOKEN_STATS,
  SUPPORT_SLOTS,
  tokenStatsForLevel,
  biomancyTokenCounters,
  biomancyLevelOf,
  freeSupportSlots,
  isPotionCardName,
  placeBiomancyToken,
};

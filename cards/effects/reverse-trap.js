'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Reverse Trap"  (W75c)
//  Spell (Surprise, Lv1, Decay Magic + Magic Arts)
//
//  „Activate this Surprise when your opponent activates a Reaction Attack, Spell or Creature or a Surprise. Negate it and add it to your hand. Its level becomes 0 while it remains in
//   your hand or on the board."
//
//  ── DREI WEGE, auf denen der Gegner „eine Reaction aktiviert oder eine Surprise" (Bauform Front Soldier / See through the Ruse, aber als VERDECKTE Surprise) ──
//   ① KETTENFENSTER (`isSurprise` + `isReaction`, wie Lunar Eclipse): die Surprise nimmt aus ihrer Zone am Kettenfenster teil. `reactionCondition`: das oberste Glied gehört dem Gegner und ist
//     (a) die AKTIVIERUNG einer Surprise (`isSurpriseActivation` — die Engine öffnet dafür das Fenster auch, wenn der Gegner der Surprise eine verdeckte Karte mit `reactsToSurpriseActivation`
//     hält, `_surpriseReactorHeld`) oder (b) eine Reaction-ATTACK/-SPELL/-CREATURE (jedes spätere Kettenglied ist eine Reaction; als erstes gespielt zählt nur eine Karte mit Untertyp Reaction;
//     Reaction-ARTIFACTS und Heldeneffekte zählen nicht). `resolve` negiert das Glied direkt darunter und lässt es per `negateChainLink(…, { stealToHandOf, stufeNull })` in die HAND der Surprise-
//     Besitzerin wandern (der Reaktionspreis geht zurück, die Herkunft wird vermerkt — die Karte kehrt später zu ihrem Besitzer zurück).
//   ② SURPRISE-AKTIVIERUNG: Weg ① über das Kettenfenster der Aktivierung (`executeCardWithChain({ isSurpriseActivation })`, Engine `_activateSurprise`): negiert die Kette die Surprise, fliegt die
//     Karte aus ihrer Zone in die Hand der Negiererin (statt in die Ablage; Bakhm-Slots ausgenommen).
//   ③ HAND-REAKTIONSFENSTER der Engine (Held besiegt, vor Schaden, … — keine Kette) und Reaction-Creatures aus der Hand: `surpriseReactionPlayedTrigger` am Surprise-Fenster von
//     `_reaktionGespielt`; `onSurpriseActivate` liefert `{ reactionNegated, stolenTo, stufeNull }`, die Engine lässt die Wirkung ausfallen und übergibt die Karte aus der Ablage der Hand der Negiererin
//     (`_stiehlGespielteReaktion`; eine Reaction-Creature übergibt `summonCreatureWithHooks` selbst, statt sie abzulegen).
//
//  ── „ITS LEVEL BECOMES 0 WHILE IT REMAINS IN YOUR HAND OR ON THE BOARD" ──
//  Die Handinstanz bekommt `counters.levelSet = 0` und die Marke `_rtLevel0` (Engine `_stufeNullMarkieren`; `levelSet` wirkt in `heroMeetsLevelReq`/`effectiveCardLevel`, wie beim Inconspicuous Lawn
//  Gnome). Weg aufs Brett: die Marke reist über das Fremd-Abgangsbuch (`_bucheStufeNullAbgang` → `_stempelFremdHerkunft` → `_stufeNullAufBrett`): Creatures tragen Stufe 0 im Kartenwert
//  (`_cardDataOverride`), eine verdeckte Surprise mit Marke braucht zum Aktivieren keine Stufe. Ins Deck gemischt, abgeworfen/gelöscht, auf die Hand des Gegners gegeben (neue Instanz, andere
//  Herkunft), oder die Karte verlässt das Brett: die Marke ist weg. Hat die Karte keine Stufe (Artifact-Surprise …), ist die Senkung folgenlos — sie kommt trotzdem auf die Hand.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `reverse_trap_ton` (Client: ANIM_REGISTRY, Pixelart): ein cartooniger „1 TON"-Eisenblock fällt auf die Surprise Zone der negierten Surprise bzw. auf den Helden, der die
//  Reaction aktiviert hat, schlägt auf, Staubring und Aufschlagssterne. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Reverse Trap';
const FALL_MS = 700;      // bis der Block aufschlägt (deckt sich mit `reverse_trap_ton`: 620 ms + Einbau-Versatz)
const ANIM_MS = 1700;

/** Zählt dieses Kettenglied als „Reaction Attack, Spell or Creature oder eine Surprise" des Gegners von `pi`? */
function gegnerReaktionOderSurprise(engine, pi, link) {
  if (!link || link.negated || link.owner === pi || link.fromHero || link.fromCreature) return false;
  if (link.isSurpriseActivation === true && link.isInitialCard) return true;                       // die Aktivierung einer Surprise
  if (link.cardType !== 'Attack' && link.cardType !== 'Spell' && link.cardType !== 'Creature') return false;   // keine Reaction-Artifacts
  if (!link.isInitialCard) return true;                                                              // jedes spätere Kettenglied IST eine Reaction (auch eine aktivierte Reaction-Surprise)
  if (link.fromBoard) return false;                                                                  // Brett-Aktivierung/Beschwörung: keine gespielte Reaction
  const cd = engine._getCardDB()[link.cardName];                                                     // als Erstes gespielt: nur eine Karte mit Untertyp Reaction …
  return !!cd && (cd.subtype || '') === 'Reaction' && !hasCardType(cd, 'Creature');                  // … Reaction-Creatures zählen über Weg ③ (sie landen nicht in dieser Kette)
}

/** Welcher Held hat die Reaction gespielt (Bild)? Kettenglied: `casterHeroIdx`/`heroIdx` auf der Brettseite `casterOwner`; sonst der erste lebende (Mitte bevorzugt). */
function reagierenderHeld(engine, link, ownerIdx) {
  const seite = link?.casterOwner ?? link?.heroOwner ?? link?.owner ?? ownerIdx;
  const idx = link?.casterHeroIdx ?? link?.heroIdx;
  const heroes = engine.gs.players[seite]?.heroes || [];
  if (Number.isInteger(idx) && idx >= 0 && heroes[idx]?.name) return { seite, idx };
  const reihe = [1, 0, 2].filter(i => heroes[i]?.name && heroes[i].hp > 0);
  return { seite, idx: reihe.length ? reihe[0] : 0 };
}

module.exports = {
  spellVisual: { impact: { type: 'reverse_trap_ton' }, impactMs: 600 },   // wird die Surprise selbst negiert

  isSurprise: true,
  isReaction: true,
  reactsToSurpriseActivation: true,
  // Bleibt für die ganze Kette in ihrer Zone liegen; das Aufräumen am Kettenende legt sie ab (wie Lunar Eclipse).
  skipPostResolveDiscard: true,
  canActivate: () => false,

  // ① Kettenfenster
  reactionCondition(gs, pi, engine, chainCtx) {
    const chain = chainCtx?.chain;
    if (!chain || chain.length < 1) return false;
    return gegnerReaktionOderSurprise(engine, pi, chain[chain.length - 1]);
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const ziel = chain[myIndex - 1];
    if (!ziel || ziel.negated) return;
    if (ziel.isSurpriseActivation && ziel.surpriseHost) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'reverse_trap_ton', zoneType: 'surprise', owner: ziel.surpriseHost.owner, heroIdx: ziel.surpriseHost.heroIdx, zoneSlot: -1, duration: ANIM_MS,
      });
    } else {
      const h = reagierenderHeld(engine, ziel, ziel.owner);
      engine._broadcastEvent('play_zone_animation', { type: 'reverse_trap_ton', owner: h.seite, heroIdx: h.idx, zoneSlot: -1, duration: ANIM_MS });
    }
    await engine._delay(FALL_MS);
    engine.negateChainLink(chain, myIndex - 1, { stealToHandOf: pi, stufeNull: true });
    engine.log('reverse_trap', { player: engine.gs.players[pi]?.username, negated: ziel.cardName, owner: ziel.owner, via: 'chain' });
    engine.sync();
    await engine._delay(Math.max(0, ANIM_MS - FALL_MS - 500));
  },

  // ③ Hand-Reaktionsfenster ohne Kette (Fenster der Engine, Reaction-Creatures aus der Hand)
  surpriseReactionPlayedTrigger(gs, pi, heroIdx, info /*, engine, seite */) {
    return !!info && info.reactionOwner !== pi && (info.cardType === 'Attack' || info.cardType === 'Spell' || info.cardType === 'Creature');
  },

  onSurpriseActivate: async (ctx, info) => {
    const engine = ctx._engine;
    const pi = ctx.cardController ?? ctx.cardOwner;
    const h = reagierenderHeld(engine, null, info?.reactionOwner);
    engine._broadcastEvent('play_zone_animation', { type: 'reverse_trap_ton', owner: info?.reactionOwner ?? h.seite, heroIdx: h.idx, zoneSlot: -1, duration: ANIM_MS });
    await engine._delay(FALL_MS);
    engine.log('reverse_trap', { player: engine.gs.players[pi]?.username, negated: info?.cardName, owner: info?.reactionOwner, via: 'window' });
    return { reactionNegated: true, stolenTo: pi, stufeNull: true, negatedBy: CARD_NAME };
  },

  /** CPU: die Falle ist gratis und der Gewinn klar — immer auslösen. */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};

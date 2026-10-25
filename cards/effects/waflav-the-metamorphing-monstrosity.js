// ═══════════════════════════════════════════
//  HERO: "Waflav, the Metamorphing Monstrosity"
//  400 HP, 80 ATK — Waflav archetype, base form
//  Starting abilities: Cannibalism, Toughness
//
//  "Whenever this Hero defeats a target, place 1 Evolution
//   Counter on it. You may remove 1 Evolution Counter from
//   this Hero during your turn to activate one of the
//   following effects, but each effect can only be activated
//   once per turn:
//   - Draw 3 cards.
//   - Attach an additional Ability from your deck to this Hero.
//   - Attach up to 3 Abilities from your hand to this Hero as
//     additional attachments."
//
//  Rulings baked in (Als answers):
//   • "defeats a target" — every DIRECT damage from this Hero
//     counts (Attack, Spell, effect); NOT status ticks, NOT
//     damage dealt by Creatures. `W.defeatTriggerHooks` handles it.
//   • The three effects are FREE — "during your turn" is not an
//     Action cost, only a once-per-turn restriction each. All
//     three can fire in one turn for 1 Counter apiece.
//   • "as additional attachments" lifts ONLY the one-Ability-per-
//     Hero-per-turn limit, not the zone / level caps.
//   • The Ascended forms do NOT inherit this defeat trigger —
//     only Thunderstruck restates it, and what is not printed is
//     not there.
//
//  Three independent once-per-turn effects share one Hero Effect
//  slot, so this card manages its own HOPT keys and returns false
//  from `onHeroEffect` (see `finishSelfManagedHeroEffect`).
// ═══════════════════════════════════════════

const { heldenSperreKey } = require('./_hero-hopt-shared');   // v1275: Heldensperre pro Spieler (Ruling 22.9.)
const W = require('./_waflav-shared');
const { drawBlockedFor } = require('./_draw-block-shared');   // D1: Regel von Al
const { pickAusQuellen } = require('./_source-pick-shared');   // „Mehrere Quellen = ein Picker"

const CARD_NAME = 'Waflav, the Metamorphing Monstrosity';
const DRAW_COUNT = 3;
const MAX_HAND_ATTACH = 3;

// Das Menue kennt zwei Eintraege: Draw und „Attach". „Attach" fasst die beiden Anlege-Effekte (Deck / Hand) zusammen — ihre Quelle waehlt der Spieler in EINEM Picker mit
// Herkunfts-Label (CARD_API „Mehrere Quellen = ein Picker"). Die Einmal-pro-Zug-Stempel bleiben getrennt (`deck`, `hand`): wer aus dem Deck anlegt, sperrt nur den Deck-Effekt.
const EFFECTS = [
  { id: 'draw',      label: '🃏 Draw 3 cards' },
  { id: 'attach',    label: '📚 Attach Abilities from your deck or hand' },
];
const ATTACH_QUELLEN = ['deck', 'hand'];

const effKey = (id, pi, hi) => heldenSperreKey(`waflav-effect:${id}`, pi);   // v1275: pro Spieler (Ruling 22.9.)

/**
 * Ein Effekt steht zur Wahl, wenn (a) sein Once-per-turn frei ist UND
 * (b) er ueberhaupt etwas bewirken kann. Ohne (b) bot das Menue
 * "Attach an Ability from your deck" auch dann an, wenn keine einzige
 * legale Ability im Deck lag — der Spieler zahlte den Counter fuer eine
 * leere Galerie.
 */
// Als Befund 29.9.: `hs` = Brettseite eines geliehenen Waflav (Standard `pi`).
function effectAvailable(engine, id, pi, heroIdx, hs = pi) {
  if (engine.gs.hoptUsed?.[effKey(id, pi, heroIdx)] === engine.gs.turn) return false;
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  if (id === 'deck') return W.attachableAbilitiesIn(engine, pi, heroIdx, ps.mainDeck, hs).length > 0;
  if (id === 'hand') return W.attachableAbilitiesIn(engine, pi, heroIdx, ps.hand, hs).length > 0;
  if (id === 'attach') return ATTACH_QUELLEN.some(q => effectAvailable(engine, q, pi, heroIdx, hs));
  return !drawBlockedFor(engine, pi);   // 'draw' - D1 (Regel von Al): reiner Zug, unter Hand-/Zieh-Sperre keine Wahl (Counter nicht fuer nichts)
}

function stampEffect(engine, id, pi, heroIdx) {
  if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
  engine.gs.hoptUsed[effKey(id, pi, heroIdx)] = engine.gs.turn;
}

/**
 * Ability-Karten aus einer Zone, die dieser Held AUCH TRAGEN KANN.
 *
 * Reine Typprüfung reicht nicht: Waflavs Basisform ist KEIN Ascended
 * Hero, also fallen `ascendedHeroOnly`-Abilities (Smugness) weg, ebenso
 * `restrictedAttachment`-Karten, karteneigene `canAttachToHero`-Gates
 * und alles, wofür schlicht kein Zonenplatz mehr da ist. Der geteilte
 * Helfer bündelt genau die Schranken, die der Hand-Play-Pfad in
 * server.js einzeln prüft.
 */
function abilityNamesIn(engine, pi, heroIdx, list, hs = pi) {
  return W.attachableAbilitiesIn(engine, pi, heroIdx, list, hs);
}

/**
 * `cardGallery` prompts take `{ name, source }` objects, not bare
 * strings — the CPU's gallery scorer reads `.name` and the client
 * renders the source badge.
 */
function gallery(names, source) {
  return [...new Set(names)].sort().map(n => ({ name: n, source }));
}

// ── Effect 1: "Draw 3 cards." ────────────────────────────────────────
async function doDraw(engine, pi, heroIdx, hs = pi) {
  await engine.actionDrawCards(pi, DRAW_COUNT);
  engine.log('waflav_draw', {
    player: engine.gs.players[pi]?.username, amount: DRAW_COUNT,
  });
  engine.sync();
  return true;
}

// ── Effect 2: "Attach an additional Ability from your deck." ─────────
async function doDeckAttach(engine, pi, heroIdx, hs = pi, vorgewaehlt = null) {
  const ps = engine.gs.players[pi];
  const names = abilityNamesIn(engine, pi, heroIdx, ps.mainDeck, hs);
  if (names.length === 0) return false;

  // `vorgewaehlt`: die Ability kam schon aus dem gemeinsamen Quellen-Picker — keine zweite Galerie.
  const picked = (vorgewaehlt && names.includes(vorgewaehlt)) ? vorgewaehlt : (await engine.promptGeneric(pi, {
    type: 'cardGallery',
    title: CARD_NAME,
    source: CARD_NAME,
    description: 'Attach an Ability from your deck to this Hero.',
    cards: gallery(names, 'deck'),
    cancellable: true,
  }))?.cardName || null;
  if (!picked) return false;

  // ★ W16a (Al, Frage 3: „Ja!"): Anlegen PER EFFEKT prallt an Resistance ab — VOR jeder Kartenbewegung gefragt (die Ability bleibt im Deck, kein Mischen). Die Wahl war getroffen:
  // der Effekt zählt als gewirkt (true → Evolution Counter bezahlt, Einmal-Stempel des Effekts gesetzt).
  if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, hs, heroIdx, CARD_NAME)) {
    engine.log('waflav_attach_blocked', { player: ps.username, card: picked });
    engine.sync();
    return true;
  }

  const _taken_deckIdx = await engine.takeFromPile(ps, 'deck', picked, { source: CARD_NAME });   // v820: Stapel-Schicht
  if (!_taken_deckIdx) return false;

  // Route through the hand-attach helper so placement, level caps and
  // customPlacement all behave exactly as a normal attachment — the
  // card only lifts the once-per-turn limit ("additional").
  engine.handZugangSync(ps, picked, { von: 'transit', source: CARD_NAME });
  const res = await engine.attachAbilityFromHand(pi, picked, heroIdx, {
    skipAbilityGivenCheck: true, resistanzGeprueft: true, ...(hs !== pi ? { heroOwner: hs } : {}),
  });
  if (!res?.success) {
    // No legal slot — put it back rather than eating the card.
    const hi = ps.hand.indexOf(picked);
    if (hi >= 0) engine.takeFromPileSync(ps, 'hand', hi);
    ps.mainDeck.push(picked);
    engine.shuffleDeck?.(pi);
    return false;
  }
  engine.log('waflav_deck_attach', {
    player: ps.username, card: picked, hero: CARD_NAME,
  });
  engine.sync();
  return true;
}

// ── Effect 3: "Attach up to 3 Abilities from your hand ..." ──────────
async function doHandAttach(engine, pi, heroIdx, hs = pi, vorgewaehlt = null) {
  const ps = engine.gs.players[pi];
  let attached = 0;
  let blockiert = false;
  // `vorgewaehlt`: die (bis zu 3) Abilities kamen schon aus dem gemeinsamen Quellen-Picker — der Reihe nach anlegen, ohne weitere Galerie.
  const reihe = Array.isArray(vorgewaehlt) ? vorgewaehlt.slice(0, MAX_HAND_ATTACH) : null;
  for (let i = 0; i < MAX_HAND_ATTACH; i++) {
    const names = abilityNamesIn(engine, pi, heroIdx, ps.hand, hs);
    if (names.length === 0) break;
    let picked;
    if (reihe) {
      picked = reihe[i] || null;
      if (picked && !names.includes(picked)) break;   // inzwischen nicht mehr anlegbar (Zonen belegt …)
    } else {
      const choice = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        title: CARD_NAME,
        source: CARD_NAME,
        description: `Attach an Ability from your hand (${attached}/${MAX_HAND_ATTACH} attached). Cancel to stop.`,
        cards: gallery(names, 'hand'),
        cancellable: true,          // "up to 3"
      });
      picked = choice?.cardName || null;
    }
    if (!picked) break;
    const res = await engine.attachAbilityFromHand(pi, picked, heroIdx, {
      skipAbilityGivenCheck: true, ...(hs !== pi ? { heroOwner: hs } : {}),
    });
    if (res?.blocked) { blockiert = true; break; }   // ★ W16a (Al, Frage 3): von Resistance abgefangen (Karte bleibt auf der Hand) = gewirkt
    if (!res?.success) break;
    attached++;
    engine.sync();
  }
  if (attached === 0) return blockiert;
  engine.log('waflav_hand_attach', {
    player: ps.username, amount: attached, hero: CARD_NAME,
  });
  engine.sync();
  return true;
}

// ── Effects 2 + 3 in EINEM Picker: Deck ("an additional Ability") ODER Hand ("up to 3 Abilities") ──
// Eintraege aller noch freien Quellen mit Herkunfts-Label; ein Deck-Eintrag graut die Hand aus, ein Hand-Eintrag das Deck (bis zu 3). Der gewaehlte Effekt wird gestempelt.
async function doAttach(engine, pi, heroIdx, hs = pi) {
  const ps = engine.gs.players[pi];
  const cards = [];
  if (effectAvailable(engine, 'deck', pi, heroIdx, hs)) {
    const deckNamen = abilityNamesIn(engine, pi, heroIdx, ps.mainDeck, hs);
    for (const n of deckNamen) cards.push({ name: n, source: 'deck', count: ps.mainDeck.filter(x => x === n).length });
  }
  if (effectAvailable(engine, 'hand', pi, heroIdx, hs)) {
    const handNamen = new Set(abilityNamesIn(engine, pi, heroIdx, ps.hand, hs));
    for (const n of ps.hand) if (handNamen.has(n)) cards.push({ name: n, source: 'hand' });
  }
  if (cards.length === 0) return false;
  const wahl = await pickAusQuellen(engine, pi, {
    cards,
    maxJeQuelle: { hand: MAX_HAND_ATTACH, deck: 1 },
    title: CARD_NAME,
    description: 'Attach an additional Ability from your deck — or up to 3 Abilities from your hand.',
    confirmLabel: '📚 Attach!',
    cancellable: true,
    gerrymanderEligible: false,   // Waflavs Menue ist keine Gegnerentscheidung zwischen Effekten (kein optionPicker mit gerrymanderEligible)
    extra: { source: CARD_NAME, cpuSourceOrder: ['hand', 'deck'] },
  });
  if (!wahl) return false;
  if (wahl.source === 'deck') {
    const ok = await doDeckAttach(engine, pi, heroIdx, hs, wahl.names[0]);
    return ok ? { ok: true, stamp: 'deck' } : false;
  }
  const ok = await doHandAttach(engine, pi, heroIdx, hs, wahl.names);
  return ok ? { ok: true, stamp: 'hand' } : false;
}

const RUNNERS = { draw: doDraw, attach: doAttach };

module.exports = {
  activeIn: ['hero'],

  // The base form starts the stack; it never Ascends "into" anything by
  // itself, but the counter bookkeeping and the availability refresh
  // both live on it.
  onAscendSetup(gs, pi, heroIdx, engine) {
    W.refreshAscensionTargets(engine, pi);
  },

  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hs = ctx.cardHeroOwner ?? pi;   // Als Befund 29.9.: Brettseite
    const hero = engine.gs.players[hs]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (W.getEvo(hero) < 1) return false;                       // costs 1 Counter
    return EFFECTS.some(e => effectAvailable(engine, e.id, pi, heroIdx, hs));
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hs = ctx.cardHeroOwner ?? pi;   // Als Befund 29.9.: Brettseite
    const hero = engine.gs.players[hs]?.heroes?.[heroIdx];

    if (!hero || W.getEvo(hero) < 1) return W.finishSelfManagedHeroEffect(engine);

    const open = EFFECTS.filter(e => effectAvailable(engine, e.id, pi, heroIdx, hs));
    if (open.length === 0) return W.finishSelfManagedHeroEffect(engine);

    let mode = open[0].id;
    if (open.length > 1) {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Remove 1 Evolution Counter to activate:',
        options: open.map(e => ({ id: e.id, label: e.label })),
        cancellable: true,
      });
      mode = choice?.optionId || null;
    }
    if (!mode || !RUNNERS[mode]) return W.finishSelfManagedHeroEffect(engine);

    // Pay only once the effect actually resolves — a cancelled gallery
    // must not eat the Counter.
    const res = await RUNNERS[mode](engine, pi, heroIdx, hs);
    if (res) {
      W.spendEvo(engine, hs, heroIdx, 1);
      stampEffect(engine, res.stamp || mode, pi, heroIdx);   // „attach" stempelt den tatsaechlich gewaehlten Effekt (deck / hand)
      engine.sync();
    }
    return W.finishSelfManagedHeroEffect(engine);
  },

  /** "Whenever this Hero defeats a target, place 1 Evolution Counter on it." */
  hooks: { ...W.gameStartHook, ...W.defeatTriggerHooks(async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOriginalOwner;
    const heroIdx = ctx.card?.heroIdx;
    if (typeof heroIdx !== 'number' || heroIdx < 0) return;
    const self = engine.gs.players[pi]?.heroes?.[heroIdx];
    if (self?.name !== CARD_NAME || self.hp <= 0) return;
    W.addEvo(engine, pi, heroIdx, 1, CARD_NAME);
    engine.sync();
  }) },

  // Fighting-Lv1-Boden gegen Lern-Drift (Begruendung in _waflav-shared).
  // An JEDER Form deklariert, weil `abilityPlacementBonus` das Skript der
  // AKTUELLEN Form nachschlaegt und Abilities auch im aufgestiegenen
  // Zustand platziert werden.
  cpuAbilityPriorFloor(abilityName, targetLevel) {
    return W.waflavAbilityPriorFloor(abilityName, targetLevel);
  },

  cpuMeta: {
    // ── Ability-Prior-Identitaet (Als Vorschlag 6.8.) ────────────────
    // Alle Formen dieses Helden teilen sich EINEN Prior-Satz fuer
    // Ability-Platzierungen. Begruendung: `performAscension` fasst
    // `abilityZones` nicht an — die Abilities haengen am HELDENSLOT und
    // ueberleben jeden Auf- und Abstieg. Es gibt also gar keine
    // Entscheidung "welche Form soll Fighting bekommen", es gibt nur
    // "soll dieser Held Fighting bekommen".
    //
    // Getrennte Priors waren nicht bloss duenn, sie waren VERDREHT: der
    // Recorder stempelt `abilities` am SPIELENDE mit dem dann aktuellen
    // Formnamen. `Fighting@Flamebathed +150` (11 Beobachtungen) hiess
    // damit nicht "Fighting ist gut auf Flamebathed", sondern "Spiele,
    // die in Flamebathed-Form endeten, liefen gut" — die Endform-WR
    // reicht von 30.2% (Basis) bis 68.8% (Thunderstruck), also lud der
    // Ability-Kanal genau diese Spanne als Ability-Wert ein. Umgekehrt
    // stammte `Fighting@Waflav −60` aus 691 Beobachtungen von Spielen,
    // die in der Basisform endeten — den verlorenen.
    abilityIdentity: W.ARCHETYPE,
    // Woher bezieht DIESE Form laufend Evolution Counter?
    // Die Basisform bekommt einen Zaehler, wenn SIE ein Ziel besiegt.
    // Deckneutraler Vertrag: die Zugende-Messung liest ihn, statt
    // Formnamen zu kennen.
    counterSource: { kind: 'defeat' },
    counterConsumer: true,
    // Jede der drei Optionen kostet genau 1 Evolution Counter — und
    // genau hier versickerte die Aufstiegs-Rampe: gemessen 310
    // Ausgaben in 500 Spielen gegen 1092 ueberhaupt erzeugte Zaehler.
    // Der Effekt ist voellig legitim; der Kanal soll nur lernen, WANN
    // er den letzten Zaehler NICHT wert ist.
    counterSpend: W.counterSpendContract(() => 1),
  },
};

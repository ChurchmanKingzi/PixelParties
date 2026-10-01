// ═══════════════════════════════════════════
//  CARD EFFECT: "Chuck, the Storyteller"
//  Ascended Hero — 300 HP / 100 ATK
//
//  „Immediately play this Hero from your hand on top of a \"Chuck, the
//   Crazy Veteran\" you control that is defeated by taking damage while
//   you still control other undefeated Heroes. This Ascension condition
//   cannot be ignored or substituted. When you Ascend this Hero, fully
//   heal its HP. When this Hero performs an Action, draw 2 cards. Any
//   damage this Hero would take while you control other undefeated
//   Heroes becomes 0."
//
//  Aufstiegsbonus (Als Vorgabe): der Beherrscher darf bis zu DREI
//  Abilities (Duplikate erlaubt) von AUSSERHALB des Spiels waehlen und
//  an diesen Helden anlegen.
//
//  ── BAUFORM ──────────────────────────────────────────────────────
//  Wie „Bloom, the Continent Corruptor": der Aufstieg ist ein ZWANG
//  („Immediately … play"), kein Angebot.
//   • `ascendsFromDefeat: true` — der Aufstieg traegt einen GEFALLENEN
//     Helden; der Aufstiegsbonus stellt die HP wieder her.
//   • `onHeroKO` feuert aus der HAND und ruft `performAscension` selbst.
//     „Defeated by taking damage" = der KO-Hook traegt `isSacrifice`
//     NICHT (nur der Niederlage-Pfad ohne Schaden setzt es), das gilt
//     auch fuer True Damage, der keinen `type` mitgibt.
//   • „while you still control other undefeated Heroes" wird im
//     Moment des Todes geprueft (HP > 0). Fuer den SCHILD der Aufstiegs-
//     form zaehlt ein im selben Flaechenschlag nur vorgemerkter Tod
//     (`heldTodAufgeschoben`) noch als im Spiel, wie bei Chuck, the
//     Crazy Veteran.
//   • „cannot be ignored or substituted" erkennt die Engine am gedruckten
//     Text (`isAscensionConditionUnskippable`): Divine Awakening, Throne
//     Robber & Co. prallen ab. Die Bedingung selbst wird regulaer ueber
//     einen Stempel erfuellt, den nur der KO-Hook setzt.
//   • Kein `blockEndPhaseOnAscend`: der Text nennt keine Ausnahme. Der
//     erzwungene Aufstieg laeuft ohnehin mitten im Schaden und beendet
//     keinen Zug (Rueckgabewert `skipEndPhase` wird hier nicht gelesen).
//
//  ── AUFSTIEGSBONUS: ABILITIES VON AUSSERHALB ──────────────────────
//  Pro Wahl zeigt die Galerie NUR Abilities, die JETZT noch an den
//  Helden passen (`entscheide`). Weil jede Kopie sofort angelegt wird,
//  stimmt die Auswahl der naechsten Runde automatisch mit dem echten
//  Zustand ueberein — es kann nie eine Kombination gewaehlt werden, die
//  nicht komplett passt. Die Regeln sind die der echten Anlege-Wege:
//   • je Ability hoechstens EIN Stapel, Stufe 1–3 (Duplikate stapeln),
//   • 3 Ability-Zonen,
//   • hat der Held Xalibur/Xal (`heroAcceptsAbilitiesInSupport`), gehen
//     weitere, VERSCHIEDENE Abilities in seine freien Support Zones,
//   • verwahrte/versiegelte Zonen (Madame Guillotine) zaehlen mit.
//  Jede Wahl ist abbrechbar („Done"): „bis zu drei".
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType } = require('./_hooks');
const { handlungsHooks } = require('./_action-shared');

const CARD_NAME = 'Chuck, the Storyteller';
const BASIS = 'Chuck, the Crazy Veteran';
const MAX_WAHLEN = 3;
const HEAL_QUELLE_NAME = CARD_NAME;

/** Stempel, den der KO-Hook setzt und die Bedingung liest. */
function stempelKey(hs, heroIdx) { return `chuckAscend:${hs}-${heroIdx}`; }

/**
 * Hat der Kontrolleur `pi` neben `hero` noch einen ungefallenen Helden?
 * `aufgeschobenZaehltMit`: ein im selben Flaechenschlag nur VORGEMERKTER
 * Tod zaehlt fuer die Schadensberechnung noch als im Spiel (Todes-Aufschub
 * 28.9., wie bei Chuck, the Crazy Veteran) — beim Aufstieg NICHT: dort
 * ist der Held schon bei 0 HP gefallen.
 */
function hatAndereLebende(engine, pi, hero, aufgeschobenZaehltMit = true) {
  return engine.heroesControlledBy(pi).some(({ hero: h }) =>
    h && h !== hero && h.name
    && (h.hp > 0 || (aufgeschobenZaehltMit && engine.heldTodAufgeschoben(h))));
}

// ─── Abilities anlegen ──────────────────────────────────────────────

/** Erste freie, nicht versiegelte Support-Zone (wie `findAbilitySupportSlot`). */
function freieSupportZone(engine, hs, heroIdx) {
  const V = require('./_ability-verwahrung-shared');
  const zonen = engine.gs.players[hs]?.supportZones?.[heroIdx] || [];
  const anzahl = Math.max(3, zonen.length);
  for (let z = 0; z < anzahl; z++) {
    if ((zonen[z] || []).length === 0 && !V.versiegelt(engine.gs, hs, heroIdx, 'support', z)) return z;
  }
  return -1;
}

/**
 * WOHIN kaeme eine weitere Kopie dieser Ability? Rein lesend.
 * @returns {{kind:'ability'|'support', slot:number}|null} null = passt nicht
 */
function entscheide(engine, pi, hs, heroIdx, name) {
  const script = loadCardEffect(name);
  if (!script) return null;
  if (script.restrictedAttachment) return null;
  if (script.canAttachToHero && !script.canAttachToHero(engine.gs, pi, heroIdx, engine)) return null;

  const stapel = engine.heroAbilityStackOf(hs, heroIdx, name);
  if (stapel) {
    if (stapel.level >= 3) return null;
    if (stapel.zoneKind === 'ability') {
      return engine.abilityZielZone(hs, heroIdx, name) === stapel.slotIdx
        ? { kind: 'ability', slot: stapel.slotIdx } : null;
    }
    return { kind: 'support', slot: stapel.slotIdx };
  }
  const z = engine.abilityZielZone(hs, heroIdx, name);
  if (z >= 0) return { kind: 'ability', slot: z };
  if (engine.heroAcceptsAbilitiesInSupport(hs, heroIdx)) {
    const s = freieSupportZone(engine, hs, heroIdx);
    if (s >= 0) return { kind: 'support', slot: s };
  }
  return null;
}

/** Alle Abilities der Kartendatenbank, die ueberhaupt eine Skriptdatei haben. */
function abilityPool(engine) {
  const db = engine._getCardDB();
  const out = [];
  for (const name of Object.keys(db)) {
    if (!hasCardType(db[name], 'Ability')) continue;
    if (!loadCardEffect(name)) continue;
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Eine Kopie anlegen. Karte kommt aus KEINEM Stapel (ausserhalb des Spiels). */
async function anlegen(engine, hs, heroIdx, name, ziel) {
  const ps = engine.gs.players[hs];
  if (ziel.kind === 'ability') {
    if (!ps.abilityZones) ps.abilityZones = [];
    const zonen = ps.abilityZones[heroIdx] || [[], [], []];
    ps.abilityZones[heroIdx] = zonen;
    while (zonen.length < 3) zonen.push([]);
    if (!zonen[ziel.slot]) zonen[ziel.slot] = [];
    zonen[ziel.slot].push(name);
    const inst = engine._trackCard(name, hs, 'ability', heroIdx, ziel.slot);
    engine.sync();
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: name, zone: 'ability',
      heroIdx, zoneSlot: ziel.slot, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx, _skipReactionCheck: true,
    });
  } else {
    if (!ps.supportZones[heroIdx][ziel.slot]) ps.supportZones[heroIdx][ziel.slot] = [];
    ps.supportZones[heroIdx][ziel.slot].push(name);
    engine._trackCard(name, hs, 'support', heroIdx, ziel.slot);
  }
  engine.log('ability_attached', {
    player: ps.username, card: name, hero: ps.heroes?.[heroIdx]?.name || CARD_NAME,
    ...(ziel.kind === 'support' ? { zone: 'support' } : {}),
  });
  engine.sync();
  await engine._delay(450);
}

module.exports = {
  // 'hand': der erzwungene Aufstieg feuert, waehrend die Karte noch auf
  // der Hand liegt. 'hero': Schaden-Schild und Zieh-Trigger wirken vom Brett.
  activeIn: ['hand', 'hero'],

  // Aufstieg aus dem Tod heraus (v718).
  ascendsFromDefeat: true,

  cpuMeta: { dealsDamage: false },

  /**
   * Gedruckte Aufstiegsbedingung: die Grundform ist gerade durch Schaden
   * gefallen, waehrend noch andere Helden stehen — genau das stempelt der
   * KO-Hook. Etwas anderes (Divine Awakening, Drag aus der Hand) erfuellt
   * sie nie.
   */
  ascensionCondition(gs, pi, heroIdx, engine, heroOwner) {
    const hs = heroOwner ?? pi;
    const hero = gs.players[hs]?.heroes?.[heroIdx];
    if (!hero?.name || hero.name !== BASIS) return false;
    return gs._chuckAscendReady?.[stempelKey(hs, heroIdx)] === gs.turn;
  },

  /**
   * „fully heal its HP" + Aufstiegsbonus „bis zu 3 Abilities von
   * ausserhalb des Spiels".
   */
  async onAscensionBonus(engine, pi, heroIdx, heroOwner) {
    const hs = heroOwner ?? pi;
    const hero = engine.gs.players[hs]?.heroes?.[heroIdx];
    if (!hero) return;

    // Der Aufstieg aus dem Tod heraus ZAEHLT als Wiederbelebung (Als
    // Ruling 28.9., wie bei Bloom). Die Todesmarken stehen hier noch —
    // `performAscension` hat die HP schon auf >= 1 gehoben.
    const ausDemTod = !!hero._koProcessed || hero.diedOnTurn != null;
    delete hero.diedOnTurn;
    delete hero._koProcessed;
    if (ausDemTod) engine.zaehleHeldenWiederbelebung(hero, CARD_NAME);

    // ① Volle Heilung („fully heal its HP"). Als Heilung statt als
    // direkter HP-Wert, damit Heil-Zuhoerer sie sehen.
    const fehlt = (hero.maxHp || 0) - (hero.hp || 0);
    if (fehlt > 0) {
      await engine.actionHealHero(
        { name: HEAL_QUELLE_NAME, owner: pi, heroIdx }, hero, fehlt);
    }
    engine.sync();

    // ② Bis zu drei Abilities von ausserhalb des Spiels.
    const pool = abilityPool(engine);
    for (let runde = 0; runde < MAX_WAHLEN; runde++) {
      const passend = pool.filter(n => entscheide(engine, pi, hs, heroIdx, n));
      if (passend.length === 0) break;

      const antwort = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        menuSource: CARD_NAME,
        cards: passend.map(name => ({ name, source: 'outside' })),
        title: CARD_NAME,
        description: `Ascension Bonus: choose an Ability from outside the game and attach it to ${CARD_NAME} (${runde + 1}/${MAX_WAHLEN}). Duplicates are allowed; only Abilities that fit are shown.`,
        // Abbruch = „Done": der Bonus lautet „bis zu drei", die Karte ist
        // hier ohnehin schon aufgestiegen (nach dem Zusagepunkt).
        cancellable: true,
        cancelLabel: '✔ Done',
        searchable: true,
        searchPlaceholder: 'Filter by name…',
      });
      const wahl = antwort && !antwort.cancelled ? antwort.cardName : null;
      if (typeof wahl !== 'string' || !passend.includes(wahl)) break;

      // Frisch entscheiden: zwischen Anzeige und Antwort kann sich der
      // Zustand verschoben haben.
      const ziel = entscheide(engine, pi, hs, heroIdx, wahl);
      if (!ziel) break;
      await anlegen(engine, hs, heroIdx, wahl, ziel);
      engine.log('ascension_bonus', {
        player: engine.gs.players[pi]?.username, ability: wahl, count: 1,
      });
    }
    engine.sync();
  },

  /**
   * CPU: bevorzugt Abilities, die Chuck schon fuehrt (aufstufen), sonst
   * faellt sie auf die allgemeine Galerie-Wertung zurueck.
   */
  cpuResponse(engine, promptKind, promptData) {
    if (promptData?.type !== 'cardGallery' || promptData.title !== CARD_NAME) return undefined;
    const karten = promptData.cards || [];
    if (!karten.length) return null;
    for (const p of engine.gs.players || []) {
      const idx = (p.heroes || []).findIndex(h => h?.name === CARD_NAME);
      if (idx < 0) continue;
      const hi = engine.gs.players.indexOf(p);
      for (const k of karten) {
        const st = engine.heroAbilityStackOf(hi, idx, k.name);
        if (st && st.level < 3) return { cardName: k.name, source: k.source };
      }
    }
    return undefined;
  },

  hooks: {
    // ── DER ZWANG ────────────────────────────────────────────────
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      // Nur aus der Hand — die Brettform hat hier nichts zu tun.
      if (ctx.cardZone !== 'hand') return;
      const pi = ctx.cardOwner;

      const gefallen = ctx.hero;
      if (!gefallen?.name || gefallen.name !== BASIS) return;
      if (gefallen.hp > 0) return;                    // schon gerettet

      // „defeated by taking damage": der Niederlage-Pfad OHNE Schaden
      // (Insta-Defeat, Opfer) uebergibt `isSacrifice`, jeder
      // Schadenspfad nicht.
      if (ctx.isSacrifice !== undefined) return;

      // Der Held muss MIR gehoeren („a Chuck you control").
      let owner = -1, heroIdx = -1;
      for (let p = 0; p < (gs.players || []).length && heroIdx < 0; p++) {
        const hi = (gs.players[p]?.heroes || []).indexOf(gefallen);
        if (hi >= 0) { owner = p; heroIdx = hi; }
      }
      if (heroIdx < 0) return;
      if (engine.heroSideOf(owner, gefallen) !== pi) return;

      // „while you still control other undefeated Heroes".
      if (!hatAndereLebende(engine, pi, gefallen, false)) return;

      const handIdx = (gs.players[pi]?.hand || []).indexOf(CARD_NAME);
      if (handIdx < 0) return;

      if (!gs._chuckAscendReady) gs._chuckAscendReady = {};
      gs._chuckAscendReady[stempelKey(owner, heroIdx)] = gs.turn;
      try {
        await engine.showTriggeredEffect(CARD_NAME);
        await engine.performAscension(pi, heroIdx, CARD_NAME, handIdx,
          owner !== pi ? { heroOwner: owner } : {});
      } finally {
        delete gs._chuckAscendReady[stempelKey(owner, heroIdx)];
      }
    },

    // ── Schaden wird 0, solange noch andere Helden stehen ────────
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      if (ctx.target !== ctx.attachedHero) return;
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (!hatAndereLebende(engine, pi, ctx.attachedHero)) return;
      ctx.setAmount(0);
    },

    // ── „When this Hero performs an Action, draw 2 cards." ───────
    ...handlungsHooks(async (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      const engine = ctx._engine;
      const seite = ctx.cardHeroOwner ?? ctx.cardOwner;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.playerIdx !== seite && ctx.playerIdx !== ctx.cardOwner) return;

      // Nur echte Aktionen (Attack, Spell, Creature, Heldeneffekt/
      // Ability mit Aktionskosten) — dieselbe Auslegung wie Bleed und
      // Hat of Madness.
      const istAktion = typeof engine._bleedTriggersForAction === 'function'
        ? engine._bleedTriggersForAction(ctx)
        : ['attack', 'spell', 'creature'].includes(String(ctx.actionType || ''));
      if (!istAktion) return;

      const zieher = ctx.cardController ?? ctx.cardOwner;
      const ps = engine.gs.players[zieher];
      if (!ps) return;
      if (ps.handLocked || ps.drawLocked) return;
      if ((ps.mainDeck || []).length === 0) return;   // nichts zu ziehen: kein Auftritt

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: zieher });
      engine.sync();
      await engine._delay(180);
      await engine.actionDrawCardsAnimated(zieher, 2, { source: CARD_NAME });
    }),
  },

  // Fuer Tests und Diagnose.
  _BASIS: BASIS,
  _entscheide: entscheide,
  _abilityPool: abilityPool,
};

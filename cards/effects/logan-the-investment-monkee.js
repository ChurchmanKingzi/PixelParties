// ═══════════════════════════════════════════
//  CARD EFFECT: "Logan, the Investment Monkee"  (Hero, 350 HP / 30 ATK)
//
//  Kartentext:
//    "You may once per turn pay any amount of Gold to place that many
//     Invest Counters on this Hero. If you ever have 0 Gold, remove all
//     Invest Counters from this Hero. At the end of your turn, you may
//     activate one of these effects:
//       - Gain Gold equal to the number of Invest Counters on this Hero.
//       - Deal damage equal to five times the number of Invest Counters
//         on this Hero to any target on the board."
//
//  SPRACHE: alle SICHTBAREN Texte (Prompt-Titel, Beschreibungen,
//  Button-Beschriftungen) sind ENGLISCH — das Spiel ist durchgehend
//  englisch. Nur die Kommentare hier sind deutsch.
//
//  ── AUFBAU ────────────────────────────────────────────────────────
//  Drei Teile, drei Mechaniken:
//
//   1. EINZAHLEN — `heroEffect` + `onHeroEffect`. Das Einmal-pro-Zug
//      erzwingt der Server ueber `hero-effect:<Name>:<pi>:<heroIdx>`;
//      diese Datei muss dafuer nichts tun.
//      Einen Zahleneingabe-Prompt gibt es in der Engine nicht, deshalb
//      ein `optionPicker` mit `renderAs: 'dropdown'` — dasselbe Muster
//      wie Siphems "spend N counters"-Liste, damit auch 40 Gold keine
//      Knopfwand erzeugen.
//
//   2. PLEITE RAEUMT AUF — der Zustandsvertrag `goldStateRule`.
//      "If you EVER have 0 Gold" ist ein Dauerzustand, kein Zeitpunkt.
//      Geprueft wird auf EXAKT 0 — negatives Gold (Debt-O-Tron)
//      raeumt NICHT ab, das ist ausdruecklich gewollt.
//      Die Engine ruft den Vertrag nach JEDER Goldaenderung dieses
//      Spielers: Gewinn, Zahlung, Wipe (Market Crash) UND das rohe
//      Abziehen von Kartenkosten. Ein Traeger statt drei Hooks — die
//      drei liessen die Kostenzahlung durchrutschen (Als Report 16.8.).
//
//   3. AUSZAHLEN — `onTurnEnd` mit einer Wahl aus zwei Effekten.
//      "You may" heisst: Ablehnen muss moeglich sein, also ist der
//      Prompt abbrechbar. Ohne Zaehler wird gar nicht erst gefragt.
//
//  ── ENTSCHEIDUNGEN, die der Text offenlaesst ──────────────────────
//   · Die Zaehler bleiben nach dem Auszahlen LIEGEN. Der Text sagt
//     nichts von "remove"; entfernt werden sie ausschliesslich durch
//     die 0-Gold-Regel. Das macht die Karte stark, ist aber die
//     woertliche Lesart — Al kann es jederzeit umdrehen.
//   · "Any target on the board" = Helden UND Kreaturen BEIDER Seiten.
//   · Einzahlen kostet keine Aktion (kein `heroEffectActionCost`),
//     wie bei den meisten Helden-Effekten.
// ═══════════════════════════════════════════

'use strict';

const CARD_NAME = 'Logan, the Investment Monkee';
const COUNTER_FIELD = '_investCounters';
const DAMAGE_PER_COUNTER = 5;

// ── Zaehler-Zugriff ────────────────────────────────────────────────
// Gleiche Form wie Waflavs Evolution Counters (`hero._evolutionCounters`):
// roh auf dem Helden-Objekt, 0 wird geloescht statt gespeichert, damit
// der Zustand klein bleibt und die Client-Anzeige (`> 0`) sauber greift.
function getInvest(hero) {
  return (hero && typeof hero[COUNTER_FIELD] === 'number') ? hero[COUNTER_FIELD] : 0;
}

function setInvest(hero, n) {
  if (!hero) return;
  const safe = Math.max(0, Math.floor(n || 0));
  if (safe === 0) delete hero[COUNTER_FIELD];
  else hero[COUNTER_FIELD] = safe;
}

/** Alle eigenen Logans des Spielers (mehrere Kopien sind moeglich). */
function ownLogans(engine, pi) {
  const heroes = engine?.gs?.players?.[pi]?.heroes || [];
  const out = [];
  for (let hi = 0; hi < heroes.length; hi++) {
    if (heroes[hi]?.name === CARD_NAME) out.push({ hero: heroes[hi], heroIdx: hi });
  }
  return out;
}

/**
 * Die 0-Gold-Regel. Betrifft ALLE Logans dieses Spielers, nicht nur den
 * ausloesenden — der Text sagt "if you ever have 0 Gold", das ist eine
 * Eigenschaft des SPIELERS.
 */
function pruefePleite(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return;
  // WAEHREND der eigenen Einzahlung stillhalten (Als Report 16.8.).
  // Der Ablauf war „bezahlen → Regel greift → Counter setzen → Regel
  // greift nochmal": bei 10 vorhandenen Countern und 50 eingezahltem
  // Gold gab das ZWEI Verfalls-Meldungen (10, dann 50). Die Zahlung und
  // das Setzen der Counter sind aber EIN Vorgang; geprueft wird erst,
  // wenn er fertig ist. Ergebnis unveraendert (wer alles investiert,
  // steht auf 0 Gold und verliert alles) — aber als EIN Ereignis ueber
  // den vollen Bestand.
  if (engine._loganInvestInFlight > 0) return;
  // EXAKT 0, nicht „<= 0" (Als Ruling 16.8. zum Debt-O-Tron-Archetyp:
  // „Logans Counter verfallen explizit nur bei exakt 0"). Vor v407 gab
  // es kein negatives Gold, `> 0` und `!== 0` waren also dasselbe —
  // seit Kent nicht mehr: bei −5 haette die alte Pruefung die Counter
  // abgeraeumt und ein Debt-O-Tron-Logan-Deck unmoeglich gemacht.
  if ((ps.gold || 0) !== 0) return;
  let etwasVerfallen = false;
  for (const { hero, heroIdx } of ownLogans(engine, pi)) {
    const hatte = getInvest(hero);
    if (hatte <= 0) continue;
    setInvest(hero, 0);
    etwasVerfallen = true;
    engine.log('logan_invest_wiped', {
      player: ps.username, hero: CARD_NAME, heroIdx, lost: hatte,
    });
    // Muenzen fallen vom Zaehler-Abzeichen weg und entfaerben sich
    // (16.8., Als Vorgabe). Gegenstueck zum goldenen Bananenregen der
    // Auszahlung: dort faellt Gold AUF ein Ziel, hier faellt es weg.
    // `count` skaliert die Muenzzahl mit dem Verlust; die Animation
    // deckelt selbst. Je Logan eine eigene — mehrere Kopien verlieren
    // ihre Counter gleichzeitig, also sollen auch beide bluten.
    engine._broadcastEvent('play_zone_animation', {
      type: 'invest_counters_lost',
      owner: pi, heroIdx, zoneSlot: -1,
      count: hatte,
    });
  }
  // OHNE dieses sync blieb das Abzeichen stehen, bis irgendwer sonst
  // synchronisiert hat: alle drei Traeger-Hooks laufen NACH dem sync
  // ihrer Gold-Primitive (actionGainGold/actionSpendGold/actionSetGold
  // synchronisieren VOR dem Nach-Buchungs-Hook). Der Zustand war also
  // richtig, nur unsichtbar — dieselbe Klasse wie die v401-Faelle.
  if (etwasVerfallen) engine.sync();
}

/** Alle Ziele auf dem Brett — Helden und Kreaturen, beide Seiten. */
function alleZiele(engine) {
  const ziele = [];
  const gs = engine.gs;
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      ziele.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
        cardName: hero.name,
      });
    }
  }
  const cardDB = engine._getCardDB ? engine._getCardDB() : {};
  const { hasCardType } = require('./_hooks');
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (!hasCardType(cardDB[inst.name], 'Creature')) continue;
    ziele.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    });
  }
  return ziele;
}

module.exports = {
  activeIn: ['hero'],

  // ── 1) EINZAHLEN ────────────────────────────────────────────────
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    return (engine?.gs?.players?.[pi]?.gold || 0) > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const heroIdx = ctx.card?.heroIdx;
    const hero = ps?.heroes?.[heroIdx];
    if (!hero || hero.name !== CARD_NAME) return;

    const gold = ps.gold || 0;
    if (gold <= 0) return;

    // Betrag frei waehlbar von 1 bis Gold. `renderAs: 'slider'` gibt dem
    // Client einen Schieberegler mit Zahlenfeld (Als Vorgabe) — die
    // Optionsliste bleibt trotzdem gefuellt, damit jeder Renderer, der
    // den Slider nicht kennt, auf die Knopfliste zurueckfaellt statt
    // eine leere Auswahl zu zeigen.
    const options = [];
    for (let n = 1; n <= gold; n++) {
      options.push({ id: String(n), label: `Invest ${n} Gold`, description: `→ ${n} Invest Counter${n === 1 ? '' : 's'}` });
    }

    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: `How much Gold do you want to invest? (available: ${gold})`,
      renderAs: 'slider',
      sliderMin: 1,
      sliderMax: gold,
      sliderDefault: gold,
      sliderUnit: 'Gold',
      confirmLabel: '🪙 Invest!',
      cancellable: true,
      options,
    });
    if (!wahl?.optionId) return;

    const betrag = Math.min(gold, Math.max(1, parseInt(wahl.optionId, 10) || 0));

    // Zahlung UND Zaehlersetzung sind ein Vorgang: waehrenddessen ruht
    // die Pleite-Regel (siehe pruefePleite). Zaehler statt Flag, damit
    // verschachtelte Faelle sauber bleiben; Freigabe im finally.
    engine._loganInvestInFlight = (engine._loganInvestInFlight || 0) + 1;
    let bezahlt = false;
    try {
      bezahlt = await engine.actionSpendGold(pi, betrag);
      if (bezahlt) {
        setInvest(hero, getInvest(hero) + betrag);
        engine.log('logan_invest', {
          player: ps.username, hero: CARD_NAME, heroIdx,
          paid: betrag, counters: getInvest(hero),
        });
      }
    } finally {
      engine._loganInvestInFlight = Math.max(0, (engine._loganInvestInFlight || 1) - 1);
    }
    if (!bezahlt) return;

    // JETZT einmal pruefen. Hat die Zahlung das Gold auf 0 gebracht,
    // verfaellt der GESAMTE Bestand in einem Ereignis — die woertliche
    // Lesart des Kartentexts, aber ohne die doppelte Meldung.
    pruefePleite(engine, pi);
    engine.sync();
  },

  // ── 2) PLEITE RAEUMT AUF — EIN Vertrag statt drei Hooks ─────────
  //
  //  "If you EVER have 0 Gold" ist ein DAUERZUSTAND, kein Ereignis.
  //  Bis v403 hing die Regel an drei Bewegungs-Hooks
  //  (`afterResourceGain` / `afterResourceSpend` / `afterGoldSet`) —
  //  und lief damit an allem vorbei, was Gold roh abzieht. Genau das
  //  hat Al am 16.8. gemeldet: sein letztes Gold fuer Wheels
  //  ausgegeben, sichtbar auf 0, Counter blieben liegen. Kartenkosten
  //  laufen naemlich ueber rund zwanzig eigene Abzugsstellen.
  //
  //  Statt eines VIERTEN Hooks jetzt der Zustandsvertrag
  //  `goldStateRule`: die Engine ruft ihn nach JEDER Goldaenderung des
  //  Spielers, egal ueber welchen Weg (siehe `_checkGoldStateRules`
  //  und `_payCardCost` in _engine.js). Ein Traeger, keine Luecke.
  //
  //  SYNCHRON — der Vertrag darf nichts awaiten. `pruefePleite`
  //  braucht das auch nicht: setzen, loggen, broadcasten, syncen.
  goldStateRule(engine, playerIdx) {
    pruefePleite(engine, playerIdx);
  },

  hooks: {
    // ── 3) AUSZAHLEN ──────────────────────────────────────────────
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.card?.heroIdx;
      const ps = engine.gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero || hero.name !== CARD_NAME || hero.hp <= 0) return;

      const zaehler = getInvest(hero);
      if (zaehler <= 0) return;                     // nichts investiert, nichts zu fragen

      const schaden = zaehler * DAMAGE_PER_COUNTER;
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `${zaehler} Invest Counter${zaehler === 1 ? '' : 's'} — choose an effect to activate.`,
        cancellable: true,
        options: [
          { id: 'gold',   label: `💰 Gain ${zaehler} Gold` },
          { id: 'damage', label: `💥 Deal ${schaden} damage`, description: 'to any target on the board' },
        ],
      });
      if (!wahl?.optionId) return;                  // "You may" — Ablehnen ist erlaubt

      if (wahl.optionId === 'gold') {
        await engine.actionGainGold(pi, zaehler);
        engine.log('logan_payout_gold', {
          player: ps.username, hero: CARD_NAME, heroIdx, counters: zaehler, gold: zaehler,
        });
        engine.sync();
        return;
      }

      const ziele = alleZiele(engine);
      if (ziele.length === 0) return;
      const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: `Choose a target for ${schaden} damage.`,
        confirmLabel: `💥 ${schaden} Damage!`,
        cancellable: true,
        // v338 (Als Befund): der Client liest `selectCount`, NICHT
        // `maxSelect`. Mit dem falschen Feld fiel er auf seinen Standard
        // von DREI zurueck — man konnte drei Ziele anwaehlen und sie
        // blieben alle markiert. `minSelect` dazu, damit der
        // Bestaetigen-Knopf erst bei genau einem Ziel freigibt.
        selectCount: 1,
        minSelect: 1,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      if (!id) return;
      const ziel = ziele.find(t => t.id === id);
      if (!ziel) return;

      // v349: Auftritt erst jetzt — Ziel bestaetigt (Muster Book of Doom).
      engine.announceActiveEffect();
      const quelle = { name: CARD_NAME, owner: pi, heroIdx };
      // Goldener Bananenregen auf das Ziel (Als Vorgabe). Vor dem
      // Schaden, damit die Bananen fallen und DANN die Zahl erscheint;
      // `_delay` ist im Rollout ein No-op, die Simulation kostet es also
      // nichts.
      engine._broadcastEvent('play_zone_animation', {
        type: 'golden_banana_rain',
        owner: ziel.owner,
        heroIdx: ziel.heroIdx,
        zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
      });
      await engine._delay(450);
      if (ziel.type === 'hero') {
        const zielHeld = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (zielHeld && zielHeld.hp > 0) {
          await engine.actionDealDamage(quelle, zielHeld, schaden, 'creature');
        }
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          quelle, ziel.cardInstance, schaden, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.log('logan_payout_damage', {
        player: ps.username, hero: CARD_NAME, heroIdx,
        counters: zaehler, damage: schaden, target: ziel.cardName,
      });
      engine.sync();
    },
  },

  // ── CPU-Bewertungshinweis ─────────────────────────────────────────
  // Investierte Zaehler sind gebundenes Gold mit Auszahlung am Zugende.
  // Der Bewerter kennt das Feld nicht von allein; ohne diesen Hinweis
  // waere Logan fuer die CPU ein Held ohne Effekt.
  cpuMeta: {
    cpuInstBonus(engine, inst, ownerIdx) {
      const hero = engine?.gs?.players?.[ownerIdx]?.heroes?.[inst?.heroIdx];
      if (!hero || hero.name !== CARD_NAME) return 0;
      // Ein Zaehler ist mindestens sein Gold wert (Auszahlung "Gold")
      // und hoechstens 5 Schaden (Auszahlung "Schaden"). Konservativ
      // mit dem Goldwert angesetzt, gedeckelt, damit endloses Horten
      // die Bewertung nicht dominiert.
      return Math.min(20, getInvest(hero));
    },
  },
};

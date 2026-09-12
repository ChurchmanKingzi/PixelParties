// ═══════════════════════════════════════════
//  HERO EFFECT: "Rha'Bi, the Living Skeleton"
//
//  Beliebig oft im eigenen Zug: aktuelle UND maximale HP um 100 senken,
//  dafuer die oberste Karte des eigenen Decks VERDECKT in eine freie
//  Support Zone eines gegnerischen Helden legen — aber nur bei einem
//  Helden, der noch KEINE Karte aus diesem Effekt in irgendeiner seiner
//  Support Zones hat. Zu Beginn des naechsten eigenen Zuges kommen alle
//  noch liegenden Karten auf die Hand zurueck, die jeweiligen
//  Traegerhelden nehmen 200 Schaden, und Rha'Bi bekommt je Karte 100
//  aktuelle und maximale HP.
//
//  ── ZWEI VERTRAEGE, DIE MAN LEICHT FALSCH BAUT ────────────────────
//
//  1. BELIEBIG OFT (nicht einmal pro Zug). Die Engine stempelt nach
//     jedem wahrheitsgemaessen `onHeroEffect` ihren Einmal-pro-Zug-
//     Schluessel. Deshalb `ctx._skipHeroEffectHopt = true` — dasselbe
//     Muster wie Kassaran. Der frueher genutzte Weg „immer false
//     zurueckgeben" hiesse fuer die Engine „abgebrochen" und die CPU
//     koennte gefeuert nicht von abgebrochen unterscheiden.
//
//  2. DAS EINSAMMELN LAEUFT AUCH BEI GELAEHMTEM RHA'BI (Als Ruling
//     12.9.: „NUR sein Tod verhindert es"). Der Hook-Filter der Engine
//     schaltet Helden-Hooks stumm, sobald der Held Frozen, Stunned,
//     Negated oder Mummy ist (`_isHeroEffectSilenced`). Genau dafuer
//     gibt es `bypassStatusFilter: true` — ohne das Flag waere der
//     Rueckhol-Zug eines gefrorenen Rha'Bi stillschweigend ausgefallen.
//     Der Tod dagegen wird weiter vom Filter erfasst (`hero.hp <= 0`),
//     und zusaetzlich pruefen wir ihn selbst.
//
//  ── ZUSTAND ───────────────────────────────────────────────────────
//  Jede gelegte Karte traegt `inst.counters._rhabiPlaced = { by, turn }`.
//  Die Marke liegt auf der KARTE, nicht auf Rha'Bi: sie verschwindet
//  mit ihr, ueberlebt jeden Zonenwechsel und traegt den Leger, damit
//  zwei Rha'Bi (beide Seiten) sich nicht in die Quere kommen.
//
//  Die Instanz gehoert der GEGNERSEITE (`owner`, sonst landet sie im
//  falschen Zonenspiegel), bleibt aber dem Leger als `originalOwner`
//  zugeordnet — so gehen Ablage und Loeschung auf SEINE Stapel, und die
//  Karte kommt auf SEINE Hand zurueck.
// ═══════════════════════════════════════════

const CARD_NAME = "Rha'Bi, the Living Skeleton";
const KOSTEN    = 100;
const SCHADEN   = 200;
const ZUWACHS   = 100;
const MARKE     = '_rhabiPlaced';
// Abstand zwischen zwei zurueckfliegenden Karten. Kurz genug, dass ein
// voller Rueckhol-Zug nicht zaeh wird, lang genug, dass man sie einzeln
// ankommen sieht.
const FLUG_MS   = 420;

/** Alle noch liegenden Karten, die DIESER Spieler gelegt hat. */
function platzierte(engine, pi) {
  return (engine?.cardInstances || []).filter(c =>
    c && c.zone === 'support' && c.counters?.[MARKE]?.by === pi);
}

/** Traegt dieser gegnerische Held schon eine Karte aus dem Effekt? */
function heldSchonBelegt(engine, pi, gegner, heroIdx) {
  return platzierte(engine, pi).some(c => c.owner === gegner && c.heroIdx === heroIdx);
}

/** Erster freier Slot in den Support Zones eines Helden, sonst -1. */
function freierSlot(engine, owner, heroIdx) {
  const zonen = engine?.gs?.players?.[owner]?.supportZones?.[heroIdx] || [];
  for (let s = 0; s < zonen.length; s++) {
    const stapel = zonen[s];
    if (!stapel || stapel.length === 0) return s;
  }
  return -1;
}

/**
 * Gegnerische Helden, die den Effekt aufnehmen koennen: lebend, mit
 * freier Support Zone und ohne bereits liegende Karte aus dem Effekt.
 */
function moeglicheZiele(engine, pi) {
  const gegner = pi === 0 ? 1 : 0;
  // ★ RUNDE 1 (Als Befund 12.9.): der Gegner ist komplett immun gegen
  //   alles, was der Zugspieler tut. Der Effekt lief deshalb schon
  //   vorher ins Leere — aber der Knopf SAH aktivierbar aus. Eine leere
  //   Zielliste macht `canActivateHeroEffect` falsch und damit den
  //   Knopf grau, statt den Spieler in eine tote Aktion zu locken.
  if (engine?.gs?.firstTurnProtectedPlayer === gegner) return [];
  const helden = engine?.gs?.players?.[gegner]?.heroes || [];
  const out = [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (heldSchonBelegt(engine, pi, gegner, hi)) continue;
    if (freierSlot(engine, gegner, hi) < 0) continue;
    out.push({ id: `hero-${gegner}-${hi}`, type: 'hero', owner: gegner, heroIdx: hi, cardName: h.name });
  }
  return out;
}

/** Rha'Bi selbst — ueber seinen Platz, nicht ueber eine Instanz. */
function rhabi(engine, pi, heroIdx) {
  return engine?.gs?.players?.[pi]?.heroes?.[heroIdx] || null;
}

/** Kann die Senkung ueberhaupt voll bezahlt werden? */
function bezahlbar(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  return (hero.hp || 0) > KOSTEN && (hero.maxHp || 0) > KOSTEN;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Der Text nennt keine Aktion — also aktionsfrei (★-Regel 7.9.).

  // ★ Siehe Kopfkommentar, Punkt 2: das Einsammeln muss auch laufen,
  //   wenn Rha'Bi Frozen / Stunned / Negated ist.
  bypassStatusFilter: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const held = rhabi(engine, pi, ctx.cardHeroIdx);
    if (!bezahlbar(held)) return false;
    if ((engine.gs.players[pi]?.mainDeck || []).length === 0) return false;
    return moeglicheZiele(engine, pi).length > 0;
  },

  cpuShouldUseHeroEffect(engine, pi) {
    const ps = engine?.gs?.players?.[pi];
    if (!ps) return false;
    if ((ps.mainDeck || []).length <= 3) return false;   // nicht ins Deckout legen
    const hi = (ps.heroes || []).findIndex(h => h?.name === CARD_NAME);
    if (hi < 0 || !bezahlbar(ps.heroes[hi])) return false;
    return moeglicheZiele(engine, pi).length > 0;
  },

  cpuMeta: {
    // Der Effekt zieht sich die Karte im naechsten Zug zurueck auf die
    // Hand — die Zieh-/Deckout-Kanaele sollen das sehen.
    activationDraws: 1,
  },

  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const quelle = payload?.config?.source || payload?.config?.title;
    if (quelle !== CARD_NAME) return undefined;
    const ziele = payload?.validTargets || [];
    if (ziele.length === 0) return undefined;
    // Der Held, den die 200 spaeter am haertesten treffen: der mit den
    // wenigsten HP, den der Schaden also am ehesten umlegt.
    let bestes = ziele[0];
    let wenigste = Infinity;
    for (const t of ziele) {
      const h = engine?.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
      const hp = h?.hp ?? Infinity;
      if (hp < wenigste) { wenigste = hp; bestes = t; }
    }
    return [bestes.id];
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const held = rhabi(engine, pi, heroIdx);
    if (!bezahlbar(held)) return false;

    const ziele = moeglicheZiele(engine, pi);
    if (ziele.length === 0) return false;
    if ((gs.players[pi]?.mainDeck || []).length === 0) return false;

    const wahl = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Reduce this Hero's current and max HP by ${KOSTEN} to place the top card of your deck face-down into a free Support Zone of that Hero.`,
      confirmLabel: '💀 Plant!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
      minRequired: 1,
    });
    if (!wahl || wahl.length === 0) return false;
    const ziel = ziele.find(z => z.id === wahl[0]);
    if (!ziel) return false;

    // Nach der Abfrage neu pruefen — zwischen Anzeige und Antwort kann
    // sich alles geaendert haben (Reaktion, Abwurf, Tod).
    const slot = freierSlot(engine, ziel.owner, ziel.heroIdx);
    if (slot < 0) return false;
    if (heldSchonBelegt(engine, pi, ziel.owner, ziel.heroIdx)) return false;
    if (!bezahlbar(rhabi(engine, pi, heroIdx))) return false;

    // Oberste Deckkarte ueber die Stapel-Schicht entnehmen (★-Regel:
    // kein direktes Splicen an Deck und Ablage).
    const genommen = await engine.takeFromPile(pi, 'deck', 0, {
      source: CARD_NAME, sourceOwner: pi,
    });
    if (!genommen?.name) return false;

    // Kosten erst zahlen, wenn die Karte wirklich da ist.
    const lebend = rhabi(engine, pi, heroIdx);
    engine.decreaseMaxHp(lebend, KOSTEN);

    // Die Instanz: Zonenspiegel gehoert der GEGNERSEITE, Stapel-Routing
    // dem Leger. Bewusst OHNE Beschwoerungs-Hooks — eine verdeckte
    // Karte ist keine beschworene Kreatur; `onCreatureSummoned` und
    // Konsorten haetten hier nichts zu suchen.
    // `_trackCard(name, owner, zone, heroIdx, slot)` BAUT die Instanz
    // und haengt sie in die Verfolgung — nicht mit einer fertigen
    // Instanz aufrufen (der erste Anlauf tat das und legte eine zweite,
    // kaputte Instanz an, deren `name` ein Objekt war; der Hook-Filter
    // stolperte dann ueber `cardName.toLowerCase`).
    const inst = engine._trackCard(genommen.name, ziel.owner, 'support', ziel.heroIdx, slot);
    inst.originalOwner = pi;
    inst.controller = ziel.owner;
    inst.faceDown = true;
    inst.counters[MARKE] = { by: pi, turn: gs.turn };
    engine._addCardToState(inst);

    engine._broadcastEvent('play_zone_animation', {
      type: 'placement', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot,
    });
    engine.log('rhabi_plant', {
      player: gs.players[pi]?.username,
      target: ziel.cardName,
      heroIdx: ziel.heroIdx,
      slot,
    });

    // ★ Beliebig oft — den Engine-Stempel ausdruecklich aussetzen.
    ctx._skipHeroEffectHopt = true;
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * „At the start of your next turn …" — laeuft auch, wenn Rha'Bi
     * gelaehmt ist (`bypassStatusFilter` oben). Nur sein Tod verhindert
     * es; der wird vom Hook-Filter der Engine ohnehin abgefangen und
     * hier noch einmal ausdruecklich geprueft.
     */
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      // ★ Das Feld heisst `activePlayer` — `gs.currentPlayer` gibt es im
      //   ganzen Spiel NICHT (Als Befund 12.9.: der Hook lief nie, die
      //   Karten blieben liegen). Der Hook-Ctx traegt den Wert
      //   ohnehin mit; die Engine-Lesung ist der Rueckfall.
      const amZug = ctx.activePlayer ?? gs.activePlayer;
      if (amZug !== pi) return;                            // nur der EIGENE Zug

      const held = rhabi(engine, pi, ctx.cardHeroIdx);
      if (!held?.name || held.hp <= 0) return;             // tot: nichts kommt zurueck

      const liegend = platzierte(engine, pi);
      if (liegend.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME);

      const getroffen = [];
      for (const inst of liegend) {
        const zielOwner = inst.owner;
        const zielHeroIdx = inst.heroIdx;
        delete inst.counters[MARKE];
        // ★ REIHENFOLGE (Als Befund 12.9.) ────────────────────────────
        // Beide Seiten des Umzugs lesen `inst.owner`: `_removeCardFromState`
        // raeumt damit die Zone, `_addCardToState` waehlt damit die Hand.
        // Wer den Besitz VOR dem Zug umhaengt, laesst die Karte im
        // Zonenspiegel des Gegners stehen — sie lag danach aufgedeckt
        // weiter dort UND auf der Hand. Also: erst mit dem ALTEN Besitz
        // ausraeumen, dann umhaengen, dann mit dem NEUEN einlegen.
        // Bewusst ohne `actionMoveCard`: die Platzierung hat aus
        // demselben Grund keine Zonen-Hooks gefeuert (eine verdeckte
        // Karte ist keine beschworene Kreatur), der Rueckweg tut es
        // symmetrisch ebenfalls nicht.
        // ── FLUG, EINE NACH DER ANDEREN (Als Vorgabe 12.9.) ──────────
        // `play_pile_transfer` ist der Kanal fuer „Brettkarte → Hand",
        // auch seitenuebergreifend (Sparkfly Worker nimmt denselben).
        // Er unterdrueckt zugleich den Hand-Diff-Melder, der die Karte
        // sonst aus dem DECK ziehen liesse. Broadcast VOR der
        // Zustandsaenderung, damit der Client den Quell-Slot noch
        // findet; danach warten, sodass die Karten nacheinander
        // ankommen statt alle auf einmal (wie bei „Draw 3").
        engine._broadcastEvent('play_pile_transfer', {
          fromOwner: zielOwner, toOwner: pi,
          cardName: inst.name,
          from: 'support', to: 'hand',
          fromHeroIdx: zielHeroIdx, fromSlotIdx: inst.zoneSlot,
          toHandIdx: (gs.players[pi]?.hand || []).length,
          finalHandSize: (gs.players[pi]?.hand || []).length + 1,
        });
        engine.sync();
        await engine._delay(FLUG_MS);

        engine._removeCardFromState(inst);
        inst.owner = pi;
        inst.controller = pi;
        inst.zone = 'hand';
        inst.heroIdx = -1;
        inst.zoneSlot = -1;
        inst.faceDown = false;
        engine._addCardToState(inst);
        getroffen.push({ owner: zielOwner, heroIdx: zielHeroIdx, name: inst.name });
      }

      // „the corresponding Heroes of each added card take 200 damage"
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };
      for (const t of getroffen) {
        const opfer = gs.players[t.owner]?.heroes?.[t.heroIdx];
        if (!opfer?.name || opfer.hp <= 0) continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'bloody_cut', owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1,
        });
        await engine.actionDealDamage(quelle, opfer, SCHADEN, 'hero');
      }

      // „… increased by 100 per card added" — der Held kann inzwischen
      // gefallen sein (Reaktion auf den Schaden); dann kein Zuwachs.
      const danach = rhabi(engine, pi, ctx.cardHeroIdx);
      if (danach?.name && danach.hp > 0 && getroffen.length > 0) {
        engine.increaseMaxHp(danach, ZUWACHS * getroffen.length);
      }

      engine.log('rhabi_harvest', {
        player: gs.players[pi]?.username,
        cards: getroffen.length,
        damage: SCHADEN,
      });
      engine.sync();
    },

    /**
     * „If this Hero is defeated, delete all cards placed by this effect
     * still in Support Zones." Gilt fuer JEDEN Weg in den Tod.
     */
    onHeroKO: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const gefallen = ctx.hero;
      if (!gefallen?.name || gefallen.name !== CARD_NAME) return;

      const liegend = platzierte(engine, pi);
      if (liegend.length === 0) return;

      for (const inst of liegend) {
        delete inst.counters[MARKE];
        // Loeschung geht auf den Stapel des LEGERS (`originalOwner`),
        // das macht `_addCardToState` von selbst.
        await engine.actionMoveCard(inst, 'deleted', -1, -1, {
          source: CARD_NAME, sourceOwner: pi,
        });
      }
      engine.log('rhabi_wither', {
        player: engine.gs.players[pi]?.username, cards: liegend.length,
      });
      engine.sync();
    },
  },
};

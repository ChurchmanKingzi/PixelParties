// ═══════════════════════════════════════════
//  HERO EFFECT: "Rha'Bi, the Living Skeleton"
//
//  Beliebig oft im eigenen Zug: aktuelle UND maximale HP um 100 senken,
//  dafuer die oberste Karte des eigenen Decks VERDECKT in eine freie
//  Support Zone eines gegnerischen Helden legen — aber nur bei einem
//  Helden, der in DIESEM ZUG noch nicht gewaehlt wurde (v1011, neuer
//  Wortlaut: „that has not been chosen by this effect yet this turn"). Zu Beginn des naechsten eigenen Zuges kommen alle
//  noch liegenden Karten auf die Hand zurueck, die jeweiligen
//  Traegerhelden nehmen 100 Schaden, und Rha'Bi bekommt je Karte 100
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
const SCHADEN   = 100;   // v1029 (Als Anpassung 12.9.; 200 → 150 → 100)
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

/**
 * ★ WURDE DIESER HELD IN DIESEM ZUG SCHON GEWAEHLT? (v1011, neuer
 * Wortlaut 12.9.: „a Hero … that has not been chosen by this effect yet
 * THIS TURN".)
 *
 * Frueher war die Sperre an die liegende KARTE gebunden („hat schon
 * eine Karte aus dem Effekt"). Jetzt haengt sie am ZUG: ein Held, dem
 * die Karte zwischendurch abhanden kommt, ist trotzdem fuer den Rest
 * des Zuges tabu — und im naechsten Zug ist jeder wieder frei, auch
 * wenn dort noch etwas liegt.
 *
 * Gefuehrt wird die Liste am SPIELER (nicht an der Karte), weil genau
 * das die Sperre beschreibt: seine Wahl in diesem Zug.
 */
function schonGewaehlt(engine, pi, heroIdx) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps || ps._rhabiChosenTurn !== engine.gs.turn) return false;
  return (ps._rhabiChosenHeroes || []).includes(heroIdx);
}

/** Wahl vermerken (s.o.). */
function merkeWahl(engine, pi, heroIdx) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return;
  if (ps._rhabiChosenTurn !== engine.gs.turn) {
    ps._rhabiChosenTurn = engine.gs.turn;
    ps._rhabiChosenHeroes = [];
  }
  if (!ps._rhabiChosenHeroes.includes(heroIdx)) ps._rhabiChosenHeroes.push(heroIdx);
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
    if (schonGewaehlt(engine, pi, hi)) continue;          // ★ je ZUG, s.o.
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
    // Der Held, den die 100 spaeter am haertesten treffen: der mit den
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
    if (schonGewaehlt(engine, pi, ziel.heroIdx)) return false;   // ★ je ZUG
    if (!bezahlbar(rhabi(engine, pi, heroIdx))) return false;

    // Oberste Deckkarte ueber die Stapel-Schicht entnehmen (★-Regel:
    // kein direktes Splicen an Deck und Ablage).
    const genommen = await engine.deckEntnahme(pi,  0, {
      source: CARD_NAME, sourceOwner: pi,
    });
    if (!genommen?.name) return false;

    // Kosten erst zahlen, wenn die Karte wirklich da ist.
    const lebend = rhabi(engine, pi, heroIdx);
    // ★ v1260 (Als Befund 20.9.): „sein Effekt hat nicht immer 100
    // Schaden an ihm selbst verursacht — immer der erste Einsatz jede
    // Runde war frei". Genau Als Vermutung: `decreaseMaxHp` senkt nur
    // das MAXIMUM und stutzt die aktuellen HP bloss darauf — wer schon
    // 100 unter dem Maximum lag, zahlte nichts. Der Kartentext verlangt
    // BEIDES („current and max HP by 100"): also die aktuellen HP
    // vorher festhalten und nach der Senkung auf hp−100 setzen, nie
    // unter 1 (bezahlbar() verlangt ohnehin > 100). Kein Doppelabzug:
    // wer voll war, landet bei (max−100)/(max−100). Die Schadenszahl am
    // Helden kommt vom HP-Delta-Waechter des Clients von selbst.
    const hpZiel = Math.max(1, (lebend.hp || 0) - KOSTEN);
    engine.decreaseMaxHp(lebend, KOSTEN);
    lebend.hp = Math.max(1, Math.min(lebend.hp, hpZiel));
    engine.log('rhabi_cost', { hero: CARD_NAME, hp: lebend.hp, maxHp: lebend.maxHp });

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
    merkeWahl(engine, pi, ziel.heroIdx);                  // ★ je ZUG gesperrt
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

      // ★ JEDE KARTE IST EIN EIGENER TRIGGER (Als Ruling 12.9.) ─────
      // Nicht erst alle einsammeln, dann alle Schaeden, dann heilen.
      // Karte fliegt zurueck → dieses Ziel nimmt SOFORT seine 100 →
      // Rha'Bi bekommt SOFORT seine 100 → erst dann die naechste.
      // Dadurch oeffnet jede Karte ihre eigenen On-Hit-Fenster beim
      // jeweiligen Ziel, statt dass drei Treffer als Block ankommen.
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };
      let zurueck = 0;

      for (const inst of liegend) {
        // Abbruch mitten in der Kette: faellt Rha'Bi durch eine Reaktion
        // auf den vorigen Treffer, kommt nichts mehr zurueck.
        const lebt = rhabi(engine, pi, ctx.cardHeroIdx);
        if (!lebt?.name || lebt.hp <= 0) break;

        const zielOwner = inst.owner;
        const zielHeroIdx = inst.heroIdx;
        delete inst.counters[MARKE];

        // ── ① Flug ───────────────────────────────────────────────────
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

        // ── ② Auf die Hand ───────────────────────────────────────────
        // Reihenfolge: erst mit dem ALTEN Besitz ausraeumen (beide
        // Seiten lesen `inst.owner`), dann umhaengen, dann einlegen.
        engine._removeCardFromState(inst);
        inst.owner = pi;
        inst.controller = pi;
        inst.zone = 'hand';
        inst.heroIdx = -1;
        inst.zoneSlot = -1;
        inst.faceDown = false;
        engine._addCardToState(inst);
        engine.sync();

        // ── ③ Der zugehoerige Held nimmt seine 100 ───────────────────
        const opfer = gs.players[zielOwner]?.heroes?.[zielHeroIdx];
        if (opfer?.name && opfer.hp > 0) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'bloody_cut', owner: zielOwner, heroIdx: zielHeroIdx, zoneSlot: -1,
          });
          await engine.actionDealDamage(quelle, opfer, SCHADEN, 'hero');
        }

        // ── ④ Rha'Bi bekommt SOFORT seine 100 ────────────────────────
        const jetzt = rhabi(engine, pi, ctx.cardHeroIdx);
        if (jetzt?.name && jetzt.hp > 0) engine.increaseMaxHp(jetzt, ZUWACHS);

        zurueck++;
        engine.log('rhabi_return', {
          player: gs.players[pi]?.username,
          card: inst.name,
          target: opfer?.name || null,
          damage: SCHADEN,
        });
        engine.sync();
      }

      engine.log('rhabi_harvest', {
        player: gs.players[pi]?.username,
        cards: zurueck,
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

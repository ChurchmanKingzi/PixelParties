'use strict';
// W69a-01 · „NUR ECHTE ZÜGE ZÄHLEN" bei ORDNUNGS- und FOLGE-ZÄHLERN — ein ÜBERSPRUNGENER Zug (Guardian Beast Zhu, Hand-of-Death-Rider: `ps._skipNextTurn`) zählt bei „your Nth turn" nicht mit,
// hebt eine „nicht in zwei aufeinanderfolgenden Zügen"-Sperre nicht auf und verschiebt einen „every other turn"-Takt nicht.
//
// Al (Spieldesigner, 23.10.2026) auf die zwei letzten Rückfragen aus W68a:
//   a) Ordnungszähler „Nth turn" (Cheat Chair „before the end of your third turn", Willy „your first/second turn" …): „Nein, sie sollen nur 'echte' eigene Züge zählen!"
//   b) „2 consecutive turns" / „every other turn" (Thicket, Jump in the River, Blade of the Frostbringer, Hammer Throw, …): „Und auch das soll 'echte' eigene Züge zählen!"
// Umsetzung: cards/effects/_zug-fristen.js (`echteEigeneZuegeBis`, `echterEigenerZugIndex`, `echterEigenerZugNr`, `vorigerEchterEigenerZug`, `istFolgezug`), Engine-Wrapper gleichen Namens.
//
// Aufbau (lib/skip.js `zeitleiste`): Zug T0 gehört dem Wirker A (= `seat`), Zug T0+i gehört B (i ungerade) bzw. A (i gerade). Die Karte probiert ihre Handlung zu Beginn JEDES tatsächlich gespielten
// Zuges; verglichen wird mit einem unabhängigen Modell über die Liste der echten Züge. Szenarien je Sitz: ohne Skip (Gegenprobe) · Gegnerzug 1 · eigener Zug 2 · eigene Züge 2+4 · Gegnerzüge 1+3 ·
// Gegnerzug 1 UND eigener Zug 2 · Gegnerzug 3 (mitten in der Folge) · Gegnerzug 3 UND eigener Zug 4. Kategorien:
//   0) Hilfen der zentralen API (Zahlenproben, beide Sitze, mit/ohne ausstehende Skip-Marke)
//   1) Folge-Sperre eigener Züge des Wirkers: Thicket, Butterfly Cloud (ereignisgebunden)
//   2) Folge-Sperre der Züge des Zugspielers (Reaktion in der Gegnerrunde): Jump in the River
//   3) Folge-Sperre am Ziel (Einfrieren in zwei aufeinanderfolgenden Zügen): Blade of the Frostbringer (Kreatur und Held)
//   4) Takt „every other turn" am Betroffenen: Hammer Throw
//   5) Ordnungszähler: Cheat Chair („third turn", Bedingung + Spielweg), Willy („first/second turn": Auslösung, Handlimit)
//   6) Zähler über Zugnummern aus Statusdauern: Petrifying Potion (Restdauer des fremden Stuns)
//   7) „last turn" (schon ereignisgebunden, bleibt): letzterEigenerZug, Heragas/Ralzish-Zeitmarke
//   8) Erstrunden-Schutz (Spielregel „first turn of the game", unverändert)
// Exit 0 = korrekt.
const Skip = require('../../lib/skip.js');
const { H } = Skip;
const WILLY = 'Willy, the Valiant Leprechaun';

const SZ = [
  ['ohne Skip (Gegenprobe)', []],
  ['Gegnerzug 1 übersprungen', [1]],
  ['Gegnerzüge 1 und 3 übersprungen', [1, 3]],
  ['eigener Zug 2 übersprungen', [2]],
  ['eigene Züge 2 und 4 übersprungen', [2, 4]],
  ['Gegnerzug 1 UND eigener Zug 2 übersprungen', [1, 2]],
  ['Gegnerzug 3 übersprungen (mitten in der Folge)', [3]],
  ['Gegnerzug 3 UND eigener Zug 4 übersprungen', [3, 4]],
];

/** Standard-Szene: Wirker `seat` am Zug, T0 = 5. */
async function szene(seat, o = {}) {
  const hand = [[], []]; hand[seat] = o.hand || [];
  const heroes = o.heroes ? (seat === 0 ? [o.heroes, null] : [null, o.heroes]) : undefined;
  const t = await H.fresh({ heroes, hand, turn: o.turn ?? 5, active: seat, deckSize: 40, gold: 300 });
  t.seat = seat; t.opp = 1 - seat;
  return t;
}
const nr = (z, i) => z.T0 + i;
const fmt = (a) => JSON.stringify(a);

// ── 0) Die zentrale API ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function kategorie0(R) {
  R.section('════ 0) zentrale Hilfen (Zahlenproben) ════');
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    // laufend Zug 9, Sitz `seat` am Zug (strenger Wechsel; Startspieler = der mit den ungeraden Nummern, hier: seat, weil 9 ungerade -> Startspieler ist seat)
    const t = await szene(seat, { turn: 9 });
    const E = t.engine;
    const me = (n) => (n % 2 === 1 ? seat : opp);   // Besitzer der Zugnummer n
    R.check(`[S${seat}] Besitzer-Probe zugBesitzer(8)=Gegner, (9)=ich`, E.zugBesitzer(8) === opp && E.zugBesitzer(9) === seat && E.zugBesitzer(1) === seat);
    // ohne Skip: ich habe 1,3,5,7,9 => 5 Züge bis 9; Index von 9 ist 5; 3. Zug = 5
    R.check(`[S${seat}] ohne Skip: echteEigeneZuegeBis(ich, 9) = 5, Gegner = 4`, E.echteEigeneZuegeBis(seat, 9) === 5 && E.echteEigeneZuegeBis(opp, 9) === 4);
    R.check(`[S${seat}] ohne Skip: Index(9)=5, Index(7)=4, Index des Gegnerzuges 8 für mich = null`, E.echterEigenerZugIndex(seat, 9) === 5 && E.echterEigenerZugIndex(seat, 7) === 4 && E.echterEigenerZugIndex(seat, 8) === null);
    R.check(`[S${seat}] ohne Skip: echterEigenerZugNr(ich,3) = 5, (Gegner,3) = 6, zugIndexVon wie bisher`, E.echterEigenerZugNr(seat, 3) === 5 && E.echterEigenerZugNr(opp, 3) === 6 && E.zugIndexVon(seat, 3) === 5);
    R.check(`[S${seat}] ohne Skip: vorigerEchterEigenerZug(ich, 9) = 7, (Gegner, 9) = 8, vorher keiner: (ich, 1) = null`, E.vorigerEchterEigenerZug(seat, 9) === 7 && E.vorigerEchterEigenerZug(opp, 9) === 8 && E.vorigerEchterEigenerZug(seat, 1) === null);
    R.check(`[S${seat}] ohne Skip: istFolgezug(ich, 7) wahr, istFolgezug(ich, 5) falsch, istFolgezug(ich, 9) (gleicher Zug) wahr`, E.istFolgezug(seat, 7) === true && E.istFolgezug(seat, 5) === false && E.istFolgezug(seat, 9) === true);
    // Skip: eigener Zug 7 und Gegnerzug 4 übersprungen
    t.gs._uebersprungeneZuege = [{ turn: 7, player: seat }, { turn: 4, player: opp }];
    R.check(`[S${seat}] Skip 7 (eigen), 4 (Gegner): echteEigeneZuegeBis(ich, 9) = 4, Gegner = 3`, E.echteEigeneZuegeBis(seat, 9) === 4 && E.echteEigeneZuegeBis(opp, 9) === 3, [E.echteEigeneZuegeBis(seat, 9), E.echteEigeneZuegeBis(opp, 9)]);
    R.check(`[S${seat}] Skip: Index(9)=4, Index(7)=null (übersprungen), Index(5)=3`, E.echterEigenerZugIndex(seat, 9) === 4 && E.echterEigenerZugIndex(seat, 7) === null && E.echterEigenerZugIndex(seat, 5) === 3);
    R.check(`[S${seat}] Skip: dritter eigener Zug ist Zug 5 (Zug 7 zählt nicht), vierter ist 9, fünfter 11; Gegner: 2,6,8`, E.echterEigenerZugNr(seat, 3) === 5 && E.echterEigenerZugNr(seat, 4) === 9 && E.echterEigenerZugNr(seat, 5) === 11 && E.echterEigenerZugNr(opp, 2) === 6 && E.echterEigenerZugNr(opp, 3) === 8);
    R.check(`[S${seat}] Skip: vorigerEchterEigenerZug(ich, 9) = 5 (nicht 7), (Gegner, 8) = 6`, E.vorigerEchterEigenerZug(seat, 9) === 5 && E.vorigerEchterEigenerZug(opp, 8) === 6);
    R.check(`[S${seat}] Skip: istFolgezug(ich, 5) wahr (Zug 7 fiel aus), istFolgezug(ich, 3) falsch`, E.istFolgezug(seat, 5) === true && E.istFolgezug(seat, 3) === false);
    R.check(`[S${seat}] Skip: istEchterZug(7) falsch, (8) wahr`, E.istEchterZug(7) === false && E.istEchterZug(8) === true);
    // ab-Parameter: Zählung ab einer Startnummer
    t.gs._uebersprungeneZuege = [];
    R.check(`[S${seat}] ab-Parameter: echteEigeneZuegeBis(ich, 9, ab 5) = 3 (5,7,9), Index(9, ab 5) = 3`, E.echteEigeneZuegeBis(seat, 9, 5) === 3 && E.echterEigenerZugIndex(seat, 9, 5) === 3);
    // ausstehende Skip-Marke: mein nächster Zug (11) fällt aus -> der dritte eigene Zug ab jetzt ist 15 statt 13 (4. nach 9 = 13 -> …)
    t.gs.players[seat]._skipNextTurn = true;
    R.check(`[S${seat}] Skip-Marke auf mir: mein nächster Zug (11) gilt als ausgefallen: Nr(6.) = 13 statt 11, Index(11-Position) bleibt für 9 = 5`, E.echterEigenerZugNr(seat, 6) === 13 && E.echterEigenerZugNr(seat, 5) === 9, [E.echterEigenerZugNr(seat, 6), E.echterEigenerZugNr(seat, 5)]);
    delete t.gs.players[seat]._skipNextTurn;
    t.gs.players[opp]._skipNextTurn = true;
    R.check(`[S${seat}] Skip-Marke auf dem Gegner: sein nächster Zug (10) gilt als ausgefallen: Nr(5.) = 12 statt 10`, E.echterEigenerZugNr(opp, 5) === 12 && E.echterEigenerZugNr(opp, 4) === 8, [E.echterEigenerZugNr(opp, 5), E.echterEigenerZugNr(opp, 4)]);
    R.check(`[S${seat}] keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
}

// ── 1) Folge-Sperre eigener Züge: Thicket und Butterfly Cloud ─────────────────────────────────────────────────────────────────────────────
/** Erwartung „jeder zweite echte eigene Zug": Versuch k (0-basiert) gelingt genau bei geradem k. */
function wechselMuster(res) { return res.map(([i, ok], k) => [i, ok, k % 2 === 0 ? 1 : 0]); }
async function kategorie1(R) {
  R.section('════ 1) Folge-Sperre eigener Züge: Thicket, Butterfly Cloud ════');
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    // Thicket
    {
      const t = await szene(seat);
      const c = t.put(seat, 1, 0, H.INERT.creature);
      t.targetFn = (v) => { const x = v.find(q => q.type === 'equip' && q.owner === seat); return x ? [x.id] : undefined; };
      const res = [];
      const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
        if (info.aktiv !== seat) return;
        await tt.play(seat, 'Thicket', {});
        res.push([info.i, c.counters.thicketTurn === tt.gs.turn ? 1 : 0]);
      } });
      const m = wechselMuster(res); const ok = m.every(([, a, b]) => a === b) && res.length >= 5 && t.errors.length === 0;
      R.check(`[S${seat}] Thicket — ${nm}`, ok, ok ? undefined : { ist: fmt(res.map(r => r[1])), soll: fmt(m.map(r => r[2])), echteA: z.echteA, e: t.errors.slice(0, 2) });
    }
    // Butterfly Cloud
    {
      const t = await szene(seat);
      t.put(1 - seat, 0, 0, H.INERT.big);
      const res = [];
      const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
        if (info.aktiv !== seat) return;
        await tt.play(seat, 'Butterfly Cloud', { hero: 0 });
        res.push([info.i, tt.gs.players[seat]._butterflyCloudUsedThisTurn ? 1 : 0]);
      } });
      const m = wechselMuster(res); const ok = m.every(([, a, b]) => a === b) && res.length >= 5 && t.errors.length === 0;
      R.check(`[S${seat}] Butterfly Cloud — ${nm}`, ok, ok ? undefined : { ist: fmt(res.map(r => r[1])), soll: fmt(m.map(r => r[2])), echteA: z.echteA, e: t.errors.slice(0, 2) });
    }
  }
}

// ── 2) Folge-Sperre der Züge des Zugspielers: Jump in the River (Reaktion in der Gegnerrunde) ─────────────────────────────────────────────
async function kategorie2(R) {
  R.section('════ 2) Jump in the River (Zugspieler = Gegner des Helden) ════');
  const JR = 'Jump in the River';
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    const t = await szene(seat, { hand: Array(5).fill(JR) });   // wenige Kopien: das Handlimit (7) wirft sonst vorn Kopien ab
    t.setAbilities(seat, 0, [['Fighting', 'Fighting'], [], []]);
    const res = [];
    let vorher = 0;
    const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
      if (info.aktiv === seat) return;   // gezählt werden die echten Züge des GEGNERS (Zugspieler)
      const jetzt = tt.lg('jump_in_river').length;
      res.push([info.i, jetzt - vorher]); vorher = jetzt;
    } });
    // Modell: Einsatz in jedem zweiten echten Gegnerzug (erster Gegnerzug: Einsatz)
    const ok = res.length >= 4 && res.every(([, ist], k) => ist === (k % 2 === 0 ? 1 : 0)) && t.errors.length === 0;
    R.check(`[S${seat}] Jump in the River — ${nm}`, ok, ok ? undefined : { ist: fmt(res.map(r => r[1])), soll: fmt(res.map((_, k) => (k % 2 === 0 ? 1 : 0))), echteB: z.echteB, e: t.errors.slice(0, 2) });
  }
}

// ── 3) Blade of the Frostbringer: Folge-Sperre am Ziel (Kreatur und Held) ─────────────────────────────────────────────────────────────────
async function kategorie3(R) {
  R.section('════ 3) Blade of the Frostbringer (Kreatur / Held) ════');
  for (const art of ['Kreatur', 'Held']) for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    const opp = 1 - seat;
    const t = await szene(seat, { hand: ['Blade of the Frostbringer'] });
    await t.play(seat, 'Blade of the Frostbringer', { hero: 0 });
    const kreatur = art === 'Kreatur' ? t.put(opp, 0, 0, H.INERT.big) : null;
    t.targetFn = (v) => {
      const x = art === 'Kreatur' ? v.find(q => q.type === 'equip' && q.owner === opp && q.heroIdx === 0 && q.slotIdx === 0) : v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0);
      return x ? [x.id] : undefined;
    };
    const gesetzt = [];   // Index der Einfrierungen
    const versuche = [];
    const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
      if (info.aktiv !== seat) return;
      const vor = tt.lg('frostbringer_freeze').length;
      const warGefroren = art === 'Kreatur' ? !!kreatur.counters.frozen : !!tt.hero(opp, 0).statuses.frozen;
      await tt.play(seat, 'Attack', { hero: 0 });
      const ok = (tt.lg('frostbringer_freeze').length > vor && !warGefroren) ? 1 : 0;   // „neu eingefroren" (ein schon gefrorenes Ziel zählt nicht)
      versuche.push([info.i, ok]); if (ok) gesetzt.push(info.i);
    } });
    // Modell: ein Einfrieren bei i; Auftauen am Ende des ersten echten Zuges des Opfers danach; gesperrt, bis ein weiterer echter Opfer-Zug begonnen hat (≥ 2 echte Opfer-Züge in (letztes, jetzt])
    let letztes = null; const soll = [];
    for (const [i] of versuche) {
      const n = letztes == null ? 99 : z.echteB.filter(b => b > letztes && b <= i).length;
      const ok = n >= 2 ? 1 : 0; soll.push(ok); if (ok) letztes = i;
    }
    const ok = versuche.length >= 5 && versuche.every(([, a], k) => a === soll[k]) && t.errors.length === 0;
    R.check(`[S${seat}] Blade (${art}) — ${nm}`, ok, ok ? undefined : { ist: fmt(versuche.map(r => r[1])), soll: fmt(soll), echteB: z.echteB, e: t.errors.slice(0, 2) });
  }
}

// ── 4) Hammer Throw: „A player can only be affected by this effect every other turn" — in den echten Zügen des Betroffenen ──────────────────
async function kategorie4(R) {
  R.section('════ 4) Hammer Throw (every other turn, Betroffener) ════');
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    const opp = 1 - seat;
    const t = await szene(seat, { hand: [] });
    t.targetFn = (v) => { const x = v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0); return x ? [x.id] : undefined; };
    const versuche = [];
    const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
      if (info.aktiv !== seat) return;
      const vor = tt.lg('item_locked').length;
      await tt.play(seat, 'Hammer Throw', { hero: 0 });
      versuche.push([info.i, tt.lg('item_locked').length > vor ? 1 : 0]);
    } });
    // Modell: Ordnungszahl des echten Opfer-Zuges, den der Wurf trifft = (Zahl der echten Opfer-Züge bis jetzt) + 1; eine neue Sperre erst für den übernächsten echten Zug
    const ord = (i) => z.echteB.filter(b => b <= i).length + 1;
    let letzte = null; const soll = [];
    for (const [i] of versuche) { const ok = (letzte == null || ord(i) - letzte >= 2) ? 1 : 0; soll.push(ok); if (ok) letzte = ord(i); }
    const ok = versuche.length >= 5 && versuche.every(([, a], k) => a === soll[k]) && t.errors.length === 0;
    R.check(`[S${seat}] Hammer Throw — ${nm}`, ok, ok ? undefined : { ist: fmt(versuche.map(r => r[1])), soll: fmt(soll), echteB: z.echteB, e: t.errors.slice(0, 2) });
  }
}

// ── 5) Ordnungszähler: Cheat Chair und Willy ───────────────────────────────────────────────────────────────────────────────────────────────
async function kategorie5(R) {
  R.section('════ 5a) Cheat Chair („before the end of your third turn") ════');
  const CC = H.loadCardEffect('Cheat Chair');
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    // Zug 1/2 als erster eigener Zug: Sitz 0 = Startspieler (T0 = 1), Sitz 1 beginnt in Zug 2 (T0 = 2)
    const t = await szene(seat, { turn: seat === 0 ? 1 : 2 });
    const hero = t.hero(seat, 0);
    const res = [];
    const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
      const info2 = { letzterHeld: true, hero, heroIdx: 0, sourceOwner: 1 - seat };
      res.push([info.i, CC.heroDefeatedCondition(tt.gs, seat, tt.engine, info2) ? 1 : 0]);
    } });
    // Modell: das Fenster reicht bis zum Ende des dritten TATSÄCHLICH gespielten eigenen Zuges
    const dritter = z.echteA[2];
    const ok = res.length >= 9 && res.every(([i, a]) => a === (i <= dritter ? 1 : 0)) && t.errors.length === 0;
    R.check(`[S${seat}] Cheat Chair (Bedingung) — ${nm}`, ok, ok ? undefined : { ist: fmt(res), dritter, e: t.errors.slice(0, 2) });
  }
  // Spielweg: die Karte wird im Fenster tatsächlich angeboten und belebt den letzten Helden
  for (const seat of [0, 1]) for (const [nm, skip, zeit, erwartet] of [
    ['eigener Zug 2 übersprungen, Gegnerzug 5 (Fenster: dritter echter eigener Zug = Zug 6)', [2], 5, true],
    ['eigener Zug 2 übersprungen, Gegnerzug 7 (Fenster vorbei)', [2], 7, false],
    ['ohne Skip, Gegnerzug 5 (Fenster vorbei)', [], 5, false],
    ['ohne Skip, eigener dritter Zug 4', [], 4, true],
  ]) {
    const t = await szene(seat, { turn: seat === 0 ? 1 : 2, hand: ['Cheat Chair'], heroes: ['Tushu, the Knowledge Keeper', null, null] });
    let getan = null;
    await Skip.zeitleiste(t, { skip, schritte: zeit, nach: async (tt, info) => {
      if (info.i !== zeit) return;
      const vor = tt.hero(seat, 0).hp;
      await tt.run(() => tt.engine.actionDealDamage({ name: 'Killer', owner: 1 - seat, controller: 1 - seat }, tt.hero(seat, 0), 9999, 'other'));
      getan = { hp: tt.hero(seat, 0).hp, vor, ende: !!tt.gs.result };
    } });
    const belebt = getan && getan.hp > 0 && !getan.ende;
    R.check(`[S${seat}] Cheat Chair (Spielweg) — ${nm}`, belebt === erwartet && t.errors.length === 0, { getan, t: t.errors.slice(0, 2) });
  }

  R.section('════ 5b) Willy („first turn": Auslösung · „until the start of your second turn": Handlimit) ════');
  const WS = H.loadCardEffect(WILLY);
  for (const seat of [0, 1]) for (const [nm, skip] of [
    ['ohne Skip (Gegenprobe)', []],
    ['Zug 2 übersprungen', [2]],
    ['Zug 2 und 4 übersprungen', [2, 4]],
    ['Zug 3 übersprungen', [3]],
    ['Zug 2 und 3 übersprungen', [2, 3]],
    ['Zug 4 übersprungen', [4]],
  ]) {
    const deck = Array(40).fill(H.INERT.creature);
    const heroes = seat === 0 ? [[WILLY, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], null] : [null, [WILLY, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
    const t = await H.fresh({ heroes: [heroes[0] || undefined, heroes[1] || undefined], hand: [[], []], deck: [deck, deck], turn: 1, phase: 2, active: 0, gold: 300 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'optionPicker' && /Willy/.test(d.title || ''), answer: () => ({ optionId: 'gold' }) });
    const gold0 = t.gs.players[seat].gold;
    // Zeitleiste in ABSOLUTEN Zugnummern (Start: Zug 1 gehört Sitz 0)
    const A = 0, B = 1, owner = (n) => (n % 2 === 1 ? A : B);
    const skipN = new Set(skip);
    const echt = [1];   // tatsächlich gespielte Zugnummern
    const protokoll = [];   // je Beobachtung: [Zugnummer, Handlimit frei?, Willy-Gold-Zuwachs]
    const lies = () => [t.gs.turn, !!WS.bypassHandLimit(t.engine, seat, t.hero(seat, 0)), t.hero(seat, 0)._willyEffectUsed ? 1 : 0];
    protokoll.push(lies());
    for (let k = 0; k < 8; k++) {
      let j = t.gs.turn + 1;
      while (skipN.has(j)) { t.gs.players[owner(j)]._skipNextTurn = true; j++; }
      const v = t.gs.turn; await t.endTurn(); if (t.gs.turn === v) break;
      echt.push(t.gs.turn); protokoll.push(lies());
    }
    // Modell: erster echter Zug des Willy-Spielers = Index 1; Auslösung am Ende dieses Zuges (Beobachtung danach: _willyEffectUsed = 1); Handlimit frei, bis der zweite echte eigene Zug beginnt
    const meine = echt.filter(n => owner(n) === seat);
    const zweiter = meine[1];
    let ok = true; const abw = [];
    for (const [n, frei, benutzt] of protokoll) {
      const sollFrei = zweiter == null || n < zweiter;
      const sollBenutzt = n > meine[0] ? 1 : 0;   // nach dem Ende des ersten echten eigenen Zuges
      // am Zug selbst (n === meine[0]) ist der Effekt noch nicht ausgelöst
      if (frei !== sollFrei || benutzt !== sollBenutzt) { ok = false; abw.push({ n, frei, sollFrei, benutzt, sollBenutzt }); }
    }
    const goldPlus = t.gs.players[seat].gold - gold0;
    R.check(`[S${seat}] Willy — ${nm}`, ok && t.errors.length === 0, ok ? undefined : { abw: abw.slice(0, 3), meine, e: t.errors.slice(0, 2), goldPlus });
  }
}

// ── 6) Petrifying Potion: Restdauer des fremden Stuns (Zähler über Zugnummern) ────────────────────────────────────────────────────────────
async function kategorie6(R) {
  R.section('════ 6) Petrifying Potion (Restdauer des vorher liegenden Stuns) ════');
  const PP = H.loadCardEffect('Petrifying Potion');
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    const opp = 1 - seat;
    const t = await szene(seat, { hand: [] });
    // Zustand, den die Potion bei einem schon gestunnten Ziel anlegt (der Zweig ist heute nur noch über die Engine-Sperre „keine Erneuerung eines laufenden Stuns"
    // abgeschnitten; die Restdauer-Rechnung bleibt für den Fall, dass sie fällt): Potion-Stun (3) über dem fremden Stun (4), Verwahrung seit T0.
    t.heroStatus(opp, 0, 'stunned', { appliedTurn: t.gs.turn, duration: 3, appliedBy: seat, source: 'Petrifying Potion', _petrified: true,
      _klickHeilung: { card: 'Petrifying Potion', by: seat }, _ppFremd: { obj: { appliedTurn: 0, duration: 4 }, seit: t.gs.turn } });
    let gemessen = null, messI = null;
    const z = await Skip.zeitleiste(t, { skip, schritte: 8, nach: async (tt, info) => {
      if (info.aktiv !== seat || info.i === 0 || gemessen) return;   // der erste echte eigene Zug nach dem Wurf: Klick auf den versteinerten Helden
      messI = info.i;
      const gel = await PP.onStatusClickOption(tt.engine, seat, opp, 0);
      gemessen = { gel, st: tt.hero(opp, 0).statuses.stunned ? tt.hero(opp, 0).statuses.stunned.duration : null };
    } });
    // Modell: der fremde Stun (4) tickt am Ende jedes echten Opfer-Zuges, der zwischen Wurf (i=0) und jetzt schon zu Ende ist. Der Potion-Stun (3) endet nach dem dritten
    // echten Opfer-Zug von selbst — dann gibt es nichts mehr zu heilen (Klick wirkungslos, Stun des Opfers bleibt ohne Eingriff).
    const verstrichen = z.echteB.filter(b => b < messI).length;
    const potionLebt = verstrichen < 3;
    const rest = 4 - verstrichen;
    const ok = !!gemessen && (potionLebt ? (gemessen.gel === true && gemessen.st === (rest > 0 ? rest : null)) : gemessen.gel === false) && t.errors.length === 0;
    R.check(`[S${seat}] Petrifying Potion — ${nm}`, ok, ok ? undefined : { gemessen, messI, verstrichen, rest, echteB: z.echteB, e: t.errors.slice(0, 2) });
  }
}

// ── 7) „last turn": schon ereignisgebunden (Stempel in startTurn / onTurnEnd) — bleibt ───────────────────────────────────────────────────────
async function kategorie7(R) {
  R.section('════ 7) „last turn" (letzterEigenerZug, Heragas/Ralzish-Zeitmarke) ════');
  for (const seat of [0, 1]) for (const [nm, skip] of SZ) {
    const t = await szene(seat, { heroes: ['Heragas, the Monster Slayer', H.BLANK_HEROES[1], H.BLANK_HEROES[2]] });
    const res = [];
    const z = await Skip.zeitleiste(t, { skip, schritte: 12, nach: async (tt, info) => {
      // Beobachtung zu Beginn jedes echten Zuges: letzter echter eigener Zug von A und die Zeitmarke seines letzten echten Zugendes
      res.push({ i: info.i, aktiv: info.aktiv, letzterA: tt.engine.letzterEigenerZug(seat), tick: tt.gs.players[seat]._lastTurnEndTick ?? null });
    } });
    let ok = t.errors.length === 0, bad = null;
    for (const r of res) {
      const echteVorher = z.echteA.filter(a => a < r.i);
      const sollLetzter = echteVorher.length ? nr(z, echteVorher[echteVorher.length - 1]) : null;
      // die Zeitmarke des Zugendes: gestempelt am Ende jedes echten eigenen Zuges (bei laufendem eigenen Zug: der vorige)
      const tickSoll = echteVorher.length ? nr(z, echteVorher[echteVorher.length - 1]) : null;
      // `_zugNr` wird in startTurn gestempelt — der Starzug T0 der Szene wurde nie „begonnen", deshalb erst prüfen, wenn der letzte echte Zug nach T0 liegt (Gegnerzug) bzw. zwei echte Züge davor lagen (eigener Zug)
      const pruefbar = r.aktiv === seat ? echteVorher.length >= 2 : (echteVorher.length >= 1 && echteVorher[echteVorher.length - 1] > 0);
      if (pruefbar && r.letzterA !== sollLetzter) { ok = false; bad = { r, sollLetzter }; break; }
      if (r.tick !== tickSoll) { ok = false; bad = { r, tickSoll }; break; }
    }
    R.check(`[S${seat}] letzter eigener Zug / Zugende-Marke — ${nm}`, ok, ok ? undefined : bad);
  }
}

// ── 8) Erstrunden-Schutz (Spielregel „first turn of the game"): unverändert ─────────────────────────────────────────────────────────────────
async function kategorie8(R) {
  R.section('════ 8) Erstrunden-Schutz (Spielregel, unverändert) ════');
  for (const [nm, skip] of [['ohne Skip', []], ['Zug 2 (erster Zug des zweiten Spielers) übersprungen', [1]]]) {
    const t = await szene(0, { turn: 1 });
    t.gs.firstTurnProtectedPlayer = 1;
    const prot = [];
    await Skip.zeitleiste(t, { skip, schritte: 4, nach: async (tt, info) => { prot.push([info.turn, tt.gs.firstTurnProtectedPlayer === 1 ? 1 : 0]); } });
    // Der Schutz gilt dem zweiten Spieler während des ERSTEN Spielzuges und endet mit dessen Ende — ein Skip des Zweitspieler-Zuges ändert daran nichts.
    const ok = prot[0][1] === 1 && prot.slice(1).every(([, p]) => p === 0) && t.errors.length === 0;
    R.check(`Erstrunden-Schutz — ${nm}`, ok, ok ? undefined : { prot, e: t.errors.slice(0, 2) });
  }
}

(async () => {
  const R = H.runner();
  const nur = process.env.KAT ? new RegExp(process.env.KAT) : null;
  const kats = [kategorie0, kategorie1, kategorie2, kategorie3, kategorie4, kategorie5, kategorie6, kategorie7, kategorie8];
  for (let k = 0; k < kats.length; k++) { if (nur && !nur.test(String(k))) continue; await kats[k](R); }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });

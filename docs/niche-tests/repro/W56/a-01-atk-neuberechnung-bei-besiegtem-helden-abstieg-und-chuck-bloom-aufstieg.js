'use strict';
// W56a · Al (Spieldesigner, 22.10.2026): „Der Abstieg eines besiegten Helden soll ganz normal wie jeder andere Abstieg laufen, inklusive ATK-Neuberechnung." und
//   „Chuck und Bloom sind gewollt! Hier auch ganz normal ATK neu berechnen!"
// Geprüft wird die ATK-Neuberechnung beim Formwechsel (`_atkNachFormwechsel`, Boni, Cykyran-Verdopplung, Fluch, Hook `onFormChanged`) in drei Wegen, jeweils mit Gegenprobe LEBENDER Held:
//   (A) Abstieg eines BESIEGTEN Helden (`performDescend` mit `opts.evenIfDefeated`: Throne Robber, Open Invitation) — Held bleibt besiegt (hp 0), ATK wird normal neu gerechnet,
//   (B) Chuck, the Storyteller: Aufstieg aus der Niederlage (`ascendsFromDefeat`, echter KO-Pfad: Schaden → `onHeroKO` → `performAscension`), „fully heal its HP",
//   (C) „Bloom", the Continent Corruptor: Aufstieg aus der Niederlage durch Paraseed-Gift, HP/Max-HP = 500.
// Szenen (beide Sitze): je ein Bonus allein (dauerhafter Zuwachs `actionPermAtk`, Club of Gobbo, Fighting, befristete Gabe, Cykyran-Verdopplung, Fluch) und alle zusammen (± Fluch).
// Der Zustand VOR dem Wechsel ist maßgeblich: beim Tod legt der Held seine Ausrüstung ab und verliert den Fluch (`handleHeroDeathCleanup`); dauerhafte Zuwächse, Fighting, Gaben und die Cykyran-
// Buchung bleiben. Die Gegenprobe ist deshalb ein LEBENDER Held mit genau dem, was beim Besiegten noch liegt (ohne Club/Fluch).
// Regel: neue Form ATK = (Cykyran ? 2 : 1) × gedruckter ATK der neuen Form + überlebende Boni (nicht verdoppelt); Fluch: sichtbar 0, Zwischenspeicher == Gesamtwert; `onFormChanged` genau einmal.
// Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const { BLOOM, syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
const ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel';
const CK = 'Chuck, the Crazy Veteran', CS = 'Chuck, the Storyteller';
const BC = '"Bloom", the Continent Corruptor';
const CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', CEN = 'Censpartan War Counselor';
const TUSHU = 'Tushu, the Knowledge Keeper', ZWEI = 'Zwei, the Lucky Thief';
const CLUB = 'Club of Gobbo';

const FALL = {
  perm: { perm: 1 }, club: { club: 1 }, fight: { fight: 1 }, temp: { temp: 1 }, cyk: { cyk: 1 }, fluch: { fluch: 1 },
  alle: { perm: 1, club: 1, fight: 1, temp: 1, cyk: 1 }, 'alle+fluch': { perm: 1, club: 1, fight: 1, temp: 1, cyk: 1, fluch: 1 },
};
/** Was bei einem BESIEGTEN Helden noch liegt: ohne Ausrüstung und ohne Fluch. */
const eff = (o, tot) => (tot ? { ...o, club: 0, fluch: 0 } : o);
const gleich = (a, b) => a.atk === b.atk && a.base === b.base && a.perm === b.perm && a.cyk === b.cyk && a.supp === b.supp;

/** Szene für Sitz `me`: Held 0 = `basis`, Held 1/2 neutral (Held 2 trägt ggf. die drei Ratgeber). Boni über die echten Spielwege am Held 0. */
async function aufbau(me, basis, hand, o) {
  const op = 1 - me;
  const karten = [...hand, ...(o.club ? [CLUB] : []), ...(o.fight ? ['Fighting'] : []), ...(o.fluch ? ['Curse'] : []), ...(o.cyk ? [CYK, GOR, CEN] : [])];
  const t = await U.fresh(me, { hand: karten, heroes: { [me]: [basis, TUSHU, ZWEI], [op]: [TUSHU, TUSHU, ZWEI] } });
  t.gs.turn = Math.max(t.gs.turn || 0, 3);
  const H = () => t.hero(me, 0);
  if (o.cyk) { let s = 0; for (const r of [CYK, GOR, CEN]) await t.play(me, r, { hero: 2, slot: s++, active: me }); }
  if (o.fight) await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0, active: me });
  if (o.club) await U.lege(t, me, CLUB, 0);
  if (o.perm) t.engine.actionPermAtk(H(), me, 0, 25, 'Test');
  if (o.temp) t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 5, expiresForPlayer: op, source: 'Test' });
  if (o.fluch) await U.haenge(t, me, 'Curse', 0);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === CS, answer: () => null });   // Chuck: Aufstiegsbonus „Done" (keine zusätzlichen Abilities)
  t.errors.length = 0;
  return t;
}
const fight = (t, me) => t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
/** Überlebende Boni (nicht verdoppelt) laut Flags `o` (= was tatsächlich liegt), unabhängig vom Engine-Buchungsstand. */
const boni = (t, me, o) => (o.fight ? fight(t, me) : 0) + (o.club ? 30 : 0) + (o.perm ? 25 : 0) + (o.temp ? 100 : 0);
const wachter = (t) => { const w = { n: [] }; const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => { if (n === 'onFormChanged') w.n.push({ kind: c.kind, alt: c.oldHeroName, neu: c.newHeroName, ab: c.oldBaseAtk, nb: c.newBaseAtk, reset: c.baseAtkReset, idx: c.heroIdx }); return orig(n, c); };
  return w; };
const umlauf = async (t) => { await t.endTurn(); await t.endTurn(); };
const snap = (h) => ({ atk: h.atk, base: h.baseAtk, perm: h.permAtkDelta || 0, cyk: h._cykyranBonus || 0, supp: h._cursedAtkSuppressed || 0, cursed: !!(h.statuses && h.statuses.cursed), maxHp: h.maxHp });

/** Prüft die ATK-Buchführung eines Helden nach dem Formwechsel gegen die Regel. `base` = gedruckter ATK der neuen Form, `e` = was liegt. */
function pruefeAtk(R, t, me, h, base, e, tag) {
  const K = e.cyk ? 2 : 1, soll = K * base + boni(t, me, e);
  R.check(`${tag}: Fluch-Zustand ${e.fluch ? 'verflucht' : 'nicht verflucht'}`, t.engine._isHeroAtkSuppressed(h) === !!e.fluch, { unterdrueckt: t.engine._isHeroAtkSuppressed(h) });
  if (e.fluch) R.check(`${tag}: verflucht — sichtbare ATK 0, Zwischenspeicher == ${soll}`, h.atk === 0 && h._cursedAtkSuppressed === soll, { atk: h.atk, z: h._cursedAtkSuppressed, soll });
  else R.check(`${tag}: ATK == ${K} × ${base} + Boni(${boni(t, me, e)}) == ${soll}`, h.atk === soll, { atk: h.atk, soll });
  R.check(`${tag}: baseAtk == ${K} × ${base} (Boni nicht verdoppelt), Cykyran-Buchung ${e.cyk ? base : 0}`, h.baseAtk === K * base && (h._cykyranBonus || 0) === (e.cyk ? base : 0), { base: h.baseAtk, cyk: h._cykyranBonus });
  R.check(`${tag}: dauerhafter Zuwachs ${e.perm ? 25 : 0} noch gebucht`, (h.permAtkDelta || 0) === (e.perm ? 25 : 0), { perm: h.permAtkDelta });
  return soll;
}
/** Folgeänderungen laufen auf dem neuen Stand weiter (Zuwachs, Zugumlauf, Club weg, Fluch geheilt). */
async function folge(R, t, me, op, H, e, soll, tag) {
  const base0 = H().baseAtk;
  await umlauf(t);
  R.check(`${tag}: Zugumlauf ändert nichts`, H().atk === (e.fluch ? 0 : soll) && H().baseAtk === base0, snap(H()));
  t.engine.actionPermAtk(H(), me, 0, 20, 'Test');
  R.check(`${tag}: weiterer dauerhafter Zuwachs +20 nach dem Formwechsel (nicht verdoppelt)`, e.fluch ? H()._cursedAtkSuppressed === soll + 20 : H().atk === soll + 20, snap(H()));
  let rest = soll + 20;
  if (e.club) {
    await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CLUB, 'support'), {}));
    rest -= 30;
    R.check(`${tag}: Club zerstört — genau 30 weniger`, e.fluch ? H()._cursedAtkSuppressed === rest : H().atk === rest, snap(H()));
  }
  if (e.fluch) {
    await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
    R.check(`${tag}: Fluch geheilt — ATK == ${rest} (nicht doppelt gutgeschrieben)`, H().atk === rest && !H()._cursedAtkSuppressed, { atk: H().atk, z: H()._cursedAtkSuppressed });
  }
  R.check(`${tag}: sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
}

(async () => {
  const R = U.H.runner();
  const DB = U.H.DB;
  const B0 = DB[RIF].atk, B1 = DB[ASC].atk;                 // 40 / 90
  const BCK = DB[CK].atk, BCS = DB[CS].atk;                 // 20 / 100
  const BBL = DB[BLOOM].atk, BBC = DB[BC].atk;              // 40 / 80
  const HPCK = DB[CK].hp, HPCS = DB[CS].hp;                 // 180 / 300
  for (const me of [0, 1]) {
    const op = 1 - me;

    // ═══ (A) Abstieg eines BESIEGTEN Helden (evenIfDefeated) gegen Gegenprobe lebender Held ═══
    for (const [fname, o] of Object.entries(FALL)) {
      R.section(`(A) Abstieg besiegt — Sitz ${me} · ${fname}`);
      const lauf = async (tot, oo) => {
        const t = await aufbau(me, RIF, [ASC, ASC], oo); const H = () => t.hero(me, 0);
        t.gs.activePlayer = me; t.phase(2);
        await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true }));
        if (tot) await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, H(), {}));
        const w = wachter(t);
        const vorher = snap(H()), hpV = H().hp, maxV = H().maxHp;
        t.gs.activePlayer = me;
        const r = await t.run(() => t.engine.performDescend(me, 0, tot ? { evenIfDefeated: true } : {}));
        return { t, H, w, vorher, hpV, maxV, r };
      };
      const lebend = await lauf(false, o), tot = await lauf(true, o), eT = eff(o, true);
      const kontrolle = (o.club || o.fluch) ? await lauf(false, eT) : lebend;
      if (kontrolle !== lebend) kontrolle.nach = snap(kontrolle.H());
      if (o.club) R.check('A besiegt Voraussetzung: Club of Gobbo ist beim Tod abgegangen (nicht mehr im Support)', !tot.t.find(CLUB, 'support'), tot.t.inst(c => c.name === CLUB).map(c => c.zone));
      if (o.fluch) R.check('A besiegt Voraussetzung: Fluch ist beim Tod abgegangen', !tot.vorher.cursed && !tot.t.find('Curse', 'support'), tot.vorher);
      for (const [x, tag, e] of [[lebend, 'lebend', o], [tot, 'besiegt', eT]]) {
        const { t, H, w, vorher } = x;
        R.check(`A ${tag}: Aufbau — ${tag === 'besiegt' ? 'Held besiegt (hp 0)' : 'Held lebt'}, Abstieg gelingt`, x.r && x.r.success !== false && H().name === RIF && (tag === 'besiegt' ? x.hpV === 0 : x.hpV > 0), { r: x.r, n: H().name, hp: x.hpV });
        const soll = pruefeAtk(R, t, me, H(), B0, e, `A ${tag}`);
        if (tag === 'lebend' || !(o.club || o.fluch)) R.check(`A ${tag}: Differenz stimmt — ATK-Änderung == K × (B0 − B1) (nichts doppelt gebucht, nichts verloren)`, (o.fluch ? H()._cursedAtkSuppressed - vorher.supp : H().atk - vorher.atk) === (e.cyk ? 2 : 1) * (B0 - B1), { vorher, nachher: snap(H()) });
        R.check(`A ${tag}: onFormChanged genau einmal (descend, ${B1} → ${B0}, baseAtkReset)`, w.n.length === 1 && w.n[0].kind === 'descend' && w.n[0].alt === ASC && w.n[0].neu === RIF && w.n[0].ab === B1 && w.n[0].nb === B0 && w.n[0].reset === true && w.n[0].idx === 0, w.n);
        if (tag === 'besiegt') R.check('A besiegt: bleibt besiegt (hp 0), nicht wiederbelebt; Max-HP um die gedruckte Differenz gesenkt', H().hp === 0 && H().maxHp === x.maxV + (DB[RIF].hp - DB[ASC].hp), { hp: H().hp, max: H().maxHp, vorher: x.maxV });
        x.nach = snap(H()); await folge(R, t, me, op, H, e, soll, `A ${tag}`);
      }
      R.check('A Differenzprobe: besiegter Held == lebender Held mit demselben Bestand (gleiche ATK-Buchführung)', gleich(kontrolle.nach, tot.nach) , { kontrolle: kontrolle.nach, besiegt: tot.nach });
    }

    // Besiegter Held, dessen Ausrüstung vor dem Abstieg schon weg ist: maßgeblich ist, was liegt
    R.section(`(A) Abstieg besiegt — Sitz ${me} · Variante notADescend/noDiscard (Open Invitation)`);
    {
      const o = { perm: 1, cyk: 1, fight: 1 };
      const t = await aufbau(me, RIF, [ASC, ASC], o); const H = () => t.hero(me, 0);
      t.gs.activePlayer = me; t.phase(2);
      await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true }));
      await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, H(), {}));
      const w = wachter(t); t.gs.activePlayer = me;
      await t.run(() => t.engine.performDescend(me, 0, { evenIfDefeated: true, noDiscard: true, notADescend: true }));
      R.check(`A Open-Invitation-Weg: besiegt, Basisform, ATK == 2 × ${B0} + Fighting + 25, Hook genau einmal`, H().name === RIF && H().hp === 0 && H().atk === 2 * B0 + fight(t, me) + 25 && H().baseAtk === 2 * B0 && w.n.length === 1, { atk: H().atk, base: H().baseAtk, n: w.n.length });
      R.check('A Open-Invitation-Weg: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }

    // ═══ (B) Chuck, the Storyteller — Aufstieg aus der Niederlage über den echten KO-Pfad ═══
    for (const [fname, o] of Object.entries(FALL)) {
      R.section(`(B) Chuck — Sitz ${me} · ${fname}`);
      const lauf = async (tot, oo) => {
        const t = await aufbau(me, CK, [CS], oo); const H = () => t.hero(me, 0);
        const vorher = snap(H()); const maxV = H().maxHp;
        const w = wachter(t);
        if (tot) {
          for (const hi of [1, 2]) t.hero(me, hi).statuses.shielded = { appliedTurn: 0 };   // Chuck nimmt Schaden, wenn alle anderen immun sind
          await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: op, controller: op, heroIdx: 0 }, H(), 5000, 'attack'));
        } else {
          t.gs._chuckAscendReady = { [`chuckAscend:${me}-0`]: t.gs.turn };
          t.gs.activePlayer = me; t.phase(2);
          await t.run(() => t.engine.performAscension(me, 0, CS, t.gs.players[me].hand.indexOf(CS), {}));
          delete t.gs._chuckAscendReady;
        }
        return { t, H, w, vorher, maxV };
      };
      const lebend = await lauf(false, o), tot = await lauf(true, o), eT = o;   // der Aufstieg läuft INNERHALB von onHeroKO, vor dem Todes-Aufräumen: Club und Fluch liegen noch
      const kontrolle = lebend;
      for (const [x, tag, e] of [[lebend, 'lebend', o], [tot, 'besiegt', eT]]) {
        const { t, H, w, vorher } = x;
        R.check(`B ${tag}: Aufstieg gelang (${CS}), Aufstiegskarte aus der Hand`, H().name === CS && !t.gs.players[me].hand.includes(CS), { n: H().name });
        const soll = pruefeAtk(R, t, me, H(), BCS, e, `B ${tag}`);
        R.check(`B ${tag}: Differenz stimmt — ATK-Änderung == K × (${BCS} − ${BCK})`, (o.fluch ? H()._cursedAtkSuppressed - vorher.supp : H().atk - vorher.atk) === (e.cyk ? 2 : 1) * (BCS - BCK), { vorher, nachher: snap(H()) });
        R.check(`B ${tag}: onFormChanged genau einmal (ascend, ${BCK} → ${BCS}, baseAtkReset)`, w.n.length === 1 && w.n[0].kind === 'ascend' && w.n[0].alt === CK && w.n[0].neu === CS && w.n[0].ab === BCK && w.n[0].nb === BCS && w.n[0].reset === true, w.n);
        R.check(`B ${tag}: HP — Max-HP ${x.maxV} + ${HPCS - HPCK}, voll geheilt („fully heal its HP")`, H().maxHp === x.maxV + (HPCS - HPCK) && H().hp === H().maxHp, { hp: H().hp, max: H().maxHp });
        if (tag === 'besiegt') R.check('B besiegt: Todesmarken abgeräumt, Held lebt', H().hp > 0 && H().diedOnTurn == null && !H()._koProcessed, { died: H().diedOnTurn, ko: H()._koProcessed });
        x.nach = snap(H()); await folge(R, t, me, op, H, e, soll, `B ${tag}`);
      }
      R.check('B Differenzprobe: besiegter Held == lebender Held mit demselben Bestand (gleiche ATK-Buchführung, gleiche Max-HP)', (gleich(kontrolle.nach, tot.nach) && kontrolle.nach.maxHp === tot.nach.maxHp), { kontrolle: kontrolle.nach, besiegt: tot.nach });
    }

    // ═══ (C) „Bloom", the Continent Corruptor — Aufstieg aus der Niederlage durch Paraseed-Gift ═══
    for (const [fname, o] of Object.entries(FALL)) {
      R.section(`(C) Bloom — Sitz ${me} · ${fname}`);
      const lauf = async (tot, oo) => {
        const t = await aufbau(me, BLOOM, [BC], oo); const H = () => t.hero(me, 0);
        const para = t.put(me, 0, 2, 'Paraseed'); para.controller = op; para.turnPlayed = 1;
        await t.run(() => syncAllParaseedPoison(t.engine));
        t.errors.length = 0;
        const vorher = snap(H()); const w = wachter(t);
        if (tot) {
          await t.run(() => t.engine.actionDealDamage({ name: 'Paraseed', owner: op, controller: op }, H(), 5000, 'poison'));
        } else {
          t.gs._bloomAscendReady = { [`bloomAscend:${me}-0`]: t.gs.turn };
          t.gs.activePlayer = me; t.phase(2);
          await t.run(() => t.engine.performAscension(me, 0, BC, t.gs.players[me].hand.indexOf(BC), {}));
          delete t.gs._bloomAscendReady;
        }
        return { t, H, w, vorher };
      };
      const lebend = await lauf(false, o), tot = await lauf(true, o), eT = o;   // der Aufstieg läuft INNERHALB von onHeroKO, vor dem Todes-Aufräumen: Club und Fluch liegen noch
      const kontrolle = lebend;
      for (const [x, tag, e] of [[lebend, 'lebend', o], [tot, 'besiegt', eT]]) {
        const { t, H, w, vorher } = x;
        R.check(`C ${tag}: Aufstieg gelang (${BC}), Aufstiegskarte aus der Hand`, H().name === BC && !t.gs.players[me].hand.includes(BC), { n: H().name });
        const soll = pruefeAtk(R, t, me, H(), BBC, e, `C ${tag}`);
        R.check(`C ${tag}: Differenz stimmt — ATK-Änderung == K × (${BBC} − ${BBL})`, (o.fluch ? H()._cursedAtkSuppressed - vorher.supp : H().atk - vorher.atk) === (e.cyk ? 2 : 1) * (BBC - BBL), { vorher, nachher: snap(H()) });
        R.check(`C ${tag}: onFormChanged genau einmal (ascend, ${BBL} → ${BBC}, baseAtkReset)`, w.n.length === 1 && w.n[0].kind === 'ascend' && w.n[0].alt === BLOOM && w.n[0].neu === BC && w.n[0].ab === BBL && w.n[0].nb === BBC && w.n[0].reset === true, w.n);
        R.check(`C ${tag}: HP und Max-HP == 500 (Kartentext)`, H().hp === 500 && H().maxHp === 500, { hp: H().hp, max: H().maxHp });
        if (tag === 'besiegt') R.check('C besiegt: Todesmarken abgeräumt, Held lebt', H().hp > 0 && H().diedOnTurn == null && !H()._koProcessed, { died: H().diedOnTurn, ko: H()._koProcessed });
        x.nach = snap(H()); await folge(R, t, me, op, H, e, soll, `C ${tag}`);
      }
      R.check('C Differenzprobe: besiegter Held == lebender Held mit demselben Bestand (gleiche ATK-Buchführung)', gleich(kontrolle.nach, tot.nach) , { kontrolle: kontrolle.nach, besiegt: tot.nach });
    }
  }

  // ═══ (D) Randbefund aus W56a, in W57a behoben (jetzt Prüfung): Tod eines VERFLUCHTEN Helden mit ATK-Ausrüstung ═══
  // `handleHeroDeathCleanup` leert `hero.statuses` zuerst; die danach ablaufende Ausrüstung bucht ihren Abzug dadurch auf die sichtbare ATK (0) statt auf den Fluch-Zwischenspeicher, und die
  // Rückgabe des Zwischenspeichers (Curse-Abgang) stellt den alten Gesamtwert samt Club wieder her. Der besiegte Held trägt dann +30 ATK ohne Club. Ein Formwechsel räumt das auf (Neuberechnung
  // aus dem, was liegt — dieser Repro, (A)); ohne Formwechsel bleibt der Überhang bis zu einer Wiederbelebung stehen.
  R.section('(D) Randbefund (W57a behoben): verfluchter Held mit Club stirbt');
  {
    const me = 0;
    const t = await aufbau(me, RIF, [], { club: 1, fluch: 1 });
    await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: 1, heroIdx: 0 }, t.hero(me, 0), {}));
    const atk = t.hero(me, 0).atk, soll = DB[RIF].atk;
    R.check('verfluchter Held mit Club: ATK nach dem Tod == gedruckter Wert (W57a: Fluch wird VOR dem Ablegen der Ausrüstung aufgelöst, kein Überhang)', atk === soll, { atk, soll });
  }
  R.finish();
})();

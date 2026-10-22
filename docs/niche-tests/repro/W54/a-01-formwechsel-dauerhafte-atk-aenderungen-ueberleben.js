'use strict';
// W54a · Punkt 1 (Al, 22.10.2026): „Nein, auch PERMANENTE Änderungen sollen den Formwechsel (Aufstieg/Abstieg) überleben."
//   Vorher (W53a): `performAscension`/`performDescend` setzten `hero.atk` auf den gedruckten Wert der neuen Form; die Boni der Karten, die am Helden bleiben (Ausrüstung, Fighting), wurden wieder aufgeschlagen,
//   DAUERHAFTE Zuwächse ohne Karte (Cloak of Edge, Nero Zira, Rakah, Mirjam, Chaorc Pyre Grill Master, Wavilion) gingen verloren.
//   Jetzt: neuer ATK = neuer gedruckter Grundwert + ALLE fortbestehenden Buchungen (Equips mit Stempel, Fighting, dauerhafte Zuwächse `hero.permAtkDelta`, befristete Gaben `_tempAtkGrants`).
//   Form-gebundene Boni der ALTEN Form (Taio, Toras, Lizbeth, Aura-Anteil) fallen mit der Form weg. Dauerhafte Änderungen laufen über `engine.actionPermAtk` (Buchführung `hero.permAtkDelta`).
// Geprüft (beide Sitze): je Quelle (Cloak of Edge · Nero Zira · Rakah · Mirjam · Chaorc Pyre Grill Master · Wavilion): Zuwachs → Aufstieg → Abstieg → zweiter Aufstieg → neuer Zuwachs nach dem Wechsel →
//   Abstieg; Gegenprobe Held ohne Zuwachs; Mischung mit Fighting/Club/befristeter Gabe (und deren späterer Abgang); Fluch; ATK-Aura (Rioting Village); Form ohne ATK-Angabe (Styx); Max-HP-Zuwächse überleben (Befund).
// Auf dem Stand vor W54a rot (der Zuwachs fehlt nach dem Wechsel). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel';
const CLOAK = 'Cloak of Edge', NERO = 'Nero Zira, the Mastermind', RAKAH = 'Rakah, the Loan Shark', MIRJAM = 'Mirjam, the Fallen Cute Angel', CHAORC = 'Chaorc Pyre Grill Master', WAVI = 'Wavilion';
const BLANK = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];

/** Die sechs Quellen dauerhafter ATK-Änderungen. `bau` stellt die Szene, `gewinn` löst den ECHTEN Zuwachs aus (liefert nichts), `G` ist der Betrag. */
const QUELLEN = {
  [CLOAK]: { traeger: RIF, G: 20,
    bau: async (t, me) => { await U.lege(t, me, CLOAK, 0); },
    gewinn: async (t, me) => { t.gs.hoptUsed = {}; const i = t.find(CLOAK, 'support'); await t.activateEquip(me, 0, i.zoneSlot, {}); } },
  [NERO]: { traeger: NERO, G: 30, heldenPassiv: true, bau: async () => {},
    gewinn: async (t, me) => { t.gs.hoptUsed = {}; const slot = t.gs.players[me].supportZones[0].findIndex(z => z.length === 0); await t.play(me, 'ZZ Dummy', { hero: 0, slot }); } },
  [RAKAH]: { traeger: RAKAH, G: 10, heldenPassiv: true, bau: async () => {},
    gewinn: async (t, me) => { const slot = t.gs.players[me].supportZones[0].findIndex(z => z.length === 0); const k = t.put(me, 0, slot, 'ZZ Dummy Frail'); k.turnPlayed = 0;
      await t.run(() => t.engine.opfereKreatur(k, { name: 'Test', owner: me, heroIdx: 0 }, { animation: false })); } },
  [MIRJAM]: { traeger: MIRJAM, G: 50, heldenPassiv: true, bau: async () => {},
    gewinn: async (t, me) => { await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 - me, heroIdx: 0 }, t.hero(me, 0), 50, 'fire')); } },
  [CHAORC]: { traeger: RIF, G: 40,
    bau: async (t, me) => { const c = t.put(me, 1, 0, CHAORC); c.turnPlayed = 1; },
    gewinn: async (t, me) => { t.gs.hoptUsed = {}; const slot = t.gs.players[me].supportZones[1].findIndex(z => z.length === 0); const k = t.put(me, 1, slot, 'ZZ Dummy'); k.turnPlayed = 1;
      t.gs.currentPhase = 2; t.gs.activePlayer = me; t.policy.confirm = true;
      await t.activateCreature(me, 1, 0); } },
  [WAVI]: { traeger: RIF, G: 100,
    bau: async (t, me) => { const w = t.put(me, 0, 2, WAVI); w.turnPlayed = 0; },
    gewinn: async (t, me) => { t.hero(1 - me, 0).hp = 30; await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: me, heroIdx: 0 }, t.hero(1 - me, 0), 100, 'attack')); t.hero(1 - me, 0).hp = 800; } },
};

async function szene(me, name, q, extraHand = []) {
  const op = 1 - me;
  const heroes = { [me]: [q.traeger, ...BLANK], [op]: [RIF, ...BLANK] };
  if (name === CHAORC) heroes[me] = [q.traeger, BLANK[0], BLANK[1]];
  const t = await U.fresh(me, { hand: [ASC, ...extraHand], heroes });
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === CHAORC, answer: () => ({ optionId: 'atk' }) });
  t.gs.turn = Math.max(t.gs.turn || 0, 3);
  await q.bau(t, me);
  return t;
}
const aufsteigen = (t, me, h = 0) => { if (!t.gs.players[me].hand.includes(ASC)) t.addHand(me, ASC); t.gs.activePlayer = me; t.phase(2);
  return t.run(() => t.engine.performAscension(me, h, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true })); };
const absteigen = (t, me, h = 0) => t.run(() => t.engine.performDescend(me, h, {}));

(async () => {
  const R = U.H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me}`);
    const DB = U.H.DB;

    // ═══ (A) Je Quelle: Zuwachs überlebt Aufstieg, Abstieg, zweiten Aufstieg und einen weiteren Zuwachs nach dem Wechsel ═══
    for (const [name, q] of Object.entries(QUELLEN)) {
      const t = await szene(me, name, q);
      const H = () => t.hero(me, 0);
      const basis0 = H().name;
      const a0 = H().atk;
      await q.gewinn(t, me);
      const gewinn = H().atk - a0;
      R.check(`${name}: der echte Zuwachs wirkt (+${q.G}) und steht in der Buchführung permAtkDelta`, gewinn === q.G && (H().permAtkDelta || 0) === q.G && t.errors.length === 0, { gewinn, perm: H().permAtkDelta, e: t.errors.slice(0, 2) });
      const G1 = q.G;   // Sollwert (nicht die Buchführung selbst lesen — sie ist ja Teil der Prüfung)

      let r = await aufsteigen(t, me);
      R.check(`${name}: Aufstieg gelingt`, r && r.success === true && H().name === ASC, { r, n: H().name });
      R.check(`${name}: nach dem Aufstieg ATK == gedruckter ATK der neuen Form (${DB[ASC].atk}) + dauerhafter Zuwachs (${G1})`, H().atk === DB[ASC].atk + G1, { atk: H().atk, soll: DB[ASC].atk + G1 });
      R.check(`${name}: Buchführung nach dem Aufstieg unverändert`, (H().permAtkDelta || 0) === G1, H().permAtkDelta);

      r = await absteigen(t, me);
      R.check(`${name}: Abstieg → ${basis0}: ATK == gedruckter ATK der Basisform (${DB[basis0].atk}) + Zuwachs (${G1})`, r && r.success !== false && H().name === basis0 && H().atk === DB[basis0].atk + G1, { r, n: H().name, atk: H().atk, soll: DB[basis0].atk + G1 });

      if (q.heldenPassiv) {
        // Der Zuwachs ist ein Passiv der HELDENKARTE (Nero, Rakah, Mirjam): in der aufgestiegenen Form gibt es ihn nicht (anderer Kartentext) — der weitere Zuwachs kommt in der Basisform.
        await q.gewinn(t, me);
        R.check(`${name}: Zuwachs NACH dem Abstieg (in der Basisform): ATK == gedruckter Wert + 2×Zuwachs`, H().atk === DB[basis0].atk + 2 * q.G && (H().permAtkDelta || 0) === 2 * q.G, { atk: H().atk, soll: DB[basis0].atk + 2 * q.G, perm: H().permAtkDelta });
        r = await aufsteigen(t, me);
        R.check(`${name}: zweiter Aufstieg: ATK == gedruckt + 2×Zuwachs, nicht doppelt`, r && r.success === true && H().atk === DB[ASC].atk + 2 * q.G, { atk: H().atk, soll: DB[ASC].atk + 2 * q.G });
      } else {
        r = await aufsteigen(t, me);
        R.check(`${name}: zweiter Aufstieg (Aufstieg → Abstieg → Aufstieg): ATK == gedruckt + Zuwachs, nicht doppelt`, r && r.success === true && H().atk === DB[ASC].atk + G1 && (H().permAtkDelta || 0) === G1, { atk: H().atk, soll: DB[ASC].atk + G1, perm: H().permAtkDelta });
        await q.gewinn(t, me);
        R.check(`${name}: Zuwachs NACH dem Wechsel: +${q.G} auf die neue Form (ATK == gedruckt + 2×Zuwachs)`, H().atk === DB[ASC].atk + 2 * q.G && (H().permAtkDelta || 0) === 2 * q.G, { atk: H().atk, soll: DB[ASC].atk + 2 * q.G, perm: H().permAtkDelta });
      }
      await absteigen(t, me);
      R.check(`${name}: letzter Abstieg: ATK == gedruckter Wert der Basisform + beide Zuwächse`, H().name === basis0 && H().atk === DB[basis0].atk + 2 * q.G, { n: H().name, atk: H().atk, soll: DB[basis0].atk + 2 * q.G });
      R.check(`${name}: sauber (keine Fehler, Zustand ok)`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }

    // ═══ (B) Gegenprobe: Held OHNE Zuwachs — genau der gedruckte Wert, beide Richtungen, auch zweimal ═══
    { const t = await szene(me, CLOAK, QUELLEN[CLOAK]); const H = () => t.hero(me, 0);
      // Cloak liegt, wurde aber nie aktiviert
      R.check('Gegenprobe: ohne Zuwachs keine Buchführung', !H().permAtkDelta, H().permAtkDelta);
      await aufsteigen(t, me); R.check('Gegenprobe: Aufstieg → genau der gedruckte Wert', H().atk === DB[ASC].atk, H().atk);
      await absteigen(t, me); R.check('Gegenprobe: Abstieg → genau der gedruckte Wert', H().atk === DB[RIF].atk, H().atk);
      await aufsteigen(t, me); R.check('Gegenprobe: zweiter Aufstieg → genau der gedruckte Wert', H().atk === DB[ASC].atk, H().atk); }
    // Der Zuwachs eines ANDEREN Helden bleibt, wo er ist
    { const t = await szene(me, NERO, QUELLEN[NERO]); t.setHero(me, 1, RIF, 800); const a1 = t.hero(me, 1).atk;
      await QUELLEN[NERO].gewinn(t, me); await aufsteigen(t, me, 0);
      R.check('Held 1 ohne Zuwachs bleibt unberührt; Held 0 hat seinen Zuwachs', t.hero(me, 1).atk === a1 && !t.hero(me, 1).permAtkDelta && t.hero(me, 0).atk === DB[ASC].atk + 30, { a1: t.hero(me, 1).atk, a0: t.hero(me, 0).atk }); }

    // ═══ (C) Mischung: dauerhafter Zuwachs + Fighting + Club + befristete Gabe überleben gemeinsam; ihr späterer Abgang zieht genau ihren Teil ab ═══
    { const t = await szene(me, NERO, QUELLEN[NERO], ['Club of Gobbo']); const H = () => t.hero(me, 0);
      await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0 });
      await U.lege(t, me, 'Club of Gobbo', 0);
      await QUELLEN[NERO].gewinn(t, me);
      t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: op, source: 'Test' });
      const fight = () => t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
      R.check('Mischung: Ausgang — Grundwert + Fighting + Club (30) + Nero (30) + Gabe (100)', H().atk === DB[NERO].atk + fight() + 30 + 30 + 100 && fight() >= 10, { atk: H().atk, fight: fight() });
      await aufsteigen(t, me);
      const soll = DB[ASC].atk + fight() + 30 + 30 + 100;
      R.check('Mischung: nach dem Aufstieg Grundwert + Fighting + Club + Nero + befristete Gabe — nichts fehlt, nichts doppelt', H().atk === soll, { atk: H().atk, soll });
      t.gs.turn += 1; t.gs.activePlayer = op;
      await t.run(() => t.engine._processBuffExpiry({}));
      R.check('Mischung: die befristete Gabe läuft aus → genau 100 weniger (nicht unter dem Rest)', H().atk === soll - 100, { atk: H().atk, soll: soll - 100 });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Club of Gobbo', 'support'), {}));
      for (const f of t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me)) await t.run(() => t.engine.actionMoveCard(f, 'discard', -1, -1, { source: 'T', sourceOwner: op }));
      R.check('Mischung: Club zerstört, Fighting abgelegt → es bleibt gedruckter Wert + dauerhafter Zuwachs (Nero +30)', H().atk === DB[ASC].atk + 30 && t.errors.length === 0, { atk: H().atk, soll: DB[ASC].atk + 30, e: t.errors }); }

    // ═══ (D) Fluch: ATK bleibt 0 (Kartentext), der Zuwachs liegt im Zwischenspeicher und kommt beim Reinigen zurück ═══
    { const t = await szene(me, NERO, QUELLEN[NERO], ['Curse']); const H = () => t.hero(me, 0);
      await QUELLEN[NERO].gewinn(t, me);
      await U.haenge(t, me, 'Curse', 0);
      R.check('Fluch: ATK 0, Zuwachs im Zwischenspeicher', H().atk === 0 && H()._cursedAtkSuppressed === DB[NERO].atk + 30, { atk: H().atk, z: H()._cursedAtkSuppressed });
      await aufsteigen(t, me);
      R.check('Fluch + Aufstieg: sichtbare ATK bleibt 0 ("Attack stat is always 0"), Zwischenspeicher == neuer Grundwert + Zuwachs', H().atk === 0 && H()._cursedAtkSuppressed === DB[ASC].atk + 30, { atk: H().atk, z: H()._cursedAtkSuppressed });
      const cu = t.find('Curse', 'support'); await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, cu, {}));
      R.check('Fluch geheilt: ATK == gedruckter Wert der neuen Form + Zuwachs (nicht doppelt)', H().atk === DB[ASC].atk + 30 && !H().statuses.cursed, { atk: H().atk, st: Object.keys(H().statuses) }); }

    // ═══ (E) ATK-Aura (Rioting Village, ×2): der Zuwachs bleibt im Grundwert, die Aura rechnet auf den NEUEN Grundwert ═══
    { const t = await szene(me, NERO, QUELLEN[NERO]); const H = () => t.hero(me, 0);
      await QUELLEN[NERO].gewinn(t, me);
      t.putArea(me, 'Rioting Village'); t.engine.syncAlleAtkAuren();
      const vorher = H().atk;
      R.check('Aura: Ausgang — (Grundwert + Zuwachs) × 2', vorher === (DB[NERO].atk + 30) * 2, { vorher });
      await aufsteigen(t, me);
      R.check('Aura: nach dem Aufstieg (neuer Grundwert + Zuwachs) × 2 — Aura nicht doppelt, Zuwachs nicht verdoppelt verloren', H().atk === (DB[ASC].atk + 30) * 2, { atk: H().atk, soll: (DB[ASC].atk + 30) * 2 });
      await absteigen(t, me);
      R.check('Aura: Abstieg: (Grundwert der Basisform + Zuwachs) × 2', H().atk === (DB[NERO].atk + 30) * 2, { atk: H().atk }); }

    // ═══ (F) Form OHNE ATK-Angabe (Styx, „stats equal to its base Hero's stats"): ATK unverändert, nichts doppelt gebucht ═══
    { const STYX = 'Styx, the Gate to the Spirit World', OPEN = 'Styx, the Opened Gate';
      const t = await U.fresh(me, { hand: [OPEN, 'Club of Gobbo'], heroes: { [me]: [STYX, ...BLANK] } }); const H = () => t.hero(me, 0);
      await U.lege(t, me, 'Club of Gobbo', 0);
      const a0 = H().atk;
      t.gs.activePlayer = me; t.phase(2);
      const r = await t.run(() => t.engine.performAscension(me, 0, OPEN, t.gs.players[me].hand.indexOf(OPEN), { cheat: true }));
      R.check('Styx: Aufstieg gelingt', r && r.success === true && H().name === OPEN, r);
      R.check('Styx (keine ATK-Angabe): ATK bleibt EXAKT wie vorher — Club nicht ein zweites Mal aufgeschlagen', H().atk === a0, { a0, atk: H().atk }); }

    // ═══ (G) Max-HP / HP (Befund, kein Fehler): dauerhafte Max-HP-Zuwächse überleben den Formwechsel schon — die Engine rechnet den gedruckten HP-Unterschied auf den aktuellen Wert ═══
    { const t = await szene(me, CHAORC, QUELLEN[CHAORC]); const H = () => t.hero(me, 0);
      t.engine.increaseMaxHp(H(), 80, { alsoHealCurrent: true }); t.engine.increaseMaxHp(H(), 150, { alsoHealCurrent: true });   // Chaorc-HP-Zweig / Life Serum
      const mx = H().maxHp, hp = H().hp;
      await aufsteigen(t, me);
      const dHP = DB[ASC].hp - DB[RIF].hp;
      R.check('HP-Befund: Aufstieg → maxHp und HP == alter Wert + gedruckter Unterschied (Zuwächse bleiben)', H().maxHp === mx + dHP && H().hp === hp + dHP, { maxHp: H().maxHp, hp: H().hp, soll: mx + dHP });
      await absteigen(t, me);
      R.check('HP-Befund: Abstieg → wieder der alte Wert (Zuwächse bleiben)', H().maxHp === mx && H().hp === hp, { maxHp: H().maxHp, hp: H().hp, soll: mx }); }
  }
  R.finish();
})();

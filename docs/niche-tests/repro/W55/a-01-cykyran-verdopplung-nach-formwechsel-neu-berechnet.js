'use strict';
// W55a · Punkt 1 (Al, 22.10.2026: „Die Verdopplung muss neu berechnet werden!"): Cykyran War Counselor — „While you control at least 3 different "War Counselor" Creatures, your Heroes' Base Attack
//   stats are doubled." Nach einem Formwechsel (Aufstieg `performAscension` / Abstieg `performDescend`) gilt der GEDRUCKTE ATK der neuen Form; die Verdopplung gehörte zur alten Basis und war erloschen,
//   die Buchung `hero._cykyranBonus` blieb mit dem alten Betrag stehen (Befund aus W54a: 40 → 80, nach dem Aufstieg 90 statt 180, nach dem nächsten Zugbeginn 100).
//   Jetzt: neuer Engine-Hook `onFormChanged` (direkt nach der Zustandsübertragung) + Formwechsel-Zähler `hero._formGen` (verwaiste Buchung zählt als 0) → ATK = 2 × neue Basis + überlebende Boni.
// Geprüft (beide Sitze): Grundverlauf Aufstieg → Zugumlauf → Abstieg → zweiter Aufstieg (Held mit Verdopplung, 2 × neue Basis); Boni (Equip, Fighting, dauerhafter Zuwachs `permAtkDelta`, befristete Gabe)
//   werden NICHT verdoppelt und überleben; Bedingung fällt weg / kommt dazu (vor und nach dem Wechsel, Cykyran selbst geht, nur 2 verschiedene = Gegenprobe); Cykyran eingefroren; Fluch vor/nach dem Wechsel;
//   mehrere Helden; besiegt/wiederbelebt; Teleportation Powder (Rückkehr = Zustand exakt wie vorher); Gegner-Seite und übernommener Held („your Heroes" = Kontrolle); Hook-Nutzlast (genau ein
//   `onFormChanged` je Wechsel); Form ohne ATK-Angabe (Styx: Wert unverändert, nichts doppelt).
// Auf dem Stand vor W55a rot (Verdopplung fehlt/falsch nach dem Wechsel). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel';
const CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', CEN = 'Censpartan War Counselor', HARP = 'Harpthenean War Counselor';
const TP = 'Teleportation Powder';
const TUSHU = 'Tushu, the Knowledge Keeper', ZWEI = 'Zwei, the Lucky Thief';

/**
 * Szene für Sitz `me`: Held 0 und Held 1 = Riffel (Basis 40 / aufgestiegen 90), Held 2 = Platzhalter trägt die Ratgeber (Zonen 0–2).
 * `rat`: welche Ratgeber über den echten Spielweg gelegt werden. `hand`: weitere Handkarten (Aufstiegskarte liegt immer 2× auf der Hand).
 */
async function szene(me, { rat = [CYK, GOR, CEN], hand = [], heroes } = {}) {
  const t = await U.fresh(me, { hand: [ASC, ASC, ...rat, ...hand], heroes: { [me]: heroes || [RIF, RIF, TUSHU], [1 - me]: [RIF, TUSHU, ZWEI] } });
  t.gs.turn = Math.max(t.gs.turn || 0, 3);
  let slot = 0;
  for (const r of rat) await t.play(me, r, { hero: 2, slot: slot++, active: me });
  t.errors.length = 0;
  return t;
}
const aufsteigen = (t, me, h = 0, o = {}) => { if (t.gs.players[me].hand.indexOf(ASC) < 0) t.addHand(me, ASC); t.gs.activePlayer = me; t.phase(2);
  return t.run(() => t.engine.performAscension(me, h, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true, ...o })); };
const absteigen = (t, me, h = 0, o = {}) => { t.gs.activePlayer = me; return t.run(() => t.engine.performDescend(me, h, o)); };
const wachter = (t) => { const w = { n: [] }; const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => { if (n === 'onFormChanged') w.n.push({ kind: c.kind, alt: c.oldHeroName, neu: c.newHeroName, ab: c.oldBaseAtk, nb: c.newBaseAtk, reset: c.baseAtkReset, owner: c.heroOwner, idx: c.heroIdx, ctrl: c.controllerIdx, hero: c.hero }); return orig(n, c); };
  return w; };
const umlauf = async (t) => { await t.endTurn(); await t.endTurn(); };

(async () => {
  const R = U.H.runner();
  const DB = U.H.DB;
  const B0 = DB[RIF].atk, B1 = DB[ASC].atk;   // 40 / 90
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me}`);
    const H0 = (t) => t.hero(me, 0), H1 = (t) => t.hero(me, 1);

    // ═══ (A) Grundverlauf: Verdopplung wird mit dem Formwechsel auf die NEUE Basis umgerechnet ═══
    { const t = await szene(me); const H = () => H0(t); const w = wachter(t);
      R.check('A Ausgang: Basis-ATK verdoppelt (2 × 40)', H().atk === 2 * B0 && H().baseAtk === 2 * B0 && H()._cykyranBonus === B0, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      let r = await aufsteigen(t, me);
      R.check('A Aufstieg gelingt', r && r.success === true && H().name === ASC, r);
      R.check(`A nach dem Aufstieg ATK == 2 × neue Basis (${2 * B1}), nicht ${B1}`, H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      R.check('A der andere Held (Held 1, Riffel Basis) bleibt bei 2 × 40', H1(t).atk === 2 * B0 && H1(t)._cykyranBonus === B0, { atk: H1(t).atk });
      await umlauf(t);
      R.check(`A nach einem Zugumlauf unverändert ${2 * B1} (vorher: 100)`, H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      r = await absteigen(t, me);
      R.check(`A Abstieg → Basisform: ATK == 2 × ${B0}`, r && r.success !== false && H().name === RIF && H().atk === 2 * B0 && H().baseAtk === 2 * B0 && H()._cykyranBonus === B0, { r, n: H().name, atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      r = await aufsteigen(t, me);
      R.check(`A zweiter Aufstieg: wieder ${2 * B1}, nicht ${4 * B1}`, r && r.success === true && H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      await umlauf(t);
      await absteigen(t, me); await umlauf(t);
      R.check('A letzter Abstieg + Zugumlauf: 2 × 40', H().atk === 2 * B0 && H().baseAtk === 2 * B0, { atk: H().atk });
      R.check('A Hook-Nutzlast: genau ein onFormChanged je Wechsel (ascend, descend, ascend, descend), mit gedruckten Werten', w.n.length === 4
        && w.n.map(x => x.kind).join() === 'ascend,descend,ascend,descend'
        && w.n[0].alt === RIF && w.n[0].neu === ASC && w.n[0].ab === B0 && w.n[0].nb === B1 && w.n[0].reset === true && w.n[0].owner === me && w.n[0].idx === 0 && w.n[0].ctrl === me && w.n[0].hero === H()
        && w.n[1].alt === ASC && w.n[1].neu === RIF && w.n[1].ab === B1 && w.n[1].nb === B0, w.n.map(x => ({ ...x, hero: !!x.hero })));
      R.check('A sauber (keine Fehler, Zustand ok)', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) }); }

    // ═══ (B) Boni werden NICHT verdoppelt (nur die Basis) und überleben: Equip, Fighting, dauerhafter Zuwachs (permAtkDelta), befristete Gabe ═══
    { const t = await szene(me, { hand: ['Club of Gobbo'] }); const H = () => H0(t);
      await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0 });
      await U.lege(t, me, 'Club of Gobbo', 0);
      t.engine.actionPermAtk(H(), me, 0, 25, 'Test');
      t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: op, source: 'Test' });
      const fight = () => t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
      const boni = () => fight() + 30 + 25 + 100;
      R.check('B Ausgang: 2 × 40 + Fighting + Club (30) + Zuwachs (25) + Gabe (100) — Boni nicht verdoppelt', fight() >= 10 && H().atk === 2 * B0 + boni() && H().baseAtk === 2 * B0 && H().permAtkDelta === 25, { atk: H().atk, fight: fight(), base: H().baseAtk });
      await aufsteigen(t, me);
      R.check(`B Aufstieg: 2 × ${B1} + alle Boni (je einmal) — keine Doppelung, nichts fehlt`, H().atk === 2 * B1 + boni() && H().baseAtk === 2 * B1 && H().permAtkDelta === 25 && H()._cykyranBonus === B1, { atk: H().atk, soll: 2 * B1 + boni(), base: H().baseAtk, perm: H().permAtkDelta });
      t.gs.turn += 1; t.gs.activePlayer = op;
      await t.run(() => t.engine._processBuffExpiry({}));
      R.check('B befristete Gabe läuft aus → genau 100 weniger (Verdopplung bleibt)', H().atk === 2 * B1 + boni() - 100 && H().baseAtk === 2 * B1, { atk: H().atk, soll: 2 * B1 + boni() - 100 });
      await absteigen(t, me);
      R.check(`B Abstieg: 2 × ${B0} + Fighting + Club + Zuwachs (Gabe ist abgelaufen)`, H().atk === 2 * B0 + fight() + 30 + 25 && H().baseAtk === 2 * B0 && H().permAtkDelta === 25, { atk: H().atk, soll: 2 * B0 + fight() + 55 });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Club of Gobbo', 'support'), {}));
      R.check('B Club zerstört: genau 30 weniger, Verdopplung bleibt', H().atk === 2 * B0 + fight() + 25 && H().baseAtk === 2 * B0, { atk: H().atk });
      t.engine.actionPermAtk(H(), me, 0, 20, 'Test');
      R.check('B weiterer dauerhafter Zuwachs nach dem Wechsel: +20 (nicht verdoppelt), Basis unverändert', H().atk === 2 * B0 + fight() + 45 && H().baseAtk === 2 * B0 && H().permAtkDelta === 45, { atk: H().atk, perm: H().permAtkDelta });
      await aufsteigen(t, me);
      R.check(`B zweiter Aufstieg: 2 × ${B1} + Fighting + 45`, H().atk === 2 * B1 + fight() + 45 && H().baseAtk === 2 * B1, { atk: H().atk, soll: 2 * B1 + fight() + 45 });
      R.check('B sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) }); }

    // ═══ (C) Die Bedingung („mindestens 3 verschiedene War Counselors") ändert sich — vor oder nach dem Wechsel ═══
    { // C1: fällt NACH dem Aufstieg weg, kommt wieder
      const t = await szene(me, { hand: [GOR] }); const H = () => H0(t);
      await aufsteigen(t, me);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(GOR, 'support'), {}));
      R.check(`C1 Gorinthian geht nach dem Aufstieg: Verdopplung weg → ${B1}, Buchung 0`, H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      await t.play(me, GOR, { hero: 2, slot: 1, active: me });
      R.check(`C1 wieder 3 verschiedene → ${2 * B1}`, H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk });
      await absteigen(t, me);
      R.check(`C1 Abstieg bei erfüllter Bedingung → ${2 * B0}`, H().atk === 2 * B0 && H().baseAtk === 2 * B0, { atk: H().atk }); }
    { // C2: fällt VOR dem Aufstieg weg → neue Form ohne Verdopplung; kommt danach dazu
      const t = await szene(me, { hand: [HARP] }); const H = () => H0(t);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CEN, 'support'), {}));
      R.check('C2 Ausgang: nur 2 verschiedene → keine Verdopplung (40)', H().atk === B0 && H().baseAtk === B0, { atk: H().atk });
      await aufsteigen(t, me);
      R.check(`C2 Aufstieg ohne Bedingung: genau ${B1} (keine Verdopplung)`, H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      await t.play(me, HARP, { hero: 2, slot: 2, active: me });
      R.check(`C2 dritter verschiedener Ratgeber kommt dazu → ${2 * B1} (auf die NEUE Basis)`, H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk });
      await absteigen(t, me);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(HARP, 'support'), {}));
      R.check(`C2 Abstieg, danach Bedingung weg → ${B0}`, H().atk === B0 && H().baseAtk === B0 && !H()._cykyranBonus, { atk: H().atk }); }
    { // C3: Cykyran selbst geht nach dem Aufstieg
      const t = await szene(me); const H = () => H0(t);
      await aufsteigen(t, me);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CYK, 'support'), {}));
      R.check(`C3 Cykyran weg nach dem Aufstieg: ${B1} (Verdopplung genau einmal zurückgenommen)`, H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      await umlauf(t);
      R.check('C3 auch nach einem Zugumlauf', H().atk === B1 && H().baseAtk === B1, { atk: H().atk });
      await absteigen(t, me);
      R.check(`C3 Abstieg ohne Cykyran: ${B0}`, H().atk === B0 && H().baseAtk === B0, { atk: H().atk }); }
    { // C4: Gegenprobe — nur 2 verschiedene Ratgeber (CYK + GOR): nie eine Verdopplung, auch nicht nach Wechseln
      const t = await szene(me, { rat: [CYK, GOR] }); const H = () => H0(t); const w = wachter(t);
      await aufsteigen(t, me); await umlauf(t);
      R.check(`C4 Gegenprobe: Aufstieg ohne Bedingung → ${B1}`, H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk });
      await absteigen(t, me); await aufsteigen(t, me); await absteigen(t, me); await umlauf(t);
      R.check(`C4 Gegenprobe: Abstieg/Aufstieg/Abstieg → ${B0}`, H().atk === B0 && H().baseAtk === B0 && !H()._cykyranBonus, { atk: H().atk });
      R.check('C4 der Hook feuert trotzdem bei jedem Wechsel (4×), ändert aber nichts', w.n.length === 4, w.n.length); }
    { // C5: zwei Kopien desselben Ratgebers zählen nicht doppelt (Gegenprobe der Bedingung, mit Formwechsel)
      const t = await szene(me, { rat: [CYK, GOR], hand: [GOR] }); const H = () => H0(t);
      await t.play(me, GOR, { hero: 2, slot: 2, active: me });
      await aufsteigen(t, me);
      R.check(`C5 zwei Gorinthian + Cykyran sind nur 2 verschiedene → ${B1}`, H().atk === B1 && !H()._cykyranBonus, { atk: H().atk }); }
    { // C6: Cykyran eingefroren: keine Verdopplung, auch nicht nach dem Wechsel; taut er auf, gilt sie auf die neue Basis
      const t = await szene(me); const H = () => H0(t);
      const cyk = t.find(CYK, 'support');
      await t.run(() => t.engine.applyCreatureStatus(cyk, 'frozen', { duration: 1, sourceOwner: op, source: 'repro' }));
      R.check(`C6 eingefroren: ${B0}`, H().atk === B0 && !H()._cykyranBonus, { atk: H().atk });
      await aufsteigen(t, me);
      R.check(`C6 eingefroren + Aufstieg: ${B1}`, H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk, base: H().baseAtk });
      for (let i = 0; i < 4 && cyk.counters.frozen; i++) await umlauf(t);
      R.check(`C6 aufgetaut: ${2 * B1} (neue Basis verdoppelt)`, !cyk.counters.frozen && H().atk === 2 * B1 && H().baseAtk === 2 * B1, { frozen: cyk.counters.frozen, atk: H().atk }); }

    // ═══ (D) Fluch vor / nach dem Wechsel ═══
    { const t = await szene(me, { hand: ['Curse'] }); const H = () => H0(t);
      await U.haenge(t, me, 'Curse', 0);
      R.check('D Fluch: sichtbare ATK 0, Zwischenspeicher 2 × 40', H().atk === 0 && H()._cursedAtkSuppressed === 2 * B0, { atk: H().atk, z: H()._cursedAtkSuppressed });
      await aufsteigen(t, me);
      R.check(`D Fluch + Aufstieg: sichtbar 0, Zwischenspeicher == 2 × ${B1}`, H().atk === 0 && H()._cursedAtkSuppressed === 2 * B1 && H().baseAtk === 2 * B1, { atk: H().atk, z: H()._cursedAtkSuppressed, base: H().baseAtk });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      R.check(`D Fluch geheilt: ATK == 2 × ${B1} (nicht doppelt gutgeschrieben)`, H().atk === 2 * B1 && !H().statuses.cursed && !H()._cursedAtkSuppressed, { atk: H().atk, z: H()._cursedAtkSuppressed });
      await absteigen(t, me);
      R.check(`D Abstieg nach dem Heilen: 2 × ${B0}`, H().atk === 2 * B0, { atk: H().atk }); }
    { const t = await szene(me, { hand: ['Curse'] }); const H = () => H0(t);
      await aufsteigen(t, me);
      await U.haenge(t, me, 'Curse', 0);
      R.check(`D2 erst Aufstieg, dann Fluch: sichtbar 0, Zwischenspeicher 2 × ${B1}`, H().atk === 0 && H()._cursedAtkSuppressed === 2 * B1, { atk: H().atk, z: H()._cursedAtkSuppressed });
      await absteigen(t, me);
      R.check(`D2 Abstieg unter Fluch: sichtbar 0, Zwischenspeicher == 2 × ${B0}`, H().atk === 0 && H()._cursedAtkSuppressed === 2 * B0 && H().baseAtk === 2 * B0, { atk: H().atk, z: H()._cursedAtkSuppressed, base: H().baseAtk });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      R.check(`D2 Fluch geheilt: 2 × ${B0}`, H().atk === 2 * B0 && !H()._cursedAtkSuppressed, { atk: H().atk, z: H()._cursedAtkSuppressed }); }

    // ═══ (E) Mehrere Helden der eigenen Seite wechseln die Form ═══
    { const t = await szene(me); const w = wachter(t);
      await aufsteigen(t, me, 0);
      R.check(`E Held 0 aufgestiegen (${2 * B1}), Held 1 unberührt (${2 * B0})`, H0(t).atk === 2 * B1 && H1(t).atk === 2 * B0 && H1(t)._cykyranBonus === B0, { a0: H0(t).atk, a1: H1(t).atk });
      await aufsteigen(t, me, 1);
      R.check(`E beide aufgestiegen: je ${2 * B1}`, H0(t).atk === 2 * B1 && H1(t).atk === 2 * B1 && H0(t)._cykyranBonus === B1 && H1(t)._cykyranBonus === B1, { a0: H0(t).atk, a1: H1(t).atk });
      await absteigen(t, me, 0);
      R.check(`E Held 0 steigt ab (${2 * B0}), Held 1 bleibt ${2 * B1}`, H0(t).atk === 2 * B0 && H1(t).atk === 2 * B1, { a0: H0(t).atk, a1: H1(t).atk });
      await umlauf(t);
      R.check('E nach einem Zugumlauf unverändert', H0(t).atk === 2 * B0 && H1(t).atk === 2 * B1, { a0: H0(t).atk, a1: H1(t).atk });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CEN, 'support'), {}));
      R.check(`E Bedingung weg: beide ohne Verdopplung (${B0} / ${B1})`, H0(t).atk === B0 && H1(t).atk === B1, { a0: H0(t).atk, a1: H1(t).atk });
      R.check('E Hook: je Held ein Wechsel (ascend 0, ascend 1, descend 0) mit richtigem Held-Index', w.n.length === 3 && w.n.map(x => x.idx).join() === '0,1,0', w.n.map(x => x.idx)); }

    // ═══ (F) Held besiegt / wiederbelebt ═══
    { const t = await szene(me); const H = () => H0(t);
      await aufsteigen(t, me);
      await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, H(), {}));
      R.check(`F besiegter Held (aufgestiegen) behält seinen Stand (${2 * B1})`, H().hp === 0 && H().atk === 2 * B1 && H()._cykyranBonus === B1, { hp: H().hp, atk: H().atk });
      await t.run(() => t.engine.actionReviveHero(me, 0, 300, {}));
      R.check(`F wiederbelebt: ${2 * B1}, Zugumlauf ändert nichts`, H().hp > 0 && H().atk === 2 * B1, { hp: H().hp, atk: H().atk });
      await umlauf(t);
      R.check('F nach Zugumlauf', H().atk === 2 * B1 && H().baseAtk === 2 * B1, { atk: H().atk }); }
    { const t = await szene(me); const H = () => H0(t);
      await aufsteigen(t, me);
      await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, H(), {}));
      const r = await absteigen(t, me, 0, { evenIfDefeated: true });
      R.check(`F2 besiegter Held steigt ab (evenIfDefeated): Basis ${2 * B0} gebucht, bleibt besiegt`, r && r.success !== false && H().name === RIF && H().hp === 0 && H().atk === 2 * B0 && H().baseAtk === 2 * B0, { r, hp: H().hp, atk: H().atk, n: H().name });
      await t.run(() => t.engine.actionReviveHero(me, 0, 300, {}));
      await umlauf(t);
      R.check(`F2 wiederbelebt + Zugumlauf: ${2 * B0}`, H().hp > 0 && H().atk === 2 * B0 && H().baseAtk === 2 * B0, { hp: H().hp, atk: H().atk }); }

    // ═══ (G) Teleportation Powder: nach der Rückkehr Zustand EXAKT wie vorher; danach normaler Formwechsel ═══
    { const t = await szene(me); const H = () => H0(t);
      await aufsteigen(t, me);
      const vorher = JSON.stringify({ atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus, by: H()._cykyranBy, gen: H()._cykyranGen, fg: H()._formGen, n: H().name });
      t.addHand(op, TP);
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 0); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); t.reset();
      const r = await t.play(op, TP, { hero: 0, active: op });
      const weg = !t.gs.players[me].heroes[0].name;
      await t.endTurn(); await t.endTurn();
      const danach = JSON.stringify({ atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus, by: H()._cykyranBy, gen: H()._cykyranGen, fg: H()._formGen, n: H().name });
      R.check('G Potion wirkt (Held war weg) und kehrt zurück', weg && !!H().name && t.errors.length === 0, { r: !!r, weg, n: H().name, e: t.errors.slice(0, 2) });
      R.check(`G Rückkehr: Zustand exakt wie vorher (ATK ${2 * B1}, Buchung, Stempel, Zähler)`, vorher === danach && H().atk === 2 * B1, { vorher, danach });
      t.gs.activePlayer = me;
      await absteigen(t, me);
      R.check(`G danach Abstieg: 2 × ${B0}`, H().atk === 2 * B0 && H().baseAtk === 2 * B0, { atk: H().atk });
      R.check('G sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) }); }
    { // G2: Bedingung fällt während der Abwesenheit weg → nach der Rückkehr (Zugbeginn) ohne Verdopplung
      const t = await szene(me); const H = () => H0(t);
      await aufsteigen(t, me);
      t.addHand(op, TP);
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 0); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); t.reset();
      await t.play(op, TP, { hero: 0, active: op });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find(CEN, 'support'), {}));
      await t.endTurn(); await t.endTurn();
      R.check(`G2 Bedingung während der Abwesenheit weg: nach der Rückkehr ${B1} (Verdopplung weg, kein Doppelabzug)`, !!H().name && H().atk === B1 && H().baseAtk === B1 && !H()._cykyranBonus, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus }); }

    // ═══ (H) Gegner-Seite und Kontrolle: „your Heroes" = aktuelle Kontrolle ═══
    { const t = await szene(me); const gh = () => t.hero(op, 0);
      R.check(`H Gegner-Held (Riffel) ohne eigenen Cykyran: ${B0}, keine Buchung`, gh().atk === B0 && !gh()._cykyranBonus, { atk: gh().atk });
      t.gs.players[op].hand.push(ASC);
      t.gs.activePlayer = op; t.phase(2);
      await t.run(() => t.engine.performAscension(op, 0, ASC, t.gs.players[op].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true }));
      R.check(`H Gegner-Held steigt auf: genau ${B1}, keine Verdopplung, Buchung leer`, gh().name === ASC && gh().atk === B1 && gh().baseAtk === B1 && !gh()._cykyranBonus, { n: gh().name, atk: gh().atk, base: gh().baseAtk });
      R.check(`H eigener Held 0 unberührt (${2 * B0})`, H0(t).atk === 2 * B0, { atk: H0(t).atk }); }
    { // H2: übernommener Gegner-Held (permaControlBy) zählt zu „your Heroes": verdoppelt, Formwechsel rechnet neu; Kontrollverlust nimmt die Verdopplung wieder
      const t = await szene(me); const gh = () => t.hero(op, 0);
      gh().permaControlBy = me;
      await t.run(() => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: t.gs.activePlayer }));
      R.check(`H2 übernommener Held (Brettseite ${op}) verdoppelt: 2 × ${B0}`, gh().atk === 2 * B0 && gh()._cykyranBonus === B0 && gh()._cykyranBy === me, { atk: gh().atk, b: gh()._cykyranBonus, by: gh()._cykyranBy });
      t.addHand(me, ASC); t.gs.activePlayer = me; t.phase(2);
      const r = await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true, heroOwner: op }));
      R.check(`H2 übernommener Held steigt auf: 2 × ${B1}`, r && r.success === true && gh().name === ASC && gh().atk === 2 * B1 && gh().baseAtk === 2 * B1 && gh()._cykyranBonus === B1, { r, n: gh().name, atk: gh().atk, base: gh().baseAtk, b: gh()._cykyranBonus });
      delete gh().permaControlBy;
      await t.run(() => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: t.gs.activePlayer }));
      R.check(`H2 Kontrolle endet: Verdopplung weg, der Held steht bei ${B1}`, gh().atk === B1 && gh().baseAtk === B1 && !gh()._cykyranBonus, { atk: gh().atk, base: gh().baseAtk, b: gh()._cykyranBonus });
      R.check('H2 sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) }); }

    // ═══ (I) Form OHNE ATK-Angabe (Styx, the Opened Gate): Grundwert bleibt, die Verdopplung steht weiter, nichts doppelt ═══
    { const STYX = 'Styx, the Gate to the Spirit World', OPEN = 'Styx, the Opened Gate';
      const t = await U.fresh(me, { hand: [OPEN, CYK, GOR, CEN], heroes: { [me]: [STYX, TUSHU, ZWEI] } }); const H = () => t.hero(me, 0);
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      for (const [i, r] of [CYK, GOR, CEN].entries()) await t.play(me, r, { hero: 1, slot: i, active: me });
      const a0 = H().atk, b0 = H().baseAtk;
      R.check('I Ausgang: Styx verdoppelt (Basis > 0)', b0 > 0 && a0 === b0 && H()._cykyranBonus === b0 / 2, { a0, b0, bonus: H()._cykyranBonus });
      const w = wachter(t);
      t.gs.activePlayer = me; t.phase(2);
      const r = await t.run(() => t.engine.performAscension(me, 0, OPEN, t.gs.players[me].hand.indexOf(OPEN), { cheat: true }));
      R.check('I Styx steigt auf', r && r.success === true && H().name === OPEN, r);
      R.check('I Form ohne ATK-Angabe: ATK, Basis und Verdopplung EXAKT wie vorher', H().atk === a0 && H().baseAtk === b0 && H()._cykyranBonus === b0 / 2, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      await umlauf(t);
      R.check('I nach einem Zugumlauf weiter unverändert', H().atk === a0 && H().baseAtk === b0, { atk: H().atk, base: H().baseAtk });
      R.check('I Hook meldet baseAtkReset: false und unveränderte Werte', w.n.length === 1 && w.n[0].reset === false && w.n[0].nb === w.n[0].ab, w.n.map(x => ({ ...x, hero: !!x.hero }))); }

    // ═══ (J) Selbstheilung unabhängig vom Hook: ohne den `onFormChanged`-Lauscher bleibt die verwaiste Buchung nicht stehen — der nächste Abgleich (Zugbeginn) rechnet auf die neue Basis ═══
    { const t = await szene(me); const H = () => H0(t);
      const sk = U.H.loadCardEffect(CYK), orig = sk.hooks.onFormChanged;
      sk.hooks.onFormChanged = () => {};
      try {
        await aufsteigen(t, me);
        R.check(`J ohne Hook-Lauscher: nach dem Aufstieg zunächst ${B1} (Verdopplung noch nicht neu gebucht), Buchung veraltet`, H().atk === B1 && H().baseAtk === B1, { atk: H().atk, base: H().baseAtk });
        await umlauf(t);
        R.check(`J nächster Abgleich (Zugbeginn): ${2 * B1}, nicht 100 — die verwaiste Buchung zählt als 0`, H().atk === 2 * B1 && H().baseAtk === 2 * B1 && H()._cykyranBonus === B1, { atk: H().atk, base: H().baseAtk, b: H()._cykyranBonus });
      } finally { sk.hooks.onFormChanged = orig; } }
  }
  R.finish();
})();

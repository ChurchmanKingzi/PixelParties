'use strict';
// W58a · Punkt 2 (Al, 22.10.2026): Rioting Village — „While this Area Spell remains on the board, all Heroes have their Attack stats doubled …"
//   Ruling: „Beim Sterben soll der ATK-Boost erhalten bleiben, aber verschwindet Village oder wird negiert, wird der Bonus von ALLEN Heroes entfernt, lebend wie tot. Da die ATK von toten Heroes
//   ganz normal angezeigt werden, soll es hier keine Differenzierung geben."
//   → tote Helden werden wie lebende behandelt; Sterben ändert die Aura nicht; Area weg/ersetzt/zerstört/gelöscht/auf die Hand → Bonus von ALLEN Helden beider Seiten (lebend wie tot) weg;
//     Area kommt (auch eine zweite: ×4) → ALLE Helden (lebend wie tot, auch frisch eingesetzte und aus der Abwesenheit zurückgekehrte); Wiederbelebung trägt weder Über- noch Unterhang.
//   W57a hatte `_syncHeroAtkAura` auf Besiegte ausgedehnt. Dieser Repro prüft das Ruling vollständig — und fand zwei Lücken, die nur ein Abgleich bei jedem `sync()` schließt:
//   Teleportation Powder (Dorf kam/ging während der Abwesenheit → der Zurückgekehrte stand mit der alten Verdopplung da) und Quetzahuitl (tritt in einen freien Heldenplatz → nicht verdoppelt).
// (N) Erzählung mit festen Zahlen · (F) Differenztest: zwei Szenen A (mit Dorf-Ereignissen) und B (ohne Dorf), gleiche Schritte; A.atk == Faktor × B.atk für ALLE Helden beider Seiten nach JEDEM
//   Schritt (Faktor = 2^Dörfer), Schritte: Ausrüstung, Fluch, Cykyran, Fighting, Zuwachs, befristete Gabe, Aufstieg/Abstieg (auch besiegt), Tod, Wiederbelebung, Zugumlauf, Teleportation Powder ·
//   (Q) Quetzahuitl, Chuck (Aufstieg aus der Niederlage), Teleportation mit Dorf-Wechsel · beide Sitze. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const H = U.H, DB = H.DB;
const VIL = 'Rioting Village', CLUB = 'Club of Gobbo', ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel', TP = 'Teleportation Powder';
const CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', CEN = 'Censpartan War Counselor';
const TUSHU = 'Tushu, the Knowledge Keeper', RICK = 'Rick, the Trigger Happy Undertaker', ZWEI = 'Zwei, the Lucky Thief';
const BASIS = DB[TUSHU].atk;   // 40

const areaAnzahl = (t) => (t.gs.areaZones || []).flat().filter(x => x === VIL).length;
const atk = (t, s, h) => t.hero(s, h).atk;

// ───────── Szene für den Differenztest ─────────
async function mk(me) {
  const hand = ['Ancient Tech Infinite Energy Core', CLUB, 'Curse', CYK, GOR, CEN, 'Fighting', ASC, ASC, VIL, VIL, 'Dark Ocean', 'Heal'];
  const t = await U.fresh(me, { hand, heroes: { [me]: [RIF, RIF, TUSHU], [1 - me]: [RIF, TUSHU, ZWEI] } });
  t.gs.turn = Math.max(t.gs.turn || 0, 3); t.errors.length = 0; t.state = {}; return t;
}
const lebt = (t, s, h) => t.hero(s, h).hp > 0;
function schritte(me) {
  const op = 1 - me;
  return {
    'club+': async t => { if (lebt(t, me, 0) && !t.find(CLUB, 'support')) await U.lege(t, me, CLUB, 0); },
    'club-': async t => { const c = t.find(CLUB, 'support'); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})); },
    'tot': async t => { if (lebt(t, me, 0)) await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, t.hero(me, 0), {})); },
    'leben': async t => { if (!lebt(t, me, 0)) await t.run(() => t.engine.actionReviveHero(me, 0, 100, { source: 'Test' })); },
    'totOp': async t => { if (lebt(t, op, 0)) await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: me, heroIdx: 0 }, t.hero(op, 0), {})); },
    'lebenOp': async t => { if (!lebt(t, op, 0)) await t.run(() => t.engine.actionReviveHero(op, 0, 100, { source: 'Test' })); },
    'fluch+': async t => { if (lebt(t, me, 0) && !t.find('Curse', 'support')) await U.haenge(t, me, 'Curse', 0); },
    'fluch-': async t => { const c = t.find('Curse', 'support'); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})); },
    'cyk+': async t => { if (t.state.cyk) return; t.state.cyk = 1; let s = 0; for (const r of [CYK, GOR, CEN]) await t.play(me, r, { hero: 2, slot: s++, active: me }); },
    'cyk-': async t => { const c = t.find(GOR, 'support'); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})); t.state.cyk = 0; },
    'auf': async t => { const h = t.hero(me, 0); if (h.hp > 0 && h.name === RIF) { t.gs.activePlayer = me; t.phase(2); if (t.gs.players[me].hand.indexOf(ASC) < 0) t.addHand(me, ASC); await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true })); } },
    'ab': async t => { const h = t.hero(me, 0); if (h.hp > 0 && h.name === ASC) { t.gs.activePlayer = me; await t.run(() => t.engine.performDescend(me, 0, {})); } },
    'abTot': async t => { const h = t.hero(me, 0); if (h.hp <= 0 && h.name === ASC) { t.gs.activePlayer = me; await t.run(() => t.engine.performDescend(me, 0, { evenIfDefeated: true })); } },
    'fight': async t => { if (lebt(t, me, 0) && !t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).length) await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0, active: me }); },
    'zuwachs': async t => { t.engine.actionPermAtk(t.hero(me, 0), me, 0, 25, 'Test'); },
    'gabe': async t => { t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: op, source: 'Test' }); },
    'ablauf': async t => { t.gs.turn += 3; t.gs.activePlayer = op; await t.run(() => t.engine._processBuffExpiry({})); },
    'umlauf': async t => { await t.endTurn(); await t.endTurn(); },
    'teleport': async t => { if (t.state.tp || !t.hero(me, 1).name || t.hero(me, 1).hp <= 0) return; t.state.tp = 1; t.addHand(op, TP);
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 1); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); await t.play(op, TP, { hero: 0, active: op }); t.gs.activePlayer = me; },
  };
}
const DORF = {
  'Dorf kommt (eigener Sitz)': async (t, me) => { t.addHand(me, VIL); await t.play(me, VIL, { hero: 2, active: me }); },
  'Dorf kommt (Gegner)': async (t, me) => { t.addHand(1 - me, VIL); await t.play(1 - me, VIL, { hero: 2, active: 1 - me }); },
  'Dorf entfernt': async (t) => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.removeArea(i, 'Test', { skipProtection: true })); },
  'Dorf gelöscht': async (t) => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.deleteArea(i, 'Test', { skipProtection: true })); },
  'Dorf auf die Hand': async (t) => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.actionMoveCard(i, 'hand', -1, -1, { source: 'Test' })); },
  'Dorf zerstört': async (t, me) => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 - me }, i, {})); },
  // Eine andere Area verdrängt die Areas des anderen Sitzes (`placeArea` mit `replaceExisting`, z. B. Cooldin/Pollution-Karten): hier der andere Sitz legt Dark Ocean und ersetzt das Dorf.
  'Dorf ersetzt (andere Area des Gegenübers)': async (t) => { const i = t.find(VIL, 'area'); if (!i) return; const andere = 1 - i.owner; const x = t.engine._trackCard('Dark Ocean', andere, 'hand'); await t.run(() => t.engine.placeArea(andere, x, { replaceExisting: true, replacedBy: 'Dark Ocean' })); },
};
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** A (mit Dörfern) gegen B (ohne): jeder Held == Faktor × B. */
function vergleiche(A, B) {
  const bad = [], f = Math.pow(2, areaAnzahl(A));
  for (const s of [0, 1]) for (const h of [0, 1, 2]) {
    const a = A.hero(s, h), b = B.hero(s, h); if (!a || !b || !a.name || !b.name) continue;
    if (a.name !== b.name) bad.push(`S${s}H${h} Name ${a.name} != ${b.name}`);
    if (a.atk !== f * b.atk) bad.push(`S${s}H${h} ${a.name.split(',')[0]} (hp ${a.hp}): A=${a.atk} B=${b.atk} Faktor ${f}, Aura-Buchung ${a._atkAuraGrant || 0}${a.statuses && a.statuses.cursed ? ', verflucht' : ''}`);
    if (f === 1 && (a._atkAuraGrant || 0) !== 0 && !(a.statuses && a.statuses.cursed)) bad.push(`S${s}H${h} Restbuchung der Aura ${a._atkAuraGrant} ohne Dorf`);
  }
  return bad;
}

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    const mkN = async (o = {}) => {   // schlichte Szene: Held 0 = Tushu (40), Held 1 Rick, Held 2 Zwei; Gegner gleich
      const t = await U.fresh(me, { hand: [CLUB, 'Curse', VIL, VIL, 'Dark Ocean'], heroes: { [me]: [TUSHU, RICK, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      if (o.dorf) { t.putArea(me, VIL); t.engine.syncAlleAtkAuren(); }
      if (o.club) await U.lege(t, me, CLUB, 0);
      t.errors.length = 0; return t;
    };
    const basisAlle = (t, f) => { const bad = []; for (const s of [0, 1]) for (const h of [0, 1, 2]) { const hero = t.hero(s, h); if (hero.name && hero.atk !== f * DB[hero.name].atk) bad.push(`S${s}H${h} ${hero.atk} != ${f} × ${DB[hero.name].atk}`); } return bad; };
    const toeten = (t, s = me, h = 0) => t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: 1 - s, heroIdx: 0 }, t.hero(s, h), {}));
    const beleben = (t, s = me, h = 0) => t.run(() => t.engine.actionReviveHero(s, h, 100, { source: 'Test' }));

    // ═══ (N) Erzählung mit festen Zahlen ═══
    R.section(`Sitz ${me} · (N1) Sterben ändert die Aura nicht: Dorf liegt, Held mit Club stirbt, wird wiederbelebt`);
    {
      const t = await mkN({ dorf: 1, club: 1 });
      R.check(`Ausgang: alle Helden doppelt, Held 0 mit Club (${BASIS} + 30) × 2 = ${2 * (BASIS + 30)}`, atk(t, me, 0) === 2 * (BASIS + 30) && basisAlle(t, 2).filter(x => !x.startsWith(`S${me}H0`)).length === 0, { a: atk(t, me, 0), bad: basisAlle(t, 2) });
      await toeten(t);
      R.check(`besiegt: Club abgelegt (verdoppelter Anteil mit), die Verdopplung BLEIBT: ${2 * BASIS} (nicht ${BASIS}, nicht 0, kein Überhang ${2 * (BASIS + 30)})`, atk(t, me, 0) === 2 * BASIS && t.hero(me, 0).hp === 0 && !t.find(CLUB, 'support'), { a: atk(t, me, 0), grant: t.hero(me, 0)._atkAuraGrant });
      R.check('besiegt: übrige Helden beider Seiten unverändert doppelt', basisAlle(t, 2).filter(x => !x.startsWith(`S${me}H0`)).length === 0, basisAlle(t, 2));
      await beleben(t);
      R.check(`wiederbelebt: ${2 * BASIS} — weder Über- noch Unterhang`, atk(t, me, 0) === 2 * BASIS && t.hero(me, 0).hp > 0, { a: atk(t, me, 0), grant: t.hero(me, 0)._atkAuraGrant });
      // zweiter Tod ohne Ausrüstung
      await toeten(t); R.check(`zweiter Tod ohne Ausrüstung: ${2 * BASIS}`, atk(t, me, 0) === 2 * BASIS, { a: atk(t, me, 0) });
      await beleben(t); R.check(`zweite Wiederbelebung: ${2 * BASIS}`, atk(t, me, 0) === 2 * BASIS, { a: atk(t, me, 0) });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }
    for (const [dn, fn] of Object.entries(DORF).filter(([k]) => /entfernt|gelöscht|Hand|zerstört|ersetzt/.test(k))) {
      R.section(`Sitz ${me} · (N2) Dorf geht („${dn}") — der Bonus verschwindet von ALLEN Helden, lebend wie tot`);
      for (const wann of ['Held lebt', 'Held tot', 'tot, dann wiederbelebt']) {
        const t = await mkN({ dorf: 1, club: 1 });
        if (wann !== 'Held lebt') await toeten(t);
        await toeten(t, op, 1);   // auch ein toter Gegnerheld
        await fn(t, me);
        const f = areaAnzahl(t) ? 2 : 1;
        const a0 = atk(t, me, 0);
        const soll0 = wann === 'Held lebt' ? BASIS + 30 : BASIS;
        const fehler = [];
        if (areaAnzahl(t)) fehler.push('Dorf liegt noch');
        if (a0 !== soll0) fehler.push(`Held 0 ${a0} != ${soll0}`);
        fehler.push(...basisAlle(t, 1).filter(x => !x.startsWith(`S${me}H0`)));
        if (t.hero(op, 1).hp !== 0) fehler.push('Gegnerheld 1 sollte tot sein');
        for (const [s, h] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]) if ((t.hero(s, h)._atkAuraGrant || 0) !== 0) fehler.push(`Restbuchung S${s}H${h}: ${t.hero(s, h)._atkAuraGrant}`);
        if (wann === 'tot, dann wiederbelebt') { await beleben(t); if (atk(t, me, 0) !== BASIS) fehler.push(`wiederbelebt ${atk(t, me, 0)} != ${BASIS}`); }
        if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
        void f;
        R.check(`${dn} · ${wann}: Held 0 ${soll0}, alle anderen (auch der tote Gegnerheld) ${BASIS}/Basis, keine Restbuchung`, fehler.length === 0, fehler);
      }
    }
    R.section(`Sitz ${me} · (N3) Dorf kommt, WÄHREND Helden tot sind — und frisch eingesetzte Dörfer von beiden Sitzen`);
    for (const dn of ['Dorf kommt (eigener Sitz)', 'Dorf kommt (Gegner)']) {
      const t = await mkN({ club: 1 });
      await toeten(t); await toeten(t, op, 1);
      await DORF[dn](t, me);
      const fehler = [];
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`toter Held 0: ${atk(t, me, 0)} != ${2 * BASIS}`);
      fehler.push(...basisAlle(t, 2));
      await beleben(t); if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`wiederbelebt ${atk(t, me, 0)} != ${2 * BASIS}`);
      await beleben(t, op, 1);
      fehler.push(...basisAlle(t, 2));
      // Dorf geht wieder → alle zurück
      await DORF['Dorf entfernt'](t); fehler.push(...basisAlle(t, 1));
      R.check(`${dn} (Held 0 und Gegnerheld 1 tot): tote Helden doppelt wie lebende, Wiederbelebung ohne Über-/Unterhang, Dorf weg → alle Basis`, fehler.length === 0, fehler);
    }
    R.section(`Sitz ${me} · (N4) zwei Dörfer ×4, eines geht → ×2, das andere geht → ×1 (mit totem Helden)`);
    {
      const t = await mkN({ dorf: 1 });
      t.putArea(op, VIL); t.engine.syncAlleAtkAuren();
      const fehler = [];
      if (areaAnzahl(t) !== 2) fehler.push('zwei Dörfer erwartet');
      fehler.push(...basisAlle(t, 4));
      await toeten(t); fehler.push(...basisAlle(t, 4));
      await t.run(() => t.engine.removeArea(t.find(VIL, 'area'), 'Test', { skipProtection: true })); fehler.push(...basisAlle(t, 2));
      await beleben(t); fehler.push(...basisAlle(t, 2));
      await toeten(t); await t.run(() => t.engine.removeArea(t.find(VIL, 'area'), 'Test', { skipProtection: true })); fehler.push(...basisAlle(t, 1));
      await beleben(t); fehler.push(...basisAlle(t, 1));
      R.check('×4 → ×2 → ×1, lebend wie tot, Wiederbelebung ohne Über-/Unterhang', fehler.length === 0 && t.errors.length === 0, fehler);
    }
    R.section(`Sitz ${me} · (N5) verfluchter Held: sichtbar 0, nach dem Heilen genau der aktuelle Zustand`);
    for (const dn of ['Dorf entfernt', 'Dorf kommt (eigener Sitz)']) {
      const t = await mkN({ dorf: dn === 'Dorf entfernt', club: 1 });
      await U.haenge(t, me, 'Curse', 0);
      const fehler = [];
      if (atk(t, me, 0) !== 0) fehler.push('verflucht, aber sichtbar ' + atk(t, me, 0));
      await DORF[dn](t, me);
      if (atk(t, me, 0) !== 0) fehler.push('nach Dorfwechsel sichtbar ' + atk(t, me, 0));
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      const f = areaAnzahl(t) ? 2 : 1;
      if (atk(t, me, 0) !== f * (BASIS + 30)) fehler.push(`geheilt ${atk(t, me, 0)} != ${f} × ${BASIS + 30}`);
      R.check(`Fluch + ${dn}: nach dem Heilen ${f} × (Basis + Club)`, fehler.length === 0 && t.errors.length === 0, fehler);
    }

    // ═══ (F) Differenztest A (mit Dorf-Ereignissen) gegen B (ohne) ═══
    R.section(`Sitz ${me} · (F) Differenztest: zufällige Schrittfolgen, A == Faktor × B für alle Helden nach jedem Schritt`);
    {
      const S = schritte(me), namen = Object.keys(S), dn = Object.keys(DORF);
      let fails = 0, schritteGesamt = 0; const meldungen = [];
      for (let seed = 1; seed <= 70; seed++) {
        const r = rng(seed * 7919 + me), A = await mk(me), B = await mk(me), seq = [];
        for (let i = 0; i < 14; i++) {
          const v = r() < 0.35, k = v ? dn[Math.floor(r() * dn.length)] : namen[Math.floor(r() * namen.length)];
          seq.push(k);
          if (v) { const ap = A.gs.activePlayer, ph = A.gs.currentPhase; await DORF[k](A, me); A.gs.activePlayer = ap; A.gs.currentPhase = ph; }
          else { await S[k](A); await S[k](B); }
          schritteGesamt++;
          const bad = vergleiche(A, B); if (A.errors.length || B.errors.length) bad.push('ERR ' + (A.errors[0] || B.errors[0]));
          if (bad.length) { fails++; if (meldungen.length < 3) meldungen.push(`Folge ${seed} nach [${seq.join(' → ')}]: ${bad.slice(0, 2).join(' ; ')}`); break; }
        }
      }
      R.check(`70 Folgen × 14 Schritte (${schritteGesamt} Schritte): A == Faktor × B für alle 6 Helden, ohne Restbuchung ohne Dorf`, fails === 0, meldungen);
    }

    // ═══ (Q) Sonderwege ═══
    R.section(`Sitz ${me} · (Q1) Teleportation Powder: das Dorf kommt/geht während der Abwesenheit`);
    for (const flip of ['kommt', 'geht', 'bleibt', 'kommt und geht', 'geht und kommt wieder']) {
      const t = await mkN({ dorf: flip === 'geht' || flip === 'bleibt' || flip === 'geht und kommt wieder' });
      t.addHand(op, TP); t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 0); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); t.reset();
      await t.play(op, TP, { hero: 0, active: op });
      const fehler = [];
      if (t.hero(me, 0).name) fehler.push('Held nicht verschwunden');
      const dorfWeg = async () => { await t.run(() => t.engine.removeArea(t.find(VIL, 'area'), 'T', { skipProtection: true })); };
      const dorfDa = async () => { t.putArea(me, VIL); t.engine.syncAlleAtkAuren(); };
      if (flip === 'kommt') await dorfDa();
      if (flip === 'geht') await dorfWeg();
      if (flip === 'kommt und geht') { await dorfDa(); await dorfWeg(); }
      if (flip === 'geht und kommt wieder') { await dorfWeg(); await dorfDa(); }
      await t.endTurn(); await t.endTurn();
      const f = areaAnzahl(t) ? 2 : 1;
      if (!t.hero(me, 0).name) fehler.push('Held nicht zurück');
      else if (atk(t, me, 0) !== f * BASIS) fehler.push(`zurückgekehrter Held ${atk(t, me, 0)} != ${f} × ${BASIS} (Buchung ${t.hero(me, 0)._atkAuraGrant || 0})`);
      fehler.push(...basisAlle(t, f).filter(x => !x.startsWith(`S${me}H0`)));
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Teleport, Dorf ${flip}: der Zurückgekehrte und alle anderen stehen bei ${f} × Basis`, fehler.length === 0, fehler);
    }
    R.section(`Sitz ${me} · (Q2) Quetzahuitl tritt in einen freien Heldenplatz`);
    for (const dorf of [true, false]) {
      const QZ = 'Quetzahuitl, Receiver of Sacrifices';
      const t = await U.fresh(me, { hand: [QZ], heroes: { [me]: [TUSHU, RICK, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      if (dorf) { t.putArea(op, VIL); t.engine.syncAlleAtkAuren(); }
      t.errors.length = 0;
      // Quetzahuitl erscheint, wenn der LETZTE lebende Held im Zug des Gegners fällt
      t.gs.activePlayer = op;
      for (const h of [1, 2]) await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, t.hero(me, h), {}));
      await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, t.hero(me, 0), {}));
      const q = t.gs.players[me].heroes.find(h => h.name === QZ);
      const fehler = [];
      if (!q) { R.note(`Quetzahuitl erschien nicht (Setup)`, t.gs.players[me].heroes.map(h => h.name)); continue; }
      const soll = (dorf ? 2 : 1) * DB[QZ].atk;
      if (q.atk !== soll) fehler.push(`Quetzahuitl ${q.atk} != ${dorf ? 2 : 1} × ${DB[QZ].atk}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Quetzahuitl ${dorf ? 'mit' : 'ohne'} Dorf: ATK ${soll}`, fehler.length === 0, fehler);
    }
    R.section(`Sitz ${me} · (Q3) Chuck: Aufstieg aus der Niederlage (Held fällt, steigt auf) mit Dorf == Faktor × Szene ohne Dorf`);
    {
      const CK = 'Chuck, the Crazy Veteran', CS = 'Chuck, the Storyteller';
      const lauf = async (dorf) => {
        const t = await U.fresh(me, { hand: [CS, CLUB], heroes: { [me]: [CK, TUSHU, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
        t.gs.turn = Math.max(t.gs.turn || 0, 3);
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === CS, answer: () => null });
        if (dorf) { t.putArea(me, VIL); t.engine.syncAlleAtkAuren(); }
        await U.lege(t, me, CLUB, 0);
        for (const hi of [1, 2]) t.hero(me, hi).statuses.shielded = { appliedTurn: 0 };
        t.errors.length = 0;
        await t.run(() => t.engine.actionDealDamage({ name: 'X', owner: op, controller: op, heroIdx: 0 }, t.hero(me, 0), 5000, 'attack'));
        return t;
      };
      const A = await lauf(true), B = await lauf(false);
      const fehler = [];
      if (A.hero(me, 0).name !== CS || B.hero(me, 0).name !== CS) fehler.push(`Aufstieg: ${A.hero(me, 0).name} / ${B.hero(me, 0).name}`);
      if (A.hero(me, 0).atk !== 2 * B.hero(me, 0).atk) fehler.push(`A ${A.hero(me, 0).atk} != 2 × B ${B.hero(me, 0).atk}`);
      if (A.errors.length || B.errors.length) fehler.push('ERR ' + (A.errors[0] || B.errors[0]));
      // Dorf geht: Basis; danach Tod und Wiederbelebung bleiben konsistent
      await A.run(() => A.engine.removeArea(A.find(VIL, 'area'), 'Test', { skipProtection: true }));
      if (A.hero(me, 0).atk !== B.hero(me, 0).atk) fehler.push(`nach Dorf weg: ${A.hero(me, 0).atk} != ${B.hero(me, 0).atk}`);
      R.check('Chuck steigt aus der Niederlage auf: mit Dorf doppelt (== 2 × ohne Dorf), Dorf weg → identisch zur Szene ohne Dorf', fehler.length === 0, fehler);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('FATAL ' + (e && e.stack || e) + '\n'); process.exit(2); });

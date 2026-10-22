'use strict';
// W59a (Al, 22.10.2026): Diver Helmet vs. Rioting Village.
//   Diver Helmet: „The equipped Hero and all cards in its Support Zones are unaffected by Areas."
//   Rioting Village: „… all Heroes have their Attack stats doubled, but no player can use more than 1 Attack per turn and when a Hero deals damage with an Attack, it takes half the damage dealt as recoil …"
//   Al: „Diver Helmet soll einen Hero von Village ausnehmen – von BEIDEN Komponenten! Wird Helmet equipped, während Village schon aktiv ist, verschwindet der Village-Buff von ihm."
//   Auslegung: „beide Komponenten" = (1) ATK-Verdopplung (die Aura) und (2) Rückstoß des Helden. Die Sperre „no player can use more than 1 Attack per turn" betrifft den SPIELER, nicht den Helden
//   — unverändert: auch die Attack eines Helm-Helden zählt für das Spieler-Limit.
//   Vor W59a: der Helm-Held wurde trotzdem verdoppelt und erlitt den Rückstoß (auf dem alten Stand rot).
// (N) Erzählung mit festen Zahlen (Helm kommt/geht auf allen Wegen, Dorf kommt/geht, ×4, Club, Fluch, Cykyran, Aufstieg, Teleport, tot/wiederbelebt, Gegnerseite, Status am Wirt)
// (R) Rückstoß: Helm-Held vs. Held ohne Helm (Held- und Kreaturenziel, Gegnerseite, Helm kommt/geht, Spieler-Limit)
// (F) Differenztest: Szene A (mit Dorf-Ereignissen) gegen B (ohne Dorf), gleiche Schritte inkl. Helm-Schritten: Held MIT Helm in A == B, Held OHNE Helm in A == 2^Dörfer × B, nach JEDEM Schritt
// beide Sitze. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const H = U.H, DB = H.DB;
const VIL = 'Rioting Village', HELM = 'Diver Helmet', CLUB = 'Club of Gobbo', ASC = 'Riffel, Master of the Ultimate Gun', RIF = 'Future Tech Gunslinger Riffel', TP = 'Teleportation Powder';
const CYK = 'Cykyran War Counselor', GOR = 'Gorinthian War Counselor', CEN = 'Censpartan War Counselor', FR = 'Slippery Fridge', CE = 'Inheritance Ceremony';
const TUSHU = 'Tushu, the Knowledge Keeper', RICK = 'Rick, the Trigger Happy Undertaker', ZWEI = 'Zwei, the Lucky Thief';
const BASIS = DB[TUSHU].atk;   // 40

const areaAnzahl = (t) => (t.gs.areaZones || []).flat().filter(x => x === VIL).length;
const atk = (t, s, h) => t.hero(s, h).atk;
const DH = require('../../../../cards/effects/_diver-helmet-shared');
const helmAn = (t, s, h) => DH.heroHasDiverHelmet(t.engine, s, h);   // unabhängig von der neuen Engine-Frage: der Test prüft das Ergebnis, nicht den Weg
const helmInst = (t, s) => t.engine.cardInstances.find(c => c.name === HELM && c.zone === 'support' && t.engine.physicalSide(c) === s);

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    const mkN = async (o = {}) => {   // Held 0 = Tushu (40), Held 1 Rick, Held 2 Zwei; Gegner gleich
      const t = await U.fresh(me, { hand: [HELM, CLUB, 'Curse', VIL, VIL, 'Dark Ocean', FR, CE], heroes: { [me]: [TUSHU, RICK, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      if (o.dorf) { t.putArea(op, VIL); t.engine.syncAlleAtkAuren(); }
      if (o.club) await U.lege(t, me, CLUB, 0);
      if (o.helm) await U.lege(t, me, HELM, 0);
      t.errors.length = 0; return t;
    };
    const basisAlle = (t, f, ausser = []) => { const bad = []; for (const s of [0, 1]) for (const h of [0, 1, 2]) { if (ausser.some(([a, b]) => a === s && b === h)) continue; const hero = t.hero(s, h); if (hero.name && hero.atk !== f * DB[hero.name].atk) bad.push(`S${s}H${h} ${hero.atk} != ${f} × ${DB[hero.name].atk}`); } return bad; };
    const toeten = (t, s = me, h = 0) => t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: 1 - s, heroIdx: 0 }, t.hero(s, h), {}));
    const beleben = (t, s = me, h = 0) => t.run(() => t.engine.actionReviveHero(s, h, 100, { source: 'Test' }));
    const zerstoere = (t, inst) => t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, inst, {}));
    const nachHand = (t, inst) => t.run(() => t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Test' }));
    const nachAblage = (t, inst) => t.run(() => t.engine.actionMoveCard(inst, 'discard', -1, -1, { source: 'Test' }));
    const loesche = (t, inst) => t.run(() => t.engine.actionMoveCard(inst, 'deleted', -1, -1, { source: 'Test' }));
    const dorfWeg = async (t) => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.removeArea(i, 'Test', { skipProtection: true })); };
    const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

    // ═══ (N1) Helm kommt, während das Dorf liegt ═══
    R.section(`Sitz ${me} · (N1) Helm wird angelegt, während Village aktiv ist: Held 0 sofort wie ohne Village, alle anderen doppelt`);
    {
      const t = await mkN({ dorf: 1 });
      const fehler = [];
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`Ausgang ${atk(t, me, 0)} != ${2 * BASIS}`);
      await U.lege(t, me, HELM, 0);
      if (!helmInst(t, me)) fehler.push('Helm liegt nicht');
      if (atk(t, me, 0) !== BASIS) fehler.push(`mit Helm ${atk(t, me, 0)} != ${BASIS} (Buchung ${t.hero(me, 0)._atkAuraGrant || 0})`);
      fehler.push(...basisAlle(t, 2, [[me, 0]]));
      if ((t.hero(me, 0)._atkAuraGrant || 0) !== 0) fehler.push('Restbuchung der Aura am Helm-Helden');
      R.check(`Held 0 ${BASIS} (nicht ${2 * BASIS}), die übrigen fünf Helden beider Seiten doppelt`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N2) Helm liegt, Village kommt NEU (eigener Sitz / Gegner / zweites Dorf)`);
    for (const [wer, n] of [['eigener Sitz', 1], ['Gegner', 1], ['beide Sitze (×4)', 2]]) {
      const t = await mkN({ helm: 1 });
      const fehler = [];
      if (wer !== 'Gegner') { t.addHand(me, VIL); await t.run(() => t.engine.placeArea(me, t.engine._trackCard(VIL, me, 'hand'))); }
      if (wer === 'Gegner' || n === 2) { const x = t.engine._trackCard(VIL, op, 'hand'); await t.run(() => t.engine.placeArea(op, x)); }
      const f = Math.pow(2, areaAnzahl(t));
      if (f !== Math.pow(2, n)) fehler.push(`Dörfer ${areaAnzahl(t)}`);
      if (atk(t, me, 0) !== BASIS) fehler.push(`Helm-Held ${atk(t, me, 0)} != ${BASIS}`);
      fehler.push(...basisAlle(t, f, [[me, 0]]));
      R.check(`Dorf: ${wer}: Helm-Held bleibt ${BASIS}, die anderen ×${f}`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N3) Helm geht → die Verdopplung kehrt sofort zurück (auf allen Wegen): zerstört, abgelegt, gelöscht, auf die Hand`);
    for (const [wie, fn] of [['zerstört', zerstoere], ['abgelegt', nachAblage], ['gelöscht', loesche], ['auf die Hand', nachHand]]) {
      const t = await mkN({ dorf: 1, helm: 1 });
      const fehler = [];
      if (atk(t, me, 0) !== BASIS) fehler.push(`mit Helm ${atk(t, me, 0)}`);
      await fn(t, helmInst(t, me));
      if (helmInst(t, me)) fehler.push('Helm liegt noch');
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`ohne Helm ${atk(t, me, 0)} != ${2 * BASIS}`);
      fehler.push(...basisAlle(t, 2));
      R.check(`Helm ${wie}: Held 0 wieder ${2 * BASIS}, alles konsistent`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N4) Helm und Club (Reihenfolgen): Club vor/nach Helm, Helm geht, Club geht`);
    {
      const t = await mkN({ dorf: 1, club: 1 });
      const fehler = [];
      if (atk(t, me, 0) !== 2 * (BASIS + 30)) fehler.push(`Club+Dorf ${atk(t, me, 0)} != ${2 * (BASIS + 30)}`);
      await U.lege(t, me, HELM, 0);
      if (atk(t, me, 0) !== BASIS + 30) fehler.push(`+Helm ${atk(t, me, 0)} != ${BASIS + 30}`);
      await zerstoere(t, t.find(CLUB, 'support'));
      if (atk(t, me, 0) !== BASIS) fehler.push(`Club weg (Helm bleibt) ${atk(t, me, 0)} != ${BASIS}`);
      await U.lege(t, me, CLUB, 0);
      if (atk(t, me, 0) !== BASIS + 30) fehler.push(`Club wieder an (Helm bleibt) ${atk(t, me, 0)} != ${BASIS + 30}`);
      await zerstoere(t, helmInst(t, me));
      if (atk(t, me, 0) !== 2 * (BASIS + 30)) fehler.push(`Helm weg (Club bleibt) ${atk(t, me, 0)} != ${2 * (BASIS + 30)}`);
      await dorfWeg(t);
      if (atk(t, me, 0) !== BASIS + 30) fehler.push(`Dorf weg ${atk(t, me, 0)} != ${BASIS + 30}`);
      R.check('Club + Helm + Dorf: (40+30) × 2 → Helm: 70 → Club weg: 40 → Club: 70 → Helm weg: 140 → Dorf weg: 70', fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N5) Helm umhängen (Slippery Fridge / Inheritance Ceremony): am neuen Wirt weg, am alten Wirt zurück`);
    for (const via of ['fridge', 'ceremony']) {
      const t = await mkN({ dorf: 1, helm: 1 });
      const fehler = [];
      await U.bewege(t, me, via, { name: HELM, nach: 1, von: 0 });
      if (!U.wo(t, me, HELM).includes(1)) fehler.push(`Helm liegt nicht bei Held 1 (${JSON.stringify(U.wo(t, me, HELM))})`);
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`alter Wirt ${atk(t, me, 0)} != ${2 * BASIS}`);
      if (atk(t, me, 1) !== DB[RICK].atk) fehler.push(`neuer Wirt ${atk(t, me, 1)} != ${DB[RICK].atk}`);
      fehler.push(...basisAlle(t, 2, [[me, 1]]));
      await U.bewege(t, me, 'fridge', { name: HELM, nach: 2, von: 0 });   // zweites Umhängen immer per Fridge (die Ceremony ist einmal pro Zug)
      if (atk(t, me, 1) !== 2 * DB[RICK].atk) fehler.push(`zweites Umhängen, Held 1 ${atk(t, me, 1)}`);
      if (atk(t, me, 2) !== DB[ZWEI].atk) fehler.push(`zweites Umhängen, Held 2 ${atk(t, me, 2)}`);
      fehler.push(...basisAlle(t, 2, [[me, 2]]));
      R.check(`${via}: Verdopplung folgt dem Helm (alter Wirt doppelt, neuer Wirt wie ohne Dorf)`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N6) Wirt besiegt / wiederbelebt: der Helm geht in die Ablage → Verdopplung kehrt zurück (tot wie lebend, keine Differenzierung)`);
    {
      const t = await mkN({ dorf: 1, helm: 1, club: 1 });
      const fehler = [];
      await toeten(t);
      if (helmInst(t, me)) fehler.push('Helm liegt beim Besiegten');
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`besiegt ${atk(t, me, 0)} != ${2 * BASIS}`);
      await beleben(t);
      if (atk(t, me, 0) !== 2 * BASIS) fehler.push(`wiederbelebt ${atk(t, me, 0)} != ${2 * BASIS}`);
      await U.lege(t, me, HELM, 0);
      if (atk(t, me, 0) !== BASIS) fehler.push(`Helm neu auf dem Wiederbelebten ${atk(t, me, 0)} != ${BASIS}`);
      fehler.push(...basisAlle(t, 2, [[me, 0]]));
      R.check(`besiegt ${2 * BASIS} → wiederbelebt ${2 * BASIS} → neuer Helm ${BASIS}`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N7) Dorf geht / kommt mit Helm: Helm-Held bleibt Basis; mehrere Dörfer`);
    {
      const t = await mkN({ dorf: 1, helm: 1 });
      const fehler = [];
      await dorfWeg(t);
      fehler.push(...basisAlle(t, 1));
      if (atk(t, me, 0) !== BASIS) fehler.push(`Dorf weg: ${atk(t, me, 0)}`);
      t.putArea(op, VIL); t.putArea(me, VIL); t.engine.syncAlleAtkAuren();
      if (areaAnzahl(t) !== 2) fehler.push('zwei Dörfer erwartet');
      if (atk(t, me, 0) !== BASIS) fehler.push(`zwei Dörfer: Helm-Held ${atk(t, me, 0)} != ${BASIS}`);
      fehler.push(...basisAlle(t, 4, [[me, 0]]));
      await zerstoere(t, helmInst(t, me));
      fehler.push(...basisAlle(t, 4));
      R.check('Dorf geht: alles Basis; zwei Dörfer: Helm-Held Basis, andere ×4; Helm weg: Held 0 ×4', fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N8) Helm am GEGNERHELDEN (Gegnerseite): ausgenommen; eigener Held doppelt`);
    {
      const t = await mkN({ dorf: 1 });
      t.addHand(op, HELM); await t.play(op, HELM, { hero: 1, active: op });
      const fehler = [];
      if (!helmInst(t, op)) fehler.push('Gegner-Helm liegt nicht');
      if (atk(t, op, 1) !== DB[RICK].atk) fehler.push(`Gegnerheld mit Helm ${atk(t, op, 1)} != ${DB[RICK].atk}`);
      fehler.push(...basisAlle(t, 2, [[op, 1]]));
      // gleicher Heldenindex auf MEINER Seite bleibt doppelt (kein Seitenverwechseln)
      if (atk(t, me, 1) !== 2 * DB[RICK].atk) fehler.push(`mein Held 1 (gleicher Index) ${atk(t, me, 1)} != ${2 * DB[RICK].atk}`);
      await zerstoere(t, helmInst(t, op));
      fehler.push(...basisAlle(t, 2));
      R.check('Gegnerheld mit Helm Basis; mein gleichindizierter Held doppelt; Helm weg → alle doppelt', fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N9) Fluch + Helm + Dorf, in allen Reihenfolgen`);
    for (const reihe of ['Fluch zuerst', 'Helm zuerst', 'Dorf zuletzt']) {
      const t = await mkN({ club: 1, dorf: reihe !== 'Dorf zuletzt' });
      const fehler = [];
      if (reihe === 'Fluch zuerst') { await U.haenge(t, me, 'Curse', 0); await U.lege(t, me, HELM, 0); }
      else if (reihe === 'Helm zuerst') { await U.lege(t, me, HELM, 0); await U.haenge(t, me, 'Curse', 0); }
      else { await U.lege(t, me, HELM, 0); await U.haenge(t, me, 'Curse', 0); t.putArea(op, VIL); t.engine.syncAlleAtkAuren(); }
      if (atk(t, me, 0) !== 0) fehler.push(`verflucht, sichtbar ${atk(t, me, 0)}`);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      if (atk(t, me, 0) !== BASIS + 30) fehler.push(`geheilt (Helm liegt) ${atk(t, me, 0)} != ${BASIS + 30}`);
      await zerstoere(t, helmInst(t, me));
      if (atk(t, me, 0) !== 2 * (BASIS + 30)) fehler.push(`Helm weg ${atk(t, me, 0)} != ${2 * (BASIS + 30)}`);
      R.check(`${reihe}: nach dem Heilen ${BASIS + 30} (Helm), ohne Helm ${2 * (BASIS + 30)}`, fehler.length === 0 && sauber(t), fehler);
    }
    {
      // Helm kommt/geht WÄHREND der Fluch liegt
      const t = await mkN({ club: 1, dorf: 1 });
      const fehler = [];
      await U.haenge(t, me, 'Curse', 0);
      await U.lege(t, me, HELM, 0);
      await zerstoere(t, helmInst(t, me));
      await U.lege(t, me, HELM, 0);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, t.find('Curse', 'support'), {}));
      if (atk(t, me, 0) !== BASIS + 30) fehler.push(`Helm kam/ging/kam im Fluch, geheilt ${atk(t, me, 0)} != ${BASIS + 30}`);
      R.check('Helm kommt/geht/kommt, während der Fluch liegt → nach dem Heilen genau Basis + Club', fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N10) Cykyran-Verdopplung + Helm + Dorf`);
    {
      const t = await mkN({ dorf: 1, helm: 1 });
      const fehler = [];
      const ohne = await mkN({ helm: 1 });
      let s = 0; for (const r of [CYK, GOR, CEN]) { await t.play(me, r, { hero: 2, slot: s++, active: me }); await ohne.play(me, r, { hero: 2, slot: s - 1, active: me }); }
      const cyk = atk(ohne, me, 0);
      if (atk(t, me, 0) !== cyk) fehler.push(`Cykyran + Helm + Dorf ${atk(t, me, 0)} != ohne Dorf ${cyk}`);
      await zerstoere(t, helmInst(t, me)); await zerstoere(ohne, helmInst(ohne, me));
      if (atk(t, me, 0) !== 2 * atk(ohne, me, 0)) fehler.push(`Helm weg: ${atk(t, me, 0)} != 2 × ${atk(ohne, me, 0)}`);
      R.check(`Cykyran-Held: mit Helm == Szene ohne Dorf (${cyk}), Helm weg == 2 × ohne Dorf`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N11) Aufstieg / Abstieg mit Helm und Dorf`);
    {
      const t = await U.fresh(me, { hand: [ASC, HELM, VIL], heroes: { [me]: [RIF, RICK, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3); t.putArea(op, VIL); t.engine.syncAlleAtkAuren();
      await U.lege(t, me, HELM, 0); t.errors.length = 0;
      const fehler = [];
      const basisR = DB[RIF].atk, basisA = DB[ASC].atk;
      if (atk(t, me, 0) !== basisR) fehler.push(`Riffel mit Helm ${atk(t, me, 0)} != ${basisR}`);
      t.gs.activePlayer = me; t.phase(2);
      await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true, forceFormStack: true }));
      if (t.hero(me, 0).name !== ASC) fehler.push('Aufstieg nicht erfolgt');
      else if (atk(t, me, 0) !== basisA) fehler.push(`aufgestiegen mit Helm ${atk(t, me, 0)} != ${basisA} (Buchung ${t.hero(me, 0)._atkAuraGrant || 0})`);
      await zerstoere(t, helmInst(t, me));
      if (atk(t, me, 0) !== 2 * basisA) fehler.push(`Helm weg (aufgestiegen) ${atk(t, me, 0)} != ${2 * basisA}`);
      await U.lege(t, me, HELM, 0);
      await t.run(() => t.engine.performDescend(me, 0, {}));
      if (t.hero(me, 0).name === RIF && atk(t, me, 0) !== basisR) fehler.push(`abgestiegen mit Helm ${atk(t, me, 0)} != ${basisR}`);
      await zerstoere(t, helmInst(t, me));
      if (atk(t, me, 0) !== 2 * basisR) fehler.push(`abgestiegen, Helm weg ${atk(t, me, 0)} != ${2 * basisR}`);
      R.check(`Aufstieg/Abstieg: mit Helm Basis, ohne Helm doppelt (${basisR}/${basisA})`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (N12) Teleportation Powder: Helm-Held verschwindet und kehrt zurück (Zustand exakt wie vorher)`);
    for (const wechsel of ['unverändert', 'Dorf geht in der Abwesenheit', 'Dorf kommt in der Abwesenheit']) {
      const t = await mkN({ dorf: wechsel !== 'Dorf kommt in der Abwesenheit' });
      await U.lege(t, me, HELM, 1);   // Helm am Teleport-Held 1 (Rick)
      t.errors.length = 0;
      t.addHand(op, TP); t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 1); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); t.reset();
      await t.play(op, TP, { hero: 0, active: op });
      const fehler = [];
      if (t.hero(me, 1).name) fehler.push('Held nicht verschwunden');
      if (wechsel === 'Dorf geht in der Abwesenheit') await dorfWeg(t);
      if (wechsel === 'Dorf kommt in der Abwesenheit') { t.putArea(me, VIL); t.engine.syncAlleAtkAuren(); }
      await t.endTurn(); await t.endTurn();
      if (!t.hero(me, 1).name) fehler.push('Held nicht zurück');
      else {
        const hat = helmAn(t, me, 1);
        const f = areaAnzahl(t) ? 2 : 1;
        const soll = (hat ? 1 : f) * DB[RICK].atk;
        if (atk(t, me, 1) !== soll) fehler.push(`zurückgekehrt ${atk(t, me, 1)} != ${soll} (Helm ${hat ? 'da' : 'weg'}, ${f}×)`);
      }
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Teleport, ${wechsel}: der Zurückgekehrte steht exakt wie der Zustand der Szene (Helm ⇒ Basis)`, fehler.length === 0, fehler);
    }
    R.section(`Sitz ${me} · (N13) Wirt gefroren / betäubt / negiert, Wirt gecharmt: Ausrüstung ruht nie (Ruling W7a/W27a) → Helm gilt weiter`);
    for (const st of ['frozen', 'stunned', 'negated', 'charmedBy']) {
      const t = await mkN({ dorf: 1, helm: 1 });
      const hero = t.hero(me, 0);
      if (st === 'charmedBy') hero.charmedBy = op; else hero.statuses[st] = { appliedTurn: 0 };
      t.engine.sync();
      const fehler = [];
      if (atk(t, me, 0) !== BASIS) fehler.push(`${st}: ${atk(t, me, 0)} != ${BASIS}`);
      fehler.push(...basisAlle(t, 2, [[me, 0]]));
      R.check(`Wirt ${st}: Helm-Held bleibt ${BASIS}`, fehler.length === 0 && sauber(t), fehler);
    }

    // ═══ (R) Rückstoß ═══
    const angriff = async (t, seat, heroIdx, zielSeat, zielHero, o = {}) => {
      t.policy.confirm = true;
      t.targetFn = (valid) => {
        const v = o.kreatur ? valid.find(x => x.type !== 'hero' && x.owner === zielSeat) : valid.find(x => x.type === 'hero' && x.owner === zielSeat && x.heroIdx === zielHero);
        return [(v || valid[0]).id];
      };
      return t.play(seat, 'Attack', { hero: heroIdx, active: seat });
    };
    const mkR = async (o = {}) => {
      const t = await U.fresh(me, { hand: [HELM, VIL, 'Attack', 'Attack'], heroes: { [me]: [TUSHU, RICK, ZWEI], [op]: [TUSHU, RICK, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      for (const s of [0, 1]) for (const h of [0, 1, 2]) t.setHero(s, h, t.hero(s, h).name, 2000);
      if (o.kreatur) t.put(op, 0, 0, 'ZZ Dummy Big');
      t.putArea(op, VIL); t.engine.syncAlleAtkAuren();
      if (o.helm) await U.lege(t, me, HELM, o.helmHeld ?? 0);
      t.errors.length = 0; return t;
    };
    R.section(`Sitz ${me} · (R1) Rückstoß: Held MIT Helm erleidet keinen, Held OHNE Helm daneben schon (Heldenziel)`);
    {
      const t = await mkR({ helm: 1 });
      const a = atk(t, me, 0), vorher = t.hp(me, 0), ziel = t.hp(op, 0);
      await angriff(t, me, 0, op, 0);
      const fehler = [];
      if (ziel - t.hp(op, 0) !== a) fehler.push(`Ziel verlor ${ziel - t.hp(op, 0)} != ${a}`);
      if (t.hp(me, 0) !== vorher) fehler.push(`Helm-Held erlitt Rückstoß ${vorher - t.hp(me, 0)}`);
      R.check(`Helm-Held (ATK ${a}, nicht verdoppelt): Ziel verliert ${a}, KEIN Rückstoß`, fehler.length === 0 && sauber(t), fehler);
      const g = await mkR({ helm: 1, helmHeld: 0 });
      const a1 = atk(g, me, 1), v1 = g.hp(me, 1), z1 = g.hp(op, 0);
      await angriff(g, me, 1, op, 0);
      const f2 = [];
      if (z1 - g.hp(op, 0) !== a1) f2.push(`Ziel verlor ${z1 - g.hp(op, 0)} != ${a1}`);
      if (v1 - g.hp(me, 1) !== Math.ceil(a1 / 2)) f2.push(`Held ohne Helm: Rückstoß ${v1 - g.hp(me, 1)} != ${Math.ceil(a1 / 2)}`);
      if (g.hp(me, 0) !== 2000) f2.push('Helm-Held (unbeteiligt) verlor HP');
      R.check(`Gegenprobe: Held 1 ohne Helm daneben (ATK ${a1} doppelt) erleidet ${Math.ceil(a1 / 2)} Rückstoß`, f2.length === 0 && sauber(g), f2);
    }
    R.section(`Sitz ${me} · (R2) Rückstoß bei Kreaturenziel: Helm-Held keiner, Held ohne Helm schon`);
    for (const helmHeld of [true, false]) {
      const t = await mkR({ helm: 1, kreatur: 1, helmHeld: 0 });
      const hi = helmHeld ? 0 : 1;
      const a = atk(t, me, hi), v = t.hp(me, hi);
      await angriff(t, me, hi, op, 0, { kreatur: true });
      const kre = t.engine.cardInstances.find(c => c.name === 'ZZ Dummy Big' && c.zone === 'support');
      const fehler = [];
      const verlor = v - t.hp(me, hi);
      const soll = helmHeld ? 0 : Math.ceil(a / 2);
      if (verlor !== soll) fehler.push(`Rückstoß ${verlor} != ${soll} (ATK ${a})`);
      if (!kre) R.note('Kreatur nicht gefunden (Aufbau)', {});
      R.check(`Kreaturenziel, Held ${hi} (${helmHeld ? 'mit' : 'ohne'} Helm, ATK ${a}): Rückstoß ${soll}`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (R3) Gegnerseite: Helm am Gegnerhelden, der angreift (Gegnerzug)`);
    for (const mitHelm of [true, false]) {
      const t = await mkR();
      if (mitHelm) { t.addHand(op, HELM); await t.play(op, HELM, { hero: 0, active: op }); }
      t.addHand(op, 'Attack');
      const a = atk(t, op, 0), v = t.hp(op, 0);
      await angriff(t, op, 0, me, 0);
      const verlor = v - t.hp(op, 0), soll = mitHelm ? 0 : Math.ceil(a / 2);
      const fehler = [];
      if (verlor !== soll) fehler.push(`Rückstoß ${verlor} != ${soll} (ATK ${a})`);
      R.check(`Gegnerheld ${mitHelm ? 'mit' : 'ohne'} Helm (ATK ${a}): Rückstoß ${soll}`, fehler.length === 0 && sauber(t), fehler);
    }
    R.section(`Sitz ${me} · (R4) Helm kommt/geht zwischen den Zügen: Rückstoß folgt dem aktuellen Zustand`);
    {
      const t = await mkR({ helm: 1 });
      await zerstoere(t, helmInst(t, me));
      const a = atk(t, me, 0), v = t.hp(me, 0);
      await angriff(t, me, 0, op, 0);
      const fehler = [];
      if (a !== 2 * BASIS) fehler.push(`ATK nach Helm weg ${a} != ${2 * BASIS}`);
      if (v - t.hp(me, 0) !== Math.ceil(a / 2)) fehler.push(`Rückstoß ${v - t.hp(me, 0)} != ${Math.ceil(a / 2)}`);
      R.check(`Helm weg → Held doppelt (${a}) und erleidet ${Math.ceil(a / 2)} Rückstoß`, fehler.length === 0 && sauber(t), fehler);
      const u = await mkR();
      await U.lege(u, me, HELM, 0);
      const a2 = atk(u, me, 0), v2 = u.hp(me, 0);
      await angriff(u, me, 0, op, 0);
      const f2 = [];
      if (a2 !== BASIS) f2.push(`ATK mit Helm ${a2}`);
      if (u.hp(me, 0) !== v2) f2.push(`Rückstoß ${v2 - u.hp(me, 0)}`);
      R.check('Helm erst nach dem Dorf angelegt: Basis-ATK, kein Rückstoß', f2.length === 0 && sauber(u), f2);
    }
    R.section(`Sitz ${me} · (R5) Spieler-Limit „no player can use more than 1 Attack per turn" bleibt: die Attack des Helm-Helden zählt`);
    {
      const t = await mkR({ helm: 1 });
      await angriff(t, me, 0, op, 0);
      const z = t.hp(op, 1), zaehler = t.gs.players[me].attacksPlayedThisTurn;
      t.addHand(me, 'Attack');
      await angriff(t, me, 1, op, 1);
      const fehler = [];
      if (zaehler !== 1) fehler.push(`Zähler nach der Helm-Attack ${zaehler} != 1`);
      if (t.hp(op, 1) !== z) fehler.push('zweite Attack ging durch (Limit greift nicht mehr)');
      R.check('erste Attack (Helm-Held) zählt; die zweite Attack desselben Spielers wird gesperrt', fehler.length === 0, fehler);
    }
  }

  // ═══ (F) Differenztest (pro Sitz) ═══
  for (const me of [0, 1]) {
    const op = 1 - me;
    const mk = async () => {
      const hand = ['Ancient Tech Infinite Energy Core', CLUB, 'Curse', CYK, GOR, CEN, 'Fighting', ASC, ASC, VIL, VIL, HELM, HELM, HELM, HELM, FR, FR, FR, CE, CE, 'Dark Ocean', 'Heal'];
      const t = await U.fresh(me, { hand, heroes: { [me]: [RIF, RIF, TUSHU], [op]: [RIF, TUSHU, ZWEI] } });
      t.gs.turn = Math.max(t.gs.turn || 0, 3); t.errors.length = 0; t.state = {}; return t;
    };
    const lebt = (t, s, h) => t.hero(s, h).hp > 0;
    const S = {
      'helm+': async t => { if (lebt(t, me, 0) && !helmInst(t, me)) await U.lege(t, me, HELM, 0); },
      'helm1+': async t => { if (lebt(t, me, 1) && !helmInst(t, me)) await U.lege(t, me, HELM, 1); },
      'helmOp+': async t => { if (lebt(t, op, 0) && !helmInst(t, op)) { t.addHand(op, HELM); await t.play(op, HELM, { hero: 0, active: op }); t.gs.activePlayer = me; } },
      'helm-': async t => { const c = helmInst(t, me); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})); },
      'helmOp-': async t => { const c = helmInst(t, op); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: me }, c, {})); },
      'helmHand': async t => { const c = helmInst(t, me); if (c) await t.run(() => t.engine.actionMoveCard(c, 'hand', -1, -1, { source: 'T' })); },
      'helmFridge': async t => { const c = helmInst(t, me); if (!c) return; const nach = [0, 1, 2].find(h => h !== c.heroIdx && lebt(t, me, h)); if (nach != null) await U.bewege(t, me, 'fridge', { name: HELM, nach, besitzer: me }); },
      'helmCeremony': async t => { const c = helmInst(t, me); if (!c) return; const nach = [0, 1, 2].find(h => h !== c.heroIdx && lebt(t, me, h)); if (nach != null && lebt(t, me, c.heroIdx)) await U.bewege(t, me, 'ceremony', { name: HELM, nach, von: c.heroIdx, besitzer: me }); },
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
      'fight': async t => { if (lebt(t, me, 0) && !t.inst(c => c.name === 'Fighting' && c.zone === 'ability' && c.owner === me).length) await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0, active: me }); },
      'zuwachs': async t => { t.engine.actionPermAtk(t.hero(me, 0), me, 0, 25, 'Test'); },
      'gabe': async t => { t.engine.grantTempHeroAtk(me, 0, 100, { expiresAtTurn: t.gs.turn + 1, expiresForPlayer: op, source: 'Test' }); },
      'umlauf': async t => { await t.endTurn(); await t.endTurn(); },
      'teleport': async t => { if (t.state.tp || !t.hero(me, 1).name || t.hero(me, 1).hp <= 0) return; t.state.tp = 1; t.addHand(op, TP);
        t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 1); return x ? [x.id] : null; };
        t.gs.activePlayer = op; t.phase(3); await t.play(op, TP, { hero: 0, active: op }); t.gs.activePlayer = me; },
    };
    const DORF = {
      'Dorf kommt (eigener Sitz)': async t => { t.addHand(me, VIL); await t.play(me, VIL, { hero: 2, active: me }); },
      'Dorf kommt (Gegner)': async t => { t.addHand(op, VIL); await t.play(op, VIL, { hero: 2, active: op }); },
      'Dorf entfernt': async t => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.removeArea(i, 'Test', { skipProtection: true })); },
      'Dorf gelöscht': async t => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.deleteArea(i, 'Test', { skipProtection: true })); },
      'Dorf zerstört': async t => { const i = t.find(VIL, 'area'); if (i) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, i, {})); },
    };
    const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    const vergleiche = (A, B) => {
      const bad = [], f = Math.pow(2, areaAnzahl(A));
      for (const s of [0, 1]) for (const h of [0, 1, 2]) {
        const a = A.hero(s, h), b = B.hero(s, h); if (!a || !b || !a.name || !b.name) continue;
        if (a.name !== b.name) bad.push(`S${s}H${h} Name ${a.name} != ${b.name}`);
        const ha = helmAn(A, s, h), hb = helmAn(B, s, h);
        if (ha !== hb) bad.push(`S${s}H${h} Helm-Zustand A=${ha} B=${hb} (Schrittfolge ungleich)`);
        const soll = (ha ? 1 : f) * b.atk;
        if (a.atk !== soll) bad.push(`S${s}H${h} ${a.name.split(',')[0]} (hp ${a.hp}, ${ha ? 'MIT' : 'ohne'} Helm): A=${a.atk} B=${b.atk} Faktor ${ha ? 1 : f} → soll ${soll}, Aura-Buchung ${a._atkAuraGrant || 0}${a.statuses && a.statuses.cursed ? ', verflucht' : ''}`);
        if ((ha || f === 1) && (a._atkAuraGrant || 0) !== 0 && !(a.statuses && a.statuses.cursed)) bad.push(`S${s}H${h} Restbuchung der Aura ${a._atkAuraGrant} (Helm oder ohne Dorf)`);
      }
      return bad;
    };
    R.section(`Sitz ${me} · (F) Differenztest: A (mit Dorf-Ereignissen) gegen B (ohne): Helm-Held == B, sonst 2^Dörfer × B — nach jedem Schritt`);
    {
      const namen = Object.keys(S), dn = Object.keys(DORF);
      let fails = 0, schritteGesamt = 0, mitHelmUndDorf = 0; const meldungen = [];
      const N = 90;
      for (let seed = 1; seed <= N; seed++) {
        const r = rng(seed * 104729 + me), A = await mk(), B = await mk(), seq = [];
        for (let i = 0; i < 16; i++) {
          const v = r() < 0.3, k = v ? dn[Math.floor(r() * dn.length)] : namen[Math.floor(r() * namen.length)];
          seq.push(k);
          if (v) { const ap = A.gs.activePlayer, ph = A.gs.currentPhase; await DORF[k](A); A.gs.activePlayer = ap; A.gs.currentPhase = ph; }
          else { await S[k](A); await S[k](B); }
          schritteGesamt++;
          if (areaAnzahl(A) && [0, 1].some(s => [0, 1, 2].some(h => helmAn(A, s, h)))) mitHelmUndDorf++;
          const bad = vergleiche(A, B); if (A.errors.length || B.errors.length) bad.push('ERR ' + (A.errors[0] || B.errors[0]));
          if (bad.length) { fails++; if (meldungen.length < 3) meldungen.push(`Folge ${seed} nach [${seq.join(' → ')}]: ${bad.slice(0, 2).join(' ; ')}`); break; }
        }
      }
      R.check(`${N} Folgen × 16 Schritte (${schritteGesamt} Schritte, davon ${mitHelmUndDorf} mit Helm UND Dorf auf dem Brett): Helm-Held == Szene ohne Dorf, übrige == 2^Dörfer × B`, fails === 0 && mitHelmUndDorf > 100, meldungen.length ? meldungen : { mitHelmUndDorf });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('FATAL ' + (e && e.stack || e) + '\n'); process.exit(2); });

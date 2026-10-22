'use strict';
// W53a · Punkt 3 (Fortsetzung): der zentrale Baustein für Ausrüstungs-ATK, `engine.actionSetAtkGrant(inst, amount)` (+ `actionRevokeAtkAmTraeger`, Stempel `counters._atkTraeger`).
//   Entscheidung (Begründung in CARD_API „Welle 53 / W53a"): ATK ist in dieser Engine ein GEMUTETER Wert (`hero.atk`), in den ein Dutzend Quellen einzahlen (Fighting, Fluch-Unterdrückung, ATK-Auren,
//   Cloak of Edge, Taio/Toras, Nero/Rakah …) — „ATK als abgeleiteter Wert aus den ausgerüsteten Instanzen" würde alles davon umschreiben. Gewählt: die Buchung pro Instanz auf den ZIELWERT stellen und
//   an den Träger stempeln. Wirkung: (1) zweimal gebucht = einmal (kein zweiter Bonus), (2) abgezogen wird dort, wo die Buchung liegt, (3) wer den Träger wechselt, ohne dass der Leave-Haken abzog,
//   bucht am neuen Träger um, (4) eine Karte, die nicht mehr auf dem Brett liegt, trägt keine Buchung mehr (Sicherheitsnetz in `sync`), (5) Slippery Fridge / Ceremony lassen nichts am Ex-Träger.
// Geprüft (beide Sitze): Doppel-`onPlay` aller 21 ATK-Equips · dynamische Boni idempotent · Träger ohne Leave-Haken gewechselt · Karte ohne Leave-Haken aus der Zone · Fridge mit abgeschaltetem Leave-Haken ·
//   Fluch (vor/nach dem Equip, Fridge unter Fluch, Fluch heilen) · Status am Wirt (negated/frozen/stunned/magic_silenced) · geliehener (Charme-)Held · Formwechsel (Aufstieg/Abstieg mit Club + Fighting) ·
//   Cloak of Edge (dauerhafter Zuwachs) bleibt unberührt.
// Auf dem Stand vor W53a rot (Doppel-`onPlay` verdoppelte den Bonus; Träger-Wechsel/Orphan/Fridge ließen den Bonus stehen). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const STATIC = {
  'Blade of the Frostbringer': 10, 'Blade of the Swamp Witch': 10, 'Club of Gobbo': 30, 'Earth-Shattering Hammer, Relic of Deri': 10,
  "Explosivo's Sword": 10, 'Future Tech Laser Cannon': 100, 'Heart-Shaped Bow, the Final Proof of Cuteness': 10, 'Legendary Sword of a Barbarian King': 10,
  'Lunatic Cycle - Full Moon': 100, 'Mana-Consuming Blade': 10, 'Modnir, Hammer of Coolness': 100, 'Phalanx Pike': 30, 'Sacred Hammer of the Volcano': 30,
  'Shattered Trident, Treasure of the Deepsea': 10, 'Super-Killing Knife, the Tool of Liquidation': 10, 'The Hands of Big Gwen': 10, "The Master's Sword": 10,
  'The Sun Sword': 20, 'Vampiric Sword': 10,
};
const DYN = {
  'Ancient Tech Infinite Energy Core': (t, c) => 10 * new Set((t.gs.players[c.controller ?? c.owner].discardPile || []).map(n => n.replace(/\s*\(.*\)$/, ''))).size,
  'Future Tech Gun': (t, c) => 40 * (t.gs.players[c.controller ?? c.owner].discardPile || []).filter(n => n === 'Future Tech Gun').length,
};
const ALL = [...Object.keys(STATIC), ...Object.keys(DYN)];
const CLUB_ = 'Club of Gobbo';
const bonusVon = (t, c) => STATIC[c.name] != null ? STATIC[c.name] : DYN[c.name](t, c);

function erwartet(t, s, hi) {
  const h = t.gs.players[s].heroes[hi]; if (!h || !h.name) return null;
  if (h.statuses && h.statuses.cursed) return 0;
  let a = t.DB[h.name].atk || 0;
  for (const c of t.engine.cardInstances) {
    if (c.zone !== 'support' || t.engine.physicalSide(c) !== s || c.heroIdx !== hi) continue;
    if (STATIC[c.name] != null || DYN[c.name]) a += bonusVon(t, c);
  }
  return a;
}
function pruefe(t) {
  const bad = [];
  for (let s = 0; s < 2; s++) for (let hi = 0; hi < 3; hi++) {
    const e = erwartet(t, s, hi); if (e == null) continue;
    const h = t.gs.players[s].heroes[hi];
    if (h.hp > 0 && h.atk !== e) bad.push(`S${s}H${hi} ${h.name.split(',')[0]}: atk ${h.atk} != erwartet ${e}`);
  }
  return bad;
}
async function aufbau(me, name, extraHand = []) {
  const t = await U.fresh(me, { hand: extraHand });
  if (name === 'Lunatic Cycle - Full Moon') t.put(me, 2, 0, 'Lunatic Cycle - Gibbous Moon');
  if (name === 'Future Tech Gun') t.setDiscard(me, ['Future Tech Gun', 'Future Tech Gun']);            // dynamische Boni mit Wert > 0: 2 Guns / 2 Namen in der Ablage
  if (name === 'Ancient Tech Infinite Energy Core') t.setDiscard(me, ['ZZ Filler', 'ZZ Trinket']);
  return t;
}
async function lege(t, me, name, hi, slot) {
  if (name === 'Modnir, Hammer of Coolness') {
    const s = slot ?? t.gs.players[me].supportZones[hi].findIndex(z => z.length === 0);
    const inst = t.put(me, hi, s, name);
    await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, card: inst, cardName: name, zone: 'support', heroIdx: hi, zoneSlot: s, _skipReactionCheck: true }));
    return inst;
  }
  await U.lege(t, me, name, hi, slot);
  return t.inst(c => c.name === name && c.zone === 'support' && c.heroIdx === hi)[0];
}
const onPlayNochmal = (t, inst) => t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, card: inst, cardName: inst.name, zone: 'support', heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, _skipReactionCheck: true }));
const refresh = (t) => t.run(() => t.engine.runHooks('onAnyActionResolved', {}));

(async () => {
  const R = U.H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me}`);

    // ═══ (1) zweimal gefeuertes onPlay bucht den Bonus nicht zweimal; (2) ein Träger-Wechsel ohne Leave-Haken bucht um; (3) Karte ohne Leave-Haken aus der Zone → keine Buchung mehr ═══
    const fehl = { doppelt: [], wechsel: [], orphan: [], idem: [] };
    for (const name of ALL) {
      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); const a0 = t.hero(me, 0).atk;
        await onPlayNochmal(t, i); await onPlayNochmal(t, i); await refresh(t);
        if (t.hero(me, 0).atk !== a0 || i.counters.atkGranted !== bonusVon(t, i) || pruefe(t).length) fehl.doppelt.push(`${name}: atk ${a0}→${t.hero(me, 0).atk}, ag ${i.counters.atkGranted}`); }
      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); const a0 = t.hero(me, 0).atk;
        // „Wirtswechsel" ohne Leave-Haken: Zone und Instanz roh auf Held 1 umsetzen, danach feuert onPlay (so wie jeder Einsetz-Weg es tut)
        const z = t.gs.players[me].supportZones; z[0][i.zoneSlot] = []; z[1][0] = [name]; i.heroIdx = 1; i.zoneSlot = 0;
        await onPlayNochmal(t, i); await refresh(t);
        const e = pruefe(t);
        if (e.length || t.hero(me, 0).atk !== a0 - bonusVon(t, i) || (i.counters._atkTraeger || {}).heroIdx !== 1) fehl.wechsel.push(`${name}: h0 ${t.hero(me, 0).atk} (soll ${a0 - bonusVon(t, i)}), h1 ${t.hero(me, 1).atk}, stempel ${JSON.stringify(i.counters._atkTraeger)} ${e.join(';')}`); }
      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); const a0 = t.hero(me, 0).atk;
        // roh aus der Zone nehmen (ein Abgangsweg ohne jeden Hook): Zone leer, Instanz in der Ablage
        t.gs.players[me].supportZones[0][i.zoneSlot] = []; i.zone = 'discard'; i.heroIdx = -1; i.zoneSlot = -1; t.gs.players[me].discardPile.push(name);
        t.engine.sync();
        const base = t.DB[t.hero(me, 0).name].atk;
        if (t.hero(me, 0).atk !== base || (i.counters.atkGranted || 0) !== 0) fehl.orphan.push(`${name}: atk ${t.hero(me, 0).atk} (Basis ${base}), ag ${i.counters.atkGranted}`); }
    }
    for (const name of ['Ancient Tech Infinite Energy Core', 'Future Tech Gun', 'Future Tech Laser Cannon']) {   // dynamisch / Zielwert: Nachrechnen ist idempotent
      const t = await aufbau(me, name); const i = await lege(t, me, name, 0); const a0 = t.hero(me, 0).atk;
      for (let k = 0; k < 3; k++) await t.run(() => t.engine.runHooks('onTurnStart', { turn: 5, activePlayer: me }));
      await refresh(t); await refresh(t);
      if (t.hero(me, 0).atk !== a0) fehl.idem.push(`${name}: ${a0} → ${t.hero(me, 0).atk}`);
    }
    R.check('21 ATK-Equips: onPlay zweimal zusätzlich gefeuert → der Bonus liegt weiter genau einmal (ATK und atkGranted unverändert)', fehl.doppelt.length === 0, fehl.doppelt);
    R.check('21 ATK-Equips: Träger ohne Leave-Haken gewechselt → Bonus am Ex-Träger weg, am neuen Träger da, Stempel zeigt auf ihn', fehl.wechsel.length === 0, fehl.wechsel);
    R.check('21 ATK-Equips: Karte ohne Leave-Haken aus der Zone genommen → Sicherheitsnetz in sync zieht den Bonus ab', fehl.orphan.length === 0, fehl.orphan);
    R.check('Dynamische Boni (Core, Gun) und Laser Cannon: mehrfaches Nachrechnen ändert nichts', fehl.idem.length === 0, fehl.idem);

    // ═══ (4) Slippery Fridge / Ceremony mit abgeschaltetem Leave-Haken des Equips: nichts bleibt am Ex-Träger ═══
    for (const via of ['fridge', 'ceremony']) {
      const bad = [];
      for (const name of ['Club of Gobbo', 'The Sun Sword', 'Phalanx Pike', 'Future Tech Laser Cannon', 'Future Tech Gun']) {
        const sk = U.H.loadCardEffect(name); const orig = sk.hooks.onCardLeaveZone; sk.hooks.onCardLeaveZone = async () => {};
        try {
          const t = await aufbau(me, name); await lege(t, me, name, 0); t.reset();
          await U.bewege(t, me, via, { name, nach: 1 });
          const e = pruefe(t); if (e.length) bad.push(`${name}: ${e.join('; ')}`);
        } finally { sk.hooks.onCardLeaveZone = orig; }
      }
      R.check(`${via}: selbst wenn der Leave-Haken des Equips nichts abzieht — der Bonus liegt nur am Zielhelden`, bad.length === 0, bad);
    }

    // ═══ (5) Fluch, Status am Wirt, Charme (alle 21) ═══
    const f2 = { fluchA: [], fluchB: [], status: [], charme: [] };
    for (const name of ALL) {
      const op2 = op;
      { const t = await aufbau(me, name, ['Curse']); await U.haenge(t, me, 'Curse', 0);
        await lege(t, me, name, 0); let e = pruefe(t);
        t.reset(); await U.bewege(t, me, 'fridge', { name, nach: 1 }); e = e.concat(pruefe(t));
        const cu = t.find('Curse', 'support'); if (cu) { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op2 }, cu, {})); await refresh(t); e = e.concat(pruefe(t)); }
        if (e.length) f2.fluchA.push(`${name}: ${e.join('; ')}`); }
      { const t = await aufbau(me, name, ['Curse']); await lege(t, me, name, 0); await U.haenge(t, me, 'Curse', 0); let e = pruefe(t);
        t.reset(); await U.bewege(t, me, 'fridge', { name, nach: 1 }); e = e.concat(pruefe(t));
        const cu = t.find('Curse', 'support'); if (cu) { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op2 }, cu, {})); await refresh(t); e = e.concat(pruefe(t)); }
        const i = t.find(name, 'support'); if (i) { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op2 }, i, {})); await refresh(t); e = e.concat(pruefe(t)); }
        if (e.length) f2.fluchB.push(`${name}: ${e.join('; ')}`); }
      for (const st of ['negated', 'frozen', 'stunned', 'magic_silenced']) {
        const t = await aufbau(me, name); t.heroStatus(me, 0, st); await lege(t, me, name, 0); let e = pruefe(t);
        t.reset(); await U.bewege(t, me, 'fridge', { name, nach: 1 }); e = e.concat(pruefe(t));
        const i = t.find(name, 'support'); if (i) { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, i, {})); e = e.concat(pruefe(t)); }
        if (e.length) f2.status.push(`${name}/${st}: ${e.join('; ')}`);
      }
      { const t = await aufbau(me, name); t.hero(op, 0).charmedBy = me; t.hero(op, 0).charmedUntil = 99;
        await t.play(me, name, { hero: 0, targetOwner: op, active: me });
        // dynamische Boni zählen „deine Ablage" des Kontrolleurs — unter Charme der Ausrüstende, danach der Kontrolleur des Wirts: Zwischenstände nur für feste Boni prüfen
        let e = DYN[name] ? [] : pruefe(t);
        delete t.hero(op, 0).charmedBy; delete t.hero(op, 0).charmedUntil; if (!DYN[name]) e = e.concat(pruefe(t));
        const i = t.find(name, 'support'); if (i) { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, i, {})); e = e.concat(pruefe(t)); }
        if (e.length) f2.charme.push(`${name}: ${e.join('; ')}`); }
    }
    R.check('Fluch zuerst (Equip unter Fluch, Fridge, Fluch geheilt): ATK == direkt', f2.fluchA.length === 0, f2.fluchA);
    R.check('Equip zuerst, dann Fluch (Fridge von verfluchtem Wirt, Fluch geheilt, Equip zerstört): ATK == direkt', f2.fluchB.length === 0, f2.fluchB);
    R.check('Wirt negated/frozen/stunned/magic_silenced: anlegen, umhängen, zerstören → ATK == direkt', f2.status.length === 0, f2.status);
    R.check('Geliehener (Charme-)Held: ausrüsten, Charme endet, zerstören → ATK == direkt', f2.charme.length === 0, f2.charme);

    // ═══ (7) Formwechsel (Aufstieg / Abstieg): `hero.atk` wird auf den gedruckten Wert der neuen Form gesetzt — die Boni der Karten, die WEITER am Helden liegen, müssen mit ═══
    //   Vorher: Club + Fighting-Boni gingen beim Aufstieg verloren, ihr späterer Abgang zog sie trotzdem ab → ATK unter dem gedruckten Wert (Riffel 90 → 50).
    { const RIF = 'Future Tech Gunslinger Riffel', ASC = 'Riffel, Master of the Ultimate Gun';
      const t = await U.fresh(me, { hand: [ASC, CLUB_], heroes: { [me]: [RIF, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
      const summe = () => t.inst(c => c.heroIdx === 0 && (c.owner === me || t.engine.physicalSide(c) === me) && (c.zone === 'ability' || (c.zone === 'support' && c.counters._atkTraeger))).reduce((n, c) => n + (c.counters.atkGranted || 0), 0);
      const soll = () => t.DB[t.hero(me, 0).name].atk + summe();
      await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0 });
      await U.lege(t, me, CLUB_, 0);
      R.check('Formwechsel: Ausgang — Riffel + Fighting + Club, ATK == gedruckt + Boni', t.hero(me, 0).atk === soll(), { atk: t.hero(me, 0).atk, soll: soll() });
      t.gs.activePlayer = me; t.phase(2); t.hero(me, 0).ascensionReady = true;
      const r = await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true }));
      R.check('Aufstieg: Club- und Fighting-Boni liegen weiter am Helden (ATK == gedruckter Wert der neuen Form + Boni der noch liegenden Karten)', r && r.success === true && t.hero(me, 0).name === ASC && t.hero(me, 0).atk === soll() && summe() >= 40, { r, atk: t.hero(me, 0).atk, soll: soll(), bonus: summe() });
      const club = t.find(CLUB_, 'support');
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, club, {}));
      R.check('Aufstieg, dann Club zerstört: ATK == gedruckt + Boni der übrigen Karten (kein doppelter Abzug)', t.hero(me, 0).atk === soll(), { atk: t.hero(me, 0).atk, soll: soll() });
      for (const f of t.inst(c => c.name === 'Fighting' && c.zone === 'ability')) await t.run(() => t.engine.actionMoveCard(f, 'discard', -1, -1, { source: 'T', sourceOwner: op }));
      R.check('Aufstieg, dann Fighting abgelegt: ATK == gedruckter Wert (nicht darunter)', t.hero(me, 0).atk === t.DB[ASC].atk && t.errors.length === 0, { atk: t.hero(me, 0).atk, gedruckt: t.DB[ASC].atk, e: t.errors }); }
    { const RIF = 'Future Tech Gunslinger Riffel', ASC = 'Riffel, Master of the Ultimate Gun';
      const t = await U.fresh(me, { hand: [ASC, CLUB_], heroes: { [me]: [RIF, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
      t.gs.activePlayer = me; t.phase(2); t.hero(me, 0).ascensionReady = true;
      await t.run(() => t.engine.performAscension(me, 0, ASC, t.gs.players[me].hand.indexOf(ASC), { skipCondition: true }));
      await U.lege(t, me, CLUB_, 0);
      const mit = t.hero(me, 0).atk;
      const r = await t.run(() => t.engine.performDescend(me, 0, {}));
      const club = t.find(CLUB_, 'support');
      R.check('Abstieg mit Club: ATK == gedruckter Wert der Basisform + Club (30)', r && r.success !== false && t.hero(me, 0).name === RIF && t.hero(me, 0).atk === t.DB[RIF].atk + 30, { r, atk: t.hero(me, 0).atk, mit });
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, club, {}));
      R.check('Abstieg, dann Club zerstört: ATK == gedruckter Wert der Basisform', t.hero(me, 0).atk === t.DB[RIF].atk && t.errors.length === 0, { atk: t.hero(me, 0).atk, e: t.errors }); }

    // ═══ (6) Cloak of Edge: DAUERHAFTER Zuwachs bleibt (kein Stempel, kein Abzug beim Umhängen/Zerstören) ═══
    { const CLOAK = 'Cloak of Edge';
      const t = await U.fresh(me, { hand: [CLOAK] });
      await U.lege(t, me, CLOAK, 0);
      const a0 = t.hero(me, 0).atk;
      const r = await t.activateEquip(me, 0, t.find(CLOAK, 'support').zoneSlot, {});
      R.check('Cloak of Edge: +20 ATK einmal', r !== false && t.hero(me, 0).atk === a0 + 20, { r, a0, a: t.hero(me, 0).atk });
      t.reset(); await U.bewege(t, me, 'fridge', { name: CLOAK, nach: 1 });
      R.check('Cloak of Edge umgehängt: der dauerhafte Zuwachs bleibt am Helden 0, Held 1 unverändert', t.hero(me, 0).atk === a0 + 20 && t.hero(me, 1).atk === t.DB[t.hero(me, 1).name].atk, { a0: t.hero(me, 0).atk, a1: t.hero(me, 1).atk });
      const c = t.find(CLOAK, 'support'); await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {}));
      R.check('Cloak of Edge zerstört: der dauerhafte Zuwachs bleibt (permanently)', t.hero(me, 0).atk === a0 + 20, t.hero(me, 0).atk);
      R.check('Cloak: sauber', t.errors.length === 0, t.errors); }
  }
  R.finish();
})();

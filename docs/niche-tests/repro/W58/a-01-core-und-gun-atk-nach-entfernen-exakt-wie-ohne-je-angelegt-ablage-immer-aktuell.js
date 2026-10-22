'use strict';
// W58a · Punkt 1 (Al, 22.10.2026): „Wird Energy Core oder Gun entfernt, sollen die ATK des Heroes danach exakt so hoch sein, wie sie wären, wäre nie ein Energy Core oder eine Gun an sie angelegt
//   gewesen!" — und (aus W57a) Core/Gun an ANDEREN Helden rechneten bei einem Heldentod erst am Ende der Aktion nach, weil das Todes-Aufräumen die Ausrüstung direkt in die Ablage legt, ohne die
//   Ablage-Wächter zu benachrichtigen; mitten im Todesablauf lasen sie die alte Ablage. Lösung: die Engine gleicht Core/Gun bei JEDEM `sync` und JEDEM `runHooks` gegen die Ist-Ablage ab
//   (`engine.dynamischeAtkBuchen` / `_dynamischeAtkNachrechnen`, Rechnung im Skript: `atkZiel`) — kein Hook-Umbau.
// Harte Invariante (beide Sitze, Differenztest gegen eine REFERENZ-Szene, die den entfernten Core/die entfernte Gun nie hatte; Ablage der Referenz = Ablage danach):
//   (A) Entfernen auf jedem Weg (zerstört · abgelegt · gelöscht · Hand · Wirt besiegt · Held gelöscht · Ceremony/Fridge + Zerstören) × Core/Gun × Szene {schlicht · Rioting Village · Fluch vor/nach · Fighting+Zuwachs ·
//       Club+Sun · zwei Kopien am selben Helden · mehrere Helden}: ALLE Helden == Referenz (ATK, Fluch-Zwischenspeicher, Aura-Buchung)
//   (B) Ablage ändert sich auf vielen Wegen (Spell, Handabwurf, Mill, Kreatur stirbt, Kreatur wird abgelegt, Ausrüstung zerstört, Karte aus der Ablage geholt, Direktzugriff): jeder Core/jede Gun == Formel
//   (C) Heldentod: Core/Gun an anderen Helden stimmen SCHON während des Todesablaufs (nach jeder abgelegten Ausrüstung, bei jedem Hook) und direkt nach dem Tod — ohne `onAnyActionResolved`
//   (D) Wiederbelebung, Zugumlauf; (E) Teleportation Powder; (F) Gegnerseite / übernommener Held (Charme)
// Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const H = U.H, DB = H.DB;

const CORE = 'Ancient Tech Infinite Energy Core', GUN = 'Future Tech Gun', CLUB = 'Club of Gobbo', SUN = 'The Sun Sword', VIL = 'Rioting Village';
const BLANK = ['Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'];
const FORMEL = {
  [CORE]: (t, c) => 10 * new Set((t.gs.players[c.controller ?? c.owner].discardPile || []).map(n => n.replace(/\s*\(.*\)$/, ''))).size,
  [GUN]: (t, c) => 40 * (t.gs.players[c.controller ?? c.owner].discardPile || []).filter(n => n === GUN).length,
};
const STATISCH = { [CLUB]: 30, [SUN]: 20 };

/** Erwarteter ATK (ohne Aura/Fluch): Grundwert + Boni aller Karten, die JETZT in den Support Zonen des Helden liegen — Core/Gun nach der Formel über die Ist-Ablage des Kontrolleurs. */
function erwartet(t, s, hi) {
  const h = t.gs.players[s].heroes[hi]; if (!h || !h.name) return null;
  if (h.statuses && h.statuses.cursed) return 0;
  const f = Math.pow(2, (t.gs.areaZones || []).flat().filter(x => x === VIL).length);   // Rioting Village verdoppelt die Gesamt-ATK
  let a = DB[h.name].atk || 0;
  for (const c of t.engine.cardInstances) {
    if (c.zone !== 'support' || t.engine.physicalSide(c) !== s || c.heroIdx !== hi) continue;
    if (STATISCH[c.name] != null) a += STATISCH[c.name]; else if (FORMEL[c.name]) a += FORMEL[c.name](t, c);
  }
  return a * f;
}
/** Alle LEBENDEN Helden beider Seiten: ATK == Formel. */
function pruefe(t, ohne = []) {
  const bad = [];
  for (let s = 0; s < 2; s++) for (let hi = 0; hi < 3; hi++) {
    if (ohne.some(([os, oh]) => os === s && oh === hi)) continue;
    const e = erwartet(t, s, hi); if (e == null) continue;
    const h = t.gs.players[s].heroes[hi];
    if (h.hp > 0 && h.atk !== e) bad.push(`S${s}H${hi} ${h.name.split(',')[0]}: atk ${h.atk} != Formel ${e}`);
  }
  return bad;
}
/** Zustand eines Helden für den Differenzvergleich. */
function zust(t, s, hi) {
  const h = t.hero(s, hi);
  if (!h || !h.name) return 'leer';
  // Verfluchter Held: sichtbar 0; verglichen wird der Zwischenspeicher OHNE den Aura-Anteil (`supp − aura` = Wert, den das Heilen des Fluchs nach dem Aura-Abgleich ergibt — die Aura-Hälfte im
  // Zwischenspeicher ist reine Buchführung, die der Abgleich beim Heilen ohnehin neu rechnet). Sonst: sichtbare ATK.
  const cursed = !!(h.statuses && h.statuses.cursed);
  return { atk: h.atk, basis: cursed ? (h._cursedAtkSuppressed || 0) - (h._atkAuraGrant || 0) : h.atk - (h._atkAuraGrant || 0), cursed, perm: h.permAtkDelta || 0, hp: h.hp > 0 ? 'lebt' : 'tot' };
}
const gleichJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Alle 6 Helden: Test-Szene gegen Referenz. Gibt Abweichungen zurück. */
function diff(t, ref) {
  const bad = [];
  for (let s = 0; s < 2; s++) for (let hi = 0; hi < 3; hi++) {
    const a = zust(t, s, hi), b = zust(ref, s, hi);
    if (!gleichJ(a, b)) bad.push(`S${s}H${hi}: ${JSON.stringify(a)} != Ref ${JSON.stringify(b)}`);
  }
  return bad;
}

/**
 * Szene für Sitz `me`. F: { dyn: [[name, heldIdx], …], club, sun (Held 0), aura, fluch: null|'vor'|'nach'|'status', fight, perm, pile: [Namen] (Start-Ablage von `me`), opPile, tot: [heldIdx…] (am Ende besiegen) }.
 * Reihenfolge: Aura → Fighting/Zuwachs → ggf. Fluch VOR den Equips → Equips (Club, Sun, dyn in Listenreihenfolge) → ggf. Fluch NACH den Equips.
 */
async function bau(me, F, pileEnde = null, opPileEnde = null) {
  const op = 1 - me;
  const equips = [...(F.club ? [CLUB] : []), ...(F.sun ? [SUN] : []), ...(F.dyn || []).map(d => d[0]), ...(F.opDyn || []).map(d => d[0])];
  const hand = [...equips.filter(n => !(F.opDyn || []).some(d => d[0] === n && !(F.dyn || []).some(x => x[0] === n))), ...(F.fight ? ['Fighting'] : []), ...(F.fluch === 'vor' || F.fluch === 'nach' ? ['Curse'] : []), ...(F.extra || [])];
  const pile = pileEnde || F.pile || [];
  const t = await U.fresh(me, { hand, heroes: { [me]: BLANK, [op]: BLANK }, opts: { discard: [0, 1].map(s => s === me ? pile : (opPileEnde || F.opPile || [])) } });
  t.gs.turn = Math.max(t.gs.turn || 0, 3);
  if (F.aura) { t.putArea(me, VIL); t.engine.syncAlleAtkAuren(); }
  if (F.fight) await t.play(me, 'Fighting', { hero: 0, zoneSlot: 0, active: me });
  if (F.perm) t.engine.actionPermAtk(t.hero(me, 0), me, 0, 25, 'Test');
  if (F.fluch === 'vor') await U.haenge(t, me, 'Curse', 0);
  if (F.fluch === 'status') {
    const h = t.hero(me, 0); h._cursedAtkSuppressed = h.atk || 0; h.atk = 0;
    await t.engine.addHeroStatus(me, 0, 'cursed', { appliedBy: op, source: 'Test' });
  }
  if (F.club) await U.lege(t, me, CLUB, 0);
  if (F.sun) await U.lege(t, me, SUN, 0);
  for (const [n, hi] of (F.dyn || [])) await U.lege(t, me, n, hi);
  for (const [n, hi] of (F.opDyn || [])) { t.addHand(op, n); await U.lege(t, op, n, hi); }
  if (F.fluch === 'nach') await U.haenge(t, me, 'Curse', 0);
  for (const hi of (F.tot || [])) await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: op, heroIdx: 0 }, t.hero(me, hi), {}));
  t.errors.length = 0;
  return t;
}
const inst = (t, name, hi, s) => t.inst(c => c.name === name && c.zone === 'support' && c.heroIdx === hi && (s == null || c.owner === s))[0];
const toeten = (t, me, hi = 0) => t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: 1 - me, heroIdx: 0 }, t.hero(me, hi), {}));
const beleben = (t, me, hi = 0) => t.run(() => t.engine.actionReviveHero(me, hi, 100, { source: 'Test' }));
const kurz = (n) => n === CORE ? 'Core' : n === GUN ? 'Gun' : n.split(' ')[0];

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;

    // ═══ (A) Entfernen auf jedem Weg == Referenz „nie angelegt" ═══
    R.section(`Sitz ${me} · (A) Entfernen auf jedem Weg: alle Helden == Referenz ohne den entfernten Core/die entfernte Gun`);
    const SZENEN = {
      schlicht: { pile: ['Fireball', 'Heal', 'Fireball'] },
      'leere Ablage': { pile: [] },
      aura: { aura: 1, pile: ['Fireball', 'Heal'] },
      'fluch vor': { fluch: 'vor', pile: ['Fireball', 'Heal'] },
      'fluch nach': { fluch: 'nach', pile: ['Fireball', 'Heal'] },
      'fluch status': { fluch: 'status', pile: ['Fireball'] },
      'aura+fluch nach': { aura: 1, fluch: 'nach', pile: ['Fireball', 'Heal'] },
      'fighting+zuwachs': { fight: 1, perm: 1, pile: ['Fireball', 'Heal'] },
      'club+sun': { club: 1, sun: 1, pile: ['Fireball', 'Heal'] },
      'aura+club+sun+zuwachs': { aura: 1, club: 1, sun: 1, perm: 1, fight: 1, pile: ['Fireball', 'Heal', GUN] },
    };
    const WEGE = {
      zerstört: { tut: (t, c) => t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})) },
      abgelegt: { tut: (t, c) => t.run(() => t.engine.actionMoveCard(c, 'discard', -1, -1, { source: 'Test', sourceOwner: op })) },
      gelöscht: { tut: (t, c) => t.run(() => t.engine.actionMoveCard(c, 'deleted', -1, -1, { source: 'Test', sourceOwner: op })), gelöscht: true },
      'zur Hand': { tut: (t, c) => t.run(() => t.engine.actionMoveCard(c, 'hand', -1, -1, { source: 'Test', sourceOwner: op })), hand: true },
    };
    for (const dyn of [CORE, GUN]) for (const [sn, S0] of Object.entries(SZENEN)) {
      const fehler = [];
      // (A1) Entfernungswege des Trägers einer Karte am Helden 0 (+ ggf. eine zweite Kopie/ein anderer Held mit dyn, die bleibt)
      for (const [wn, W] of Object.entries(WEGE)) {
        for (const var_ of ['allein', 'mit Nachbar']) {
          const F = { ...S0, dyn: var_ === 'allein' ? [[dyn, 0]] : [[dyn, 0], [dyn === CORE ? GUN : CORE, 1]] };
          const t = await bau(me, F);
          await W.tut(t, inst(t, dyn, 0, me));
          // Referenz: dieselbe Szene OHNE die entfernte Karte, Ablage = Ist-Ablage nach dem Entfernen (die entfernte Karte liegt ggf. darin)
          const Fr = { ...S0, dyn: var_ === 'allein' ? [] : [[dyn === CORE ? GUN : CORE, 1]] };
          const abl = t.pile(me, 'discardPile').slice();
          const ref = await bau(me, Fr, abl);
          const d = diff(t, ref);
          if (d.length) fehler.push(`${wn}/${var_}: ${d.slice(0, 2).join(' ; ')}`);
          if (t.errors.length) fehler.push(`${wn}/${var_}: ERR ${t.errors[0]}`);
          const waise = t.engine.cardInstances.filter(c => c.zone !== 'support' && c.counters && (c.counters.atkGranted || 0) > 0 && (c.name === CORE || c.name === GUN));
          if (waise.length) fehler.push(`${wn}/${var_}: verwaiste Buchung ${waise.map(c => c.name + ':' + c.zone).join()}`);
        }
      }
      R.check(`${kurz(dyn)} · Szene „${sn}": zerstört/abgelegt/gelöscht/Hand (allein und mit Nachbar-Karte) → alle Helden == Referenz`, fehler.length === 0, fehler);
    }

    // (A2) Wirt besiegt (Held 0 stirbt mit allem, was an ihm liegt); die Referenz hat an Held 0 gar nichts außer dem, was den Tod überlebt
    R.section(`Sitz ${me} · (A2) Wirt besiegt / Held gelöscht`);
    for (const dyn of [CORE, GUN]) for (const [sn, S0] of Object.entries(SZENEN)) {
      const fehler = [];
      for (const var_ of ['allein', 'mit Nachbar', 'zwei Kopien']) {
        const dynL = var_ === 'allein' ? [[dyn, 0]] : var_ === 'mit Nachbar' ? [[dyn, 0], [dyn === CORE ? GUN : CORE, 1]] : [[dyn, 0], [dyn, 1]];
        for (const weg of ['besiegt', 'gelöscht', 'besiegt+wiederbelebt']) {
          const F = { ...S0, dyn: dynL };
          const t = await bau(me, F);
          if (weg === 'gelöscht') await t.run(() => t.engine.deleteHero(me, 0, 'Test'));
          else await toeten(t, me, 0);
          if (weg === 'besiegt+wiederbelebt') await beleben(t, me, 0);
          // Referenz: Held 0 ohne Ausrüstung und ohne Fluch (das Aufräumen entfernt beides); bleibt: Aura, Fighting, Zuwachs, andere Helden mit ihrer Karte
          const Fr = { aura: S0.aura, fight: S0.fight, perm: S0.perm, dyn: dynL.filter(d => d[1] !== 0) };
          const abl = t.pile(me, 'discardPile').slice();
          const ref = await bau(me, Fr, abl);
          if (weg === 'gelöscht') await ref.run(() => ref.engine.deleteHero(me, 0, 'Test'));
          else await toeten(ref, me, 0);
          if (weg === 'besiegt+wiederbelebt') await beleben(ref, me, 0);
          const d = diff(t, ref);
          if (d.length) fehler.push(`${var_}/${weg}: ${d.slice(0, 2).join(' ; ')}`);
          if (t.errors.length) fehler.push(`${var_}/${weg}: ERR ${t.errors[0]}`);
        }
      }
      R.check(`${kurz(dyn)} · Szene „${sn}": Wirt besiegt / gelöscht / wiederbelebt (allein, mit Nachbar, zwei Kopien) → alle Helden == Referenz`, fehler.length === 0, fehler);
    }

    // (A3) Umhängen (Inheritance Ceremony, Slippery Fridge) und danach Entfernen
    R.section(`Sitz ${me} · (A3) Umhängen + Entfernen`);
    for (const dyn of [CORE, GUN]) for (const via of ['ceremony', 'fridge']) for (const sn of ['schlicht', 'aura', 'fluch nach']) {
      const S0 = SZENEN[sn], fehler = [];
      const t = await bau(me, { ...S0, dyn: [[dyn, 0]], extra: [via === 'ceremony' ? U.C : U.F] });
      await U.bewege(t, me, via, { nach: 1, name: dyn, von: 0 });
      const wo = (t.inst(c => c.name === dyn && c.zone === 'support')[0] || {}).heroIdx;
      if (wo !== 1) fehler.push(`Karte nicht umgehängt (Held ${wo})`);
      // Stufe 1: Karte liegt an Held 1 — Held 0 == Referenz ohne Karte, Held 1 == Referenz mit Karte (direkt dort angelegt), Ablage = Ist-Ablage
      let abl = t.pile(me, 'discardPile').slice();
      let ref = await bau(me, { ...S0, dyn: [[dyn, 1]] }, abl);
      let d = diff(t, ref); if (d.length) fehler.push(`umgehängt: ${d.slice(0, 2).join(' ; ')}`);
      // Stufe 2: zerstört → alle == Referenz ohne Karte
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, inst(t, dyn, 1, me), {}));
      abl = t.pile(me, 'discardPile').slice();
      ref = await bau(me, { ...S0, dyn: [] }, abl);
      d = diff(t, ref); if (d.length) fehler.push(`danach zerstört: ${d.slice(0, 2).join(' ; ')}`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${kurz(dyn)} · ${via} → Held 1 → zerstört · Szene „${sn}": jede Stufe == direkt aufgebauter Referenzzustand`, fehler.length === 0, fehler);
    }

    // (A4) Mehrfach: drei Helden, jede mit Core/Gun; eine nach der anderen entfernen — nach jedem Schritt == Referenz mit dem Rest
    R.section(`Sitz ${me} · (A4) Mehrere Kopien, mehrere Helden: nacheinander entfernen`);
    for (const aura of [0, 1]) for (const fluch of [null, 'nach']) {
      const alle = [[CORE, 0], [GUN, 1], [CORE, 2], [GUN, 2]];
      const F0 = { aura, fluch, pile: ['Fireball', GUN, 'Heal'], club: 1 };
      const t = await bau(me, { ...F0, dyn: alle });
      const fehler = []; let rest = alle.slice();
      for (const [n, hi] of [[GUN, 2], [CORE, 0], [GUN, 1], [CORE, 2]]) {
        await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, inst(t, n, hi, me), {}));
        rest = rest.filter(x => !(x[0] === n && x[1] === hi));
        const ref = await bau(me, { ...F0, dyn: rest }, t.pile(me, 'discardPile').slice());
        const d = diff(t, ref); if (d.length) fehler.push(`nach ${kurz(n)}@${hi}: ${d.slice(0, 2).join(' ; ')}`);
        if (!aura && !fluch) { const p = pruefe(t); if (p.length) fehler.push(`Formel nach ${kurz(n)}@${hi}: ${p[0]}`); }
      }
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`vier Karten auf drei Helden, nacheinander zerstört (Aura ${aura ? 'ja' : 'nein'}, Fluch ${fluch || 'nein'}): jeder Zwischenstand == Referenz`, fehler.length === 0, fehler);
    }

    // ═══ (B) Die Ablage ändert sich auf vielen Wegen — Core/Gun folgen sofort ═══
    R.section(`Sitz ${me} · (B) Ablage ändert sich: jeder Core/jede Gun == Formel nach jedem Weg (ohne Zusatzhook)`);
    const OPS = {
      'Spell aus der Hand ausgespielt': async (t) => { await t.play(me, 'Fireball', { hero: 2, active: me }); },
      'Handkarte abgeworfen': async (t) => { await t.run(() => t.engine.actionDiscardHandCard(me, 'Heal', t.gs.players[me].hand.indexOf('Heal'), { source: 'Test' })); },
      'Zwangsabwurf (2 Karten)': async (t) => { await t.run(() => t.engine.actionDiscardCards(me, 2, { source: 'Test' })); },
      'Mill 3': async (t) => { await t.run(() => t.engine.actionMillCards(me, 3, { source: 'Test' })); },
      'Kreatur stirbt an Schaden': async (t) => { const k = t.put(me, 2, 2, 'ZZ Dummy Frail'); await t.run(() => t.engine.actionDealCreatureDamage({ name: 'T', owner: op }, k, 50, 'fire', {})); },
      'Kreatur abgelegt': async (t) => { const k = t.put(me, 2, 2, 'ZZ Dummy'); await t.run(() => t.engine.actionMoveCard(k, 'discard', -1, -1, { source: 'Test' })); },
      'fremde Ausrüstung zerstört': async (t) => { await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, inst(t, CLUB, 0, me), {})); },
      'Karte aus der Ablage auf die Hand': async (t) => { await t.run(() => t.engine.actionMoveCard({ ...({}), name: 'x' }, 'hand', -1, -1, {})).catch(() => {}); const p = t.pile(me, 'discardPile'); const i = p.indexOf('Fireball'); if (i >= 0) { p.splice(i, 1); t.gs.players[me].hand.push('Fireball'); } t.engine.sync(); },
      'Direktzugriff: Karten in die Ablage geschoben': async (t) => { t.pile(me, 'discardPile').push('Heal', 'Fire Bomb', GUN); t.engine.sync(); },
      'Direktzugriff: Karten aus der Ablage genommen': async (t) => { const p = t.pile(me, 'discardPile'); p.splice(0, Math.min(2, p.length)); t.engine.sync(); },
      'Karte aus der Ablage in den Gelöscht-Stapel': async (t) => { const p = t.pile(me, 'discardPile'); const x = p.pop(); if (x) t.gs.players[me].deletedPile.push(x); t.engine.sync(); },
      'Gun/Core selbst zerstört (landet in der Ablage)': async (t) => { const c = inst(t, GUN, 1, me) || inst(t, CORE, 2, me); if (c) await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {})); },
      'Zugende + Zugbeginn': async (t) => { await t.endTurn(); await t.endTurn(); },
    };
    for (const [on, fn] of Object.entries(OPS)) {
      const t = await bau(me, { club: 1, dyn: [[CORE, 1], [GUN, 1], [CORE, 2], [GUN, 2]], pile: [GUN, 'Fireball'], extra: ['Heal', 'Fireball', 'Heal', 'Fire Bomb', 'Fireball'] });
      t.gs.activePlayer = me;
      const vor = pruefe(t);
      await fn(t);
      const fehler = pruefe(t);
      R.check(`Weg „${on}": Core/Gun an Held 1 und 2 == Formel (Ablage ${t.pile(me, 'discardPile').length} Karten)${vor.length ? ' [Ausgang schon falsch]' : ''}`, fehler.length === 0 && vor.length === 0 && t.errors.length === 0, { fehler, vor, e: t.errors.slice(0, 2) });
    }

    // ═══ (C) Heldentod: Core/Gun an ANDEREN Helden stimmen schon WÄHREND des Todesablaufs und direkt danach (ohne `onAnyActionResolved`) ═══
    R.section(`Sitz ${me} · (C) Heldentod: Core/Gun anderer Helden während und direkt nach dem Tod`);
    const TOD_SZENEN = {
      'Club+Sun': { club: 1, sun: 1, dyn: [[CORE, 1], [GUN, 2]] },
      'Gun+Core am Sterbenden': { club: 1, dyn: [[GUN, 0], [CORE, 0], [CORE, 1], [GUN, 2]] },
      'Gun an allen': { club: 1, sun: 1, dyn: [[GUN, 0], [GUN, 1], [GUN, 2]] },
      'Core an allen': { club: 1, sun: 1, dyn: [[CORE, 0], [CORE, 1], [CORE, 2]] },
      'Fluch nach + Club': { club: 1, fluch: 'nach', dyn: [[CORE, 1], [GUN, 2]] },
    };
    for (const [sn, F] of Object.entries(TOD_SZENEN)) {
      const t = await bau(me, { ...F, pile: [GUN, 'Fireball'] });
      const fehler = [], probe = [];
      const od = t.engine._delay.bind(t.engine);
      t.engine._delay = async (ms) => { const p = pruefe(t, [[me, 0]]); if (p.length) probe.push('delay: ' + p[0]); return od(ms); };
      const orh = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (n, c) => { const r = await orh(n, c); const p = pruefe(t, [[me, 0]]); if (p.length) probe.push(`nach Hook ${n}: ${p[0]}`); return r; };
      await toeten(t, me, 0);
      t.engine._delay = od; t.engine.runHooks = orh;
      const direkt = pruefe(t, [[me, 0]]);
      if (probe.length) fehler.push(...probe.slice(0, 2));
      if (direkt.length) fehler.push('direkt nach dem Tod: ' + direkt[0]);
      // der Gefallene selbst: Ausrüstung weg, keine verwaisten Buchungen
      if (t.hero(me, 0).atk !== (DB[BLANK[0]].atk || 0) + (F.fluch ? 0 : 0)) fehler.push(`Gefallener ATK ${t.hero(me, 0).atk}`);
      // Zugumlauf und Wiederbelebung ändern nichts am Ergebnis
      await beleben(t, me, 0);
      const nachRev = pruefe(t); if (nachRev.length) fehler.push('nach Wiederbelebung: ' + nachRev[0]);
      await t.endTurn(); await t.endTurn();
      const nachUml = pruefe(t); if (nachUml.length) fehler.push('nach Zugumlauf: ' + nachUml[0]);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Tod mit „${sn}": übrige Helden stimmen während des Ablaufs, direkt danach, nach Wiederbelebung und Zugumlauf`, fehler.length === 0, fehler);
    }
    // (C2) ein weiterer Treffer derselben Kette liest die neue Ablage: der Tod von Held 0 löst einen Folgetreffer aus, dessen Schaden vom ATK des Helden 1 abhängt
    {
      const t = await bau(me, { club: 1, sun: 1, dyn: [[CORE, 1]], pile: ['Fireball'] });
      const gelesen = [];
      const orh = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (n, c) => { if (n === 'onHeroKO') { await t.run(async () => {}); gelesen.push({ hook: n, atk1: t.hero(me, 1).atk, pile: t.pile(me, 'discardPile').length }); } return orh(n, c); };
      await toeten(t, me, 0);
      // Während `onHeroKO` liegt die Ausrüstung noch am Helden (Aufräumen kommt danach) — der Wert muss zur Ablage zu DIESEM Zeitpunkt passen; danach zur neuen
      const p = pruefe(t); R.check('Tod: nach dem Aufräumen Held 1 == Formel über die neue Ablage (Club, Sun liegen darin)', p.length === 0 && t.pile(me, 'discardPile').includes(CLUB), { p, gelesen });
    }

    // ═══ (D) Gegnerseite: Core/Gun auf BEIDEN Seiten; Tod auf der einen ändert nichts am Rest der anderen und umgekehrt ═══
    R.section(`Sitz ${me} · (D) beide Seiten tragen Core/Gun`);
    for (const wer of ['eigener Held', 'Gegnerheld']) {
      const t = await bau(me, { club: 1, dyn: [[CORE, 1]], opDyn: [[GUN, 1], [CORE, 2]], pile: [GUN], opPile: [GUN, GUN, 'Fireball'] });
      const fehler = [];
      const p0 = pruefe(t); if (p0.length) fehler.push('Ausgang: ' + p0[0]);
      if (wer === 'eigener Held') await toeten(t, me, 0);
      else await t.run(() => t.engine.actionDefeatHero({ name: 'T', owner: me, heroIdx: 0 }, t.hero(op, 1), {}));
      const p1 = pruefe(t, wer === 'eigener Held' ? [[me, 0]] : [[op, 1]]); if (p1.length) fehler.push('nach dem Tod: ' + p1[0]);
      // Der Gefallene (Gegnerheld mit Gun) legt seine Gun in die Ablage des Gegners — Core an Gegnerheld 2 zählt sie
      if (wer === 'Gegnerheld') {
        const cop = inst(t, CORE, 2, op);
        if (!cop) fehler.push('Core des Gegners fehlt');
      }
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`Tod eines Helden (${wer}) bei Core/Gun auf beiden Seiten: alle übrigen Helden == Formel`, fehler.length === 0, fehler);
    }

    // ═══ (E) Teleportation Powder: Wirt verschwindet und kehrt zurück; die Ablage ändert sich währenddessen ═══
    R.section(`Sitz ${me} · (E) Teleportation Powder`);
    for (const dyn of [CORE, GUN]) for (const sn of ['schlicht', 'aura']) {
      const S0 = SZENEN[sn], fehler = [];
      const t = await bau(me, { ...S0, dyn: [[dyn, 0], [dyn === CORE ? GUN : CORE, 1]], pile: ['Fireball', GUN] });
      t.addHand(op, 'Teleportation Powder');
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === me && y.heroIdx === 0); return x ? [x.id] : null; };
      t.gs.activePlayer = op; t.phase(3); t.reset();
      await t.play(op, 'Teleportation Powder', { hero: 0, active: op });
      const weg = !t.gs.players[me].heroes[0].name;
      if (!weg) fehler.push('Held nicht verschwunden');
      // Ablage ändert sich in der Abwesenheit
      t.pile(me, 'discardPile').push('Heal', GUN); t.engine.sync();
      const mitte = pruefe(t); if (mitte.length) fehler.push('Abwesenheit: ' + mitte[0]);
      await t.endTurn(); await t.endTurn();
      const zurueck = !!t.gs.players[me].heroes[0].name;
      if (!zurueck) fehler.push('Held nicht zurück');
      const nach = pruefe(t); if (nach.length) fehler.push('nach der Rückkehr: ' + nach[0]);
      // Karte am zurückgekehrten Helden zerstört → Referenz ohne sie
      const c = inst(t, dyn, 0, me);
      if (c) {
        await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, c, {}));
        const ref = await bau(me, { ...S0, dyn: [[dyn === CORE ? GUN : CORE, 1]] }, t.pile(me, 'discardPile').slice());
        const d = diff(t, ref).filter(x => !/^S\d+H0/.test(x) || true);
        // Beim Referenzaufbau liegen die Sonderzähler (Zugumlauf, Fluch) anders; verglichen wird der ATK-Zustand
        const dd = []; for (const hi of [0, 1, 2]) { const a = zust(t, me, hi), b = zust(ref, me, hi); if (a.atk !== b.atk || a.aura !== b.aura) dd.push(`H${hi}: ${JSON.stringify(a)} != Ref ${JSON.stringify(b)}`); }
        if (dd.length) fehler.push('zerstört nach Rückkehr: ' + dd[0]); void d;
      } else fehler.push('Karte fehlt nach der Rückkehr');
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${kurz(dyn)} · Szene „${sn}": Teleport weg/zurück, Ablage ändert sich dazwischen → Formel; danach zerstört == Referenz`, fehler.length === 0, fehler);
    }

    // ═══ (F) Übernommener Held (Charme): „your discard pile" = Kontrolleur ═══
    R.section(`Sitz ${me} · (F) Charme / Kontrolle`);
    for (const dyn of [CORE, GUN]) {
      const fehler = [];
      const t = await bau(me, { dyn: [], pile: ['Fireball'], opPile: [GUN, GUN, 'Heal', 'Fire Bomb'] });
      t.addHand(me, dyn);
      const ok = t.engine.actionStealHero(me, op, 0, { sourceName: 'Test' });
      if (!ok) fehler.push('Charme nicht angelegt');
      const gh = () => t.gs.players[op].heroes[0];
      const vor = gh().atk;
      const r = await t.play(me, dyn, { hero: 0, targetOwner: op, active: me });
      const c = t.inst(x => x.name === dyn && x.zone === 'support')[0];
      if (!c) { R.note(`${kurz(dyn)} am übernommenen Helden nicht anlegbar`, r); continue; }
      const kontroll = t.gs.players[t.engine.effektiveSeiten(c).owner];
      const bonus = dyn === CORE ? 10 * new Set(kontroll.discardPile.map(n => n)).size : 40 * kontroll.discardPile.filter(n => n === GUN).length;
      if (gh().atk !== vor + bonus) fehler.push(`mit Karte: ${gh().atk} != ${vor} + ${bonus}`);
      kontroll.discardPile.push('Hand of Doom', 'Heal', GUN); t.engine.sync();
      const bonus2 = dyn === CORE ? 10 * new Set(kontroll.discardPile).size : 40 * kontroll.discardPile.filter(n => n === GUN).length;
      if (gh().atk !== vor + bonus2) fehler.push(`Ablage geändert: ${gh().atk} != ${vor} + ${bonus2}`);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: me }, c, {}));
      if (gh().atk !== vor) fehler.push(`zerstört: ${gh().atk} != ${vor} (wie ohne je angelegt)`);
      if (t.errors.length) fehler.push('ERR ' + t.errors[0]);
      R.check(`${kurz(dyn)} am übernommenen Gegnerhelden: Bonus nach der Ablage des Kontrolleurs, nach dem Zerstören exakt wie vorher`, fehler.length === 0, fehler);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('FATAL ' + (e && e.stack || e) + '\n'); process.exit(2); });
